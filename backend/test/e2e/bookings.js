/**
 * End-to-end booking flow (website and app): validation, holds and their expiry, mobile money, staff confirmation,
 * digital key. Needs a running API on fresh demo data:  node db/setup.js --reset --demo  then  node test/e2e/bookings.js
 */
const BASE = process.env.API_URL || 'http://localhost:5001/api';
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const db = new Client({ host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let failures = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ' ' + extra}`); if (!cond) failures++; };
const call = async (method, path, body, token) => {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (e, p) => (await call('POST', '/auth/login', { emailOrUsername: e, password: p })).body.token;

(async () => {
  await db.connect();
  const staff = await login('manager@fayshaa.com', 'Faysha2026!');
  const unit = (await db.query(`SELECT id FROM apartments WHERE unit_number = 'S-102'`)).rows[0].id;
  const guest = { guest_name: 'Test Guest', guest_email: 'Test.Guest@Example.com', guest_phone: '+237 677 00 00 00', number_of_guests: 2 };

  // Validation
  let r = await call('POST', '/bookings', { ...guest, apartment_id: unit, check_in_date: day(-2), check_out_date: day(1) });
  check('past check-in refused (400)', r.status === 400, JSON.stringify(r));
  r = await call('POST', '/bookings', { ...guest, apartment_id: unit, check_in_date: day(5), check_out_date: day(3) });
  check('reversed dates refused (400)', r.status === 400, JSON.stringify(r));
  r = await call('POST', '/bookings', { ...guest, number_of_guests: 9, apartment_id: unit, check_in_date: day(3), check_out_date: day(5) });
  check('too many guests refused (400)', r.status === 400, JSON.stringify(r));
  r = await call('POST', '/bookings', { ...guest, apartment_id: unit, check_in_date: 'tomorrow', check_out_date: day(5) });
  check('bad date format refused (400)', r.status === 400, JSON.stringify(r));

  // Website / app flow
  r = await call('POST', '/bookings/check-availability', { apartment_id: unit, check_in_date: day(3), check_out_date: day(5) });
  check('check-availability says available', r.status === 200 && r.body.available === true && r.body.final_price === 56000, JSON.stringify(r.body));
  r = await call('POST', '/bookings', { ...guest, apartment_id: unit, check_in_date: day(3), check_out_date: day(5) });
  check('booking created (201)', r.status === 201 && r.body.booking.status === 'pending', JSON.stringify(r));
  check('response carries no secrets', r.body.booking && !('temporary_password' in r.body.booking) && !('access_code' in r.body.booking) && !r.body.accessCode);
  check('new guest account flagged', r.body.accountCreated === true);
  const b = r.body.booking;
  const acct = (await db.query(`SELECT email, must_change_password FROM users WHERE id = $1`, [b.user_id])).rows[0];
  check('account email stored lower-case', acct.email === 'test.guest@example.com', acct.email);

  r = await call('POST', '/bookings', { ...guest, apartment_id: unit, check_in_date: day(4), check_out_date: day(6) });
  check('overlapping booking refused (409)', r.status === 409, JSON.stringify(r));
  r = await call('POST', '/bookings/check-availability', { apartment_id: unit, check_in_date: day(4), check_out_date: day(6) });
  check('availability now false', r.body.available === false);

  r = await call('POST', '/payments/create-intent', { booking_id: b.id });
  check('card payment unavailable without Stripe key (503, clear message)', r.status === 503 && /mobile money/.test(r.body.message), JSON.stringify(r));

  r = await call('POST', `/bookings/${b.id}/confirm`, { payment_intent_id: 'pi_fake' });
  check('guest cannot confirm without real payment (402)', r.status === 402, JSON.stringify(r));

  r = await call('POST', '/payments/mobile-money', { booking_id: b.id, provider: 'mtn', phone: '677000000', terms_accepted: true, terms_accepted_at: new Date().toISOString() });
  check('mobile money recorded', r.status === 200 && r.body.payment.status === 'pending', JSON.stringify(r));
  r = await call('POST', '/payments/mobile-money', { booking_id: b.id, provider: 'orange', phone: '699000000', terms_accepted: true });
  const momoCount = (await db.query(`SELECT count(*)::int n FROM payments WHERE booking_id = $1`, [b.id])).rows[0].n;
  check('repeat mobile money request does not duplicate', r.status === 200 && momoCount === 1, `count=${momoCount}`);

  // Old hold sweep must not cancel a mobile money booking within 48h
  await db.query(`UPDATE bookings SET created_at = NOW() - INTERVAL '3 hours' WHERE id = $1`, [b.id]);
  await call('GET', `/bookings/availability?start_date=${day(3)}&end_date=${day(5)}`);
  check('mobile money hold kept after 3h', (await db.query(`SELECT status FROM bookings WHERE id=$1`, [b.id])).rows[0].status === 'pending');

  r = await call('POST', `/bookings/${b.id}/confirm`, {}, staff);
  check('staff confirms (money received)', r.status === 200 && r.body.booking.status === 'confirmed', JSON.stringify(r));
  const after = (await db.query(`SELECT b.terms_accepted, b.door_pin, b.gate_qr_code, p.status AS pay FROM bookings b JOIN payments p ON p.booking_id = b.id WHERE b.id = $1`, [b.id])).rows[0];
  check('terms acceptance preserved', after.terms_accepted === true);
  check('mobile money payment completed', after.pay === 'completed', after.pay);
  check('digital key generated', !!after.door_pin && !!after.gate_qr_code);
  r = await call('POST', `/bookings/${b.id}/confirm`, {}, staff);
  check('confirm is idempotent', r.status === 200 && /already/.test(r.body.message));

  // Abandoned card checkout expires and frees the residence
  r = await call('POST', '/bookings', { ...guest, guest_email: 'walkaway@example.com', apartment_id: unit, check_in_date: day(20), check_out_date: day(22) });
  check('second booking created', r.status === 201, JSON.stringify(r));
  const b2 = r.body.booking;
  await db.query(`UPDATE bookings SET created_at = NOW() - INTERVAL '2 hours' WHERE id = $1`, [b2.id]);
  r = await call('POST', '/bookings/check-availability', { apartment_id: unit, check_in_date: day(20), check_out_date: day(22) });
  check('expired card hold released', r.body.available === true, JSON.stringify(r.body));
  const st = (await db.query(`SELECT status, cancellation_reason FROM bookings WHERE id=$1`, [b2.id])).rows[0];
  check('expired booking cancelled with reason', st.status === 'cancelled' && /not completed/.test(st.cancellation_reason), JSON.stringify(st));
  r = await call('POST', `/bookings/${b2.id}/confirm`, {}, staff);
  check('staff cannot confirm a cancelled booking (409)', r.status === 409, JSON.stringify(r));

  // Existing guest books again: account reused
  r = await call('POST', '/bookings', { ...guest, guest_email: 'claire.fontaine@example.com', apartment_id: unit, check_in_date: day(40), check_out_date: day(42) });
  check('existing guest reuses account', r.status === 201 && !r.body.accountCreated, JSON.stringify(r.body).slice(0, 200));

  // The new guest can see their stay after confirmation via the app's keys endpoint (sign in as them by resetting password)
  await db.query(`UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE email = 'manager@fayshaa.com'), must_change_password = false WHERE email = 'test.guest@example.com'`);
  const gt = await login('test.guest@example.com', 'Faysha2026!');
  r = await call('GET', '/bookings/user/my-keys', null, gt);
  check('guest sees digital key in app', r.status === 200 && r.body.keys.apartments.length === 1 && r.body.keys.apartments[0].doorPIN, JSON.stringify(r.body).slice(0, 300));
  r = await call('GET', '/guest/stays', null, gt);
  check('guest stays list has the stay', r.status === 200 && JSON.stringify(r.body).includes(b.booking_number), JSON.stringify(r.body).slice(0, 300));

  await db.end();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

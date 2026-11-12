/**
 * End-to-end checks for v2.1: confirmation from every path (the Stripe webhook racing /confirm), deposit boxes,
 * enquiries, events and proposals, content, notifications and the monitor, loans, visitors, ratings, inspections,
 * dining pre-orders, assets and the reserve, wellness catalogue, currencies.
 * Needs a running API on fresh demo data:  node db/setup.js --reset --demo  then  node test/e2e/v21.js
 */
const BASE = process.env.API_URL || 'http://localhost:5001/api';
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = new Client({ host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 5432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : `  ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 300)}`}`);
  if (!cond) failures++;
};
const call = async (method, p, body, token) => {
  const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (e, p) => (await call('POST', '/auth/login', { emailOrUsername: e, password: p })).body.token;
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const monthsAgo = (m) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 10);
};

(async () => {
  await db.connect();
  const m = await login('manager@fayshaa.com', 'Faysha2026!');
  const g = await login('claire.fontaine@example.com', 'Faysha2026!');
  const monitor = require('../../services/monitor');

  // ---------- Booking: webhook first, then /confirm; key once; deposit box ----------
  const units = (await call('GET', `/bookings/availability?start_date=${day(60)}&end_date=${day(62)}`)).body.availability.filter((u) => u.is_available);
  let r = await call('POST', '/bookings', { apartment_id: units[0].id, check_in_date: day(60), check_out_date: day(62), number_of_guests: 1, guest_name: 'Ada Obi', guest_email: `ada${Date.now()}@example.com`, guest_phone: '+237 677 11 22 33' });
  check('booking created with a new account', r.status === 201 && r.body.accountCreated === true, r);
  const b = r.body.booking;
  await db.query(`INSERT INTO payments (booking_id, payment_method, amount, currency, status, stripe_payment_intent_id) VALUES ($1, 'stripe', 1, 'XAF', 'pending', $2)`, [b.id, `pi_e2e_${b.id}`]);
  r = await fetch(`${BASE}/payments/webhook/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: `pi_e2e_${b.id}` } } }) });
  check('webhook accepted', r.status === 200);
  const after = (await db.query('SELECT status, gate_qr_code, door_pin, deposit_box_number FROM bookings WHERE id = $1', [b.id])).rows[0];
  check('webhook confirmation issues the key', after.status === 'confirmed' && after.gate_qr_code && after.door_pin && after.deposit_box_number, after);
  r = await call('POST', `/bookings/${b.id}/confirm`, {}, m);
  check('a later /confirm is idempotent', r.status === 200);
  const keys = (await db.query('SELECT gate_qr_code FROM bookings WHERE id = $1', [b.id])).rows[0];
  check('the key is not re-issued', keys.gate_qr_code === after.gate_qr_code);

  // Two guests on the same residence never share a deposit box PIN.
  r = await call('POST', '/bookings', { apartment_id: units[0].id, check_in_date: day(70), check_out_date: day(72), number_of_guests: 1, guest_name: 'Second Guest', guest_email: `second${Date.now()}@example.com`, guest_phone: '+237 600' });
  await call('POST', `/bookings/${r.body.booking.id}/confirm`, { payment_method: 'cash' }, m);
  const later = (await db.query('SELECT deposit_box_pin FROM bookings WHERE id = $1', [r.body.booking.id])).rows[0];
  check('the next stay waits for the box (no PIN yet)', later.deposit_box_pin === null, later);

  // ---------- Enquiries ----------
  r = await call('POST', '/contact', { name: 'Marie', email: 'marie@example.com', subject: 'Wedding', message: 'Hello' });
  check('contact form saved', r.status === 201 && r.body.id);
  for (const st of ['Closed', 'Open', 'Spam']) {
    r = await call('PATCH', `/manager/enquiries/${r.body.id || 1}`, { status: st }, m);
    check(`enquiry → ${st}`, r.status === 200 && r.body.status === st, r);
  }

  // ---------- Events: request → proposal → accept → deposit ----------
  r = await call('POST', '/events', { name: 'Jean', email: 'jean@example.com', eventType: 'corporate', eventDate: day(90), guests: 60, spaces: ['lounge'], services: ['sound'] });
  check('event request', r.status === 201 && /^EVT-/.test(r.body.reference), r);
  const ev = r.body.id;
  r = await call('POST', `/manager/events/${ev}/quotes`, { items: [{ label: 'Hire', qty: 1, unitPrice: 800000 }, { label: 'Dinner', qty: 60, unitPrice: 32000 }], taxRate: 19.25, depositPercent: 40 }, m);
  const q = r.body.quotes[0];
  check('proposal totals', q.subtotal === 2720000 && q.tax === 523600 && q.total === 3243600 && q.depositAmount === 1297440, q);
  r = await call('POST', `/manager/events/${ev}/quotes/${q.id}/send`, {}, m);
  if (r.status === 503) console.log('skip proposal emailing (SMTP not configured)');
  else {
    check('proposal sent', r.status === 200 && r.body.status === 'quoted', r);
    const token = r.body.quotes[0].link.split('/').pop();
    r = await call('POST', `/events/quote/${token}/respond`, { decision: 'accept', name: 'Jean Mbarga' });
    check('client accepts', r.status === 200 && r.body.status === 'accepted', r);
    r = await call('POST', `/manager/events/${ev}/deposit`, { amount: 1297440, method: 'bank_transfer' }, m);
    check('deposit confirms the date', r.status === 201 && r.body.status === 'confirmed', r);
  }

  // ---------- Content ----------
  r = await call('GET', '/content/legal/terms');
  check('published terms', r.status === 200 && r.body.version >= 1 && r.body.body.length > 1000);
  r = await call('PUT', '/manager/content/legal/terms', { draft: '## New\n\nText' }, m);
  r = await call('POST', '/manager/content/legal/terms/publish', { summary: 'e2e' }, m);
  check('a new terms version', r.status === 200 && r.body.versions.length >= 2, r);

  // ---------- Loans, visitors, ratings, inspections, pre-orders ----------
  await call('POST', '/manager/loans/items', { code: 'L-E2E', name: 'Locker', category: 'locker' }, m);
  r = await call('POST', '/guest/loans', { category: 'locker' }, g);
  check('locker requested', r.status === 201, r);
  const loan = r.body.id;
  r = await call('POST', `/manager/loans/${loan}/assign`, {}, m);
  check('locker assigned with a code', r.status === 200 && r.body.status === 'ready' && /^\d{4}$/.test(r.body.pin), r);
  r = await call('POST', `/manager/loans/${loan}/return`, {}, m);
  check('locker returned', r.body.status === 'returned');

  await db.query(`UPDATE bookings SET check_out_date = CURRENT_DATE + 3 WHERE user_id = (SELECT id FROM users WHERE email = 'claire.fontaine@example.com') AND status = 'checked_in'`);
  r = await call('POST', '/guest/visitors', { visitorName: 'Paul', date: day(1) }, g);
  check('visitor pass requested', r.status === 201 && r.body.status === 'pending', r);
  const pass = r.body;
  r = await fetch(`${BASE}/visit/${pass.link.split('/').pop()}`).then((x) => x.json());
  check('code hidden until approved', r.code === null);
  r = await call('POST', `/manager/visitors/${pass.id}/approve`, {}, m);
  check('pass approved', r.body.status === 'approved');
  r = await call('POST', '/manager/gate/open', { passId: pass.id }, m);
  check('gate recorded (no controller → manual)', r.status === 200 && r.body.controllerOk === null);

  // A visitor who comes alone gets the pass by email; a discreet one who stays the night is registered, privately.
  r = await call('POST', '/guest/visitors', { visitorName: 'Amina Bello', visitorEmail: 'not-an-email', date: day(0) }, g);
  check('a bad visitor email is refused', r.status === 400, r);
  r = await call('POST', '/guest/visitors', { visitorName: 'Amina Bello', visitorEmail: ' Amina@Example.com ', date: day(0), discreet: true }, g);
  check('pass keeps the visitor email', r.status === 201 && r.body.visitorEmail === 'amina@example.com', r);
  const night = r.body;
  r = await call('POST', `/guest/visitors/${night.id}/email`, {}, g);
  check('a pending pass saves the email for later', r.status === 200 && r.body.sent === false, r);
  await call('POST', `/manager/visitors/${night.id}/approve`, {}, m);
  r = await call('POST', `/guest/visitors/${night.id}/email`, {}, g);
  check('emailing without SMTP says so (503)', r.status === 503, r);
  r = await call('POST', `/guest/visitors/${night.id}/stay`, {}, g);
  check('"staying the night" asks to register the visitor', r.status === 201 && r.body.status === 'pending' && r.body.passId === night.id && r.body.discreet === true, r);
  const nightGuest = r.body;
  r = await call('POST', `/guest/visitors/${night.id}/stay`, {}, g);
  check('only once per pass', r.status === 409, r);
  r = await call('GET', '/manager/visitors/guests', null, m);
  const listed = r.body.find((x) => x.id === nightGuest.id);
  check('staff see a private guest', listed && listed.fullName === 'Private guest' && listed.phone === null, listed);
  r = await call('POST', `/manager/visitors/guests/${nightGuest.id}/reveal`, {}, m);
  check('the gate can reveal the name', r.status === 200 && r.body.fullName === 'Amina Bello', r);
  r = await call('POST', `/manager/visitors/guests/${nightGuest.id}/approve`, {}, m);
  check('overnight guest approved', r.status === 200 && r.body.status === 'approved', r);
  r = await call('POST', '/manager/visitors/verify', { token: night.link.split('/').pop() }, m);
  check('their pass is valid as a registered overnight guest', r.status === 200 && r.body.valid === true && r.body.overnight?.status === 'approved', r);
  await call('POST', '/manager/gate/open', { passId: night.id }, m);
  await call('POST', `/manager/visitors/${night.id}/leave`, {}, m);
  r = await call('POST', '/manager/gate/open', { passId: night.id }, m);
  check('an overnight guest can come back in on the pass', r.status === 200, r);

  // With "register overnight guests at once", a request within capacity does not wait for a manager.
  const policyNow = (await call('GET', '/manager/visitors/settings', null, m)).body;
  await call('PUT', '/manager/visitors/settings', { ...policyNow, autoApproveStayGuests: true }, m);
  await db.query(`UPDATE apartments SET max_occupancy = 10 WHERE id = (SELECT apartment_id FROM bookings WHERE user_id = (SELECT id FROM users WHERE email = 'claire.fontaine@example.com') AND status = 'checked_in' LIMIT 1)`);
  r = await call('POST', '/guest/visitors/guests', { fullName: 'Late Guest', to: day(1) }, g);
  check('overnight guest registered at once', r.status === 201 && r.body.status === 'approved', r);
  await call('PUT', '/manager/visitors/settings', policyNow, m);

  // Reservations and Guest 360 show everyone on the stay; discreet people stay private there too.
  const claire = (await db.query(`SELECT b.id AS booking, b.user_id FROM bookings b JOIN users u ON u.id = b.user_id WHERE u.email = 'claire.fontaine@example.com' AND b.status = 'checked_in' LIMIT 1`)).rows[0];
  r = await call('GET', `/manager/reservations/${claire.booking}/people`, null, m);
  const onStay = r.body;
  check('reservation lists its overnight guests', r.status === 200 && onStay.guests.some((x) => x.fullName === 'Late Guest' && x.status === 'approved'), r);
  check('a discreet overnight guest is private on the reservation', onStay.guests.some((x) => x.id === nightGuest.id && x.fullName === 'Private guest') && !JSON.stringify(onStay).includes('Amina'), onStay.guests);
  check('tonight counts booked + registered guests', onStay.tonight.total === onStay.tonight.booked + onStay.tonight.added && onStay.tonight.added >= 1, onStay.tonight);
  check('visitors appear on the reservation', onStay.visitors.some((x) => x.id === night.id && x.visitorName === 'Private visitor'), onStay.visitors);
  r = await call('GET', '/manager/reservations', null, m);
  const resRow = r.body.find((x) => x.id === claire.booking);
  check('reservation list carries overnight counts', resRow && resRow.addedGuests.registered >= 2 && resRow.addedGuests.tonight >= 1, resRow && resRow.addedGuests);
  r = await call('GET', `/manager/guests/${claire.user_id}/timeline`, null, m);
  const visitsLine = r.body.filter((x) => x.category === 'Visitors').map((x) => x.title);
  check('guest journey shows visitors and overnight guests', visitsLine.some((t) => /Overnight guest registered – Late Guest/.test(t)) && visitsLine.some((t) => /Visitor pass – Private visitor/.test(t)), visitsLine);
  check('guest journey never names a discreet guest', !visitsLine.some((t) => /Amina/.test(t)), visitsLine);
  r = await call('GET', `/manager/guests/${claire.user_id}`, null, m);
  check('Guest 360 profile has the household', r.status === 200 && r.body.household && r.body.household.guests.length >= 2, r.body.household);

  r = await call('GET', '/guest/ratings/pending', null, g);
  const toRate = r.body.find((x) => x.context === 'loan');
  r = await call('POST', '/guest/ratings', { context: 'loan', contextId: toRate.contextId, rating: 2, comment: 'Late' }, g);
  check('rating saved', r.status === 201);
  r = await call('GET', '/manager/quality/summary', null, m);
  check('low rating counted', r.body.overall.open_low >= 1);

  const room = (await call('GET', '/manager/housekeeping/rooms', null, m)).body.find((x) => x.status !== 'Occupied');
  r = await call('PATCH', `/manager/housekeeping/rooms/${room.id}`, { status: 'Ready' }, m);
  check('Ready needs an inspection', r.status === 409);
  const list = (await call('GET', '/manager/housekeeping/checklist', null, m)).body;
  r = await call('POST', `/manager/housekeeping/rooms/${room.id}/inspect`, { score: 5, checklist: list.map((item) => ({ item, ok: true })) }, m);
  check('inspection passes → Ready', r.body.status === 'Ready', r);

  const menu = (await call('GET', '/guest/dining/menu', null, g)).body;
  r = await call('POST', '/guest/dining/reservations', { venue: menu[0].venue, date: day(2), time: '19:30', guests: 2, preorder: [{ id: menu[0].id, qty: 2, price: 1 }] }, g);
  check('pre-order priced from the menu', r.status === 201 && r.body.preorderTotal === menu[0].price * 2, r);

  // ---------- Assets and the reserve ----------
  r = await call('POST', '/manager/assets', { code: 'PUMP-E2E', name: 'Pump', category: 'pool', criticality: 'critical', purchaseDate: monthsAgo(58), expectedLifeMonths: 60, replacementCost: 2400000, leadTimeDays: 45, sparesMin: 1 }, m);
  check('asset lifecycle figures', r.status === 201 && r.body.lifeLeftMonths === 2 && r.body.monthlyReserve === 1200000 && r.body.flags.includes('order_soon') && r.body.flags.includes('spares_low'), r);
  const asset = r.body.id;
  await monitor.tick(null);
  await monitor.tick(null);
  r = await call('GET', `/manager/assets/${asset}`, null, m);
  check('one reserve contribution per month', r.body.reserve.length === 1 && r.body.reserveBalance === 1200000, r.body.reserve);
  r = await call('GET', '/manager/notifications', null, m);
  check('monitor raised the asset alerts once', r.body.filter((n) => /PUMP-E2E/.test(n.title)).length === 2, r.body.map((n) => n.title));

  // ---------- Wellness catalogue ----------
  r = await call('POST', '/manager/wellness/catalog', { name: 'E2E journey', category: 'restore', accessMode: 'pin', stages: [{ name: 'One', duration: 30, requiresPin: true }, { name: 'Two', duration: 15 }] }, m);
  check('journey with stages', r.status === 201 && r.body.type === 'journey' && r.body.duration === 45 && r.body.stages.length === 2, r);

  // ---------- Currencies ----------
  r = await call('PUT', '/manager/settings/currencies', { accepted: ['XAF', 'EUR', 'USD'], rates: { USD: 610, EUR: 1 } }, m);
  check('EUR stays pegged', r.body.rates.EUR === 655.957 && r.body.rates.USD === 610, r.body.rates);
  r = await call('GET', '/content/stay-policy');
  check('public currencies', r.body.currencies.accepted.includes('EUR') && r.body.currencies.rates.USD === 610);

  await db.end();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * End-to-end checks for wellness booking: stay-only days, instant vs request, several experiences at once, codes,
 * confirm (at another time) / decline in FAY OS, check-in by code.
 * Needs a running API on fresh demo data:  node db/setup.js --reset --demo  then  ADMIN_PASSWORD=… node test/e2e/wellness.js
 */
const BASE = process.env.API_URL || 'http://localhost:5001/api';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : `  ${JSON.stringify(extra).slice(0, 300)}`}`);
  if (!cond) failures++;
};
const call = async (method, p, body, token) => {
  const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (e, p) => (await call('POST', '/auth/login', { emailOrUsername: e, password: p })).body.token;

(async () => {
  const m = await login('manager@fayshaa.com', 'Faysha2026!');
  const admin = await login('admin@fayshaa.com', process.env.ADMIN_PASSWORD);
  const g = await login('james.whitfield@example.com', 'Faysha2026!'); // a stay that starts in a few days

  const acts = (await call('GET', '/wellness-unified/activities', null, g)).body.activities;
  const id = (name) => acts.find((a) => a.name === name).id;
  const gym = id('Gym & Training');
  const trainer = id('Personal Trainer');
  const meditation = id('Meditation');
  const restore = id('Restore');

  let r = await call('GET', `/wellness-unified/activities/${gym}/availability`, null, g);
  const stay = r.body.stay;
  const days = [...new Set(r.body.availability.map((s) => s.date))];
  check('availability covers only the stay', stay && days[0] === stay.firstDay && days[days.length - 1] === stay.lastDay, { stay, days });
  check('times are marked instant or on request', r.body.availability.every((s) => typeof s.instant === 'boolean'));
  const d1 = days[1] || days[0];
  const d2 = days[2] || days[0];

  r = await call('POST', '/wellness-unified/book', { activity_id: gym, booking_date: '2020-01-01', start_time: '10:00' }, g);
  check('a day outside the stay is refused', r.status === 400 && /during your stay/.test(r.body.error), r);

  // Opened by the team → confirmed at once.
  r = await call('POST', '/wellness-availability', { activity_id: meditation, start_date: d1, start_time: '08:00', max_capacity: 4 }, admin);
  check('team opens a time', r.body.success === true, r);
  r = await call('POST', '/wellness-unified/book', { activity_id: meditation, booking_date: d1, start_time: '08:00', people: 2 }, g);
  const instant = r.body.booking;
  check('an opened time is confirmed at once, with a code', r.status === 201 && instant.status === 'upcoming' && /^W[A-Z2-9]{6}$/.test(instant.booking_code) && instant.people === 2, r);

  // Not opened → requests; several at once share a group; overlaps refused.
  r = await call('POST', '/wellness-unified/book', { booking_date: d1, items: [{ activity_id: gym, start_time: '10:00' }, { activity_id: trainer, start_time: '14:00' }] }, g);
  const [gb, tb] = r.body.bookings || [];
  check('several experiences booked together as requests', r.status === 201 && gb.status === 'requested' && tb.status === 'requested' && gb.group_ref && gb.group_ref === tb.group_ref && gb.booking_code !== tb.booking_code, r);
  r = await call('POST', '/wellness-unified/book', { booking_date: d1, items: [{ activity_id: id('Group Classes'), start_time: '10:00' }] }, g);
  check('an overlapping time is refused', r.status === 409 && /overlaps/.test(r.body.error), r);

  r = await call('GET', '/manager/wellness/bookings?status=requested', null, m);
  check('FAY OS lists the requests', r.body.items.some((i) => i.id === tb.id && i.code === tb.booking_code) && r.body.counts.requested >= 2, r.body.counts);

  r = await call('POST', '/manager/wellness/check-in', { code: tb.booking_code }, m);
  check('a request cannot be checked in', r.status === 409, r);
  r = await call('POST', `/manager/wellness/bookings/${tb.id}/confirm`, { start: '15:00' }, m);
  check('confirmed at another time', r.body.status === 'upcoming' && r.body.start === '15:00' && r.body.end === '16:00', r);
  const lower = tb.booking_code.toLowerCase();
  r = await call('POST', '/manager/wellness/check-in', { code: `${lower.slice(0, 3)}-${lower.slice(3)}` }, m);
  check('checked in by code (any case, with a dash)', r.body.status === 'in_progress' && r.body.checkedInAt, r);
  r = await call('POST', `/manager/wellness/bookings/${tb.id}/complete`, {}, m);
  check('completed', r.body.status === 'completed', r);

  // A journey request, declined with a reason; the guest sees it.
  r = await call('POST', '/wellness-unified/book', { activity_id: restore, booking_date: d2, start_time: '16:00' }, g);
  const jb = r.body.booking;
  check('journey requested', jb && jb.status === 'requested' && !jb.activity_pin, r);
  r = await call('POST', `/manager/wellness/bookings/${jb.id}/decline`, { reason: 'Therapist away' }, m);
  check('declined with a reason', r.body.status === 'declined' && r.body.declineReason === 'Therapist away', r);
  r = await call('GET', '/wellness-unified/my-bookings', null, g);
  const mine = r.body.bookings;
  check('the guest sees codes and statuses', mine.some((b) => b.id === jb.id && b.status === 'declined') && mine.every((b) => b.booking_code), mine.map((b) => [b.status, b.booking_code]));

  // The guest can cancel a request.
  r = await call('PATCH', `/wellness-unified/bookings/${gb.id}/cancel`, { cancellation_reason: 'Changed my mind' }, g);
  check('a request can be cancelled by the guest', r.body.booking && r.body.booking.status === 'cancelled', r);

  // Keys: only experiences that open with a PIN (Restore), one per booking, with their stages.
  const restoreReq = (await call('POST', '/wellness-unified/book', { activity_id: restore, booking_date: d2, start_time: '10:00' }, g)).body.booking;
  r = await call('POST', `/manager/wellness/bookings/${restoreReq.id}/confirm`, {}, m);
  check('a confirmed Restore journey gets a PIN', /^\d{4}$/.test(r.body.pin || ''), r);
  r = await call('POST', '/wellness-unified/book', { activity_id: id('Reflect'), booking_date: d2, start_time: '18:00' }, g);
  const reflectReq = r.body.booking;
  r = await call('POST', `/manager/wellness/bookings/${reflectReq.id}/confirm`, {}, m);
  check('Reflect (no PIN access) is confirmed without a key', r.body.status === 'upcoming' && !r.body.pin, r);
  r = await call('GET', '/bookings/user/my-keys', null, g);
  const keys = r.body.keys.wellnessJourneys;
  check('Digital key: one key, for Restore, with its stages', keys.length === 1 && keys[0].bookingId === restoreReq.id && keys[0].stages.length === 3 && keys[0].code === restoreReq.booking_code, keys);

  // Staff book at the desk: confirmed at once, with a code.
  const guestId = (await call('GET', '/wellness-unified/my-bookings', null, g)).body.bookings[0].user_id;
  r = await call('POST', '/manager/wellness/bookings', { guestId, activityId: id('Steam Room'), date: d2, start: '13:00' }, m);
  check('staff booking is confirmed with a code', r.status === 201 && r.body.status === 'upcoming' && /^W/.test(r.body.code), r);

  // After the session the guest rates it; the rating shows in FAY OS and the journey.
  r = await call('GET', '/guest/ratings/pending', null, g);
  check('a completed session can be rated', r.body.some((p) => p.context === 'wellness' && p.contextId === tb.id), r.body);
  r = await call('POST', '/guest/ratings', { context: 'wellness', contextId: tb.id, rating: 4, comment: 'Great trainer' }, g);
  check('rating saved', r.status === 201, r);
  r = await call('POST', '/guest/ratings', { context: 'wellness', contextId: restoreReq.id, rating: 5 }, g);
  check('a session not completed cannot be rated', r.status === 404, r);
  r = await call('GET', '/manager/wellness/bookings?status=all', null, m);
  check('FAY OS shows the rating on the booking', r.body.items.find((i) => i.id === tb.id)?.rating === 4, r.body.items.find((i) => i.id === tb.id));
  r = await call('GET', `/manager/guests/${guestId}/timeline`, null, m);
  const timeline = JSON.stringify(r.body);
  check('guest journey: requested, confirmed, arrived, completed, rated', ['Wellness requested – Personal Trainer', 'Wellness booked by the team – Steam Room', 'Wellness confirmed – Personal Trainer', `Arrived for Personal Trainer – code ${tb.booking_code}`, 'Completed Personal Trainer', 'Rated Personal Trainer ★★★★☆'].every((t) => timeline.includes(t)), timeline.slice(0, 600));

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

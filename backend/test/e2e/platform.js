/**
 * End-to-end write paths across HQ, HR, the v1 HQ screens, FAY OS and the guest app.
 * Needs a running API on fresh demo data:  node db/setup.js --reset --demo  then  ADMIN_PASSWORD=… node test/e2e/platform.js
 */
const BASE = process.env.API_URL || 'http://localhost:5001/api';
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let failures = 0;
const results = [];
const call = async (method, path, body, token, form) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
};
const expect = (name, r, ok = [200, 201]) => {
  const pass = (Array.isArray(ok) ? ok : [ok]).includes(r.status);
  if (!pass) failures++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${r.status} ${name}${pass ? '' : '  ' + JSON.stringify(r.body).slice(0, 250)}`);
  return r.body;
};
const login = async (e, p) => (await call('POST', '/auth/login', { emailOrUsername: e, password: p })).body.token;

(async () => {
  const admin = await login('admin@fayshaa.com', process.env.ADMIN_PASSWORD);
  const mgr = await login('manager@fayshaa.com', 'Faysha2026!');
  const hr = await login('hr@fayshaa.com', 'Faysha2026!');
  const guest = await login('claire.fontaine@example.com', 'Faysha2026!');

  // ---------- HQ ----------
  const roles = (await call('GET', '/admin/roles', undefined, admin)).body;
  const staffRole = (roles.roles || roles).find((r) => r.name === 'staff');
  let b = expect('HQ invite staff', await call('POST', '/admin/staff', { name: 'New Concierge', email: 'concierge.new@fayshaa.com', roleId: staffRole.id, jobTitle: 'Concierge', department: 'Front Office' }, admin));
  const memberId = b.member?.id;
  if (!b.tempPassword) { failures++; console.log('FAIL invite should show temp password when email is off'); }
  expect('HQ update staff', await call('PATCH', `/admin/staff/${memberId}`, { jobTitle: 'Head Concierge' }, admin));
  expect('HQ reset password', await call('POST', `/admin/staff/${memberId}/reset-password`, undefined, admin));
  b = expect('HQ view as', await call('POST', `/admin/staff/${memberId}/view-as`, undefined, admin));
  if (b.token) {
    expect('view-as can read', await call('GET', '/auth/me', undefined, b.token));
    expect('view-as cannot write (403)', await call('POST', '/admin/departments', { name: 'X' }, b.token), 403);
  }
  expect('HQ add department', await call('POST', '/admin/departments', { name: 'Spa', description: 'The spa team' }, admin));
  expect('HQ duplicate department (409)', await call('POST', '/admin/departments', { name: 'Spa' }, admin), [409, 400]);
  b = expect('HQ create role', await call('POST', '/admin/roles', { name: 'finance_director', displayName: 'Finance Director', permissions: { finance: { view: true }, approvals: { view: true, approve: true } } }, admin));
  const roleId = b.role?.id || b.id;
  expect('HQ update role', await call('PATCH', `/admin/roles/${roleId}`, { description: 'Money' }, admin));
  expect('HQ delete role', await call('DELETE', `/admin/roles/${roleId}`, undefined, admin));
  b = expect('HQ raise approval', await call('POST', '/admin/approvals', { type: 'expense', title: 'Pool chemicals', amount: 120000 }, admin));
  const apprId = b.approval?.id || b.id;
  expect('HQ approve expense', await call('POST', `/admin/approvals/${apprId}/decide`, { decision: 'approved', note: 'ok' }, admin));
  const approvals = (await call('GET', '/admin/approvals?status=pending', undefined, admin)).body;
  const leave = (approvals.items || approvals).find((a) => String(a.id).startsWith('leave-'));
  if (leave) expect('HQ approve leave', await call('POST', `/admin/approvals/${leave.id}/decide`, { decision: 'approved' }, admin));
  else { failures++; console.log('FAIL leave request missing from approvals queue'); }
  const pays = (await call('GET', '/admin/payments?status=pending', undefined, admin)).body;
  const pending = (pays.payments || pays.items || pays).find((p) => p.method === 'mobile_money' || p.payment_method === 'mobile_money');
  if (pending) expect('HQ mark mobile money received', await call('POST', `/admin/payments/${pending.id}/mark-paid`, { reference: 'MTN-123' }, admin));
  else { failures++; console.log('FAIL no pending mobile money payment listed', JSON.stringify(pays).slice(0, 200)); }
  b = expect('HQ add property', await call('POST', '/admin/properties', { code: 'FKR', name: 'Faysha Kribi', city: 'Kribi', status: 'opening' }, admin));
  expect('HQ update property', await call('PATCH', `/admin/properties/${b.property?.id || b.id}`, { city: 'Kribi Beach' }, admin));

  // ---------- HR ----------
  const depts = (await call('GET', '/jobs/meta/departments', undefined, hr)).body.departments;
  b = expect('HR create employee with sign-in', await call('POST', '/employees', { first_name: 'Joel', last_name: 'Ebai', email: 'joel.ebai@fayshaa.com', job_title: 'Driver', employment_type: 'full-time', hire_date: day(-10), department_id: depts[0].id, create_user_account: true }, hr));
  if (!b.credentials?.password || b.credentials.password === 'employee123') { failures++; console.log('FAIL employee credentials not generated'); }
  const empId = b.employee?.id;
  expect('HR duplicate employee (409)', await call('POST', '/employees', { first_name: 'Joel', last_name: 'Ebai', email: 'joel.ebai@fayshaa.com', job_title: 'Driver', employment_type: 'full-time', hire_date: day(-10) }, hr), 409);
  expect('HR update employee', await call('PUT', `/employees/${empId}`, { job_title: 'Senior Driver', phone: '+237 600 000 000' }, hr));
  expect('HR clock in', await call('POST', '/attendance/clock-in', { employee_id: empId, method: 'manual', location: 'main_office' }, hr));
  expect('HR clock out', await call('POST', '/attendance/clock-out', { employee_id: empId, method: 'manual' }, hr));
  b = expect('HR post job', await call('POST', '/jobs', { title: 'Night Auditor', department_id: depts[0].id, description: 'Overnight front office and audit', employment_type: 'full-time', location: 'On site' }, hr));
  const jobId = b.job?.id;
  expect('HR edit job', await call('PUT', `/jobs/${jobId}`, { title: 'Night Auditor', description: 'Updated', employment_type: 'full-time', status: 'open' }, hr));
  const fd = new FormData();
  for (const [k, v] of Object.entries({ first_name: 'Ama', last_name: 'Nfor', email: 'ama@example.com', phone: '+237 677 11 22 33', cover_letter_text: 'Hello' })) fd.append(k, v);
  fd.append('cv', new Blob(['%PDF-1.4 test cv'], { type: 'application/pdf' }), 'cv.pdf');
  b = expect('Website: apply for job (public, with CV)', await call('POST', `/jobs/${jobId}/apply`, undefined, null, fd));
  const apps = (await call('GET', '/jobs/applications/all', undefined, hr)).body.applications || [];
  if (apps[0]) expect('HR shortlist application', await call('PUT', `/jobs/applications/${apps[0].id}/status`, { status: 'shortlisted', review_notes: 'Good' }, hr));

  // ---------- HQ v1 screens ----------
  b = expect('Create residence category', await call('POST', '/apartments/categories', { name: 'penthouse', display_name: 'Penthouse', description: 'Top floor', base_price: 150000, max_guests: 4, bedrooms: 2, bathrooms: 2, features: ['Terrace'], amenities: ['Pool'] }, admin));
  const catId = b.category?.id;
  b = expect('Create residence unit', await call('POST', '/apartments', { category_id: catId, unit_number: 'P-501', floor: 5, building: 'Main' }, admin));
  const unitId = b.apartment?.id;
  expect('Update residence unit', await call('PUT', `/apartments/${unitId}`, { notes: 'Sea view', status: 'available' }, admin));
  expect('Cancel an upcoming stay (status)', await call('PUT', '/bookings/4/status', { status: 'cancelled', cancellation_reason: 'Guest request' }, admin));
  expect('Cannot check out a cancelled stay (409)', await call('PUT', '/bookings/4/status', { status: 'checked_out' }, admin), 409);
  expect('Create admin user', await call('POST', '/users', { email: 'editor@fayshaa.com', username: 'editor1', fullName: 'Web Editor', roleId: roles.roles ? roles.roles.find((r) => r.name === 'content_manager').id : roles.find((r) => r.name === 'content_manager').id }, admin));
  const fb = new FormData();
  for (const [k, v] of Object.entries({ name: 'Website Guest', email: 'w@example.com', feedbackType: 'testimonial', rating: '5', testimonialText: 'Lovely stay', allowPublicDisplay: 'true' })) fb.append(k, v);
  b = expect('Website: submit feedback', await call('POST', '/feedback/submit', undefined, null, fb));
  const fbId = b.feedbackId;
  expect('Approve feedback', await call('PUT', `/feedback/admin/${fbId}/status`, { status: 'approved', is_featured: true }, admin));
  expect('Website: contact form', await call('POST', '/contact', { name: 'A', email: 'a@example.com', message: 'Hello there, a question about dates.' }), [200, 201, 502, 503]);
  expect('Save page copy', await call('POST', '/pages/home/en', { section: 'hero', content_key: 'title', content_value: 'Welcome' , content: { hero: { title: 'Welcome' } } }, admin));
  expect('Deposit box delivery', await call('POST', '/deposit-box/delivery', { booking_id: 1, delivered_by: 'DHL', package_description: 'Parcel' }, admin));

  // ---------- Wellness (HQ) ----------
  b = expect('Create wellness activity', await call('POST', '/wellness/activities', { name: 'Hammam', category: 'spa', duration: 45, max_capacity: 2, base_price: 15000, benefits: 'Detox, Calm' }, admin));
  const actId = b.activity?.id;
  expect('Invalid activity refused (400)', await call('POST', '/wellness/activities', { name: 'X', category: 'nope', duration: 30 }, admin), 400);
  expect('Update wellness activity', await call('PUT', `/wellness/activities/${actId}`, { duration: 50, description: 'Steam and scrub' }, admin));
  b = expect('Open availability (range, weekdays)', await call('POST', '/wellness-availability', { activity_id: actId, start_date: day(1), end_date: day(14), start_time: '10:00', max_capacity: 1, days_of_week: [1, 2, 3, 4, 5] }, admin));
  const slots = (await call('GET', `/wellness-availability?activity_id=${actId}`, undefined, admin)).body.availability;
  if (!slots.length) { failures++; console.log('FAIL no slots created'); }
  expect('Close a slot', await call('PUT', `/wellness-availability/${slots[0].id}`, { is_available: false }, admin));
  expect('Delete a slot', await call('DELETE', `/wellness-availability/${slots[1].id}`, undefined, admin));
  expect('Create wellness zone', await call('POST', '/wellness/zones', { name: 'Garden', subtitle: 'Outdoor', features: ['Shade'] }, admin));

  // ---------- Guest app: wellness ----------
  const massage = (await call('GET', '/wellness-unified/activities?category=restore', undefined, guest)).body.activities.find((a) => a.name === 'Massage Therapy');
  const avail = (await call('GET', `/wellness-unified/activities/${massage.id}/availability?date=${day(1)}&days=1`, undefined, guest)).body.availability;
  const free = avail.find((s) => s.is_available);
  b = expect('Guest books massage', await call('POST', '/wellness-unified/book', { activity_id: massage.id, booking_date: day(1), start_time: free.start_time }, guest), 201);
  const wb = b.booking;
  const other = await login('daniel.okafor@example.com', 'Faysha2026!');
  expect('Second guest same 1-person slot refused (409/400)', await call('POST', '/wellness-unified/book', { activity_id: massage.id, booking_date: day(1), start_time: free.start_time }, other), [400, 409]);
  expect('Off-grid time refused (400)', await call('POST', '/wellness-unified/book', { activity_id: massage.id, booking_date: day(1), start_time: '10:17' }, guest), 400);
  const journey = (await call('GET', '/wellness-unified/activities?type=journey', undefined, guest)).body.activities.find((a) => a.category === 'restore');
  b = expect('Guest books Restore journey (PIN)', await call('POST', '/wellness-unified/book', { activity_id: journey.id, booking_date: day(2), start_time: '14:00' }, guest), 201);
  if (!b.booking?.activity_pin) { failures++; console.log('FAIL journey has no PIN'); }
  const keys = (await call('GET', '/bookings/user/my-keys', undefined, guest)).body.keys;
  if (!keys.wellnessJourneys.length) { failures++; console.log('FAIL journey key not in my-keys'); }
  expect('Guest cancels massage', await call('PATCH', `/wellness-unified/bookings/${wb.id}/cancel`, { cancellation_reason: 'Changed plans' }, guest));
  expect('Cancel twice refused (400)', await call('PATCH', `/wellness-unified/bookings/${wb.id}/cancel`, {}, guest), 400);
  const hb = (await call('GET', '/wellness/admin/bookings', undefined, admin)).body.bookings.find((x) => x.status === 'upcoming');
  expect('HQ starts a wellness booking', await call('PATCH', `/wellness/admin/bookings/${hb.id}`, { status: 'in_progress' }, admin));
  expect('HQ completes it', await call('PATCH', `/wellness/admin/bookings/${hb.id}`, { status: 'completed' }, admin));
  expect('Illegal move refused (400)', await call('PATCH', `/wellness/admin/bookings/${hb.id}`, { status: 'upcoming' }, admin), 400);

  // ---------- Guest app: stay services ----------
  expect('Guest concierge message', await call('POST', '/wellness/concierge/messages', { message: 'Can I get late checkout?' }, guest));
  expect('Guest upload rejects traversal name safely', await call('POST', '/wellness/concierge/upload', { fileName: '../../server.js', fileData: Buffer.from('x').toString('base64') }, guest));
  const fs = require('fs');
  if (!fs.readFileSync(require('path').join(__dirname, '..', '..', 'server.js'), 'utf8').includes('express')) { failures++; console.log('FAIL server.js overwritten!'); }
  b = expect('Guest service request', await call('POST', '/guest/requests', { department: 'Housekeeping', title: 'Fresh towels', notes: 'Two please' }, guest), [200, 201]);
  const reqId = b.request?.id || b.id;
  expect('Guest cancels request', await call('POST', `/guest/requests/${reqId}/cancel`, undefined, guest));
  const menu = (await call('GET', '/guest/dining/menu', undefined, guest)).body;
  const item = (menu.items || menu.menu || menu)[0];
  expect('Guest orders dining', await call('POST', '/guest/dining/orders', { items: [{ id: item.id, qty: 2 }], time: 'asap' }, guest), [200, 201]);
  b = expect('Guest reserves table', await call('POST', '/guest/dining/reservations', { venue: 'Restaurant', date: day(1), time: '19:30', guests: 2 }, guest), [200, 201]);
  expect('Guest cancels table', await call('POST', `/guest/dining/reservations/${b.reservation?.id || b.id}/cancel`, undefined, guest));
  const exps = (await call('GET', '/guest/experiences', undefined, guest)).body;
  const exp = (exps.experiences || exps.items || exps)[0];
  expect('Guest books experience', await call('POST', `/guest/experiences/${exp.id}/book`, { date: day(2), time: '09:00', guests: 2 }, guest), [200, 201]);
  expect('Guest requests transfer', await call('POST', '/guest/transfers', { kind: 'Airport drop-off', date: day(3), time: '08:00', from: 'Residence', to: 'Douala Airport (DLA)' }, guest), [200, 201]);
  expect('Guest climate', await call('PATCH', '/guest/home/climate', { targetTemp: 21 }, guest));
  expect('Guest scene', await call('POST', '/guest/home/scene', { scene: 'sleep' }, guest));
  expect('Guest privacy', await call('PATCH', '/guest/home/privacy', { doNotDisturb: true }, guest));
  expect('Guest push token', await call('POST', '/guest/push-token', { token: 'ExponentPushToken[abc123]', platform: 'ios' }, guest));
  expect('App sign-up', await call('POST', '/auth/register', { fullName: 'App User', email: 'app.user@example.com', password: 'Str0ng!Pass', phone: '+237 600 11 22 33' }), [200, 201]);

  // ---------- FAY OS ----------
  const guests = (await call('GET', '/manager/guests', undefined, mgr)).body;
  const glist = guests.items || guests.guests || guests;
  const someone = glist.find((g) => /Nadia|James/.test(g.name)) || glist[0];
  b = expect('FAY OS create reservation', await call('POST', '/manager/reservations', { guestId: someone.id, residence: 'A-203', checkIn: day(25), checkOut: day(27), guests: 2 }, mgr), [200, 201]);
  const resId = b.id || b.reservation?.id;
  expect('FAY OS overlapping reservation (409)', await call('POST', '/manager/reservations', { guestId: someone.id, residence: 'A-203', checkIn: day(26), checkOut: day(28) }, mgr), 409);
  expect('FAY OS cancel reservation', await call('PATCH', `/manager/reservations/${resId}`, { status: 'Cancelled' }, mgr));
  b = expect('FAY OS service request', await call('POST', '/manager/service-requests', { guestId: someone.id, title: 'Iron', department: 'Housekeeping', priority: 'High' }, mgr), [200, 201]);
  expect('FAY OS update request', await call('PATCH', `/manager/service-requests/${b.id}`, { status: 'In Progress' }, mgr));
  const inhouse = glist.find((g) => /Daniel/.test(g.name));
  expect('FAY OS check in arrival', await call('POST', `/manager/guests/${inhouse.id}/check-in`, undefined, mgr));
  expect('FAY OS guest note', await call('POST', `/manager/guests/${inhouse.id}/notes`, { body: 'Prefers sparkling water' }, mgr), [200, 201]);
  expect('FAY OS desk payment', await call('POST', `/manager/guests/${inhouse.id}/payments`, { amount: 10000, method: 'Cash' }, mgr), [200, 201]);
  expect('FAY OS message guest', await call('POST', `/manager/guests/${inhouse.id}/messages`, { body: 'Welcome!' }, mgr), [200, 201]);
  expect('FAY OS wellness appointment', await call('POST', '/manager/wellness/appointments', { guestId: inhouse.id, treatment: 'Massage Therapy', date: day(1), start: '16:00', end: '17:00', room: 'Room 1' }, mgr), [200, 201]);
  expect('FAY OS experience booking', await call('POST', '/manager/experiences/bookings', { guestId: inhouse.id, experience: 'Waterfall hike', startsAt: `${day(3)}T08:00:00+01:00`, pax: 2 }, mgr), [200, 201]);
  expect('FAY OS dining order', await call('POST', '/manager/dining/orders', { guestId: inhouse.id, items: 'Ndolé', venue: 'Restaurant', total: 9500 }, mgr), [200, 201]);
  expect('FAY OS transfer', await call('POST', '/manager/transport/transfers', { guestId: inhouse.id, date: day(3), time: '07:00', kind: 'Airport drop-off', from: 'Residence', to: 'DLA' }, mgr), [200, 201]);
  b = expect('FAY OS housekeeping task', await call('POST', '/manager/housekeeping/tasks', { title: 'Deep clean', location: 'B-302', time: '13:00' }, mgr), [200, 201]);
  expect('FAY OS update task', await call('PATCH', `/manager/housekeeping/tasks/${b.id}`, { status: 'Completed' }, mgr));
  expect('FAY OS delete task', await call('DELETE', `/manager/housekeeping/tasks/${b.id}`, undefined, mgr), [200, 204]);
  expect('FAY OS residence climate', await call('PATCH', '/manager/residences/1/climate', { targetTemp: 23 }, mgr));
  expect('FAY OS settings', await call('PUT', '/manager/settings/property', { name: 'Faysha Wellness Residence', phone: '+237 600 000 000' }, mgr));
  expect('FAY OS invite team member', await call('POST', '/manager/settings/team', { name: 'Pool Attendant', email: 'pool@fayshaa.com', department: 'Wellness' }, mgr), [200, 201]);
  expect('FAY OS AI ask (fallback without key)', await call('POST', '/manager/ai/ask', { prompt: 'What needs my attention today?' }, mgr));
  expect('FAY OS check out departure', await call('POST', `/manager/guests/${glist.find((g) => /Sophie/.test(g.name)).id}/check-out`, undefined, mgr));

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

/**
 * Guest app — operations a resident starts themselves (mounted at /api/guest, signed in).
 *
 * Ratings
 *   GET  /ratings/pending        services this guest can rate (completed requests, the clean, meals, treatments, rides, the stay)
 *   POST /ratings                { context, contextId?, rating 1–5, comment? }
 * Lockers and equipment on loan
 *   GET  /loans/catalog          categories with how many are free now
 *   GET  /loans                  this guest's loans
 *   POST /loans                  { category, hours?, quantity?, reason? }
 *   POST /loans/:id/cancel       while still requested
 * Visitors
 *   GET  /visitors               this guest's visitor passes
 *   POST /visitors               { visitorName, visitorPhone?, people?, vehicle?, date, from?, until?, note? }
 *   POST /visitors/:id/cancel
 */
const express = require('express');
const crypto = require('crypto');
const { authenticateToken, checkPasswordChangeRequired } = require('../../middleware/auth');
const { db, ah, httpError, isoDate, isoTime, emit } = require('../manager/lib');
const { staffAlert } = require('../../services/notify');
const { requireStay, currentStay } = require('./index');

const router = express.Router();
router.use(['/ratings', '/loans', '/visitors'], authenticateToken, checkPasswordChangeRequired);

const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';
const appUrl = () => (process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '');

// ---------------------------------------------------------------- Ratings
const CONTEXT_LABEL = { request: 'Request', housekeeping: 'Housekeeping', dining: 'Dining', wellness: 'Wellness', transfer: 'Ride', loan: 'Equipment', stay: 'Your stay' };

router.get(
  '/ratings/pending',
  ah(async (req, res) => {
    const uid = req.user.id;
    const { rows } = await db.query(
      `SELECT * FROM (
         SELECT 'request' AS context, r.id AS context_id, r.title AS title, COALESCE(s.full_name, r.department) AS staff, r.completed_at AS at
           FROM service_requests r LEFT JOIN users s ON s.id = r.assigned_to
          WHERE r.guest_id = $1 AND r.status = 'completed' AND r.completed_at > NOW() - INTERVAL '14 days'
         UNION ALL
         SELECT 'dining', d.id, d.restaurant_name || ' · ' || to_char(d.reservation_date, 'DD Mon'), NULL, d.completed_at
           FROM dining_reservations d WHERE d.guest_id = $1 AND d.status = 'completed' AND d.completed_at > NOW() - INTERVAL '14 days'
         UNION ALL
         SELECT 'wellness', w.id, w.activity_name || ' · ' || to_char(w.booking_date, 'DD Mon'), ws.full_name, w.updated_at
           FROM wellness_bookings w LEFT JOIN users ws ON ws.id = w.staff_id WHERE w.user_id = $1 AND w.status = 'completed' AND w.updated_at > NOW() - INTERVAL '14 days'
         UNION ALL
         SELECT 'loan', l.id, i.name, NULL, l.returned_at
           FROM loans l JOIN loan_items i ON i.id = l.item_id WHERE l.user_id = $1 AND l.status = 'returned' AND l.returned_at > NOW() - INTERVAL '14 days'
         UNION ALL
         SELECT 'stay', b.id, 'Your stay · ' || a.unit_number, NULL, b.checked_out_at
           FROM bookings b JOIN apartments a ON a.id = b.apartment_id
          WHERE b.user_id = $1 AND b.status = 'checked_out' AND b.checked_out_at > NOW() - INTERVAL '30 days'
       ) x
       WHERE NOT EXISTS (SELECT 1 FROM staff_ratings sr WHERE sr.user_id = $1 AND sr.context = x.context AND sr.context_id = x.context_id)
       ORDER BY at DESC NULLS LAST LIMIT 20`,
      [uid],
    );
    res.json(rows.map((r) => ({ context: r.context, contextId: r.context_id, label: CONTEXT_LABEL[r.context], title: r.title, staff: r.staff || null, at: r.at ? isoTime(r.at) : null })));
  }),
);

router.post(
  '/ratings',
  ah(async (req, res) => {
    const { context, contextId, comment } = req.body || {};
    const rating = parseInt(req.body?.rating, 10);
    if (!CONTEXT_LABEL[context]) throw httpError(400, 'What are you rating?');
    if (!(rating >= 1 && rating <= 5)) throw httpError(400, 'Choose between 1 and 5 stars');
    const uid = req.user.id;
    // Who served the guest, and proof the thing being rated is theirs.
    const owner = {
      request: `SELECT r.booking_id, r.assigned_to AS staff_id, s.full_name AS staff_name, r.department FROM service_requests r LEFT JOIN users s ON s.id = r.assigned_to WHERE r.id = $1 AND r.guest_id = $2`,
      dining: `SELECT d.booking_id, d.server_id AS staff_id, s.full_name AS staff_name, 'Dining' AS department FROM dining_reservations d LEFT JOIN users s ON s.id = d.server_id WHERE d.id = $1 AND d.guest_id = $2`,
      wellness: `SELECT w.apartment_booking_id AS booking_id, w.staff_id, s.full_name AS staff_name, 'Wellness' AS department FROM wellness_bookings w LEFT JOIN users s ON s.id = w.staff_id WHERE w.id = $1 AND w.user_id = $2 AND w.status = 'completed'`,
      loan: `SELECT l.booking_id, l.handled_by AS staff_id, s.full_name AS staff_name, 'Concierge' AS department FROM loans l LEFT JOIN users s ON s.id = l.handled_by WHERE l.id = $1 AND l.user_id = $2`,
      stay: `SELECT b.id AS booking_id, NULL::int AS staff_id, NULL AS staff_name, 'Front Office' AS department FROM bookings b WHERE b.id = $1 AND b.user_id = $2`,
      housekeeping: `SELECT b.id AS booking_id, NULL::int AS staff_id, rc.cleaned_by AS staff_name, 'Housekeeping' AS department FROM bookings b LEFT JOIN residence_controls rc ON rc.apartment_id = b.apartment_id WHERE b.id = $1 AND b.user_id = $2`,
    }[context];
    let ref = {};
    if (owner) {
      if (!contextId) throw httpError(400, 'What are you rating?');
      ref = (await db.query(owner, [contextId, uid])).rows[0];
      if (!ref) throw httpError(404, 'Not found');
    }
    const { rows } = await db.query(
      `INSERT INTO staff_ratings (user_id, booking_id, staff_id, staff_name, department, context, context_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, context, context_id) WHERE context_id IS NOT NULL DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()
       RETURNING id`,
      [uid, ref.booking_id || null, ref.staff_id || null, ref.staff_name || null, ref.department || null, context, contextId || null, rating, comment ? String(comment).slice(0, 2000) : null],
    );
    // A low score needs someone to follow up while the guest is still with us.
    await staffAlert(req.app, {
      title: `${rating <= 2 ? 'Low rating' : 'New rating'} · ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
      body: `${req.user.fullName} · ${CONTEXT_LABEL[context]}${ref.staff_name ? ` · ${ref.staff_name}` : ''}${comment ? ` — “${String(comment).slice(0, 100)}”` : ''}`,
      link: '/quality',
      level: rating <= 2 ? 'urgent' : 'info',
      category: 'quality',
      dedupeKey: rating <= 2 ? `rating:${rows[0].id}` : null,
    });
    // The rating is part of the guest's journey (FAY OS → Guest Journey), next to the booking and the arrival.
    const what = context === 'wellness' && contextId
      ? (await db.query('SELECT activity_name FROM wellness_bookings WHERE id = $1', [contextId])).rows[0]?.activity_name
      : null;
    await db.query(
      `INSERT INTO guest_activities (guest_id, booking_id, activity_type, title, category, is_automated) VALUES ($1, $2, 'custom', $3, $4, true)`,
      [uid, ref.booking_id || null, `Rated ${what || CONTEXT_LABEL[context]} ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}${comment ? ` — “${String(comment).slice(0, 120)}”` : ''}`, CONTEXT_LABEL[context] === 'Your stay' ? 'Stay' : CONTEXT_LABEL[context]],
    ).catch((e) => console.error('Guest journey entry failed:', e.message));
    emit(req, 'rating:new', { id: rows[0].id });
    res.status(201).json({ ok: true, id: rows[0].id });
  }),
);

// ---------------------------------------------------------------- Loans (extra lockers, golf sets, sport and beach gear…)
const CATEGORY = {
  locker: { label: 'Extra locker', icon: 'file-tray-stacked-outline', hours: 24 },
  golf: { label: 'Golf clubs & balls', icon: 'golf-outline', hours: 4 },
  sport: { label: 'Sport equipment', icon: 'tennisball-outline', hours: 3 },
  beach: { label: 'Pool & beach kit', icon: 'umbrella-outline', hours: 6 },
  kids: { label: 'For children', icon: 'happy-outline', hours: 24 },
  other: { label: 'Other', icon: 'cube-outline', hours: 24 },
};
const toLoan = (l) => ({
  id: l.id,
  reference: l.reference,
  category: l.category,
  label: CATEGORY[l.category]?.label || l.category,
  item: l.item_id ? { code: l.code, name: l.item_name, location: l.location } : null,
  status: l.status,
  // The locker code is shown only once the locker is handed over.
  pin: ['ready', 'out'].includes(l.status) ? l.pin : null,
  quantity: l.quantity,
  reason: l.reason,
  dueAt: isoTime(l.due_at),
  overdue: ['out', 'ready'].includes(l.status) && new Date(l.due_at) < new Date(),
  createdAt: isoTime(l.created_at),
});
const LOAN_SELECT = `SELECT l.*, i.code, i.name AS item_name, i.location FROM loans l LEFT JOIN loan_items i ON i.id = l.item_id`;

router.get(
  '/loans/catalog',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT category, COUNT(*) FILTER (WHERE status = 'available')::int AS free, COUNT(*) FILTER (WHERE status <> 'retired')::int AS total,
              MIN(default_hours) AS hours, MIN(fee)::float AS fee, MIN(deposit)::float AS deposit
         FROM loan_items WHERE status <> 'retired' GROUP BY category`,
    );
    res.json(
      Object.entries(CATEGORY)
        .map(([k, c]) => {
          const r = rows.find((x) => x.category === k);
          return r ? { category: k, label: c.label, icon: c.icon, free: r.free, total: r.total, hours: r.hours || c.hours, fee: r.fee, deposit: r.deposit } : null;
        })
        .filter(Boolean),
    );
  }),
);

router.get(
  '/loans',
  ah(async (req, res) => {
    const { rows } = await db.query(`${LOAN_SELECT} WHERE l.user_id = $1 ORDER BY l.created_at DESC LIMIT 50`, [req.user.id]);
    res.json(rows.map(toLoan));
  }),
);

router.post(
  '/loans',
  ah(async (req, res) => {
    const category = req.body?.category;
    if (!CATEGORY[category]) throw httpError(400, 'Choose what you would like to borrow');
    const stay = await requireStay(req.user);
    const open = await db.query(`SELECT COUNT(*)::int AS n FROM loans WHERE user_id = $1 AND status IN ('requested', 'ready', 'out')`, [req.user.id]);
    if (open.rows[0].n >= 5) throw httpError(409, 'You already have five items on loan — please return one first');
    const def = (await db.query(`SELECT MIN(default_hours) AS h FROM loan_items WHERE category = $1 AND status <> 'retired'`, [category])).rows[0]?.h || CATEGORY[category].hours;
    const hours = Math.min(24 * 14, Math.max(1, parseInt(req.body?.hours, 10) || def));
    const { rows } = await db.query(
      `INSERT INTO loans (user_id, guest_name, booking_id, category, quantity, reason, due_at, pin)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + make_interval(hours => $7::int), $8) RETURNING id`,
      [req.user.id, req.user.fullName, stay.id, category, Math.min(10, Math.max(1, parseInt(req.body?.quantity, 10) || 1)), req.body?.reason ? String(req.body.reason).slice(0, 500) : null, hours,
        String(crypto.randomInt(0, 10000)).padStart(4, '0')],
    );
    const loan = (await db.query(`UPDATE loans SET reference = 'LN-' || LPAD(id::text, 5, '0') WHERE id = $1 RETURNING *`, [rows[0].id])).rows[0];
    await staffAlert(req.app, {
      title: `${CATEGORY[category].label} requested`,
      body: `${req.user.fullName} · Residence ${stay.unit_number} · for ${hours} h${loan.reason ? ` — ${loan.reason.slice(0, 80)}` : ''}`,
      link: `/lockers?loan=${loan.id}`,
      level: 'action',
      category: 'loans',
      dedupeKey: `loan-request:${loan.id}`,
    });
    emit(req, 'loan:updated', { id: loan.id });
    res.status(201).json(toLoan((await db.query(`${LOAN_SELECT} WHERE l.id = $1`, [loan.id])).rows[0]));
  }),
);

router.post(
  '/loans/:id/cancel',
  ah(async (req, res) => {
    const { rows } = await db.query(`UPDATE loans SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'requested' RETURNING id`, [req.params.id, req.user.id]);
    if (!rows.length) throw httpError(409, 'This can no longer be cancelled — please return it to the concierge');
    await require('../../services/notify').resolve(req.app, `loan-request:${rows[0].id}`);
    emit(req, 'loan:updated', { id: rows[0].id });
    res.json(toLoan((await db.query(`${LOAN_SELECT} WHERE l.id = $1`, [rows[0].id])).rows[0]));
  }),
);

// ---------------------------------------------------------------- Visitor passes
const toPass = (p) => ({
  id: p.id,
  code: p.code,
  link: `${appUrl()}/visit/${p.token}`,
  visitorName: p.visitor_name,
  visitorPhone: p.visitor_phone,
  people: p.people,
  vehicle: p.vehicle,
  date: isoDate(p.visit_date),
  from: p.arrive_from,
  until: p.arrive_until,
  note: p.note,
  status: p.status,
  residence: p.unit_number || null,
  arrivedAt: p.arrived_at ? isoTime(p.arrived_at) : null,
  createdAt: isoTime(p.created_at),
});
const PASS_SELECT = `SELECT p.*, a.unit_number FROM visitor_passes p LEFT JOIN apartments a ON a.id = p.apartment_id`;

router.get(
  '/visitors',
  ah(async (req, res) => {
    const { rows } = await db.query(`${PASS_SELECT} WHERE p.user_id = $1 ORDER BY p.visit_date DESC, p.created_at DESC LIMIT 50`, [req.user.id]);
    res.json(rows.map(toPass));
  }),
);

router.post(
  '/visitors',
  ah(async (req, res) => {
    const b = req.body || {};
    const name = String(b.visitorName || '').trim();
    if (!name) throw httpError(400, 'Who is visiting?');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) throw httpError(400, 'Choose the day of the visit');
    const time = (t) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(t || '') ? t : null);
    const stay = await requireStay(req.user);
    const range = (await db.query(`SELECT $1::date < (NOW() AT TIME ZONE $3)::date AS past, $1::date > $2::date AS after`, [b.date, stay.check_out_date, TZ])).rows[0];
    if (range.past) throw httpError(400, 'The visit date is in the past');
    if (range.after) throw httpError(400, 'Visitors can be invited for the days of your stay');
    // Managers choose whether passes need approval (FAY OS → Visitors); by default they do.
    const auto = ((await db.query(`SELECT value FROM app_settings WHERE key = 'visitors'`)).rows[0]?.value || {}).autoApprove === true;
    const { rows } = await db.query(
      `INSERT INTO visitor_passes (token, code, user_id, booking_id, apartment_id, visitor_name, visitor_phone, people, vehicle, visit_date, arrive_from, arrive_until, note, status, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::text, CASE WHEN $14::text = 'approved' THEN NOW() END) RETURNING id`,
      [crypto.randomBytes(18).toString('base64url'), String(crypto.randomInt(0, 1e6)).padStart(6, '0'), req.user.id, stay.id, stay.apartment_id, name.slice(0, 150),
        b.visitorPhone ? String(b.visitorPhone).slice(0, 50) : null, Math.min(20, Math.max(1, parseInt(b.people, 10) || 1)), b.vehicle ? String(b.vehicle).slice(0, 40) : null,
        b.date, time(b.from), time(b.until), b.note ? String(b.note).slice(0, 500) : null, auto ? 'approved' : 'pending'],
    );
    const pass = (await db.query(`${PASS_SELECT} WHERE p.id = $1`, [rows[0].id])).rows[0];
    await staffAlert(req.app, {
      title: auto ? `Visitor expected · ${pass.visitor_name}` : `Visitor to approve · ${pass.visitor_name}`,
      body: `For ${req.user.fullName} · Residence ${pass.unit_number} · ${isoDate(pass.visit_date)}${pass.arrive_from ? ` from ${pass.arrive_from}` : ''} · ${pass.people} person(s)${pass.vehicle ? ` · ${pass.vehicle}` : ''}`,
      link: '/visitors',
      level: auto ? 'info' : 'action',
      category: 'gate',
      dedupeKey: auto ? null : `visitor-approve:${pass.id}`,
    });
    emit(req, 'visitor:updated', { id: pass.id });
    res.status(201).json(toPass(pass));
  }),
);

router.post(
  '/visitors/:id/cancel',
  ah(async (req, res) => {
    const { rows } = await db.query(`UPDATE visitor_passes SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'approved') RETURNING id`, [req.params.id, req.user.id]);
    if (!rows.length) throw httpError(409, 'This pass can no longer be cancelled');
    await require('../../services/notify').resolve(req.app, `visitor-approve:${rows[0].id}`);
    emit(req, 'visitor:updated', { id: rows[0].id });
    res.json(toPass((await db.query(`${PASS_SELECT} WHERE p.id = $1`, [rows[0].id])).rows[0]));
  }),
);

// Errors answer { message } like the rest of the guest API.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const pg = { 23505: [409, 'That already exists'], 23503: [400, 'A linked record does not exist'], '22P02': [400, 'Invalid value'], 22007: [400, 'Invalid date'], 22008: [400, 'Invalid date'] };
  const [status, message] = err.status ? [err.status, err.message] : pg[err.code] || [500, 'Something went wrong'];
  if (status >= 500) console.error('Guest operations error:', req.method, req.originalUrl, err);
  res.status(status).json({ message });
});

module.exports = router;
module.exports.toPass = toPass;
module.exports.toLoan = toLoan;
module.exports.LOAN_SELECT = LOAN_SELECT;
module.exports.PASS_SELECT = PASS_SELECT;
module.exports.CATEGORY = CATEGORY;
module.exports.currentStay = currentStay;

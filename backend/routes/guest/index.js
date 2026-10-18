/**
 * Guest API for the Faysha app, mounted at /api/guest. Every route is for the signed-in guest's own data.
 *
 * It writes to the same tables FAY OS (the manager dashboard) works from, so a request, dining order,
 * table booking, experience, transfer or smart-home change made in the app appears for staff at once
 * (Socket.io events to the 'staff' room plus a header notification), and staff updates reach the guest
 * through services/guestPush.js.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, checkPasswordChangeRequired } = require('../../middleware/auth');
const { db, ah, httpError, isoDate, isoTime, emit, notify, addTimeline } = require('../manager/lib');

const router = express.Router();
router.use(authenticateToken, checkPasswordChangeRequired);

const num = (v) => Number(v || 0);
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';
const todayIn = async () => (await db.query('SELECT (NOW() AT TIME ZONE $1)::date AS d', [TZ])).rows[0].d;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = (s) => /^\d{2}:\d{2}$/.test(s || '');

// ======================================================================
// Stays
// ======================================================================
const STAY_SELECT = `
  SELECT b.id, b.booking_number, b.status, b.check_in_date, b.check_out_date, b.number_of_nights, b.number_of_guests,
         b.final_price, b.terms_accepted, b.special_requests, b.created_at, b.apartment_id,
         a.unit_number, a.floor, a.building, c.display_name AS residence_name, c.id AS category_id,
         (SELECT file_url FROM apartment_media m WHERE (m.category_id = c.id OR m.apartment_id = a.id) AND m.media_type = 'image'
           ORDER BY m.apartment_id IS NULL, m.is_primary DESC, m.sort_order LIMIT 1) AS image,
         COALESCE((SELECT SUM(amount) FROM payments p WHERE p.booking_id = b.id AND p.status = 'completed'), 0) AS paid,
         COALESCE((SELECT SUM(amount) FROM folio_charges f WHERE f.booking_id = b.id), 0) AS extras,
         EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'pending' AND p.payment_method = 'mobile_money') AS awaiting_mobile_money
    FROM bookings b
    JOIN apartments a ON a.id = b.apartment_id
    JOIN apartment_categories c ON c.id = a.category_id`;

/** A guest's bookings: linked by account, or made with their email before the account existed. */
const OWNS = `(b.user_id = $1 OR (b.user_id IS NULL AND LOWER(b.guest_email) = LOWER($2)))`;

function toStay(r) {
  const total = num(r.final_price) + num(r.extras);
  return {
    id: r.id,
    number: r.booking_number,
    status: r.status,
    checkIn: isoDate(r.check_in_date),
    checkOut: isoDate(r.check_out_date),
    nights: r.number_of_nights,
    guests: r.number_of_guests,
    residence: { unit: r.unit_number, floor: r.floor, building: r.building, name: r.residence_name, image: r.image || null },
    stayTotal: num(r.final_price),
    extras: num(r.extras),
    total,
    paid: num(r.paid),
    balance: Math.max(0, total - num(r.paid)),
    awaitingMobileMoney: r.awaiting_mobile_money,
    termsAccepted: r.terms_accepted,
    inHouse: r.status === 'checked_in',
    canControlHome: r.status === 'checked_in',
    specialRequests: r.special_requests,
    createdAt: isoTime(r.created_at),
  };
}

/** The stay that matters now: in house, else the next confirmed (or awaiting payment) one. */
async function currentStay(user) {
  const { rows } = await db.query(
    `${STAY_SELECT}
     WHERE ${OWNS} AND (b.status = 'checked_in' OR (b.status IN ('confirmed', 'pending') AND b.check_out_date >= $3::date))
     ORDER BY b.status = 'checked_in' DESC, b.status = 'confirmed' DESC, b.check_in_date
     LIMIT 1`,
    [user.id, user.email, await todayIn()],
  );
  return rows[0] || null;
}

async function ownStay(user, id) {
  const { rows } = await db.query(`${STAY_SELECT} WHERE ${OWNS} AND b.id = $3`, [user.id, user.email, id]);
  if (!rows.length) throw httpError(404, 'Stay not found');
  return rows[0];
}

/** Requests, orders and bookings need a confirmed or in-house stay to attach to. */
async function requireStay(user) {
  const stay = await currentStay(user);
  if (!stay || !['checked_in', 'confirmed'].includes(stay.status)) {
    throw httpError(409, 'This is available once you have a confirmed stay with us');
  }
  return stay;
}

router.get(
  '/overview',
  ah(async (req, res) => {
    const stay = await currentStay(req.user);
    const [counts, rewards] = await Promise.all([
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM service_requests WHERE guest_id = $1 AND status IN ('pending','acknowledged','in_progress','scheduled','escalated','on_hold'))::int AS open_requests,
           (SELECT COUNT(*) FROM dining_orders WHERE guest_id = $1 AND status NOT IN ('Delivered', 'Completed', 'Cancelled'))::int AS active_orders`,
        [req.user.id],
      ),
      rewardsOf(req.user),
    ]);
    const c = counts.rows[0];
    res.json({
      stay: stay ? toStay(stay) : null,
      openRequests: c.open_requests,
      activeOrders: c.active_orders,
      points: rewards.points,
      tier: rewards.tier.name,
    });
  }),
);

router.get(
  '/stays',
  ah(async (req, res) => {
    const { rows } = await db.query(`${STAY_SELECT} WHERE ${OWNS} ORDER BY b.check_in_date DESC`, [req.user.id, req.user.email]);
    res.json(rows.map(toStay));
  }),
);

router.get(
  '/stays/:id',
  ah(async (req, res) => {
    const stay = await ownStay(req.user, req.params.id);
    res.json({ ...toStay(stay), folio: await folioOf(stay) });
  }),
);

// ======================================================================
// Bill (folio)
// ======================================================================
async function folioOf(stay) {
  const [charges, payments] = await Promise.all([
    db.query('SELECT id, description, category, amount, created_at FROM folio_charges WHERE booking_id = $1 ORDER BY created_at', [stay.id]),
    db.query(
      `SELECT id, payment_method, amount, status, paid_at, created_at, refund_amount FROM payments
        WHERE booking_id = $1 AND status IN ('completed', 'refunded', 'pending') ORDER BY created_at`,
      [stay.id],
    ),
  ]);
  const lines = [
    { id: `stay-${stay.id}`, description: `${stay.residence_name} · ${stay.number_of_nights} night${stay.number_of_nights === 1 ? '' : 's'}`, category: 'Stay', amount: num(stay.final_price), at: isoTime(stay.created_at) },
    ...charges.rows.map((c) => ({ id: String(c.id), description: c.description, category: c.category, amount: num(c.amount), at: isoTime(c.created_at) })),
  ];
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const paid = payments.rows.filter((p) => p.status === 'completed').reduce((s, p) => s + num(p.amount), 0);
  return {
    lines,
    payments: payments.rows.map((p) => ({ id: p.id, method: p.payment_method, amount: num(p.amount), status: p.status, at: isoTime(p.paid_at || p.created_at) })),
    total,
    paid,
    balance: Math.max(0, total - paid),
    currency: 'XAF',
  };
}

router.get(
  '/folio',
  ah(async (req, res) => {
    const stay = req.query.stay ? await ownStay(req.user, req.query.stay) : await currentStay(req.user);
    if (!stay) return res.json(null);
    return res.json({ stay: toStay(stay), ...(await folioOf(stay)) });
  }),
);

// ======================================================================
// Requests (housekeeping, maintenance, concierge …) → service_requests, FAY OS → Service Requests
// ======================================================================
const DEPARTMENTS = {
  Housekeeping: 'housekeeping',
  Maintenance: 'maintenance',
  Concierge: 'concierge',
  Dining: 'dining',
  Wellness: 'wellness',
  Transportation: 'transport',
  Experiences: 'experience',
};
const REQ_STATUS = { pending: 'Received', acknowledged: 'Seen', in_progress: 'In progress', scheduled: 'Scheduled', escalated: 'In progress', on_hold: 'On hold', completed: 'Done', cancelled: 'Cancelled' };

const toRequest = (r) => ({
  id: r.id,
  number: r.request_number,
  department: r.department,
  title: r.title,
  notes: r.description || '',
  priority: r.priority,
  status: REQ_STATUS[r.status] || r.status,
  open: !['completed', 'cancelled'].includes(r.status),
  location: r.location || '',
  createdAt: isoTime(r.created_at),
  completedAt: isoTime(r.completed_at),
  resolution: r.resolution_notes || '',
});

router.get(
  '/requests',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM service_requests WHERE guest_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json(rows.map(toRequest));
  }),
);

/** POST { department, title, notes?, urgent?, location? } */
router.post(
  '/requests',
  ah(async (req, res) => {
    const { department = 'Concierge', title, notes, urgent, location } = req.body || {};
    if (!DEPARTMENTS[department]) throw httpError(400, `Choose one of: ${Object.keys(DEPARTMENTS).join(', ')}`);
    if (!title || !String(title).trim()) throw httpError(400, 'Tell us what you need');
    const stay = await requireStay(req.user);
    const { rows } = await db.query(
      `WITH n AS (SELECT nextval(pg_get_serial_sequence('service_requests', 'id')) AS id)
       INSERT INTO service_requests (id, request_number, guest_id, guest_name, booking_id, apartment_id, request_type, department, title, description, priority, location, metadata)
       SELECT n.id, '#' || n.id, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11 FROM n RETURNING *`,
      [
        req.user.id, req.user.fullName, stay.id, stay.apartment_id, DEPARTMENTS[department], department, String(title).trim().slice(0, 200),
        notes || null, urgent ? 'urgent' : 'normal', location || `Residence ${stay.unit_number}`, JSON.stringify({ source: 'guest_app' }),
      ],
    );
    const request = toRequest(rows[0]);
    emit(req, 'service-request:created', {
      id: request.id, number: request.number, createdAt: request.createdAt, guestId: req.user.id, guestName: req.user.fullName, title: request.title,
      location: request.location, priority: urgent ? 'High' : 'Normal', status: 'New', department, notes: request.notes,
    });
    await notify(req, `${urgent ? 'Urgent ' : ''}${department} request from ${req.user.fullName}`, `${request.title} · ${request.location}`, { link: '/requests' });
    await addTimeline(null, req.user.id, `Requested: ${request.title}`, 'Service Request', { bookingId: stay.id });
    res.status(201).json(request);
  }),
);

router.post(
  '/requests/:id/cancel',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `UPDATE service_requests SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Cancelled by guest'
        WHERE id = $1 AND guest_id = $2 AND status IN ('pending', 'acknowledged', 'scheduled', 'on_hold') RETURNING *`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) throw httpError(409, 'This request can no longer be cancelled');
    emit(req, 'service-request:updated', { id: rows[0].id, status: 'Cancelled' });
    res.json(toRequest(rows[0]));
  }),
);

// ======================================================================
// Dining → menu_items, dining_orders (+ folio), dining_reservations; FAY OS → Dining
// ======================================================================
router.get(
  '/dining/menu',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT id, name, venue, price, category, popular FROM menu_items WHERE available IS NOT FALSE ORDER BY venue, category, popular DESC, name');
    res.json(rows.map((m) => ({ id: m.id, name: m.name, venue: m.venue || 'Vitality Café', price: num(m.price), category: m.category || 'Menu', popular: Boolean(m.popular) })));
  }),
);

const toOrder = (o) => ({ id: o.id, number: o.number, venue: o.venue, items: o.items, time: o.time, location: o.location, status: o.status, total: num(o.total), createdAt: isoTime(o.created_at) });

router.get(
  '/dining/orders',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM dining_orders WHERE guest_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(rows.map(toOrder));
  }),
);

/**
 * POST { items: [{ id, qty }], time?: 'HH:MM' | 'asap', notes? }
 * Prices come from the menu, never from the app. Delivered to the residence and charged to the stay.
 */
router.post(
  '/dining/orders',
  ah(async (req, res) => {
    const { items = [], time, notes } = req.body || {};
    const wanted = (Array.isArray(items) ? items : []).map((i) => ({ id: Number(i.id), qty: Math.min(20, Math.max(1, Math.round(Number(i.qty) || 1))) })).filter((i) => i.id);
    if (!wanted.length) throw httpError(400, 'Add something to your order');
    const stay = await currentStay(req.user);
    if (!stay || stay.status !== 'checked_in') throw httpError(409, 'In-residence dining opens once you have checked in');
    const { rows: menu } = await db.query('SELECT id, name, venue, price FROM menu_items WHERE id = ANY($1) AND available IS NOT FALSE', [wanted.map((w) => w.id)]);
    const byId = Object.fromEntries(menu.map((m) => [m.id, m]));
    const missing = wanted.filter((w) => !byId[w.id]);
    if (missing.length) throw httpError(409, 'Something in your order is no longer available — please review it');
    const total = wanted.reduce((s, w) => s + num(byId[w.id].price) * w.qty, 0);
    const summary = wanted.map((w) => `${w.qty}× ${byId[w.id].name}`).join(', ') + (notes ? ` — ${String(notes).slice(0, 200)}` : '');
    const venue = byId[wanted[0].id].venue || 'In-residence dining';
    const when = time && time !== 'asap' && isTime(time) ? time : 'ASAP';
    const order = await db.query(
      `INSERT INTO dining_orders (venue, items, time, location, status, guest_id, guest_name, total)
       VALUES ($1, $2, $3, $4, 'Confirmed', $5, $6, $7) RETURNING *`,
      [venue, summary, when, `Residence ${stay.unit_number}`, req.user.id, req.user.fullName, total],
    );
    const o = order.rows[0];
    await db.query("UPDATE dining_orders SET number = '#D' || id WHERE id = $1 AND number IS NULL", [o.id]);
    if (total > 0) {
      await db.query(
        `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount, source_type, source_id)
         VALUES ($1, $2, $3, 'Dining', $4, 'dining_order', $5)`,
        [req.user.id, stay.id, `${venue} · ${summary}`.slice(0, 255), total, o.id],
      );
    }
    const saved = { ...o, number: o.number || `#D${o.id}` };
    emit(req, 'dining:order', toOrder(saved));
    await notify(req, `Dining order · Residence ${stay.unit_number}`, `${summary} (${when})`, { link: '/dining' });
    res.status(201).json(toOrder(saved));
  }),
);

const toReservation = (r) => ({ id: r.id, number: r.reservation_number, venue: r.restaurant_name, date: isoDate(r.reservation_date), time: hhmm(r.reservation_time), guests: r.number_of_guests, status: r.status, notes: r.special_requests || '' });

router.get(
  '/dining/reservations',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM dining_reservations WHERE guest_id = $1 ORDER BY reservation_date DESC, reservation_time LIMIT 50', [req.user.id]);
    res.json(rows.map(toReservation));
  }),
);

/** POST { venue, date, time, guests, notes? } */
router.post(
  '/dining/reservations',
  ah(async (req, res) => {
    const { venue, date, time, guests, notes } = req.body || {};
    if (!venue || !isDate(date) || !isTime(time)) throw httpError(400, 'Choose a venue, date and time');
    if (date < isoDate(await todayIn())) throw httpError(400, 'Choose a date from today');
    const stay = await requireStay(req.user);
    const { rows } = await db.query(
      `WITH n AS (SELECT nextval(pg_get_serial_sequence('dining_reservations', 'id')) AS id)
       INSERT INTO dining_reservations (id, reservation_number, guest_id, guest_name, booking_id, restaurant_name, reservation_date, reservation_time,
                                        number_of_guests, status, source, special_requests)
       SELECT n.id, 'DIN-' || n.id, $1, $2, $3, $4, $5, $6, $7, 'pending', 'Guest app', $8 FROM n RETURNING *`,
      [req.user.id, req.user.fullName, stay.id, String(venue).slice(0, 100), date, time, Math.min(20, Math.max(1, Number(guests) || 1)), notes || null],
    );
    emit(req, 'dining:reservation', toReservation(rows[0]));
    await notify(req, `Table request · ${venue}`, `${req.user.fullName} · ${date} ${time} · ${rows[0].number_of_guests} guest(s)`, { link: '/dining' });
    res.status(201).json(toReservation(rows[0]));
  }),
);

router.post(
  '/dining/reservations/:id/cancel',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `UPDATE dining_reservations SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Cancelled by guest'
        WHERE id = $1 AND guest_id = $2 AND status IN ('pending', 'confirmed') RETURNING *`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) throw httpError(409, 'This reservation can no longer be cancelled');
    emit(req, 'dining:reservation', toReservation(rows[0]));
    res.json(toReservation(rows[0]));
  }),
);

// ======================================================================
// Experiences → experiences, experience_bookings (+ folio); FAY OS → Experiences
// ======================================================================
router.get(
  '/experiences',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM experiences WHERE active IS NOT FALSE ORDER BY category, name');
    res.json(rows.map((e) => ({ id: e.id, name: e.name, category: e.category, description: e.description, duration: e.duration, capacity: e.capacity, price: num(e.price), image: e.img || null })));
  }),
);

const toExperienceBooking = (b) => ({
  id: b.id, number: b.booking_number, experience: b.experience_name, date: isoDate(b.experience_date), time: hhmm(b.experience_time),
  guests: b.number_of_participants, total: num(b.total_price), status: b.status,
});

router.get(
  '/experiences/bookings',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM experience_bookings WHERE guest_id = $1 ORDER BY experience_date DESC LIMIT 50', [req.user.id]);
    res.json(rows.map(toExperienceBooking));
  }),
);

/** POST /experiences/:id/book { date, time, guests, notes? } — capacity is checked per start time. */
router.post(
  '/experiences/:id/book',
  ah(async (req, res) => {
    const { date, time, guests, notes } = req.body || {};
    if (!isDate(date) || !isTime(time)) throw httpError(400, 'Choose a date and time');
    if (date < isoDate(await todayIn())) throw httpError(400, 'Choose a date from today');
    const pax = Math.min(50, Math.max(1, Number(guests) || 1));
    const stay = await requireStay(req.user);
    const exp = (await db.query('SELECT * FROM experiences WHERE id = $1 AND active IS NOT FALSE', [req.params.id])).rows[0];
    if (!exp) throw httpError(404, 'Experience not found');
    if (exp.capacity) {
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(number_of_participants), 0)::int AS booked FROM experience_bookings
          WHERE (experience_id = $1 OR LOWER(experience_name) = LOWER($2)) AND experience_date = $3 AND experience_time = $4 AND status <> 'cancelled'`,
        [exp.id, exp.name, date, time],
      );
      const left = exp.capacity - rows[0].booked;
      if (pax > left) throw httpError(409, left > 0 ? `Only ${left} place${left === 1 ? '' : 's'} left at that time` : 'That time is full — please choose another');
    }
    const total = num(exp.price) * pax;
    const { rows } = await db.query(
      `WITH n AS (SELECT nextval(pg_get_serial_sequence('experience_bookings', 'id')) AS id)
       INSERT INTO experience_bookings (id, booking_number, guest_id, guest_name, booking_id, experience_id, experience_name, experience_type,
                                        experience_date, experience_time, number_of_participants, price_per_person, total_price, status, special_requirements)
       SELECT n.id, 'EXP-' || n.id, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12 FROM n RETURNING *`,
      [req.user.id, req.user.fullName, stay.id, exp.id, exp.name, exp.category, date, time, pax, num(exp.price), total, notes || null],
    );
    if (total > 0) {
      await db.query(
        `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount, source_type, source_id)
         VALUES ($1, $2, $3, 'Experiences', $4, 'experience_booking', $5)`,
        [req.user.id, stay.id, `${exp.name} · ${pax} guest${pax > 1 ? 's' : ''}`, total, rows[0].id],
      );
    }
    emit(req, 'experience:booking', toExperienceBooking(rows[0]));
    await notify(req, `Experience booked · ${exp.name}`, `${req.user.fullName} · ${date} ${time} · ${pax} guest(s)`, { link: '/experiences' });
    res.status(201).json(toExperienceBooking(rows[0]));
  }),
);

// ======================================================================
// Transfers → transfers; FAY OS → Transportation
// ======================================================================
const TRANSFER_KINDS = ['Airport pickup', 'Airport drop-off', 'City ride'];
const toTransfer = (t) => ({ id: t.id, kind: t.kind, date: isoDate(t.date), time: t.time, from: t.from_location, to: t.to_location, vehicle: t.vehicle, driver: t.driver, status: t.status });

router.get(
  '/transfers',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM transfers WHERE guest_id = $1 ORDER BY date DESC, time LIMIT 50', [req.user.id]);
    res.json(rows.map(toTransfer));
  }),
);

/** POST { kind, date, time, from?, to?, flight? } */
router.post(
  '/transfers',
  ah(async (req, res) => {
    const { kind, date, time, from, to, flight } = req.body || {};
    if (!TRANSFER_KINDS.includes(kind)) throw httpError(400, `Choose ${TRANSFER_KINDS.join(', ')}`);
    if (!isDate(date) || !isTime(time)) throw httpError(400, 'Choose a date and time');
    if (date < isoDate(await todayIn())) throw httpError(400, 'Choose a date from today');
    await requireStay(req.user);
    const airport = 'Airport' + (flight ? ` · flight ${String(flight).toUpperCase().slice(0, 12)}` : '');
    const fromLoc = kind === 'Airport pickup' ? airport : from || 'Faysha';
    const toLoc = kind === 'Airport drop-off' ? airport : to || 'Faysha';
    const { rows } = await db.query(
      `INSERT INTO transfers (date, time, kind, guest_id, guest_name, from_location, to_location, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Scheduled') RETURNING *`,
      [date, time, kind, req.user.id, req.user.fullName, String(fromLoc).slice(0, 200), String(toLoc).slice(0, 200)],
    );
    emit(req, 'transfer:requested', toTransfer(rows[0]));
    await notify(req, `${kind} requested`, `${req.user.fullName} · ${date} ${time}`, { link: '/transport' });
    res.status(201).json(toTransfer(rows[0]));
  }),
);

// ======================================================================
// Smart home → residence_controls (shared with FAY OS → Residences); in-house guests only
// ======================================================================
// Same rooms and device keys ("room-device" index) as FAY OS (frontend/src/manager/pages/Residences.jsx).
const ROOMS = [
  ['Living Room', [['lightbulb', 'Lights'], ['blinds', 'Blinds'], ['tv', 'Media']]],
  ['Master Bedroom', [['lightbulb', 'Lights'], ['blinds', 'Blackout'], ['air', 'Air Purifier']]],
  ['Kitchen', [['lightbulb', 'Lights'], ['kitchen', 'Fridge'], ['coffee_maker', 'Coffee']]],
  ['Terrace & Pool', [['pool', 'Pool Heater'], ['light', 'Garden Lights'], ['umbrella', 'Shade']]],
];
const DEVICE_KEYS = new Set(ROOMS.flatMap(([, devs], ri) => devs.map((_, di) => `${ri}-${di}`)));
const SCENES = ['welcome', 'relax', 'sleep', 'away', 'wake up'];

async function homeOf(user) {
  const stay = await currentStay(user);
  if (!stay || stay.status !== 'checked_in') throw httpError(409, 'Your residence controls open when you check in');
  await db.query('INSERT INTO residence_controls (apartment_id) VALUES ($1) ON CONFLICT (apartment_id) DO NOTHING', [stay.apartment_id]);
  const { rows } = await db.query('SELECT * FROM residence_controls WHERE apartment_id = $1', [stay.apartment_id]);
  return { stay, controls: rows[0] };
}

function toHome({ stay, controls }) {
  const off = controls.devices_off || {};
  const security = controls.security || {};
  return {
    residence: { unit: stay.unit_number, name: stay.residence_name },
    targetTemp: controls.target_temp ?? 22,
    scene: controls.scene || 'relax',
    scenes: SCENES,
    frontDoor: security.front === 'Unlocked' ? 'Unlocked' : 'Secured',
    doNotDisturb: security.privacy === 'On',
    rooms: ROOMS.map(([name, devs], ri) => ({
      name,
      devices: devs.map(([icon, label], di) => ({ key: `${ri}-${di}`, icon, label, on: !off[`${ri}-${di}`] })),
    })),
  };
}

async function changeHome(req, sql, params) {
  const home = await homeOf(req.user);
  await db.query(`UPDATE residence_controls SET ${sql}, updated_at = NOW() WHERE apartment_id = $1`, [home.stay.apartment_id, ...params]);
  const updated = await homeOf(req.user);
  emit(req, 'residence:updated', { id: updated.stay.apartment_id, by: 'guest' });
  return toHome(updated);
}

router.get('/home', ah(async (req, res) => res.json(toHome(await homeOf(req.user)))));

router.patch(
  '/home/climate',
  ah(async (req, res) => {
    const temp = Math.round(Number(req.body?.targetTemp));
    if (!(temp >= 16 && temp <= 30)) throw httpError(400, 'Choose between 16° and 30°');
    res.json(await changeHome(req, 'target_temp = $2', [temp]));
  }),
);

router.post(
  '/home/scene',
  ah(async (req, res) => {
    const scene = String(req.body?.scene || '').toLowerCase();
    if (!SCENES.includes(scene)) throw httpError(400, `Choose ${SCENES.join(', ')}`);
    res.json(await changeHome(req, 'scene = $2', [scene]));
  }),
);

router.patch(
  '/home/devices/:key',
  ah(async (req, res) => {
    if (!DEVICE_KEYS.has(req.params.key)) throw httpError(404, 'Unknown device');
    const off = req.body?.on === false;
    res.json(await changeHome(req, "devices_off = COALESCE(devices_off, '{}'::jsonb) || jsonb_build_object($2::text, $3::boolean)", [req.params.key, off]));
  }),
);

/** PATCH { doNotDisturb?: boolean } — privacy mode. The door itself is opened with the digital key. */
router.patch(
  '/home/privacy',
  ah(async (req, res) => {
    const on = Boolean(req.body?.doNotDisturb);
    res.json(await changeHome(req, "security = COALESCE(security, '{}'::jsonb) || jsonb_build_object('privacy', $2::text)", [on ? 'On' : 'Off']));
  }),
);

// ======================================================================
// Rewards — earned from completed stays and services (1 point per 1,000 XAF), tiers by lifetime points
// ======================================================================
const TIERS = [
  { name: 'Serenity', from: 0, perks: ['Welcome ritual on arrival', 'Member rates on direct bookings'] },
  { name: 'Gold', from: 500, perks: ['Late check-out when available', 'Complimentary sunset ceremony'] },
  { name: 'Platinum', from: 1500, perks: ['Room upgrade when available', 'One spa treatment per stay'] },
  { name: 'Legend', from: 4000, perks: ['Private dining evening each year', 'A personal host for every stay'] },
];

async function rewardsOf(user) {
  const { rows } = await db.query(
    `SELECT b.id, b.booking_number, b.check_out_date, c.display_name, b.final_price,
            COALESCE((SELECT SUM(amount) FROM folio_charges f WHERE f.booking_id = b.id), 0) AS extras
       FROM bookings b JOIN apartments a ON a.id = b.apartment_id JOIN apartment_categories c ON c.id = a.category_id
      WHERE (b.user_id = $1 OR (b.user_id IS NULL AND LOWER(b.guest_email) = LOWER($2))) AND b.status = 'checked_out'
      ORDER BY b.check_out_date DESC`,
    [user.id, user.email],
  );
  const history = rows.map((r) => ({
    id: r.id, label: `${r.display_name} · ${r.booking_number}`, date: isoDate(r.check_out_date),
    points: Math.floor((num(r.final_price) + num(r.extras)) / 1000),
  }));
  const points = history.reduce((s, h) => s + h.points, 0);
  const tierIndex = TIERS.reduce((idx, t, i) => (points >= t.from ? i : idx), 0);
  const next = TIERS[tierIndex + 1] || null;
  return { points, tier: TIERS[tierIndex], next: next ? { name: next.name, at: next.from, toGo: next.from - points } : null, tiers: TIERS, history };
}

router.get('/rewards', ah(async (req, res) => res.json(await rewardsOf(req.user))));

// ======================================================================
// Push notifications (Expo push tokens)
// ======================================================================
router.post(
  '/push-token',
  ah(async (req, res) => {
    const { token, platform, device } = req.body || {};
    if (!/^Expo(nent)?PushToken\[.+\]$/.test(token || '')) throw httpError(400, 'Invalid push token');
    const os = platform === 'ios' ? 'ios' : 'android';
    await db.query(
      `INSERT INTO fcm_tokens (user_id, token, platform, device_info, is_active) VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, is_active = true, device_info = $4, updated_at = NOW()`,
      [req.user.id, token, os, JSON.stringify({ expo: true, device: device || null })],
    );
    res.json({ ok: true });
  }),
);

router.delete(
  '/push-token',
  ah(async (req, res) => {
    await db.query('UPDATE fcm_tokens SET is_active = false WHERE user_id = $1 AND token = $2', [req.user.id, req.body?.token || '']);
    res.json({ ok: true });
  }),
);

// ======================================================================
// Estate tour — the 360° panoramas uploaded in HQ → Residences (apartment_media, media_type panorama_360)
// ======================================================================
router.get(
  '/tour',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT m.id, m.title, m.file_url, m.thumbnail_url, COALESCE(c.display_name, c2.display_name) AS residence
         FROM apartment_media m
         LEFT JOIN apartment_categories c ON c.id = m.category_id
         LEFT JOIN apartments a ON a.id = m.apartment_id
         LEFT JOIN apartment_categories c2 ON c2.id = a.category_id
        WHERE m.media_type = 'panorama_360'
        ORDER BY m.is_primary DESC, m.sort_order, m.id
        LIMIT 30`,
    );
    res.json(rows.map((r) => ({ id: r.id, title: r.title || r.residence || 'Faysha', residence: r.residence, url: r.file_url, thumbnail: r.thumbnail_url || null })));
  }),
);

// ======================================================================
// Account deletion (required by the app stores). Stay records are kept for accounting, without the account.
// ======================================================================
/** POST { password } — closes the guest's account: anonymised, signed out everywhere, email free to sign up again. */
router.post(
  '/account/delete',
  ah(async (req, res) => {
    if (req.user.role !== 'guest') throw httpError(403, 'Staff accounts are closed by an administrator');
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL', [req.user.id]);
    if (!rows.length) throw httpError(404, 'Account not found');
    if (!(await bcrypt.compare(String(req.body?.password || ''), rows[0].password_hash))) throw httpError(400, 'That password is not correct');
    const active = await db.query("SELECT 1 FROM bookings WHERE user_id = $1 AND status = 'checked_in' LIMIT 1", [req.user.id]);
    if (active.rows.length) throw httpError(409, 'You are in residence right now — please close your account after check-out');
    await db.query('UPDATE fcm_tokens SET is_active = false WHERE user_id = $1', [req.user.id]);
    await db.query(
      `UPDATE users SET email = 'deleted+' || id || '@deleted.fayshaa.com', username = 'deleted_' || id, full_name = 'Deleted guest',
              phone = NULL, date_of_birth = NULL, nationality = NULL, emergency_contact = NULL, emergency_phone = NULL,
              dietary_preferences = NULL, allergies = NULL, profile_image_url = NULL,
              status = 'inactive', deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [req.user.id],
    );
    res.json({ ok: true });
  }),
);

// ======================================================================
router.use((req, res) => res.status(404).json({ message: `No guest route ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const pg = { 23505: [409, 'That already exists'], 23503: [400, 'A linked record does not exist'], '22P02': [400, 'Invalid value'], 22007: [400, 'Invalid date'], 22008: [400, 'Invalid date'], 23514: [400, 'A value is out of range'] };
  const [status, message] = err.status ? [err.status, err.message] : pg[err.code] || [500, 'Something went wrong'];
  if (status >= 500) console.error('Guest API error:', req.method, req.originalUrl, err);
  res.status(status).json({ message });
});

module.exports = router;
module.exports.ROOMS = ROOMS;

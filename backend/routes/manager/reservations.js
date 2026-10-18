/**
 * Reservations = the bookings table (same records the website and /admin use),
 * room types = apartment_categories, residences = apartments.
 */

const express = require('express');
const { db, ah, httpError, isoDate, isoTime, displayTime, notify, getSetting } = require('./lib');

const router = express.Router();

const STATUS_OUT = { pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Confirmed', checked_out: 'Confirmed', cancelled: 'Cancelled' };

const SELECT = `
  SELECT b.*, a.unit_number, c.display_name AS collection, p.name AS package_name,
         COALESCE((SELECT SUM(amount - COALESCE(refund_amount, 0)) FROM payments WHERE booking_id = b.id AND status IN ('completed', 'refunded')), 0) AS paid
    FROM bookings b
    JOIN apartments a ON a.id = b.apartment_id
    JOIN apartment_categories c ON c.id = a.category_id
    LEFT JOIN reservation_packages p ON p.id = b.package_id`;

async function currency() {
  const property = await getSetting('property');
  return String(property.currency || 'XAF').slice(0, 3).toLowerCase();
}

function toReservation(b, cur) {
  return {
    id: b.id,
    number: b.booking_number,
    guestName: b.guest_name,
    guestId: b.user_id,
    residence: b.unit_number,
    collection: b.collection,
    checkIn: isoDate(b.check_in_date),
    checkOut: isoDate(b.check_out_date),
    guests: b.number_of_guests,
    status: STATUS_OUT[b.status] || b.status,
    stage: b.status,
    source: b.source || 'Direct Website',
    bookedAt: isoTime(b.created_at),
    cancelledAt: isoTime(b.cancelled_at),
    package: b.package_name || undefined,
    totalAmount: Number(b.final_price),
    balanceDue: Math.max(0, Number(b.final_price) - Number(b.paid)),
    currency: cur,
  };
}

async function one(id) {
  const { rows } = await db.query(`${SELECT} WHERE b.id = $1`, [id]);
  if (!rows.length) throw httpError(404, 'Reservation not found');
  return toReservation(rows[0], await currency());
}

/** GET ?from&to&status → reservations overlapping [from, to) */
router.get(
  '/',
  ah(async (req, res) => {
    const { from, to, status } = req.query;
    const params = [];
    const where = [];
    if (from) {
      params.push(from);
      where.push(`b.check_out_date > $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`b.check_in_date < $${params.length}`);
    }
    if (status) {
      const map = { Pending: ['pending'], Confirmed: ['confirmed', 'checked_in', 'checked_out'], Cancelled: ['cancelled'] };
      params.push(map[status] || [status]);
      where.push(`b.status::text = ANY($${params.length})`);
    }
    const { rows } = await db.query(`${SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY b.check_in_date LIMIT 2000`, params);
    const cur = await currency();
    res.json(rows.map((r) => toReservation(r, cur)));
  }),
);

/** POST { guestId, residence, checkIn, checkOut, guests, source, packageId? } — 409 on overlap. */
router.post(
  '/',
  ah(async (req, res) => {
    const { guestId, residence, checkIn, checkOut, guests = 1, source = 'Direct Website', packageId } = req.body || {};
    if (!guestId || !residence || !checkIn || !checkOut) throw httpError(400, 'guestId, residence, checkIn and checkOut are required');
    const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
    if (!(nights >= 1)) throw httpError(400, 'Check-out must be after check-in');

    const guest = (await db.query('SELECT id, full_name, email, phone FROM users WHERE id = $1 AND deleted_at IS NULL', [guestId])).rows[0];
    if (!guest) throw httpError(400, 'Guest not found');
    const apt = (
      await db.query(
        `SELECT a.id, a.unit_number, COALESCE(a.custom_price, c.base_price) AS rate, c.max_guests
           FROM apartments a JOIN apartment_categories c ON c.id = a.category_id
          WHERE (a.unit_number = $1 OR a.id::text = $1) AND a.is_active = true`,
        [String(residence)],
      )
    ).rows[0];
    if (!apt) throw httpError(400, `Unknown residence "${residence}"`);
    if (Number(guests) > apt.max_guests) throw httpError(400, `${apt.unit_number} sleeps up to ${apt.max_guests}`);

    // Price is computed here, never trusted from the client.
    let rate = Number(apt.rate);
    if (packageId) {
      const pkg = (await db.query('SELECT price, nights FROM reservation_packages WHERE id = $1', [packageId])).rows[0];
      if (!pkg) throw httpError(400, 'Package not found');
      if (nights < pkg.nights) throw httpError(400, `This package needs at least ${pkg.nights} nights`);
      rate = Number(pkg.price);
    }
    const total = rate * nights;

    const clash = await db.query(
      `SELECT b.booking_number, b.guest_name, b.check_in_date, b.check_out_date FROM bookings b
        WHERE b.apartment_id = $1 AND b.status IN ('pending', 'confirmed', 'checked_in')
          AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange($2::date, $3::date, '[)') LIMIT 1`,
      [apt.id, checkIn, checkOut],
    );
    if (clash.rows.length) {
      const c = clash.rows[0];
      throw httpError(409, `${apt.unit_number} is already booked ${isoDate(c.check_in_date)} → ${isoDate(c.check_out_date)} (${c.guest_name})`);
    }

    let row;
    try {
      ({ rows: [row] } = await db.query(
        `INSERT INTO bookings (booking_number, apartment_id, user_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date,
                               number_of_guests, number_of_nights, price_per_night, total_price, discount_amount, final_price,
                               status, confirmed_at, source, package_id, created_by, terms_accepted)
         VALUES ('FAY-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD((
                   SELECT COALESCE(MAX(NULLIF(regexp_replace(SPLIT_PART(booking_number, '-', 3), '\\D', '', 'g'), '')::int), 0) + 1
                     FROM bookings WHERE booking_number LIKE 'FAY-' || to_char(NOW(), 'YYYYMMDD') || '-%')::text, 3, '0'),
                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $11, 'confirmed', NOW(), $12, $13, $14, false)
         RETURNING id`,
        [apt.id, guest.id, guest.full_name, guest.email, guest.phone || '', checkIn, checkOut, Number(guests), nights, rate, total, source, packageId || null, req.user.id],
      ));
    } catch (e) {
      if (e.code === '23P01') throw httpError(409, `${apt.unit_number} is already booked for those dates`);
      throw e;
    }
    const reservation = await one(row.id);
    await notify(req, 'New reservation', `${reservation.guestName} · ${reservation.residence} · ${reservation.checkIn}`, { link: '/reservations' });
    res.status(201).json(reservation);
  }),
);

/** PATCH { status } — Confirmed | Pending | Cancelled */
router.patch(
  '/:id',
  ah(async (req, res) => {
    const map = { Confirmed: 'confirmed', Pending: 'pending', Cancelled: 'cancelled' };
    const status = map[req.body?.status];
    if (!status) throw httpError(400, 'status must be Confirmed, Pending or Cancelled');
    const current = (await db.query('SELECT status FROM bookings WHERE id = $1', [req.params.id])).rows[0];
    if (!current) throw httpError(404, 'Reservation not found');
    if (['checked_in', 'checked_out'].includes(current.status)) throw httpError(409, `This stay is already ${current.status.replace('_', ' ')}`);
    const stamp = { confirmed: ', confirmed_at = COALESCE(confirmed_at, NOW())', cancelled: ', cancelled_at = NOW()', pending: '' }[status];
    try {
      await db.query(`UPDATE bookings SET status = $1${stamp} WHERE id = $2`, [status, req.params.id]);
    } catch (e) {
      if (e.code === '23P01') throw httpError(409, 'Those dates are no longer free');
      throw e;
    }
    res.json(await one(req.params.id));
  }),
);

// ---- Front desk: today's arrivals and departures ----

router.get(
  '/today',
  ah(async (req, res) => {
    const property = await getSetting('property');
    const { rows } = await db.query(
      `SELECT b.id, b.guest_name, b.number_of_guests, b.status, b.check_in_date, b.check_out_date, a.unit_number
         FROM bookings b JOIN apartments a ON a.id = b.apartment_id
        WHERE b.status <> 'cancelled' AND (b.check_in_date = CURRENT_DATE OR b.check_out_date = CURRENT_DATE)
        ORDER BY b.check_in_date, b.id`,
    );
    const today = isoDate(new Date());
    const move = (b, time, status) => ({ id: b.id, time, guestName: b.guest_name, residence: b.unit_number, guests: b.number_of_guests, status });
    res.json({
      arrivals: rows
        .filter((b) => isoDate(b.check_in_date) === today)
        .map((b) => move(b, property.checkInTime || displayTime('15:00'), b.status === 'checked_in' || b.status === 'checked_out' ? 'Checked In' : 'Expected')),
      departures: rows
        .filter((b) => isoDate(b.check_out_date) === today)
        .map((b) => move(b, property.checkOutTime || displayTime('11:00'), b.status === 'checked_out' ? 'Checked Out' : b.status === 'checked_in' ? 'Pending' : 'Not arrived')),
    });
  }),
);

/** PATCH /today/:kind/:id { status } — 'Checked In' for arrivals, 'Checked Out' for departures. */
router.patch(
  '/today/:kind/:id',
  ah(async (req, res) => {
    const { kind, id } = req.params;
    const { status } = req.body || {};
    const b = (await db.query('SELECT b.*, a.unit_number FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.id = $1', [id])).rows[0];
    if (!b) throw httpError(404, 'Reservation not found');
    if (kind === 'arrivals' && status === 'Checked In') {
      if (!['confirmed', 'pending'].includes(b.status)) throw httpError(409, `Booking is ${b.status.replace('_', ' ')}`);
      await db.query("UPDATE bookings SET status = 'checked_in', checked_in_at = NOW(), confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = $1", [id]);
      await notify(req, 'Guest checked in', `${b.guest_name} · ${b.unit_number}`);
    } else if (kind === 'departures' && status === 'Checked Out') {
      if (b.status !== 'checked_in') throw httpError(409, 'Guest is not checked in');
      await db.query("UPDATE bookings SET status = 'checked_out', checked_out_at = NOW() WHERE id = $1", [id]);
      await db.query(
        `INSERT INTO residence_controls (apartment_id, housekeeping_status, housekeeping_note) VALUES ($1, 'Dirty', 'Departure clean')
         ON CONFLICT (apartment_id) DO UPDATE SET housekeeping_status = 'Dirty', housekeeping_note = 'Departure clean'`,
        [b.apartment_id],
      );
      await notify(req, 'Guest checked out', `${b.guest_name} · ${b.unit_number}`, { link: '/housekeeping' });
    } else {
      throw httpError(400, 'Use status "Checked In" for arrivals or "Checked Out" for departures');
    }
    res.json({ id: Number(id), status });
  }),
);

// ---- Room types = apartment categories ----

const ROOM_TYPE_SELECT = `
  SELECT c.*, COUNT(a.id)::int AS units,
         COALESCE(array_agg(a.unit_number ORDER BY a.unit_number) FILTER (WHERE a.id IS NOT NULL), '{}') AS unit_names
    FROM apartment_categories c
    LEFT JOIN apartments a ON a.category_id = c.id AND a.is_active = true
   WHERE c.is_active = true`;

const toRoomType = (c) => ({
  id: c.id,
  collection: c.display_name,
  units: c.units,
  rate: Number(c.base_price),
  capacity: c.max_guests,
  bedrooms: c.bedrooms,
  view: c.view_description || '',
  residences: c.unit_names,
});

router.get(
  '/room-types',
  ah(async (req, res) => {
    const { rows } = await db.query(`${ROOM_TYPE_SELECT} GROUP BY c.id ORDER BY c.sort_order, c.id`);
    res.json(rows.map(toRoomType));
  }),
);

/** PATCH { rate?, capacity?, bedrooms?, view?, collection? } — changes the public website price too. */
router.patch(
  '/room-types/:id',
  ah(async (req, res) => {
    const cols = { rate: 'base_price', capacity: 'max_guests', bedrooms: 'bedrooms', view: 'view_description', collection: 'display_name' };
    const fields = Object.keys(cols).filter((k) => req.body?.[k] !== undefined);
    if (fields.includes('rate') && !(Number(req.body.rate) > 0)) throw httpError(400, 'Rate must be greater than 0');
    if (fields.length) {
      await db.query(`UPDATE apartment_categories SET ${fields.map((k, i) => `${cols[k]} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${fields.length + 1}`, [
        ...fields.map((k) => req.body[k]),
        req.params.id,
      ]);
    }
    const { rows } = await db.query(`${ROOM_TYPE_SELECT} AND c.id = $1 GROUP BY c.id`, [req.params.id]);
    if (!rows.length) throw httpError(404, 'Room type not found');
    res.json(toRoomType(rows[0]));
  }),
);

module.exports = router;

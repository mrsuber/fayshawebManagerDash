/**
 * Department resources that live in existing FayshaaWeb tables:
 *   /dining/reservations      → dining_reservations
 *   /dining/tables            → dining_tables
 *   /wellness/appointments    → wellness_bookings (the unified wellness system the guest app uses)
 *   /experiences/bookings     → experience_bookings
 *   /experiences              → experiences (catalogue)
 * They speak the same list/create/update/delete contract as crud.js.
 */

const express = require('express');
const { crud } = require('./crud');
const { db, ah, httpError, isoDate, isoTime, findGuest } = require('./lib');

const router = express.Router();
const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';

/** Builds list/create/update/delete routes from a mapping spec with custom SQL. */
function mapped({ path, select, toItem, create, update, table, order, filter = {} }) {
  router.get(
    path,
    ah(async (req, res) => {
      const params = [];
      const where = [];
      for (const [k, v] of Object.entries(req.query)) {
        if (!filter[k] || v === '') continue;
        params.push(v);
        where.push(`${filter[k]}::text = $${params.length}`);
      }
      const { rows } = await db.query(`${select}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order}`, params);
      res.json(rows.map(toItem));
    }),
  );
  const one = async (id) => {
    const { rows } = await db.query(`${select} WHERE t.id = $1`, [id]);
    if (!rows.length) throw httpError(404, 'Not found');
    return toItem(rows[0]);
  };
  router.post(
    path,
    ah(async (req, res) => {
      const id = await create(req, req.body || {});
      res.status(201).json(await one(id));
    }),
  );
  router.patch(
    `${path}/:id`,
    ah(async (req, res) => {
      const before = await one(req.params.id);
      await update(req, req.params.id, req.body || {}, before);
      res.json(await one(req.params.id));
    }),
  );
  router.delete(
    `${path}/:id`,
    ah(async (req, res) => {
      const { rowCount } = await db.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
      if (!rowCount) throw httpError(404, 'Not found');
      res.json({ ok: true });
    }),
  );
}

/** UPDATE helper: only the keys present in `changes` (already mapped to columns). */
async function patchRow(table, id, changes) {
  const cols = Object.keys(changes).filter((k) => changes[k] !== undefined);
  if (!cols.length) return;
  await db.query(`UPDATE ${table} SET ${cols.map((c, i) => `"${c}" = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`, [...cols.map((c) => changes[c]), id]);
}

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const lower = (s) => (s ? String(s).toLowerCase().replace(/ /g, '_') : undefined);
const title = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : s);

// ---------------- Dining reservations ----------------

mapped({
  path: '/dining/reservations',
  table: 'dining_reservations',
  select: `SELECT t.*, COALESCE(t.guest_name, u.full_name) AS display_name FROM dining_reservations t LEFT JOIN users u ON u.id = t.guest_id`,
  order: 't.reservation_date DESC, t.reservation_time',
  filter: { guestId: 't.guest_id', date: 't.reservation_date', venue: 't.restaurant_name' },
  toItem: (r) => ({
    id: r.id,
    number: r.reservation_number,
    date: isoDate(r.reservation_date),
    time: hhmm(r.reservation_time),
    guestId: r.guest_id,
    guestName: r.display_name || '',
    covers: r.number_of_guests,
    venue: r.restaurant_name,
    table: r.table_number || '',
    status: title(r.status),
    source: r.source || 'Reservation',
    notes: r.special_requests || '',
    createdAt: isoTime(r.created_at),
  }),
  async create(req, b) {
    if (!b.date || !b.time || !b.venue) throw httpError(400, 'date, time and venue are required');
    const guest = await findGuest(null, b.guestId);
    const { rows } = await db.query(
      `WITH n AS (SELECT nextval(pg_get_serial_sequence('dining_reservations', 'id')) AS id)
       INSERT INTO dining_reservations (id, reservation_number, guest_id, guest_name, booking_id, restaurant_name, reservation_date, reservation_time,
                                        number_of_guests, table_number, status, source, special_requests, confirmed_at)
       SELECT n.id, 'DIN-' || n.id, $1, $2,
              (SELECT id FROM bookings WHERE user_id = $1 AND status IN ('checked_in', 'confirmed') ORDER BY check_in_date DESC LIMIT 1),
              $3, $4, $5, $6, NULLIF($7, ''), $8, $9, $10, NOW()
         FROM n RETURNING id`,
      [guest?.id ?? null, b.guestName || guest?.name || 'Walk-in', b.venue, b.date, b.time, Math.max(1, Number(b.covers) || 1), b.table || '', lower(b.status) || 'confirmed', b.source || 'Reservation', b.notes || null],
    );
    return rows[0].id;
  },
  async update(req, id, b) {
    const status = lower(b.status);
    await patchRow('dining_reservations', id, {
      restaurant_name: b.venue,
      reservation_date: b.date,
      reservation_time: b.time,
      number_of_guests: b.covers === undefined ? undefined : Number(b.covers),
      table_number: b.table,
      status,
      source: b.source,
      special_requests: b.notes,
      guest_name: b.guestName,
    });
    if (status === 'seated') await db.query('UPDATE dining_reservations SET seated_at = NOW() WHERE id = $1', [id]);
    if (status === 'completed') await db.query('UPDATE dining_reservations SET completed_at = NOW() WHERE id = $1', [id]);
    if (status === 'cancelled') await db.query('UPDATE dining_reservations SET cancelled_at = NOW() WHERE id = $1', [id]);
  },
});

// ---------------- Dining tables (floor plan) ----------------

router.get(
  '/dining/tables',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT id, status, guest_name FROM dining_tables ORDER BY id');
    res.json(rows.map((t) => ({ id: t.id, status: t.status, guestName: t.guest_name })));
  }),
);

/** PATCH { status, guestName? } — creates the table on first use (ids like "R-01"). */
router.patch(
  '/dining/tables/:id',
  ah(async (req, res) => {
    const { status, guestName } = req.body || {};
    if (!['Available', 'Seated', 'Reserved', 'Cleaning'].includes(status)) throw httpError(400, 'status must be Available, Seated, Reserved or Cleaning');
    const name = status === 'Available' || status === 'Cleaning' ? '' : guestName ?? null;
    const { rows } = await db.query(
      `INSERT INTO dining_tables (id, status, guest_name) VALUES ($1, $2, COALESCE($3, ''))
       ON CONFLICT (id) DO UPDATE SET status = $2, guest_name = COALESCE($3, dining_tables.guest_name) RETURNING *`,
      [req.params.id, status, name],
    );
    res.json({ id: rows[0].id, status: rows[0].status, guestName: rows[0].guest_name });
  }),
);

// ---------------- Wellness appointments ----------------

const WB_STATUS_IN = { Upcoming: 'upcoming', 'In Progress': 'in_progress', Completed: 'completed', Cancelled: 'cancelled' };
const WB_STATUS_OUT = { upcoming: 'Upcoming', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'Cancelled' };

/** Finds the wellness activity for a treatment name, creating a staff-only (inactive) one if needed. */
async function activityFor(treatment, minutes) {
  const found = await db.query('SELECT id, duration FROM wellness_activities WHERE LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1) ORDER BY is_active DESC LIMIT 1', [treatment]);
  if (found.rows.length) return found.rows[0].id;
  const { rows } = await db.query(
    `INSERT INTO wellness_activities (type, category, name, display_name, description, duration, requires_staff, max_capacity, is_active)
     VALUES ('service', 'spa', $1, $1, 'Added from the manager dashboard', $2, true, 1, false) RETURNING id`,
    [treatment, minutes],
  );
  return rows[0].id;
}

/** Rejects a treatment that overlaps another one in the same room. */
async function assertRoomFree(room, date, start, end, exceptId = null) {
  if (!room) return;
  const { rows } = await db.query(
    `SELECT activity_name, to_char(start_time, 'HH24:MI') AS s, to_char(end_time, 'HH24:MI') AS e FROM wellness_bookings
      WHERE room = $1 AND booking_date = $2 AND status NOT IN ('cancelled', 'no_show')
        AND start_time < $4::time AND end_time > $3::time AND ($5::int IS NULL OR id <> $5) LIMIT 1`,
    [room, date, start, end, exceptId],
  );
  if (rows.length) throw httpError(409, `${room} is booked ${rows[0].s}–${rows[0].e} (${rows[0].activity_name})`);
}

const minutesBetween = (start, end) => {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
};

mapped({
  path: '/wellness/appointments',
  table: 'wellness_bookings',
  select: `SELECT t.*, u.full_name FROM wellness_bookings t JOIN users u ON u.id = t.user_id`,
  order: 't.booking_date DESC, t.start_time',
  filter: { guestId: 't.user_id', date: 't.booking_date', room: 't.room', status: 't.status' },
  toItem: (r) => ({
    id: r.id,
    date: isoDate(r.booking_date),
    start: hhmm(r.start_time),
    end: hhmm(r.end_time),
    treatment: r.activity_name,
    guestId: r.user_id,
    guestName: r.full_name,
    room: r.room || '',
    status: WB_STATUS_OUT[r.status] || r.status,
    source: r.created_by ? 'Staff' : 'Guest app',
    createdAt: isoTime(r.created_at),
  }),
  async create(req, b) {
    if (!b.date || !b.start || !b.end || !b.treatment) throw httpError(400, 'date, start, end and treatment are required');
    if (!b.guestId) throw httpError(400, 'Choose a guest for the appointment');
    const guest = await findGuest(null, b.guestId);
    const minutes = minutesBetween(b.start, b.end);
    if (minutes <= 0) throw httpError(400, 'End time must be after start time');
    await assertRoomFree(b.room, b.date, b.start, b.end);
    const activityId = await activityFor(b.treatment, minutes);
    const { rows } = await db.query(
      `INSERT INTO wellness_bookings (user_id, apartment_booking_id, activity_id, activity_name, activity_type, booking_date, start_time, end_time,
                                      total_duration, status, room, created_by)
       VALUES ($1, (SELECT id FROM bookings WHERE user_id = $1 AND status IN ('checked_in', 'confirmed') ORDER BY check_in_date DESC LIMIT 1),
               $2, $3, 'service', $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [guest.id, activityId, b.treatment, b.date, b.start, b.end, minutes, WB_STATUS_IN[b.status] || 'upcoming', b.room || null, req.user.id],
    );
    return rows[0].id;
  },
  async update(req, id, b, before) {
    const date = b.date || before.date;
    const start = b.start || before.start;
    const end = b.end || before.end;
    if (b.date || b.start || b.end || b.room) await assertRoomFree(b.room ?? before.room, date, start, end, Number(id));
    if (b.status && !WB_STATUS_IN[b.status]) throw httpError(400, `Unknown status "${b.status}"`);
    await patchRow('wellness_bookings', id, {
      booking_date: b.date,
      start_time: b.start,
      end_time: b.end,
      total_duration: b.start || b.end ? minutesBetween(start, end) : undefined,
      room: b.room,
      status: WB_STATUS_IN[b.status],
      cancelled_at: b.status === 'Cancelled' ? new Date() : undefined,
    });
  },
});

// ---------------- Experiences ----------------

const EB_STATUS_IN = { Confirmed: 'confirmed', Pending: 'pending', 'In Progress': 'in_progress', Completed: 'completed', Cancelled: 'cancelled' };

/** Capacity check: everyone booked on the same experience at the same start time. */
async function assertCapacity(name, date, time, pax, exceptId = null) {
  const exp = (await db.query('SELECT capacity FROM experiences WHERE LOWER(name) = LOWER($1) LIMIT 1', [name])).rows[0];
  if (!exp) return;
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(number_of_participants), 0)::int AS booked FROM experience_bookings
      WHERE LOWER(experience_name) = LOWER($1) AND experience_date = $2 AND experience_time = $3 AND status <> 'cancelled' AND ($4::int IS NULL OR id <> $4)`,
    [name, date, time, exceptId],
  );
  const left = exp.capacity - rows[0].booked;
  if (pax > left) throw httpError(409, left > 0 ? `Only ${left} place${left === 1 ? '' : 's'} left for ${name} at that time` : `${name} is full at that time`);
}

mapped({
  path: '/experiences/bookings',
  table: 'experience_bookings',
  select: `SELECT t.*, COALESCE(t.guest_name, u.full_name) AS display_name,
                  (t.experience_date + t.experience_time) AT TIME ZONE '${TZ.replace(/'/g, '')}' AS starts_at
             FROM experience_bookings t LEFT JOIN users u ON u.id = t.guest_id`,
  order: 't.experience_date DESC, t.experience_time',
  filter: { guestId: 't.guest_id', experience: 't.experience_name' },
  toItem: (r) => ({
    id: r.id,
    number: r.booking_number,
    startsAt: isoTime(r.starts_at),
    experience: r.experience_name,
    guestId: r.guest_id,
    guestName: r.display_name || '',
    pax: r.number_of_participants,
    status: title(r.status),
    total: r.total_price === null ? 0 : Number(r.total_price),
    createdAt: isoTime(r.created_at),
  }),
  async create(req, b) {
    if (!b.startsAt || !b.experience) throw httpError(400, 'startsAt and experience are required');
    const pax = Math.max(1, Number(b.pax) || 1);
    const guest = await findGuest(null, b.guestId);
    const when = (await db.query(`SELECT ($1::timestamptz AT TIME ZONE $2)::date AS d, ($1::timestamptz AT TIME ZONE $2)::time AS t`, [b.startsAt, TZ])).rows[0];
    await assertCapacity(b.experience, when.d, when.t, pax);
    const exp = (await db.query('SELECT id, price, category FROM experiences WHERE LOWER(name) = LOWER($1) LIMIT 1', [b.experience])).rows[0];
    const total = b.total !== undefined && b.total !== '' ? Number(b.total) : exp ? Number(exp.price) * pax : 0;
    const { rows } = await db.query(
      `WITH n AS (SELECT nextval(pg_get_serial_sequence('experience_bookings', 'id')) AS id)
       INSERT INTO experience_bookings (id, booking_number, guest_id, guest_name, booking_id, experience_id, experience_name, experience_type,
                                        experience_date, experience_time, number_of_participants, price_per_person, total_price, status, confirmed_at)
       SELECT n.id, 'EXP-' || n.id, $1, $2,
              (SELECT id FROM bookings WHERE user_id = $1 AND status IN ('checked_in', 'confirmed') ORDER BY check_in_date DESC LIMIT 1),
              $3, $4, $5, $6, $7, $8, $9, $10, $11::text::experience_status, CASE WHEN $11::text = 'confirmed' THEN NOW() END
         FROM n RETURNING id`,
      [guest?.id ?? null, b.guestName || guest?.name || null, exp?.id ?? null, b.experience, exp?.category ?? null, when.d, when.t, pax, exp ? Number(exp.price) : null, total, EB_STATUS_IN[b.status] || 'pending'],
    );
    const id = rows[0].id;
    if (guest && total > 0) {
      await db.query(
        `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount, source_type, source_id, created_by)
         SELECT $1, booking_id, $2, 'Experiences', $3, 'experience_booking', id, $4 FROM experience_bookings WHERE id = $5`,
        [guest.id, `${b.experience} · ${pax} guest${pax > 1 ? 's' : ''}`, total, req.user.id, id],
      );
    }
    return id;
  },
  async update(req, id, b, before) {
    if (b.status && !EB_STATUS_IN[b.status]) throw httpError(400, `Unknown status "${b.status}"`);
    const changes = { status: EB_STATUS_IN[b.status], number_of_participants: b.pax === undefined ? undefined : Number(b.pax), total_price: b.total };
    if (b.startsAt || b.pax !== undefined) {
      const when = (await db.query(`SELECT ($1::timestamptz AT TIME ZONE $2)::date AS d, ($1::timestamptz AT TIME ZONE $2)::time AS t`, [b.startsAt || before.startsAt, TZ])).rows[0];
      await assertCapacity(b.experience || before.experience, when.d, when.t, Number(b.pax ?? before.pax), Number(id));
      Object.assign(changes, { experience_date: when.d, experience_time: when.t });
    }
    await patchRow('experience_bookings', id, changes);
    // A cancelled booking comes off the guest's folio.
    if (b.status === 'Cancelled') await db.query("DELETE FROM folio_charges WHERE source_type = 'experience_booking' AND source_id = $1", [id]);
  },
});

// Catalogue at /experiences — mounted after /experiences/bookings so those routes win.
router.use(
  '/experiences',
  crud({
    table: 'experiences',
    fields: { img: 'img', category: 'category', name: 'name', description: 'description', duration: 'duration', capacity: 'capacity', price: 'price', active: 'active' },
    types: { price: 'number', capacity: 'number' },
    required: ['name'],
    order: 'id',
  }),
);

module.exports = { router };

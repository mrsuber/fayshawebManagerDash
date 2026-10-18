/**
 * Guest 360: profile, stay actions, timeline, itinerary, notes, folio and messages.
 */

const express = require('express');
const { db, ah, httpError, isoDate, isoTime, emit, addTimeline, notify, tx, getSetting } = require('./lib');
const { listGuests, guestRow, fullGuest } = require('./guestData');
const { conversations, messagesFor, sendStaffMessage } = require('./conversations');

const router = express.Router();

/** Wall-clock date/time columns are in the property's time zone. */
const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';

router.get(
  '/',
  ah(async (req, res) => res.json(await listGuests({ status: req.query.status, q: req.query.q }))),
);

router.get(
  '/:id',
  ah(async (req, res) => res.json(await fullGuest(await guestRow(req.params.id)))),
);

/** PATCH { tags?, preferences?, vip?, purpose?, services?, insights?, contact? } */
router.patch(
  '/:id',
  ah(async (req, res) => {
    const row = await guestRow(req.params.id);
    const { tags, preferences, vip, purpose, services, insights, contact = {}, flags = {} } = req.body || {};
    await db.query(
      `INSERT INTO guest_profiles (user_id, vip, tags, preferences, services, insights, purpose, country, language, time_zone, parking)
       VALUES ($1, COALESCE($2::boolean, false), COALESCE($3::text[], '{}'), COALESCE($4::jsonb, '[]'), COALESCE($5::jsonb, '[]'), COALESCE($6::jsonb, '[]'),
               $7::varchar, $8::varchar, $9::varchar, $10::varchar, COALESCE($11::boolean, false))
       ON CONFLICT (user_id) DO UPDATE SET
         vip = COALESCE($2::boolean, guest_profiles.vip),
         tags = COALESCE($3::text[], guest_profiles.tags),
         preferences = COALESCE($4::jsonb, guest_profiles.preferences),
         services = COALESCE($5::jsonb, guest_profiles.services),
         insights = COALESCE($6::jsonb, guest_profiles.insights),
         purpose = COALESCE($7::varchar, guest_profiles.purpose),
         country = COALESCE($8::varchar, guest_profiles.country),
         language = COALESCE($9::varchar, guest_profiles.language),
         time_zone = COALESCE($10::varchar, guest_profiles.time_zone),
         parking = COALESCE($11::boolean, guest_profiles.parking)`,
      [
        row.id,
        vip === undefined ? null : Boolean(vip),
        Array.isArray(tags) ? tags : null,
        Array.isArray(preferences) ? JSON.stringify(preferences) : null,
        Array.isArray(services) ? JSON.stringify(services) : null,
        Array.isArray(insights) ? JSON.stringify(insights) : null,
        purpose ?? null,
        contact.country ?? null,
        contact.language ?? null,
        contact.timeZone ?? null,
        flags.parking === undefined ? null : Boolean(flags.parking),
      ],
    );
    if (contact.phone !== undefined) await db.query('UPDATE users SET phone = $1 WHERE id = $2', [contact.phone, row.id]);
    if (preferences) await addTimeline(null, row.id, 'Preferences updated', 'Profile', { performedBy: req.user.id });
    if (vip !== undefined && Boolean(vip) !== Boolean(row.vip)) await addTimeline(null, row.id, vip ? 'Marked as VIP' : 'VIP status removed', 'Profile', { performedBy: req.user.id });
    res.json(await fullGuest(await guestRow(row.id)));
  }),
);

/** Check-in / check-out act on the guest's current booking. */
async function moveGuest(req, res, kind) {
  const row = await guestRow(req.params.id);
  if (!row.booking_id) throw httpError(400, 'This guest has no booking');
  if (kind === 'in') {
    if (!['confirmed', 'pending'].includes(row.booking_status)) throw httpError(409, `Booking is ${row.booking_status.replace('_', ' ')}, it can't be checked in`);
    await db.query("UPDATE bookings SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP, confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP) WHERE id = $1", [row.booking_id]);
    await notify(req, 'Guest checked in', `${row.full_name} · ${row.unit_number}`, { link: `/guest360?guest=${row.id}` });
  } else {
    if (row.booking_status !== 'checked_in') throw httpError(409, 'Guest is not checked in');
    await tx(async (q) => {
      await q.query("UPDATE bookings SET status = 'checked_out', checked_out_at = CURRENT_TIMESTAMP WHERE id = $1", [row.booking_id]);
      // The residence needs cleaning before the next arrival.
      await q.query(
        `INSERT INTO residence_controls (apartment_id, housekeeping_status, housekeeping_note) VALUES ($1, 'Dirty', 'Departure clean')
         ON CONFLICT (apartment_id) DO UPDATE SET housekeeping_status = 'Dirty', housekeeping_note = 'Departure clean'`,
        [row.apartment_id],
      );
    });
    emit(req, 'housekeeping:updated', { id: row.apartment_id, status: 'Dirty', note: 'Departure clean' });
    await notify(req, 'Guest checked out', `${row.full_name} · ${row.unit_number}`, { link: '/housekeeping' });
  }
  res.json(await fullGuest(await guestRow(row.id)));
}

router.post('/:id/check-in', ah((req, res) => moveGuest(req, res, 'in')));
router.post('/:id/check-out', ah((req, res) => moveGuest(req, res, 'out')));

/**
 * Timeline: recorded activities plus events derived from the source tables, so bookings,
 * payments and requests made anywhere (website, guest app, admin) show up.
 */
router.get(
  '/:id/timeline',
  ah(async (req, res) => {
    const id = req.params.id;
    const { rows } = await db.query(
      `SELECT * FROM (
         SELECT 'a' || id AS id, activity_timestamp AS at, title, COALESCE(category, 'Activity') AS category FROM guest_activities WHERE guest_id = $1
         UNION ALL
         SELECT 'bc' || b.id, b.created_at, 'Reservation created – ' || a.unit_number, 'Reservation' FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.user_id = $1
         UNION ALL
         SELECT 'bk' || b.id, b.confirmed_at, 'Reservation confirmed – ' || a.unit_number, 'Reservation' FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.user_id = $1 AND b.confirmed_at IS NOT NULL
         UNION ALL
         SELECT 'bi' || b.id, b.checked_in_at, 'Checked in · ' || a.unit_number, 'Arrival' FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.user_id = $1 AND b.checked_in_at IS NOT NULL
         UNION ALL
         SELECT 'bo' || b.id, b.checked_out_at, 'Checked out · ' || a.unit_number, 'Departure' FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.user_id = $1 AND b.checked_out_at IS NOT NULL
         UNION ALL
         SELECT 'bx' || b.id, b.cancelled_at, 'Reservation cancelled – ' || a.unit_number, 'Reservation' FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.user_id = $1 AND b.cancelled_at IS NOT NULL
         UNION ALL
         SELECT 'p' || p.id, COALESCE(p.paid_at, p.created_at), 'Payment received – ' || p.amount || ' ' || p.currency || ' (' || p.payment_method || ')', 'Billing'
           FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.user_id = $1 AND p.status = 'completed'
         UNION ALL
         SELECT 'w' || id, created_at, 'Booked – ' || activity_name, 'Wellness' FROM wellness_bookings WHERE user_id = $1
         UNION ALL
         SELECT 'd' || id, created_at, 'Table booked – ' || restaurant_name || ' ' || to_char(reservation_time, 'HH24:MI'), 'Dining' FROM dining_reservations WHERE guest_id = $1
         UNION ALL
         SELECT 'o' || id, created_at, 'Order placed – ' || items, 'Dining' FROM dining_orders WHERE guest_id = $1
         UNION ALL
         SELECT 'e' || id, created_at, 'Booked – ' || experience_name, 'Experience' FROM experience_bookings WHERE guest_id = $1
         UNION ALL
         SELECT 't' || id, created_at, 'Transfer booked – ' || COALESCE(kind, 'Transfer'), 'Transportation' FROM transfers WHERE guest_id = $1
         UNION ALL
         SELECT 'i' || id, created_at, 'Booked – ' || title, INITCAP(type) FROM guest_itinerary WHERE guest_id = $1
         UNION ALL
         SELECT 'r' || id, created_at, 'Request created – ' || title, 'Service Request' FROM service_requests WHERE guest_id = $1
         UNION ALL
         SELECT 'n' || id, created_at, 'Staff note added', 'Note' FROM guest_notes WHERE guest_id = $1 AND deleted_at IS NULL
         UNION ALL
         SELECT 'm' || id, created_at,
                CASE WHEN sender_type = 'user' THEN 'Message received' ELSE 'Message sent via ' || CASE channel WHEN 'in_app' THEN 'app' ELSE channel END END,
                'Communication'
           FROM concierge_messages WHERE user_id = $1 AND is_internal = false AND sender_type <> 'system'
       ) t
       WHERE at IS NOT NULL
       ORDER BY at DESC
       LIMIT 300`,
      [id],
    );
    res.json(rows.map((r) => ({ id: r.id, guestId: Number(id), at: isoTime(r.at), title: r.title, category: r.category })));
  }),
);

router.get(
  '/:id/stays',
  ah(async (req, res) => {
    const row = await guestRow(req.params.id);
    const { rows } = await db.query(
      `SELECT b.*, a.unit_number FROM bookings b JOIN apartments a ON a.id = b.apartment_id
        WHERE b.user_id = $1 AND b.status <> 'cancelled' ORDER BY b.check_in_date DESC`,
      [row.id],
    );
    res.json(
      rows.map((b) => ({
        id: b.id,
        guestId: row.id,
        number: b.booking_number,
        residence: b.unit_number,
        checkIn: isoDate(b.check_in_date),
        checkOut: isoDate(b.check_out_date),
        nights: b.number_of_nights,
        purpose: row.purpose || 'Leisure',
        satisfaction: b.id === row.booking_id && row.satisfaction !== null ? Number(row.satisfaction) : null,
        amount: Number(b.final_price),
        status: b.status === 'checked_in' ? 'Current' : b.status === 'checked_out' || isoDate(b.check_out_date) <= isoDate(new Date()) ? 'Completed' : 'Upcoming',
      })),
    );
  }),
);

// ---- Itinerary (wellness / dining / experience / transport across their own tables) ----

const STATUS_OUT = {
  upcoming: 'Confirmed',
  in_progress: 'Confirmed',
  confirmed: 'Confirmed',
  seated: 'Confirmed',
  scheduled: 'Confirmed',
  assigned: 'Confirmed',
  'en route': 'Confirmed',
  pending: 'Pending',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Cancelled',
};
const outStatus = (s) => STATUS_OUT[String(s || '').toLowerCase()] || s;

async function itinerary(id) {
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT 'it-' || id AS id, type, title, starts_at, ends_at, guests, status, notes FROM guest_itinerary WHERE guest_id = $1
       UNION ALL
       SELECT 'wb-' || id, 'wellness', activity_name,
              (booking_date + start_time) AT TIME ZONE $2, (booking_date + end_time) AT TIME ZONE $2, 1, status, special_requests
         FROM wellness_bookings WHERE user_id = $1
       UNION ALL
       SELECT 'dr-' || id, 'dining', restaurant_name,
              (reservation_date + reservation_time) AT TIME ZONE $2, (reservation_date + reservation_time + INTERVAL '2 hours') AT TIME ZONE $2,
              number_of_guests, status::text, special_requests
         FROM dining_reservations WHERE guest_id = $1
       UNION ALL
       SELECT 'eb-' || id, 'experience', experience_name,
              (experience_date + experience_time) AT TIME ZONE $2,
              (experience_date + experience_time + make_interval(mins => COALESCE(duration_minutes, 120))) AT TIME ZONE $2,
              number_of_participants, status::text, special_requirements
         FROM experience_bookings WHERE guest_id = $1
       UNION ALL
       SELECT 'tr-' || id, 'transport', COALESCE(kind, 'Transfer') || COALESCE(' – ' || to_location, ''),
              (date + COALESCE(NULLIF(time, ''), '00:00')::time) AT TIME ZONE $2,
              (date + COALESCE(NULLIF(time, ''), '00:00')::time + INTERVAL '45 minutes') AT TIME ZONE $2,
              1, status, NULL
         FROM transfers WHERE guest_id = $1
     ) t ORDER BY starts_at`,
    [id, TZ],
  );
  return rows.map((r) => ({
      id: r.id,
      guestId: Number(id),
      type: r.type,
      title: r.title,
      startsAt: isoTime(r.starts_at),
      endsAt: isoTime(r.ends_at),
      guests: r.guests,
      status: outStatus(r.status),
      notes: r.notes || '',
    }));
}

router.get(
  '/:id/bookings',
  ah(async (req, res) => res.json(await itinerary(req.params.id))),
);

/** POST { type, title, startsAt, endsAt, guests, notes } — stored where that department works on it. */
router.post(
  '/:id/bookings',
  ah(async (req, res) => {
    const guest = await guestRow(req.params.id);
    const { type, title, startsAt, endsAt, guests = 1, notes = '' } = req.body || {};
    if (!['wellness', 'dining', 'experience', 'transport'].includes(type)) throw httpError(400, 'type must be wellness, dining, experience or transport');
    if (!title || !startsAt) throw httpError(400, 'title and startsAt are required');
    const pax = Math.max(1, Number(guests) || 1);
    let newId;
    if (type === 'dining') {
      const { rows } = await db.query(
        `WITH n AS (SELECT nextval(pg_get_serial_sequence('dining_reservations', 'id')) AS id)
         INSERT INTO dining_reservations (id, reservation_number, guest_id, guest_name, booking_id, restaurant_name, reservation_date, reservation_time, number_of_guests, special_requests, status, source, confirmed_at)
         SELECT n.id, 'DIN-' || n.id, $1, (SELECT full_name FROM users WHERE id = $1), $7, $2,
                ($3::timestamptz AT TIME ZONE $4)::date, ($3::timestamptz AT TIME ZONE $4)::time, $5::int, $6, 'confirmed', 'Reservation', NOW()
           FROM n RETURNING id`,
        [guest.id, title, startsAt, TZ, pax, notes, guest.booking_id],
      );
      newId = `dr-${rows[0].id}`;
    } else if (type === 'experience') {
      const { rows } = await db.query(
        `WITH n AS (SELECT nextval(pg_get_serial_sequence('experience_bookings', 'id')) AS id),
              x AS (SELECT id, price FROM experiences WHERE LOWER(name) = LOWER($2) LIMIT 1)
         INSERT INTO experience_bookings (id, booking_number, guest_id, guest_name, booking_id, experience_id, experience_name, experience_date, experience_time,
                                          duration_minutes, number_of_participants, total_price, special_requirements, status, confirmed_at)
         SELECT n.id, 'EXP-' || n.id, $1, (SELECT full_name FROM users WHERE id = $1), $7, (SELECT id FROM x), $2,
                ($3::timestamptz AT TIME ZONE $4)::date, ($3::timestamptz AT TIME ZONE $4)::time,
                CASE WHEN $8::timestamptz IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM ($8::timestamptz - $3::timestamptz))::int / 60 END,
                $5::int, (SELECT price FROM x) * $5::int, $6, 'confirmed', NOW()
           FROM n RETURNING id`,
        [guest.id, title, startsAt, TZ, pax, notes, guest.booking_id, endsAt || null],
      );
      newId = `eb-${rows[0].id}`;
    } else if (type === 'transport') {
      const { rows } = await db.query(
        `INSERT INTO transfers (guest_id, guest_name, kind, date, time, to_location, status)
         VALUES ($1, (SELECT full_name FROM users WHERE id = $1), $2, ($3::timestamptz AT TIME ZONE $4)::date,
                 to_char($3::timestamptz AT TIME ZONE $4, 'HH24:MI'), NULLIF($5, ''), 'Scheduled') RETURNING id`,
        [guest.id, title, startsAt, TZ, notes],
      );
      newId = `tr-${rows[0].id}`;
    } else {
      // Wellness: book the matching activity in the unified wellness system when there is one.
      const act = await db.query('SELECT id, name, duration FROM wellness_activities WHERE is_active = true AND (LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1)) LIMIT 1', [title]);
      if (act.rows.length) {
        const a = act.rows[0];
        const { rows } = await db.query(
          `INSERT INTO wellness_bookings (user_id, apartment_booking_id, activity_id, activity_name, activity_type, booking_date, start_time, end_time, total_duration, status, special_requests, created_by)
           VALUES ($1, $5, $6, $2, 'service', ($3::timestamptz AT TIME ZONE $4)::date, ($3::timestamptz AT TIME ZONE $4)::time,
                   (($3::timestamptz AT TIME ZONE $4) + make_interval(mins => $7::int))::time, $7::int, 'upcoming', $8, $9) RETURNING id`,
          [guest.id, title, startsAt, TZ, guest.booking_id, a.id, a.duration || 60, notes, req.user.id],
        );
        newId = `wb-${rows[0].id}`;
      } else {
        const { rows } = await db.query(
          `INSERT INTO guest_itinerary (guest_id, type, title, starts_at, ends_at, guests, notes, created_by)
           VALUES ($1, 'wellness', $2, $3, $4, $5, $6, $7) RETURNING id`,
          [guest.id, title, startsAt, endsAt || null, pax, notes, req.user.id],
        );
        newId = `it-${rows[0].id}`;
      }
    }
    const list = await itinerary(guest.id);
    res.status(201).json(list.find((b) => b.id === newId));
  }),
);

const STATUS_IN = {
  wb: { Confirmed: 'upcoming', Pending: 'upcoming', Completed: 'completed', Cancelled: 'cancelled' },
  dr: { Confirmed: 'confirmed', Pending: 'pending', Completed: 'completed', Cancelled: 'cancelled' },
  eb: { Confirmed: 'confirmed', Pending: 'pending', Completed: 'completed', Cancelled: 'cancelled' },
  tr: { Confirmed: 'Scheduled', Pending: 'Scheduled', Completed: 'Completed', Cancelled: 'Cancelled' },
  it: { Confirmed: 'Confirmed', Pending: 'Pending', Completed: 'Completed', Cancelled: 'Cancelled' },
};
const TABLES = {
  wb: ['wellness_bookings', 'user_id', 'booking_date', 'start_time'],
  dr: ['dining_reservations', 'guest_id', 'reservation_date', 'reservation_time'],
  eb: ['experience_bookings', 'guest_id', 'experience_date', 'experience_time'],
  tr: ['transfers', 'guest_id', 'date', 'time'],
  it: ['guest_itinerary', 'guest_id'],
};

/** PATCH { status?, startsAt? } on any itinerary item (id is "<source>-<id>"). */
router.patch(
  '/:id/bookings/:bookingId',
  ah(async (req, res) => {
    const [src, rawId] = String(req.params.bookingId).split('-');
    const meta = TABLES[src];
    if (!meta || !rawId) throw httpError(404, 'Booking not found');
    const [table, guestCol, dateCol, timeCol] = meta;
    const { status, startsAt } = req.body || {};
    const sets = [];
    const params = [rawId, req.params.id];
    if (status) {
      const mapped = STATUS_IN[src][status];
      if (!mapped) throw httpError(400, `Unknown status "${status}"`);
      params.push(mapped);
      sets.push(`status = $${params.length}`);
      if (status === 'Cancelled' && src !== 'tr' && src !== 'it') sets.push('cancelled_at = NOW()');
    }
    if (startsAt) {
      params.push(startsAt, TZ);
      const ts = `($${params.length - 1}::timestamptz AT TIME ZONE $${params.length})`;
      if (src === 'it') sets.push(`ends_at = ends_at + ($${params.length - 1}::timestamptz - starts_at)`, `starts_at = $${params.length - 1}`);
      else if (src === 'wb') sets.push(`end_time = (${ts} + make_interval(mins => total_duration))::time`, `${dateCol} = ${ts}::date`, `${timeCol} = ${ts}::time`);
      else if (src === 'tr') sets.push(`date = ${ts}::date`, `time = to_char(${ts}, 'HH24:MI')`);
      else sets.push(`${dateCol} = ${ts}::date`, `${timeCol} = ${ts}::time`);
    }
    if (!sets.length) throw httpError(400, 'Nothing to change');
    const { rows } = await db.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $1 AND ${guestCol} = $2 RETURNING id`, params);
    if (!rows.length) throw httpError(404, 'Booking not found');
    const item = (await itinerary(req.params.id)).find((b) => b.id === req.params.bookingId);
    if (status) await addTimeline(null, Number(req.params.id), `${status} – ${item.title}`, item.type === 'transport' ? 'Transportation' : item.type.charAt(0).toUpperCase() + item.type.slice(1), { performedBy: req.user.id });
    else await addTimeline(null, Number(req.params.id), `Rescheduled – ${item.title}`, 'Booking', { performedBy: req.user.id });
    res.json(item);
  }),
);

// ---- Notes ----

router.get(
  '/:id/notes',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT n.id, n.guest_id, n.note, n.created_at, COALESCE(u.full_name, n.author_name, 'Staff') AS author
         FROM guest_notes n LEFT JOIN users u ON u.id = n.created_by
        WHERE n.guest_id = $1 AND n.deleted_at IS NULL ORDER BY n.created_at DESC`,
      [req.params.id],
    );
    res.json(rows.map((r) => ({ id: r.id, guestId: r.guest_id, body: r.note, author: r.author, createdAt: isoTime(r.created_at) })));
  }),
);

router.post(
  '/:id/notes',
  ah(async (req, res) => {
    const body = String(req.body?.body || '').trim();
    if (!body) throw httpError(400, 'Note body is required');
    const guest = await guestRow(req.params.id);
    const { rows } = await db.query(
      'INSERT INTO guest_notes (guest_id, note, created_by, author_name, booking_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [guest.id, body, req.user.id, req.user.fullName, guest.booking_id],
    );
    res.status(201).json({ id: rows[0].id, guestId: guest.id, body, author: req.user.fullName, createdAt: isoTime(rows[0].created_at) });
  }),
);

// ---- Folio ----

const METHOD_LABEL = {
  stripe: 'Card (Stripe)',
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money',
  card_terminal: 'Card terminal',
  room_transfer: 'Room charge transfer',
};
const METHOD_IN = { 'Card terminal': 'card_terminal', Cash: 'cash', 'Bank transfer': 'bank_transfer', 'Mobile money': 'mobile_money', 'Room charge transfer': 'room_transfer' };

async function folioOf(guest) {
  const property = await getSetting('property');
  const currency = String(property.currency || 'XAF').slice(0, 3).toLowerCase();
  if (!guest.booking_id) return { charges: [], payments: [], total: 0, paid: 0, balance: 0, currency };
  const booking = (await db.query('SELECT * FROM bookings WHERE id = $1', [guest.booking_id])).rows[0];
  const charges = [
    {
      id: `b${booking.id}`,
      guestId: guest.id,
      date: isoTime(booking.created_at),
      description: `${guest.unit_number} · ${booking.number_of_nights} night${booking.number_of_nights === 1 ? '' : 's'} × ${Number(booking.price_per_night)}`,
      category: 'Accommodation',
      amount: Number(booking.final_price),
    },
  ];
  const extra = await db.query(
    'SELECT * FROM folio_charges WHERE guest_id = $1 AND (booking_id = $2 OR booking_id IS NULL) ORDER BY created_at DESC',
    [guest.id, booking.id],
  );
  charges.push(...extra.rows.map((c) => ({ id: c.id, guestId: guest.id, date: isoTime(c.created_at), description: c.description, category: c.category, amount: Number(c.amount) })));
  const pay = await db.query(
    `SELECT * FROM payments WHERE booking_id = $1 AND status IN ('completed', 'refunded') ORDER BY COALESCE(paid_at, created_at) DESC`,
    [booking.id],
  );
  const payments = pay.rows.map((p) => ({
    id: p.id,
    guestId: guest.id,
    date: isoTime(p.paid_at || p.created_at),
    method: METHOD_LABEL[p.payment_method] || p.payment_method,
    amount: Number(p.amount) - Number(p.refund_amount || 0),
  }));
  charges.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const total = charges.reduce((s, c) => s + c.amount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { bookingId: booking.id, charges, payments, total, paid, balance: total - paid, currency };
}

router.get(
  '/:id/folio',
  ah(async (req, res) => res.json(await folioOf(await guestRow(req.params.id)))),
);

/** POST { amount, method } — payment taken by staff at the desk (card payments go through Stripe). */
router.post(
  '/:id/payments',
  ah(async (req, res) => {
    const guest = await guestRow(req.params.id);
    if (!guest.booking_id) throw httpError(400, 'This guest has no booking to pay against');
    const amount = Number(req.body?.amount);
    if (!(amount > 0)) throw httpError(400, 'Amount must be greater than 0');
    const method = METHOD_IN[req.body?.method] || 'cash';
    const property = await getSetting('property');
    const { rows } = await db.query(
      `INSERT INTO payments (booking_id, payment_method, amount, currency, status, paid_at, transaction_reference, payment_metadata)
       VALUES ($1, $2, $3, $4, 'completed', NOW(), $5, $6) RETURNING id, paid_at`,
      [
        guest.booking_id,
        method,
        amount,
        String(property.currency || 'XAF').slice(0, 3).toUpperCase(),
        `DESK-${Date.now()}`,
        JSON.stringify({ recordedBy: req.user.id, recordedByName: req.user.fullName, source: 'manager_dashboard' }),
      ],
    );
    await notify(req, 'Payment recorded', `${guest.full_name} · ${amount} (${req.body?.method || 'Cash'})`, { link: `/guest360?guest=${guest.id}` });
    res.status(201).json({ id: rows[0].id, guestId: guest.id, date: isoTime(rows[0].paid_at), method: METHOD_LABEL[method], amount });
  }),
);

// ---- Messages ----

router.get(
  '/:id/conversation',
  ah(async (req, res) => {
    const [conversation] = await conversations({ guestId: req.params.id });
    res.json({ conversation: conversation || null, messages: conversation ? await messagesFor(req.params.id) : [] });
  }),
);

router.post(
  '/:id/messages',
  ah(async (req, res) => res.status(201).json(await sendStaffMessage(req, req.params.id, { channel: req.body?.channel || 'in_app', body: req.body?.body }))),
);

module.exports = { router, folioOf };

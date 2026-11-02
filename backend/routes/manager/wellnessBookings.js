/**
 * FAY OS → Wellness → Bookings: every wellness booking with its code; requests to confirm; check-in at arrival.
 *
 *   GET  /wellness/bookings?status=requested|upcoming|today|all&date=YYYY-MM-DD
 *   GET  /wellness/bookings/code/:code      find a booking by the code the guest shows
 *   POST /wellness/bookings/:id/confirm     { date?, start? }  confirm a request (optionally at another time)
 *   POST /wellness/bookings/:id/decline     { reason }
 *   POST /wellness/bookings/:id/check-in    the guest arrived (also POST /wellness/check-in { code })
 *   POST /wellness/bookings/:id/complete
 *   POST /wellness/bookings/:id/no-show
 *
 * A time the team opened in Availability is confirmed when the guest books; any other time arrives here as a request.
 */
const express = require('express');
const { db, ah, httpError, isoDate, isoTime, emit, tx, addTimeline } = require('./lib');
const { cleanCode, confirmBooking, dropCharge } = require('../../services/wellnessBooking');
const { endOf, hhmm } = require('../../services/wellnessSlots');
const { notifyGuest } = require('../../services/guestPush');
const { resolve } = require('../../services/notify');

const router = express.Router();
const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';

const SELECT = `
  SELECT b.*, u.full_name AS guest_name, u.phone AS guest_phone, a.category, a.location, a.floor, a.access_mode, a.base_price,
         a.currency, ap.unit_number AS residence, c.full_name AS confirmed_by_name, k.full_name AS checked_in_by_name
    FROM wellness_bookings b
    JOIN users u ON u.id = b.user_id
    LEFT JOIN wellness_activities a ON a.id = b.activity_id
    LEFT JOIN bookings st ON st.id = b.apartment_booking_id
    LEFT JOIN apartments ap ON ap.id = st.apartment_id
    LEFT JOIN users c ON c.id = b.confirmed_by
    LEFT JOIN users k ON k.id = b.checked_in_by`;

const toItem = (r) => ({
  id: r.id,
  code: r.booking_code,
  group: r.group_ref,
  status: r.status,
  activity: r.activity_name,
  activityId: r.activity_id,
  type: r.activity_type,
  category: r.category,
  date: isoDate(r.booking_date),
  start: hhmm(r.start_time),
  end: hhmm(r.end_time),
  minutes: r.total_duration,
  people: r.people,
  place: [r.location, r.floor ? `floor ${r.floor}` : null].filter(Boolean).join(' · ') || r.room || null,
  price: Number(r.base_price) || 0,
  currency: r.currency || 'XAF',
  pin: r.activity_pin,
  guestId: r.user_id,
  guest: r.guest_name,
  guestPhone: r.guest_phone,
  residence: r.residence,
  requests: r.special_requests,
  notes: r.notes,
  declineReason: r.decline_reason,
  createdAt: isoTime(r.created_at),
  confirmedAt: isoTime(r.confirmed_at),
  confirmedBy: r.confirmed_by_name,
  checkedInAt: isoTime(r.checked_in_at),
  checkedInBy: r.checked_in_by_name,
});

async function one(q, id) {
  const { rows } = await q.query(`${SELECT} WHERE b.id = $1`, [id]);
  if (!rows.length) throw httpError(404, 'Booking not found');
  return rows[0];
}

const changed = (req, item) => emit(req, 'wellness:updated', { ids: [item.id] });

router.get(
  '/wellness/bookings',
  ah(async (req, res) => {
    const status = String(req.query.status || 'open');
    const where = [];
    const params = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ''))) {
      params.push(req.query.date);
      where.push(`b.booking_date = $${params.length}`);
    }
    if (status === 'requested') where.push(`b.status = 'requested'`);
    else if (status === 'today') {
      params.push(TZ);
      where.push(`b.booking_date = (NOW() AT TIME ZONE $${params.length})::date AND b.status NOT IN ('cancelled', 'declined')`);
    } else if (status === 'open') {
      params.push(TZ);
      where.push(`b.status IN ('requested', 'upcoming', 'in_progress') AND b.booking_date >= (NOW() AT TIME ZONE $${params.length})::date - 1`);
    } else if (status !== 'all') {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }
    const { rows } = await db.query(
      `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY (b.status = 'requested') DESC, b.booking_date ${status === 'all' ? 'DESC' : 'ASC'}, b.start_time LIMIT 300`,
      params,
    );
    const counts = (await db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'requested')::int AS requested,
              COUNT(*) FILTER (WHERE booking_date = (NOW() AT TIME ZONE $1)::date AND status IN ('upcoming', 'in_progress', 'completed'))::int AS today,
              COUNT(*) FILTER (WHERE booking_date = (NOW() AT TIME ZONE $1)::date AND checked_in_at IS NOT NULL)::int AS arrived
         FROM wellness_bookings`,
      [TZ],
    )).rows[0];
    res.json({ items: rows.map(toItem), counts });
  }),
);

router.get(
  '/wellness/bookings/code/:code',
  ah(async (req, res) => {
    const { rows } = await db.query(`${SELECT} WHERE b.booking_code = $1`, [cleanCode(req.params.code)]);
    if (!rows.length) throw httpError(404, 'No booking with this code');
    res.json(toItem(rows[0]));
  }),
);

router.post(
  '/wellness/bookings/:id/confirm',
  ah(async (req, res) => {
    const item = await tx(async (q) => {
      const b = (await q.query('SELECT * FROM wellness_bookings WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!b) throw httpError(404, 'Booking not found');
      if (b.status !== 'requested') throw httpError(409, `This booking is already ${b.status.replace('_', ' ')}`);
      const activity = (await q.query('SELECT * FROM wellness_activities WHERE id = $1', [b.activity_id])).rows[0];
      // Confirming at another time (the guest asked for 15:00, the therapist is free at 16:00).
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || '')) ? req.body.date : null;
      const start = /^\d{2}:\d{2}$/.test(String(req.body.start || '')) ? req.body.start : null;
      if (date || start) {
        const newStart = start || hhmm(b.start_time);
        const end = endOf(newStart, b.total_duration);
        if (!end) throw httpError(400, 'That time runs past midnight');
        await q.query(
          `UPDATE wellness_bookings SET booking_date = COALESCE($2::date, booking_date), start_time = $3, end_time = $4 WHERE id = $1`,
          [b.id, date, newStart, end],
        );
        // Journey stages follow the new start.
        const shift = await q.query('SELECT id, stage_number, scheduled_start, scheduled_end FROM wellness_booking_stages WHERE booking_id = $1 ORDER BY stage_number', [b.id]);
        if (shift.rows.length) {
          const toMin = (t) => { const [h, m] = hhmm(t).split(':').map(Number); return h * 60 + m; };
          const delta = toMin(newStart) - toMin(b.start_time);
          for (const s of shift.rows) {
            const fmt = (m) => `${String(Math.floor(Math.min(m, 1439) / 60)).padStart(2, '0')}:${String(Math.min(m, 1439) % 60).padStart(2, '0')}`;
            await q.query('UPDATE wellness_booking_stages SET scheduled_start = $2, scheduled_end = $3 WHERE id = $1', [s.id, fmt(toMin(s.scheduled_start) + delta), fmt(toMin(s.scheduled_end) + delta)]);
          }
        }
      }
      const fresh = (await q.query('SELECT * FROM wellness_bookings WHERE id = $1', [b.id])).rows[0];
      await confirmBooking(q, fresh, activity, req.user.id);
      await addTimeline(q, b.user_id, `Wellness confirmed – ${b.activity_name}`, 'Wellness', { performedBy: req.user.id });
      return toItem(await one(q, b.id));
    });
    resolve(req.app, `wellness-request:${item.id}`).catch(() => {});
    notifyGuest(req.app, item.guestId, {
      title: `${item.activity} is confirmed`,
      body: `${item.date} at ${item.start}. Your code: ${item.code}${item.pin ? ` · PIN ${item.pin}` : ''}`,
      event: 'wellness:confirmed',
      data: { bookingId: item.id, screen: 'Bookings' },
    }).catch(() => {});
    changed(req, item);
    res.json(item);
  }),
);

router.post(
  '/wellness/bookings/:id/decline',
  ah(async (req, res) => {
    const reason = String(req.body.reason || '').trim().slice(0, 500) || null;
    const { rows } = await db.query(
      `UPDATE wellness_bookings SET status = 'declined', decline_reason = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'requested' RETURNING id`,
      [req.params.id, reason],
    );
    if (!rows.length) throw httpError(409, 'Only a request can be declined; cancel a confirmed booking instead');
    await dropCharge(db, rows[0].id);
    const item = toItem(await one(db, rows[0].id));
    resolve(req.app, `wellness-request:${item.id}`).catch(() => {});
    notifyGuest(req.app, item.guestId, {
      title: `${item.activity} could not be confirmed`,
      body: `${item.date} at ${item.start}${reason ? `: ${reason}` : ''}. Please choose another time or ask the concierge.`,
      event: 'wellness:declined',
      data: { bookingId: item.id, screen: 'Bookings' },
    }).catch(() => {});
    changed(req, item);
    res.json(item);
  }),
);

/** Check-in: the guest is here. Accepts a confirmed booking of today (or yesterday's late evening). */
async function checkIn(req, id) {
  const b = await one(db, id);
  if (b.status === 'requested') throw httpError(409, `${b.activity_name} is still a request: confirm it first`);
  if (['cancelled', 'declined', 'no_show'].includes(b.status)) throw httpError(409, `This booking was ${b.status.replace('_', ' ')}`);
  if (b.checked_in_at) return toItem(b);
  await db.query(
    `UPDATE wellness_bookings SET checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $2,
            status = CASE WHEN status = 'upcoming' THEN 'in_progress' ELSE status END, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [id, req.user.id],
  );
  const item = toItem(await one(db, id));
  changed(req, item);
  return item;
}

router.post('/wellness/bookings/:id/check-in', ah(async (req, res) => res.json(await checkIn(req, req.params.id))));

router.post(
  '/wellness/check-in',
  ah(async (req, res) => {
    const code = cleanCode(req.body.code);
    if (!code) throw httpError(400, 'Enter the guest’s booking code');
    const { rows } = await db.query('SELECT id FROM wellness_bookings WHERE booking_code = $1', [code]);
    if (!rows.length) throw httpError(404, `No booking with code ${code}`);
    res.json(await checkIn(req, rows[0].id));
  }),
);

for (const [action, status, from] of [['complete', 'completed', ['upcoming', 'in_progress']], ['no-show', 'no_show', ['upcoming']]]) {
  router.post(
    `/wellness/bookings/:id/${action}`,
    ah(async (req, res) => {
      const { rows } = await db.query(
        `UPDATE wellness_bookings SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = ANY($3) RETURNING id`,
        [req.params.id, status, from],
      );
      if (!rows.length) throw httpError(409, 'This booking cannot be changed that way now');
      const item = toItem(await one(db, rows[0].id));
      changed(req, item);
      res.json(item);
    }),
  );
}

module.exports = router;

/**
 * Unified Wellness Booking Routes
 * Handles ALL wellness bookings: Journeys and Services
 *
 * Replaces the old wellnessJourneys.js with unified approach
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/database');
const { authenticateToken, checkPasswordChangeRequired } = require('../middleware/auth');
const { slotsFor, hhmm, toMinutes, toTime } = require('../services/wellnessSlots');
const { newCode, confirmBooking } = require('../services/wellnessBooking');
const { staffAlert } = require('../services/notify');

const PROPERTY_TZ = process.env.PROPERTY_TZ || 'Africa/Douala';

// All routes require authentication
router.use(authenticateToken);
router.use(checkPasswordChangeRequired);

/**
 * GET /api/wellness-unified/activities
 * Get all wellness activities (journeys + services)
 */
router.get('/activities', async (req, res) => {
  try {
    const { type, category } = req.query;

    let query = `
      SELECT a.*,
        CASE
          WHEN a.has_stages THEN (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', s.id,
                'stage_number', s.stage_number,
                'name', s.name,
                'description', s.description,
                'duration', s.duration,
                'icon', s.icon,
                'image_url', s.image_url,
                'location', s.location,
                'floor', s.floor,
                'requires_pin', s.requires_pin
              ) ORDER BY s.stage_number
            )
            FROM wellness_activity_stages s
            WHERE s.activity_id = a.id
          )
          ELSE NULL
        END as stages
      FROM wellness_activities a
      WHERE a.is_active = true
    `;

    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND a.type = $${paramCount++}`;
      params.push(type);
    }

    if (category) {
      query += ` AND a.category = $${paramCount++}`;
      params.push(category);
    }

    query += ` ORDER BY a.display_order ASC, a.name ASC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      activities: result.rows
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities'
    });
  }
});

/**
 * GET /api/wellness-unified/activities/:id
 * Get single activity with stages
 */
router.get('/activities/:id', async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);

    const result = await db.query(`
      SELECT * FROM wellness_activities
      WHERE id = $1 AND is_active = true
    `, [activityId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    const activity = result.rows[0];

    if (activity.has_stages) {
      const stagesResult = await db.query(`
        SELECT * FROM wellness_activity_stages
        WHERE activity_id = $1
        ORDER BY stage_number ASC
      `, [activityId]);
      activity.stages = stagesResult.rows;
    }

    res.json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity'
    });
  }
});

/**
 * POST /api/wellness-unified/book
 * Book any wellness activity during the guest's stay, in a slot with space left.
 */
/** The guest's current or next confirmed stay, and the days wellness can be booked in it (check-in day to the night before check-out, from today). */
async function stayWindow(q, userId) {
  const { rows } = await q.query(
    `SELECT id, to_char(check_in_date, 'YYYY-MM-DD') AS check_in, to_char(check_out_date, 'YYYY-MM-DD') AS check_out,
            to_char(GREATEST(check_in_date, (NOW() AT TIME ZONE $2)::date), 'YYYY-MM-DD') AS first_day,
            to_char(check_out_date - 1, 'YYYY-MM-DD') AS last_day
       FROM bookings
      WHERE user_id = $1 AND status IN ('confirmed', 'checked_in') AND check_out_date > (NOW() AT TIME ZONE $2)::date
      ORDER BY check_in_date LIMIT 1`,
    [userId, PROPERTY_TZ],
  );
  const r = rows[0];
  if (!r) return null;
  // A one-night stay still offers its check-in day; a last day before the first means the stay ends today.
  return { bookingId: r.id, checkIn: r.check_in, checkOut: r.check_out, firstDay: r.first_day, lastDay: r.last_day < r.first_day ? r.first_day : r.last_day };
}

/**
 * POST /api/wellness-unified/book
 * One experience: { activity_id, booking_date, start_time, people?, special_requests? }
 * Several at once (Recharge: gym + trainer + pool): { booking_date, items: [{ activity_id, start_time }], people?, special_requests? }
 *
 * A time the team opened in Availability is confirmed at once; any other offered time becomes a request a manager
 * confirms in FAY OS. Each booking gets a code the guest shows on arrival.
 */
router.post('/book', async (req, res) => {
  const userId = req.user.id;
  const { booking_date, special_requests } = req.body;
  const people = Math.min(Math.max(parseInt(req.body.people, 10) || 1, 1), 10);
  const items = Array.isArray(req.body.items) && req.body.items.length
    ? req.body.items.slice(0, 8)
    : [{ activity_id: req.body.activity_id, start_time: req.body.start_time }];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(booking_date || '')) || items.some((i) => !i || !i.activity_id || !/^\d{2}:\d{2}/.test(String(i.start_time || '')))) {
    return res.status(400).json({ success: false, error: 'Choose a day and a time for each experience' });
  }

  const client = await db.pool.connect();
  const fail = async (status, error) => {
    await client.query('ROLLBACK');
    return res.status(status).json({ success: false, error, message: error });
  };
  try {
    await client.query('BEGIN');

    const stay = await stayWindow(client, userId);
    if (!stay) return fail(400, 'You need a confirmed stay to book wellness experiences');
    if (booking_date < stay.firstDay || booking_date > stay.lastDay) {
      return fail(400, `Wellness can be booked during your stay: choose a day between ${stay.firstDay} and ${stay.lastDay}.`);
    }
    const now = (await client.query(`SELECT to_char(NOW() AT TIME ZONE $1, 'YYYY-MM-DD HH24:MI') AS now`, [PROPERTY_TZ])).rows[0].now;
    const group = items.length > 1 ? `G${Date.now().toString(36).toUpperCase()}` : null;
    const created = [];

    for (const item of items) {
      const start = hhmm(item.start_time);
      // Locking the activity row serialises bookings for it, so two guests cannot take the last place.
      const activity = (await client.query('SELECT * FROM wellness_activities WHERE id = $1 AND is_active = true FOR UPDATE', [item.activity_id])).rows[0];
      if (!activity) return fail(404, 'This experience is no longer offered');
      const name = activity.display_name || activity.name;

      if (`${booking_date} ${start}` <= now) return fail(400, `${name}: please choose a time in the future`);
      const ahead = Number(activity.book_ahead_hours) || 0;
      if (ahead > 0) {
        const soon = (await client.query(`SELECT to_char(NOW() AT TIME ZONE $1 + make_interval(hours => $2), 'YYYY-MM-DD HH24:MI') AS t`, [PROPERTY_TZ, ahead])).rows[0].t;
        if (`${booking_date} ${start}` < soon) return fail(400, `${name} needs ${ahead} hour${ahead > 1 ? 's' : ''} notice. Please choose a later time.`);
      }

      const slot = (await slotsFor(client, activity, booking_date)).find((s) => s.start_time === start);
      if (!slot) return fail(400, `${name}: that time is not offered. Please choose one of the times shown.`);
      if (!slot.open) return fail(409, `${name}: that time is closed. Please choose another time.`);
      if (slot.remaining < people) return fail(409, slot.remaining ? `${name}: only ${slot.remaining} place${slot.remaining > 1 ? 's' : ''} left at that time.` : `${name}: that time is fully booked. Please choose another time.`);
      const end = slot.end_time;

      // The guest cannot be in two places at once (this includes the other experiences in this request).
      const clash = await client.query(
        `SELECT activity_name FROM wellness_bookings
          WHERE user_id = $1 AND booking_date = $2 AND status IN ('requested', 'upcoming', 'in_progress')
            AND start_time < $4 AND end_time > $3 LIMIT 1`,
        [userId, booking_date, start, end],
      );
      if (clash.rows[0]) return fail(409, `${name} overlaps ${clash.rows[0].activity_name} at that time. Please choose another time.`);

      const code = await newCode(client);
      let booking = (await client.query(
        `INSERT INTO wellness_bookings (
           apartment_booking_id, user_id, activity_id, activity_name, activity_type, booking_date, start_time, end_time,
           total_duration, special_requests, amount_paid, status, booking_code, group_ref, people, room
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 'requested', $11, $12, $13, $14)
         RETURNING *`,
        [stay.bookingId, userId, activity.id, name, activity.type, booking_date, start, end, activity.duration,
          special_requests || null, code, group, people, activity.location ? String(activity.location).slice(0, 100) : null],
      )).rows[0];

      if (activity.has_stages) {
        const stages = await client.query('SELECT * FROM wellness_activity_stages WHERE activity_id = $1 ORDER BY stage_number', [activity.id]);
        let at = toMinutes(start);
        for (const stage of stages.rows) {
          await client.query(
            `INSERT INTO wellness_booking_stages (booking_id, stage_id, stage_number, stage_name, scheduled_start, scheduled_end)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [booking.id, stage.id, stage.stage_number, stage.name, toTime(at), toTime(Math.min(at + stage.duration, 24 * 60 - 1))],
          );
          at += stage.duration;
        }
      }

      // A time the team opened is confirmed now; otherwise it waits for a manager.
      if (slot.slot_id) booking = await confirmBooking(client, booking, activity, null);
      created.push({ ...booking, instant: !!slot.slot_id });
    }

    await client.query('COMMIT');

    const requests = created.filter((b) => b.status === 'requested');
    if (requests.length) {
      const who = (await db.query('SELECT full_name FROM users WHERE id = $1', [userId])).rows[0];
      staffAlert(req.app, {
        title: `Wellness request · ${who?.full_name || 'Guest'}`,
        body: `${requests.map((b) => `${b.activity_name} ${hhmm(b.start_time)}`).join(', ')} on ${booking_date}: confirm or decline`,
        link: `/wellness?view=bookings&id=${requests[0].id}`,
        level: 'action',
        category: 'wellness',
        dedupeKey: `wellness-request:${requests[0].id}`,
      }).catch(() => {});
    }
    const io = req.app.get('io');
    if (io) io.to('staff').emit('wellness:updated', { ids: created.map((b) => b.id) });

    const pending = requests.length;
    res.status(201).json({
      success: true,
      message: pending === created.length
        ? 'Request sent. The team will confirm it shortly; you will be notified.'
        : pending
          ? 'Booked. Some times need the team’s confirmation; you will be notified.'
          : 'Booked and confirmed.',
      booking: created[0],
      bookings: created,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Book error:', error);
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/wellness-unified/stay
 * The days wellness can be booked: the guest's current or next stay, from today.
 */
router.get('/stay', async (req, res) => {
  try {
    res.json({ success: true, stay: await stayWindow(db, req.user.id) });
  } catch (error) {
    console.error('Stay window error:', error);
    res.status(500).json({ success: false, error: 'Failed to load your stay' });
  }
});

/**
 * GET /api/wellness-unified/activities/:id/availability?date=YYYY-MM-DD&days=7
 * Bookable times per day, with places left and the guest's own clashes.
 */
router.get('/activities/:id/availability', async (req, res) => {
  try {
    const activityResult = await db.query('SELECT * FROM wellness_activities WHERE id = $1 AND is_active = true', [req.params.id]);
    const activity = activityResult.rows[0];
    if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });

    // By default, the days of the guest's stay (that is all they can book); ?date=&days= asks for other days.
    const stay = await stayWindow(db, req.user.id);
    const asked = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : null;
    if (!asked && !stay) return res.json({ success: true, activity_id: activity.id, activity_name: activity.name, stay: null, availability: [] });
    const first = asked || stay.firstDay;
    const last = asked ? null : stay.lastDay;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 31);
    const dates = await db.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day FROM generate_series($1::date, LEAST(COALESCE($2::date, $1::date + ($3::int - 1)), $1::date + 30), '1 day') d`,
      [first, last, days]
    );
    const mine = await db.query(
      `SELECT activity_name, to_char(booking_date, 'YYYY-MM-DD') AS day, start_time, end_time FROM wellness_bookings
        WHERE user_id = $1 AND status IN ('requested', 'upcoming', 'in_progress') AND booking_date BETWEEN $2::date AND $3::date`,
      [req.user.id, dates.rows[0].day, dates.rows[dates.rows.length - 1].day]
    );

    const now = (await db.query(`SELECT to_char(NOW() AT TIME ZONE $1, 'YYYY-MM-DD HH24:MI') AS now`, [PROPERTY_TZ])).rows[0].now;
    const availability = [];
    for (const { day } of dates.rows) {
      for (const slot of await slotsFor(db, activity, day)) {
        const past = `${day} ${slot.start_time}` <= now;
        const clash = mine.rows.find((b) => b.day === day && hhmm(b.start_time) < slot.end_time && hhmm(b.end_time) > slot.start_time);
        availability.push({
          date: day,
          start_time: slot.start_time,
          end_time: slot.end_time,
          label: slot.label,
          remaining: slot.remaining,
          capacity: slot.capacity,
          is_available: slot.is_available && !clash && !past,
          // Opened by the team in Availability: confirmed at once. Otherwise the booking is a request to confirm.
          instant: !!slot.slot_id,
          conflicting_booking: clash ? clash.activity_name : null,
          duration: activity.duration,
        });
      }
    }

    res.json({ success: true, activity_id: activity.id, activity_name: activity.name, stay, availability });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch availability' });
  }
});

/**
 * GET /api/wellness-unified/my-bookings
 * Get user's bookings
 */
router.get('/my-bookings', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(`
      SELECT
        b.*,
        a.icon as activity_icon,
        a.category as activity_category,
        CASE
          WHEN b.activity_type = 'journey' THEN (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', bs.id,
                'stage_number', bs.stage_number,
                'stage_name', bs.stage_name,
                'scheduled_start', bs.scheduled_start,
                'scheduled_end', bs.scheduled_end,
                'status', bs.status
              ) ORDER BY bs.stage_number
            )
            FROM wellness_booking_stages bs
            WHERE bs.booking_id = b.id
          )
          ELSE NULL
        END as stages
      FROM wellness_bookings b
      LEFT JOIN wellness_activities a ON b.activity_id = a.id
      WHERE b.user_id = $1
      ORDER BY b.booking_date DESC, b.start_time DESC
    `, [userId]);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

/**
 * PATCH /api/wellness-unified/bookings/:id/cancel
 * Cancel one of the guest's upcoming bookings.
 */
router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE wellness_bookings
          SET status = 'cancelled', cancellation_reason = $1, cancelled_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3 AND status IN ('upcoming', 'requested')
        RETURNING *`,
      [req.body.cancellation_reason || null, req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      const exists = await db.query('SELECT status FROM wellness_bookings WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!exists.rows[0]) return res.status(404).json({ success: false, error: 'Booking not found' });
      return res.status(400).json({ success: false, error: `This booking is ${exists.rows[0].status.replace('_', ' ')} and can no longer be cancelled` });
    }
    // The charge for a priced activity comes off the bill.
    await db.query(`DELETE FROM folio_charges WHERE source_type = 'wellness_booking' AND source_id = $1`, [result.rows[0].id]);
    res.json({ success: true, message: 'Booking cancelled successfully', booking: result.rows[0] });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel booking' });
  }
});

module.exports = router;

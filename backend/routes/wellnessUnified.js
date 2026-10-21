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
                'icon', s.icon
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
router.post('/book', async (req, res) => {
  const userId = req.user.id;
  const { activity_id, booking_date, start_time, special_requests } = req.body;

  if (!activity_id || !/^\d{4}-\d{2}-\d{2}$/.test(String(booking_date || '')) || !/^\d{2}:\d{2}/.test(String(start_time || ''))) {
    return res.status(400).json({ success: false, error: 'Activity, booking date (YYYY-MM-DD) and start time (HH:MM) are required' });
  }
  const start = hhmm(start_time);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Locking the activity row serialises bookings for it, so two guests cannot take the last place.
    const activityResult = await client.query('SELECT * FROM wellness_activities WHERE id = $1 AND is_active = true FOR UPDATE', [activity_id]);
    const activity = activityResult.rows[0];
    if (!activity) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    const today = await client.query(`SELECT to_char(NOW() AT TIME ZONE $1, 'YYYY-MM-DD HH24:MI') AS now`, [PROPERTY_TZ]);
    if (`${booking_date} ${start}` <= today.rows[0].now) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Please choose a time in the future' });
    }

    const stay = await client.query(
      `SELECT id FROM bookings
        WHERE user_id = $1 AND status IN ('confirmed', 'checked_in') AND check_in_date <= $2 AND check_out_date > $2
        ORDER BY check_in_date DESC LIMIT 1`,
      [userId, booking_date]
    );
    if (!stay.rows[0]) {
      const any = await client.query(
        `SELECT to_char(check_in_date, 'Mon DD, YYYY') AS check_in, to_char(check_out_date, 'Mon DD, YYYY') AS check_out
           FROM bookings WHERE user_id = $1 AND status IN ('confirmed', 'checked_in') AND check_out_date >= CURRENT_DATE
          ORDER BY check_in_date LIMIT 1`,
        [userId]
      );
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: any.rows[0]
          ? `You can book wellness activities during your stay (${any.rows[0].check_in} – ${any.rows[0].check_out}). Please choose a date in that range.`
          : 'You need a confirmed stay to book wellness activities',
      });
    }

    const slot = (await slotsFor(client, activity, booking_date)).find((s) => s.start_time === start);
    if (!slot) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'That time is not offered for this activity. Please choose one of the available times.' });
    }
    if (!slot.is_available) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: slot.open ? 'That time is fully booked. Please choose another time.' : 'That time is closed. Please choose another time.' });
    }
    const end = slot.end_time;

    const clash = await client.query(
      `SELECT activity_name FROM wellness_bookings
        WHERE user_id = $1 AND booking_date = $2 AND status IN ('upcoming', 'in_progress')
          AND start_time < $4 AND end_time > $3
        LIMIT 1`,
      [userId, booking_date, start, end]
    );
    if (clash.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: `You already have ${clash.rows[0].activity_name} at that time` });
    }

    // Journeys open with a PIN at the door.
    const pin = activity.requires_access_pin ? String(crypto.randomInt(1000, 10000)) : null;
    const qr = pin ? `FAYSHAA-WELLNESS-${activity.id}-${userId}-${Date.now()}` : null;

    const bookingResult = await client.query(
      `INSERT INTO wellness_bookings (
         apartment_booking_id, user_id, activity_id, activity_name, activity_type,
         booking_date, start_time, end_time, total_duration, activity_pin, qr_code, keys_generated_at, special_requests, amount_paid
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $10::varchar IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END, $12, 0)
       RETURNING *`,
      [stay.rows[0].id, userId, activity.id, activity.display_name || activity.name, activity.type, booking_date, start, end,
        activity.duration, pin, qr, special_requests || null]
    );
    const booking = bookingResult.rows[0];

    if (activity.has_stages) {
      const stages = await client.query('SELECT * FROM wellness_activity_stages WHERE activity_id = $1 ORDER BY stage_number', [activity.id]);
      let at = toMinutes(start);
      for (const stage of stages.rows) {
        await client.query(
          `INSERT INTO wellness_booking_stages (booking_id, stage_id, stage_number, stage_name, scheduled_start, scheduled_end)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [booking.id, stage.id, stage.stage_number, stage.name, toTime(at), toTime(Math.min(at + stage.duration, 24 * 60 - 1))]
        );
        at += stage.duration;
      }
    }

    // A priced activity is added to the guest's bill for the stay.
    if (Number(activity.base_price) > 0) {
      await client.query(
        `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount, source_type, source_id)
         VALUES ($1, $2, $3, 'Wellness', $4, 'wellness_booking', $5)`,
        [userId, stay.rows[0].id, `${activity.display_name || activity.name} — ${booking_date} ${start}`, activity.base_price, booking.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Booking created successfully', booking });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Book error:', error);
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  } finally {
    client.release();
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

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 31);
    const first = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : null;
    const dates = await db.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day FROM generate_series(COALESCE($1::date, (NOW() AT TIME ZONE $2)::date), COALESCE($1::date, (NOW() AT TIME ZONE $2)::date) + ($3::int - 1), '1 day') d`,
      [first, PROPERTY_TZ, days]
    );
    const mine = await db.query(
      `SELECT activity_name, to_char(booking_date, 'YYYY-MM-DD') AS day, start_time, end_time FROM wellness_bookings
        WHERE user_id = $1 AND status IN ('upcoming', 'in_progress') AND booking_date BETWEEN $2::date AND $3::date`,
      [req.user.id, dates.rows[0].day, dates.rows[dates.rows.length - 1].day]
    );

    const availability = [];
    for (const { day } of dates.rows) {
      for (const slot of await slotsFor(db, activity, day)) {
        const clash = mine.rows.find((b) => b.day === day && hhmm(b.start_time) < slot.end_time && hhmm(b.end_time) > slot.start_time);
        availability.push({
          date: day,
          start_time: slot.start_time,
          end_time: slot.end_time,
          label: slot.label,
          remaining: slot.remaining,
          capacity: slot.capacity,
          is_available: slot.is_available && !clash,
          conflicting_booking: clash ? clash.activity_name : null,
          duration: activity.duration,
        });
      }
    }

    res.json({ success: true, activity_id: activity.id, activity_name: activity.name, availability });
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
        WHERE id = $2 AND user_id = $3 AND status = 'upcoming'
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

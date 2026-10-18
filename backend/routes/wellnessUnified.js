/**
 * Unified Wellness Booking Routes
 * Handles ALL wellness bookings: Journeys and Services
 *
 * Replaces the old wellnessJourneys.js with unified approach
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, checkPasswordChangeRequired } = require('../middleware/auth');

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
 * Book any wellness activity
 */
router.post('/book', async (req, res) => {
  const client = await db.pool.connect();

  try {
    const userId = req.user.id;
    const { activity_id, booking_date, start_time, special_requests } = req.body;

    if (!activity_id || !booking_date || !start_time) {
      return res.status(400).json({
        success: false,
        error: 'Activity ID, booking date, and start time are required'
      });
    }

    await client.query('BEGIN');

    // Get activity
    const activityResult = await client.query(`
      SELECT * FROM wellness_activities
      WHERE id = $1 AND is_active = true
    `, [activity_id]);

    if (activityResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    const activity = activityResult.rows[0];

    // Calculate end time
    const [startHour, startMinute] = start_time.split(':');
    const endTimeDate = new Date();
    endTimeDate.setHours(parseInt(startHour), parseInt(startMinute) + activity.duration);
    const end_time = `${String(endTimeDate.getHours()).padStart(2, '0')}:${String(endTimeDate.getMinutes()).padStart(2, '0')}`;

    // Find active apartment booking
    const apartmentResult = await client.query(`
      SELECT id, check_in_date, check_out_date FROM bookings
      WHERE user_id = $1
        AND status IN ('confirmed', 'checked_in')
        AND check_in_date <= $2
        AND check_out_date > $2
      ORDER BY check_in_date DESC
      LIMIT 1
    `, [userId, booking_date]);

    if (apartmentResult.rows.length === 0) {
      // Check if user has ANY apartment booking
      const anyBookingResult = await client.query(`
        SELECT check_in_date, check_out_date, status FROM bookings
        WHERE user_id = $1
          AND status IN ('confirmed', 'checked_in')
        ORDER BY check_in_date DESC
        LIMIT 1
      `, [userId]);

      await client.query('ROLLBACK');

      if (anyBookingResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'You must have an active apartment booking to book wellness activities'
        });
      } else {
        const booking = anyBookingResult.rows[0];
        const checkIn = new Date(booking.check_in_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const checkOut = new Date(booking.check_out_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        return res.status(400).json({
          success: false,
          error: `You can only book wellness activities during your apartment stay (${checkIn} - ${checkOut}). Please select a date within this range.`
        });
      }
    }

    const apartmentBookingId = apartmentResult.rows[0].id;

    // Check conflicts
    const conflictCheck = await client.query(`
      SELECT id, activity_name FROM wellness_bookings
      WHERE user_id = $1
        AND booking_date = $2
        AND status IN ('upcoming', 'in_progress')
        AND (
          (start_time <= $3 AND end_time > $3)
          OR (start_time < $4 AND end_time >= $4)
          OR (start_time >= $3 AND end_time <= $4)
        )
    `, [userId, booking_date, start_time, end_time]);

    if (conflictCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Conflicting booking: ${conflictCheck.rows[0].activity_name}`
      });
    }

    // Generate PIN if needed (only for journeys)
    let activity_pin = null;
    let qr_code = null;

    if (activity.requires_access_pin) {
      activity_pin = Math.floor(1000 + Math.random() * 9000).toString();
      qr_code = `FAYSHAA-WELLNESS-${activity_id}-${userId}-${Date.now()}`;
    }

    // Create booking
    const bookingResult = await client.query(`
      INSERT INTO wellness_bookings (
        apartment_booking_id, user_id, activity_id, activity_name, activity_type,
        booking_date, start_time, end_time, total_duration,
        activity_pin, qr_code, keys_generated_at, special_requests
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                ${activity.requires_access_pin ? 'CURRENT_TIMESTAMP' : 'NULL'}, $12)
      RETURNING *
    `, [apartmentBookingId, userId, activity_id, activity.name, activity.type,
        booking_date, start_time, end_time, activity.duration,
        activity_pin, qr_code, special_requests]);

    const booking = bookingResult.rows[0];

    // If journey, create stages
    if (activity.has_stages) {
      const stagesResult = await client.query(`
        SELECT * FROM wellness_activity_stages
        WHERE activity_id = $1
        ORDER BY stage_number ASC
      `, [activity_id]);

      let currentTime = new Date(`2000-01-01 ${start_time}`);

      for (const stage of stagesResult.rows) {
        const stageStartTime = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
        currentTime.setMinutes(currentTime.getMinutes() + stage.duration);
        const stageEndTime = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

        await client.query(`
          INSERT INTO wellness_booking_stages (
            booking_id, stage_id, stage_number, stage_name,
            scheduled_start, scheduled_end
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [booking.id, stage.id, stage.stage_number, stage.name, stageStartTime, stageEndTime]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Book error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/wellness-unified/activities/:id/availability
 * Get availability for an activity with conflict detection
 */
router.get('/activities/:id/availability', async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const userId = req.user.id;
    const { date, days = 7 } = req.query;

    // Get activity details
    const activityResult = await db.query(`
      SELECT * FROM wellness_activities
      WHERE id = $1 AND is_active = true
    `, [activityId]);

    if (activityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    const activity = activityResult.rows[0];

    // Generate date range
    const startDate = date ? new Date(date) : new Date();
    const availabilitySlots = [];

    // Standard time slots (can be customized per activity)
    const timeSlots = [
      { start: '09:00', label: '9:00 AM' },
      { start: '10:00', label: '10:00 AM' },
      { start: '11:00', label: '11:00 AM' },
      { start: '14:00', label: '2:00 PM' },
      { start: '15:00', label: '3:00 PM' },
      { start: '16:00', label: '4:00 PM' },
      { start: '18:00', label: '6:00 PM' },
    ];

    // Generate slots for each day
    for (let i = 0; i < parseInt(days); i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];

      for (const slot of timeSlots) {
        // Calculate end time
        const [startHour, startMinute] = slot.start.split(':');
        const endTimeDate = new Date();
        endTimeDate.setHours(parseInt(startHour), parseInt(startMinute) + activity.duration);
        const endTime = `${String(endTimeDate.getHours()).padStart(2, '0')}:${String(endTimeDate.getMinutes()).padStart(2, '0')}`;

        // Check for conflicts for this user
        const conflictResult = await db.query(`
          SELECT activity_name FROM wellness_bookings
          WHERE user_id = $1
            AND booking_date = $2
            AND status IN ('upcoming', 'in_progress')
            AND (
              (start_time <= $3 AND end_time > $3)
              OR (start_time < $4 AND end_time >= $4)
              OR (start_time >= $3 AND end_time <= $4)
            )
          LIMIT 1
        `, [userId, dateString, slot.start, endTime]);

        const hasConflict = conflictResult.rows.length > 0;
        const conflictingActivity = hasConflict ? conflictResult.rows[0].activity_name : null;

        availabilitySlots.push({
          date: dateString,
          start_time: slot.start,
          end_time: endTime,
          label: slot.label,
          is_available: !hasConflict,
          conflicting_booking: conflictingActivity,
          duration: activity.duration
        });
      }
    }

    res.json({
      success: true,
      activity_id: activityId,
      activity_name: activity.name,
      availability: availabilitySlots
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability'
    });
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
 * Cancel a booking
 */
router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { cancellation_reason } = req.body;

    const bookingCheck = await db.query(`
      SELECT * FROM wellness_bookings
      WHERE id = $1 AND user_id = $2
    `, [bookingId, userId]);

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const booking = bookingCheck.rows[0];

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Booking already cancelled'
      });
    }

    const result = await db.query(`
      UPDATE wellness_bookings
      SET
        status = 'cancelled',
        cancellation_reason = $1,
        cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [cancellation_reason, bookingId]);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: result.rows[0]
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

module.exports = router;

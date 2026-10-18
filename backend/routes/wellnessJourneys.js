/**
 * Wellness Journeys Routes
 * Handles multi-stage wellness journey experiences and bookings
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, checkPasswordChangeRequired } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);
router.use(checkPasswordChangeRequired);

/**
 * GET /api/wellness-journeys
 * Get all wellness journeys (with optional category filter)
 */
router.get('/', async (req, res) => {
  try {
    const { category, active_only = 'true' } = req.query;

    let query = `
      SELECT
        j.*,
        (
          SELECT COUNT(*)
          FROM wellness_journey_stages
          WHERE journey_id = j.id
        ) as total_stages,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', s.id,
              'stage_number', s.stage_number,
              'name', s.name,
              'description', s.description,
              'duration', s.duration,
              'icon', s.icon,
              'activity_type', s.activity_type,
              'location', s.location,
              'is_required', s.is_required
            ) ORDER BY s.stage_number
          )
          FROM wellness_journey_stages s
          WHERE s.journey_id = j.id
        ) as stages
      FROM wellness_journeys j
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND j.category = $${paramCount++}`;
      params.push(category);
    }

    if (active_only === 'true') {
      query += ` AND j.is_active = true`;
    }

    query += ` ORDER BY j.display_order ASC, j.name ASC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      journeys: result.rows
    });
  } catch (error) {
    console.error('Get journeys error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching journeys'
    });
  }
});

/**
 * GET /api/wellness-journeys/:id
 * Get single journey by ID with detailed stages
 */
router.get('/:id', async (req, res) => {
  try {
    const journeyId = parseInt(req.params.id);

    const journeyQuery = await db.query(`
      SELECT * FROM wellness_journeys
      WHERE id = $1 AND is_active = true
    `, [journeyId]);

    if (journeyQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Journey not found'
      });
    }

    const stagesQuery = await db.query(`
      SELECT * FROM wellness_journey_stages
      WHERE journey_id = $1
      ORDER BY stage_number ASC
    `, [journeyId]);

    const journey = journeyQuery.rows[0];
    journey.stages = stagesQuery.rows;

    res.json({
      success: true,
      journey
    });
  } catch (error) {
    console.error('Get journey error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching journey'
    });
  }
});

/**
 * GET /api/wellness-journeys/:id/availability
 * Get available time slots for a journey
 */
router.get('/:id/availability', async (req, res) => {
  try {
    const journeyId = parseInt(req.params.id);
    const { date, days = 7, user_id } = req.query;

    const startDate = date || new Date().toISOString().split('T')[0];
    const endDate = new Date(new Date(startDate).getTime() + (parseInt(days) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    const result = await db.query(`
      SELECT
        a.*,
        (a.max_capacity - a.current_bookings) as available_slots
      FROM wellness_journey_availability a
      WHERE a.journey_id = $1
        AND a.available_date >= $2
        AND a.available_date <= $3
        AND a.is_available = true
        AND (a.max_capacity - a.current_bookings) > 0
      ORDER BY a.available_date ASC, a.start_time ASC
    `, [journeyId, startDate, endDate]);

    // If user_id is provided, check which slots conflict with user's existing bookings
    let userBookings = [];
    if (user_id) {
      console.log('🔍 Checking conflicts for user_id:', user_id);
      console.log('🔍 Date range:', startDate, 'to', endDate);

      const bookingsResult = await db.query(`
        SELECT booking_date, start_time, end_time, journey_name
        FROM wellness_journey_bookings
        WHERE user_id = $1
          AND booking_date >= $2
          AND booking_date <= $3
          AND status IN ('upcoming', 'in_progress')
      `, [user_id, startDate, endDate]);
      userBookings = bookingsResult.rows;

      console.log('📅 Found', userBookings.length, 'user bookings:', JSON.stringify(userBookings, null, 2));
    }

    // Mark slots that conflict with user's existing bookings
    const availability = result.rows.map(slot => {
      // Normalize dates for comparison (extract YYYY-MM-DD portion)
      const slotDate = typeof slot.available_date === 'string'
        ? slot.available_date.split('T')[0]
        : new Date(slot.available_date).toISOString().split('T')[0];

      const hasConflict = userBookings.some(booking => {
        const bookingDate = typeof booking.booking_date === 'string'
          ? booking.booking_date.split('T')[0]
          : new Date(booking.booking_date).toISOString().split('T')[0];

        return bookingDate === slotDate &&
          (
            (slot.start_time >= booking.start_time && slot.start_time < booking.end_time) ||
            (slot.end_time > booking.start_time && slot.end_time <= booking.end_time) ||
            (slot.start_time <= booking.start_time && slot.end_time >= booking.end_time)
          );
      });

      const conflictingBooking = hasConflict ? userBookings.find(b => {
        const bookingDate = typeof b.booking_date === 'string'
          ? b.booking_date.split('T')[0]
          : new Date(b.booking_date).toISOString().split('T')[0];

        return bookingDate === slotDate &&
          (
            (slot.start_time >= b.start_time && slot.start_time < b.end_time) ||
            (slot.end_time > b.start_time && slot.end_time <= b.end_time) ||
            (slot.start_time <= b.start_time && slot.end_time >= b.end_time)
          );
      }) : null;

      return {
        ...slot,
        is_booked_by_user: hasConflict,
        conflicting_booking: conflictingBooking?.journey_name || null
      };
    });

    res.json({
      success: true,
      availability
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching availability'
    });
  }
});

/**
 * POST /api/wellness-journeys/:id/book
 * Book a wellness journey
 */
router.post('/:id/book', async (req, res) => {
  const client = await db.pool.connect();

  try {
    const journeyId = parseInt(req.params.id);
    const userId = req.user.id;
    const { booking_date, start_time, special_requests } = req.body;

    if (!booking_date || !start_time) {
      return res.status(400).json({
        success: false,
        error: 'Booking date and start time are required'
      });
    }

    await client.query('BEGIN');

    // Get journey details
    const journeyResult = await client.query(`
      SELECT * FROM wellness_journeys
      WHERE id = $1 AND is_active = true
    `, [journeyId]);

    if (journeyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Journey not found'
      });
    }

    const journey = journeyResult.rows[0];

    // Calculate end time
    const [startHour, startMinute] = start_time.split(':');
    const endTimeDate = new Date();
    endTimeDate.setHours(parseInt(startHour), parseInt(startMinute) + journey.total_duration);
    const end_time = `${String(endTimeDate.getHours()).padStart(2, '0')}:${String(endTimeDate.getMinutes()).padStart(2, '0')}`;

    // Check for booking conflicts
    const conflictCheck = await client.query(`
      SELECT id FROM wellness_journey_bookings
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
        error: 'You have a conflicting booking at this time'
      });
    }

    // Generate journey PIN (4-digit)
    const journey_pin = Math.floor(1000 + Math.random() * 9000).toString();

    // Generate QR code
    const qr_code = `FAYSHAA-JOURNEY-${journeyId}-${userId}-${Date.now()}`;

    // Create booking
    const bookingResult = await client.query(`
      INSERT INTO wellness_journey_bookings (
        user_id, journey_id, journey_name, booking_date,
        start_time, end_time, total_duration, special_requests,
        journey_pin, qr_code, keys_generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *
    `, [userId, journeyId, journey.name, booking_date, start_time, end_time, journey.total_duration, special_requests, journey_pin, qr_code]);

    const booking = bookingResult.rows[0];

    // Get journey stages
    const stagesResult = await client.query(`
      SELECT * FROM wellness_journey_stages
      WHERE journey_id = $1
      ORDER BY stage_number ASC
    `, [journeyId]);

    // Create booking stages
    let currentTime = new Date(`2000-01-01 ${start_time}`);

    for (const stage of stagesResult.rows) {
      const stageStartTime = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
      currentTime.setMinutes(currentTime.getMinutes() + stage.duration);
      const stageEndTime = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

      await client.query(`
        INSERT INTO wellness_journey_booking_stages (
          booking_id, stage_id, stage_number, stage_name,
          scheduled_start, scheduled_end
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [booking.id, stage.id, stage.stage_number, stage.name, stageStartTime, stageEndTime]);
    }

    // Update availability count if exists
    await client.query(`
      UPDATE wellness_journey_availability
      SET current_bookings = current_bookings + 1,
          is_available = CASE
            WHEN current_bookings + 1 >= max_capacity THEN false
            ELSE true
          END
      WHERE journey_id = $1
        AND available_date = $2
        AND start_time <= $3
        AND end_time >= $4
    `, [journeyId, booking_date, start_time, end_time]);

    await client.query('COMMIT');

    // Fetch complete booking with stages
    const completeBooking = await db.query(`
      SELECT
        b.*,
        (
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
          FROM wellness_journey_booking_stages bs
          WHERE bs.booking_id = b.id
        ) as stages
      FROM wellness_journey_bookings b
      WHERE b.id = $1
    `, [booking.id]);

    // Get user details and their apartment booking (for door PIN and gate QR code)
    const userResult = await db.query(`
      SELECT u.email, u.full_name,
             bk.door_pin,
             bk.gate_qr_code
      FROM users u
      LEFT JOIN bookings bk ON bk.user_id = u.id
        AND bk.status IN ('confirmed', 'checked_in')
        AND bk.check_in_date <= CURRENT_DATE
        AND bk.check_out_date >= CURRENT_DATE
      WHERE u.id = $1
      LIMIT 1
    `, [userId]);

    // Send confirmation email with journey PIN, door PIN, and gate QR code
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      try {
        const EmailService = require('../services/email.service');
        const emailService = new EmailService();

        await emailService.sendWellnessJourneyConfirmation({
          to: user.email,
          name: user.full_name,
          journeyName: journey.name,
          journeyPIN: journey_pin,
          date: booking_date,
          time: start_time,
          duration: `${journey.total_duration} minutes`,
          doorPIN: user.door_pin || null,
          gateQRCode: user.gate_qr_code || null,
        });

        console.log('✅ Wellness journey confirmation email sent to:', user.email);
      } catch (emailError) {
        // Log email error but don't fail the booking
        console.error('❌ Failed to send confirmation email:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Journey booked successfully',
      booking: completeBooking.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Book journey error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while booking the journey'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/wellness-journeys/bookings/my-bookings
 * Get current user's journey bookings
 */
router.get('/bookings/my-bookings', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, upcoming_only = 'false' } = req.query;

    let query = `
      SELECT
        b.*,
        j.icon as journey_icon,
        j.category as journey_category,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', bs.id,
              'stage_number', bs.stage_number,
              'stage_name', bs.stage_name,
              'scheduled_start', bs.scheduled_start,
              'scheduled_end', bs.scheduled_end,
              'status', bs.status,
              'actual_start', bs.actual_start,
              'actual_end', bs.actual_end,
              'guest_rating', bs.guest_rating,
              'guest_feedback', bs.guest_feedback
            ) ORDER BY bs.stage_number
          )
          FROM wellness_journey_booking_stages bs
          WHERE bs.booking_id = b.id
        ) as stages
      FROM wellness_journey_bookings b
      LEFT JOIN wellness_journeys j ON b.journey_id = j.id
      WHERE b.user_id = $1
    `;

    const params = [userId];
    let paramCount = 2;

    if (status) {
      query += ` AND b.status = $${paramCount++}`;
      params.push(status);
    }

    if (upcoming_only === 'true') {
      query += ` AND b.booking_date >= CURRENT_DATE AND b.status IN ('upcoming', 'in_progress')`;
    }

    query += ` ORDER BY b.booking_date DESC, b.start_time DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      bookings: result.rows
    });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching bookings'
    });
  }
});

/**
 * GET /api/wellness-journeys/bookings/:id
 * Get specific booking details
 */
router.get('/bookings/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;

    const result = await db.query(`
      SELECT
        b.*,
        j.description as journey_description,
        j.icon as journey_icon,
        j.benefits as journey_benefits,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', bs.id,
              'stage_number', bs.stage_number,
              'stage_name', bs.stage_name,
              'scheduled_start', bs.scheduled_start,
              'scheduled_end', bs.scheduled_end,
              'actual_start', bs.actual_start,
              'actual_end', bs.actual_end,
              'status', bs.status,
              'staff_notes', bs.staff_notes,
              'guest_rating', bs.guest_rating,
              'guest_feedback', bs.guest_feedback
            ) ORDER BY bs.stage_number
          )
          FROM wellness_journey_booking_stages bs
          WHERE bs.booking_id = b.id
        ) as stages
      FROM wellness_journey_bookings b
      LEFT JOIN wellness_journeys j ON b.journey_id = j.id
      WHERE b.id = $1 AND b.user_id = $2
    `, [bookingId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking: result.rows[0]
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while fetching booking'
    });
  }
});

/**
 * PATCH /api/wellness-journeys/bookings/:id/cancel
 * Cancel a booking
 */
router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { cancellation_reason } = req.body;

    // Check if booking exists and belongs to user
    const bookingCheck = await db.query(`
      SELECT * FROM wellness_journey_bookings
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
        error: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed booking'
      });
    }

    // Update booking status
    const result = await db.query(`
      UPDATE wellness_journey_bookings
      SET
        status = 'cancelled',
        cancellation_reason = $1,
        cancelled_at = CURRENT_TIMESTAMP,
        payment_status = CASE
          WHEN payment_status = 'paid' THEN 'refunded'
          ELSE 'cancelled'
        END
      WHERE id = $2
      RETURNING *
    `, [cancellation_reason, bookingId]);

    // Update availability
    await db.query(`
      UPDATE wellness_journey_availability
      SET current_bookings = current_bookings - 1,
          is_available = true
      WHERE journey_id = $1
        AND available_date = $2
        AND start_time <= $3
        AND end_time >= $4
    `, [booking.journey_id, booking.booking_date, booking.start_time, booking.end_time]);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: result.rows[0]
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while cancelling booking'
    });
  }
});

/**
 * POST /api/wellness-journeys/bookings/:id/rate
 * Rate a completed booking and provide feedback
 */
router.post('/bookings/:id/rate', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.id;
    const { stage_ratings } = req.body; // Array of { stage_number, rating, feedback }

    // Check if booking exists and is completed
    const bookingCheck = await db.query(`
      SELECT * FROM wellness_journey_bookings
      WHERE id = $1 AND user_id = $2 AND status = 'completed'
    `, [bookingId, userId]);

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found or not completed'
      });
    }

    // Update stage ratings
    if (stage_ratings && Array.isArray(stage_ratings)) {
      for (const rating of stage_ratings) {
        await db.query(`
          UPDATE wellness_journey_booking_stages
          SET
            guest_rating = $1,
            guest_feedback = $2
          WHERE booking_id = $3 AND stage_number = $4
        `, [rating.rating, rating.feedback, bookingId, rating.stage_number]);
      }
    }

    res.json({
      success: true,
      message: 'Rating submitted successfully'
    });
  } catch (error) {
    console.error('Rate booking error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while submitting rating'
    });
  }
});

module.exports = router;

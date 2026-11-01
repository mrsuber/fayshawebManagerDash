const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pool = db.pool;
const bcrypt = require('bcryptjs');
const { finalizeStay, sendConfirmation, handOverDepositBox, temporaryPassword } = require('../services/stayKeys');
const { releaseExpiredHolds, HOLD_EXPIRED } = require('../services/bookingHolds');
const { authenticateToken, requireStaff, userFromRequest, STAFF_ROLES } = require('../middleware/auth');

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate booking number
const generateBookingNumber = async () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Get the maximum sequence number for today
  const result = await pool.query(
    `SELECT booking_number
     FROM bookings
     WHERE booking_number LIKE 'FAY-' || $1 || '-%'
     ORDER BY booking_number DESC
     LIMIT 1`,
    [today]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    // Extract sequence from booking number (e.g., "FAY-20260918-003" -> "003")
    const lastBookingNumber = result.rows[0].booking_number;
    const lastSequence = parseInt(lastBookingNumber.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `FAY-${today}-${String(sequence).padStart(3, '0')}`;
};

// Generate access code
const generateAccessCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

// Is a residence free from check-in to check-out (check-out day exclusive)? Expired unpaid holds are released first.
// Pass `client` inside a transaction to lock the conflicting rows.
const checkAvailability = async (apartmentId, checkIn, checkOut, excludeBookingId = null, client = null) => {
  const executor = client || pool;
  await releaseExpiredHolds(executor);

  const apartment = await executor.query(
    `SELECT a.is_active AND c.is_active AND a.status NOT IN ('maintenance', 'unavailable') AS bookable
       FROM apartments a JOIN apartment_categories c ON c.id = a.category_id WHERE a.id = $1`,
    [apartmentId]
  );
  if (!apartment.rows[0]?.bookable) return false;

  const params = [apartmentId, checkIn, checkOut];
  let query = `
    SELECT id FROM bookings
     WHERE apartment_id = $1
       AND status IN ('confirmed', 'checked_in', 'pending')
       AND check_in_date < $3::date AND check_out_date > $2::date`;
  if (excludeBookingId) {
    params.push(excludeBookingId);
    query += ' AND id <> $4';
  }
  if (client) query += ' FOR UPDATE';
  const result = await executor.query(query, params);
  return result.rows.length === 0;
};

/** Validates a stay's dates: YYYY-MM-DD, check-in today or later (property time), check-out after check-in. */
const stayError = async (checkIn, checkOut) => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(String(checkIn || '')) || !iso.test(String(checkOut || ''))) return 'Dates must be in the form YYYY-MM-DD';
  const { rows } = await pool.query(
    `SELECT $1::date < (NOW() AT TIME ZONE $3)::date AS past, $2::date <= $1::date AS reversed, $2::date - $1::date AS nights`,
    [checkIn, checkOut, process.env.PROPERTY_TZ || 'Africa/Douala']
  ).catch(() => ({ rows: [{ invalid: true }] }));
  const r = rows[0];
  if (r.invalid) return 'Those dates are not valid';
  if (r.past) return 'Check-in cannot be in the past';
  if (r.reversed) return 'Check-out must be after check-in';
  if (r.nights > 365) return 'Stays are limited to one year';
  return null;
};

// Calculate price for booking
const calculatePrice = async (apartmentId, checkInDate, checkOutDate) => {
  // Get apartment price
  const apartmentResult = await pool.query(`
    SELECT
      COALESCE(a.custom_price, c.base_price) as price_per_night
    FROM apartments a
    JOIN apartment_categories c ON a.category_id = c.id
    WHERE a.id = $1
  `, [apartmentId]);

  if (apartmentResult.rows.length === 0) {
    throw new Error('Apartment not found');
  }

  const basePrice = parseFloat(apartmentResult.rows[0].price_per_night);

  // Calculate nights
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    throw new Error('Invalid check-out date');
  }

  // TODO: Apply pricing rules (seasonal pricing)
  // For now, just return base calculation

  return {
    price_per_night: basePrice,
    number_of_nights: nights,
    total_price: basePrice * nights,
    discount_amount: 0,
    final_price: basePrice * nights
  };
};

// A new guest's first password (cryptographically random; meets the sign-in rules).
const generateTempPassword = temporaryPassword;

// Create user account for guest
const createGuestAccount = async (guestData, pool = db) => {
  try {
    // Check if user already exists (including soft-deleted users)
    const existingUser = await pool.query(
      'SELECT id, username, deleted_at FROM users WHERE lower(email) = lower($1)',
      [guestData.email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];

      // If user was soft-deleted, restore them
      if (user.deleted_at) {
        await pool.query(
          'UPDATE users SET deleted_at = NULL, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['active', user.id]
        );
        console.log(`✓ Restored soft-deleted user: ${guestData.email} (ID: ${user.id})`);
      }

      // Return existing user ID and no password (account already exists or was restored)
      return {
        userId: user.id,
        username: user.username,
        isNewAccount: false,
        wasRestored: !!user.deleted_at
      };
    }

    // Get guest role
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = 'guest'"
    );

    let roleId;
    if (roleResult.rows.length === 0) {
      // Create guest role if it doesn't exist
      const newRole = await pool.query(`
        INSERT INTO roles (name, display_name, description, permissions, is_system_role)
        VALUES ('guest', 'Guest', 'Guest user with booking and wellness app access',
        '{"bookings": {"view": true, "edit": true}, "wellness": {"view": true, "book": true}}', true)
        RETURNING id
      `);
      roleId = newRole.rows[0].id;
    } else {
      roleId = roleResult.rows[0].id;
    }

    // Generate random password
    const temporaryPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Generate username from email
    const baseUsername = guestData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    // Unique without a lookup: a short random suffix (the base alone can repeat across guests).
    const username = `${(baseUsername || 'guest').slice(0, 30)}_${require('crypto').randomBytes(3).toString('hex')}`;

    // Generate email verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const userResult = await pool.query(`
      INSERT INTO users (
        email, username, password_hash, full_name, role_id,
        status, email_verified, is_password_temporary, must_change_password,
        email_verification_token, email_verification_expires
      ) VALUES ($1, $2, $3, $4, $5, 'active', true, true, true, $6, NOW() + INTERVAL '24 hours')
      RETURNING id, username, email
    `, [
      guestData.email,
      username,
      hashedPassword,
      guestData.name,
      roleId,
      verificationToken
    ]);

    return {
      userId: userResult.rows[0].id,
      username: userResult.rows[0].username,
      email: userResult.rows[0].email,
      temporaryPassword,
      verificationToken,
      isNewAccount: true
    };
  } catch (error) {
    console.error('Error creating guest account:', error);
    return null;
  }
};

// ============================================
// BOOKING ROUTES
// ============================================

// Get all bookings (admin or filtered by user)
router.get('/', requireStaff, async (req, res) => {
  try {
    const { status, apartment_id, user_id, from_date, to_date, limit = 50, offset = 0 } = req.query;

    // Use DISTINCT ON to prevent duplicates from payment joins
    let query = 'SELECT DISTINCT ON (id) * FROM booking_details_view WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (user_id) {
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (apartment_id) {
      query += ` AND apartment_id = $${paramCount}`;
      params.push(apartment_id);
      paramCount++;
    }

    if (from_date) {
      query += ` AND check_in_date >= $${paramCount}`;
      params.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND check_out_date <= $${paramCount}`;
      params.push(to_date);
      paramCount++;
    }

    // DISTINCT ON requires ordering by the distinct column first
    query += ` ORDER BY id, created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM bookings');

    res.json({
      success: true,
      bookings: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// Get all apartments with availability status (for booking search page)
// IMPORTANT: This must come BEFORE /:id route to avoid route collision
router.get('/availability', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing start_date or end_date query parameters'
      });
    }
    const invalidDates = await stayError(start_date, end_date);
    if (invalidDates) return res.status(400).json({ success: false, message: invalidDates });
    await releaseExpiredHolds();

    // Get all active apartments with their category information and primary image
    const apartmentsResult = await pool.query(`
      SELECT
        a.id,
        a.unit_number,
        a.floor,
        a.building,
        a.category_id,
        c.name as category_name,
        c.display_name as category_display_name,
        c.description as category_description,
        c.max_guests,
        c.size_sqm,
        c.bedrooms,
        c.bathrooms,
        c.features,
        c.amenities,
        COALESCE(a.custom_price, c.base_price) as price_per_night,
        (
          SELECT file_url
          FROM apartment_media
          WHERE category_id = c.id AND is_primary = true AND media_type = 'image'
          LIMIT 1
        ) as primary_image,
        (
          SELECT file_url
          FROM apartment_media
          WHERE category_id = c.id AND media_type = 'panorama_360'
          LIMIT 1
        ) as panorama_360_url
      FROM apartments a
      JOIN apartment_categories c ON a.category_id = c.id
      WHERE a.is_active = true AND c.is_active = true
      ORDER BY c.sort_order, a.unit_number
    `);

    // Check availability for each apartment
    const availability = await Promise.all(
      apartmentsResult.rows.map(async (apartment) => {
        const isAvailable = await checkAvailability(
          apartment.id,
          start_date,
          end_date
        );

        const pricePerNight = parseFloat(apartment.price_per_night);

        return {
          ...apartment,
          is_available: isAvailable,
          price_per_night: pricePerNight,
          effective_price: pricePerNight // Frontend expects this field
          // primary_image and panorama_360_url come from the SQL query
        };
      })
    );

    res.json({
      success: true,
      availability,
      search_params: {
        start_date,
        end_date
      }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch apartment availability',
      error: error.message
    });
  }
});

// Get single booking
// Stays overlapping a date range, for the HQ availability calendar (?start_date, end_date, apartment_id)
router.get('/calendar', requireStaff, async (req, res) => {
  try {
    const { start_date, end_date, apartment_id } = req.query;
    const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
    if (!isDate(start_date) || !isDate(end_date)) {
      return res.status(400).json({ success: false, message: 'start_date and end_date (YYYY-MM-DD) are required' });
    }
    const params = [start_date, end_date];
    let where = `b.check_in_date < $2::date AND b.check_out_date > $1::date AND b.status <> 'cancelled'`;
    if (apartment_id) {
      params.push(apartment_id);
      where += ` AND b.apartment_id = $3`;
    }
    const result = await pool.query(
      `SELECT b.id, b.booking_number, b.guest_name, b.guest_email, b.number_of_guests, b.final_price, b.status,
              to_char(b.check_in_date, 'YYYY-MM-DD') AS check_in_date, to_char(b.check_out_date, 'YYYY-MM-DD') AS check_out_date,
              a.id AS apartment_id, a.unit_number, a.floor, a.building, c.display_name AS category_name
         FROM bookings b
         JOIN apartments a ON a.id = b.apartment_id
         JOIN apartment_categories c ON c.id = a.category_id
        WHERE ${where}
        ORDER BY b.check_in_date, a.unit_number`,
      params
    );
    res.json({ success: true, bookings: result.rows });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch the calendar' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM booking_details_view WHERE id = $1',
      [id]
    );

    // Guests can only read their own booking; staff can read any.
    if (result.rows.length === 0 || (!STAFF_ROLES.includes(req.user.role) && result.rows[0].user_id !== req.user.id)) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = result.rows[0];

    // If booking has a user_id, fetch the user details
    if (booking.user_id) {
      const userResult = await pool.query(
        'SELECT id, email, username, is_password_temporary FROM users WHERE id = $1',
        [booking.user_id]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        booking.user_email = user.email;
        booking.username = user.username;
        booking.is_password_temporary = user.is_password_temporary;
        // Note: temporary_password is NOT included for security - it's only shown once when booking is created
      }
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
});

// Get booking by booking number
router.get('/number/:bookingNumber', requireStaff, async (req, res) => {
  try {
    const { bookingNumber } = req.params;

    const result = await pool.query(
      'SELECT * FROM booking_details_view WHERE booking_number = $1',
      [bookingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
});

// Check availability
router.post('/check-availability', async (req, res) => {
  try {
    const { apartment_id, check_in_date, check_out_date } = req.body;

    if (!apartment_id || !check_in_date || !check_out_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    const invalidDates = await stayError(check_in_date, check_out_date);
    if (invalidDates) return res.status(400).json({ success: false, available: false, message: invalidDates });

    const isAvailable = await checkAvailability(apartment_id, check_in_date, check_out_date);

    if (isAvailable) {
      const pricing = await calculatePrice(apartment_id, check_in_date, check_out_date);

      res.json({
        success: true,
        available: true,
        ...pricing
      });
    } else {
      res.json({
        success: true,
        available: false,
        message: 'Apartment is not available for these dates'
      });
    }
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      error: error.message
    });
  }
});

// Create booking: a pending stay that holds the residence until it is paid (services/bookingHolds.js).
router.post('/', async (req, res) => {
  const {
    apartment_id, guest_name, guest_phone, guest_id_number, check_in_date, check_out_date, special_requests
  } = req.body;
  const guest_email = String(req.body.guest_email || '').trim().toLowerCase();
  const number_of_guests = parseInt(req.body.number_of_guests, 10) || 1;

  if (!apartment_id || !String(guest_name || '').trim() || !guest_email || !String(guest_phone || '').trim() || !check_in_date || !check_out_date) {
    return res.status(400).json({ success: false, message: 'Please give the residence, dates, your name, email and phone' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }
  const invalidDates = await stayError(check_in_date, check_out_date);
  if (invalidDates) return res.status(400).json({ success: false, message: invalidDates });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the residence so two guests cannot book the same nights at once.
    const apartment = await client.query(
      `SELECT a.id, c.max_guests FROM apartments a JOIN apartment_categories c ON c.id = a.category_id WHERE a.id = $1 FOR UPDATE OF a`,
      [apartment_id]
    );
    if (!apartment.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Residence not found' });
    }
    if (number_of_guests < 1 || number_of_guests > apartment.rows[0].max_guests) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `This residence sleeps up to ${apartment.rows[0].max_guests} guests` });
    }

    if (!(await checkAvailability(apartment_id, check_in_date, check_out_date, null, client))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'This residence is not available for the selected dates' });
    }

    const pricing = await calculatePrice(apartment_id, check_in_date, check_out_date);
    const bookingNumber = await generateBookingNumber();
    const accessCode = generateAccessCode();

    // The guest's account (an existing one is reused), in the same transaction.
    const accountInfo = await createGuestAccount({ name: String(guest_name).trim(), email: guest_email, phone: String(guest_phone).trim() }, client);
    if (!accountInfo) throw new Error('Could not create the guest account');

    const bookingResult = await client.query(`
      INSERT INTO bookings (
        booking_number, apartment_id, user_id, guest_name, guest_email, guest_phone, guest_id_number,
        check_in_date, check_out_date, number_of_guests, price_per_night, number_of_nights, total_price, discount_amount, final_price,
        status, special_requests, access_code, temporary_password
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', $16, $17, $18)
      RETURNING *
    `, [
      bookingNumber, apartment_id, accountInfo.userId, String(guest_name).trim(), guest_email, String(guest_phone).trim(), guest_id_number || null,
      check_in_date, check_out_date, number_of_guests, pricing.price_per_night, pricing.number_of_nights, pricing.total_price,
      pricing.discount_amount, pricing.final_price, special_requests || null, accessCode,
      // A new account's first password is emailed with the confirmation once paid, then cleared.
      accountInfo.isNewAccount ? accountInfo.temporaryPassword : null
    ]);

    await client.query('COMMIT');

    // This endpoint is public: the response never carries sign-in details or the access code.
    const { temporary_password, access_code, ...booking } = bookingResult.rows[0];
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking,
      accountCreated: accountInfo.isNewAccount || undefined
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23P01') {
      return res.status(409).json({ success: false, message: 'This residence was just booked for those dates. Please choose another.' });
    }
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// Move a stay along: check in, check out or cancel. (Confirming goes through POST /:id/confirm, which also
// records the payment and releases the digital key.)
const STATUS_MOVES = {
  checked_in: { from: ['confirmed'], stamp: 'checked_in_at' },
  checked_out: { from: ['checked_in'], stamp: 'checked_out_at' },
  cancelled: { from: ['pending', 'confirmed'], stamp: 'cancelled_at' },
};
router.put('/:id/status', requireStaff, async (req, res) => {
  try {
    const { status, cancellation_reason } = req.body;
    if (status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Use Confirm booking, which records the payment and sends the digital key' });
    }
    const move = STATUS_MOVES[status];
    if (!move) return res.status(400).json({ success: false, message: 'Invalid status' });

    const current = await pool.query('SELECT status FROM bookings WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!move.from.includes(current.rows[0].status)) {
      return res.status(409).json({ success: false, message: `A ${current.rows[0].status.replace('_', ' ')} booking cannot be ${status.replace('_', ' ')}` });
    }

    const result = await pool.query(
      `UPDATE bookings SET status = $1::booking_status, ${move.stamp} = CURRENT_TIMESTAMP,
              cancellation_reason = CASE WHEN $1::booking_status = 'cancelled' THEN COALESCE($3, cancellation_reason) ELSE cancellation_reason END
        WHERE id = $2 RETURNING *`,
      [status, req.params.id, cancellation_reason || null]
    );
    // The deposit box passes to the next stay (with a new PIN) when this one ends or is cancelled.
    await handOverDepositBox(result.rows[0].apartment_id);
    const { temporary_password, ...booking } = result.rows[0];
    res.json({ success: true, message: 'Booking status updated', booking });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ success: false, message: 'Failed to update booking status' });
  }
});

// Confirm booking after successful payment
router.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_intent_id, terms_accepted, terms_accepted_at } = req.body;

    // Get booking details with apartment and category info
    const bookingResult = await pool.query(`
      SELECT
        b.*,
        a.unit_number,
        a.floor,
        a.building,
        c.display_name as category_display_name
      FROM bookings b
      JOIN apartments a ON b.apartment_id = a.id
      JOIN apartment_categories c ON a.category_id = c.id
      WHERE b.id = $1
    `, [id]);

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Confirming releases the door, gate and locker codes, so it needs proof of payment:
    // a succeeded Stripe PaymentIntent for this booking, or a signed-in staff member (money received).
    const staff = await userFromRequest(req);
    const isStaff = staff && STAFF_ROLES.includes(staff.role);
    // A card payment can succeed just after its hold expired; the stay is reinstated if the nights are still free.
    const lateCardPayment = !isStaff && booking.status === 'cancelled' && booking.cancellation_reason === HOLD_EXPIRED && payment_intent_id;

    if (booking.status !== 'pending' && !lateCardPayment) {
      if (['confirmed', 'checked_in', 'checked_out'].includes(booking.status)) {
        // Usually the Stripe webhook confirmed it a moment earlier: finish anything it left (key, email).
        await finalizeStay(booking.id, { app: req.app });
        return res.json({ success: true, message: 'Booking already confirmed', booking: { id: booking.id, booking_number: booking.booking_number, status: booking.status } });
      }
      return res.status(409).json({ success: false, message: `This booking is ${booking.status} and cannot be confirmed` });
    }

    if (!isStaff) {
      if (!payment_intent_id || !process.env.STRIPE_SECRET_KEY) {
        return res.status(402).json({ success: false, message: 'Payment is required to confirm this booking' });
      }
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
        if (intent.status !== 'succeeded' || String(intent.metadata?.booking_id) !== String(booking.id)) {
          return res.status(402).json({ success: false, message: 'Payment has not been completed for this booking' });
        }
      } catch (stripeError) {
        console.error('Could not verify payment intent:', stripeError.message);
        return res.status(402).json({ success: false, message: 'Could not verify the payment' });
      }
    }

    // Confirm, keeping the terms acceptance already on record (staff confirmations send none).
    let updatedBooking;
    try {
      updatedBooking = await pool.query(
        `UPDATE bookings
            SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, cancelled_at = NULL, cancellation_reason = NULL,
                terms_accepted = terms_accepted OR COALESCE($2, FALSE),
                terms_accepted_at = COALESCE(terms_accepted_at, $3::timestamp)
          WHERE id = $1 AND status IN ('pending', 'cancelled')
          RETURNING *`,
        [id, terms_accepted === true, terms_accepted ? terms_accepted_at || new Date().toISOString() : null]
      );
    } catch (e) {
      if (e.code !== '23P01') throw e;
      // The nights were taken while the card payment was pending: refund it.
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.refunds.create({ payment_intent: payment_intent_id });
        await pool.query(`UPDATE payments SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP, refund_amount = amount, refund_reason = $2 WHERE stripe_payment_intent_id = $1`, [payment_intent_id, 'Dates no longer available']);
      } catch (refundError) {
        console.error('Automatic refund failed — refund manually:', payment_intent_id, refundError.message);
      }
      return res.status(409).json({ success: false, message: 'Sorry, those dates were booked by someone else while your payment was processing. Your payment is being refunded.' });
    }

    if (!updatedBooking.rows[0]) {
      // Confirmed by a request that arrived at the same moment.
      await finalizeStay(booking.id, { app: req.app });
      return res.json({ success: true, message: 'Booking already confirmed', booking: { id: booking.id, booking_number: booking.booking_number, status: 'confirmed' } });
    }

    // Record the money: the card payment, or (staff confirming) the mobile money / cash payment awaiting confirmation.
    if (payment_intent_id) {
      await pool.query(
        `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP, error_message = NULL WHERE stripe_payment_intent_id = $1 AND booking_id = $2`,
        [payment_intent_id, booking.id]
      );
    } else if (isStaff) {
      const pendingPayment = await pool.query(
        `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP,
                payment_metadata = payment_metadata || jsonb_build_object('confirmed_by', $2::int)
          WHERE id = (SELECT id FROM payments WHERE booking_id = $1 AND status = 'pending' AND payment_method <> 'stripe' ORDER BY created_at DESC LIMIT 1)
          RETURNING id`,
        [booking.id, staff.id]
      );
      if (!pendingPayment.rows[0] && ['cash', 'bank_transfer', 'card_terminal', 'mobile_money'].includes(req.body.payment_method)) {
        // Paid at the desk with nothing recorded yet (cash, bank transfer, card terminal).
        await pool.query(
          `INSERT INTO payments (booking_id, payment_method, amount, status, paid_at, transaction_reference, payment_metadata)
           VALUES ($1, $2, $3, 'completed', CURRENT_TIMESTAMP, $4, jsonb_build_object('confirmed_by', $5::int))`,
          [booking.id, req.body.payment_method, booking.final_price, req.body.reference || null, staff.id]
        );
      }
    }

    // Key, deposit box, confirmation email (with first sign-in details) and the app notification.
    const finalized = await finalizeStay(booking.id, { app: req.app });

    const { temporary_password: _password, ...confirmed } = updatedBooking.rows[0];
    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: confirmed,
      emailSent: finalized.email ? finalized.email.sent : false
    });
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm booking',
      error: error.message
    });
  }
});

// ============================================
// DIGITAL KEY ENDPOINTS
// ============================================

// Issue the digital key of a confirmed stay (if it has none) and return it. Staff only.
router.post('/:id/generate-keys', requireStaff, async (req, res) => {
  try {
    const found = await pool.query('SELECT id, status FROM bookings WHERE id = $1', [req.params.id]);
    if (!found.rows[0]) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['confirmed', 'checked_in'].includes(found.rows[0].status)) {
      return res.status(409).json({ success: false, message: 'A digital key is issued once the stay is confirmed' });
    }
    await finalizeStay(found.rows[0].id, { app: req.app });
    const b = (await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id])).rows[0];
    res.json({
      success: true,
      message: 'Digital key ready',
      keys: {
        gateQRCode: b.gate_qr_code,
        doorPIN: b.door_pin,
        depositBox: { number: b.deposit_box_number, pin: b.deposit_box_pin },
        booking: { id: b.id, type: 'apartment', checkIn: b.check_in_date, checkOut: b.check_out_date },
      },
    });
  } catch (error) {
    console.error('Error generating digital keys:', error);
    res.status(500).json({ success: false, message: 'Failed to generate digital keys' });
  }
});

// Email the confirmation with the digital key again (staff). Issues the key first if needed.
const resendConfirmation = async (req, res) => {
  try {
    const found = await pool.query('SELECT id, status FROM bookings WHERE id = $1', [req.params.id]);
    if (!found.rows[0]) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['confirmed', 'checked_in'].includes(found.rows[0].status)) {
      return res.status(409).json({ success: false, message: 'Only a confirmed stay has a digital key to send' });
    }
    await finalizeStay(found.rows[0].id, { app: req.app, notify: false });
    const result = await sendConfirmation(found.rows[0].id, { force: true });
    if (!result.sent) return res.status(502).json({ success: false, message: `The email could not be sent: ${result.error || 'unknown error'}` });
    res.json({ success: true, message: 'Confirmation email sent successfully', email: result.to });
  } catch (error) {
    console.error('Error resending confirmation email:', error);
    res.status(500).json({ success: false, message: 'Failed to resend confirmation email' });
  }
};
router.post('/:id/send-digital-key-email', requireStaff, resendConfirmation);

// Get all active digital keys for logged-in user
/** A DATE column (parsed by pg as local midnight) → "YYYY-MM-DD". */
const calendarDay = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : d);

router.get('/user/my-keys', authenticateToken, async (req, res) => {
  try {
    // Keys belong to the signed-in guest; staff may look up any guest with ?user_id=.
    const user_id = STAFF_ROLES.includes(req.user.role) && req.query.user_id ? req.query.user_id : req.user.id;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }

    // Get all active apartment bookings with digital keys
    const apartmentBookings = await pool.query(`
      SELECT
        b.id as booking_id,
        b.booking_number,
        b.gate_qr_code,
        b.door_pin,
        b.deposit_box_number,
        b.deposit_box_pin,
        b.check_in_date,
        b.check_out_date,
        b.status,
        a.unit_number,
        a.floor,
        a.building,
        c.display_name as apartment_name,
        d.status AS box_status,
        (SELECT COUNT(*)::int FROM deposit_box_history h WHERE h.deposit_box_id = d.id AND h.booking_id = b.id AND h.status = 'waiting') AS packages_waiting
      FROM bookings b
      JOIN apartments a ON b.apartment_id = a.id
      JOIN apartment_categories c ON a.category_id = c.id
      LEFT JOIN deposit_boxes d ON d.apartment_id = a.id AND d.current_booking_id = b.id
      WHERE b.user_id = $1
        AND b.status IN ('confirmed', 'checked_in')
        AND b.check_out_date >= CURRENT_DATE
        AND b.gate_qr_code IS NOT NULL
      ORDER BY b.status = 'checked_in' DESC, b.check_in_date ASC
    `, [user_id]);

    // Format apartment keys
    const apartments = apartmentBookings.rows.map(booking => ({
      bookingId: booking.booking_id,
      bookingNumber: booking.booking_number,
      apartmentName: booking.apartment_name,
      villaNumber: `RESIDENCE ${booking.unit_number}`,
      floor: booking.floor,
      // The guest network, set per property in the environment (shown only with a confirmed stay).
      wifi: process.env.PROPERTY_WIFI_SSID ? { ssid: process.env.PROPERTY_WIFI_SSID, password: process.env.PROPERTY_WIFI_PASSWORD || '' } : null,
      building: booking.building,
      gateQRCode: booking.gate_qr_code,
      doorPIN: booking.door_pin,
      depositBox: {
        number: booking.deposit_box_number,
        pin: booking.deposit_box_pin,
        // Held: this stay has the box now. Otherwise its PIN arrives when the box passes to it.
        status: !booking.box_status ? 'not_yet' : booking.box_status === 'package_waiting' ? 'package_waiting' : 'secure',
        packageCount: booking.packages_waiting || 0
      },
      // Calendar days as YYYY-MM-DD, so the app shows the same date in every time zone.
      checkIn: calendarDay(booking.check_in_date),
      checkOut: calendarDay(booking.check_out_date),
      status: booking.status === 'checked_in' ? 'active' : 'upcoming'
    }));

    // Wellness journeys booked for the stay open with their own PIN.
    const wellnessBookings = await pool.query(`
      SELECT wb.id AS booking_id, wb.activity_pin, wb.qr_code, to_char(wb.booking_date, 'YYYY-MM-DD') AS booking_date,
             to_char(wb.start_time, 'HH24:MI') AS start_time, wb.total_duration, wb.activity_name, a.description,
             wb.booking_date = CURRENT_DATE AS is_today
        FROM wellness_bookings wb
        LEFT JOIN wellness_activities a ON a.id = wb.activity_id
       WHERE wb.user_id = $1
         AND wb.status IN ('upcoming', 'in_progress')
         AND wb.booking_date >= CURRENT_DATE
         AND wb.activity_pin IS NOT NULL
       ORDER BY wb.booking_date, wb.start_time
    `, [user_id]);

    const wellnessJourneys = wellnessBookings.rows.map(booking => ({
      bookingId: booking.booking_id,
      journeyName: booking.activity_name,
      journeyPIN: booking.activity_pin,
      qrCode: booking.qr_code,
      date: booking.booking_date,
      time: booking.start_time,
      duration: `${booking.total_duration} minutes`,
      description: booking.description,
      status: booking.is_today ? 'today' : 'upcoming'
    }));

    res.json({
      success: true,
      keys: {
        apartments,
        wellnessJourneys
      }
    });
  } catch (error) {
    console.error('Error fetching user keys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch digital keys',
      error: error.message
    });
  }
});

// Resend confirmation email
router.post('/:id/resend-confirmation', requireStaff, resendConfirmation);
// v1 name for the same action (it used to reset the guest's password, which could lock out a signed-in guest).
router.post('/:id/send-access-code', requireStaff, resendConfirmation);

// Get booking statistics
router.get('/stats/overview', requireStaff, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
        COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        SUM(final_price) as total_revenue,
        SUM(final_price) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_revenue,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_bookings
      FROM bookings
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

module.exports = router;

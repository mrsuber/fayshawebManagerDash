const express = require('express');
const router = express.Router();
const db = require('../config/database');
const pool = db.pool;
const bcrypt = require('bcryptjs');
const emailService = require('../services/email.service');
const { notifyGuest } = require('../services/guestPush');
const keyGenerator = require('../utils/keyGenerator');
const QRCode = require('qrcode');
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

// Check apartment availability
// NOTE: Pass 'client' parameter to use within a transaction for race condition protection
const checkAvailability = async (apartmentId, checkIn, checkOut, excludeBookingId = null, client = null) => {
  let query = `
    SELECT id
    FROM bookings
    WHERE apartment_id = $1
      AND status IN ('confirmed', 'checked_in', 'pending')
      AND (
        (check_in_date <= $2 AND check_out_date > $2) OR
        (check_in_date < $3 AND check_out_date >= $3) OR
        (check_in_date >= $2 AND check_out_date <= $3)
      )
  `;

  const params = [apartmentId, checkIn, checkOut];

  if (excludeBookingId) {
    query += ' AND id != $4';
    params.push(excludeBookingId);
  }

  // Add FOR UPDATE to lock rows during transaction (prevents race conditions)
  // Note: We select actual rows (id) instead of COUNT(*) so FOR UPDATE is allowed
  if (client) {
    query += ' FOR UPDATE';
  }

  // Use transaction client if provided, otherwise use pool
  const executor = client || pool;
  const result = await executor.query(query, params);
  // Return true if no conflicting bookings found (available)
  return result.rows.length === 0;
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

// Generate strong random password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';

  // Ensure password meets requirements
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char

  // Fill rest with random chars
  for (let i = 4; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Create user account for guest
const createGuestAccount = async (guestData) => {
  try {
    // Check if user already exists (including soft-deleted users)
    const existingUser = await pool.query(
      'SELECT id, username, deleted_at FROM users WHERE email = $1',
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
    const username = baseUsername + '_' + Math.floor(Math.random() * 1000);

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

// Create booking
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      apartment_id,
      guest_name,
      guest_email,
      guest_phone,
      guest_id_number,
      check_in_date,
      check_out_date,
      number_of_guests,
      special_requests
    } = req.body;

    // Validate required fields
    if (!apartment_id || !guest_name || !guest_email || !guest_phone || !check_in_date || !check_out_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check availability WITHIN THE TRANSACTION (with row locking to prevent race conditions)
    const isAvailable = await checkAvailability(apartment_id, check_in_date, check_out_date, null, client);
    if (!isAvailable) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Apartment is not available for the selected dates'
      });
    }

    // Double-check: Lock the apartment record to prevent concurrent bookings
    await client.query(
      'SELECT id FROM apartments WHERE id = $1 FOR UPDATE',
      [apartment_id]
    );

    // Calculate pricing
    const pricing = await calculatePrice(apartment_id, check_in_date, check_out_date);

    // Generate booking number
    const bookingNumber = await generateBookingNumber();

    // Generate access code
    const accessCode = generateAccessCode();

    // Create guest account
    const accountInfo = await createGuestAccount({
      name: guest_name,
      email: guest_email,
      phone: guest_phone
    });

    if (!accountInfo) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account'
      });
    }

    // Create booking
    const bookingResult = await client.query(`
      INSERT INTO bookings (
        booking_number, apartment_id, user_id,
        guest_name, guest_email, guest_phone, guest_id_number,
        check_in_date, check_out_date, number_of_guests,
        price_per_night, number_of_nights, total_price, discount_amount, final_price,
        status, special_requests, access_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      bookingNumber,
      apartment_id,
      accountInfo.userId,
      guest_name,
      guest_email,
      guest_phone,
      guest_id_number,
      check_in_date,
      check_out_date,
      number_of_guests || 1,
      pricing.price_per_night,
      pricing.number_of_nights,
      pricing.total_price,
      pricing.discount_amount,
      pricing.final_price,
      'pending', // Status pending until payment
      special_requests,
      accessCode
    ]);

    await client.query('COMMIT');

    // Prepare response
    const response = {
      success: true,
      message: 'Booking created successfully',
      booking: bookingResult.rows[0],
      accessCode: accessCode
    };

    console.log('✅ Booking created with ID:', bookingResult.rows[0].id);
    console.log('✅ Booking number:', bookingResult.rows[0].booking_number);

    // A new account's temporary password is kept with the booking and sent in the confirmation email once paid.
    // It is never returned here: this endpoint is public, so the response must not carry sign-in details.
    // (An existing account that still has a temporary password gets a fresh one emailed at confirmation.)
    let passwordToStore = null;
    if (accountInfo.isNewAccount) {
      passwordToStore = accountInfo.temporaryPassword;
      response.accountCreated = true;
    }

    // Store temporary password in booking AFTER commit to avoid transaction abort
    if (passwordToStore) {
      try {
        await pool.query(`
          UPDATE bookings
          SET temporary_password = $1
          WHERE id = $2
        `, [passwordToStore, bookingResult.rows[0].id]);
      } catch (updateError) {
        // Ignore error if column doesn't exist yet (migration pending)
        console.log('⚠️ Could not store temporary password (migration may be pending):', updateError.message);
      }
    }

    // Note: Comprehensive email with all details (booking, access codes, QR code, credentials)
    // will be sent at payment confirmation when digital keys are generated

    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Update booking status
router.put('/:id/status', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellation_reason } = req.body;

    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    let query = 'UPDATE bookings SET status = $1';
    const params = [status, id];
    let paramCount = 2;

    // Handle status-specific updates
    if (status === 'confirmed') {
      query += ', confirmed_at = CURRENT_TIMESTAMP';
    } else if (status === 'checked_in') {
      query += ', checked_in_at = CURRENT_TIMESTAMP';
    } else if (status === 'checked_out') {
      query += ', checked_out_at = CURRENT_TIMESTAMP';
    } else if (status === 'cancelled') {
      query += ', cancelled_at = CURRENT_TIMESTAMP';
      if (cancellation_reason) {
        paramCount++;
        query += `, cancellation_reason = $${paramCount}`;
        params.splice(2, 0, cancellation_reason);
      }
    }

    query += ` WHERE id = $${paramCount + 1} RETURNING *`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking status updated',
      booking: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
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
    // a succeeded Stripe PaymentIntent for this booking, or a signed-in staff member.
    const staff = await userFromRequest(req);
    const isStaff = staff && STAFF_ROLES.includes(staff.role);
    if (!isStaff) {
      if (booking.status !== 'pending') {
        return res.json({ success: true, message: 'Booking already confirmed', booking: { id: booking.id, booking_number: booking.booking_number, status: booking.status } });
      }
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

    // Update payment status to completed
    if (payment_intent_id) {
      await pool.query(
        `UPDATE payments
         SET status = 'completed', paid_at = CURRENT_TIMESTAMP
         WHERE stripe_payment_intent_id = $1`,
        [payment_intent_id]
      );
    }

    // Update booking status to confirmed and store T&C acceptance
    const updatedBooking = await pool.query(
      `UPDATE bookings
       SET status = 'confirmed',
           confirmed_at = CURRENT_TIMESTAMP,
           terms_accepted = COALESCE($2, FALSE),
           terms_accepted_at = $3
       WHERE id = $1
       RETURNING *`,
      [id, terms_accepted, terms_accepted_at]
    );

    // Generate digital keys automatically after confirmation
    try {
      // Check if keys already exist
      if (!booking.gate_qr_code) {
        const keys = await keyGenerator.generateApartmentKeys(
          booking.id,
          booking.user_id,
          booking.apartment_id
        );

        // Save keys to database
        await pool.query(`
          UPDATE bookings
          SET gate_qr_code = $1,
              door_pin = $2,
              deposit_box_number = $3,
              deposit_box_pin = $4,
              keys_generated_at = $5
          WHERE id = $6
        `, [
          keys.gateQRCode,
          keys.doorPIN,
          keys.depositBoxNumber,
          keys.depositBoxPIN,
          keys.generatedAt,
          id
        ]);

        // Link deposit box to this booking
        await pool.query(`
          UPDATE deposit_boxes
          SET current_booking_id = $1,
              status = 'empty'
          WHERE apartment_id = $2
        `, [id, booking.apartment_id]);

        console.log(`✅ Digital keys auto-generated for booking #${booking.booking_number}`);
        console.log('🔑 Gate QR Code:', keys.gateQRCode);
        console.log('🔑 Door PIN:', keys.doorPIN);
        console.log('📦 Deposit Box:', keys.depositBoxNumber, 'linked to booking');

        // Generate QR code as data URI for email
        const qrCodeDataURI = await QRCode.toDataURL(keys.gateQRCode, {
          width: 400,
          margin: 2,
          color: {
            dark: '#0D0D0D',
            light: '#FFFFFF'
          }
        });

        console.log('📊 QR Code Data URI length:', qrCodeDataURI.length);
        console.log('📊 QR Code Data URI prefix:', qrCodeDataURI.substring(0, 50));

        // Format dates for email
        const checkInDate = new Date(booking.check_in_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const checkOutDate = new Date(booking.check_out_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Get user credentials if account exists
        let credentials = null;
        if (booking.user_id) {
          console.log('📧 Checking credentials for user_id:', booking.user_id);

          const userResult = await pool.query(
            `SELECT username, email, is_password_temporary FROM users WHERE id = $1`,
            [booking.user_id]
          );

          if (userResult.rows.length > 0) {
            console.log('📧 User found:', userResult.rows[0].username);
            console.log('📧 is_password_temporary:', userResult.rows[0].is_password_temporary);

            // Try to get temporary password from booking if column exists
            const temporaryPassword = booking.temporary_password;

            if (temporaryPassword) {
              console.log('✅ Temporary password found in booking');
              credentials = {
                username: userResult.rows[0].username,
                email: userResult.rows[0].email,
                temporaryPassword: temporaryPassword
              };
            } else if (userResult.rows[0].is_password_temporary) {
              console.log('⚠️ User has temporary password but not stored in booking - generating new one');

              // Generate a new temporary password since we can't retrieve the old one
              const bcrypt = require('bcryptjs');
              const crypto = require('crypto');
              const newTempPassword = crypto.randomBytes(6).toString('base64').slice(0, 10).replace(/[^a-zA-Z0-9]/g, '') + 'A1$';
              const hashedPassword = await bcrypt.hash(newTempPassword, 10);

              await pool.query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [hashedPassword, booking.user_id]
              );


              credentials = {
                username: userResult.rows[0].username,
                email: userResult.rows[0].email,
                temporaryPassword: newTempPassword
              };
            } else {
              console.log('ℹ️ User does not have temporary password');
            }
          }
        }

        // Send comprehensive booking confirmation email with all access codes
        await emailService.sendBookingConfirmation({
          to: booking.guest_email,
          guestName: booking.guest_name,
          bookingNumber: booking.booking_number,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate,
          unitNumber: booking.unit_number,
          apartmentCategory: booking.category_display_name,
          numberOfNights: booking.number_of_nights,
          totalPrice: booking.final_price,
          accessCode: booking.access_code,
          qrCodeDataURI: qrCodeDataURI,
          doorPIN: keys.doorPIN,
          depositBoxNumber: keys.depositBoxNumber,
          depositBoxPIN: keys.depositBoxPIN,
          credentials: credentials
        });

        // Mark email as sent and clear temporary password for security
        await pool.query(`
          UPDATE bookings
          SET email_sent = true,
              email_sent_at = CURRENT_TIMESTAMP,
              temporary_password = NULL
          WHERE id = $1
        `, [id]);

        console.log(`✅ Comprehensive confirmation email sent to ${booking.guest_email}`);
      }
    } catch (keyError) {
      console.error('❌ Failed to generate/send digital keys (booking still confirmed):', keyError);
      // Don't fail the confirmation if key generation fails
    }

    // Note: Comprehensive email with all booking details and digital keys
    // is automatically sent via the sendApartmentDigitalKey call above
    // No need to send separate booking confirmation email

    // Tell the guest in the app (push + live update) that their stay is confirmed.
    if (booking.user_id) {
      notifyGuest(req.app, booking.user_id, {
        title: 'Your stay is confirmed',
        body: `${booking.category_display_name} · ${new Date(booking.check_in_date).toDateString()}. Your digital key is ready in the app.`,
        event: 'stay:confirmed',
        data: { bookingId: booking.id, screen: 'MyStays' }
      });
    }

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: updatedBooking.rows[0]
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

// Generate digital keys for apartment booking
router.post('/:id/generate-keys', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking details
    const bookingResult = await pool.query(`
      SELECT b.*, a.id as apartment_id, a.unit_number
      FROM bookings b
      JOIN apartments a ON b.apartment_id = a.id
      WHERE b.id = $1
    `, [id]);

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Check if keys already exist
    if (booking.gate_qr_code) {
      return res.json({
        success: true,
        message: 'Keys already generated',
        keys: {
          gateQRCode: booking.gate_qr_code,
          doorPIN: booking.door_pin,
          depositBox: {
            number: booking.deposit_box_number,
            pin: booking.deposit_box_pin
          },
          booking: {
            id: booking.id,
            type: 'apartment',
            checkIn: booking.check_in_date,
            checkOut: booking.check_out_date
          }
        }
      });
    }

    // Generate new keys
    const keys = await keyGenerator.generateApartmentKeys(
      booking.id,
      booking.user_id,
      booking.apartment_id
    );

    // Save keys to database
    await pool.query(`
      UPDATE bookings
      SET gate_qr_code = $1,
          door_pin = $2,
          deposit_box_number = $3,
          deposit_box_pin = $4,
          keys_generated_at = $5
      WHERE id = $6
    `, [
      keys.gateQRCode,
      keys.doorPIN,
      keys.depositBoxNumber,
      keys.depositBoxPIN,
      keys.generatedAt,
      id
    ]);

    console.log(`✅ Digital keys generated for booking #${booking.booking_number}`);

    res.json({
      success: true,
      message: 'Digital keys generated successfully',
      keys: {
        gateQRCode: keys.gateQRCode,
        doorPIN: keys.doorPIN,
        depositBox: {
          number: keys.depositBoxNumber,
          pin: keys.depositBoxPIN
        },
        booking: {
          id: booking.id,
          type: 'apartment',
          checkIn: booking.check_in_date,
          checkOut: booking.check_out_date
        }
      }
    });
  } catch (error) {
    console.error('Error generating digital keys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate digital keys',
      error: error.message
    });
  }
});

// Send digital key email with QR code
router.post('/:id/send-digital-key-email', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking details with apartment info
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

    // Check if keys exist
    if (!booking.gate_qr_code) {
      return res.status(400).json({
        success: false,
        message: 'Digital keys not generated yet. Please generate keys first.'
      });
    }

    // Generate QR code as data URI
    const qrCodeDataURI = await QRCode.toDataURL(booking.gate_qr_code, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0D0D0D',
        light: '#FFFFFF'
      }
    });

    // Format dates for email
    const checkInDate = new Date(booking.check_in_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const checkOutDate = new Date(booking.check_out_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send email with digital keys
    await emailService.sendApartmentDigitalKey({
      to: booking.guest_email,
      name: booking.guest_name,
      bookingNumber: booking.booking_number,
      apartmentName: booking.category_display_name,
      villaNumber: `VILLA ${booking.unit_number}`,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      qrCodeDataURI: qrCodeDataURI,
      doorPIN: booking.door_pin,
      depositBoxNumber: booking.deposit_box_number,
      depositBoxPIN: booking.deposit_box_pin
    });

    // Mark email as sent
    await pool.query(`
      UPDATE bookings
      SET email_sent = true,
          email_sent_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    console.log(`✅ Digital key email sent to ${booking.guest_email} for booking #${booking.booking_number}`);

    res.json({
      success: true,
      message: 'Digital key email sent successfully'
    });
  } catch (error) {
    console.error('Error sending digital key email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send digital key email',
      error: error.message
    });
  }
});

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
        c.display_name as apartment_name
      FROM bookings b
      JOIN apartments a ON b.apartment_id = a.id
      JOIN apartment_categories c ON a.category_id = c.id
      WHERE b.user_id = $1
        AND b.status IN ('confirmed', 'checked_in')
        AND b.check_out_date >= CURRENT_DATE
        AND b.gate_qr_code IS NOT NULL
      ORDER BY b.check_in_date ASC
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
        status: 'secure', // TODO: Implement deposit box status tracking
        packageCount: 0 // TODO: Implement package tracking
      },
      // Calendar days as YYYY-MM-DD, so the app shows the same date in every time zone.
      checkIn: calendarDay(booking.check_in_date),
      checkOut: calendarDay(booking.check_out_date),
      status: booking.status === 'checked_in' ? 'active' : 'upcoming'
    }));

    // Get all active wellness journey bookings with digital keys
    // Wrapped in try-catch to prevent breaking apartment keys if wellness schema is different
    let wellnessJourneys = [];
    try {
      const wellnessBookings = await pool.query(`
        SELECT
          wjb.id as booking_id,
          wjb.journey_pin,
          wjb.qr_code,
          wjb.booking_date,
          wjb.start_time,
          wjb.status,
          wj.name as journey_name,
          wj.total_duration,
          wj.description
        FROM wellness_journey_bookings wjb
        JOIN wellness_journeys wj ON wjb.journey_id = wj.id
        WHERE wjb.user_id = $1
          AND wjb.status IN ('upcoming', 'confirmed', 'in_progress')
          AND wjb.booking_date >= CURRENT_DATE
          AND wjb.journey_pin IS NOT NULL
        ORDER BY wjb.booking_date ASC, wjb.start_time ASC
      `, [user_id]);

      // Format wellness journey keys
      wellnessJourneys = wellnessBookings.rows.map(booking => ({
        bookingId: booking.booking_id,
        journeyName: booking.journey_name,
        journeyPIN: booking.journey_pin,
        qrCode: booking.qr_code,
        date: booking.booking_date,
        time: booking.start_time,
        duration: `${booking.total_duration} minutes`,
        description: booking.description,
        status: booking.booking_date === new Date().toISOString().split('T')[0] ? 'today' : 'upcoming'
      }));
    } catch (wellnessError) {
      console.error('Wellness journey query error (non-critical, apartment keys still work):', wellnessError.message);
      // Return empty array for wellness journeys - apartment keys will still work
      wellnessJourneys = [];
    }

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

// Send access code
router.post('/:id/send-access-code', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

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

    // Get user credentials if account exists
    let credentials = null;
    if (booking.user_id) {
      const userResult = await pool.query(
        `SELECT username, email, is_password_temporary FROM users WHERE id = $1`,
        [booking.user_id]
      );

      if (userResult.rows.length > 0) {
        // If user has a temporary password, generate a new one and update it
        if (userResult.rows[0].is_password_temporary) {
          const newTempPassword = generateTempPassword();
          const hashedPassword = await bcrypt.hash(newTempPassword, 10);

          await pool.query(
            `UPDATE users SET password_hash = $1 WHERE id = $2`,
            [hashedPassword, booking.user_id]
          );

          credentials = {
            username: userResult.rows[0].username,
            temporaryPassword: newTempPassword,
          };

          console.log(`🔄 Generated new temporary password for user: ${userResult.rows[0].email}`);
        } else {
          // User has already changed their password, just include username
          credentials = {
            username: userResult.rows[0].username,
          };
        }
      }
    }

    // Send confirmation email with access code
    try {
      await emailService.sendBookingConfirmation({
        to: booking.guest_email,
        guestName: booking.guest_name,
        bookingNumber: booking.booking_number,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        unitNumber: booking.unit_number,
        apartmentCategory: booking.category_display_name,
        numberOfNights: booking.number_of_nights,
        totalPrice: booking.final_price,
        accessCode: booking.access_code,
        credentials: credentials,
      });
      console.log(`✅ Access code email sent to ${booking.guest_email}`);
    } catch (emailError) {
      console.error('❌ Failed to send access code email:', emailError);
      throw new Error('Failed to send access code email: ' + emailError.message);
    }

    // Update the sent timestamp
    await pool.query(
      'UPDATE bookings SET access_code_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Access code sent successfully',
      access_code: booking.access_code
    });
  } catch (error) {
    console.error('Error sending access code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send access code',
      error: error.message
    });
  }
});

// Resend confirmation email
router.post('/:id/resend-confirmation', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking details with digital key info
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

    // Check if booking has digital keys, if not generate them
    if (!booking.gate_qr_code) {
      const keys = await keyGenerator.generateApartmentKeys(
        booking.id,
        booking.user_id,
        booking.apartment_id
      );

      await pool.query(`
        UPDATE bookings
        SET gate_qr_code = $1,
            door_pin = $2,
            deposit_box_number = $3,
            deposit_box_pin = $4,
            keys_generated_at = $5
        WHERE id = $6
      `, [
        keys.gateQRCode,
        keys.doorPIN,
        keys.depositBoxNumber,
        keys.depositBoxPIN,
        keys.generatedAt,
        booking.id
      ]);

      // Update local booking object
      booking.gate_qr_code = keys.gateQRCode;
      booking.door_pin = keys.doorPIN;
      booking.deposit_box_number = keys.depositBoxNumber;
      booking.deposit_box_pin = keys.depositBoxPIN;

      console.log(`✅ Digital keys generated for booking #${booking.booking_number}`);
    }

    // Generate QR code as data URI for email
    const QRCode = require('qrcode');
    const qrCodeDataURI = await QRCode.toDataURL(booking.gate_qr_code, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0D0D0D',
        light: '#FFFFFF'
      }
    });

    // Format dates for email
    const checkInDate = new Date(booking.check_in_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const checkOutDate = new Date(booking.check_out_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get user credentials if account exists with temporary password
    let credentials = null;
    if (booking.user_id) {
      const userResult = await pool.query(
        `SELECT username, email, is_password_temporary FROM users WHERE id = $1`,
        [booking.user_id]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].is_password_temporary) {
        // Try to get temporary password from booking if it exists
        if (booking.temporary_password) {
          credentials = {
            username: userResult.rows[0].username,
            email: userResult.rows[0].email,
            temporaryPassword: booking.temporary_password
          };
        } else {
          credentials = {
            username: userResult.rows[0].username,
            email: userResult.rows[0].email,
            note: 'Use your existing temporary password. Contact support if you need a new one.'
          };
        }
      }
    }

    // Send comprehensive email with all access details
    try {
      await emailService.sendBookingConfirmation({
        to: booking.guest_email,
        guestName: booking.guest_name,
        bookingNumber: booking.booking_number,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        unitNumber: booking.unit_number,
        apartmentCategory: booking.category_display_name,
        numberOfNights: booking.number_of_nights,
        totalPrice: booking.final_price,
        accessCode: booking.access_code,
        qrCodeDataURI: qrCodeDataURI,
        doorPIN: booking.door_pin,
        depositBoxNumber: booking.deposit_box_number,
        depositBoxPIN: booking.deposit_box_pin,
        credentials: credentials
      });
      console.log(`✅ Comprehensive confirmation email resent to ${booking.guest_email}`);
    } catch (emailError) {
      console.error('❌ Failed to resend confirmation email:', emailError);
      throw new Error('Failed to resend confirmation email: ' + emailError.message);
    }

    res.json({
      success: true,
      message: 'Confirmation email sent successfully',
      email: booking.guest_email
    });
  } catch (error) {
    console.error('Error resending confirmation email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend confirmation email',
      error: error.message
    });
  }
});

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

/**
 * Deposit Box API Routes
 * Handles package delivery tracking and deposit box management
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { sendNotificationToDevice } = require('../services/notificationService');
const { authenticateToken, requireStaff, STAFF_ROLES } = require('../middleware/auth');

// Admin authentication middleware
// Box setup, assignment and PINs are for staff only.
const requireAdmin = requireStaff;

/**
 * POST /api/deposit-box/admin/setup
 * Initialize deposit box system - creates tables and seed data (Admin only)
 */
router.post('/admin/setup', requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Starting deposit box setup...');

    // Create tables
    const migrationSQL = `
      CREATE TABLE IF NOT EXISTS deposit_boxes (
        id SERIAL PRIMARY KEY,
        box_number VARCHAR(20) NOT NULL UNIQUE,
        apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
        current_booking_id INTEGER,
        current_pin VARCHAR(10),
        status VARCHAR(50) DEFAULT 'empty' CHECK (status IN ('empty', 'package_waiting', 'maintenance')),
        pin_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS deposit_box_history (
        id SERIAL PRIMARY KEY,
        deposit_box_id INTEGER REFERENCES deposit_boxes(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        delivery_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        delivered_by VARCHAR(255),
        tracking_number VARCHAR(255),
        package_description TEXT,
        pin_used_by_delivery VARCHAR(10),
        new_pin_generated VARCHAR(10),
        status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'collected', 'returned')),
        collected_at TIMESTAMP WITH TIME ZONE,
        collected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_deposit_boxes_apartment ON deposit_boxes(apartment_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_boxes_booking ON deposit_boxes(current_booking_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_box ON deposit_box_history(deposit_box_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_booking ON deposit_box_history(booking_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_user ON deposit_box_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_status ON deposit_box_history(status);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_delivery_date ON deposit_box_history(delivery_date DESC);

      CREATE OR REPLACE FUNCTION update_deposit_box_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_deposit_boxes_updated_at ON deposit_boxes;
      CREATE TRIGGER update_deposit_boxes_updated_at BEFORE UPDATE ON deposit_boxes
        FOR EACH ROW EXECUTE FUNCTION update_deposit_box_updated_at();

      CREATE OR REPLACE FUNCTION generate_deposit_box_pin()
      RETURNS VARCHAR(10) AS $$
      DECLARE
        new_pin VARCHAR(10);
        pin_exists BOOLEAN;
      BEGIN
        LOOP
          new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
          SELECT EXISTS(
            SELECT 1 FROM deposit_boxes
            WHERE current_pin = new_pin AND status = 'package_waiting'
          ) INTO pin_exists;
          EXIT WHEN NOT pin_exists;
        END LOOP;
        RETURN new_pin;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await pool.query(migrationSQL);
    console.log('✓ Tables created');

    // Check existing boxes
    const existingBoxes = await pool.query('SELECT COUNT(*) FROM deposit_boxes');
    const boxCount = parseInt(existingBoxes.rows[0].count);

    if (boxCount > 0) {
      return res.json({
        success: true,
        message: `Deposit box system already initialized with ${boxCount} boxes`,
        boxCount
      });
    }

    // Get apartments
    const apartmentsResult = await pool.query(`
      SELECT id, unit_number
      FROM apartments
      ORDER BY unit_number
      LIMIT 20
    `);

    const apartments = apartmentsResult.rows;

    if (apartments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No apartments found. Please create apartments first.'
      });
    }

    // Create deposit boxes
    const createdBoxes = [];
    for (let i = 0; i < apartments.length; i++) {
      const apartment = apartments[i];
      const boxNumber = `DB-${String(i + 1).padStart(3, '0')}`;
      const pinResult = await pool.query('SELECT generate_deposit_box_pin() as pin');
      const initialPin = pinResult.rows[0].pin;

      const result = await pool.query(`
        INSERT INTO deposit_boxes (box_number, apartment_id, current_pin, status)
        VALUES ($1, $2, $3, 'empty')
        RETURNING *
      `, [boxNumber, apartment.id, initialPin]);

      createdBoxes.push({
        boxNumber,
        apartment: apartment.unit_number,
        pin: initialPin
      });
    }

    console.log(`✓ Created ${createdBoxes.length} deposit boxes`);

    res.json({
      success: true,
      message: `Successfully created ${createdBoxes.length} deposit boxes`,
      boxes: createdBoxes
    });

  } catch (error) {
    console.error('Error setting up deposit boxes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup deposit boxes',
      error: error.message
    });
  }
});

/**
 * POST /api/deposit-box/admin/assign/:box_id
 * Assign a deposit box to a booking (Admin only)
 */
router.post('/admin/assign/:box_id', requireAdmin, async (req, res) => {
  try {
    const { box_id } = req.params;
    const { booking_id } = req.body;

    // Get booking details
    const bookingQuery = await pool.query(`
      SELECT b.*, u.full_name, u.email
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.id = $1
    `, [booking_id]);

    if (bookingQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingQuery.rows[0];

    // Update deposit box
    await pool.query(`
      UPDATE deposit_boxes
      SET current_booking_id = $1
      WHERE id = $2
    `, [booking_id, box_id]);

    // Also update the booking with deposit box info
    const boxQuery = await pool.query('SELECT box_number, current_pin FROM deposit_boxes WHERE id = $1', [box_id]);
    const box = boxQuery.rows[0];

    await pool.query(`
      UPDATE bookings
      SET deposit_box_number = $1, deposit_box_pin = $2
      WHERE id = $3
    `, [box.box_number, box.current_pin, booking_id]);

    res.json({
      success: true,
      message: `Deposit box assigned to ${booking.full_name} (${booking.email})`,
      booking_id,
      box_number: box.box_number,
      pin: box.current_pin
    });

  } catch (error) {
    console.error('Error assigning deposit box:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign deposit box',
      error: error.message
    });
  }
});

/**
 * POST /api/deposit-box/admin/auto-assign
 * Auto-assign deposit boxes to all active bookings (Admin only)
 */
router.post('/admin/auto-assign', requireAdmin, async (req, res) => {
  try {
    // Get all active bookings without deposit boxes
    const activeBookings = await pool.query(`
      SELECT
        b.id,
        b.apartment_id,
        b.user_id,
        b.check_in_date,
        b.check_out_date,
        u.full_name,
        u.email,
        a.unit_number
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN apartments a ON b.apartment_id = a.id
      WHERE b.status IN ('confirmed', 'checked_in')
        AND (b.deposit_box_number IS NULL OR b.deposit_box_number = '')
        AND b.check_out_date >= CURRENT_DATE
      ORDER BY b.check_in_date
    `);

    const assignments = [];

    for (const booking of activeBookings.rows) {
      // Find deposit box for this apartment
      const boxQuery = await pool.query(`
        SELECT id, box_number, current_pin
        FROM deposit_boxes
        WHERE apartment_id = $1
          AND current_booking_id IS NULL
        LIMIT 1
      `, [booking.apartment_id]);

      if (boxQuery.rows.length > 0) {
        const box = boxQuery.rows[0];

        // Assign box to booking
        await pool.query(`
          UPDATE deposit_boxes
          SET current_booking_id = $1
          WHERE id = $2
        `, [booking.id, box.id]);

        // Update booking with box info
        await pool.query(`
          UPDATE bookings
          SET deposit_box_number = $1, deposit_box_pin = $2
          WHERE id = $3
        `, [box.box_number, box.current_pin, booking.id]);

        assignments.push({
          booking_id: booking.id,
          guest_name: booking.full_name,
          guest_email: booking.email,
          apartment: booking.unit_number,
          box_number: box.box_number,
          pin: box.current_pin
        });
      }
    }

    res.json({
      success: true,
      message: `Auto-assigned ${assignments.length} deposit boxes`,
      assignments
    });

  } catch (error) {
    console.error('Error auto-assigning deposit boxes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-assign deposit boxes',
      error: error.message
    });
  }
});

/**
 * GET /api/deposit-box/admin/all
 * Get all deposit boxes with current status (Admin only)
 */
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const query = await pool.query(`
      SELECT
        db.id,
        db.box_number,
        db.apartment_id,
        db.current_booking_id,
        db.current_pin,
        db.status,
        db.pin_changed_at,
        a.unit_number as apartment_number,
        b.id as booking_id,
        b.user_id,
        u.full_name as guest_name,
        u.email as guest_email,
        b.check_in_date,
        b.check_out_date,
        (SELECT COUNT(*) FROM deposit_box_history
         WHERE deposit_box_id = db.id AND status = 'waiting') as waiting_packages
      FROM deposit_boxes db
      LEFT JOIN apartments a ON db.apartment_id = a.id
      LEFT JOIN bookings b ON db.current_booking_id = b.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY db.box_number
    `);

    res.json({
      success: true,
      depositBoxes: query.rows
    });
  } catch (error) {
    console.error('Error fetching all deposit boxes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposit boxes',
      error: error.message
    });
  }
});

/**
 * GET /api/deposit-box/admin/:box_id
 * Get detailed info about a specific deposit box (Admin only)
 */
router.get('/admin/:box_id', requireAdmin, async (req, res) => {
  try {
    const { box_id } = req.params;

    // Get deposit box details
    const boxQuery = await pool.query(`
      SELECT
        db.id,
        db.box_number,
        db.apartment_id,
        db.current_booking_id,
        db.current_pin,
        db.status,
        db.pin_changed_at,
        a.unit_number as apartment_number,
        b.id as booking_id,
        b.user_id,
        u.full_name as guest_name,
        u.email as guest_email,
        b.check_in_date,
        b.check_out_date
      FROM deposit_boxes db
      LEFT JOIN apartments a ON db.apartment_id = a.id
      LEFT JOIN bookings b ON db.current_booking_id = b.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE db.id = $1
    `, [box_id]);

    if (boxQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deposit box not found'
      });
    }

    // Get package history
    const historyQuery = await pool.query(`
      SELECT
        h.*,
        u.full_name as guest_name
      FROM deposit_box_history h
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.deposit_box_id = $1
      ORDER BY h.delivery_date DESC
      LIMIT 20
    `, [box_id]);

    res.json({
      success: true,
      depositBox: boxQuery.rows[0],
      history: historyQuery.rows
    });
  } catch (error) {
    console.error('Error fetching deposit box details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposit box details',
      error: error.message
    });
  }
});

/**
 * POST /api/deposit-box/admin/use-key
 * Simulate using the deposit box key (delivery person using PIN)
 * This records a delivery and generates a new PIN
 */
router.post('/admin/use-key', requireAdmin, async (req, res) => {
  try {
    const {
      box_id,
      delivered_by,
      tracking_number,
      package_description,
      notes
    } = req.body;

    // Get deposit box and booking info
    const boxQuery = await pool.query(`
      SELECT
        db.id,
        db.box_number,
        db.current_pin,
        db.current_booking_id,
        b.user_id,
        u.full_name,
        u.email
      FROM deposit_boxes db
      LEFT JOIN bookings b ON db.current_booking_id = b.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE db.id = $1
    `, [box_id]);

    if (boxQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deposit box not found'
      });
    }

    const box = boxQuery.rows[0];

    // Note: We allow deliveries even without an active booking
    // This handles cases where packages arrive before booking assignment
    if (!box.current_booking_id) {
      console.log(`⚠️ Recording delivery for box ${box.box_number} without active booking`);
    }

    // Generate new PIN
    const newPinQuery = await pool.query('SELECT generate_deposit_box_pin() as new_pin');
    const newPin = newPinQuery.rows[0].new_pin;

    // Record delivery in history
    // booking_id and user_id can be NULL if no active booking
    const deliveryQuery = await pool.query(`
      INSERT INTO deposit_box_history (
        deposit_box_id,
        booking_id,
        user_id,
        delivered_by,
        tracking_number,
        package_description,
        pin_used_by_delivery,
        new_pin_generated,
        status,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting', $9)
      RETURNING *
    `, [
      box.id,
      box.current_booking_id, // Can be NULL
      box.user_id, // Can be NULL
      delivered_by || 'Admin/Concierge',
      tracking_number,
      package_description,
      box.current_pin,
      newPin,
      notes
    ]);

    // Update deposit box with new PIN and status
    await pool.query(`
      UPDATE deposit_boxes
      SET
        current_pin = $1,
        status = 'package_waiting',
        pin_changed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newPin, box.id]);

    // Also update the booking record with the new PIN (for mobile app digital key screen)
    // Only if there's an active booking
    if (box.current_booking_id) {
      await pool.query(`
        UPDATE bookings
        SET deposit_box_pin = $1
        WHERE id = $2
      `, [newPin, box.current_booking_id]);
    }

    // Send concierge message notification to guest (only if user exists)
    if (box.user_id) {
      try {
        const messageText = `📦 Package Delivered!\n\nA package has been delivered to your deposit box #${box.box_number}.\n\n🔑 Your new access PIN is: ${newPin}\n\nDelivery Details:\n${delivered_by ? `• Delivered by: ${delivered_by}\n` : ''}${tracking_number ? `• Tracking: ${tracking_number}\n` : ''}${package_description ? `• Package: ${package_description}\n` : ''}${notes ? `• Notes: ${notes}` : ''}`;

        await pool.query(`
          INSERT INTO concierge_messages (user_id, message, sender_type, is_read, metadata)
          VALUES ($1, $2, 'concierge', false, $3)
        `, [
          box.user_id,
        messageText,
        JSON.stringify({
          type: 'package_delivery',
          depositBoxId: box.id,
          depositBoxNumber: box.box_number,
          oldPin: box.current_pin,
          newPin: newPin,
          deliveryId: deliveryQuery.rows[0].id,
          trackingNumber: tracking_number || null
        })
      ]);

        console.log(`✓ Concierge message sent to user ${box.full_name} (ID: ${box.user_id})`);
      } catch (msgError) {
        console.error('Error sending concierge message:', msgError);
        // Don't fail the request if message fails
      }

      // Send push notification to guest
      if (box.push_token) {
        try {
          const notificationPayload = {
            title: '📦 Package Delivered!',
            body: `A package has been delivered to your deposit box #${box.box_number}. Your new PIN is: ${newPin}`
          };

          const dataPayload = {
            type: 'package_delivery',
            depositBoxNumber: box.box_number,
            newPin: newPin,
            bookingId: box.current_booking_id ? box.current_booking_id.toString() : null,
            deliveryId: deliveryQuery.rows[0].id.toString()
          };

          const notificationResult = await sendNotificationToDevice(
            box.push_token,
            notificationPayload,
            dataPayload
          );

          if (notificationResult.success) {
            console.log(`✓ Push notification sent to ${box.full_name} (${box.email})`);
          } else {
            console.error(`✗ Failed to send notification to ${box.full_name}:`, notificationResult.error);
          }
        } catch (notifError) {
          console.error('Error sending push notification:', notifError);
          // Don't fail the request if notification fails
        }
      } else {
        console.log(`⚠️ No push token for user ${box.full_name}, notification not sent`);
      }
    } else {
      console.log(`⚠️ No active booking/user for box ${box.box_number}, skipping notifications`);
    }

    res.json({
      success: true,
      message: 'Package delivery recorded successfully',
      delivery: deliveryQuery.rows[0],
      oldPin: box.current_pin,
      newPin: newPin,
      guestName: box.full_name,
      guestEmail: box.email
    });
  } catch (error) {
    console.error('Error recording delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record package delivery',
      error: error.message
    });
  }
});

/**
 * GET /api/deposit-box/booking/:booking_id
 * Get deposit box info and package history for a specific booking
 */
router.get('/booking/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;

    // Get booking with deposit box info
    const bookingQuery = await pool.query(`
      SELECT
        b.id,
        b.user_id,
        b.deposit_box_number,
        b.deposit_box_pin,
        b.check_out_date,
        a.unit_number,
        db.id as deposit_box_id,
        db.box_number,
        db.current_pin,
        db.status as box_status,
        db.pin_changed_at
      FROM bookings b
      LEFT JOIN apartments a ON b.apartment_id = a.id
      LEFT JOIN deposit_boxes db ON db.box_number = b.deposit_box_number
      WHERE b.id = $1
    `, [booking_id]);

    if (bookingQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingQuery.rows[0];

    // Guests see only their own box (it includes the PIN); staff see any.
    if (!STAFF_ROLES.includes(req.user.role) && booking.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Get package history for this booking
    const packagesQuery = await pool.query(`
      SELECT
        id,
        delivery_date,
        delivered_by,
        tracking_number,
        package_description,
        pin_used_by_delivery,
        new_pin_generated,
        status,
        collected_at,
        notes,
        created_at
      FROM deposit_box_history
      WHERE booking_id = $1
      ORDER BY delivery_date DESC
    `, [booking_id]);

    // Calculate time since last update
    const getTimeAgo = (date) => {
      if (!date) return 'Never';
      const now = new Date();
      const past = new Date(date);
      const diffMs = now - past;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    // Count waiting packages
    const waitingPackages = packagesQuery.rows.filter(pkg => pkg.status === 'waiting').length;

    res.json({
      success: true,
      depositBox: {
        boxNumber: booking.box_number || booking.deposit_box_number,
        currentPin: booking.current_pin || booking.deposit_box_pin,
        status: booking.box_status || 'empty',
        lastUpdated: getTimeAgo(booking.pin_changed_at),
        hasNewPackage: waitingPackages > 0,
        packageCount: waitingPackages
      },
      packages: packagesQuery.rows.map(pkg => ({
        id: pkg.id,
        deliveryDate: pkg.delivery_date,
        deliveredBy: pkg.delivered_by,
        trackingNumber: pkg.tracking_number,
        packageDescription: pkg.package_description,
        pinUsedByDelivery: pkg.pin_used_by_delivery,
        newPinGenerated: pkg.new_pin_generated,
        status: pkg.status,
        collectedAt: pkg.collected_at,
        notes: pkg.notes
      }))
    });
  } catch (error) {
    console.error('Error fetching deposit box info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deposit box information',
      error: error.message
    });
  }
});

/**
 * POST /api/deposit-box/package/:package_id/collect
 * Mark a package as collected
 */
router.post('/package/:package_id/collect', authenticateToken, async (req, res) => {
  try {
    const { package_id } = req.params;
    const isStaff = STAFF_ROLES.includes(req.user.role);
    // The collector is the signed-in guest (staff may record a collection for a guest).
    const user_id = isStaff && req.body.user_id ? req.body.user_id : req.user.id;

    // Update package status (guests can only collect their own packages)
    const updateQuery = await pool.query(`
      UPDATE deposit_box_history
      SET
        status = 'collected',
        collected_at = CURRENT_TIMESTAMP,
        collected_by_user_id = $1
      WHERE id = $2 AND ($3::boolean OR user_id = $1)
      RETURNING *
    `, [user_id, package_id, isStaff]);

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Update deposit box status if no more waiting packages
    const depositBoxId = updateQuery.rows[0].deposit_box_id;
    const waitingPackagesQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM deposit_box_history
      WHERE deposit_box_id = $1 AND status = 'waiting'
    `, [depositBoxId]);

    const waitingCount = parseInt(waitingPackagesQuery.rows[0].count);

    if (waitingCount === 0) {
      await pool.query(`
        UPDATE deposit_boxes
        SET status = 'empty'
        WHERE id = $1
      `, [depositBoxId]);
    }

    res.json({
      success: true,
      message: 'Package marked as collected',
      package: updateQuery.rows[0]
    });
  } catch (error) {
    console.error('Error marking package as collected:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark package as collected',
      error: error.message
    });
  }
});

/**
 * POST /api/deposit-box/delivery
 * Record a new package delivery (admin/concierge only)
 */
router.post('/delivery', requireStaff, async (req, res) => {
  try {
    const {
      booking_id,
      delivered_by,
      tracking_number,
      package_description,
      notes
    } = req.body;

    // Get booking and deposit box info
    const bookingQuery = await pool.query(`
      SELECT
        b.user_id,
        b.deposit_box_number,
        db.id as deposit_box_id,
        db.current_pin
      FROM bookings b
      LEFT JOIN deposit_boxes db ON db.box_number = b.deposit_box_number
      WHERE b.id = $1
    `, [booking_id]);

    if (bookingQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const { user_id, deposit_box_id, current_pin } = bookingQuery.rows[0];

    // Generate new PIN
    const newPinQuery = await pool.query('SELECT generate_deposit_box_pin() as new_pin');
    const newPin = newPinQuery.rows[0].new_pin;

    // Record delivery in history
    const deliveryQuery = await pool.query(`
      INSERT INTO deposit_box_history (
        deposit_box_id,
        booking_id,
        user_id,
        delivered_by,
        tracking_number,
        package_description,
        pin_used_by_delivery,
        new_pin_generated,
        status,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting', $9)
      RETURNING *
    `, [
      deposit_box_id,
      booking_id,
      user_id,
      delivered_by,
      tracking_number,
      package_description,
      current_pin,
      newPin,
      notes
    ]);

    // Update deposit box with new PIN and status
    await pool.query(`
      UPDATE deposit_boxes
      SET
        current_pin = $1,
        status = 'package_waiting',
        pin_changed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newPin, deposit_box_id]);

    res.json({
      success: true,
      message: 'Package delivery recorded successfully',
      delivery: deliveryQuery.rows[0],
      newPin: newPin
    });
  } catch (error) {
    console.error('Error recording package delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record package delivery',
      error: error.message
    });
  }
});

module.exports = router;

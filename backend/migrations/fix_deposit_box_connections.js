/**
 * Migration Script: Fix Deposit Box Connections
 *
 * This script fixes bookings that have incorrect deposit box numbers/PINs
 * by looking up the actual deposit box assigned to each apartment.
 */

const pool = require('../config/database');

async function fixDepositBoxConnections() {
  console.log('🔧 Starting deposit box connection fix...\n');

  try {
    // Get all active bookings with deposit box data
    const bookingsResult = await pool.query(`
      SELECT
        b.id,
        b.apartment_id,
        b.deposit_box_number,
        b.deposit_box_pin,
        b.guest_email,
        b.guest_name,
        a.unit_number
      FROM bookings b
      LEFT JOIN apartments a ON b.apartment_id = a.id
      WHERE b.status IN ('confirmed', 'checked_in')
        AND b.deposit_box_number IS NOT NULL
      ORDER BY b.id
    `);

    console.log(`Found ${bookingsResult.rows.length} bookings with deposit box data\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const booking of bookingsResult.rows) {
      // Get the correct deposit box for this apartment
      const depositBoxResult = await pool.query(`
        SELECT box_number, current_pin
        FROM deposit_boxes
        WHERE apartment_id = $1
        LIMIT 1
      `, [booking.apartment_id]);

      if (depositBoxResult.rows.length === 0) {
        console.log(`⚠️  No deposit box found for apartment ${booking.unit_number} (booking ${booking.id})`);
        skippedCount++;
        continue;
      }

      const correctBox = depositBoxResult.rows[0];

      // Check if the booking has wrong data
      if (booking.deposit_box_number !== correctBox.box_number ||
          booking.deposit_box_pin !== correctBox.current_pin) {

        console.log(`📝 Fixing booking ${booking.id} (${booking.guest_email}):`);
        console.log(`   Old: ${booking.deposit_box_number} / PIN: ${booking.deposit_box_pin}`);
        console.log(`   New: ${correctBox.box_number} / PIN: ${correctBox.current_pin}`);

        // Update the booking with correct deposit box data
        await pool.query(`
          UPDATE bookings
          SET deposit_box_number = $1,
              deposit_box_pin = $2
          WHERE id = $3
        `, [correctBox.box_number, correctBox.current_pin, booking.id]);

        // Also update the deposit_boxes table to link to this booking
        await pool.query(`
          UPDATE deposit_boxes
          SET current_booking_id = $1
          WHERE apartment_id = $2
        `, [booking.id, booking.apartment_id]);

        fixedCount++;
      } else {
        console.log(`✓  Booking ${booking.id} (${booking.guest_email}) already has correct deposit box`);
        skippedCount++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Fixed: ${fixedCount} bookings`);
    console.log(`   Skipped: ${skippedCount} bookings (already correct or no deposit box found)`);

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  fixDepositBoxConnections()
    .then(() => {
      console.log('\n✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDepositBoxConnections };

/**
 * Migration: Link All Active Bookings to Deposit Boxes
 * This script ensures all confirmed/checked-in bookings are properly linked to their deposit boxes
 */

const pool = require('../config/database').pool;

async function linkActiveBookings() {
  console.log('🔧 Linking active bookings to deposit boxes...\n');

  try {
    // Get all active bookings with their apartment info
    const bookingsResult = await pool.query(`
      SELECT
        b.id,
        b.booking_number,
        b.guest_name,
        b.guest_email,
        b.apartment_id,
        b.deposit_box_number,
        b.status,
        b.created_at,
        a.unit_number,
        db.id as box_id,
        db.box_number as actual_box_number,
        db.current_booking_id
      FROM bookings b
      LEFT JOIN apartments a ON b.apartment_id = a.id
      LEFT JOIN deposit_boxes db ON db.apartment_id = b.apartment_id
      WHERE b.status IN ('confirmed', 'checked_in')
      ORDER BY b.apartment_id, b.created_at DESC
    `);

    if (bookingsResult.rows.length === 0) {
      console.log('✓ No active bookings found to link');
      return;
    }

    console.log(`Found ${bookingsResult.rows.length} active booking(s)\n`);

    // Group bookings by apartment to handle conflicts
    const apartmentBookings = {};
    bookingsResult.rows.forEach(booking => {
      if (!apartmentBookings[booking.apartment_id]) {
        apartmentBookings[booking.apartment_id] = [];
      }
      apartmentBookings[booking.apartment_id].push(booking);
    });

    let linkedCount = 0;
    let skippedCount = 0;
    let conflictCount = 0;

    // Process each apartment
    for (const [apartmentId, bookings] of Object.entries(apartmentBookings)) {
      if (bookings.length === 0) continue;

      // If multiple bookings for same apartment, use the most recent one
      const mostRecentBooking = bookings[0]; // Already sorted by created_at DESC

      if (bookings.length > 1) {
        console.log(`⚠️  Apartment ${mostRecentBooking.unit_number} has ${bookings.length} active bookings`);
        console.log(`   Using most recent: Booking #${mostRecentBooking.booking_number} (${mostRecentBooking.guest_name})`);
        conflictCount++;
      }

      if (!mostRecentBooking.box_id) {
        console.log(`⚠️  No deposit box found for apartment ${mostRecentBooking.unit_number}`);
        skippedCount++;
        continue;
      }

      // Check if already linked
      if (mostRecentBooking.current_booking_id === mostRecentBooking.id) {
        console.log(`✓ Booking #${mostRecentBooking.booking_number} already linked to ${mostRecentBooking.actual_box_number}`);
        skippedCount++;
        continue;
      }

      // Link the deposit box to this booking
      console.log(`📦 Linking ${mostRecentBooking.actual_box_number} → Booking #${mostRecentBooking.booking_number}`);
      console.log(`   Guest: ${mostRecentBooking.guest_name} (${mostRecentBooking.guest_email})`);
      console.log(`   Apartment: ${mostRecentBooking.unit_number}`);

      await pool.query(`
        UPDATE deposit_boxes
        SET current_booking_id = $1,
            status = 'empty'
        WHERE id = $2
      `, [mostRecentBooking.id, mostRecentBooking.box_id]);

      linkedCount++;
      console.log('   ✅ Linked successfully\n');
    }

    console.log('═'.repeat(60));
    console.log('Migration Summary:');
    console.log(`  ✅ Linked: ${linkedCount} booking(s)`);
    console.log(`  ⏭️  Skipped: ${skippedCount} booking(s) (already linked or no box)`);
    if (conflictCount > 0) {
      console.log(`  ⚠️  Conflicts resolved: ${conflictCount} apartment(s) with multiple bookings`);
    }
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  linkActiveBookings()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { linkActiveBookings };

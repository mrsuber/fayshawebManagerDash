/**
 * Migration: Fix Deposit Box Foreign Keys
 * Run this to fix issues when bookings are deleted but deposit boxes still reference them
 */

const pool = require('../config/database').pool;
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 Starting deposit box foreign key migration...\n');

  try {
    // Step 1: Clear stale booking references
    console.log('Step 1: Clearing stale booking references from deposit boxes...');
    const clearResult = await pool.query(`
      UPDATE deposit_boxes db
      SET current_booking_id = NULL
      WHERE current_booking_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM bookings b WHERE b.id = db.current_booking_id
        )
      RETURNING id, box_number
    `);
    console.log(`✓ Cleared ${clearResult.rowCount} deposit boxes with deleted booking references`);
    if (clearResult.rows.length > 0) {
      clearResult.rows.forEach(box => {
        console.log(`  - Box ${box.box_number} (ID: ${box.id})`);
      });
    }

    // Step 2: Drop and recreate deposit_box_history foreign key
    console.log('\nStep 2: Updating deposit_box_history foreign key constraint...');
    await pool.query(`
      ALTER TABLE deposit_box_history
      DROP CONSTRAINT IF EXISTS deposit_box_history_booking_id_fkey
    `);
    console.log('✓ Dropped old constraint');

    await pool.query(`
      ALTER TABLE deposit_box_history
      ADD CONSTRAINT deposit_box_history_booking_id_fkey
      FOREIGN KEY (booking_id)
      REFERENCES bookings(id)
      ON DELETE SET NULL
    `);
    console.log('✓ Created new constraint with ON DELETE SET NULL');

    // Step 3: Drop and recreate deposit_boxes foreign key
    console.log('\nStep 3: Updating deposit_boxes foreign key constraint...');
    await pool.query(`
      ALTER TABLE deposit_boxes
      DROP CONSTRAINT IF EXISTS deposit_boxes_current_booking_id_fkey
    `);
    console.log('✓ Dropped old constraint');

    await pool.query(`
      ALTER TABLE deposit_boxes
      ADD CONSTRAINT deposit_boxes_current_booking_id_fkey
      FOREIGN KEY (current_booking_id)
      REFERENCES bookings(id)
      ON DELETE SET NULL
    `);
    console.log('✓ Created new constraint with ON DELETE SET NULL');

    // Step 4: Verify
    console.log('\nStep 4: Verifying changes...');
    const verifyResult = await pool.query(`
      SELECT
        'Deposit boxes with null booking_id' as check_type,
        COUNT(*) as count
      FROM deposit_boxes
      WHERE current_booking_id IS NULL

      UNION ALL

      SELECT
        'Deposit boxes with valid booking_id' as check_type,
        COUNT(*) as count
      FROM deposit_boxes db
      WHERE current_booking_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = db.current_booking_id)
    `);

    console.log('\nVerification Results:');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.check_type}: ${row.count}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('You can now record package deliveries without errors.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };

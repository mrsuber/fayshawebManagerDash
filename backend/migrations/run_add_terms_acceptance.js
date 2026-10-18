/**
 * Migration: Add Terms and Conditions Acceptance to Bookings
 * Adds fields to track T&C acceptance for each booking
 */

const pool = require('../config/database').pool;

async function runMigration() {
  console.log('🔧 Adding T&C acceptance fields to bookings table...\n');

  try {
    // Step 1: Add terms acceptance columns
    console.log('Step 1: Adding terms_accepted and terms_accepted_at columns...');
    await pool.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP
    `);
    console.log('✓ Columns added successfully');

    // Step 2: Create index for better query performance
    console.log('\nStep 2: Creating index on terms_accepted...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_terms_accepted ON bookings(terms_accepted)
    `);
    console.log('✓ Index created successfully');

    // Step 3: Verify the changes
    console.log('\nStep 3: Verifying columns...');
    const verifyResult = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
        AND column_name IN ('terms_accepted', 'terms_accepted_at')
      ORDER BY column_name
    `);

    console.log('\nVerification Results:');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.column_name}:`);
      console.log(`    - Type: ${row.data_type}`);
      console.log(`    - Nullable: ${row.is_nullable}`);
      console.log(`    - Default: ${row.column_default || 'NULL'}`);
    });

    // Step 4: Check current bookings count
    console.log('\nStep 4: Checking existing bookings...');
    const bookingsResult = await pool.query(`
      SELECT
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN terms_accepted = true THEN 1 END) as accepted_count,
        COUNT(CASE WHEN terms_accepted = false THEN 1 END) as not_accepted_count
      FROM bookings
    `);

    const stats = bookingsResult.rows[0];
    console.log(`  Total bookings: ${stats.total_bookings}`);
    console.log(`  Terms accepted: ${stats.accepted_count}`);
    console.log(`  Terms not accepted: ${stats.not_accepted_count}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('All new bookings will now require T&C acceptance before payment.');

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

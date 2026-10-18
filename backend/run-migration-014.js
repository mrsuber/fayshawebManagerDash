/**
 * Migration Runner: Add Digital Key Fields
 * Run this script on the VPS to apply migration 014
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

// Create database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fayshaa',
  user: process.env.DB_USER || 'fayshaa_user',
  password: String(process.env.DB_PASSWORD || ''),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runMigration() {
  console.log('🔧 Starting migration: Add Digital Key Fields...');
  console.log('Database:', process.env.DB_NAME);
  console.log('User:', process.env.DB_USER);

  try {
    // Execute each SQL statement separately
    console.log('\n📋 Adding columns to bookings table...');

    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gate_qr_code VARCHAR(255)');
    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS door_pin VARCHAR(4)');
    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_box_number VARCHAR(10)');
    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_box_pin VARCHAR(4)');
    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS keys_generated_at TIMESTAMP');
    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP');

    console.log('✅ Bookings table updated');

    console.log('\n📋 Adding columns to wellness_journey_bookings table...');

    await pool.query('ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS journey_pin VARCHAR(4)');
    await pool.query('ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255)');
    await pool.query('ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS keys_generated_at TIMESTAMP');
    await pool.query('ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE wellness_journey_bookings ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP');

    console.log('✅ Wellness journey bookings table updated');

    console.log('\n📋 Creating indexes...');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_bookings_gate_qr_code ON bookings(gate_qr_code)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_bookings_user_active ON bookings(user_id, status) WHERE status IN (\'confirmed\', \'checked_in\')');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_wellness_journey_bookings_user_active ON wellness_journey_bookings(user_id, status) WHERE status = \'confirmed\'');

    console.log('✅ Indexes created');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nAdded columns:');
    console.log('  - bookings: gate_qr_code, door_pin, deposit_box_number, deposit_box_pin');
    console.log('  - bookings: keys_generated_at, email_sent, email_sent_at');
    console.log('  - wellness_journey_bookings: journey_pin, qr_code');
    console.log('  - wellness_journey_bookings: keys_generated_at, email_sent, email_sent_at');
    console.log('\nIndexes created:');
    console.log('  - idx_bookings_gate_qr_code');
    console.log('  - idx_bookings_user_active');
    console.log('  - idx_wellness_journey_bookings_user_active');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

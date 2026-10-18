/**
 * Run Deposit Box Migration
 * Creates deposit_boxes and deposit_box_history tables
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./config/database');

async function runMigration() {
  try {
    console.log('🔄 Running deposit box migration...');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '015_create_deposit_box_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('📦 Created deposit_boxes table');
    console.log('📜 Created deposit_box_history table');
    console.log('🔢 Created generate_deposit_box_pin() function');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

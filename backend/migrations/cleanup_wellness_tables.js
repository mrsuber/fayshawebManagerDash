/**
 * Cleanup Script - Drop old wellness tables
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/database');

async function cleanup() {
  try {
    console.log('🧹 Cleaning up old wellness tables...\n');

    // Drop views first
    const views = [
      'wellness_journey_bookings_view'
    ];

    for (const view of views) {
      try {
        await pool.query(`DROP VIEW IF EXISTS ${view} CASCADE`);
        console.log(`✓ Dropped view: ${view}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${view}: ${error.message}`);
      }
    }

    // Drop indexes
    const indexes = [
      'idx_wellness_activities_type',
      'idx_wellness_activities_category',
      'idx_wellness_activities_active',
      'idx_activity_stages_activity',
      'idx_wellness_bookings_user',
      'idx_wellness_bookings_apartment',
      'idx_wellness_bookings_activity',
      'idx_wellness_bookings_date',
      'idx_wellness_bookings_status',
      'idx_wellness_bookings_user_date_time',
      'idx_booking_stages_booking',
      'idx_booking_stages_status',
      'idx_wellness_availability_activity',
      'idx_wellness_availability_date',
      'idx_wellness_availability_available'
    ];

    for (const index of indexes) {
      try {
        await pool.query(`DROP INDEX IF EXISTS ${index} CASCADE`);
        console.log(`✓ Dropped index: ${index}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${index}: ${error.message}`);
      }
    }

    // Drop tables in reverse order of dependencies
    const tables = [
      'wellness_booking_stages',
      'wellness_bookings',
      'wellness_availability',
      'wellness_activity_stages',
      'wellness_activities'
    ];

    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✓ Dropped table: ${table}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${table}: ${error.message}`);
      }
    }

    // Drop triggers and functions
    const triggers = [
      'validate_wellness_booking_dates',
      'update_wellness_activities_timestamp',
      'update_wellness_bookings_timestamp',
      'update_wellness_booking_stages_timestamp'
    ];

    for (const trigger of triggers) {
      try {
        await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON wellness_bookings CASCADE`);
        console.log(`✓ Dropped trigger: ${trigger}`);
      } catch (error) {
        console.log(`⚠️  Could not drop trigger ${trigger}: ${error.message}`);
      }
    }

    const functions = [
      'check_wellness_booking_dates',
      'update_wellness_updated_at'
    ];

    for (const func of functions) {
      try {
        await pool.query(`DROP FUNCTION IF EXISTS ${func}() CASCADE`);
        console.log(`✓ Dropped function: ${func}`);
      } catch (error) {
        console.log(`⚠️  Could not drop function ${func}: ${error.message}`);
      }
    }

    console.log('\n✨ Cleanup completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();

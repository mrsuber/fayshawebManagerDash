/**
 * Migration Runner
 * Run SQL migration files against the database
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/database');

async function runMigration(filename) {
  const filepath = path.join(__dirname, filename);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ Migration file not found: ${filename}`);
    process.exit(1);
  }

  console.log(`📄 Reading migration: ${filename}`);
  const sql = fs.readFileSync(filepath, 'utf8');

  try {
    console.log(`🔄 Running migration: ${filename}`);
    await pool.query(sql);
    console.log(`✅ Migration completed successfully: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function main() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('Usage: node migrations/run.js <migration-file.sql>');
    console.error('Example: node migrations/run.js 017_create_unified_wellness_system.sql');
    process.exit(1);
  }

  console.log('🚀 Starting migration...\n');

  await runMigration(migrationFile);

  console.log('\n✨ All migrations completed successfully!');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

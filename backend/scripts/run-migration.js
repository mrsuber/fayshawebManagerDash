#!/usr/bin/env node
/**
 * Database Migration Runner
 * Runs SQL migration files and handles special cases like password hashing
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fayshaa',
  user: process.env.DB_USER || 'fayshaauser',
  password: process.env.DB_PASSWORD
});

/**
 * Run a migration file
 */
async function runMigration(filename) {
  const client = await pool.connect();

  try {
    console.log(`\n📄 Running migration: ${filename}`);

    const migrationPath = path.join(__dirname, '../migrations', filename);
    let sql = fs.readFileSync(migrationPath, 'utf8');

    // Special handling for users migration - replace dummy password hash
    if (filename.includes('users_and_roles')) {
      console.log('  🔐 Hashing default superadmin password...');
      const defaultPassword = 'Admin@2024!';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      // Replace the dummy hash with real hash
      sql = sql.replace(
        '$2b$10$rQZ5Z9Z5Z9Z5Z9Z5Z9Z5ZuDummy.Hash.Replace.In.Code',
        passwordHash
      );

      console.log('  ✓ Password hashed successfully');
      console.log(`  ⚠️  DEFAULT CREDENTIALS - CHANGE IMMEDIATELY:`);
      console.log(`     Email: admin@fayshaa.com`);
      console.log(`     Username: superadmin`);
      console.log(`     Password: ${defaultPassword}`);
    }

    // Execute migration
    await client.query(sql);

    console.log(`  ✅ Migration completed: ${filename}`);
  } catch (error) {
    console.error(`  ❌ Migration failed: ${filename}`);
    console.error(`  Error: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node run-migration.js <migration-file>

Examples:
  node run-migration.js 003_create_users_and_roles_tables.sql
  node run-migration.js all  (runs all pending migrations)

Available migrations:
`);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    files.forEach(file => console.log(`  - ${file}`));

    process.exit(0);
  }

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully\n');

    if (args[0] === 'all') {
      // Run all migrations in order
      const migrationsDir = path.join(__dirname, '../migrations');
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`📚 Running ${files.length} migrations...\n`);

      for (const file of files) {
        await runMigration(file);
      }

      console.log('\n✅ All migrations completed successfully!');
    } else {
      // Run specific migration
      await runMigration(args[0]);
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration };

/**
 * Database setup.
 *
 *   node db/setup.js            On an empty database: create the schema (db/schema.sql). Then, always, make sure
 *                               the base data exists (roles, the property, settings, HR lists, wellness catalogue)
 *                               and that there is a super administrator. Safe to run again: nothing is duplicated
 *                               or overwritten.
 *   node db/setup.js --demo     Also load sample residences, guests, stays and operations data (for trying the
 *                               platform out; not for production).
 *   node db/setup.js --reset    Drop everything first (refused when NODE_ENV=production).
 *
 * The first super administrator is SEED_ADMIN_EMAIL (default admin@fayshaa.com) with SEED_ADMIN_PASSWORD, or a
 * generated password that is printed once and must be changed at first sign-in.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const base = require('./data/base');

const args = new Set(process.argv.slice(2));

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'fayshaa',
    user: process.env.DB_USER || 'fayshaauser',
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  const db = process.env.DB_NAME || 'fayshaa';

  try {
    if (args.has('--reset')) {
      if (process.env.NODE_ENV === 'production') throw new Error('--reset is refused when NODE_ENV=production');
      console.log(`Dropping everything in database "${db}"…`);
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    }

    const { rows } = await client.query(`SELECT to_regclass('public.users') IS NOT NULL AS exists`);
    if (!rows[0].exists) {
      const tables = await client.query(`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`);
      if (tables.rows[0].n > 0) {
        throw new Error(`Database "${db}" has tables but not the Faysha schema. Use an empty database, or --reset (development only).`);
      }
      console.log('Creating the schema…');
      await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    }

    await client.query('BEGIN');
    await base.load(client);
    const admin = await ensureSuperAdmin(client);
    await client.query('COMMIT');
    console.log('Base data is in place.');

    if (args.has('--demo')) {
      await client.query('BEGIN');
      const accounts = await require('./data/demo').load(client);
      await client.query('COMMIT');
      console.log('Demo data loaded. Sign-ins (password for all: Faysha2026!):');
      for (const a of accounts) console.log(`  ${a.role.padEnd(12)} ${a.email}`);
    }

    if (admin) {
      console.log('\nSuper administrator created:');
      console.log(`  email:    ${admin.email}`);
      console.log(`  password: ${admin.password}${admin.temporary ? '   (one-time: you will be asked to change it)' : ''}`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

/** Creates the first super administrator when there is none. Returns its sign-in, or null. */
async function ensureSuperAdmin(client) {
  const existing = await client.query(
    `SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'superadmin' AND u.deleted_at IS NULL LIMIT 1`
  );
  if (existing.rows[0]) return null;

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@fayshaa.com').toLowerCase();
  const given = process.env.SEED_ADMIN_PASSWORD;
  const password = given || crypto.randomBytes(12).toString('base64url');
  await client.query(
    `INSERT INTO users (email, username, password_hash, full_name, role_id, status, email_verified,
                        is_password_temporary, must_change_password, password_changed_at)
     VALUES ($1, 'superadmin', $2, $3, (SELECT id FROM roles WHERE name = 'superadmin'), 'active', true, $4, $4,
             CASE WHEN $4 THEN NULL ELSE CURRENT_TIMESTAMP END)`,
    [email, await bcrypt.hash(password, 10), process.env.SEED_ADMIN_NAME || 'Super Administrator', !given]
  );
  return { email, password, temporary: !given };
}

main();

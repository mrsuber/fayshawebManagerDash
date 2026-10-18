/**
 * Seed Script: Create Super Admin and Content Manager Accounts for Fayshaa
 * This script creates:
 * 1. Super admin account: mohamad.siysinyuy@gmail.com
 * 2. Content manager account: mosesbesongmoses@gmail.com
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fayshaa',
  user: process.env.DB_USER || 'fayshaauser',
  password: process.env.DB_PASSWORD,
});

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting Fayshaa database seeding...\n');

    await client.query('BEGIN');

    // 1. Create Super Admin Account
    console.log('👤 Creating Super Admin account...');
    const adminPasswordHash = await bcrypt.hash('Msb1@@@@', 10);

    // Check if super admin role exists
    const superAdminRole = await client.query(`
      SELECT id FROM roles WHERE name = 'superadmin'
    `);

    if (superAdminRole.rows.length === 0) {
      throw new Error('Super admin role not found. Please run migrations first.');
    }

    const superadminRoleId = superAdminRole.rows[0].id;

    // Create or update super admin user
    const adminResult = await client.query(`
      INSERT INTO users (
        email,
        username,
        password_hash,
        full_name,
        role_id,
        status,
        email_verified,
        is_password_temporary,
        must_change_password
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        email_verified = EXCLUDED.email_verified
      RETURNING id, email, username, full_name
    `, [
      'mohamad.siysinyuy@gmail.com',
      'mohamad.siysinyuy',
      adminPasswordHash,
      'Mohamad Siysinyuy',
      superadminRoleId,
      'active',
      true,
      false,
      false
    ]);

    const adminUser = adminResult.rows[0];
    console.log(`✅ Super Admin created: ${adminUser.email} (ID: ${adminUser.id}, Username: ${adminUser.username})`);

    // 2. Create Content Manager Account
    console.log('\n👤 Creating Content Manager account...');
    const coachPasswordHash = await bcrypt.hash('Msb1@@@@', 10);

    // Check if content_manager role exists
    const contentManagerRole = await client.query(`
      SELECT id FROM roles WHERE name = 'content_manager'
    `);

    if (contentManagerRole.rows.length === 0) {
      throw new Error('Content manager role not found. Please run migrations first.');
    }

    const contentManagerRoleId = contentManagerRole.rows[0].id;

    // Create or update content manager user
    const coachResult = await client.query(`
      INSERT INTO users (
        email,
        username,
        password_hash,
        full_name,
        role_id,
        status,
        email_verified,
        is_password_temporary,
        must_change_password
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        status = EXCLUDED.status,
        email_verified = EXCLUDED.email_verified
      RETURNING id, email, username, full_name
    `, [
      'mosesbesongmoses@gmail.com',
      'mosesbesongmoses',
      coachPasswordHash,
      'Moses Besong Moses',
      contentManagerRoleId,
      'active',
      true,
      false,
      false
    ]);

    const coachUser = coachResult.rows[0];
    console.log(`✅ Content Manager created: ${coachUser.email} (ID: ${coachUser.id}, Username: ${coachUser.username})`);

    await client.query('COMMIT');

    console.log('\n✅ Fayshaa database seeding completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Super Admin: mohamad.siysinyuy@gmail.com (Password: Msb1@@@@)`);
    console.log(`   - Content Manager: mosesbesongmoses@gmail.com (Password: Msb1@@@@)`);
    console.log('\n🔒 Please change these passwords after first login!');
    console.log('\n📍 Login URL: https://fayshaa.com/admin/login');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
seed()
  .then(() => {
    console.log('\n🎉 Seeding process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding process failed:', error);
    process.exit(1);
  });

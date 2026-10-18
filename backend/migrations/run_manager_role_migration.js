/**
 * Run Manager Role Migration
 * Adds the Manager role to the database
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'fayshaa_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fayshaa',
  password: process.env.DB_PASSWORD || 'ChangeMeL8ter!',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Running Manager Role Migration...\n');

    // Insert Manager role
    const result = await client.query(`
      INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES
      (
        'manager',
        'Manager',
        'Property Manager - Full access to reservations, bookings, and guest management',
        '{
          "reservations": {"view": true, "create": true, "edit": true, "delete": true, "manage": true},
          "bookings": {"view": true, "create": true, "edit": true, "delete": true, "manage": true},
          "guests": {"view": true, "create": true, "edit": true, "delete": false, "manage": true},
          "residences": {"view": true, "create": true, "edit": true, "delete": false},
          "calendar": {"view": true, "manage": true},
          "analytics": {"view": true},
          "concierge": {"view": true, "respond": true, "manage": true},
          "services": {"view": true, "manage": true},
          "wellness": {"view": true, "manage": true},
          "housekeeping": {"view": true, "assign": true, "manage": true},
          "maintenance": {"view": true, "assign": true, "manage": true},
          "dining": {"view": true, "manage": true},
          "transportation": {"view": true, "manage": true},
          "experiences": {"view": true, "manage": true}
        }',
        false
      )
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions
      RETURNING id, name, display_name;
    `);

    console.log('✅ Manager role added successfully!');
    console.log('   ID:', result.rows[0].id);
    console.log('   Name:', result.rows[0].name);
    console.log('   Display Name:', result.rows[0].display_name);

    // Verify the role exists
    const verifyResult = await client.query(
      "SELECT id, name, display_name FROM roles WHERE name = 'manager'"
    );

    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Verification successful - Manager role exists in database');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

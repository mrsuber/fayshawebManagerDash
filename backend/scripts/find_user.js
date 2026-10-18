/**
 * Find user by username or email
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'fayshaauser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fayshaa',
  password: process.env.DB_PASSWORD || 'ChangeMeL8ter!',
  port: process.env.DB_PORT || 5437,
});

const searchTerm = process.argv[2] || 'msiysinyuy';

async function findUser() {
  try {
    console.log(`Searching for user: ${searchTerm}...\n`);

    const result = await pool.query(`
      SELECT id, email, username, full_name, role_id, status, created_at
      FROM users
      WHERE username ILIKE $1 OR email ILIKE $1 OR full_name ILIKE $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [`%${searchTerm}%`]);

    if (result.rows.length === 0) {
      console.log('❌ No users found with that search term\n');
      console.log('Showing recent guest users instead:\n');

      const guestResult = await pool.query(`
        SELECT u.id, u.email, u.username, u.full_name, u.status, u.created_at
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'guest'
        ORDER BY u.created_at DESC
        LIMIT 10
      `);

      console.log('Recent Guest Users:');
      console.log('===================');
      guestResult.rows.forEach(user => {
        console.log(`ID: ${user.id} | Username: ${user.username} | Email: ${user.email}`);
        console.log(`  Name: ${user.full_name} | Status: ${user.status}`);
        console.log(`  Created: ${user.created_at}`);
        console.log('---');
      });
    } else {
      console.log('Found Users:');
      console.log('============');
      result.rows.forEach(user => {
        console.log(`ID: ${user.id} | Username: ${user.username} | Email: ${user.email}`);
        console.log(`  Name: ${user.full_name} | Status: ${user.status}`);
        console.log(`  Created: ${user.created_at}`);
        console.log('---');
      });
    }

    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    pool.end();
    process.exit(1);
  }
}

findUser();

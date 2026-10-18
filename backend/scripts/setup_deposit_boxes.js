/**
 * Setup Deposit Boxes
 * Creates deposit boxes and assigns them to apartments
 */

const pool = require('../config/database');

async function setupDepositBoxes() {
  try {
    console.log('🔧 Setting up deposit boxes...\n');

    // First, run the migration to create the tables
    console.log('Step 1: Creating deposit_boxes tables...');

    const migrationSQL = `
      -- Deposit Boxes Table (one per apartment)
      CREATE TABLE IF NOT EXISTS deposit_boxes (
        id SERIAL PRIMARY KEY,
        box_number VARCHAR(20) NOT NULL UNIQUE,
        apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
        current_booking_id INTEGER,
        current_pin VARCHAR(10),
        status VARCHAR(50) DEFAULT 'empty' CHECK (status IN ('empty', 'package_waiting', 'maintenance')),
        pin_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Deposit Box History Table (package delivery tracking)
      CREATE TABLE IF NOT EXISTS deposit_box_history (
        id SERIAL PRIMARY KEY,
        deposit_box_id INTEGER REFERENCES deposit_boxes(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        delivery_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        delivered_by VARCHAR(255),
        tracking_number VARCHAR(255),
        package_description TEXT,
        pin_used_by_delivery VARCHAR(10),
        new_pin_generated VARCHAR(10),
        status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'collected', 'returned')),
        collected_at TIMESTAMP WITH TIME ZONE,
        collected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_deposit_boxes_apartment ON deposit_boxes(apartment_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_boxes_booking ON deposit_boxes(current_booking_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_box ON deposit_box_history(deposit_box_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_booking ON deposit_box_history(booking_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_user ON deposit_box_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_status ON deposit_box_history(status);
      CREATE INDEX IF NOT EXISTS idx_deposit_box_history_delivery_date ON deposit_box_history(delivery_date DESC);

      -- Trigger to update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_deposit_box_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_deposit_boxes_updated_at ON deposit_boxes;
      CREATE TRIGGER update_deposit_boxes_updated_at BEFORE UPDATE ON deposit_boxes
        FOR EACH ROW EXECUTE FUNCTION update_deposit_box_updated_at();

      -- Create function to generate unique 4-digit PIN
      CREATE OR REPLACE FUNCTION generate_deposit_box_pin()
      RETURNS VARCHAR(10) AS $$
      DECLARE
        new_pin VARCHAR(10);
        pin_exists BOOLEAN;
      BEGIN
        LOOP
          -- Generate random 4-digit PIN
          new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

          -- Check if PIN is currently in use
          SELECT EXISTS(
            SELECT 1 FROM deposit_boxes
            WHERE current_pin = new_pin
            AND status = 'package_waiting'
          ) INTO pin_exists;

          -- Exit loop if PIN is unique
          EXIT WHEN NOT pin_exists;
        END LOOP;

        RETURN new_pin;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await pool.query(migrationSQL);
    console.log('✓ Tables created successfully\n');

    // Check if deposit boxes already exist
    const existingBoxes = await pool.query('SELECT COUNT(*) FROM deposit_boxes');
    const boxCount = parseInt(existingBoxes.rows[0].count);

    if (boxCount > 0) {
      console.log(`ℹ️  ${boxCount} deposit boxes already exist. Skipping creation.\n`);

      // Show existing boxes
      const boxes = await pool.query(`
        SELECT
          db.box_number,
          db.status,
          a.unit_number as apartment
        FROM deposit_boxes db
        LEFT JOIN apartments a ON db.apartment_id = a.id
        ORDER BY db.box_number
      `);

      console.log('Existing deposit boxes:');
      boxes.rows.forEach(box => {
        console.log(`  - Box ${box.box_number}: ${box.status} (Apartment: ${box.apartment || 'Not assigned'})`);
      });

      await pool.end();
      return;
    }

    // Get all apartments
    console.log('Step 2: Fetching apartments...');
    const apartmentsResult = await pool.query(`
      SELECT id, unit_number
      FROM apartments
      ORDER BY unit_number
      LIMIT 20
    `);

    const apartments = apartmentsResult.rows;
    console.log(`✓ Found ${apartments.length} apartments\n`);

    if (apartments.length === 0) {
      console.log('⚠️  No apartments found. Please create apartments first.');
      await pool.end();
      return;
    }

    // Create deposit boxes (one per apartment)
    console.log('Step 3: Creating deposit boxes...');

    for (let i = 0; i < apartments.length; i++) {
      const apartment = apartments[i];
      const boxNumber = `DB-${String(i + 1).padStart(3, '0')}`; // DB-001, DB-002, etc.

      // Generate initial PIN
      const pinResult = await pool.query('SELECT generate_deposit_box_pin() as pin');
      const initialPin = pinResult.rows[0].pin;

      await pool.query(`
        INSERT INTO deposit_boxes (box_number, apartment_id, current_pin, status)
        VALUES ($1, $2, $3, 'empty')
      `, [boxNumber, apartment.id, initialPin]);

      console.log(`  ✓ Created ${boxNumber} for Apartment ${apartment.unit_number} (PIN: ${initialPin})`);
    }

    console.log(`\n✅ Successfully created ${apartments.length} deposit boxes!`);

    // Show summary
    const summary = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(apartment_id) as assigned,
        COUNT(*) - COUNT(apartment_id) as unassigned
      FROM deposit_boxes
    `);

    const stats = summary.rows[0];
    console.log('\n📊 Summary:');
    console.log(`  Total boxes: ${stats.total}`);
    console.log(`  Assigned to apartments: ${stats.assigned}`);
    console.log(`  Unassigned: ${stats.unassigned}`);

    await pool.end();
    console.log('\n✨ Setup complete!');

  } catch (error) {
    console.error('❌ Error setting up deposit boxes:', error);
    process.exit(1);
  }
}

// Run the setup
setupDepositBoxes();

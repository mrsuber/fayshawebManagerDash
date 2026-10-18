/**
 * Seed Script: Populate Apartments for Testing
 *
 * This script populates the database with apartment categories and units
 * for testing the booking-to-account-creation flow.
 *
 * Usage:
 *   node scripts/seed_apartments.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Apartment categories data
const categories = [
  {
    name: 'studio',
    display_name: 'Studio Apartment',
    description: 'Modern studio with open-plan living space perfect for solo travelers or couples',
    base_price: 28000,
    max_guests: 2,
    size_sqm: 35,
    bedrooms: 0,
    bathrooms: 1,
    features: JSON.stringify([
      'WiFi',
      'Smart TV',
      'Air Conditioning',
      'Kitchenette',
      'Work Desk',
      'Safe',
    ]),
    amenities: JSON.stringify([
      'Pool Access',
      'Gym Access',
      'Smart Access',
      'Weekly Housekeeping',
    ]),
  },
  {
    name: '1br',
    display_name: 'One Bedroom Apartment',
    description: 'Spacious one bedroom with separate living area ideal for extended stays',
    base_price: 45000,
    max_guests: 3,
    size_sqm: 50,
    bedrooms: 1,
    bathrooms: 1,
    features: JSON.stringify([
      'WiFi',
      'Smart TV',
      'Air Conditioning',
      'Full Kitchen',
      'Balcony',
      'Work Desk',
      'Safe',
      'Washing Machine',
    ]),
    amenities: JSON.stringify([
      'Pool Access',
      'Gym Access',
      'Smart Access',
      'Weekly Housekeeping',
      'Concierge Service',
    ]),
  },
  {
    name: '2br',
    display_name: 'Two Bedroom Apartment',
    description: 'Family-friendly two bedroom apartment with ample space and modern amenities',
    base_price: 65000,
    max_guests: 5,
    size_sqm: 75,
    bedrooms: 2,
    bathrooms: 2,
    features: JSON.stringify([
      'WiFi',
      '2 Smart TVs',
      'Air Conditioning',
      'Full Kitchen',
      'Balcony',
      'Dining Area',
      'Work Desk',
      'Safe',
      'Washing Machine',
    ]),
    amenities: JSON.stringify([
      'Pool Access',
      'Gym Access',
      'Smart Access',
      'Weekly Housekeeping',
      'Concierge Service',
      'Parking Space',
    ]),
  },
  {
    name: 'executive',
    display_name: 'Executive Suite',
    description: 'Luxury executive suite with premium amenities and exclusive services',
    base_price: 95000,
    max_guests: 4,
    size_sqm: 90,
    bedrooms: 2,
    bathrooms: 2,
    features: JSON.stringify([
      'WiFi',
      '2 Smart TVs',
      'Premium Air Conditioning',
      'Gourmet Kitchen',
      'Private Terrace',
      'Premium Furnishing',
      'Executive Work Space',
      'Safe',
      'Washing Machine',
      'Wine Cooler',
    ]),
    amenities: JSON.stringify([
      'Private Pool Access',
      'Gym Access',
      'Smart Access',
      'Daily Housekeeping',
      '24/7 Concierge',
      'Parking Space',
      'Priority Services',
      'Airport Transfer',
    ]),
  },
];

// Apartment units data (multiple units per category)
const apartments = [
  // Studio apartments (Building A, Ground & 1st floors)
  { category: 'studio', unit_number: 'A-101', floor: 1, building: 'Building A' },
  { category: 'studio', unit_number: 'A-102', floor: 1, building: 'Building A' },
  { category: 'studio', unit_number: 'A-103', floor: 1, building: 'Building A' },
  { category: 'studio', unit_number: 'A-201', floor: 2, building: 'Building A' },
  { category: 'studio', unit_number: 'A-202', floor: 2, building: 'Building A' },

  // 1BR apartments (Building A, 2nd & 3rd floors + Building B)
  { category: '1br', unit_number: 'A-203', floor: 2, building: 'Building A' },
  { category: '1br', unit_number: 'A-301', floor: 3, building: 'Building A' },
  { category: '1br', unit_number: 'A-302', floor: 3, building: 'Building A' },
  { category: '1br', unit_number: 'B-101', floor: 1, building: 'Building B' },
  { category: '1br', unit_number: 'B-102', floor: 1, building: 'Building B' },
  { category: '1br', unit_number: 'B-201', floor: 2, building: 'Building B' },
  { category: '1br', unit_number: 'B-202', floor: 2, building: 'Building B' },

  // 2BR apartments (Building B, upper floors)
  { category: '2br', unit_number: 'B-301', floor: 3, building: 'Building B' },
  { category: '2br', unit_number: 'B-302', floor: 3, building: 'Building B' },
  { category: '2br', unit_number: 'B-401', floor: 4, building: 'Building B' },
  { category: '2br', unit_number: 'B-402', floor: 4, building: 'Building B' },
  { category: '2br', unit_number: 'B-501', floor: 5, building: 'Building B' },

  // Executive suites (Building C - Premium)
  { category: 'executive', unit_number: 'C-101', floor: 1, building: 'Building C - Premium Wing' },
  { category: 'executive', unit_number: 'C-201', floor: 2, building: 'Building C - Premium Wing' },
  { category: 'executive', unit_number: 'C-301', floor: 3, building: 'Building C - Premium Wing' },
];

async function seedApartments() {
  const client = await pool.connect();

  try {
    console.log('🏢 Starting apartment seeding...\n');

    await client.query('BEGIN');

    // ============================================
    // 1. Seed Apartment Categories
    // ============================================
    console.log('📋 Seeding apartment categories...');

    for (const category of categories) {
      // Check if category already exists
      const existingCategory = await client.query(
        'SELECT id FROM apartment_categories WHERE name = $1',
        [category.name]
      );

      if (existingCategory.rows.length > 0) {
        console.log(`   ⏭️  Category "${category.display_name}" already exists, skipping...`);
        continue;
      }

      const result = await client.query(
        `INSERT INTO apartment_categories
        (name, display_name, description, base_price, max_guests, size_sqm, bedrooms, bathrooms, features, amenities, is_active, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
        RETURNING id, display_name, base_price`,
        [
          category.name,
          category.display_name,
          category.description,
          category.base_price,
          category.max_guests,
          category.size_sqm,
          category.bedrooms,
          category.bathrooms,
          category.features,
          category.amenities,
          categories.indexOf(category), // sort_order
        ]
      );

      console.log(
        `   ✅ Created: ${result.rows[0].display_name} (${result.rows[0].base_price} XAF/night)`
      );
    }

    // ============================================
    // 2. Get category IDs for apartments
    // ============================================
    const categoryIds = {};
    const categoryResult = await client.query(
      'SELECT id, name FROM apartment_categories'
    );

    categoryResult.rows.forEach((row) => {
      categoryIds[row.name] = row.id;
    });

    // ============================================
    // 3. Seed Apartments
    // ============================================
    console.log('\n🏠 Seeding apartment units...');

    let createdCount = 0;
    let skippedCount = 0;

    for (const apt of apartments) {
      // Check if apartment already exists
      const existingApt = await client.query(
        'SELECT id FROM apartments WHERE unit_number = $1',
        [apt.unit_number]
      );

      if (existingApt.rows.length > 0) {
        console.log(`   ⏭️  Unit ${apt.unit_number} already exists, skipping...`);
        skippedCount++;
        continue;
      }

      const categoryId = categoryIds[apt.category];

      const result = await client.query(
        `INSERT INTO apartments
        (category_id, unit_number, floor, building, status, is_active)
        VALUES ($1, $2, $3, $4, 'available', true)
        RETURNING id, unit_number, building`,
        [categoryId, apt.unit_number, apt.floor, apt.building]
      );

      console.log(
        `   ✅ Created: ${result.rows[0].unit_number} - ${result.rows[0].building}`
      );
      createdCount++;
    }

    await client.query('COMMIT');

    // ============================================
    // 4. Summary
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('✨ Apartment seeding completed successfully!\n');

    const categoriesCount = await client.query(
      'SELECT COUNT(*) FROM apartment_categories WHERE is_active = true'
    );
    const apartmentsCount = await client.query(
      'SELECT COUNT(*) FROM apartments WHERE is_active = true'
    );

    console.log(`📊 Summary:`);
    console.log(`   - Categories: ${categoriesCount.rows[0].count}`);
    console.log(`   - Apartments: ${apartmentsCount.rows[0].count}`);
    console.log(`   - Created this run: ${createdCount} apartments`);
    console.log(`   - Skipped (existing): ${skippedCount} apartments`);

    // Show breakdown by category
    console.log('\n📈 Apartments by Category:');
    const breakdown = await client.query(`
      SELECT
        c.display_name,
        c.base_price,
        COUNT(a.id) as count
      FROM apartment_categories c
      LEFT JOIN apartments a ON a.category_id = c.id AND a.is_active = true
      WHERE c.is_active = true
      GROUP BY c.id, c.display_name, c.base_price, c.sort_order
      ORDER BY c.sort_order
    `);

    breakdown.rows.forEach((row) => {
      console.log(
        `   - ${row.display_name}: ${row.count} units (${row.base_price} XAF/night)`
      );
    });

    console.log('\n🎉 You can now test the booking flow!');
    console.log('='.repeat(50));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding apartments:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
seedApartments()
  .then(() => {
    console.log('\n✅ Seeding script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding script failed:', error);
    process.exit(1);
  });

/**
 * Seed Script: Add Apartment Images
 *
 * This script adds high-quality images for apartment categories including:
 * - Regular apartment photos
 * - 360° panoramic views
 *
 * Usage:
 *   node scripts/seed_apartment_images.js
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

// High-quality apartment images from Unsplash (free to use)
const apartmentImages = {
  studio: {
    images: [
      {
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
        title: 'Modern Studio Living Space',
        is_primary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80',
        title: 'Studio Kitchen Area',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=1200&q=80',
        title: 'Studio Sleeping Area',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1574643156929-51fa098b0394?w=1200&q=80',
        title: 'Studio Bathroom',
        is_primary: false,
      },
    ],
    panorama: {
      url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=2000&q=80',
      title: 'Studio 360° View',
    },
  },
  '1br': {
    images: [
      {
        url: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1200&q=80',
        title: 'One Bedroom Living Room',
        is_primary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=1200&q=80',
        title: 'Master Bedroom',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
        title: 'Modern Kitchen',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80',
        title: 'Bedroom View',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=1200&q=80',
        title: 'Balcony View',
        is_primary: false,
      },
    ],
    panorama: {
      url: 'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=2000&q=80',
      title: '1BR 360° Living Room View',
    },
  },
  '2br': {
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80',
        title: 'Two Bedroom Spacious Living Room',
        is_primary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200&q=80',
        title: 'Master Bedroom Suite',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1200&q=80',
        title: 'Second Bedroom',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1200&q=80',
        title: 'Full Kitchen with Dining',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=1200&q=80',
        title: 'Modern Bathroom',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=1200&q=80',
        title: 'Balcony City View',
        is_primary: false,
      },
    ],
    panorama: {
      url: 'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=2000&q=80',
      title: '2BR 360° Living Space View',
    },
  },
  executive: {
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=80',
        title: 'Executive Suite Luxury Living',
        is_primary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=1200&q=80',
        title: 'Executive Master Bedroom',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
        title: 'Gourmet Kitchen',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=80',
        title: 'Executive Dining Area',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=80',
        title: 'Luxury Bathroom',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80',
        title: 'Private Terrace',
        is_primary: false,
      },
      {
        url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80',
        title: 'Executive Work Space',
        is_primary: false,
      },
    ],
    panorama: {
      url: 'https://images.unsplash.com/photo-1560185009-5bf9f2849488?w=2000&q=80',
      title: 'Executive Suite 360° Panoramic View',
    },
  },
};

async function seedApartmentImages() {
  const client = await pool.connect();

  try {
    console.log('🖼️  Starting apartment images seeding...\n');

    await client.query('BEGIN');

    // Get all category IDs
    const categoriesResult = await client.query(
      'SELECT id, name FROM apartment_categories WHERE is_active = true'
    );

    const categories = categoriesResult.rows;

    let totalImagesAdded = 0;
    let totalPanoramasAdded = 0;

    for (const category of categories) {
      const categoryName = category.name;
      const categoryId = category.id;
      const imageData = apartmentImages[categoryName];

      if (!imageData) {
        console.log(`⚠️  No image data found for category: ${categoryName}, skipping...`);
        continue;
      }

      console.log(`📸 Processing images for category: ${category.name}`);

      // Clear existing media for this category
      const deleteResult = await client.query(
        'DELETE FROM apartment_media WHERE category_id = $1',
        [categoryId]
      );

      if (deleteResult.rowCount > 0) {
        console.log(`   🗑️  Removed ${deleteResult.rowCount} existing images`);
      }

      // Add regular images
      let sortOrder = 0;
      for (const image of imageData.images) {
        await client.query(
          `INSERT INTO apartment_media
          (category_id, media_type, file_url, title, is_primary, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [categoryId, 'image', image.url, image.title, image.is_primary, sortOrder]
        );

        console.log(`   ✅ Added: ${image.title}${image.is_primary ? ' (PRIMARY)' : ''}`);
        sortOrder++;
        totalImagesAdded++;
      }

      // Add 360° panorama
      if (imageData.panorama) {
        await client.query(
          `INSERT INTO apartment_media
          (category_id, media_type, file_url, title, is_primary, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [categoryId, 'panorama_360', imageData.panorama.url, imageData.panorama.title, false, sortOrder]
        );

        console.log(`   🌐 Added 360° panorama: ${imageData.panorama.title}`);
        totalPanoramasAdded++;
      }

      console.log('');
    }

    await client.query('COMMIT');

    // Display summary
    console.log('=' .repeat(60));
    console.log('✨ Apartment images seeding completed!\n');

    console.log(`📊 Summary:`);
    console.log(`   - Categories processed: ${categories.length}`);
    console.log(`   - Total images added: ${totalImagesAdded}`);
    console.log(`   - Total 360° panoramas added: ${totalPanoramasAdded}`);

    // Show media count per category
    console.log('\n📈 Images by Category:');
    const breakdown = await client.query(`
      SELECT
        c.display_name,
        COUNT(CASE WHEN am.media_type = 'image' THEN 1 END) as images,
        COUNT(CASE WHEN am.media_type = 'panorama_360' THEN 1 END) as panoramas,
        COUNT(*) as total
      FROM apartment_categories c
      LEFT JOIN apartment_media am ON am.category_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id, c.display_name, c.sort_order
      ORDER BY c.sort_order
    `);

    breakdown.rows.forEach((row) => {
      console.log(
        `   - ${row.display_name}: ${row.images} images, ${row.panoramas} panoramas (${row.total} total)`
      );
    });

    console.log('\n🎉 Images are now available for booking page!');
    console.log('=' .repeat(60));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding apartment images:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
seedApartmentImages()
  .then(() => {
    console.log('\n✅ Image seeding script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Image seeding script failed:', error);
    process.exit(1);
  });

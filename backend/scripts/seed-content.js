/**
 * Seed script to populate initial page content in the database
 * This imports the current content from the frontend translation files
 */

require('dotenv').config();
const { pool } = require('../config/database');

// English content for Home page
const homeContentEN = {
  hero: {
    title: "Smart Rental Living",
    subtitle: "Redefined",
    description: "Experience the perfect blend of Airbnb convenience and hotel luxury in Cameroon's first smart rental properties.",
    buttonPrimary: "Book Your Stay",
    buttonSecondary: "Learn More"
  },
  features: {
    sectionTitle: "What Makes Us",
    sectionAccent: "Unique",
    subtitle: "We're not just another rental platform. We own and manage every property with cutting-edge smart technology."
  },
  howItWorks: {
    sectionTitle: "How It",
    sectionAccent: "Works",
    subtitle: "Simple, seamless, and smart. Get started in three easy steps."
  },
  cta: {
    title: "Ready to Experience Smart Living?",
    description: "Book your stay today and discover why guests choose Faysha for comfort, convenience, and cutting-edge amenities.",
    button: "Book Your Stay Now"
  }
};

// French content for Home page
const homeContentFR = {
  hero: {
    title: "Location Intelligente",
    subtitle: "Redéfinie",
    description: "Découvrez le mélange parfait entre la commodité d'Airbnb et le luxe hôtelier dans les premières propriétés intelligentes du Cameroun.",
    buttonPrimary: "Réserver Votre Séjour",
    buttonSecondary: "En Savoir Plus"
  },
  features: {
    sectionTitle: "Ce Qui Nous Rend",
    sectionAccent: "Uniques",
    subtitle: "Nous ne sommes pas qu'une autre plateforme de location. Nous possédons et gérons chaque propriété avec une technologie intelligente de pointe."
  },
  howItWorks: {
    sectionTitle: "Comment Ça",
    sectionAccent: "Fonctionne",
    subtitle: "Simple, fluide et intelligent. Commencez en trois étapes faciles."
  },
  cta: {
    title: "Prêt à Découvrir la Vie Intelligente?",
    description: "Réservez votre séjour aujourd'hui et découvrez pourquoi les clients choisissent Faysha pour le confort, la commodité et les équipements de pointe.",
    button: "Réservez Maintenant"
  }
};

async function seedContent() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting content seeding...\n');

    await client.query('BEGIN');

    // Seed English content
    console.log('📝 Seeding English content for Home page...');
    for (const [section, sectionContent] of Object.entries(homeContentEN)) {
      for (const [key, value] of Object.entries(sectionContent)) {
        await client.query(
          `INSERT INTO page_content (page_id, language, section, content_key, content_value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (page_id, language, section, content_key)
           DO UPDATE SET content_value = $5, updated_at = CURRENT_TIMESTAMP`,
          ['home', 'en', section, key, value]
        );
      }
    }
    console.log('✅ English content seeded\n');

    // Seed French content
    console.log('📝 Seeding French content for Home page...');
    for (const [section, sectionContent] of Object.entries(homeContentFR)) {
      for (const [key, value] of Object.entries(sectionContent)) {
        await client.query(
          `INSERT INTO page_content (page_id, language, section, content_key, content_value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (page_id, language, section, content_key)
           DO UPDATE SET content_value = $5, updated_at = CURRENT_TIMESTAMP`,
          ['home', 'fr', section, key, value]
        );
      }
    }
    console.log('✅ French content seeded\n');

    await client.query('COMMIT');

    // Verify seeded data
    const result = await client.query(
      'SELECT page_id, language, COUNT(*) as content_count FROM page_content GROUP BY page_id, language'
    );

    console.log('📊 Seeding Summary:');
    console.log('===================');
    result.rows.forEach(row => {
      console.log(`${row.page_id} (${row.language}): ${row.content_count} items`);
    });
    console.log('\n✨ Content seeding completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding content:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed script
seedContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

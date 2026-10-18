const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

const wellnessActivities = [
  {
    mood_category: 'restore',
    name: 'Recovery Suite',
    duration: 'Private · 45 min',
    description: 'A private, first-class recovery experience combining heat, light, cold and rest.',
    image_url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
    features: ['Dry steam bath', 'Red light therapy', 'Cool plunge']
  },
  {
    mood_category: 'restore',
    name: 'Spa & Wellness',
    duration: 'Daily 9 AM - 9 PM',
    description: 'Luxurious spa treatments designed for complete relaxation and rejuvenation.',
    image_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
    features: ['Hot stone massage', 'Aromatherapy', 'Facial treatments', 'Body wraps']
  },
  {
    mood_category: 'restore',
    name: 'Meditation Garden',
    duration: 'Open 24/7',
    description: 'Peaceful outdoor sanctuary perfect for mindfulness and contemplation.',
    image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
    features: ['Zen garden', 'Water features', 'Guided meditation sessions']
  },
  {
    mood_category: 'recharge',
    name: 'Gym & Training',
    duration: 'Open 24/7',
    description: 'World-class equipment with personalised results in mind.',
    image_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    features: ['Cardio zone', 'Strength zone', 'Performance lab', 'Personal training']
  },
  {
    mood_category: 'recharge',
    name: 'Yoga & Pilates Studio',
    duration: 'Classes Daily 6 AM - 8 PM',
    description: 'Professional instructors lead energizing classes for all skill levels.',
    image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
    features: ['Vinyasa flow', 'Power yoga', 'Mat Pilates', 'Reformer Pilates']
  },
  {
    mood_category: 'recharge',
    name: 'Swimming Pool',
    duration: 'Open 6 AM - 10 PM',
    description: 'Olympic-size heated pool with stunning estate views.',
    image_url: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800',
    features: ['Lap swimming', 'Aqua fitness classes', 'Infinity edge', 'Pool bar']
  },
  {
    mood_category: 'reflect',
    name: 'Library & Reading Room',
    duration: 'Open 24/7',
    description: 'Quiet sanctuary with curated collection of books and comfortable seating.',
    image_url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800',
    features: ['Extensive book collection', 'Private reading nooks', 'Study spaces']
  },
  {
    mood_category: 'reflect',
    name: 'Art Gallery',
    duration: 'Daily 10 AM - 6 PM',
    description: 'Rotating exhibitions of contemporary and classical art.',
    image_url: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800',
    features: ['Curated exhibitions', 'Artist talks', 'Private viewings']
  },
  {
    mood_category: 'reflect',
    name: 'Sunset Terrace',
    duration: 'Open 24/7',
    description: 'Panoramic views perfect for watching the day fade into night.',
    image_url: 'https://images.unsplash.com/photo-1509233725247-49e657c54213?w=800',
    features: ['360° views', 'Comfortable seating', 'Evening cocktails']
  },
  {
    mood_category: 'explore',
    name: 'Nature Trails',
    duration: 'Guided tours 7 AM - 5 PM',
    description: 'Scenic walking paths through pristine natural landscapes.',
    image_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    features: ['Guided nature walks', 'Bird watching', 'Photography spots']
  },
  {
    mood_category: 'explore',
    name: 'Culinary Experiences',
    duration: 'Classes Daily 10 AM - 3 PM',
    description: 'Interactive cooking classes with renowned chefs.',
    image_url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800',
    features: ['Chef-led workshops', 'Wine pairings', 'Farm-to-table tours']
  },
  {
    mood_category: 'explore',
    name: 'Cultural Excursions',
    duration: 'Schedule varies',
    description: 'Curated tours to local attractions and cultural landmarks.',
    image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800',
    features: ['Local market tours', 'Historical sites', 'Art galleries', 'Private guides']
  }
];

const wellnessZones = [
  {
    name: 'The Sanctuary',
    subtitle: 'East Wing, Ground Floor',
    description: 'A tranquil wellness center featuring spa treatments, meditation spaces, and recovery facilities.',
    image_url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
    features: ['Spa', 'Sauna', 'Steam room', 'Meditation garden', 'Recovery suite'],
    glyph: '🧘'
  },
  {
    name: 'The Athletic Club',
    subtitle: 'West Wing, Lower Level',
    description: 'State-of-the-art fitness facilities with professional equipment and training spaces.',
    image_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    features: ['Gym', 'Yoga studio', 'Pilates studio', 'Personal training rooms', 'Locker rooms'],
    glyph: '💪'
  },
  {
    name: 'The Aquatic Center',
    subtitle: 'South Gardens',
    description: 'Luxurious pool complex with indoor and outdoor swimming facilities.',
    image_url: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800',
    features: ['Olympic pool', 'Heated pool', 'Jacuzzi', 'Pool bar', 'Changing facilities'],
    glyph: '🏊'
  },
  {
    name: 'The Cultural Quarter',
    subtitle: 'North Wing, Upper Floors',
    description: 'Inspiring spaces for art, literature, and cultural enrichment.',
    image_url: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800',
    features: ['Library', 'Art gallery', 'Reading rooms', 'Exhibition spaces', 'Sunset terrace'],
    glyph: '🎨'
  },
  {
    name: 'The Estate Grounds',
    subtitle: 'Surrounding Property',
    description: 'Extensive outdoor spaces featuring natural beauty and recreational activities.',
    image_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    features: ['Nature trails', 'Gardens', 'Outdoor pavilions', 'Picnic areas', 'Scenic viewpoints'],
    glyph: '🌳'
  }
];

async function seedWellnessData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding wellness activities...');

    // Insert activities
    for (const activity of wellnessActivities) {
      const result = await client.query(`
        INSERT INTO wellness_activities (mood_category, name, duration, description, image_url, features)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING id, name
      `, [
        activity.mood_category,
        activity.name,
        activity.duration,
        activity.description,
        activity.image_url,
        JSON.stringify(activity.features)
      ]);

      if (result.rows.length > 0) {
        console.log(`  ✅ Added activity: ${result.rows[0].name}`);
      }
    }

    console.log('\n🏛️ Seeding wellness zones...');

    // Insert zones
    for (const zone of wellnessZones) {
      const result = await client.query(`
        INSERT INTO wellness_zones (name, subtitle, description, image_url, features, glyph)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING id, name
      `, [
        zone.name,
        zone.subtitle,
        zone.description,
        zone.image_url,
        JSON.stringify(zone.features),
        zone.glyph
      ]);

      if (result.rows.length > 0) {
        console.log(`  ✅ Added zone: ${result.rows[0].name}`);
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Wellness data seeding completed successfully!');
    console.log(`   - ${wellnessActivities.length} activities added`);
    console.log(`   - ${wellnessZones.length} zones added`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding wellness data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedWellnessData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

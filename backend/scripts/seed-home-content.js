#!/usr/bin/env node

const db = require('../config/database');

const homeContentEN = {
  hero: {
    title: "Smart Rental Living",
    subtitle: "Redefined",
    description: "Experience the perfect blend of Airbnb convenience and hotel luxury in Cameroon's first smart rental properties.",
    buttonPrimary: "Book Your Stay",
    buttonSecondary: "Learn More"
  },
  stats: {
    properties: "100+",
    propertiesLabel: "Properties",
    guests: "5000+",
    guestsLabel: "Happy Guests",
    support: "24/7",
    supportLabel: "Support",
    rating: "4.9/5",
    ratingLabel: "Rating"
  },
  features: {
    sectionTitle: "What Makes Us",
    sectionAccent: "Unique",
    subtitle: "We're not just another rental platform. We own and manage every property with cutting-edge smart technology.",
    feature1Title: "Owned Properties",
    feature1Desc: "Fully furnished apartments and rooms in our own buildings, ensuring consistent quality and comfort.",
    feature2Title: "Smart Access",
    feature2Desc: "Auto-generated time-limited codes for seamless entry. No keys, no hassle.",
    feature3Title: "Smart TV Integration",
    feature3Desc: "Control your room, book services, and check schedules right from your in-room Smart TV.",
    feature4Title: "Premium Amenities",
    feature4Desc: "Pool, gym, and concierge services. Hotel luxury meets home comfort."
  },
  howItWorks: {
    sectionTitle: "How It",
    sectionAccent: "Works",
    subtitle: "Simple, seamless, and smart. Get started in three easy steps.",
    step1Number: "01",
    step1Title: "Browse & Book",
    step1Desc: "Search our fully furnished apartments and rooms, check availability, and book online instantly.",
    step2Number: "02",
    step2Title: "Receive Access Code",
    step2Desc: "Get your time-limited smart access code via email and SMS before arrival.",
    step3Number: "03",
    step3Title: "Check In & Enjoy",
    step3Desc: "Use your code to enter, explore amenities on your Smart TV, and enjoy your stay."
  },
  gallery: {
    sectionTitle: "Explore Our",
    sectionAccent: "Properties",
    subtitle: "Take a virtual tour of our beautifully furnished apartments, modern amenities, and luxury spaces.",
    panoramaUrl: "/images/panoramas/interior-luxury.jpg",
    featuredTitle: "Modern Luxury Interiors",
    featuredDesc: "Experience comfort and elegance in every corner",
    buttonText: "View All Amenities"
  },
  whyChoose: {
    sectionTitle: "Why Choose",
    sectionAccent: "Faysha",
    subtitle: "We're revolutionizing the rental experience in Cameroon with owned properties, smart technology, and unmatched hospitality.",
    benefit1Title: "Guaranteed Quality",
    benefit1Desc: "Every property is owned and maintained by us to ensure consistent excellence.",
    benefit2Title: "Instant Access",
    benefit2Desc: "Smart locks with time-limited codes mean seamless check-in, no waiting.",
    benefit3Title: "Best Value",
    benefit3Desc: "Competitive pricing with hotel-grade amenities and services included.",
    benefit4Title: "24/7 Support",
    benefit4Desc: "Our on-site team is always ready to assist with any request."
  },
  testimonials: {
    sectionTitle: "What Our",
    sectionAccent: "Guests Say",
    subtitle: "Don't just take our word for it. Here's what our satisfied guests have to say.",
    testimonial1Text: "The smart access system made check-in so easy! I arrived late at night and had no issues getting in. The apartment was immaculate and the Smart TV had everything I needed.",
    testimonial2Text: "I stayed for 3 months while my house was being renovated. The gym and pool made it feel like a luxury resort. Best long-term rental experience in Cameroon!",
    testimonial3Text: "Faysha exceeded all expectations. The location, amenities, and service were perfect. I especially loved having a full kitchen and the concierge helped with all my restaurant bookings."
  },
  cta: {
    title: "Ready to Experience Smart Living?",
    description: "Book your stay today and discover the future of rental living in Cameroon.",
    button: "Book Now"
  }
};

const homeContentFR = {
  hero: {
    title: "Location Intelligente",
    subtitle: "Redéfinie",
    description: "Découvrez le mélange parfait entre la commodité d'Airbnb et le luxe hôtelier dans les premières propriétés intelligentes du Cameroun.",
    buttonPrimary: "Réservez Votre Séjour",
    buttonSecondary: "En Savoir Plus"
  },
  stats: {
    properties: "100+",
    propertiesLabel: "Propriétés",
    guests: "5000+",
    guestsLabel: "Clients Satisfaits",
    support: "24/7",
    supportLabel: "Support",
    rating: "4.9/5",
    ratingLabel: "Note"
  },
  features: {
    sectionTitle: "Ce Qui Nous Rend",
    sectionAccent: "Uniques",
    subtitle: "Nous ne sommes pas une simple plateforme de location. Nous possédons et gérons chaque propriété avec une technologie intelligente de pointe.",
    feature1Title: "Propriétés Possédées",
    feature1Desc: "Appartements et chambres entièrement meublés dans nos propres bâtiments, garantissant une qualité et un confort constants.",
    feature2Title: "Accès Intelligent",
    feature2Desc: "Codes à durée limitée générés automatiquement pour une entrée sans faille. Pas de clés, pas de tracas.",
    feature3Title: "Intégration Smart TV",
    feature3Desc: "Contrôlez votre chambre, réservez des services et consultez les horaires directement depuis votre Smart TV.",
    feature4Title: "Équipements Premium",
    feature4Desc: "Piscine, salle de sport et services de conciergerie. Le luxe hôtelier rencontre le confort de la maison."
  },
  howItWorks: {
    sectionTitle: "Comment Ça",
    sectionAccent: "Marche",
    subtitle: "Simple, fluide et intelligent. Commencez en trois étapes faciles.",
    step1Number: "01",
    step1Title: "Parcourir et Réserver",
    step1Desc: "Recherchez nos appartements et chambres entièrement meublés, vérifiez la disponibilité et réservez en ligne instantanément.",
    step2Number: "02",
    step2Title: "Recevoir le Code d'Accès",
    step2Desc: "Recevez votre code d'accès intelligent à durée limitée par e-mail et SMS avant l'arrivée.",
    step3Number: "03",
    step3Title: "Enregistrement et Profiter",
    step3Desc: "Utilisez votre code pour entrer, explorez les commodités sur votre Smart TV et profitez de votre séjour."
  },
  gallery: {
    sectionTitle: "Explorez Nos",
    sectionAccent: "Propriétés",
    subtitle: "Faites une visite virtuelle de nos appartements magnifiquement meublés, de nos équipements modernes et de nos espaces de luxe.",
    panoramaUrl: "/images/panoramas/interior-luxury.jpg",
    featuredTitle: "Intérieurs Modernes de Luxe",
    featuredDesc: "Découvrez le confort et l'élégance dans chaque coin",
    buttonText: "Voir Tous Les Équipements"
  },
  whyChoose: {
    sectionTitle: "Pourquoi Choisir",
    sectionAccent: "Faysha",
    subtitle: "Nous révolutionnons l'expérience de location au Cameroun avec des propriétés possédées, une technologie intelligente et une hospitalité inégalée.",
    benefit1Title: "Qualité Garantie",
    benefit1Desc: "Chaque propriété est possédée et entretenue par nous pour assurer une excellence constante.",
    benefit2Title: "Accès Instantané",
    benefit2Desc: "Des serrures intelligentes avec des codes à durée limitée signifient un enregistrement sans faille, sans attente.",
    benefit3Title: "Meilleur Rapport Qualité-Prix",
    benefit3Desc: "Prix compétitifs avec des équipements et services de qualité hôtelière inclus.",
    benefit4Title: "Support 24/7",
    benefit4Desc: "Notre équipe sur place est toujours prête à vous aider avec toute demande."
  },
  testimonials: {
    sectionTitle: "Ce Que Nos",
    sectionAccent: "Clients Disent",
    subtitle: "Ne nous croyez pas sur parole. Voici ce que nos clients satisfaits ont à dire.",
    testimonial1Text: "Le système d'accès intelligent a rendu l'enregistrement si facile! Je suis arrivé tard dans la nuit et je n'ai eu aucun problème pour entrer. L'appartement était impeccable et la Smart TV avait tout ce dont j'avais besoin.",
    testimonial2Text: "Je suis resté 3 mois pendant que ma maison était en rénovation. La salle de sport et la piscine donnaient l'impression d'être dans un complexe de luxe. Meilleure expérience de location à long terme au Cameroun!",
    testimonial3Text: "Faysha a dépassé toutes les attentes. L'emplacement, les équipements et le service étaient parfaits. J'ai particulièrement aimé avoir une cuisine complète et le concierge m'a aidé avec toutes mes réservations de restaurant."
  },
  cta: {
    title: "Prêt à Découvrir la Vie Intelligente?",
    description: "Réservez votre séjour aujourd'hui et découvrez l'avenir de la location au Cameroun.",
    button: "Réserver Maintenant"
  }
};

async function seedContent() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding home page content...');

    // Function to insert content
    const insertContent = async (pageId, language, section, key, value) => {
      await client.query(
        `INSERT INTO page_content (page_id, language, section, content_key, content_value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (page_id, language, section, content_key)
         DO UPDATE SET content_value = $5, updated_at = CURRENT_TIMESTAMP`,
        [pageId, language, section, key, value]
      );
    };

    // Seed English content
    console.log('  → Seeding English content...');
    for (const [section, content] of Object.entries(homeContentEN)) {
      for (const [key, value] of Object.entries(content)) {
        await insertContent('home', 'en', section, key, value);
      }
    }

    // Seed French content
    console.log('  → Seeding French content...');
    for (const [section, content] of Object.entries(homeContentFR)) {
      for (const [key, value] of Object.entries(content)) {
        await insertContent('home', 'fr', section, key, value);
      }
    }

    await client.query('COMMIT');

    console.log('✅ Home page content seeded successfully!');
    console.log('\nSeeded sections:');
    console.log('  - Hero section (title, subtitle, description, buttons)');
    console.log('  - Stats section (4 stats with labels)');
    console.log('  - Features section (title, subtitle, 4 features)');
    console.log('  - How It Works section (3 steps)');
    console.log('  - Gallery section (featured image + 6 photos)');
    console.log('  - Why Choose section (4 benefits)');
    console.log('  - Testimonials section (3 testimonials)');
    console.log('  - CTA section (title, description, button)');
    console.log('\nLanguages:');
    console.log('  - English (en)');
    console.log('  - French (fr)');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding content:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the seeder
seedContent()
  .then(() => {
    console.log('\n✨ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });

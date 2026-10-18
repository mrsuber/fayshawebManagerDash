/**
 * Comprehensive seed script to populate ALL page content in the database
 * Includes all sections for all pages in both English and French
 */

require('dotenv').config();
const { pool } = require('../config/database');

// ENGLISH CONTENT
const contentEN = {
  home: {
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
      step1Title: "Browse & Book",
      step1Desc: "Search our fully furnished apartments and rooms, check availability, and book online instantly.",
      step2Title: "Receive Access Code",
      step2Desc: "Get your time-limited smart access code via email and SMS before arrival.",
      step3Title: "Check In & Enjoy",
      step3Desc: "Use your code to enter, explore amenities on your Smart TV, and enjoy your stay."
    },
    gallery: {
      sectionTitle: "Explore Our",
      sectionAccent: "Properties",
      subtitle: "Take a virtual tour of our beautifully furnished apartments, modern amenities, and luxury spaces.",
      buttonText: "View All Amenities"
    },
    whyChoose: {
      sectionTitle: "Why Choose",
      sectionAccent: "Faysha",
      subtitle: "We're revolutionizing the rental experience in Cameroon with owned properties, smart technology, and unmatched hospitality.",
      reason1Title: "Guaranteed Quality",
      reason1Desc: "Every property is owned and maintained by us to ensure consistent excellence.",
      reason2Title: "Instant Access",
      reason2Desc: "Smart locks with time-limited codes mean seamless check-in, no waiting.",
      reason3Title: "Best Value",
      reason3Desc: "Competitive pricing with hotel-grade amenities and services included.",
      reason4Title: "24/7 Support",
      reason4Desc: "Our on-site team is always ready to assist with any request."
    },
    testimonials: {
      sectionTitle: "What Our",
      sectionAccent: "Guests Say",
      subtitle: "Don't just take our word for it. Here's what our satisfied guests have to say."
    },
    cta: {
      title: "Ready to Experience Smart Living?",
      description: "Book your stay today and discover why guests choose Faysha for comfort, convenience, and cutting-edge amenities.",
      button: "Book Your Stay Now"
    }
  },
  about: {
    hero: {
      title: "About Faysha",
      subtitle: "Property by Result",
      description: "We're revolutionizing the rental experience in Cameroon with smart technology, owned properties, and unmatched hospitality."
    },
    mission: {
      title: "Our Mission",
      description: "To provide the perfect blend of Airbnb convenience and hotel luxury through technology-driven rental solutions."
    },
    vision: {
      title: "Our Vision",
      description: "To become Cameroon's leading smart rental platform, setting new standards for comfort, convenience, and quality."
    }
  },
  amenities: {
    hero: {
      title: "Premium Amenities",
      subtitle: "Hotel Luxury Meets Home Comfort",
      description: "Discover our world-class facilities designed to make your stay unforgettable."
    },
    pool: {
      title: "Swimming Pool",
      description: "Relax and unwind in our temperature-controlled swimming pool."
    },
    gym: {
      title: "Fitness Center",
      description: "Stay fit with our fully-equipped modern gym facilities."
    },
    smartTV: {
      title: "Smart TV",
      description: "Control your room and access services through in-room Smart TV."
    }
  },
  contact: {
    hero: {
      title: "Get In Touch",
      subtitle: "We're Here to Help",
      description: "Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible."
    },
    info: {
      address: "Cameroon",
      email: "info@fayshaa.com",
      phone: "+237 XXX XXX XXX"
    }
  },
  booking: {
    hero: {
      title: "Book Your Stay",
      subtitle: "Find Your Perfect Room",
      description: "Browse our available properties and book your smart rental experience today."
    }
  },
  careers: {
    hero: {
      title: "Join Our Team",
      subtitle: "Build Your Career With Us",
      description: "We're always looking for talented individuals to join our growing team."
    },
    cta: {
      title: "Ready to Join Us?",
      description: "Send your resume and cover letter to careers@fayshaa.com"
    }
  }
};

// FRENCH CONTENT
const contentFR = {
  home: {
    hero: {
      title: "Location Intelligente",
      subtitle: "Redéfinie",
      description: "Découvrez le mélange parfait de la commodité d'Airbnb et du luxe hôtelier dans les premières propriétés intelligentes du Cameroun.",
      buttonPrimary: "Réserver maintenant",
      buttonSecondary: "En savoir plus"
    },
    stats: {
      properties: "100+",
      propertiesLabel: "Propriétés",
      guests: "5000+",
      guestsLabel: "Clients satisfaits",
      support: "24/7",
      supportLabel: "Assistance",
      rating: "4.9/5",
      ratingLabel: "Note"
    },
    features: {
      sectionTitle: "Ce qui nous rend",
      sectionAccent: "Uniques",
      subtitle: "Nous ne sommes pas qu'une simple plateforme de location. Nous possédons et gérons chaque propriété avec une technologie intelligente de pointe.",
      feature1Title: "Propriétés détenues",
      feature1Desc: "Appartements et chambres entièrement meublés dans nos propres bâtiments, garantissant qualité et confort constants.",
      feature2Title: "Accès intelligent",
      feature2Desc: "Codes générés automatiquement à durée limitée pour une entrée sans faille. Pas de clés, pas de tracas.",
      feature3Title: "Intégration Smart TV",
      feature3Desc: "Contrôlez votre chambre, réservez des services et consultez les horaires depuis votre Smart TV.",
      feature4Title: "Équipements premium",
      feature4Desc: "Piscine, salle de sport et services de conciergerie. Le luxe hôtelier rencontre le confort domestique."
    },
    howItWorks: {
      sectionTitle: "Comment ça",
      sectionAccent: "Marche",
      subtitle: "Simple, fluide et intelligent. Commencez en trois étapes faciles.",
      step1Title: "Parcourir et réserver",
      step1Desc: "Recherchez nos appartements et chambres entièrement meublés, vérifiez la disponibilité et réservez en ligne instantanément.",
      step2Title: "Recevoir le code d'accès",
      step2Desc: "Recevez votre code d'accès intelligent à durée limitée par email et SMS avant votre arrivée.",
      step3Title: "S'enregistrer et profiter",
      step3Desc: "Utilisez votre code pour entrer, explorez les équipements sur votre Smart TV et profitez de votre séjour."
    },
    gallery: {
      sectionTitle: "Explorez nos",
      sectionAccent: "Propriétés",
      subtitle: "Faites une visite virtuelle de nos appartements magnifiquement meublés, équipements modernes et espaces de luxe.",
      buttonText: "Voir tous les équipements"
    },
    whyChoose: {
      sectionTitle: "Pourquoi choisir",
      sectionAccent: "Faysha",
      subtitle: "Nous révolutionnons l'expérience de location au Cameroun avec des propriétés détenues, une technologie intelligente et une hospitalité inégalée.",
      reason1Title: "Qualité garantie",
      reason1Desc: "Chaque propriété est détenue et entretenue par nous pour assurer une excellence constante.",
      reason2Title: "Accès instantané",
      reason2Desc: "Des serrures intelligentes avec codes à durée limitée signifient un enregistrement sans faille, sans attente.",
      reason3Title: "Meilleur rapport qualité-prix",
      reason3Desc: "Prix compétitifs avec équipements et services de qualité hôtelière inclus.",
      reason4Title: "Assistance 24/7",
      reason4Desc: "Notre équipe sur place est toujours prête à vous aider pour toute demande."
    },
    testimonials: {
      sectionTitle: "Ce que disent nos",
      sectionAccent: "Clients",
      subtitle: "Ne vous contentez pas de nous croire sur parole. Voici ce que disent nos clients satisfaits."
    },
    cta: {
      title: "Prêt à découvrir la vie intelligente?",
      description: "Réservez votre séjour aujourd'hui et découvrez pourquoi les clients choisissent Faysha pour le confort, la commodité et les équipements de pointe.",
      button: "Réservez maintenant"
    }
  },
  about: {
    hero: {
      title: "À propos de Faysha",
      subtitle: "Propriété par Résultat",
      description: "Nous révolutionnons l'expérience de location au Cameroun avec une technologie intelligente, des propriétés détenues et une hospitalité inégalée."
    },
    mission: {
      title: "Notre Mission",
      description: "Fournir le mélange parfait de la commodité d'Airbnb et du luxe hôtelier grâce à des solutions de location axées sur la technologie."
    },
    vision: {
      title: "Notre Vision",
      description: "Devenir la principale plateforme de location intelligente du Cameroun, établissant de nouvelles normes de confort, de commodité et de qualité."
    }
  },
  amenities: {
    hero: {
      title: "Équipements Premium",
      subtitle: "Le luxe hôtelier rencontre le confort domestique",
      description: "Découvrez nos installations de classe mondiale conçues pour rendre votre séjour inoubliable."
    },
    pool: {
      title: "Piscine",
      description: "Détendez-vous dans notre piscine à température contrôlée."
    },
    gym: {
      title: "Centre de fitness",
      description: "Restez en forme avec nos installations de gym modernes entièrement équipées."
    },
    smartTV: {
      title: "Smart TV",
      description: "Contrôlez votre chambre et accédez aux services via la Smart TV de votre chambre."
    }
  },
  contact: {
    hero: {
      title: "Contactez-nous",
      subtitle: "Nous sommes là pour vous aider",
      description: "Vous avez des questions? Nous serions ravis de vous entendre. Envoyez-nous un message et nous vous répondrons dès que possible."
    },
    info: {
      address: "Cameroun",
      email: "info@fayshaa.com",
      phone: "+237 XXX XXX XXX"
    }
  },
  booking: {
    hero: {
      title: "Réservez votre séjour",
      subtitle: "Trouvez votre chambre parfaite",
      description: "Parcourez nos propriétés disponibles et réservez votre expérience de location intelligente dès aujourd'hui."
    }
  },
  careers: {
    hero: {
      title: "Rejoignez notre équipe",
      subtitle: "Construisez votre carrière avec nous",
      description: "Nous sommes toujours à la recherche de personnes talentueuses pour rejoindre notre équipe en croissance."
    },
    cta: {
      title: "Prêt à nous rejoindre?",
      description: "Envoyez votre CV et votre lettre de motivation à careers@fayshaa.com"
    }
  }
};

async function seedAllContent() {
  const client = await pool.connect();
  let totalCount = 0;

  try {
    console.log('🌱 Starting comprehensive content seeding...\n');
    await client.query('BEGIN');

    // Seed all pages for both languages
    for (const language of ['en', 'fr']) {
      const content = language === 'en' ? contentEN : contentFR;
      const langName = language === 'en' ? 'English' : 'French';

      console.log(`📝 Seeding ${langName} content...`);

      for (const [pageId, sections] of Object.entries(content)) {
        let pageCount = 0;

        for (const [section, sectionContent] of Object.entries(sections)) {
          for (const [key, value] of Object.entries(sectionContent)) {
            await client.query(
              `INSERT INTO page_content (page_id, language, section, content_key, content_value)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (page_id, language, section, content_key)
               DO UPDATE SET content_value = $5, updated_at = CURRENT_TIMESTAMP`,
              [pageId, language, section, key, value]
            );
            pageCount++;
            totalCount++;
          }
        }

        console.log(`   ✓ ${pageId}: ${pageCount} items`);
      }

      console.log(`✅ ${langName} content seeded\n`);
    }

    await client.query('COMMIT');

    // Verify seeded data
    const result = await client.query(
      `SELECT page_id, language, COUNT(*) as content_count
       FROM page_content
       GROUP BY page_id, language
       ORDER BY page_id, language`
    );

    console.log('📊 Seeding Summary:');
    console.log('===================');
    result.rows.forEach(row => {
      console.log(`${row.page_id.padEnd(12)} (${row.language}): ${row.content_count.toString().padStart(3)} items`);
    });
    console.log(`\nTotal items seeded: ${totalCount}`);
    console.log('\n✨ Complete content seeding finished successfully!');

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
seedAllContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

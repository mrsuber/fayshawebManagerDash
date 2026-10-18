// Wellness data constants - moods, zones, activities
// Matches the design from Faysha App.dc.html
import { WELLNESS_IMAGES } from './images';

export const MOOD_DATA = {
  restore: {
    label: 'Restore',
    img: WELLNESS_IMAGES.spa,
    tagline: 'Slow down. Ease your body. Recover fully.',
    activities: [
      {
        name: 'Recovery Suite',
        time: 'Private · 45 min',
        img: WELLNESS_IMAGES.spa,
        desc: 'A private, first-class recovery experience combining heat, light, cold and rest.',
        features: ['Dry steam bath', 'Red light therapy', 'Cool plunge'],
      },
      {
        name: 'Massage Therapy',
        time: '60 / 90 min',
        img: WELLNESS_IMAGES.spa,
        desc: 'Restorative bodywork tailored to release tension and renew energy.',
        features: ['Deep tissue', 'Aromatherapy', 'Hot stone'],
      },
      {
        name: 'Steam Room',
        time: 'Open daily · 6am–10pm',
        img: WELLNESS_IMAGES.spa,
        desc: 'Warm cedar steam to loosen muscles and clear the mind.',
        features: ['Cedar-lined', 'Aromatic oils'],
      },
      {
        name: 'Cold Plunge',
        time: 'Guided · 10 min',
        img: WELLNESS_IMAGES.spa,
        desc: 'Rapid recovery immersion to reduce inflammation.',
        features: ['Supervised', 'Recovery boost'],
      },
    ],
  },
  recharge: {
    label: 'Recharge',
    img: WELLNESS_IMAGES.gym,
    tagline: 'Energise your body. Elevate your day.',
    activities: [
      {
        name: 'Gym & Training',
        time: 'Open 24/7',
        img: WELLNESS_IMAGES.gym,
        desc: 'World-class equipment with personalised results in mind.',
        features: ['Cardio zone', 'Strength zone', 'Performance lab'],
      },
      {
        name: 'Personal Trainer',
        time: '45 min · 1:1',
        img: WELLNESS_IMAGES.dining,
        desc: 'One-on-one coaching built around your goals.',
        features: ['Custom program', 'Progress tracking'],
      },
      {
        name: 'Group Classes',
        time: 'Daily schedule',
        img: WELLNESS_IMAGES.gym,
        desc: 'High-energy sessions with the Faysha community.',
        features: ['HIIT', 'Cycling', 'Strength circuits'],
      },
      {
        name: 'Nutrition',
        time: 'By appointment',
        img: WELLNESS_IMAGES.gym,
        desc: 'Personalised nutrition planning with our resident experts.',
        features: ['Meal planning', 'Supplements'],
      },
    ],
  },
  reflect: {
    label: 'Reflect',
    img: WELLNESS_IMAGES.sunset,
    tagline: 'Pause. Be present.',
    activities: [
      {
        name: 'Sunset Ceremony',
        time: 'Daily · 5:50 PM',
        img: WELLNESS_IMAGES.sunset,
        desc: 'A daily ritual to honour the beauty of the moment, held at the Sky Deck.',
        features: ['The Sky Deck', 'Guided breathwork', 'Herbal tea'],
      },
      {
        name: 'Meditation',
        time: '20 min sessions',
        img: WELLNESS_IMAGES.sunset,
        desc: 'Quiet guided sessions for clarity and calm.',
        features: ['Morning & evening', 'Garden setting'],
      },
      {
        name: 'Nature Walk',
        time: 'Self-guided',
        img: WELLNESS_IMAGES.sunset,
        desc: 'Wander the estate grounds at your own pace.',
        features: ['Estate trails', 'Botanical garden'],
      },
      {
        name: 'Journal',
        time: 'Anytime',
        img: WELLNESS_IMAGES.sunset,
        desc: 'A private space to reflect on your wellness journey.',
        features: ['Guided prompts', 'Private & secure'],
      },
    ],
  },
  explore: {
    label: 'Explore',
    img: WELLNESS_IMAGES.explore,
    tagline: 'Discover. Experience. Enjoy.',
    activities: [
      {
        name: 'Estate Map',
        time: 'Interactive',
        img: WELLNESS_IMAGES.explore,
        desc: 'Find your way around every corner of the Faysha estate.',
        features: ['Live wayfinding', 'Points of interest'],
      },
      {
        name: 'Dining',
        time: '3 venues',
        img: WELLNESS_IMAGES.dining,
        desc: 'Nourish your body, delight your senses across our dining venues.',
        features: ['Vitality Café', 'The Sky Deck', 'Private Dining'],
      },
      {
        name: 'Local Culture',
        time: 'Curated tours',
        img: WELLNESS_IMAGES.explore,
        desc: 'Bespoke experiences beyond the estate gates.',
        features: ['Guided tours', 'Artisan visits'],
      },
      {
        name: 'Boutique',
        time: 'Open daily',
        img: WELLNESS_IMAGES.explore,
        desc: 'Curated wellness essentials and Faysha signature pieces.',
        features: ['Signature scents', 'Loungewear'],
      },
    ],
  },
};

export const ZONE_DATA = [
  {
    name: 'Wellness Club',
    sub: 'Gym & Spa',
    glyph: '⚭',
    img: WELLNESS_IMAGES.gym,
    desc: 'Strength, recovery and training under one roof.',
    features: ['Gym', 'Spa', 'Recovery Suite'],
  },
  {
    name: 'Pool Club',
    sub: 'Cabanas & Sun Deck',
    glyph: '≈',
    img: WELLNESS_IMAGES.sunset,
    desc: 'A tranquil pool set among tropical gardens.',
    features: ['Private cabanas', 'Poolside service'],
  },
  {
    name: 'Dining',
    sub: 'Vitality Café · Sky Deck',
    glyph: '✦',
    img: WELLNESS_IMAGES.dining,
    desc: 'Fresh, healthy, inspired dining across the estate.',
    features: ['Vitality Café', 'The Sky Deck', 'Private Dining'],
  },
  {
    name: 'Villas',
    sub: 'Serenity Collection',
    glyph: '⌂',
    img: WELLNESS_IMAGES.spa,
    desc: 'Private residences designed around wellbeing.',
    features: ['Serenity Villas 1–8', 'Riviera Collection'],
  },
  {
    name: 'Business Lounge',
    sub: 'Co-working',
    glyph: '▤',
    img: WELLNESS_IMAGES.spa,
    desc: 'A refined space to work quietly on the estate.',
    features: ['Private booths', 'Meeting rooms'],
  },
];

export const QUICK_ACTIONS = [
  { glyph: '🔑', label: 'Digital Key', screen: 'DigitalKey' },
  { glyph: '🛎', label: 'Requests', screen: 'Requests' },
  { glyph: '🍽', label: 'Dining', screen: 'Dining' },
  { glyph: '📅', label: 'Bookings', screen: 'Bookings' },
];

export const WELLNESS_METRICS = [
  { label: 'Sleep', value: '90%', pct: 90 },
  { label: 'Activity', value: '85%', pct: 85 },
  { label: 'Nutrition', value: '88%', pct: 88 },
  { label: 'Hydration', value: '75%', pct: 75 },
  { label: 'Mood', value: 'Calm', pct: 95 },
];

export const FEELING_OPTIONS = [
  {
    key: 'great',
    emoji: '😊',
    rec: 'You are glowing today — a 30 min Gym & Training session will keep your momentum going.',
  },
  {
    key: 'stressed',
    emoji: '😌',
    rec: 'Let us slow things down. We have reserved you a Recovery Suite session and herbal tea at 4:00 PM.',
  },
  {
    key: 'energetic',
    emoji: '☀️',
    rec: 'Great energy — join today\'s Group Class or take on the Estate Trail before sunset.',
  },
  {
    key: 'tired',
    emoji: '🌙',
    rec: 'Rest is productive too. We suggest an early Sunset Ceremony and a breathing session tonight.',
  },
];

export const CONCIERGE_QUICK_REPLIES = [
  {
    label: 'Airport transfer',
    reply: 'Certainly. We will have your driver arrive at 9:00 AM.',
  },
  {
    label: 'Book a spa slot',
    reply: 'Of course — I have reserved a Recovery Suite session for you at 4:00 PM.',
  },
  {
    label: 'Reserve dinner',
    reply: 'Your table for two is confirmed at The Sky Deck, 7:30 PM.',
  },
];

export const PROFILE_ITEMS = [
  { glyph: '☰', label: 'My Stays', screen: null },
  { glyph: '▤', label: 'Wellness Bookings', screen: 'Bookings' },
  { glyph: '📦', label: 'Deposit Box', screen: 'DigitalKey' },
  { glyph: '◈', label: 'Explore the Estate', screen: 'Explore' },
  { glyph: '✎', label: 'Personal Details', screen: null },
  { glyph: '♡', label: 'Faysha Circle', screen: 'Rewards' },
  { glyph: '⚙', label: 'Settings', screen: null },
];

export const DISCOVER_ITEMS = [
  'My Wellness Journey',
  'Estate Guide',
  'Events & Activities',
  'Community',
  'The Faysha Journal',
  'Boutique',
  'Sustainability',
  'Emergency',
].map(label => ({ label, glyph: '·' }));

export const SAMPLE_BOOKINGS = {
  upcoming: [
    {
      name: 'Spa Massage',
      time: 'Today, 4:00 PM',
      img: WELLNESS_IMAGES.spa,
    },
    {
      name: 'Sunset Ceremony',
      time: 'Today, 6:00 PM',
      img: WELLNESS_IMAGES.sunset,
    },
    {
      name: 'Yoga Class',
      time: 'Tomorrow, 7:30 AM',
      img: WELLNESS_IMAGES.gym,
    },
  ],
  past: [
    {
      name: 'Personal Training',
      time: 'Aug 24, 8:00 AM',
      img: WELLNESS_IMAGES.dining,
    },
    {
      name: 'Dinner Reservation',
      time: 'Aug 22, 7:30 PM',
      img: WELLNESS_IMAGES.dining,
    },
  ],
};

export const KEY_CONTROLS = [
  { glyph: '☀', label: 'Lights' },
  { glyph: '❄', label: 'Climate' },
  { glyph: '▥', label: 'Curtains' },
];

/** Static site data. Mood names, taglines and sessions match the guest app (mobile/src/constants/wellnessData.js). */
export const IMG = {
  hero: '/images/site/hero-monument.jpg',
  sunset: '/images/site/sunset.jpg',
  spa: '/images/site/spa.jpg',
  gym: '/images/site/gym.jpg',
  explore: '/images/site/explore.jpg',
  club: '/images/site/club-night.jpg',
  logo: '/images/site/faysha-logo.png',
};

export const CONTACT = {
  email: 'info@fayshaa.com',
  concierge: '+237 651 841 003',
  emergency: '+237 653 255 547',
  location: 'Cameroon',
};

export const tel = (n) => `tel:${n.replace(/\s/g, '')}`;

export const MOODS = [
  {
    id: 'restore', name: 'Restore', kicker: 'Spa & touch', img: IMG.spa, alt: 'The Faysha spa',
    short: 'Massage, steam and slow mornings.',
    tagline: 'Slow down. Ease your body. Recover fully.',
    items: [
      ['Recovery Suite', 'A private suite for deep recovery.'],
      ['Massage Therapy', 'Signature and therapeutic massage.'],
      ['Steam Room', 'Heat to release the day.'],
      ['Cold Plunge', 'A bracing reset.'],
    ],
  },
  {
    id: 'recharge', name: 'Recharge', kicker: 'Move', img: IMG.gym, alt: 'The Faysha fitness club',
    short: 'Fitness, coaching and energy.',
    tagline: 'Energise your body. Elevate your day.',
    items: [
      ['Gym & Training', 'Open to residents, day and night.'],
      ['Personal Trainer', 'One-to-one coaching.'],
      ['Group Classes', 'Yoga, mobility and more.'],
      ['Nutrition', 'Menus planned around your goals.'],
    ],
  },
  {
    id: 'reflect', name: 'Reflect', kicker: 'Stillness', img: IMG.sunset, alt: 'Sunset at Faysha',
    short: 'Sunset rituals and meditation.',
    tagline: 'Pause. Be present.',
    items: [
      ['Sunset Ceremony', 'Our evening ritual on the terrace.'],
      ['Meditation', 'Guided and silent sessions.'],
      ['Nature Walk', 'A slow walk with a guide.'],
      ['Journal', 'Prompts to close the day.'],
    ],
  },
  {
    id: 'explore', name: 'Explore', kicker: 'Discover', img: IMG.explore, alt: 'Exploring the Faysha estate',
    short: 'The estate, the city and its culture.',
    tagline: 'Discover. Experience. Enjoy.',
    items: [
      ['Estate Map', 'Everything on the grounds.'],
      ['Dining', 'Vitality Café, the Sky Deck and private dining.'],
      ['Local Culture', 'Curated outings in the city.'],
      ['Boutique', 'Signature scents and loungewear.'],
    ],
  },
];

export const CHECK_IN_TIME = '14:00';
export const CHECK_OUT_TIME = '11:00';

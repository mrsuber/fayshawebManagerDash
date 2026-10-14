/**
 * Sample data served when config.useMocks is on. Shapes match the backend contract in docs/API.md,
 * so a page renders identically against mocks or the live Express API.
 *
 * Dates are relative to today so the demo always has guests in house, arriving and checked out.
 * `buildSeed()` creates a fresh copy; src/mocks/db.js keeps the working copy (persisted in localStorage).
 */
import moment from 'moment';

export const user = { id: 1, name: 'FAY Admin', email: 'admin@faysha.com', role: 'admin' };

/** ISO timestamp `days` from today at `hhmm`. */
const at = (days, hhmm = '12:00') => {
  const [h, m] = hhmm.split(':').map(Number);
  return moment().startOf('day').add(days, 'days').hours(h).minutes(m).toISOString();
};
/**
 * Like `at`, for things that already happened: today's seeded history (latest 18:45) is shifted earlier
 * so it always ends a few minutes before now, keeping its order, and new activity sorts on top.
 */
const past = (days, hhmm = '12:00') => {
  const latest = moment().startOf('day').hours(18).minutes(45);
  const shift = Math.min(0, moment().subtract(5, 'minutes').diff(latest));
  return moment(at(days, hhmm)).add(days === 0 ? shift : 0, 'ms').toISOString();
};
/** YYYY-MM-DD `days` from today. */
const day = (days) => moment().startOf('day').add(days, 'days').format('YYYY-MM-DD');

const RATE = { 'Serenity Collection': 690, 'Riviera Collection': 780, 'Villa Spectra': 1150, 'Allure Penthouse': 1480 };
const collectionOf = (residence) =>
  residence.startsWith('Serenity') ? 'Serenity Collection' : residence.startsWith('Riviera') ? 'Riviera Collection' : residence.startsWith('Villa') ? 'Villa Spectra' : 'Allure Penthouse';

/**
 * [id, name, vip, status, residence, check-in offset (days), nights, adults, children, country, language, phone, email, purpose, tags]
 * status: In House | Arriving | Upcoming | Checked Out
 */
const GUESTS = [
  [1, 'Abba Abdouraman', true, 'In House', 'Serenity 1', 0, 2, 2, 0, 'UAE', 'English', '+971 50 123 4567', 'abba@domain.com', 'Leisure', ['Wellness & Recovery', 'Fine Dining', 'Outdoor Experiences', 'Business']],
  [2, 'Sophie Laurent', true, 'In House', 'Riviera 3', -1, 3, 2, 0, 'France', 'French', '+33 6 12 34 56 78', 'sophie.laurent@mail.fr', 'Leisure', ['Spa', 'Fine Dining']],
  [3, 'James & Anna Whitfield', false, 'In House', 'Villa Spectra 1', -2, 5, 2, 2, 'United Kingdom', 'English', '+44 7700 900123', 'whitfield@family.co.uk', 'Family', ['Family', 'Water Activities']],
  [4, 'Michael Chen', true, 'In House', 'Allure Penthouse 1', -1, 3, 2, 0, 'Singapore', 'English', '+65 9123 4567', 'm.chen@corp.sg', 'Business', ['Business', 'Fine Dining']],
  [5, 'Elena Petrova', false, 'In House', 'Riviera 1', -3, 4, 3, 0, 'Bulgaria', 'English', '+359 88 123 4567', 'elena.p@mail.bg', 'Leisure', ['Fitness', 'Wellness & Recovery']],
  [6, 'David Kim', false, 'Arriving', 'Serenity 3', 0, 3, 2, 2, 'South Korea', 'Korean', '+82 10 1234 5678', 'david.kim@mail.kr', 'Family', ['Family', 'Golf']],
  [7, 'Richard Thompson', true, 'Arriving', 'Serenity 2', 0, 3, 2, 0, 'USA', 'English', '+1 415 555 0134', 'r.thompson@mail.com', 'Anniversary', ['Celebration', 'Fine Dining']],
  [8, 'Grace Nkemelu', false, 'Checked Out', 'Villa Spectra 2', -4, 3, 2, 0, 'Nigeria', 'English', '+234 803 123 4567', 'grace.n@mail.ng', 'Leisure', ['Spa']],
  [9, 'Carlos Mendez', false, 'Checked Out', 'Riviera 2', -3, 3, 2, 0, 'Spain', 'Spanish', '+34 612 345 678', 'carlos.mendez@mail.es', 'Leisure', ['Golf', 'Fine Dining']],
  [10, 'Linda Eriksson', false, 'Checked Out', 'Allure Penthouse 2', -4, 4, 3, 0, 'Sweden', 'English', '+46 70 123 45 67', 'linda.e@mail.se', 'Leisure', ['Wellness & Recovery']],
  [11, 'Marie Tchoua', false, 'In House', 'Riviera 4', -1, 4, 2, 0, 'Cameroon', 'French', '+237 6 77 12 34 56', 'marie.tchoua@mail.cm', 'Leisure', ['Pool', 'Spa']],
  [12, 'Amira Haddad', false, 'Checked Out', 'Serenity 2', -40, 4, 2, 0, 'Lebanon', 'Arabic', '+961 3 123 456', 'amira.h@mail.lb', 'Leisure', ['Spa', 'Cultural']],
  [13, 'Lukas Becker', false, 'Checked Out', 'Riviera 1', -75, 3, 1, 0, 'Germany', 'German', '+49 151 2345 6789', 'lukas.becker@firma.de', 'Business', ['Business']],
  [14, 'Yuki Tanaka', false, 'Checked Out', 'Villa Spectra 1', -120, 5, 2, 1, 'Japan', 'Japanese', '+81 90 1234 5678', 'yuki.t@mail.jp', 'Family', ['Family', 'Cultural']],
  [15, 'Fatima Al Mansoori', true, 'Checked Out', 'Allure Penthouse 1', -30, 7, 2, 3, 'UAE', 'Arabic', '+971 55 987 6543', 'fatima.am@mail.ae', 'Family', ['Family', 'Fine Dining', 'Spa']],
  [16, 'Oliver Grant', false, 'Checked Out', 'Serenity 3', -200, 2, 2, 0, 'Canada', 'English', '+1 604 555 0199', 'oliver.grant@mail.ca', 'Leisure', ['Golf']],
  [17, 'Isabella Rossi', false, 'Upcoming', 'Riviera 3', 9, 4, 2, 0, 'Italy', 'Italian', '+39 347 123 4567', 'isabella.rossi@mail.it', 'Honeymoon', ['Celebration', 'Water Activities']],
  [18, 'Noah Williams', false, 'Checked Out', 'Riviera 2', -15, 3, 2, 0, 'Australia', 'English', '+61 412 345 678', 'noah.w@mail.au', 'Leisure', ['Water Activities', 'Fitness']],
  [19, 'Aisha Bello', true, 'Upcoming', 'Villa Spectra 2', 21, 5, 2, 2, 'Nigeria', 'English', '+234 802 987 6543', 'aisha.bello@mail.ng', 'Family', ['Family', 'Wellness & Recovery']],
  [20, 'Chen Wei', false, 'Checked Out', 'Allure Penthouse 2', -60, 2, 1, 0, 'China', 'Mandarin', '+86 138 0013 8000', 'chen.wei@corp.cn', 'Business', ['Business']],
];

const ABBA_PREFS = [
  ['spa', '#3fd283', 'Wellness & Recovery', 'Spa, FAY FLOAT, movement, sleep optimization'],
  ['restaurant', '#e8b84a', 'Dining', 'Healthy, seafood, private dining, local cuisine'],
  ['sailing', '#4fc3f7', 'Experiences', 'Outdoor, cultural, water activities, golf'],
  ['home', '#e6e0d4', 'Residence', 'High floor, ocean view, quiet, smart residence'],
  ['forum', '#9b7bf0', 'Communication', 'WhatsApp, email, English, concise updates'],
  ['redeem', '#f06292', 'Special Occasions', 'Birthday (Dec 5), business meetings'],
];
const WELLNESS = ['Deep tissue massage, sauna', 'Yoga at sunrise, meditation', 'Facials, thermal circuit', 'Personal training, recovery'];
const DINING = ['Mediterranean, seafood', 'Vegetarian, organic', 'Asian fusion, sushi', 'Grill, local cuisine', 'Gluten-free, light'];
const EXPERIENCES = ['Yacht, snorkeling', 'Desert safari, culture', 'Golf, tennis', 'Kids club, beach', 'Art & heritage tours'];
const RESIDENCE = ['Ocean view, quiet', 'Pool access, ground floor', 'High floor, extra pillows', 'Connecting rooms, cot'];

function preferencesFor(g) {
  const [id, , , , , , , , , , language] = g;
  const rows =
    id === 1
      ? ABBA_PREFS
      : [
          ['spa', '#3fd283', 'Wellness & Recovery', WELLNESS[id % WELLNESS.length]],
          ['restaurant', '#e8b84a', 'Dining', DINING[id % DINING.length]],
          ['sailing', '#4fc3f7', 'Experiences', EXPERIENCES[id % EXPERIENCES.length]],
          ['home', '#e6e0d4', 'Residence', RESIDENCE[id % RESIDENCE.length]],
          ['forum', '#9b7bf0', 'Communication', `${id % 2 ? 'WhatsApp' : 'Email'}, ${language}`],
          ['redeem', '#f06292', 'Special Occasions', id % 3 ? 'None noted' : 'Anniversary'],
        ];
  return rows.map(([icon, color, title, detail], i) => ({ key: `p${i + 1}`, icon, color, title, detail }));
}

function servicesFor(id, status) {
  if (id === 1) {
    return [
      { key: 'locker', icon: 'deployed_code', color: '#4fc3f7', title: 'Locker 07', detail: '1 package ready for collection', status: 'Ready' },
      { key: 'laundry', icon: 'local_laundry_service', color: '#9b7bf0', title: 'Laundry', detail: '2 items in processing', status: 'In Progress' },
      { key: 'deliveries', icon: 'local_shipping', color: '#e8b84a', title: 'Deliveries', detail: '1 completed today', status: 'Delivered' },
      { key: 'returns', icon: 'autorenew', color: '#3fd283', title: 'Return Items', detail: 'No active returns', status: '—' },
      { key: 'access', icon: 'lock', color: '#e8b84a', title: 'Last Access', detail: 'Today, 18:42', status: '—' },
      { key: 'minibar', icon: 'liquor', color: '#f06292', title: 'Minibar', detail: 'Restocked this morning', status: 'Completed' },
    ];
  }
  const inHouse = status === 'In House';
  return [
    { key: 'locker', icon: 'deployed_code', color: '#4fc3f7', title: `Locker ${String(id).padStart(2, '0')}`, detail: inHouse && id % 2 ? '1 package ready for collection' : 'Empty', status: inHouse && id % 2 ? 'Ready' : '—' },
    { key: 'laundry', icon: 'local_laundry_service', color: '#9b7bf0', title: 'Laundry', detail: inHouse ? '1 item in processing' : 'No active orders', status: inHouse ? 'In Progress' : '—' },
    { key: 'deliveries', icon: 'local_shipping', color: '#e8b84a', title: 'Deliveries', detail: 'None today', status: '—' },
    { key: 'access', icon: 'lock', color: '#e8b84a', title: 'Last Access', detail: inHouse ? 'Today, 09:15' : '—', status: '—' },
  ];
}

const INSIGHTS = {
  1: [
    'Prefers morning wellness sessions',
    'Has not yet booked a fitness activity this stay',
    'Enjoys seafood and Mediterranean cuisine',
    'Frequently requests late checkout',
    'High satisfaction with personalized experiences',
    'Responds fastest on WhatsApp, usually within 10 minutes',
    'Books dining 1–2 days ahead; prefers 8 PM seating',
  ],
};
const insightsFor = (g) =>
  INSIGHTS[g[0]] || [
    `Enjoys ${DINING[g[0] % DINING.length].split(',')[0].toLowerCase()} cuisine`,
    `Interested in ${EXPERIENCES[g[0] % EXPERIENCES.length].toLowerCase()}`,
    g[13] === 'Business' ? 'Needs early breakfast and meeting space' : 'Likely to book a spa treatment on day 2',
    `Prefers communication in ${g[10]}`,
  ];

function buildGuests() {
  return GUESTS.map((g) => {
    const [id, name, vip, status, residence, ci, nights, adults, children, country, language, phone, email, purpose, tags] = g;
    return {
      id,
      name,
      vip,
      status,
      residence,
      collection: collectionOf(residence),
      checkIn: day(ci),
      checkOut: day(ci + nights),
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      adults,
      children,
      purpose,
      tags,
      contact: { phone, email, country, language, timeZone: country === 'UAE' ? 'GST (GMT+4)' : 'Local' },
      flags: { digitalKey: status === 'In House', parking: id % 2 === 1 },
      preferences: preferencesFor(g),
      services: servicesFor(id, status),
      insights: insightsFor(g),
    };
  });
}

/** Past and current stays. The current stay comes from the guest record; earlier ones are listed here. */
const PAST_STAYS = {
  1: [
    ['Riviera 1', -200, 4, 'Business', 9.4],
    ['Villa Spectra 2', -320, 3, 'Leisure', 9.8],
  ],
  2: [['Serenity 1', -150, 3, 'Leisure', 9.7]],
  4: [
    ['Allure Penthouse 2', -90, 2, 'Business', 9.1],
    ['Allure Penthouse 1', -260, 3, 'Business', 9.5],
  ],
  12: [['Serenity 2', -400, 3, 'Leisure', 9.3]],
  15: [
    ['Villa Spectra 1', -365, 6, 'Family', 9.9],
    ['Allure Penthouse 1', -500, 5, 'Family', 9.6],
  ],
  16: [['Serenity 3', -560, 2, 'Leisure', 8.9]],
  18: [['Riviera 3', -300, 3, 'Leisure', 9.2]],
};

function buildStays(guests) {
  let id = 1;
  const stays = [];
  for (const g of guests) {
    const current = moment(g.checkIn).diff(moment().startOf('day'), 'days');
    const nights = moment(g.checkOut).diff(moment(g.checkIn), 'days');
    const sat = g.status === 'Checked Out' ? 9 + ((g.id * 7) % 10) / 10 : null;
    const rows = [[g.residence, current, nights, g.purpose, sat], ...(PAST_STAYS[g.id] || [])];
    for (const [residence, offset, n, purpose, satisfaction] of rows) {
      stays.push({
        id: id++,
        guestId: g.id,
        residence,
        checkIn: day(offset),
        checkOut: day(offset + n),
        nights: n,
        purpose,
        satisfaction: satisfaction === null ? null : Math.round(satisfaction * 10) / 10,
        amount: n * RATE[collectionOf(residence)],
        status: offset > 0 ? 'Upcoming' : offset + n > 0 ? 'Current' : 'Completed',
      });
    }
  }
  if (stays[0]) stays[0].satisfaction = 9.6; // Abba's in-stay pulse survey
  return stays;
}

function buildTimeline(guests) {
  const rows = [
    [1, 0, '18:42', 'Delivered – Package at Locker 07', 'Smart Locker'],
    [1, 0, '18:30', 'Housekeeping assigned', 'Service Request'],
    [1, 0, '17:10', 'Private dining setup completed', 'Dining'],
    [1, 0, '15:05', 'Arrived at Faysha', 'Arrival'],
    [1, 0, '14:50', 'Digital key activated', 'Residence'],
    [1, -1, '10:00', 'Pre-arrival welcome sent', 'Communication'],
    [1, -3, '16:20', 'Spa preferences confirmed', 'Wellness'],
    [1, -7, '11:00', 'Reservation confirmed – Serenity 1', 'Reservation'],
  ];
  for (const g of guests.filter((x) => x.id !== 1)) {
    const ci = moment(g.checkIn).diff(moment().startOf('day'), 'days');
    rows.push([g.id, ci - 14, '11:00', `Reservation confirmed – ${g.residence}`, 'Reservation']);
    if (g.status !== 'Upcoming') rows.push([g.id, ci - 1, '10:00', 'Pre-arrival welcome sent', 'Communication']);
    if (g.status === 'In House' || g.status === 'Checked Out') {
      rows.push([g.id, ci, '15:20', 'Arrived at Faysha', 'Arrival']);
      rows.push([g.id, ci, '15:05', 'Digital key activated', 'Residence']);
    }
    if (g.status === 'Checked Out') rows.push([g.id, moment(g.checkOut).diff(moment().startOf('day'), 'days'), '10:45', 'Checked out', 'Departure']);
  }
  return rows.map(([guestId, d, t, title, category], i) => ({ id: i + 1, guestId, at: past(d, t), title, category }));
}

function buildBookings() {
  const rows = [
    [1, 'wellness', 'FAY Thermal Recovery', 1, '10:00', 90, 'Confirmed'],
    [1, 'dining', 'Dinner at Riviera', 1, '20:00', 120, 'Confirmed'],
    [1, 'experience', 'Sunset Yacht Experience', 2, '16:00', 180, 'Pending'],
    [1, 'transport', 'Airport transfer – departure', 2, '12:30', 45, 'Confirmed'],
    [1, 'wellness', 'Deep Tissue Massage', -200, '11:00', 60, 'Completed'],
    [2, 'wellness', 'Signature Facial', 0, '17:00', 75, 'Confirmed'],
    [2, 'dining', 'Private Dining – Riviera', 1, '19:45', 150, 'Confirmed'],
    [3, 'experience', 'Kids Snorkeling Lesson', 1, '09:30', 90, 'Confirmed'],
    [3, 'experience', 'Sunset Yacht Experience', 2, '16:00', 180, 'Confirmed'],
    [4, 'dining', 'Chef’s Table', 0, '20:00', 120, 'Confirmed'],
    [5, 'wellness', 'Personal Training', 1, '07:00', 60, 'Confirmed'],
    [6, 'transport', 'Airport pickup', 0, '13:30', 45, 'Confirmed'],
    [7, 'dining', 'Anniversary Dinner – Beach', 1, '19:30', 150, 'Pending'],
    [11, 'wellness', 'Hammam Ritual', 1, '15:00', 90, 'Confirmed'],
    [17, 'experience', 'Private Island Picnic', 11, '12:00', 240, 'Pending'],
  ];
  return rows.map(([guestId, type, title, d, t, mins, status], i) => ({
    id: i + 1,
    guestId,
    type,
    title,
    startsAt: at(d, t),
    endsAt: moment(at(d, t)).add(mins, 'minutes').toISOString(),
    guests: 2,
    status,
    notes: '',
  }));
}

function buildNotes() {
  const rows = [
    [1, 'Hypoallergenic pillows and 4 extra towels on arrival.', 'Maya R.', -1],
    [1, 'Birthday Dec 5 — arrange a cake and handwritten card.', 'FAY', -3],
    [2, 'Prefers service after 11 AM.', 'Lucien P.', 0],
    [7, 'Anniversary — rose petal setup on arrival.', 'FAY', -2],
  ];
  return rows.map(([guestId, body, author, d], i) => ({ id: i + 1, guestId, body, author, createdAt: past(d, '09:30') }));
}

function buildFolio(guests) {
  const charges = [];
  const payments = [];
  let cid = 1;
  let pid = 1;
  for (const g of guests.filter((x) => x.status !== 'Upcoming')) {
    const nights = moment(g.checkOut).diff(moment(g.checkIn), 'days');
    const ci = moment(g.checkIn).diff(moment().startOf('day'), 'days');
    const rate = RATE[g.collection];
    charges.push({ id: cid++, guestId: g.id, date: past(ci, '15:00'), description: `${g.residence} · ${nights} nights × $${rate}`, category: 'Accommodation', amount: nights * rate });
    if (g.id === 1) {
      charges.push({ id: cid++, guestId: 1, date: past(0, '17:10'), description: 'Private dining setup', category: 'Dining', amount: 420 });
      charges.push({ id: cid++, guestId: 1, date: past(0, '16:00'), description: 'FAY Thermal Recovery (pre-booked)', category: 'Wellness', amount: 280 });
      charges.push({ id: cid++, guestId: 1, date: past(0, '12:00'), description: 'Laundry – 2 items', category: 'Services', amount: 45 });
    }
    const deposit = g.status === 'Checked Out' ? nights * rate : 500;
    payments.push({ id: pid++, guestId: g.id, date: past(ci - 7, '11:00'), method: 'Card •••• 4242', amount: deposit });
  }
  return { charges, payments };
}

const SR = [
  ['#1387', 0, '12:00', 1, 'Airport transfer (departure)', 'Residence Drive', 'Normal', 'Scheduled', 'Transportation'],
  ['#1386', 0, '18:20', 1, 'Delivery', 'Smart Locker 07', 'Normal', 'In Progress', 'Concierge'],
  ['#1385', 0, '17:10', 1, 'Extra towels', 'Serenity 1', 'High', 'In Progress', 'Housekeeping'],
  ['#1384', 0, '16:42', 2, 'Private dining setup', 'Riviera 1', 'Normal', 'Completed', 'Dining'],
  ['#1383', 0, '15:20', 3, 'Yacht transfer', 'Marina', 'Normal', 'Scheduled', 'Transportation'],
  ['#1382', 0, '14:35', 4, 'AC temperature', 'Allure Penthouse 1', 'High', 'Escalated', 'Maintenance'],
  ['#1381', 0, '13:15', 5, 'Massage room setup', 'Spa', 'Normal', 'Completed', 'Wellness'],
  ['#1380', 0, '11:22', 10, 'Laundry collection', 'Smart Locker 03', 'Normal', 'In Progress', 'Housekeeping'],
  ['#1379', 0, '10:18', 8, 'Grocery delivery', 'Smart Locker 05', 'Normal', 'Completed', 'Concierge'],
  ['#1378', 0, '09:40', 11, 'Pool cabana setup', 'Pool Club', 'Low', 'Completed', 'Experiences'],
  ['#1377', 0, '08:15', 6, 'Golf cart pickup', 'Residence Drive', 'Normal', 'On Hold', 'Transportation'],
  ['#1352', -200, '09:00', 1, 'Late checkout', 'Riviera 1', 'Normal', 'Completed', 'Concierge'],
];

function buildServiceRequests(guests) {
  const short = (n) => {
    const parts = n.split(' ');
    return n.includes('&') || parts.length < 2 ? n : `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };
  return SR.map(([number, d, t, guestId, title, location, priority, status, department]) => ({
    id: Number(number.slice(1)),
    number,
    createdAt: past(d, t),
    guestId,
    guestName: short(guests.find((g) => g.id === guestId).name),
    title,
    location,
    priority,
    status,
    department,
    notes: '',
  }));
}

function buildConversations(guests) {
  const rows = [
    [1, 'Your package has arrived at the…', 0, '18:13', 'whatsapp'],
    [2, 'Thank you! The massage was…', 0, '16:42', 'email'],
    [3, 'Can we book the sunset yacht…', 0, '15:20', 'whatsapp'],
    [4, 'Dinner reservation confirmed.', 0, '14:35', 'whatsapp'],
    [5, 'Is the gym open now?', 0, '11:22', 'whatsapp'],
    [6, 'Airport transfer details please.', 0, '09:18', 'email'],
    [8, 'Thank you for the wonderful…', -1, '19:05', 'in_app'],
    [9, 'Could you arrange groceries…', -1, '17:30', 'email'],
    [10, 'What time is the spa available?', -1, '12:10', 'in_app'],
    [11, 'Can I have extra towels?', -1, '09:45', 'whatsapp'],
  ];
  return rows.map(([guestId, lastMessage, d, t, channel], i) => {
    const g = guests.find((x) => x.id === guestId);
    return { id: i + 1, guestId, guestName: g.name, lastMessage, lastAt: past(d, t), channel, stayStatus: g.status === 'Upcoming' ? 'Arriving' : g.status };
  });
}

const MESSAGES = [
  [1, false, 'Abba Abdouraman', 'Hi FAY, has my grocery delivery arrived?', '18:10'],
  [
    1,
    true,
    'FAY AI Concierge',
    'Yes, your grocery delivery has arrived and is securely stored at the FAY Smart Locker Hub.\n\nLocker 07 is ready for your collection. Open it with your Faysha app, NFC card, or the QR code at the locker.',
    '18:12',
  ],
  [1, true, 'Package Ready for Collection', 'Locker 07 · 1 package · Delivered at 18:12', '18:12'],
  [1, false, 'Abba Abdouraman', 'Perfect, thank you!', '18:13'],
  [2, false, 'Sophie Laurent', 'Thank you! The massage was wonderful.', '16:42'],
  [3, false, 'James & Anna Whitfield', 'Can we book the sunset yacht for Thursday?', '15:20'],
  [6, false, 'David Kim', 'Airport transfer details please.', '09:18'],
];

/** Stays on the reservations calendar, as [residence, collection, start offset from the first calendar day of this month, nights]. */
const CAL_STAYS = [
  ['Serenity 1', 'Serenity', 4, 3],
  ['Villa Spectra 2', 'Villa Spectra', 7, 3],
  ['Riviera 1', 'Riviera', 10, 2],
  ['Allure Penthouse 1', 'Allure Penthouse', 12, 2],
  ['Riviera 2', 'Riviera 2', 14, 3],
  ['Serenity 2', 'Serenity', 17, 4],
  ['Villa Spectra 1', 'Villa Spectra', 21, 4],
  ['Allure Penthouse 2', 'Allure Penthouse', 25, 3],
  ['Serenity 1', 'Serenity', 28, 4],
  ['Riviera 1', 'Riviera', 32, 3],
  ['Villa Spectra 2', 'Villa Spectra', 35, 4],
  ['Riviera 2', 'Riviera 2', 39, 3],
];
const CAL_GUESTS = ['Grace N.', 'Carlos Mendez', 'Linda E.', 'Michael Chen', 'Marie T.', 'Richard Thompson', 'James & Anna', 'David Kim', 'Abba Abdouraman', 'Elena Petrova', 'Sophie Laurent', 'Carlos Mendez'];

function buildReservations() {
  const start = moment().startOf('month').startOf('week');
  const d = (offset) => start.clone().add(offset, 'days').format('YYYY-MM-DD');
  return CAL_STAYS.map(([residence, collection, s, nights], i) => ({
    id: 5000 + i,
    guestName: CAL_GUESTS[i],
    residence,
    collection,
    checkIn: d(s),
    checkOut: d(s + nights),
    guests: 2,
    status: 'Confirmed',
    totalAmount: nights * 690,
    currency: 'usd',
  }));
}

const movement = (rows) => rows.map(([time, guestName, residence, guests, status], i) => ({ id: i + 1, time, guestName, residence, guests, status }));

/** A fresh copy of every mock collection. */
export function buildSeed() {
  const guests = buildGuests();
  const { charges, payments } = buildFolio(guests);
  const conversations = buildConversations(guests);
  const messages = MESSAGES.map(([guestId, fromStaff, sender, body, t], i) => ({
    id: i + 1,
    conversationId: conversations.find((c) => c.guestId === guestId).id,
    fromStaff,
    sender,
    body,
    createdAt: past(0, t),
  }));
  const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

  return {
    guests,
    stays: buildStays(guests),
    timeline: buildTimeline(guests),
    bookings: buildBookings(),
    notes: buildNotes(),
    charges,
    payments,
    serviceRequests: buildServiceRequests(guests),
    conversations,
    messages,
    reservations: buildReservations(),
    todayMovements: {
      arrivals: movement([
        ['2:00 PM', 'Sophie Laurent', 'Serenity 1', 2, 'Expected'],
        ['3:30 PM', 'James & Anna', 'Villa Spectra 1', 4, 'Expected'],
        ['4:00 PM', 'Michael Chen', 'Allure Penthouse 1', 2, 'Checked In'],
        ['5:00 PM', 'Elena Petrova', 'Riviera 1', 3, 'Expected'],
        ['6:30 PM', 'Richard Thompson', 'Serenity 2', 2, 'Expected'],
      ]),
      departures: movement([
        ['10:00 AM', 'Carlos Mendez', 'Riviera 2', 2, 'Checked Out'],
        ['11:00 AM', 'Linda E.', 'Allure Penthouse 2', 3, 'Checked Out'],
        ['12:00 PM', 'Grace N.', 'Villa Spectra 2', 2, 'In Progress'],
        ['1:00 PM', 'Marie T.', 'Serenity 2', 2, 'Pending'],
        ['2:00 PM', 'David Kim', 'Riviera 1', 4, 'Pending'],
      ]),
    },
    residences: [
      ['Serenity 1', 'Serenity Collection', 'Abba Abdouraman', 'Occupied'],
      ['Serenity 2', 'Serenity Collection', 'Richard Thompson', 'Arriving'],
      ['Riviera 1', 'Riviera Collection', 'Elena Petrova', 'Occupied'],
      ['Riviera 2', 'Riviera Collection', null, 'Maintenance'],
      ['Villa Spectra 1', 'Villa Spectra', 'James & Anna', 'Occupied'],
      ['Villa Spectra 2', 'Villa Spectra', null, 'Cleaning'],
      ['Allure Penthouse 1', 'Allure Penthouse', 'Michael Chen', 'Occupied'],
      ['Allure Penthouse 2', 'Allure Penthouse', null, 'Vacant'],
      ['Serenity 3', 'Serenity Collection', null, 'Ready'],
      ['Riviera 3', 'Riviera Collection', 'Sophie Laurent', 'Occupied'],
    ].map(([name, collection, guestName, status], i) => ({ id: i + 1, name, collection, guestName, status, panoramaUrl: null, targetTemp: 22, scene: 'relax' })),
    housekeepingRooms: [
      ['Serenity 1', 'Occupied', 'DND until 9 AM'],
      ['Serenity 2', 'Inspect', 'Maya R.'],
      ['Serenity 3', 'Ready', '—'],
      ['Riviera 1', 'Occupied', 'Turndown 8 PM'],
      ['Riviera 2', 'Dirty', 'Unassigned'],
      ['Riviera 3', 'Occupied', 'Service 2 PM'],
      ['Villa Spectra 1', 'Occupied', 'Extra towels'],
      ['Villa Spectra 2', 'Cleaning', 'Lucien P.'],
      ['Allure Penthouse 1', 'Occupied', '—'],
      ['Allure Penthouse 2', 'Cleaning', 'Amara K.'],
      ['Riviera 4', 'Ready', '—'],
      ['Villa Spectra 3', 'Dirty', 'Unassigned'],
    ].map(([residence, status, note], i) => ({ id: i + 1, residence, status, note })),
    diningTables: [
      { id: 'R-01', status: 'Reserved', guestName: 'Abba A.' },
      { id: 'R-02', status: 'Available', guestName: '' },
      { id: 'R-03', status: 'Seated', guestName: 'D. Kim' },
      { id: 'R-04', status: 'Available', guestName: '' },
      { id: 'R-05', status: 'Seated', guestName: 'M. Chen' },
      { id: 'R-06', status: 'Available', guestName: '' },
      { id: 'R-07', status: 'Available', guestName: '' },
      { id: 'R-08', status: 'Cleaning', guestName: '' },
    ],
    notifications: [
      { id: 1, title: 'AC temperature escalated', body: 'Allure Penthouse 1 · Maintenance', createdAt: minutesAgo(4), read: false },
      { id: 2, title: 'VIP arrival in 30 min', body: 'Sophie Laurent · Serenity 1', createdAt: minutesAgo(26), read: false },
      { id: 3, title: 'Package delivered', body: 'Smart Locker 07 · Abba Abdouraman', createdAt: minutesAgo(95), read: false },
    ],
    property: {
      name: 'Faysha Wellness Residence',
      brand: 'FAY OS',
      timeZone: 'Gulf Standard Time (GMT+4)',
      currency: 'USD ($)',
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      phone: '971501234567',
      email: 'concierge@faysha.com',
    },
  };
}

export const aiAnswers = {
  "Prepare tomorrow's VIP arrivals":
    "3 VIP arrivals tomorrow: Richard T. (Serenity 2, 3 PM), Linda E. (Allure Penthouse 2, 4 PM), Carlos M. (Riviera 3, 6 PM). I've drafted welcome amenities, pre-cooled residences and queued chauffeur bookings — approve?",
  "Show today's operations summary":
    '18 requests (6 done, 7 in progress, 1 escalated). Occupancy 72%. Spa at 92% capacity. 1 AC issue in Riviera 2 assigned to Omar S.',
  'Optimize housekeeping schedule': 'Moving Villa Spectra 2 departure clean to 10:00 frees Maya R. for Serenity 2 arrival prep. Saves ~40 min. Apply?',
  'Create a special dining experience':
    'Suggest a private beach dinner for Abba A. on Nov 29 — seafood tasting, ocean view, matching his preferences. Draft offer ready.',
  "Analyse this month's performance": 'Revenue $48,250 (↑18%). Satisfaction 4.8/5. In-residence dining feedback dipped 0.3 — recommend a themed menu refresh.',
};
export const aiFallback = "Working on it — I'll pull data from Reservations, Operations and Guest 360 and report back here.";

/**
 * Sample data served when config.useMocks is on. Shapes match the backend contract in docs/API.md,
 * so a page renders identically against mocks or the live Express API.
 */

export const user = { id: 1, name: 'FAY Admin', email: 'admin@faysha.com', role: 'admin' };

export const conversations = [
  ['Abba Abdouraman', 'Your package has arrived at the…', '18:13', 'whatsapp', 'In House'],
  ['Sophie Laurent', 'Thank you! The massage was…', '16:42', 'email', 'In House'],
  ['James & Anna', 'Can we book the sunset yacht…', '15:20', 'whatsapp', 'In House'],
  ['Michael Chen', 'Dinner reservation confirmed.', '14:35', 'whatsapp', 'In House'],
  ['Elena Petrova', 'Is the gym open now?', '11:22', 'whatsapp', 'In House'],
  ['David Kim', 'Airport transfer details please.', '09:18', 'email', 'Arriving'],
  ['Grace N.', 'Thank you for the wonderful…', 'Yesterday', 'in_app', 'Checked Out'],
  ['Carlos Mendez', 'Could you arrange groceries…', 'Yesterday', 'email', 'In House'],
  ['Linda E.', 'What time is the spa available?', 'Yesterday', 'in_app', 'In House'],
  ['Marie T.', 'Can I have extra towels?', 'Yesterday', 'whatsapp', 'In House'],
].map(([guestName, lastMessage, lastAtLabel, channel, stayStatus], i) => ({ id: i + 1, guestName, lastMessage, lastAtLabel, channel, stayStatus }));

export const messages = {
  1: [
    { id: 1, conversationId: 1, fromStaff: false, sender: 'Abba Abdouraman', body: 'Hi FAY, has my grocery delivery arrived?', createdAt: '2025-11-28T18:10:00' },
    {
      id: 2,
      conversationId: 1,
      fromStaff: true,
      sender: 'FAY AI Concierge',
      body: 'Yes, your grocery delivery has arrived and is securely stored at the FAY Smart Locker Hub.\n\nLocker 07 is ready for your collection. Open it with your Faysha app, NFC card, or the QR code at the locker.',
      createdAt: '2025-11-28T18:12:00',
    },
    { id: 3, conversationId: 1, fromStaff: true, sender: 'Package Ready for Collection', body: 'Locker 07 · 1 package · Delivered at 18:12', createdAt: '2025-11-28T18:12:00' },
    { id: 4, conversationId: 1, fromStaff: false, sender: 'Abba Abdouraman', body: 'Perfect, thank you!', createdAt: '2025-11-28T18:13:00' },
  ],
};

export const serviceRequests = [
  ['#1386', '18:20', 'Abba A.', 'Delivery', 'Smart Locker 07', 'Normal', 'In Progress', 'Concierge'],
  ['#1385', '17:10', 'Abba A.', 'Extra towels', 'Serenity 1', 'High', 'In Progress', 'Housekeeping'],
  ['#1384', '16:42', 'Sophie L.', 'Private dining setup', 'Riviera 1', 'Normal', 'Completed', 'Dining'],
  ['#1383', '15:20', 'James & Anna', 'Yacht transfer', 'Marina', 'Normal', 'Scheduled', 'Transportation'],
  ['#1382', '14:35', 'Michael C.', 'AC temperature', 'Allure Penthouse 1', 'High', 'Escalated', 'Maintenance'],
  ['#1381', '13:15', 'Elena P.', 'Massage room setup', 'Spa', 'Normal', 'Completed', 'Wellness'],
  ['#1380', '11:22', 'Linda E.', 'Laundry collection', 'Smart Locker 03', 'Normal', 'In Progress', 'Housekeeping'],
  ['#1379', '10:18', 'Grace N.', 'Grocery delivery', 'Smart Locker 05', 'Normal', 'Completed', 'Concierge'],
  ['#1378', '09:40', 'Marie T.', 'Pool cabana setup', 'Pool Club', 'Low', 'Completed', 'Experiences'],
  ['#1377', '08:15', 'David K.', 'Golf cart pickup', 'Residence Drive', 'Normal', 'On Hold', 'Transportation'],
].map(([number, time, guestName, title, location, priority, status, department]) => ({
  id: Number(number.slice(1)),
  number,
  createdAt: `2025-11-28T${time}:00`,
  guestName,
  title,
  location,
  priority,
  status,
  department,
}));

/** Stays in November 2025 as [residence, collection, start day offset from Oct 26, nights]. */
const STAYS = [
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
const GUESTS = ['Grace N.', 'Carlos Mendez', 'Linda E.', 'Michael Chen', 'Marie T.', 'Richard Thompson', 'James & Anna', 'David Kim', 'Abba Abdouraman', 'Elena Petrova', 'Sophie Laurent', 'Carlos Mendez'];
const day = (offset) => {
  const d = new Date(2025, 9, 26 + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const reservations = STAYS.map(([residence, collection, start, nights], i) => ({
  id: 5000 + i,
  guestName: GUESTS[i],
  residence,
  collection,
  checkIn: day(start),
  checkOut: day(start + nights),
  guests: 2,
  status: 'Confirmed',
  totalAmount: nights * 690,
  currency: 'usd',
}));

const movement = (rows) => rows.map(([time, guestName, residence, guests, status], i) => ({ id: i + 1, time, guestName, residence, guests, status }));

export const todayMovements = {
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
};

export const residences = [
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
].map(([name, collection, guestName, status], i) => ({ id: i + 1, name, collection, guestName, status, panoramaUrl: null, targetTemp: 22, scene: 'relax' }));

export const housekeepingRooms = [
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
].map(([residence, status, note], i) => ({ id: i + 1, residence, status, note }));

export const diningTables = [
  { id: 'R-01', status: 'Reserved', guestName: 'Abba A.' },
  { id: 'R-02', status: 'Available', guestName: '' },
  { id: 'R-03', status: 'Seated', guestName: 'D. Kim' },
  { id: 'R-04', status: 'Available', guestName: '' },
  { id: 'R-05', status: 'Seated', guestName: 'M. Chen' },
  { id: 'R-06', status: 'Available', guestName: '' },
  { id: 'R-07', status: 'Available', guestName: '' },
  { id: 'R-08', status: 'Cleaning', guestName: '' },
];

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

export const notifications = [
  { id: 1, title: 'AC temperature escalated', body: 'Allure Penthouse 1 · Maintenance', createdAt: minutesAgo(4), read: false },
  { id: 2, title: 'VIP arrival in 30 min', body: 'Sophie Laurent · Serenity 1', createdAt: minutesAgo(26), read: false },
  { id: 3, title: 'Package delivered', body: 'Smart Locker 07 · Abba Abdouraman', createdAt: minutesAgo(95), read: false },
];

export const property = {
  name: 'Faysha Wellness Residence',
  brand: 'FAY OS',
  timeZone: 'Gulf Standard Time (GMT+4)',
  currency: 'USD ($)',
  checkInTime: '3:00 PM',
  checkOutTime: '11:00 AM',
  phone: '971501234567',
  email: 'concierge@faysha.com',
};

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

/**
 * Seed rows for the operational pages' list resources (see src/api/collections.js).
 * Built with the same relative-date helpers as data.js: at(days, 'HH:mm'), past(days, 'HH:mm'), day(days).
 */
import moment from 'moment';

const rows = (cols, data) => data.map((r, i) => Object.fromEntries([['id', i + 1], ...cols.map((c, j) => [c, r[j]])]));

export function buildCollections({ at, past, day }) {
  return {
    // ---- Settings ----
    team: rows(
      ['name', 'email', 'role', 'department', 'status'],
      [
        ['FAY Admin', 'admin@faysha.com', 'Administrator', 'Management', 'Active'],
        ['Nadia K.', 'nadia@faysha.com', 'General Manager', 'Management', 'Active'],
        ['Lucien P.', 'lucien@faysha.com', 'Supervisor', 'Housekeeping', 'Active'],
        ['Maya R.', 'maya@faysha.com', 'Staff', 'Housekeeping', 'Active'],
        ['Omar S.', 'omar@faysha.com', 'Technician', 'Maintenance', 'Active'],
        ['Karim A.', 'karim@faysha.com', 'Chauffeur', 'Transportation', 'Active'],
        ['Chef Antoine', 'antoine@faysha.com', 'Supervisor', 'Dining', 'Active'],
        ['Lina S.', 'lina@faysha.com', 'Therapist', 'Wellness', 'Invited'],
      ],
    ),
    integrations: rows(
      ['icon', 'name', 'detail', 'status'],
      [
        ['chat', 'WhatsApp Business', 'Guest messaging', 'Connected'],
        ['mail', 'Email (SMTP)', 'Nodemailer · confirmations & receipts', 'Connected'],
        ['hotel', 'Property Management', 'Reservations sync', 'Connected'],
        ['home_iot_device', 'Smart Home Hub', '486 devices', 'Connected'],
        ['deployed_code', 'Smart Locker Hub', '12 lockers', 'Connected'],
        ['payments', 'Payments (Stripe)', 'Card payments & deposits', 'Action needed'],
        ['notifications_active', 'Push Notifications (Firebase)', 'Staff & guest app alerts', 'Disconnected'],
      ],
    ),
    invoices: rows(
      ['number', 'date', 'amount', 'status'],
      [
        ['INV-2026-010', day(-14), 1490, 'Paid'],
        ['INV-2026-009', day(-45), 1490, 'Paid'],
        ['INV-2026-008', day(-75), 1490, 'Paid'],
        ['INV-2026-007', day(-106), 1290, 'Paid'],
      ],
    ),
    preferences: {
      ai: { autoReply: true, recommendations: true, autoAssign: true, smartHome: true, approvalOver500: false },
      notifications: {
        vipArrival: { push: true, email: true, sms: false },
        escalation: { push: true, email: true, sms: true },
        newRequest: { push: true, email: false, sms: false },
        payment: { push: false, email: true, sms: false },
        deviceAlert: { push: true, email: false, sms: false },
      },
      billing: { plan: 'FAY OS Premium', price: 1490, card: '4242', nextInvoice: day(16) },
    },
    // ---- AI Command ----
    aiAlerts: rows(
      ['icon', 'severity', 'title', 'detail', 'raisedAt', 'status', 'link'],
      [
        ['error', 'High', 'VIP arrival in 2 hours', 'Prepare villa, transportation & amenities', past(0, '18:35'), 'Open', '/guest360?guest=7'],
        ['error', 'High', 'Riviera 2 – AC below optimal', 'Maintenance assigned', past(0, '18:17'), 'Open', '/maintenance'],
        ['warning', 'Medium', 'High spa demand tomorrow', 'Recommend extra staff allocation', past(0, '17:45'), 'Open', '/wellness'],
        ['warning', 'Medium', 'Housekeeping staff shortage', 'Request 2 additional staff for tomorrow', past(0, '16:45'), 'Open', '/housekeeping'],
        ['info', 'Low', 'In-residence dining satisfaction dipping', 'Review recent feedback', past(0, '15:45'), 'Open', '/dining'],
        ['info', 'Low', 'Locker 07 package waiting 2h', 'Remind guest via WhatsApp', past(0, '14:40'), 'Resolved', '/comms'],
      ],
    ),
    aiPriorities: rows(
      ['title', 'level', 'done'],
      [
        ['Prepare VIP arrivals (3 guests)', 'High', false],
        ['Optimize spa staffing for tomorrow', 'High', false],
        ['Follow up on outstanding requests (5)', 'Medium', false],
        ['Coordinate private dinner at Pool Club', 'Medium', false],
        ['Review maintenance alerts (2)', 'Low', false],
      ],
    ),
    // ---- Experiences ----
    experiences: rows(
      ['img', 'category', 'name', 'description', 'duration', 'capacity', 'price', 'active'],
      [
        ['yacht at sunset', 'Water', 'Sunset Yacht Experience', 'Private charter along the coast with canapés', '3 h', 8, 1200, true],
        ['desert dunes', 'Outdoor', 'Desert Dune Safari', '4×4 dunes, falconry and stargazing camp', '5 h', 6, 420, true],
        ['golf course', 'Sport', 'Private Golf Experience', '18 holes with resident pro', '4 h', 4, 350, true],
        ['old town market', 'Cultural', 'Old Town Heritage Walk', 'Guided souk & architecture tour', '2.5 h', 10, 90, true],
        ['chef at table', 'Culinary', 'Private Chef Experience', 'Seven-course tasting in your residence', '3 h', 6, 680, true],
        ['diving reef', 'Water', 'Reef Snorkel & Dive', 'Guided reef dive, all equipment included', '3 h', 6, 260, true],
        ['sunrise yoga', 'Wellness', 'Sunrise Beach Yoga', 'Breathwork and flow at first light', '1 h', 12, 45, true],
        ['kids club', 'Family', 'Young Explorers Club', 'Nature crafts and treasure hunt (ages 5–12)', '3 h', 12, 60, true],
      ],
    ),
    experienceBookings: rows(
      ['startsAt', 'experience', 'guestId', 'guestName', 'pax', 'status', 'total'],
      [
        [at(1, '07:00'), 'Sunrise Beach Yoga', 1, 'Abba Abdouraman', 1, 'Confirmed', 45],
        [at(1, '09:00'), 'Private Golf Experience', 4, 'Michael Chen', 2, 'Confirmed', 700],
        [at(1, '15:00'), 'Desert Dune Safari', 3, 'James & Anna Whitfield', 2, 'Pending', 840],
        [at(2, '16:00'), 'Sunset Yacht Experience', 1, 'Abba Abdouraman', 2, 'Pending', 1200],
        [at(3, '10:00'), 'Old Town Heritage Walk', 5, 'Elena Petrova', 3, 'Confirmed', 270],
        [at(-1, '10:00'), 'Reef Snorkel & Dive', 2, 'Sophie Laurent', 2, 'Completed', 520],
      ],
    ),
    // ---- Transportation ----
    transfers: rows(
      ['date', 'time', 'kind', 'guestId', 'guestName', 'from', 'to', 'vehicle', 'driver', 'status'],
      [
        [day(0), '09:30', 'Airport arrival', 6, 'David Kim', 'Airport', 'Serenity 3', 'Mercedes S-Class', 'Karim A.', 'Completed'],
        [day(0), '11:00', 'Airport departure', 9, 'Carlos Mendez', 'Riviera 2', 'Airport', 'Range Rover', 'Yusuf B.', 'Completed'],
        [day(0), '14:00', 'Resort', 11, 'Marie Tchoua', 'Riviera 4', 'Pool Club', 'Golf Cart 04', '—', 'En Route'],
        [day(0), '15:30', 'Airport arrival', 7, 'Richard Thompson', 'Airport', 'Serenity 2', 'Mercedes V-Class', 'Karim A.', 'Delayed'],
        [day(0), '16:00', 'Marina', 3, 'James & Anna Whitfield', 'Villa Spectra 1', 'Marina', 'Range Rover', 'Yusuf B.', 'Assigned'],
        [day(0), '19:15', 'Dining', 1, 'Abba Abdouraman', 'Serenity 1', 'Riviera', 'Golf Cart 02', '—', 'Scheduled'],
        [day(0), '21:00', 'City', 5, 'Elena Petrova', 'Riviera 1', 'Old Town', 'Mercedes S-Class', 'Leon F.', 'Scheduled'],
        [day(2), '12:30', 'Airport departure', 1, 'Abba Abdouraman', 'Serenity 1', 'Airport', 'Mercedes S-Class', 'Karim A.', 'Scheduled'],
      ],
    ),
    fleet: rows(
      ['icon', 'name', 'detail', 'status'],
      [
        ['directions_car', 'Mercedes S-Class', '2 vehicles · executive sedan', 'Available'],
        ['airport_shuttle', 'Mercedes V-Class', 'Van · 7 seats', 'On Trip'],
        ['directions_car', 'Range Rover', '2 vehicles · SUV', 'Assigned'],
        ['golf_course', 'Golf Cart 02', 'Resort cart · 4 seats', 'Available'],
        ['golf_course', 'Golf Cart 04', 'Resort cart · 4 seats', 'On Trip'],
        ['electric_bike', 'E-Bikes', '10 bikes · 4 checked out', 'Available'],
        ['directions_boat', 'Yacht “Serenity”', '12 guests · crew of 3', 'Booked'],
      ],
    ),
    drivers: rows(
      ['name', 'area', 'status', 'phone'],
      [
        ['Karim A.', 'Airport route', 'On Trip', '+971 50 111 2233'],
        ['Yusuf B.', 'Resort', 'Available', '+971 50 222 3344'],
        ['Leon F.', 'Evening shift from 18:00', 'Off Duty', '+971 50 333 4455'],
        ['Sara M.', 'Resort', 'Available', '+971 50 444 5566'],
      ],
    ),
    flights: rows(
      ['flight', 'guestId', 'guestName', 'direction', 'airport', 'time', 'status'],
      [
        ['EK 203', 7, 'Richard Thompson', 'Arrival', 'DXB', at(0, '15:10'), 'Delayed 25m'],
        ['QR 1012', 8, 'Grace Nkemelu', 'Departure', 'DXB', at(0, '18:40'), 'On Time'],
        ['BA 107', 2, 'Sophie Laurent', 'Departure', 'DXB', at(2, '10:05'), 'Scheduled'],
        ['EY 451', 1, 'Abba Abdouraman', 'Departure', 'AUH', at(2, '14:20'), 'Scheduled'],
      ],
    ),
    // ---- Dining ----
    diningReservations: rows(
      ['date', 'time', 'guestId', 'guestName', 'covers', 'venue', 'table', 'status', 'source', 'notes'],
      [
        [day(0), '12:30', 11, 'Marie Tchoua', 2, 'Pool Club', 'P-01', 'Completed', 'Reservation', ''],
        [day(0), '13:00', 6, 'David Kim', 4, 'Riviera', 'R-03', 'Seated', 'Reservation', ''],
        [day(0), '13:15', 3, 'James & Anna Whitfield', 2, 'Pool Club', 'P-04', 'Seated', 'Walk-in', ''],
        [day(0), '19:30', 1, 'Abba Abdouraman', 4, 'Riviera', 'R-01', 'Confirmed', 'Reservation', 'Ocean-view table'],
        [day(0), '19:45', 2, 'Sophie Laurent', 2, 'Private Dining', 'PD-01', 'Confirmed', 'Reservation', ''],
        [day(0), '20:00', 4, 'Michael Chen', 6, 'Riviera', 'R-05', 'Confirmed', 'Reservation', ''],
        [day(0), '20:15', 5, 'Elena Petrova', 2, 'Pool Club', 'P-07', 'Confirmed', 'Reservation', 'Vegetarian'],
        [day(0), '20:30', 7, 'Richard Thompson', 2, 'In-Residence', 'IR-01', 'Confirmed', 'Reservation', 'Anniversary'],
      ],
    ),
    diningOrders: rows(
      ['number', 'venue', 'items', 'time', 'location', 'status', 'guestId', 'guestName', 'total'],
      [
        ['#D458', 'Pool Club', 'Grilled seafood platter', '12:42', 'Cabana 4', 'Preparing', 3, 'James & Anna Whitfield', 96],
        ['#D457', 'Riviera', 'Mediterranean tasting menu', '20:15', 'Table R-05', 'Confirmed', 4, 'Michael Chen', 408],
        ['#D456', 'In-Residence', 'Breakfast for 2', '08:30', 'Serenity 1', 'Delivered', 1, 'Abba Abdouraman', 64],
        ['#D455', 'In-Residence', 'Fruit platter & juices', '16:10', 'Riviera 3', 'Delivered', 2, 'Sophie Laurent', 38],
      ],
    ),
    menuItems: rows(
      ['name', 'venue', 'price', 'category', 'available', 'popular'],
      [
        ['Grilled Lobster', 'Riviera', 52, 'Main', true, true],
        ['Mediterranean Tasting', 'Riviera', 68, 'Tasting menu', true, true],
        ['Fresh Catch of the Day', 'Pool Club', 36, 'Main', true, true],
        ['Signature Cocktail', 'Pool Club', 18, 'Drinks', true, true],
        ['Burrata & Heirloom Tomato', 'Riviera', 22, 'Starter', true, false],
        ['Wagyu Sliders', 'Pool Club', 28, 'Main', true, false],
        ['Açaí Bowl', 'In-Residence', 16, 'Breakfast', true, false],
        ['Chocolate Fondant', 'Riviera', 14, 'Dessert', false, false],
      ],
    ),
    // ---- Wellness ----
    wellnessSchedule: rows(
      ['date', 'start', 'end', 'treatment', 'guestId', 'guestName', 'room', 'status'],
      [
        [day(0), '09:00', '10:00', 'Deep Tissue Massage', 2, 'Sophie Laurent', 'Treatment Room 1', 'Completed'],
        [day(0), '10:00', '11:30', 'FAY Thermal Recovery', 1, 'Abba Abdouraman', 'Recovery Suite', 'In Progress'],
        [day(0), '11:00', '12:00', 'Yoga & Breathwork', 3, 'James & Anna Whitfield', 'Wellness Club', 'In Progress'],
        [day(0), '12:00', '13:00', 'Signature Facial', 5, 'Elena Petrova', 'Treatment Room 2', 'Upcoming'],
        [day(0), '14:00', '15:00', 'Red Light Therapy', 4, 'Michael Chen', 'Recovery Suite', 'Upcoming'],
        [day(0), '15:30', '16:30', 'Couples Massage', 6, 'David Kim', 'Treatment Room 1', 'Upcoming'],
        [day(0), '17:00', '18:00', 'Meditation Float', 7, 'Richard Thompson', 'FAY FLOAT', 'Upcoming'],
        [day(0), '18:30', '19:30', 'Hot Stone Massage', 11, 'Marie Tchoua', 'Treatment Room 3', 'Upcoming'],
      ],
    ),
    wellnessPackages: rows(
      ['title', 'guestName', 'date', 'start', 'end', 'status'],
      [
        ['FAY Recovery Package', 'Abba Abdouraman', day(1), '10:00', '12:00', 'Confirmed'],
        ['Couples Wellness Ritual', 'James & Anna Whitfield', day(1), '16:00', '18:00', 'Pending'],
        ['Sleep Reset (3 days)', 'Sophie Laurent', day(2), '09:00', '10:30', 'Confirmed'],
      ],
    ),
    // ---- Housekeeping ----
    housekeepingTasks: rows(
      ['time', 'title', 'location', 'assignee', 'status'],
      [
        ['08:30', 'Departure clean', 'Villa Spectra 2', 'Lucien P.', 'In Progress'],
        ['09:00', 'Extra towels', 'Serenity 1', 'Team A', 'In Progress'],
        ['10:00', 'Arrival prep', 'Serenity 2', 'Maya R.', 'Completed'],
        ['11:00', 'Deep clean', 'Allure Penthouse 2', 'Amara K.', 'In Progress'],
        ['14:00', 'Daily service', 'Riviera 3', 'Team B', 'Scheduled'],
        ['16:00', 'Laundry return', 'Smart Locker 03', 'Team A', 'Scheduled'],
        ['20:00', 'Turndown service', 'Riviera 1', 'Team C', 'Scheduled'],
        ['07:30', 'Pool towels restock', 'Pool Club', 'Team A', 'Completed'],
        ['12:30', 'Minibar refresh', 'Allure Penthouse 1', 'Amara K.', 'Scheduled'],
      ],
    ),
    housekeepingStaff: rows(
      ['name', 'zone', 'shift'],
      [
        ['Maya R.', 'Serenity Collection', 'Morning'],
        ['Lucien P.', 'Villa Spectra', 'Morning'],
        ['Amara K.', 'Allure Penthouse', 'Morning'],
        ['Team A', 'Public areas & lockers', 'All day'],
        ['Team B', 'Riviera Collection', 'Afternoon'],
        ['Team C', 'Evening turndown', 'Evening'],
      ],
    ),
    linenStock: rows(
      ['item', 'level', 'par'],
      [
        ['Bath towels', 82, 400],
        ['Bed linen sets', 64, 120],
        ['Bathrobes', 48, 80],
        ['Toiletry kits', 28, 200],
        ['Slippers', 71, 150],
        ['Pool towels', 55, 250],
      ],
    ),
    guestNotes: rows(
      ['icon', 'residence', 'guest', 'text'],
      [
        ['bed', 'Serenity 1', 'Abba A.', 'Hypoallergenic pillows, 4 extra towels, no turndown chocolates'],
        ['do_not_disturb_on', 'Riviera 1', 'Elena P.', 'Service only after 11 AM'],
        ['eco', 'Villa Spectra 1', 'James & Anna', 'Eco mode — linen change every 3 days'],
        ['cake', 'Serenity 2', 'Richard T.', 'Anniversary — rose petal setup on arrival'],
        ['pets', 'Riviera 4', 'Marie T.', 'Travelling with a small dog — pet bed and bowls'],
      ],
    ),
    // ---- Maintenance ----
    workOrders: rows(
      ['number', 'title', 'location', 'priority', 'technician', 'status', 'createdAt'],
      [
        ['WO-412', 'AC performance below optimal', 'Riviera 2', 'High', 'Omar S.', 'In Progress', past(0, '18:15')],
        ['WO-411', 'Smart lock battery low', 'Villa Spectra 1', 'Medium', 'Ravi D.', 'Scheduled', past(0, '16:45')],
        ['WO-410', 'Terrace sensor offline', 'Serenity 3', 'Medium', 'Ravi D.', 'Open', past(0, '15:45')],
        ['WO-409', 'Pool heater pressure', 'Allure Penthouse 1', 'High', 'Omar S.', 'Awaiting Parts', past(-1, '11:00')],
        ['WO-408', 'Blind motor noise', 'Serenity 1', 'Low', 'Kenji T.', 'Scheduled', past(-1, '09:30')],
        ['WO-407', 'Spa steam room thermostat', 'Wellness Club', 'Medium', 'Kenji T.', 'In Progress', past(-2, '14:00')],
        ['WO-406', 'Kitchen extractor filter', 'Riviera Restaurant', 'Low', 'Team B', 'Completed', past(-3, '10:00')],
        ['WO-405', 'Locker 11 door alignment', 'Smart Locker Hub', 'Low', 'Ravi D.', 'Completed', past(-4, '12:00')],
      ],
    ),
    systems: rows(
      ['icon', 'name', 'health', 'checkedAt'],
      [
        ['ac_unit', 'HVAC', 92, past(0, '08:00')],
        ['bolt', 'Power & Backup', 98, past(0, '08:00')],
        ['water_drop', 'Water & Pools', 86, past(0, '08:00')],
        ['wifi', 'Network & IoT', 99, past(0, '08:00')],
        ['lock', 'Access Control', 96, past(0, '08:00')],
        ['videocam', 'Cameras', 100, past(0, '08:00')],
      ],
    ),
    preventive: rows(
      ['date', 'title', 'location', 'duration', 'status'],
      [
        [day(1), 'HVAC filter replacement', 'Serenity Collection', '3 h', 'Planned'],
        [day(2), 'Generator test', 'Plant Room', '1 h', 'Planned'],
        [day(3), 'Pool water treatment', 'All residences', '4 h', 'Planned'],
        [day(4), 'Fire system inspection', 'Full property', '6 h', 'Planned'],
        [day(5), 'Elevator service', 'Allure Penthouse', '2 h', 'Planned'],
        [day(-2), 'Solar panel cleaning', 'Roofs', '3 h', 'Done'],
      ],
    ),
    maintenanceAlerts: rows(
      ['icon', 'severity', 'title', 'detail', 'location', 'status'],
      [
        ['ac_unit', 'High', 'Riviera 2 · AC unit', 'Cooling 3° below setpoint for 40 min', 'Riviera 2', 'Open'],
        ['battery_alert', 'Medium', 'Villa Spectra 1 · Front lock', 'Battery at 15%', 'Villa Spectra 1', 'Open'],
        ['sensors_off', 'High', 'Serenity 3 · Motion sensor', 'Offline since 15:40', 'Serenity 3', 'Open'],
        ['water_damage', 'Medium', 'Allure Penthouse 2 · Leak sensor', 'Moisture detected — check required', 'Allure Penthouse 2', 'Open'],
      ],
    ),
    technicians: rows(
      ['name', 'skill', 'status'],
      [
        ['Omar S.', 'HVAC & Pools', 'On job'],
        ['Ravi D.', 'Smart Home & IoT', 'Available'],
        ['Kenji T.', 'Electrical', 'On job'],
        ['Team B', 'General', 'Off shift'],
      ],
    ),
    // ---- Residences ----
    deviceAlerts: rows(
      ['icon', 'severity', 'residence', 'title', 'raisedAt', 'status'],
      [
        ['warning', 'High', 'Riviera 2', 'AC below optimal level', past(0, '18:15'), 'Open'],
        ['battery_alert', 'Medium', 'Villa Spectra 1', 'Lock battery 15%', past(0, '16:40'), 'Open'],
        ['wifi_off', 'High', 'Serenity 3', 'Terrace sensor offline', past(0, '15:40'), 'Open'],
        ['water_drop', 'Low', 'Allure Penthouse 2', 'Pool pH slightly high', past(-1, '10:20'), 'Resolved'],
        ['lightbulb', 'Low', 'Riviera 1', 'Garden light bulb replaced', past(-2, '09:00'), 'Resolved'],
      ],
    ),
    // ---- Reservations ----
    roomTypes: rows(
      ['collection', 'units', 'rate', 'capacity', 'bedrooms', 'view'],
      [
        ['Serenity Collection', 6, 690, 4, 2, 'Garden & ocean'],
        ['Riviera Collection', 4, 780, 4, 2, 'Beachfront'],
        ['Villa Spectra', 6, 1150, 8, 4, 'Private pool'],
        ['Allure Penthouse', 4, 1480, 6, 3, 'Panoramic ocean'],
      ],
    ),
    packages: rows(
      ['name', 'detail', 'price', 'nights', 'collection'],
      [
        ['Wellness Escape', 'Stay · Spa · Dining', 690, 3, 'Serenity Collection'],
        ['Romantic Getaway', 'Villa · Private Dining', 950, 2, 'Villa Spectra'],
        ['Family Retreat', 'Stay · Activities', 780, 4, 'Riviera Collection'],
        ['Penthouse Celebration', 'Penthouse · Chef · Yacht', 2400, 2, 'Allure Penthouse'],
        ['Digital Detox', 'Serenity · Float · Yoga', 820, 5, 'Serenity Collection'],
      ],
    ),
    groups: rows(
      ['dates', 'name', 'residences', 'guests', 'status', 'contact'],
      [
        [`${moment(day(7)).format('MMM D')}–${moment(day(9)).format('D')}`, 'Corporate Retreat', 'Villa Spectra (6 rooms)', 24, 'Confirmed', 'Lukas Becker'],
        [`${moment(day(14)).format('MMM D')}–${moment(day(15)).format('D')}`, 'Wedding Celebration', 'Allure Penthouse + Pool Club', 50, 'Confirmed', 'Isabella Rossi'],
        [`${moment(day(22)).format('MMM D')}–${moment(day(25)).format('D')}`, 'End of Year Group', 'Serenity Collection (4 rooms)', 16, 'Pending', 'Amira Haddad'],
        [`${moment(day(40)).format('MMM D')}–${moment(day(43)).format('D')}`, 'Wellness Retreat', 'Full Property (12 rooms)', 28, 'Inquiry', 'Fatima Al Mansoori'],
      ],
    ),
    // ---- Guest Journey ----
    automations: rows(
      ['icon', 'title', 'detail', 'enabled'],
      [
        ['auto_awesome', 'Morning wellness nudge', 'Daily at 8:00 AM via WhatsApp', true],
        ['restaurant', 'Dinner reminder', '2 hours before reservation', true],
        ['thermostat', 'Pre-cool residence', 'When guest leaves spa', true],
        ['cake', 'Birthday surprise', 'On the birthday · notify dining team', false],
        ['logout', 'Express checkout link', 'Departure day at 8:00 AM', true],
        ['star', 'Post-stay survey', '2 hours after checkout via email', true],
        ['flight_land', 'Pre-arrival welcome', '24 hours before arrival', true],
      ],
    ),
  };
}

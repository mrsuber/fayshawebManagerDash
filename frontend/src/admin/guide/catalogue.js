/**
 * The platform guide (HQ → Platform guide): every feature of the website, the guest app, FAY OS, HQ and the server,
 * what it does, where to find it, how complete it is, and ideas to improve it.
 *
 * Keep this file up to date when a feature ships or changes: it is how the team knows what exists.
 *
 * status: 'live'     works end to end
 *         'setup'    built, needs configuration or content before it is useful (keys, photos, hardware…)
 *         'partial'  works, with known limits (see `limits`)
 *         'planned'  not built yet (listed so ideas are not lost)
 */

export const SURFACES = [
  ['website', 'Website', 'public', 'fayshaa.com — anyone, no account needed'],
  ['app', 'Guest app', 'smartphone', 'The Faysha app for iOS and Android — guests'],
  ['fayos', 'FAY OS', 'dashboard', '/manager — managers run the property day to day'],
  ['hq', 'Faysha HQ', 'admin_panel_settings', '/admin — super administrators and head office'],
  ['server', 'Automation', 'memory', 'What the server does by itself'],
];

export const STATUS = {
  live: ['Live', '#3fd283'],
  setup: ['Needs setup', '#e8b84a'],
  partial: ['Partial', '#5b8ff0'],
  planned: ['Planned', '#8f897d'],
};

export const FEATURES = [
  // ------------------------------------------------------------------ Website
  {
    surface: 'website', area: 'Stay', name: 'Residences and availability', where: '/residences, /residences/:id', status: 'live',
    does: ['Search by dates and guests; see which residences are free and the price for the stay', 'Residence page: photo gallery that adapts to the photos uploaded, full-screen viewer, 360° tour when a panorama exists', 'Check-in and check-out times come from FAY OS → Settings'],
    improve: ['Seasonal and weekend prices (today one price per night)', 'Minimum stays for peak dates', 'Show reviews on each residence'],
  },
  {
    surface: 'website', area: 'Stay', name: 'Booking and payment', where: '/book', status: 'setup',
    does: ['Guest details, terms of stay (the published version), card (Stripe) or MTN / Orange mobile money', 'A guest account is created automatically; sign-in details, the digital key and the gate QR code arrive by email once paid', 'An unpaid card booking holds the residence 60 minutes; mobile money 48 hours'],
    limits: ['Card payments need Stripe keys', 'Mobile money is confirmed by staff (no gateway connected yet)'],
    improve: ['Connect a local payment aggregator (CinetPay, Campay, Notch Pay) for automatic mobile money', 'Apple Pay / Google Pay', 'Promo codes'],
  },
  {
    surface: 'website', area: 'Stay', name: 'Prices in several currencies', where: 'Header currency selector', status: 'live',
    does: ['Visitors choose XAF, EUR, USD, GBP… (the currencies offered in Settings)', 'Converted prices are marked ≈; card payments are charged in the chosen currency at the recorded rate'],
    improve: ['Detect the visitor’s country to preselect a currency'],
  },
  {
    surface: 'website', area: 'Events', name: 'Events and proposals', where: '/events, /events/quote/:link', status: 'live',
    does: ['Presentation of events at Faysha and a 4-step request: occasion, spaces and food, services and budget, contact', 'The client receives a tailored proposal by email, opens it online and accepts with their name or declines'],
    improve: ['Online deposit payment from the proposal page', 'Downloadable PDF proposal', 'Gallery of event spaces with capacities'],
  },
  {
    surface: 'website', area: 'Events', name: 'Journal (success stories)', where: '/stories', status: 'setup',
    does: ['Stories of weddings, retreats and celebrations with cover, gallery, category and date; filters by category'],
    limits: ['Empty until stories are written in FAY OS → Content → Stories'],
    improve: ['Share buttons and social previews', 'Link each story to the event request form pre-filled with that occasion'],
  },
  {
    surface: 'website', area: 'Information', name: 'Wellness, about, careers, feedback', where: '/wellness, /about, /careers, /feedback', status: 'live',
    does: ['Wellness moods presentation', 'Job listings with applications (received in HQ → HR)', 'Guest feedback form (HQ → Feedback)'],
    improve: ['Wellness page built from the FAY OS catalogue instead of fixed text'],
  },
  {
    surface: 'website', area: 'Information', name: 'Contact', where: '/contact', status: 'live',
    does: ['Messages land in FAY OS → Enquiries for follow-up; the team inbox gets a copy', 'Spam bots are filtered'],
  },
  {
    surface: 'website', area: 'Information', name: 'Terms and privacy', where: '/terms, /privacy', status: 'live',
    does: ['Show the version published in FAY OS → Content, with its number and effective date'],
    improve: ['Legal review of the text (it still says “Property by Result”)'],
  },
  {
    surface: 'website', area: 'Visitors', name: 'Visitor pass', where: '/visit/:link', status: 'live',
    does: ['The page a resident sends to their visitor: day, residence, QR code and 6-digit gate code once approved, directions and map link'],
  },
  {
    surface: 'website', area: 'Information', name: 'Languages', where: 'Header EN / FR', status: 'partial',
    does: ['English and French for the site interface; page text editable per language in HQ → Website content'],
    limits: ['New pages (events, journal) have EN and FR interface text; stories and terms are in one language'],
  },

  // ------------------------------------------------------------------ Guest app
  {
    surface: 'app', area: 'Stay', name: 'Book a stay', where: 'Welcome → Book your stay; Residence → Book a stay', status: 'setup',
    does: ['Same flow as the website, signed in or not; card (Stripe) or mobile money', 'Prices in the guest’s chosen currency'],
    limits: ['Card payments need the Stripe key in the app build'],
  },
  {
    surface: 'app', area: 'Stay', name: 'Residence and digital key', where: 'Residence tab, Digital key', status: 'live',
    does: ['The current stay, its key (gate QR, door PIN), deposit box and PIN, Wi-Fi', 'The key shown is the stay it was opened from; it appears live when the stay is confirmed'],
    limits: ['Door PINs must also be programmed into the locks until smart locks are connected'],
    improve: ['Smart lock integration (Nuki, TTLock, Salto) so PINs are set automatically', 'Wallet pass (Apple / Google Wallet) for the gate QR'],
  },
  {
    surface: 'app', area: 'Stay', name: 'Smart home', where: 'Residence → Smart home', status: 'partial',
    does: ['Climate, scenes and lights stored and mirrored to FAY OS'],
    limits: ['No physical devices connected yet'],
  },
  {
    surface: 'app', area: 'Services', name: 'Requests', where: 'Residence → Requests', status: 'live',
    does: ['Housekeeping, repairs and more; live status updates'],
  },
  {
    surface: 'app', area: 'Services', name: 'Dining', where: 'Residence → Dining', status: 'live',
    does: ['Order in-residence dishes (charged to the stay)', 'Book a table and choose the meal in advance (pre-order); dishes marked pre-order only appear here, with their notice period'],
    improve: ['Photos of dishes', 'Dietary filters'],
  },
  {
    surface: 'app', area: 'Services', name: 'Lockers & equipment', where: 'Residence → Lockers & equipment', status: 'live',
    does: ['Ask for an extra locker, golf clubs and balls, sport, beach or children’s kit', 'The locker code appears once assigned; return time and overdue reminder'],
  },
  {
    surface: 'app', area: 'Services', name: 'Visitors', where: 'Residence → Visitors', status: 'live',
    does: ['Invite a visitor for a day of the stay; share the pass link; told when they arrive'],
  },
  {
    surface: 'app', area: 'Services', name: 'Experiences, rides and the bill', where: 'Residence', status: 'live',
    does: ['Book experiences and airport / city rides', 'See the bill and balance'],
  },
  {
    surface: 'app', area: 'Wellness', name: 'Wellness moods and journeys', where: 'Wellness tab', status: 'partial',
    does: ['Restore, Recharge, Reflect, Explore; book services and multi-stage journeys from the catalogue managed in FAY OS', 'Journey PINs in the digital key'],
    limits: ['Some screens still show fixed text and sample wellness metrics (sleep 90 %, mood “Calm”)'],
    improve: ['Build every wellness screen from the catalogue (photos, stages, places)', 'Remove the sample metrics or connect a real source (wearables)'],
  },
  {
    surface: 'app', area: 'Events', name: 'Plan an event and My events', where: 'Welcome → Plan an event; Profile → My events', status: 'live',
    does: ['The event request; proposals appear in My events to read and accept'],
  },
  {
    surface: 'app', area: 'Communication', name: 'Concierge chat', where: 'Concierge tab', status: 'live',
    does: ['Messages with the team (and the AI concierge when connected); send photos (camera or library) and documents'],
  },
  {
    surface: 'app', area: 'Communication', name: 'Notifications', where: 'Home → bell', status: 'setup',
    does: ['Inbox of everything the app told the guest; live banners in the app; push notifications', 'Arrival-day and departure-morning messages'],
    limits: ['Push needs the app built with Expo push credentials'],
  },
  {
    surface: 'app', area: 'Quality', name: 'Rate your experience', where: 'Residence → Rate your experience', status: 'live',
    does: ['Rate recent requests, meals, equipment and the stay; low ratings reach a manager at once'],
    improve: ['After a 5-star rating, invite the guest to review on Google / TripAdvisor'],
  },
  {
    surface: 'app', area: 'Account', name: 'Account, terms and settings', where: 'Profile', status: 'live',
    does: ['First sign-in password change, personal details, rewards, currency choice, terms and privacy (published version), account deletion'],
  },
  {
    surface: 'app', area: 'Discover', name: 'Explore and 360° tour', where: 'Explore', status: 'setup',
    does: ['Estate places and the virtual tour, managed in FAY OS → Content'],
    limits: ['Needs real photos and 360° images'],
  },

  // ------------------------------------------------------------------ FAY OS
  {
    surface: 'fayos', area: 'Guests', name: 'Guest 360, journey and communications', where: 'Guests', status: 'live',
    does: ['The full guest profile, stays, preferences, timeline and notes', 'One conversation per guest: in-app, email, internal notes; photos and documents'],
    limits: ['Guest 360 shows a placeholder portrait'],
  },
  {
    surface: 'fayos', area: 'Guests', name: 'Enquiries', where: 'Guests → Enquiries', status: 'live',
    does: ['Website messages with status, owner, internal notes and email replies kept in the thread; first-response time'],
  },
  {
    surface: 'fayos', area: 'Front office', name: 'Reservations and front desk', where: 'Reservations', status: 'live',
    does: ['Calendar, booking list, arrivals and departures, check-in / check-out', 'Reservations made here are confirmed with the key and the email'],
    limits: ['A link with ?booking= opens the page, not that reservation'],
  },
  {
    surface: 'fayos', area: 'Operations', name: 'Service requests', where: 'Operations → Service requests', status: 'partial',
    does: ['Every request by department, priority and status; live updates'],
    limits: ['The “average response” figure and the response-time chart are sample values'],
    improve: ['Real response-time statistics from the request history'],
  },
  {
    surface: 'fayos', area: 'Operations', name: 'Lockers & loans', where: 'Operations → Lockers & Loans', status: 'live',
    does: ['Inventory of lendable items with codes; assign, hand over, return with condition, extend, mark lost; overdue alerts'],
  },
  {
    surface: 'fayos', area: 'Operations', name: 'Visitors & gate', where: 'Operations → Visitors & Gate', status: 'setup',
    does: ['Approve visitor passes, check a pass by code or scanned link, open the gate, gate log; approval rule and directions'],
    limits: ['The gate opens automatically only when a gate controller is connected (GATE_WEBHOOK_URL)'],
  },
  {
    surface: 'fayos', area: 'Residences', name: 'Residences and smart home', where: 'Residences', status: 'partial',
    does: ['Every residence with its status, climate, scenes and security'],
    limits: ['No physical devices connected yet'],
  },
  {
    surface: 'fayos', area: 'Residences', name: 'Housekeeping and inspection', where: 'Residences → Housekeeping', status: 'live',
    does: ['Room board Dirty → Cleaning → Inspect → Ready; who cleaned; Ready only through the inspection checklist with a score; tasks, staff, linen and guest notes'],
    improve: ['Inspection from a tablet in the room with photos (staff app)'],
  },
  {
    surface: 'fayos', area: 'Residences', name: 'Maintenance', where: 'Residences → Maintenance', status: 'partial',
    does: ['Work orders, systems health, alerts, technicians'],
    limits: ['Its list of locations is built in, not read from the residences'],
  },
  {
    surface: 'fayos', area: 'Residences', name: 'Assets & lifecycle', where: 'Residences → Assets & Lifecycle', status: 'live',
    does: ['Register of equipment with life left, replace-by and order-by dates, monthly replacement reserve, spares kept', 'Care schedule (service, repaint, deep clean…) and history', '12-month budget forecast; alerts for care due, replacements to order, low spares, warranty ending'],
    improve: ['Attach invoices and manuals', 'Suppliers directory with lead times', 'QR labels on equipment to open its record from a phone'],
  },
  {
    surface: 'fayos', area: 'Wellness', name: 'Wellness today and catalogue', where: 'Wellness (Today, Catalogue)', status: 'live',
    does: ['Today’s wellness operations', 'Catalogue: every service and journey with photos, gallery, stages (each with room, floor, photo, PIN), location, access, hours, booking notice, equipment lent'],
    limits: ['The Today view still has some built-in venue and treatment lists'],
  },
  {
    surface: 'fayos', area: 'Dining', name: 'Dining', where: 'Dining', status: 'live',
    does: ['Reservations (with pre-ordered dishes), orders, tables, menu with “pre-order only” dishes and kitchen notice'],
  },
  {
    surface: 'fayos', area: 'Experiences', name: 'Experiences and transport', where: 'Experiences, Operations → Transportation', status: 'live',
    does: ['Experience catalogue and bookings; transfers, fleet and chauffeurs'],
  },
  {
    surface: 'fayos', area: 'Events', name: 'Events', where: 'Events', status: 'live',
    does: ['Pipeline from request to completed event; proposal builder with presets, discount, tax and deposit; send, track opening and answer; record payments; write the story'],
    improve: ['Banquet event order (BEO) for the kitchen and team', 'Calendar of event spaces to avoid double booking', 'Online deposit payment'],
  },
  {
    surface: 'fayos', area: 'Content', name: 'Content', where: 'Content (sidebar)', status: 'live',
    does: ['Estate places and 360° tour', 'Terms and privacy as published versions with history and acceptance counts', 'Journal stories'],
  },
  {
    surface: 'fayos', area: 'Insight', name: 'Analytics and quality', where: 'Analytics, Analytics → Quality', status: 'live',
    does: ['Occupancy and revenue analytics', 'Guest ratings per team member and department, low ratings to follow up, inspection results per housekeeper'],
  },
  {
    surface: 'fayos', area: 'Insight', name: 'FAY AI', where: 'AI Command', status: 'setup',
    does: ['Questions about the operation answered by Claude; a built-in summary without a key'],
    limits: ['Needs ANTHROPIC_API_KEY'],
  },
  {
    surface: 'fayos', area: 'Platform', name: 'Notifications', where: 'Bell (top right)', status: 'live',
    does: ['Needs action and All; click opens the record; chime, desktop notification and tab count', 'Raised by guests’ actions and by the operations monitor; resolved automatically'],
    limits: ['Phone push for managers needs Firebase web push (REACT_APP_FIREBASE_VAPID_KEY)'],
  },
  {
    surface: 'fayos', area: 'Platform', name: 'Settings', where: 'Settings', status: 'live',
    does: ['Property details, standard check-in / check-out times and alert thresholds, currencies and rates, team and roles, notifications, integrations'],
  },
  {
    surface: 'fayos', area: 'Platform', name: 'Phones and tablets', where: 'Everywhere', status: 'partial',
    does: ['Menu drawer, one-row navigation, compact headings, stacked layouts, page finder (Ctrl/⌘+K)'],
    limits: ['Some dense tables (Reservations, Service requests) scroll sideways on a phone'],
  },

  // ------------------------------------------------------------------ HQ
  {
    surface: 'hq', area: 'Command', name: 'Overview', where: 'HQ → Overview', status: 'live',
    does: ['Earnings today and month to date, occupancy, arrivals and departures, decisions waiting, alerts, teams on duty'],
  },
  {
    surface: 'hq', area: 'Money', name: 'Finance and approvals', where: 'HQ → Finance, Approvals', status: 'live',
    does: ['Revenue, occupancy, ADR, RevPAR, collections by method, CSV export; mark mobile money or cash received; refunds', 'One queue for refunds, discounts, expenses, purchases and leave'],
    improve: ['Asset reserve and maintenance spend in Finance', 'Monthly owner report (PDF)'],
  },
  {
    surface: 'hq', area: 'People', name: 'Staff, roles, HR, view as', where: 'HQ → People', status: 'live',
    does: ['Invite and manage the team, roles and permissions by area, HR (employees, recruitment, attendance, leave)', 'View the platform exactly as another user, read-only'],
    improve: ['Two-factor sign-in for managers'],
  },
  {
    surface: 'hq', area: 'Property', name: 'Properties, residences, bookings', where: 'HQ → Property', status: 'live',
    does: ['Properties; residence categories, units, photos and 360° images, availability, deposit boxes; every booking with keys and payments'],
  },
  {
    surface: 'hq', area: 'Experience', name: 'Wellness catalogue (v1), feedback, website content', where: 'HQ → Experience', status: 'partial',
    does: ['v1 wellness screens, guest feedback and testimonials, page-by-page website text in English and French'],
    limits: ['The v1 wellness screens overlap with FAY OS → Wellness → Catalogue; prefer FAY OS'],
  },
  {
    surface: 'hq', area: 'Governance', name: 'Audit log and this guide', where: 'HQ → Governance', status: 'live',
    does: ['Every change by every signed-in user, and sign-ins', 'This platform guide'],
  },

  // ------------------------------------------------------------------ Server
  {
    surface: 'server', area: 'Booking', name: 'Confirmation, key and email', where: 'services/stayKeys.js', status: 'live',
    does: ['From any path that confirms a stay (card, Stripe webhook, staff, FAY OS, check-in): issues the key once, hands the deposit box over with a new PIN, sends one confirmation email (with first sign-in details for a new guest), notifies the guest', 'Email failures are recorded and raised as an urgent alert'],
  },
  {
    surface: 'server', area: 'Monitor', name: 'Operations monitor', where: 'services/monitor.js (every minute)', status: 'live',
    does: ['Late check-outs, no-shows, residences not ready, requests past their target, guests waiting, unanswered enquiries and event requests, deposits not received, proposals expiring, overdue loans, visitors to approve, asset care and replacements, spares, warranties, equipment down', 'Guest arrival and departure messages', 'Posts each asset’s monthly reserve'],
    improve: ['Thresholds editable in Settings instead of in the code', 'A morning briefing for managers (email or push)'],
  },
  {
    surface: 'server', area: 'Data', name: 'Database migrations', where: 'backend/db/migrations', status: 'live',
    does: ['node db/setup.js applies each new migration once, in a transaction'],
  },
  {
    surface: 'server', area: 'Security', name: 'Uploads and content safety', where: 'services/attachments.js', status: 'live',
    does: ['File types checked from the content; stored under generated names; Markdown rendered without HTML'],
  },

  // ------------------------------------------------------------------ Planned
  { surface: 'server', area: 'Planned', name: 'Payment aggregator for Cameroon', status: 'planned', does: ['Card and mobile money in one provider, confirmed automatically'] },
  { surface: 'server', area: 'Planned', name: 'Channel manager', status: 'planned', does: ['Booking.com, Airbnb and Expedia calendars synchronised'] },
  { surface: 'server', area: 'Planned', name: 'Revenue management', status: 'planned', does: ['Prices by date, season and occupancy; minimum stays'] },
  { surface: 'app', area: 'Planned', name: 'Staff app', status: 'planned', does: ['Each role sees its own screens: housekeeping, maintenance, dining, concierge, drivers, therapists'] },
  { surface: 'server', area: 'Planned', name: 'Smart locks and gate controller', status: 'planned', does: ['Door PINs and gate opening sent to the hardware automatically'] },
];

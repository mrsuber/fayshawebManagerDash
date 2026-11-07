/**
 * Journeys (HQ → Platform guide → Journeys): how Faysha works end to end, told as the steps people actually take,
 * across the website, the guest app, FAY OS, HQ and the server. Used to present the platform (Present mode) and to
 * test it step by step (each step says what to check).
 *
 * Keep it true: when a step ships or changes, update its status here in the same change.
 *
 * step: { who, where, text, status, check? }
 *   who     Guest · Visitor · Front desk · Manager · Specialist · Housekeeper · Technician · HR · HQ · System
 *   where   the screen or place, e.g. "App → Residence → Requests"
 *   status  'live' works end to end · 'setup' built, needs keys / content / hardware · 'partial' works with limits
 *           'coming' being built (shown as Coming soon)
 *   check   what to verify when testing this step
 */

export const STEP_STATUS = {
  live: ['Live', '#3fd283'],
  setup: ['Needs setup', '#e8b84a'],
  partial: ['Partial', '#5b8ff0'],
  coming: ['Coming soon', '#b48cff'],
};

export const ACTORS = {
  Guest: 'person',
  Visitor: 'badge',
  'Front desk': 'concierge',
  Manager: 'manage_accounts',
  Specialist: 'self_improvement',
  Housekeeper: 'cleaning_services',
  Technician: 'construction',
  HR: 'groups',
  HQ: 'admin_panel_settings',
  System: 'memory',
};

export const JOURNEYS = [
  // ===================================================================================================== Booking
  {
    id: 'booking',
    title: 'Booking',
    icon: 'event_available',
    summary: 'How a stay, a wellness session and an event are booked, paid, confirmed, changed, cancelled and managed — and how the right person is assigned and rated.',
    chapters: [
      {
        title: 'Booking a stay',
        intro: 'The same flow on the website and in the app, with or without an account.',
        steps: [
          { who: 'Guest', where: 'Website /residences · App → Book a stay', status: 'live', text: 'Chooses dates and guests; sees which residences are free and the price for the whole stay, in their currency.', check: 'Pick dates: only free residences appear and the total matches nights × price.' },
          { who: 'Guest', where: 'App → Book a stay → residence', status: 'live', text: 'Opens a residence before choosing it: swipes the photos, steps inside the 360° view, sees size, rooms, view, features and amenities, then chooses it from there.', check: 'Photos and 360° views come from HQ → Residences (category media).' },
          { who: 'Guest', where: 'Website /book · App → Book a stay', status: 'live', text: 'Enters their details and accepts the published terms of stay. A guest account is created automatically with the booking.', check: 'The terms shown are the version published in FAY OS → Content.' },
          { who: 'Guest', where: 'Payment step', status: 'setup', text: 'Pays by card (Stripe) or MTN / Orange mobile money, approved on their phone. The residence is held 60 minutes for a card, 48 hours for mobile money.', check: 'Needs the keys in HQ → Settings → Payments. Without mobile money keys (development) payments are simulated and confirm after a few seconds.' },
          { who: 'System', where: 'Server', status: 'live', text: 'Once paid, the stay is confirmed: one gate QR and door PIN, the deposit box handed over with a new PIN, one confirmation email with first sign-in details, a notification in the app.', check: 'One email only, even if the payment is confirmed twice.' },
          { who: 'System', where: 'Server (every minute)', status: 'live', text: 'An unpaid booking is released when its hold runs out so the residence can be sold again.', check: 'A card booking left unpaid for an hour disappears from the calendar.' },
        ],
      },
      {
        title: 'Changing or cancelling a stay',
        intro: 'What happens when plans change — on the guest side and on the team side.',
        steps: [
          { who: 'Front desk', where: 'FAY OS → Reservations', status: 'live', text: 'Creates a booking for a guest on the phone or at the desk; it is confirmed with the key and the email at once.' },
          { who: 'Guest', where: 'App → My stays → Stay', status: 'live', text: 'Cancels, seeing the refund first: full refund more than 14 days before arrival, 50 % from 7 to 14 days, none within 7 days. The key and PIN stop working at once and the refund goes to HQ for approval.', check: 'The refund amount shown matches the policy for the days left.' },
          { who: 'Guest', where: 'App → My stays → Stay', status: 'live', text: 'Asks to change dates: the app checks the residence is free and shows the new price; the request reaches the concierge, who moves it.' },
          { who: 'Manager', where: 'FAY OS → Reservations → booking', status: 'live', text: 'Change dates: the stay is repriced and clash-checked; the guest is told by email and in the app. If they paid more than the new price, the difference goes to HQ as a refund.', check: 'Moving onto booked dates is refused.' },
          { who: 'Manager', where: 'FAY OS → Reservations → booking', status: 'live', text: 'Cancels with a reason the guest receives by email and in the app. Cancelled by Faysha means a full refund, raised for HQ approval.' },
          { who: 'HQ', where: 'HQ → Approvals', status: 'live', text: 'Approves the refund; only then is money sent back (card refund through Stripe). A partial refund leaves the booking record intact.' },
          { who: 'Manager', where: 'FAY OS → Reservations → booking', status: 'live', text: 'From the arrival day, marks a guest who never came as No-show: the residence is released, the key revoked, the guest told; no refund under the terms.' },
          { who: 'Front desk', where: 'FAY OS → Front desk', status: 'live', text: 'Checks guests in and out. Check-out sends the residence to housekeeping (Dirty) and hands the deposit box on.' },
        ],
      },
      {
        title: 'Booking wellness',
        intro: 'Restore, Recharge, Reflect, Explore — booked from the app, run by the wellness team.',
        steps: [
          { who: 'HQ', where: 'HQ → Wellness catalogue · FAY OS → Wellness → Catalogue', status: 'live', text: 'The team sets up places (zones), experiences, journeys with their stages, photos, access (code or PIN) and opening times.' },
          { who: 'Guest', where: 'App → Wellness', status: 'live', text: 'Picks one or several experiences, a day of their stay and a time. Times opened by the team are Instant; other times are On request.', check: 'Only the days of the stay are offered.' },
          { who: 'System', where: 'Server', status: 'live', text: 'Instant times are confirmed at once; every booking gets a code (W7K3Q9A); PIN journeys get a PIN; the price goes on the bill.' },
          { who: 'Manager', where: 'FAY OS → Wellness → Bookings', status: 'live', text: 'Confirms a request (at the asked time or another) or declines it with a reason; the guest is notified either way.' },
          { who: 'Manager', where: 'FAY OS → Wellness → Bookings', status: 'live', text: 'Assigns the specialist (gym coach, therapist…) to the session — or lets Faysha suggest the least busy one; the specialist is notified.' },
          { who: 'Specialist', where: 'My work (/work)', status: 'live', text: 'Signs in and lands on My work: their sessions for the day and the week with the guest, the time, the place and the guest’s notes (preferences, injuries).', check: 'Sign in as a team member who is not a manager: you land on /work.' },
          { who: 'Specialist', where: 'My work · FAY OS → Wellness → Today', status: 'live', text: 'Asks the guest for their code and enters it: that proves they are here and checks them in; journeys open with their PIN at each stage.', check: 'A wrong code is refused; a session assigned to someone else is refused; the right one moves the booking to Arrived.' },
          { who: 'Specialist', where: 'My work · FAY OS → Wellness → Today', status: 'live', text: 'Marks the session Completed or No-show; on Completed the guest is asked to rate it.' },
          { who: 'Guest', where: 'App → Rate your experience', status: 'live', text: 'Rates the session; the stars show on the booking, are credited to the specialist (My work and FAY OS → Quality), and low ratings alert a manager.' },
        ],
      },
      {
        title: 'Booking an event',
        intro: 'Weddings, retreats, celebrations — from request to the story in the journal.',
        steps: [
          { who: 'Guest', where: 'Website /events · App → Plan an event', status: 'live', text: 'Sends a 4-step request: occasion, spaces and food, services and their vision, contact. No budget is asked: we quote first. An acknowledgement email goes out.' },
          { who: 'Manager', where: 'FAY OS → Events', status: 'live', text: 'Picks up the request and names the event lead; the lead is notified and sees the event in My work.' },
          { who: 'Manager', where: 'FAY OS → Events → Proposal', status: 'live', text: 'Builds a proposal from presets with discount, tax and deposit, adds up to 8 mood images with captions (“how we see your event”) and sends it; opening is tracked.' },
          { who: 'Guest', where: 'Proposal link · App → My events', status: 'live', text: 'Sees the mood images and the proposal, then accepts with their name — or answers “too much? here is my budget”, or declines.' },
          { who: 'Manager', where: 'FAY OS → Events', status: 'live', text: 'A budget answer comes back as “Revise the proposal”: the event shows the client’s budget, the next version shows how far it is from it, and the new version supersedes the old one.', check: 'The client’s budget appears on the event and in the proposal builder.' },
          { who: 'System', where: 'On acceptance', status: 'live', text: 'Issues a numbered invoice (FW-INV-…) and emails it with the link to pay; the client sees it on the proposal page and in the app.' },
          { who: 'Guest', where: 'Proposal link · App → My events', status: 'setup', text: 'Pays the deposit, then the balance, by card or mobile money; the deposit confirms the date. Each payment gets a numbered receipt (FW-RCT-…) by email.', check: 'Uses the same payment keys as bookings.' },
          { who: 'Manager', where: 'FAY OS → Events → Record a payment', status: 'live', text: 'Money taken at the residence or by transfer goes into the same ledger (a reference is required except for cash) and gets the same receipt — no side deals, everything on record.' },
          { who: 'Manager', where: 'FAY OS → Events', status: 'live', text: 'Sees invoice, payments and receipts on the event, completes it and writes its story for the journal.' },
        ],
      },
    ],
  },

  // ===================================================================================================== Requests & staff
  {
    id: 'requests',
    title: 'Requests & the team',
    icon: 'support_agent',
    summary: 'From hiring the right person to a guest’s request being done, checked and rated.',
    chapters: [
      {
        title: 'Building the team',
        intro: 'Every person who does the work has a job, a department and a sign-in.',
        steps: [
          { who: 'HR', where: 'HQ → HR → Recruitment · Website /careers', status: 'live', text: 'Publishes a job; candidates apply on the website; HR reviews applications.' },
          { who: 'HR', where: 'HQ → HR → Applications', status: 'coming', text: 'Marks a candidate Hired: an employee record and a sign-in are created in their department, and the welcome email goes out.' },
          { who: 'HQ', where: 'HQ → Staff & departments · Roles', status: 'live', text: 'Gives each person a role and a department; roles decide what they can see.' },
          { who: 'HR', where: 'HQ → HR → Attendance, Leave', status: 'live', text: 'Attendance and leave; leave requests join the approvals queue.' },
        ],
      },
      {
        title: 'A guest asks for something',
        intro: 'Housekeeping, repairs, concierge, wellness, dining, transport.',
        steps: [
          { who: 'Guest', where: 'App → Residence → Requests', status: 'live', text: 'Chooses the department, says what they need, marks it urgent if it can’t wait.' },
          { who: 'System', where: 'Server', status: 'live', text: 'The request lands in FAY OS live, with a notification to managers.' },
          { who: 'Manager', where: 'FAY OS → Operations → Service requests', status: 'live', text: 'Assigns it to a person in that department — or lets Faysha suggest the least busy one. With Settings → FAY AI → Auto-assign on, new requests are assigned as they arrive.' },
          { who: 'Housekeeper', where: 'My work (/work)', status: 'live', text: 'The assigned person is notified and sees it in their own list; Start tells the guest someone is on it; Done needs a note of what was done.' },
          { who: 'Guest', where: 'App → Requests', status: 'live', text: 'Follows the status live: received, in progress, done.' },
          { who: 'System', where: 'Server (every minute)', status: 'live', text: 'A request not picked up in time (10 to 60 minutes by urgency) raises an urgent alert.' },
          { who: 'Manager', where: 'FAY OS → Service requests', status: 'live', text: 'Sees the real timeline (received, assigned, started, done, checked, rated) and marks the work as checked.' },
          { who: 'Guest', where: 'App → Rate your experience', status: 'live', text: 'Rates the request; the rating is credited to the person who did it (their My work and FAY OS → Quality); low ratings reach a manager at once.' },
        ],
      },
      {
        title: 'Quality',
        intro: 'How the team is measured.',
        steps: [
          { who: 'Manager', where: 'FAY OS → Analytics → Quality', status: 'live', text: 'Ratings by person and department, low ratings to follow up, inspection scores per housekeeper.' },
          { who: 'Housekeeper', where: 'FAY OS → Residences → Housekeeping', status: 'live', text: 'Room board Dirty → Cleaning → Inspect → Ready; Ready only through the inspection checklist with a score.' },
        ],
      },
    ],
  },

  // ===================================================================================================== Maintenance & assets
  {
    id: 'maintenance',
    title: 'Maintenance & assets',
    icon: 'home_repair_service',
    summary: 'What Faysha owns, how it is cared for, what it costs, when to replace it and how purchases are approved.',
    chapters: [
      {
        title: 'Knowing what we own',
        steps: [
          { who: 'Manager', where: 'FAY OS → Residences → Assets & lifecycle', status: 'live', text: 'Registers equipment with cost, life, warranty and spares; Faysha computes life left, replace-by and order-by dates.' },
          { who: 'System', where: 'Server (monthly)', status: 'live', text: 'Puts aside each asset’s monthly replacement reserve and shows a 12-month budget forecast.' },
        ],
      },
      {
        title: 'Keeping it healthy',
        steps: [
          { who: 'Manager', where: 'FAY OS → Assets → Care schedule', status: 'live', text: 'Plans care (service, repaint, deep clean…); done care is logged and the next date rolls forward.' },
          { who: 'System', where: 'Server (every minute)', status: 'live', text: 'Alerts for care due, replacements to order, low spares, warranty ending and equipment down.' },
          { who: 'Guest', where: 'App → Requests → Maintenance', status: 'coming', text: 'A repair request opens a work order for the technicians automatically.' },
          { who: 'Manager', where: 'FAY OS → Residences → Maintenance', status: 'partial', text: 'Work orders with priority, assigned to a person (notified), with what was done and the cost.', check: 'Coming: choose the asset on the work order and open one straight from a repair request.' },
          { who: 'Technician', where: 'My work (/work)', status: 'live', text: 'Sees their work orders, starts them, records what was done and the cost; a work order on an asset adds a repair to its history.' },
          { who: 'Manager', where: 'FAY OS → Maintenance → Systems', status: 'partial', text: 'Health of building systems, entered by the team (no sensors connected yet).' },
        ],
      },
      {
        title: 'Buying and restocking',
        steps: [
          { who: 'Manager', where: 'FAY OS → Assets', status: 'coming', text: 'Orders a replacement or restocks spares: a purchase request goes to HQ with the cost.' },
          { who: 'HQ', where: 'HQ → Approvals', status: 'partial', text: 'One queue for purchases, expenses, discounts, refunds and leave.', check: 'Coming: an approved purchase updates the asset, its spares and the money spent from the reserve.' },
          { who: 'HQ', where: 'HQ → Finance', status: 'coming', text: 'Maintenance spend and the replacement reserve next to revenue.' },
        ],
      },
    ],
  },

  // ===================================================================================================== Payments
  {
    id: 'payments',
    title: 'Payments',
    icon: 'payments',
    summary: 'How money comes in — card and mobile money — where the keys live, how it is confirmed, refunded and reported.',
    chapters: [
      {
        title: 'Setting up',
        steps: [
          { who: 'HQ', where: 'HQ → Settings → Payments', status: 'live', text: 'The super administrator pastes the PayWithCAMSOL keys (mobile money) and the Stripe keys (cards). They are stored encrypted; only the last 4 characters are ever shown; they apply at once.', check: 'Finance can see the status; only a super administrator can change the keys.' },
          { who: 'HQ', where: 'HQ → Settings → Payments', status: 'live', text: '“Test connection” checks the keys without charging anything; test or live keys are recognised automatically, and the webhook addresses are shown to copy.' },
          { who: 'Manager', where: 'FAY OS → Settings → Currencies', status: 'live', text: 'Chooses the currencies offered and their rates; prices are shown converted and marked ≈.' },
        ],
      },
      {
        title: 'Getting paid',
        steps: [
          { who: 'Guest', where: 'Website /book · App', status: 'setup', text: 'Pays by card; the payment is checked with Stripe before the stay is confirmed.' },
          { who: 'Guest', where: 'Website /book · App', status: 'setup', text: 'Pays by MTN or Orange money: approves on their phone and the stay is confirmed automatically (PayWithCAMSOL webhook, or a check every 30 seconds). The page updates by itself.', check: 'Without PayWithCAMSOL keys in production, staff confirm when the money arrives (HQ → Finance → Mark received).' },
          { who: 'Guest', where: 'App → My bill', status: 'live', text: 'Dining, wellness and experiences are charged to the stay; the bill shows the balance.' },
          { who: 'Front desk', where: 'FAY OS → Guest 360 / Reservations', status: 'live', text: 'Takes the balance by card, cash, bank transfer or card terminal.' },
          { who: 'Guest', where: 'Event proposal link', status: 'setup', text: 'Pays an event deposit and balance online by card or mobile money against a numbered invoice; every payment gets a receipt.' },
        ],
      },
      {
        title: 'Refunds and reporting',
        steps: [
          { who: 'Manager', where: 'HQ → Approvals', status: 'live', text: 'Asks for a refund; once approved it is carried out (through Stripe for cards).' },
          { who: 'HQ', where: 'HQ → Finance', status: 'live', text: 'Revenue, occupancy, ADR, RevPAR and collections by method; CSV export.' },
        ],
      },
    ],
  },

  // ===================================================================================================== Stay & access
  {
    id: 'stay',
    title: 'The stay & access',
    icon: 'key',
    summary: 'Arriving, getting in, living in the residence and its services, receiving visitors.',
    chapters: [
      {
        title: 'Arriving and getting in',
        steps: [
          { who: 'System', where: 'Server', status: 'live', text: 'Arrival-day message to the guest with their times.' },
          { who: 'Guest', where: 'App → Digital key', status: 'setup', text: 'Gate QR code, door PIN, deposit box and its PIN, Wi-Fi.', check: 'Door PINs must be programmed in the locks until smart locks are connected.' },
          { who: 'Guest', where: 'App → Residence → Smart home', status: 'partial', text: 'Climate, scenes, lights and do-not-disturb, mirrored to FAY OS (no devices connected yet).' },
        ],
      },
      {
        title: 'Living in the residence',
        steps: [
          { who: 'Guest', where: 'App → Residence → Dining', status: 'live', text: 'Orders to the residence (charged to the stay) or books a table with dishes pre-ordered.' },
          { who: 'Guest', where: 'App → Lockers & equipment', status: 'live', text: 'Borrows golf, sport, beach or children’s kit or an extra locker; code shown once assigned; overdue reminders.' },
          { who: 'Guest', where: 'App → Experiences · Rides', status: 'live', text: 'Books experiences and airport or city rides; the driver and vehicle appear when assigned.' },
          { who: 'Guest', where: 'App → Concierge', status: 'live', text: 'Chats with the team (photos and documents included).' },
        ],
      },
      {
        title: 'Visitors & occupancy',
        intro: 'Strict enough to protect the residences, light enough to live with: day visits under clear house rules; anyone who sleeps here is a registered guest.',
        steps: [
          { who: 'HQ', where: 'HQ → Residences → residence', status: 'live', text: 'Sets the maximum occupancy of each residence (everyone who sleeps there, children included); empty uses the category’s figure.', check: 'A booking above it is refused on the website, in the app and at the front desk.' },
          { who: 'Manager', where: 'FAY OS → Visitors → Policy', status: 'live', text: 'Sets the house rules: visiting hours (08:00–22:00), people per pass (4), visitors per residence per day (6), passes per day (3) and per week (12), when a frequent visitor is flagged (4 days in a week), overstay alert (30 min), fee per added guest per night, discreet visits on/off, auto-approval.' },
          { who: 'Guest', where: 'App → Residence → Visitors', status: 'live', text: 'Sees the house rules and invites a visitor for a day of the stay, until the end of visiting hours at the latest; the app explains any limit reached. Can ask for a discreet visit.' },
          { who: 'Front desk', where: 'FAY OS → Visitors', status: 'live', text: 'Approves passes. A discreet pass shows “Private visitor”; the name appears only when the gate checks the pass. A visitor seen most days is flagged as possibly living there and always waits for approval.' },
          { who: 'Visitor', where: 'Pass link /visit/…', status: 'setup', text: 'Shows the QR or 6-digit code and their ID at the gate; the host is told when they arrive.', check: 'The gate opens by itself only with a gate controller connected.' },
          { who: 'System', where: 'Monitor (every minute)', status: 'live', text: 'A visitor still inside after their pass ended raises an alert to the team: check with the host and, if they are staying, add them to the stay.' },
          { who: 'Guest', where: 'App → Visitors → Staying the night', status: 'live', text: 'Adds someone who will sleep there (a visitor staying over, family arriving later) for some or all nights, within the residence’s capacity.', check: 'A request that would exceed capacity on any night is refused with the reason.' },
          { who: 'Front desk', where: 'FAY OS → Visitors → Added to a stay', status: 'live', text: 'Approves or declines with a reason; approval rechecks capacity and adds the per-night fee to the bill. Cancelling, shortening or ending a stay voids its future passes and added guests.' },
        ],
      },
      {
        title: 'Leaving',
        steps: [
          { who: 'System', where: 'Server', status: 'live', text: 'Departure-morning message; late check-out alert to the front desk.' },
          { who: 'Front desk', where: 'FAY OS → Front desk', status: 'live', text: 'Checks the guest out; the residence goes to housekeeping.' },
          { who: 'Guest', where: 'App → Stay', status: 'live', text: 'Rates the stay and shares feedback.' },
        ],
      },
    ],
  },

  // ===================================================================================================== Guests & communication
  {
    id: 'guests',
    title: 'Guests & communication',
    icon: 'forum',
    summary: 'Who the guest is, every conversation with them and every message Faysha sends.',
    chapters: [
      {
        title: 'Knowing the guest',
        steps: [
          { who: 'Guest', where: 'App → Create account', status: 'live', text: 'Signs up and receives a 6-digit code by email. The account opens, and they are signed in, only once the code is entered. An unverified account cannot sign in: it is sent a new code instead.', check: 'A code works for 15 minutes; 5 wrong tries ask for a new one; a new code at most once a minute.' },
          { who: 'Guest', where: 'App → first sign-in', status: 'live', text: 'A guest whose account was created by a booking signs in with the temporary password from the email, chooses their own password and lands on Home.' },
          { who: 'Manager', where: 'FAY OS → Guests → Guest 360', status: 'live', text: 'Profile, stays, preferences, timeline of everything they did, notes.' },
          { who: 'Guest', where: 'App → Profile', status: 'live', text: 'Personal details, rewards, currency, terms, account deletion.' },
        ],
      },
      {
        title: 'Talking with guests',
        steps: [
          { who: 'Guest', where: 'Website /contact', status: 'live', text: 'Sends a message; it becomes an enquiry with an owner and email replies in the thread.' },
          { who: 'Manager', where: 'FAY OS → Communications', status: 'live', text: 'One conversation per guest: in-app, email, internal notes.' },
          { who: 'Guest', where: 'App → Notifications', status: 'setup', text: 'Inbox, live banners and push notifications.', check: 'Push needs the app built with Expo push credentials.' },
          { who: 'Manager', where: 'FAY OS → bell', status: 'live', text: 'Needs-action notifications from guests and the monitor; resolved automatically.' },
        ],
      },
    ],
  },

  // ===================================================================================================== Command
  {
    id: 'command',
    title: 'Running Faysha',
    icon: 'insights',
    summary: 'How head office sees and controls everything.',
    chapters: [
      {
        title: 'Seeing',
        steps: [
          { who: 'HQ', where: 'HQ → Overview', status: 'live', text: 'Earnings, occupancy, arrivals and departures, decisions waiting, alerts, teams on duty.' },
          { who: 'Manager', where: 'FAY OS → Analytics', status: 'partial', text: 'Occupancy and revenue analytics.', check: 'Some service-request figures are still sample values.' },
          { who: 'Manager', where: 'FAY OS → AI Command', status: 'setup', text: 'Ask questions about the operation (needs the Claude key).' },
        ],
      },
      {
        title: 'Controlling',
        steps: [
          { who: 'HQ', where: 'HQ → Roles & permissions', status: 'live', text: 'What each role can see and do, by area.' },
          { who: 'HQ', where: 'HQ → Staff → View as', status: 'live', text: 'See the platform exactly as another person, read-only.' },
          { who: 'HQ', where: 'HQ → Audit log', status: 'live', text: 'Every change by every person, and every sign-in.' },
          { who: 'HQ', where: 'HQ → Website content · FAY OS → Content', status: 'live', text: 'Website text in English and French, terms and privacy versions, estate places, journal stories.' },
        ],
      },
    ],
  },
];

/** All steps of a journey, flattened. */
export const stepsOf = (j) => j.chapters.flatMap((c) => c.steps);

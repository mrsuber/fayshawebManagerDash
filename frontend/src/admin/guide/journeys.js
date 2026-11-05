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
          { who: 'Guest', where: 'Website /book · App → Book a stay', status: 'live', text: 'Enters their details and accepts the published terms of stay. A guest account is created automatically with the booking.', check: 'The terms shown are the version published in FAY OS → Content.' },
          { who: 'Guest', where: 'Payment step', status: 'setup', text: 'Pays by card (Stripe) or MTN / Orange mobile money. The residence is held 60 minutes for a card, 48 hours for mobile money.', check: 'Card payment needs the Stripe keys in HQ → Settings → Payments.' },
          { who: 'System', where: 'Server', status: 'live', text: 'Once paid, the stay is confirmed: one gate QR and door PIN, the deposit box handed over with a new PIN, one confirmation email with first sign-in details, a notification in the app.', check: 'One email only, even if the payment is confirmed twice.' },
          { who: 'System', where: 'Server (every minute)', status: 'live', text: 'An unpaid booking is released when its hold runs out so the residence can be sold again.', check: 'A card booking left unpaid for an hour disappears from the calendar.' },
        ],
      },
      {
        title: 'Changing or cancelling a stay',
        intro: 'What happens when plans change — on the guest side and on the team side.',
        steps: [
          { who: 'Front desk', where: 'FAY OS → Reservations', status: 'live', text: 'Creates a booking for a guest on the phone or at the desk; it is confirmed with the key and the email at once.' },
          { who: 'Guest', where: 'App → My stays → Stay', status: 'coming', text: 'Asks to change dates or cancels; the refund follows the terms (full minus fees > 14 days, 50 % from 7 to 14 days, none within 7 days).', check: 'The refund amount shown matches the policy for the days left.' },
          { who: 'Manager', where: 'FAY OS → Reservations', status: 'coming', text: 'Cancels with a reason; the guest is told by email and in the app, and the refund is started from the same screen.' },
          { who: 'Manager', where: 'FAY OS → Reservations', status: 'coming', text: 'Marks a guest who never arrived as No-show; the residence is released and the stay closed.' },
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
          { who: 'Manager', where: 'FAY OS → Wellness → Bookings', status: 'coming', text: 'Assigns the specialist (gym coach, therapist…) to the session; the specialist is notified.' },
          { who: 'Specialist', where: 'FAY OS → My work', status: 'coming', text: 'Sees their sessions for the day with the guest, the time, the place and the guest’s notes (preferences, injuries).' },
          { who: 'Specialist', where: 'FAY OS → Wellness → Today', status: 'live', text: 'Checks the guest in with their code; journeys open with their PIN at each stage.', check: 'A wrong code is refused; the right one moves the booking to Arrived.' },
          { who: 'Specialist', where: 'FAY OS → Wellness → Today', status: 'live', text: 'Marks the session Completed or No-show.' },
          { who: 'Guest', where: 'App → Rate your experience', status: 'partial', text: 'Rates the session; the stars show on the booking and low ratings alert a manager.', check: 'Coming: the rating is credited to the specialist who ran the session.' },
        ],
      },
      {
        title: 'Booking an event',
        intro: 'Weddings, retreats, celebrations — from request to the story in the journal.',
        steps: [
          { who: 'Guest', where: 'Website /events · App → Plan an event', status: 'live', text: 'Sends a 4-step request: occasion, spaces and food, services and budget, contact. An acknowledgement email goes out.' },
          { who: 'Manager', where: 'FAY OS → Events', status: 'live', text: 'Picks up the request and names the event lead.', check: 'Coming: the lead is notified when assigned.' },
          { who: 'Manager', where: 'FAY OS → Events → Proposal', status: 'live', text: 'Builds a proposal from presets with discount, tax and deposit, and sends it; opening is tracked.' },
          { who: 'Guest', where: 'Proposal link · App → My events', status: 'live', text: 'Reads the proposal online and accepts with their name, or declines.' },
          { who: 'Guest', where: 'Proposal link', status: 'coming', text: 'Pays the deposit online by card or mobile money; the event is confirmed automatically.' },
          { who: 'Manager', where: 'FAY OS → Events', status: 'live', text: 'Records deposits paid by hand, completes the event and writes its story for the journal.' },
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
          { who: 'Manager', where: 'FAY OS → Operations → Service requests', status: 'coming', text: 'Assigns it to a person in that department — or lets Faysha suggest who is on duty with the fewest open tasks.' },
          { who: 'Housekeeper', where: 'FAY OS → My work', status: 'coming', text: 'The assigned person is notified and sees it in their own list; they start it and finish it with a note.' },
          { who: 'Guest', where: 'App → Requests', status: 'live', text: 'Follows the status live: received, in progress, done.' },
          { who: 'System', where: 'Server (every minute)', status: 'live', text: 'A request not picked up in time (10 to 60 minutes by urgency) raises an urgent alert.' },
          { who: 'Manager', where: 'FAY OS → Service requests', status: 'coming', text: 'Checks the work when needed (verified) before it is closed.' },
          { who: 'Guest', where: 'App → Rate your experience', status: 'partial', text: 'Rates the request; low ratings reach a manager at once.', check: 'Coming: the rating is credited to the person who did it and shows in Quality.' },
        ],
      },
      {
        title: 'Quality',
        intro: 'How the team is measured.',
        steps: [
          { who: 'Manager', where: 'FAY OS → Analytics → Quality', status: 'partial', text: 'Ratings by person and department, low ratings to follow up, inspection scores per housekeeper.' },
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
          { who: 'Manager', where: 'FAY OS → Residences → Maintenance', status: 'partial', text: 'Work orders with priority and technician.', check: 'Coming: linked to the asset, assigned to a person, with cost and notes; completing it updates the asset history.' },
          { who: 'Technician', where: 'FAY OS → My work', status: 'coming', text: 'Sees their work orders, records what was done and the cost.' },
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
          { who: 'HQ', where: 'HQ → Settings → Payments', status: 'coming', text: 'The super administrator pastes the PayWithCAMSOL keys (mobile money) and the Stripe keys (cards). They are stored encrypted; only the last 4 characters are ever shown.' },
          { who: 'HQ', where: 'HQ → Settings → Payments', status: 'coming', text: '“Test connection” checks the keys without charging anything; test or live keys are recognised automatically.' },
          { who: 'Manager', where: 'FAY OS → Settings → Currencies', status: 'live', text: 'Chooses the currencies offered and their rates; prices are shown converted and marked ≈.' },
        ],
      },
      {
        title: 'Getting paid',
        steps: [
          { who: 'Guest', where: 'Website /book · App', status: 'setup', text: 'Pays by card; the payment is checked with Stripe before the stay is confirmed.' },
          { who: 'Guest', where: 'Website /book · App', status: 'partial', text: 'Pays by MTN or Orange money: today staff confirm when the money arrives (HQ → Finance → Mark received).', check: 'Coming: the guest approves on their phone and PayWithCAMSOL confirms it automatically.' },
          { who: 'Guest', where: 'App → My bill', status: 'live', text: 'Dining, wellness and experiences are charged to the stay; the bill shows the balance.' },
          { who: 'Front desk', where: 'FAY OS → Guest 360 / Reservations', status: 'live', text: 'Takes the balance by card, cash, bank transfer or card terminal.' },
          { who: 'Guest', where: 'Event proposal link', status: 'coming', text: 'Pays an event deposit online.' },
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
        title: 'Visitors',
        steps: [
          { who: 'Guest', where: 'App → Residence → Visitors', status: 'live', text: 'Invites a visitor for a day of the stay and shares the pass link.' },
          { who: 'Front desk', where: 'FAY OS → Operations → Visitors & gate', status: 'live', text: 'Approves the pass; the visitor gets a QR and a 6-digit gate code.' },
          { who: 'Visitor', where: 'Pass link /visit/…', status: 'setup', text: 'Shows the code at the gate; the guest is told when they arrive.', check: 'The gate opens by itself only with a gate controller connected.' },
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

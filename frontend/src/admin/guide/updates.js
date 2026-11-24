/**
 * Updates (HQ → Platform guide → Updates): what changed, when, and how to test it once it is deployed.
 * Newest first. Add an entry in the same change that ships the feature; keep `id` stable (test ticks are keyed by it).
 *
 * update: { id, date, title, surfaces, summary, changes[], setup?[], tests: [{ who, where, do, expect }] }
 */
export const UPDATES = [
  {
    id: '2026-11-task-timers',
    date: '2026-11-24',
    title: 'Task timers: every job has a clock, late keeps counting',
    surfaces: ['fayos', 'app', 'server'],
    summary:
      'The team is measured on how long a task takes once it lands in their to-do. Each request and work order carries the time allowed (the department standard, or what the manager gives). The person sees it count down in My work; past the time it keeps counting in red. Managers see the clocks on Service Requests and Maintenance, get an alert when something goes late, and compare people in Quality → Team timing, next to the guests’ ratings.',
    changes: [
      'FAY OS → Settings → Team & Roles → Task times: standard minutes per department, for the departure clean and for work orders (new tasks only)',
      'FAY OS → Service Requests: “Clock” column, “Time allowed” (changeable), “Came from” (Guest · Manager · Automatic) and the live clock in the details; KPIs “Late now” (click to show only those) and “Done on time”',
      'FAY OS → Service Requests → New Request: the guest is optional (a task for the property), “Time allowed”, and “Give it to” (a person or the least busy) — the clock starts at once',
      'Check-out (Guest 360 or Reservations → Today) raises “Departure clean · <unit>” (Automatic, the departure-clean time, urgent when someone arrives the same day), given to the least busy housekeeper when auto-assign is on. Start → residence Cleaning; Done → Inspect',
      'My work (/work): each request and work order shows “mm:ss left” or “Late +mm:ss”, late ones first; “Late now” and “My timing” (on time %, average over 30 days); Done today shows “Took 25 min · 10 min late”',
      'Server: alerts “Running late · …” to managers and “You are behind · …” to the person, once per person given the task, cleared when done',
      'FAY OS → Quality → Team timing: per person — tasks done, % on time, average time, average lateness, late now, guest rating',
      'FAY OS → Maintenance: work orders get a time allowed (standard 2 h) and a clock from when they are assigned',
      'App → Requests: finished requests show who looked after them and “★ Rate <name>” until rated (requests without a guest are not rated)',
    ],
    setup: ['Run the database migration on the server (node db/setup.js) — adds 021_task_timers.sql', 'Deploy the backend and the website', 'Ship a new app build (Requests screen)', 'Tasks created before the update have no clock and are not measured'],
    tests: [
      { who: 'Manager', where: 'FAY OS → Settings → Team & Roles', do: 'Set Housekeeping to 20 minutes.', expect: '“Housekeeping: 20 minutes”; a value under 5 is refused.' },
      { who: 'Guest', where: 'App → Requests', do: 'Ask Housekeeping for towels.', expect: 'FAY OS → Service Requests shows it with “Came from: Guest” and “⏱ 20 min once assigned”.' },
      { who: 'Manager', where: 'FAY OS → Service Requests', do: 'Assign it to a housekeeper.', expect: 'The clock starts (“19:59 left”); the housekeeper is notified.' },
      { who: 'Housekeeper', where: 'My work (/work)', do: 'Open My work.', expect: 'The request shows the time left, ticking each second, “Guest request · 20 min allowed”.' },
      { who: 'Housekeeper', where: 'My work', do: 'Wait past the time (or ask for a 5-minute task).', expect: 'The clock turns red “Late +00:12” and keeps counting; “Late now” = 1; a push “You are behind · …”. Managers get “Running late · …”.' },
      { who: 'Housekeeper', where: 'My work', do: 'Mark it done.', expect: 'Done today: “Took N min · M min late”. The alerts clear. The guest is asked to rate it.' },
      { who: 'Guest', where: 'App → Requests', do: 'Open the finished request.', expect: '“Looked after by …” and “★ Rate …”, which opens Rate your experience. After rating, the link is gone.' },
      { who: 'Manager', where: 'FAY OS → Service Requests → New Request', do: 'No guest, “Clean the gym”, 45 minutes, give it to a person.', expect: '“Came from: Manager”, clock running; it is in their My work.' },
      { who: 'Front desk', where: 'FAY OS → Guest 360', do: 'Check a guest out.', expect: '“Departure clean · <unit>”, Automatic, 90 min, assigned (auto-assign on) or an alert “Departure clean to assign”. Housekeeping shows Dirty.' },
      { who: 'Housekeeper', where: 'My work', do: 'Start, then finish the departure clean.', expect: 'FAY OS → Housekeeping: Cleaning, then Inspect (“Cleaned by …”).' },
      { who: 'Manager', where: 'FAY OS → Quality → Team timing', do: 'Open the tab.', expect: 'Each person with done, % on time, average time, average lateness, late now and guest rating.' },
      { who: 'Manager', where: 'FAY OS → Maintenance', do: 'Create a work order with 30 minutes and assign it.', expect: 'Its clock runs in the list and in My work; late alerts as for requests.' },
    ],
  },
  {
    id: '2026-11-stay-people',
    date: '2026-11-13',
    title: 'Reservations and Guest 360 show everyone on the stay',
    surfaces: ['fayos'],
    summary:
      'Overnight guests and visitors are no longer only in Visitors: the reservation, the booking list, the Reservations KPIs and Guest 360 show who sleeps in the residence and who visits — discreet people stay “Private guest” / “Private visitor” everywhere. Full flow: Journeys → Visitors & overnight guests.',
    changes: [
      'FAY OS → Reservations → booking: “People on this stay” — the booker’s party, each overnight guest (nights, status, “stayed on from a visit”) and recent and coming visitors, with “Tonight N of capacity”',
      'FAY OS → Reservations → Booking list: “+N overnight” and “N to approve” next to the guest name',
      'FAY OS → Reservations: new KPI “Guests tonight” (booked guests + registered overnight guests)',
      'FAY OS → Guest 360: “People on this stay” card (Overview and Stay Details); the Current Stay card shows “+ N overnight guests tonight”',
      'FAY OS → Guest 360 → Journey / Stay Timeline: visitor passes, arrivals and departures, overnight guests requested, registered or declined (category Visitors)',
      'Discreet people are never named on these screens or in the timeline; “Check ID” on the reservation or Guest 360 reveals the name and is recorded in the gate log',
    ],
    setup: ['Deploy the backend and the website (no new migration)'],
    tests: [
      { who: 'Guest', where: 'App → Visitors', do: 'Add a discreet overnight guest to your stay and invite a visitor; approve both in FAY OS → Visitors.', expect: 'Both approved.' },
      { who: 'Front desk', where: 'FAY OS → Reservations → Booking List', do: 'Find the stay.', expect: 'The guest name shows “+1 overnight” (and “1 to approve” while a request waits).' },
      { who: 'Front desk', where: 'FAY OS → Reservations → booking', do: 'Open the reservation.', expect: '“People on this stay”: the booker, “Private guest” with its nights and Registered, the visitor, and “Tonight N of capacity”.' },
      { who: 'Front desk', where: 'FAY OS → Reservations → booking', do: 'Click “Check ID” on the private guest.', expect: 'The real name appears; FAY OS → Visitors → Gate log shows “Checked overnight guest · Residence …”.' },
      { who: 'Manager', where: 'FAY OS → Reservations → Overview', do: 'Look at the KPIs.', expect: '“Guests tonight” counts booked guests plus overnight guests (“incl. 1 overnight guest”).' },
      { who: 'Front desk', where: 'FAY OS → Guest 360 → the host', do: 'Open Overview.', expect: 'Current Stay says “+ 1 overnight guest tonight”; the “People on this stay” card lists everyone.' },
      { who: 'Front desk', where: 'FAY OS → Guest 360 → Journey', do: 'Read the timeline.', expect: 'Entries in Visitors: “Visitor pass – …”, “Visitor arrived – …”, “Overnight guest registered – Private guest …”. The discreet name never appears.' },
    ],
  },
  {
    id: '2026-11-visitors-overnight',
    date: '2026-11-12',
    title: 'Visitors: email the pass, discreet overnight guests, “Staying the night”',
    surfaces: ['app', 'fayos', 'server'],
    summary:
      'Full flow: Journeys → Visitors & overnight guests. Overnight guests are welcome once registered, as in hotels. Visitors can receive their pass by email and come on their own; a visitor who stays is registered in one tap, discreetly if wanted, and keeps using their pass at the gate.',
    changes: [
      'App → Visitors: optional visitor email; the QR, gate code and directions are emailed when the pass is active, or with “Email the pass”',
      'App → Visitors: “Staying the night” on a pass registers the visitor on the stay; their pass stays valid at the gate for those nights',
      'App → Visitors: “Add a guest to my stay” has a Discreet switch; staff lists show “Private guest”',
      'Server: the resident gets a push 30 minutes before a visitor’s pass ends (“Is … staying tonight?”); no overstay alert for a visitor registered for the night',
      'FAY OS → Visitors: “Check ID” reveals a discreet overnight guest’s name (recorded in the gate log); passes show “Staying the night until …”',
      'FAY OS → Visitors → Policy: “Overnight guests within capacity are registered at once” (off by default)',
    ],
    setup: [
      'Run the database migration on the server (node db/setup.js) — adds 020_visitor_privacy.sql',
      'Emailing passes needs SMTP_USER / SMTP_PASS in the server .env; without them the app tells the resident to send the pass from their phone',
      'Ship a new app build (the Visitors screen changed)',
    ],
    tests: [
      { who: 'Guest', where: 'App → Residence → Visitors', do: 'Invite a visitor for today with your own email address.', expect: 'Pending: the card says “Emailed to … once approved”.' },
      { who: 'Front desk', where: 'FAY OS → Visitors', do: 'Approve the pass.', expect: 'The email arrives: QR code, 6-digit code, hours, directions, “Open my pass”. The app card says “Pass emailed to …”.' },
      { who: 'Guest', where: 'App → Visitors → pass', do: 'Tap “Email again” with another address.', expect: 'Sent to the new address.' },
      { who: 'Front desk', where: 'FAY OS → Visitors → Check pass', do: 'Type the code from the email.', expect: 'Valid · visitor name. “Open the gate · check in” marks them arrived; the guest is told.' },
      { who: 'Guest', where: 'App → Visitors → pass', do: 'Tap “Staying the night”, turn Discreet on, confirm.', expect: 'Policy off: “Request sent”, the card shows “awaiting confirmation”. Policy on: “Registered for the night”.' },
      { who: 'Front desk', where: 'FAY OS → Visitors → Added to a stay', do: 'Find the request.', expect: 'Shows “Private guest”, no phone or relation, “from a visitor pass”. Alerts do not name the guest.' },
      { who: 'Front desk', where: 'FAY OS → Visitors → Added to a stay', do: 'Click “Check ID”, then Approve.', expect: 'The real name appears; the gate log records the check. The guest is told the pass stays valid.' },
      { who: 'Front desk', where: 'FAY OS → Visitors', do: 'Mark the visitor Left, then check the pass again and click “Let in”.', expect: 'Still valid as a registered overnight guest; the gate opens again (also the next morning).' },
      { who: 'System', where: 'Monitor', do: 'Leave a registered overnight visitor “On site” past their pass end time.', expect: 'No “Visitor still in” alert. An unregistered visitor still raises it after the grace period.' },
      { who: 'Guest', where: 'Phone notifications', do: 'Have an active pass ending within 30 minutes.', expect: 'Push “Is … staying tonight?” once (a discreet visit says “your visitor”).' },
      { who: 'Manager', where: 'FAY OS → Visitors → Policy', do: 'Turn on “registered at once” and add a guest from the app.', expect: 'Registered immediately; the team gets an information alert; the fee (if any) is on the bill. Above capacity it is still refused.' },
    ],
  },
  {
    id: '2026-11-app-residence-gallery',
    date: '2026-11-12',
    title: 'App: full photo gallery and 360° view in residence details',
    surfaces: ['app'],
    summary: 'The residence sheet in the app booking flow now shows the same photos and 360° tour as the website (it also reads the photos uploaded on the residence itself, not only on its category).',
    changes: ['App → Book a stay → residence: every photo to swipe, “Step inside · 360°” when a panorama exists'],
    setup: ['Ship a new app build'],
    tests: [
      { who: 'Guest', where: 'App → Book a stay', do: 'Choose dates, open a residence that has several photos and a 360° on the website.', expect: 'The counter shows every photo (e.g. 1 / 6) and “Step inside · 360°” opens the panorama.' },
    ],
  },
];

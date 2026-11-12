/**
 * Updates (HQ → Platform guide → Updates): what changed, when, and how to test it once it is deployed.
 * Newest first. Add an entry in the same change that ships the feature; keep `id` stable (test ticks are keyed by it).
 *
 * update: { id, date, title, surfaces, summary, changes[], setup?[], tests: [{ who, where, do, expect }] }
 */
export const UPDATES = [
  {
    id: '2026-11-visitors-overnight',
    date: '2026-11-12',
    title: 'Visitors: email the pass, discreet overnight guests, “Staying the night”',
    surfaces: ['app', 'fayos', 'server'],
    summary:
      'Overnight guests are welcome once registered, as in hotels. Visitors can receive their pass by email and come on their own; a visitor who stays is registered in one tap, discreetly if wanted, and keeps using their pass at the gate.',
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

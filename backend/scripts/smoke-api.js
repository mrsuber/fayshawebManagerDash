/**
 * API smoke test: signs in as each role and calls every read endpoint the website, Faysha HQ, FAY OS and
 * the guest app use. Any 5xx, or a 4xx where none is expected, is a failure.
 *
 *   node scripts/smoke-api.js [base URL]        default http://localhost:5001/api
 *
 * Needs the demo data (node db/setup.js --reset --demo) and SMOKE_ADMIN_PASSWORD for admin@fayshaa.com.
 */
const BASE = process.argv[2] || 'http://localhost:5001/api';
const DEMO_PASSWORD = 'Faysha2026!';

const ACCOUNTS = {
  superadmin: ['admin@fayshaa.com', process.env.SMOKE_ADMIN_PASSWORD],
  manager: ['manager@fayshaa.com', DEMO_PASSWORD],
  hr: ['hr@fayshaa.com', DEMO_PASSWORD],
  guest: ['claire.fontaine@example.com', DEMO_PASSWORD],
};

const today = new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// [who, path, expected status (default 200)]
const CHECKS = [
  // Public website
  [null, '/apartments'],
  [null, '/apartments/categories'],
  [null, '/apartments/categories?active_only=true'],
  [null, `/bookings/availability?start_date=${inDays(30)}&end_date=${inDays(33)}`],
  [null, '/feedback/testimonials'],
  [null, '/jobs'],
  [null, '/pages/home/en'],
  [null, '/admin/overview', 401],

  // Faysha HQ
  ['superadmin', '/auth/me'],
  ['superadmin', '/admin/me'],
  ['superadmin', '/admin/overview'],
  ['superadmin', '/admin/overview?property=1'],
  ['superadmin', '/admin/revenue'],
  ['superadmin', `/admin/revenue?from=${inDays(-30)}&to=${today}&property=1`],
  ['superadmin', '/admin/payments'],
  ['superadmin', '/admin/payments?status=pending'],
  ['superadmin', '/admin/approvals'],
  ['superadmin', '/admin/approvals?status=pending'],
  ['superadmin', '/admin/staff'],
  ['superadmin', '/admin/departments'],
  ['superadmin', '/admin/roles'],
  ['superadmin', '/admin/audit'],
  ['superadmin', '/admin/audit/sign-ins'],
  ['superadmin', '/admin/properties'],
  // HQ → HR
  ['superadmin', '/employees'],
  ['superadmin', '/employees?status=active'],
  ['superadmin', '/employees/1'],
  ['superadmin', '/employees/1/dashboard'],
  ['superadmin', '/jobs/meta/departments'],
  ['superadmin', '/jobs/meta/categories'],
  ['superadmin', '/jobs/applications/all'],
  ['superadmin', '/jobs/1'],
  ['superadmin', '/jobs/1/applications'],
  ['superadmin', '/attendance/today'],
  ['superadmin', '/attendance/report'],
  ['superadmin', '/attendance/employee/1'],
  ['superadmin', '/leave/pending'],
  ['superadmin', '/leave/types'],
  ['superadmin', '/leave/calendar'],
  ['superadmin', '/leave?status=approved'],
  ['hr', '/employees'],
  ['hr', '/admin/me'],
  ['hr', '/leave/pending'],
  ['hr', '/admin/overview', 403],
  // HQ → v1 screens
  ['superadmin', '/users'],
  ['superadmin', '/users?role=guest'],
  ['superadmin', '/users/roles/all'],
  ['superadmin', '/users/1/login-history'],
  ['superadmin', '/bookings'],
  ['superadmin', '/bookings?userId=5'],
  ['superadmin', `/bookings/calendar?start_date=${inDays(-30)}&end_date=${inDays(60)}`],
  ['superadmin', '/bookings/stats/overview'],
  ['superadmin', '/bookings/1'],
  ['superadmin', '/payments/stats/overview'],
  ['superadmin', '/payments/1'],
  ['superadmin', '/apartments/1'],
  ['superadmin', '/deposit-box/admin/all'],
  ['superadmin', '/deposit-box/admin/1'],
  ['superadmin', '/feedback/admin/all'],
  ['superadmin', '/feedback/admin/stats'],
  ['superadmin', '/wellness/activities'],
  ['superadmin', '/wellness/activities?all=true'],
  ['superadmin', '/wellness/activities?category=restore'],
  ['superadmin', '/wellness/activities/1'],
  ['superadmin', '/wellness/zones'],
  ['superadmin', '/wellness/admin/bookings'],
  ['superadmin', '/wellness/admin/concierge/messages'],
  ['superadmin', '/wellness-availability'],
  ['superadmin', '/wellness-availability/stats/overview'],
  ['superadmin', '/pages'],

  // FAY OS
  ...[
    '/auth/me', '/notifications', '/settings/property', '/settings/preferences', '/settings/team', '/settings/integrations',
    '/settings/invoices', '/analytics', '/conversations', '/dining/tables', '/guests', '/guests/5', '/guests/5/timeline',
    '/guests/5/stays', '/guests/5/bookings', '/guests/5/notes', '/guests/5/folio', '/guests/5/conversation', '/reservations',
    '/reservations/today', '/reservations/room-types', '/reservations/packages', '/reservations/groups', '/residences',
    '/residences/alerts', '/housekeeping/rooms', '/housekeeping/tasks', '/housekeeping/staff', '/housekeeping/stock',
    '/housekeeping/guest-notes', '/service-requests', '/maintenance/work-orders', '/maintenance/preventive', '/maintenance/systems',
    '/maintenance/alerts', '/maintenance/technicians', '/wellness/appointments', '/wellness/packages', '/dining/menu',
    '/dining/orders', '/dining/reservations', '/transport/transfers', '/transport/fleet', '/transport/drivers',
    '/transport/flights', '/experiences', '/experiences/bookings', '/journey/automations', '/ai/alerts',
    '/ai/priorities',
  ].map((p) => ['manager', `/manager${p}`]),
  ['guest', '/manager/guests', 403],

  // Guest app
  ['guest', '/auth/me'],
  ['guest', '/guest/home'],
  ['guest', '/guest/overview'],
  ['guest', '/guest/stays'],
  ['guest', '/guest/stays/1'],
  ['guest', '/guest/folio'],
  ['guest', '/guest/rewards'],
  ['guest', '/guest/requests'],
  ['guest', '/guest/dining/menu'],
  ['guest', '/guest/dining/orders'],
  ['guest', '/guest/dining/reservations'],
  ['guest', '/guest/experiences'],
  ['guest', '/guest/experiences/bookings'],
  ['guest', '/guest/transfers'],
  ['guest', '/guest/tour'],
  ['guest', '/bookings/user/my-keys'],
  ['guest', '/bookings/1'],
  ['guest', '/bookings/2', 404], // someone else's stay: not found, rather than revealing it exists
  ['guest', '/deposit-box/booking/1'],
  ['guest', '/wellness-unified/activities'],
  ['guest', '/wellness-unified/activities?type=journey'],
  ['guest', '/wellness-unified/activities?category=restore'],
  ['guest', '/wellness-unified/activities/1'],
  ['guest', `/wellness-unified/activities/1/availability?date=${inDays(1)}&days=3`],
  ['guest', '/wellness-unified/my-bookings'],
  ['guest', '/wellness/concierge/messages?limit=50'],
  ['guest', '/wellness/metrics'],
  ['guest', '/wellness/smart-home'],
  ['guest', '/admin/overview', 403],
];

async function signIn(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const token = body.token || body.data?.token;
  if (!token) throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return token;
}

async function main() {
  const tokens = {};
  for (const [who, [email, password]] of Object.entries(ACCOUNTS)) tokens[who] = await signIn(email, password);

  let failed = 0;
  for (const [who, path, expected = 200] of CHECKS) {
    const res = await fetch(`${BASE}${path}`, { headers: who ? { Authorization: `Bearer ${tokens[who]}` } : {} });
    const text = await res.text();
    const ok = res.status === expected;
    if (!ok) failed++;
    if (!ok || process.argv.includes('-v')) {
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${res.status} (want ${expected}) ${who || 'public'} GET ${path}${ok ? '' : `\n     ${text.slice(0, 300)}`}`);
    }
  }
  console.log(`\n${CHECKS.length - failed}/${CHECKS.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

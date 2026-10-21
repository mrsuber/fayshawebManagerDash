/**
 * Runs the end-to-end suites against a running API, each on freshly reset demo data.
 * THIS WIPES THE DATABASE in .env — it refuses to run with NODE_ENV=production.
 *
 *   npm run dev            (in another terminal)
 *   npm run test:e2e
 */
const { execFileSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run: the end-to-end tests reset the database.');
  process.exit(1);
}

const root = path.join(__dirname, '..', '..');
const env = { ...process.env, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'E2e-Admin-2026!' };
env.SEED_ADMIN_PASSWORD = env.ADMIN_PASSWORD;

const suites = [
  ['API smoke (every read endpoint)', 'scripts/smoke-api.js'],
  ['Booking flow', 'test/e2e/bookings.js'],
  ['Platform write paths', 'test/e2e/platform.js'],
];

let failed = 0;
for (const [name, file] of suites) {
  console.log(`\n=== ${name}`);
  execFileSync('node', ['db/setup.js', '--reset', '--demo'], { cwd: root, env, stdio: 'ignore' });
  try {
    execFileSync('node', [file], { cwd: root, env, stdio: 'inherit' });
  } catch {
    failed++;
  }
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll end-to-end suites passed');
process.exit(failed ? 1 : 0);

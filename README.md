# Faysha Wellness Residence — v2

The second version of the Faysha platform. It continues
[FayshaaWeb](https://github.com/mrsuber/FayshaaWeb) (v1). The backend, the manager dashboard and the
current administrator pages come from v1. The public website is new, built from the approved design.

| URL | Who | What |
|---|---|---|
| `/` | Guests | The public website: residences, availability and booking (details, terms of stay, card or mobile money payment, confirmation), wellness, about, careers, feedback, contact, terms, privacy |
| `/login` | Everyone | One sign-in for the whole platform. Managers go to `/manager` and administrators to `/admin`. Guests are pointed to the app. (`/admin/login` still works.) |
| `/manager` | Managers, super administrators | **FAY OS** operations dashboard: Guest 360, journey, communications, requests, reservations, residences & smart home, housekeeping, maintenance, wellness, dining, transport, experiences, analytics, FAY AI, settings |
| `/admin` | Super administrators, and any role granted an HQ area | **Faysha HQ**, the boss section: overview, finance, approvals, staff & departments, roles & permissions, view as, HR, properties, audit log, plus residences, bookings, wellness catalogue, feedback and website content |
| iOS / Android | Guests | **The Faysha app** (`mobile/`): stay hub, digital key, smart home, requests, in-residence dining, experiences, rides, bill, concierge chat, wellness, rewards, booking with card or mobile money. See [mobile/README.md](mobile/README.md) |

## Repository

```
frontend/          React 18 (Create React App), Tailwind, MUI
  src/site/        public website: pages, components, site.css (design tokens), api.js, mocks.js, i18n.js (EN/FR)
  src/site/legal/  terms of service and privacy policy text (shared by /terms, /privacy and the booking flow)
  src/manager/     FAY OS manager dashboard (lazy-loaded, styles scoped to body.fayos)
  src/admin/       Faysha HQ, the super administrator dashboard (lazy-loaded, styles scoped to body.fayhq)
  src/pages/admin/ v1 administrator screens, shown inside HQ until each is rebuilt
  public/images/site/  website imagery
backend/           Express + PostgreSQL API (/api), Socket.io, Stripe, Expo and Firebase push, email
  db/              schema.sql (the whole database), setup.js (creates it and the base data; --demo for sample data)
  scripts/         check-sql.js (every SQL statement against the schema), smoke-api.js (every read endpoint)
  test/            unit tests; test/e2e/ end-to-end suites (booking flow, platform write paths)
mobile/            the guest app (Expo SDK 57, React Native)
docs/              MANAGER_API.md (FAY OS API), HQ_API.md (HQ API), GUEST_API.md (guest app API), SERVER_SETUP.md
```

## Design

The website, the dashboards and the apps share one look:

- **Ground and surfaces:** `#0a0c0f`, `#101318`
- **Gold:** `#e8b84a`
- **Text:** warm ivory `#ece6da`
- **Type:** Cormorant Garamond for headings, Jost for text, and Cinzel for the FAYSHA wordmark (it matches the logo)

The tokens are in `frontend/src/site/site.css`; `frontend/src/manager/styles.css` uses the same values. The "The Faysha app"
section shows the guest app's real home screen in the app's own colours (`mobile/src/constants/theme.js`).

Page copy can be edited per language in **Admin → Page Management** (stored by `/api/pages`). The visual editor renders the
new site pages, so the text you click is the text on the live site. Residence photos and 360° panoramas come from
**Admin → Apartments / Categories**; until a category has a photo, the site shows a striped placeholder.

## Run locally

```bash
# Database (PostgreSQL 13+): an empty database and a user that owns it
createdb fayshaa

# API (port 5001)
cd backend && npm install && cp .env.example .env   # fill in DB, JWT, Stripe, SMTP
npm run db:demo        # schema + base data + sample residences, guests and stays (or db:setup for no samples)
npm run dev

# Website + dashboards (port 3000)
cd frontend && npm install && cp .env.example .env
npm start

# Guest app (Expo)
cd mobile && npm install && npx expo start
```

To work on the website or the manager dashboard without a backend, set `REACT_APP_USE_MOCKS=true` in `frontend/.env`
(development only). Both then run on built-in sample data.

`db:setup` prints the first super administrator's sign-in (`admin@fayshaa.com` unless `SEED_ADMIN_EMAIL` is set). The demo
data adds a manager, an HR manager, a staff member and guests, all with the password `Faysha2026!`.
`npm run db:reset -- --demo` starts over (refused when `NODE_ENV=production`).

Tests:

- `cd frontend && npm run test:ci` — website, FAY OS and HQ
- `cd backend && npm test` — HQ access rules, audit, guest notifications
- `cd backend && npm run check:sql` — every SQL statement in the backend prepared against the database
- `cd backend && npm run test:e2e` — with the API running: every read endpoint, the booking flow and the write paths
  across HQ, HR, FAY OS and the guest app. **It resets the database in `.env`** (refused in production).

Production build: `npm run build`.

## Faysha HQ (`/admin`)

The head office. It shares the manager dashboard's design but has a darker, gold-trimmed shell.

| Section | What it does |
|---|---|
| Overview | Today's earnings, month to date compared with last month, tonight's occupancy, arrivals and departures, decisions waiting, mobile money to confirm, alerts, teams on duty, open requests, and the latest changes |
| Finance | Revenue earned per day and by stream or residence type, occupancy, average nightly rate, RevPAR, money collected by method, CSV export. Payments list: mark mobile money or cash as received (this confirms the booking and sends the key), and request refunds |
| Approvals | One queue for refunds, discounts, expenses, purchases and HR leave. An approved refund is carried out at once (through Stripe for card payments); approving leave updates the balance and notifies the employee |
| Staff & departments | Every team member: invite (temporary password by email, or shown once when email is off), change role, department, job title or property, reset password, deactivate |
| View as | A super administrator can open a 30-minute, **read-only** session as any manager or HQ user to see exactly what they see. Every change is refused for that session on the server, and each session is recorded in the audit log |
| Roles & permissions | A grid of HQ areas (overview, finance, approvals, staff, roles, HR, properties, website, audit) against view / manage / approve. New roles such as "Finance Director" work in HQ without code changes |
| HR | Employees, recruitment, applications, attendance, leave. The **HR Manager** role signs in and sees only this |
| Properties | Faysha residences (one today). The property selector in the header focuses Overview and Finance on one property |
| Audit log | Every change made by a signed-in user on the platform (recorded automatically), filterable by area, date and view-as; plus sign-ins |
| Residences, Bookings, Guest accounts, Wellness catalogue, Feedback, Website content | The v1 screens, shown inside HQ with the HQ palette until each is rebuilt |

Day-to-day operations stay in FAY OS (`/manager`), which super administrators can also open.

## Payments

- **Card:** Stripe. The booking is created as *pending*, the PaymentIntent is confirmed in the browser, and
  `POST /api/bookings/:id/confirm` checks the intent with Stripe before confirming and releasing the digital key.
  Needs `REACT_APP_STRIPE_PUBLISHABLE_KEY` (frontend) and `STRIPE_SECRET_KEY` (backend).
- **MTN Mobile Money / Orange Money:** `POST /api/payments/mobile-money` records a pending `mobile_money` payment with the
  guest's number and their terms acceptance. **No mobile money gateway is connected yet**, so staff confirm the booking
  once the money arrives (manager dashboard, or `POST /api/bookings/:id/confirm` as staff), which sends the
  confirmation and the digital key. Connecting a provider (e.g. Campay, Notch Pay, MTN MoMo API) replaces that manual step.

An unpaid booking holds its residence for 60 minutes (card) or 48 hours (mobile money awaiting confirmation), then
it is cancelled and the dates are free again (`CARD_HOLD_MINUTES`, `MOBILE_MONEY_HOLD_HOURS`). Reservations made by staff
in FAY OS don't expire.

Terms acceptance (`terms_accepted`, `terms_accepted_at`) is stored with every booking, as in v1.

## Deploying (same server as v1)

Step by step, with backups and rollback: [docs/DEPLOY.md](docs/DEPLOY.md). To have a local AI assistant do it: [docs/DEPLOY_WITH_AI.md](docs/DEPLOY_WITH_AI.md).


1. Database: a new, empty PostgreSQL database built with `node db/setup.js` (schema, base data and the first super
   administrator). The v1 database is not used; see [docs/DEPLOY.md](docs/DEPLOY.md).
2. Backend: deploy `backend/` in place of v1's backend. Add the new variables from `backend/.env.example`:
   `CONTACT_EMAIL` (contact form recipient), `APP_URL`, `PROPERTY_WIFI_SSID` / `PROPERTY_WIFI_PASSWORD` (shown with the
   digital key), and the Stripe and SMTP values if they are not set already. Raise `RATE_LIMIT_MAX_REQUESTS` if it is 100.
3. Frontend: `cd frontend && REACT_APP_API_URL=/api npm run build`, then publish `build/` (as v1's `build-production.sh` does).
4. Old v1 addresses (`/booking`, `/amenities`, `/apartments/:id`, `/terms-of-service`, `/privacy-policy`) redirect to the
   new pages, so links in emails that were already sent keep working.
5. Guest app: build with EAS and publish to the stores (see [mobile/README.md](mobile/README.md)). The current v1 app
   keeps working against the new backend, except its sign-up screen, which only the new app has.

## Roadmap

1. ~~Public website~~ (this release)
2. ~~Super administrator dashboard, Faysha HQ~~ (this release). Next for HQ: rebuild the remaining v1 screens natively, and let managers raise approval requests from FAY OS
3. ~~Guest app updated to the v2 API and design~~ (this release). Next: connect a mobile money gateway, Apple Pay / Google Pay
4. Staff app, showing each person only their role's screens: housekeeping, maintenance, dining/F&B, concierge/front desk,
   drivers, spa therapists

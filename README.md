# FAY OS — Faysha Wellness Residence dashboard

Management dashboard for Faysha Wellness Residence. It's a React 18 app built with Create React App and is designed to run against the FAY Express/PostgreSQL backend.
Until you configure a backend, it runs on built-in sample data. That data is a working store: what you create
(requests, messages, bookings, notes, payments) is saved in the browser and shows up on every screen.
Use **user menu → Reset demo data** to start over.

## Stack

| | |
|---|---|
| Framework / build | React 18.2, React Scripts 5.0.1 (CRA) |
| Styling | Tailwind CSS 3.4.1, MUI 7.3.8 (Emotion), design tokens in `src/styles.css` |
| UI | @mui/icons-material, react-big-calendar (moment), pannellum-react (360° tours), react-phone-input-2 |
| Routing | React Router DOM 6.20 |
| Data | Axios 1.6.2 (JWT bearer), Socket.io-client 4.8.3 |
| i18n | i18next + react-i18next (English, French) |
| Auth | JWT from the API; optional Google sign-in through Firebase 10.7.1 |
| Push | Firebase Cloud Messaging (`public/firebase-messaging-sw.js`) |
| Payments | Stripe Payment Element (@stripe/react-stripe-js) |
| Tests | Jest + React Testing Library |

## Run

```bash
npm install          # .npmrc sets legacy-peer-deps (pannellum-react declares a React 16 peer)
cp .env.example .env # optional: leave as-is to run on sample data
npm start            # http://localhost:3000
npm test             # watch mode; `npm run test:ci` for a single run
npm run build        # production build into build/
```

### Connecting the backend

1. Start the Express API on port 5000. In development, CRA proxies `/api` to it (`"proxy"` in `package.json`).
2. In `.env`, set `REACT_APP_USE_MOCKS=false`. For a remote API, also set `REACT_APP_API_URL=https://…/api`.
3. Add `REACT_APP_STRIPE_PUBLISHABLE_KEY` and the `REACT_APP_FIREBASE_*` values to enable payments, Google sign-in and push notifications.

The endpoints, payload shapes, Socket.io events and an Express wiring sketch are in **[docs/API.md](docs/API.md)**.

## Structure

```
public/
  index.html                  fonts (Cormorant Garamond, Jost, Material Symbols)
  firebase-messaging-sw.js    background push notifications
src/
  index.js                    providers: MUI theme, router, toasts, auth, socket, i18n
  App.jsx                     routes; /login + auth guard; "/" → last page visited
  config.js                   REACT_APP_* env → runtime config (API URL, mock mode, Stripe, Firebase)
  theme.js                    MUI dark theme (gold primary, brand fonts)
  styles.css                  design tokens (:root vars) + shared classes (card, chip, tab, toggle, kpi…)
  index.css                   Tailwind layers (preflight off; tokens exposed as colors in tailwind.config.js)
  api/                        axios client + one module per resource (auth, conversations, serviceRequests,
                              reservations, residences, housekeeping, dining, ai, notifications, settings, payments)
  mocks/data.js               seed data in the API's shapes (dates relative to today)
  mocks/collections.js        seed rows for the operational list resources
  mocks/db.js                 working copy the mock API reads/writes, persisted in localStorage
  context/                    AuthContext (JWT/Firebase), SocketContext (socket.io), ToastContext (MUI Snackbar)
  hooks/                      useApi (load + local updates), useCollection (CRUD list), useGuestOptions, useSocketEvent
  i18n/                       i18next setup + locales/en.json, fr.json
  lib/firebase.js             lazy Firebase: Google sign-in, FCM token, foreground pushes
  components/
    Layout.jsx                sidebar, top nav, hero header
    HeaderMenus.jsx           language, notifications (live) and user menus
    BookingCalendar.jsx       react-big-calendar stays view
    PaymentDialog.jsx         Stripe Payment Element dialog
    PanoramaDialog.jsx        pannellum 360° residence tour
    ui.jsx                    shared primitives: Card, KpiGrid, Toggle, Bar, Donut, Chip, QuickActions…
  pages/                      one file per screen + Login
  pages/guest360/             Guest 360 cards, action dialogs (useGuestActions) and formatting helpers
  components/FormDialog.jsx   generic MUI form dialog (requests, messages, bookings, notes, tags…)
  components/ViewAllDialog.jsx  "View All" pop-up with search + filter chips
  __tests__/                  app, page and API-client tests
```

| Route           | Page                          | What works (on sample data or the API) |
|-----------------|-------------------------------|---|
| `/guest360`     | Guest 360                     | all-guests list, profile, requests, bookings, messages, timeline, history, folio, notes, check-in/out |
| `/journey`      | Guest Journey                 | any guest: stages, timeline, milestones (view/modify/cancel), recommendations → booking, automations, satisfaction |
| `/comms`        | Communications Center         | channels, search, date/stay filters, new message, reply / internal note, guest context tabs, quick actions |
| `/requests`     | Service Requests & Operations | create, search, date range, status/priority/department changes, live KPIs & charts |
| `/reservations` | Reservations Management       | 9 working tabs, new reservation (overlap check), cancel/confirm, check-in/out, packages, groups, rates |
| `/residences`   | Residences & Smart Home       | devices, climate, scenes, security toggles, device alerts, 360° tour |
| `/housekeeping` | Housekeeping                  | status board, tasks (create/advance), team, linen restock, guest notes |
| `/maintenance`  | Maintenance                   | work orders (create/assign/status), alerts → work orders, preventive schedule, technicians, diagnostics |
| `/wellness`     | Wellness & Spa                | schedule (room-clash check), availability grid, packages, recommendations, guest profile |
| `/dining`       | Dining Management             | reservations (seat/complete), floor plan, orders, menu, walk-ins, dietary requests |
| `/transport`    | Transportation                | transfers, assignment, fleet, chauffeurs, flight watch → pickup, live map |
| `/experiences`  | Experiences                   | catalogue (add, pause), booking with capacity check, offers to guests |
| `/analytics`    | Analytics                     | 7/30 days, YTD and custom ranges, CSV export, top services |
| `/ai`           | FAY AI Command Center         | ask FAY, live KPIs, alerts, priorities, insights → priorities, cameras |
| `/settings`     | Settings                      | property, team & roles, residences, AI behaviour, notifications, integrations, billing |
| (header)        | Notifications                 | list, mark read, FCM device token, live `notification:new` |

Every “View All ›” opens a searchable, filterable pop-up of that card's items. Mutations go through `src/api/*`; most operational
lists use the generic collections API (`src/api/collections.js` + `useCollection`). Their endpoints and fields are listed in docs/API.md.

A few decorative panels (e.g. the energy chart on Residences, the response-time chart on Service Requests) are still
constants in the page file.

## Adding a translation

Strings for navigation, page headers, the login screen and dialogs are in `src/i18n/locales/*.json`.
To add a language, add a catalogue with the same keys, then register it in `LANGUAGES` and `resources` in `src/i18n/index.js`.

## Placeholders

Photos are striped placeholders labelled with what goes there (e.g. "guest portrait", "residence photo").
Icons on the original screens use the Material Symbols Outlined font; new MUI controls use @mui/icons-material.

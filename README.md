# FAY OS — Faysha Wellness Residence dashboard

Management dashboard for Faysha Wellness Residence. It's a React 18 app built with Create React App and is designed to run against the FAY Express/PostgreSQL backend.
Until you configure a backend, it runs on built-in sample data.

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
  mocks/data.js               sample data in the API's shapes, served when mocks are on
  context/                    AuthContext (JWT/Firebase), SocketContext (socket.io), ToastContext (MUI Snackbar)
  hooks/                      useApi (load + local updates), useSocketEvent
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
  __tests__/                  app, page and API-client tests
```

| Route           | Page                          | Backed by the API |
|-----------------|-------------------------------|---|
| `/guest360`     | Guest 360                     | — |
| `/journey`      | Guest Journey                 | — |
| `/comms`        | Communications Center         | conversations, messages, send, live `message:new` |
| `/requests`     | Service Requests & Operations | list, mark completed, live create/update |
| `/reservations` | Reservations Management       | calendar stays, today's arrivals/departures, Stripe payment |
| `/residences`   | Residences & Smart Home       | residences, device toggles, climate, scenes, 360° tour |
| `/housekeeping` | Housekeeping                  | status board, live `housekeeping:updated` |
| `/maintenance`  | Maintenance                   | — |
| `/wellness`     | Wellness & Spa                | — |
| `/dining`       | Dining Management             | floor-plan table status |
| `/transport`    | Transportation                | — |
| `/experiences`  | Experiences                   | — |
| `/analytics`    | Analytics                     | — |
| `/ai`           | FAY AI Command Center         | `POST /ai/ask` |
| `/settings`     | Settings                      | property details (editable, phone input) |
| (header)        | Notifications                 | list, mark read, FCM device token, live `notification:new` |

Pages marked "—", and the static panels on the other pages, still read constants at the top of the page file.
To connect one, add a function to `src/api/`, put its sample data in `src/mocks/data.js`, and load it with `useApi`.

## Adding a translation

Strings for navigation, page headers, the login screen and dialogs are in `src/i18n/locales/*.json`.
To add a language, add a catalogue with the same keys, then register it in `LANGUAGES` and `resources` in `src/i18n/index.js`.

## Placeholders

Photos are striped placeholders labelled with what goes there (e.g. "guest portrait", "residence photo").
Icons on the original screens use the Material Symbols Outlined font; new MUI controls use @mui/icons-material.

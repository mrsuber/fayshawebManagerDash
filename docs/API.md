# FAY OS — backend contract

The dashboard talks to an Express API (Node, PostgreSQL, JWT, Socket.io, Stripe, Firebase Admin).
Every call lives in `src/api/*.js`; each function documents its endpoint and falls back to
`src/mocks/data.js` when `REACT_APP_USE_MOCKS=true`. Implement the routes below and set
`REACT_APP_USE_MOCKS=false` to go live.

## Conventions

| | |
|---|---|
| Base URL | `REACT_APP_API_URL` (e.g. `https://api.faysha.com/api`). In dev, leave it empty: CRA proxies `/api` to `http://localhost:5000` (`"proxy"` in `package.json`). |
| Format | JSON in, JSON out. Dates are ISO 8601 strings (`2025-11-28T18:12:00Z`); stay dates are `YYYY-MM-DD`. |
| Auth | `Authorization: Bearer <jwt>` on every request after login (`src/api/client.js`). |
| Errors | Non-2xx with `{ "message": "…" }` (or `{ "error": "…" }`). The message is shown in a toast. |
| 401 | Any 401 signs the user out and returns them to `/login`. |
| IDs | Numeric or string; the UI never parses them. |

Field names are camelCase. With `pg`, alias columns in SQL (`guest_name AS "guestName"`) or map rows before `res.json`.

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` — compare with `bcrypt.compare`, sign with `jwt.sign` |
| POST | `/auth/firebase` | `{ idToken }` | `{ token, user }` — verify with `admin.auth().verifyIdToken(idToken)`, find/create the user, sign your own JWT |
| GET | `/auth/me` | — | `{ user }` |

`user`: `{ id, name, email, role }`

## Guests (Guest 360)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/guests?status=&q=` | — | `GuestSummary[]` (most recent stay first). `status`: `In House \| Arriving \| Upcoming \| Checked Out \| VIP` |
| GET | `/guests/:id` | — | `Guest` |
| PATCH | `/guests/:id` | `{ tags?, preferences?, vip? }` | `Guest` |
| POST | `/guests/:id/check-in` | — | `Guest` (status `In House`, digital key on) |
| POST | `/guests/:id/check-out` | — | `Guest` (status `Checked Out`, digital key off) |
| GET | `/guests/:id/timeline` | — | `TimelineEvent[]` newest first |
| GET | `/guests/:id/stays` | — | `Stay[]` newest first |
| GET | `/guests/:id/bookings` | — | `Booking[]` by start time |
| POST | `/guests/:id/bookings` | `{ type, title, startsAt, endsAt, guests, notes }` | `Booking` |
| PATCH | `/guests/:id/bookings/:bookingId` | `{ status }` (e.g. `Cancelled`) | `Booking` |
| GET | `/guests/:id/notes` | — | `Note[]` newest first |
| POST | `/guests/:id/notes` | `{ body }` | `Note` (author = signed-in user) |
| GET | `/guests/:id/folio` | — | `{ charges, payments, total, paid, balance, currency }` |
| POST | `/guests/:id/payments` | `{ amount, method }` | `Payment` (staff-recorded; card payments go through Stripe below) |
| GET | `/guests/:id/conversation` | — | `{ conversation \| null, messages: Message[] }` |
| POST | `/guests/:id/messages` | `{ channel, body }` | `Message`. Create the conversation if needed and emit `message:new`. |

- `GuestSummary`: `{ id, name, vip, status, residence, collection, checkIn, checkOut, country, totalStays, lastStayAt }`
- `Guest`: `{ id, name, vip, status, residence, collection, checkIn, checkOut, checkInTime, checkOutTime, adults, children, purpose, tags: string[], contact: { phone, email, country, language, timeZone }, flags: { digitalKey, parking }, preferences: Preference[], services: Service[], insights: string[], value: { revenue, stays, satisfaction } }`
  - `Preference`: `{ key, icon, color, title, detail }` (`icon` is a Material Symbols name)
  - `Service` (smart locker and resident services): `{ key, icon, color, title, detail, status }`
- `TimelineEvent`: `{ id, guestId, at, title, category }`. Write one whenever a request, booking, message, note, payment or check-in/out happens for the guest.
- `Stay`: `{ id, guestId, residence, checkIn, checkOut, nights, purpose, satisfaction, amount, status: Upcoming | Current | Completed }`
- `Booking`: `{ id, guestId, type: wellness | dining | experience | transport, title, startsAt, endsAt, guests, status: Confirmed | Pending | Completed | Cancelled, notes }`
- `Note`: `{ id, guestId, body, author, createdAt }`
- `Charge`: `{ id, guestId, date, description, category, amount }`; `Payment`: `{ id, guestId, date, method, amount }`

## Conversations (Communications)

| Method | Path | Response |
|---|---|---|
| GET | `/conversations?channel=` | `Conversation[]` |
| GET | `/conversations/:id/messages` | `Message[]` oldest first |
| POST | `/conversations/:id/messages` `{ body }` | `Message` — also emit `message:new` |

- `Conversation`: `{ id, guestId, guestName, lastMessage, lastAt, channel, stayStatus }`
  - `channel`: `in_app | whatsapp | email | sms | phone | note`
  - `stayStatus`: `Arriving | In House | Checked Out`
- `Message`: `{ id, conversationId, fromStaff, sender, body, createdAt }`

## Service requests

| Method | Path | Response |
|---|---|---|
| GET | `/service-requests?department=&guestId=` | `ServiceRequest[]` newest first |
| POST | `/service-requests` `{ guestId, title, department, priority, location, notes }` | `ServiceRequest` with status `New`. Also emit `service-request:created`. |
| PATCH | `/service-requests/:id` `{ status }` | `ServiceRequest` — also emit `service-request:updated` |

`ServiceRequest`: `{ id, number, createdAt, guestId, guestName, title, location, priority, status, department, notes }`
- `priority`: `High | Normal | Low`
- `status`: `New | In Progress | Completed | Scheduled | Escalated | On Hold`
- `department`: `Housekeeping | Maintenance | Dining | Wellness | Transportation | Experiences | Concierge`

## Reservations

| Method | Path | Response |
|---|---|---|
| GET | `/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD` | `Reservation[]` that overlap the range (the calendar asks for the visible month) |
| GET | `/reservations/today` | `{ arrivals: Movement[], departures: Movement[] }` |

- `Reservation`: `{ id, guestName, residence, collection, checkIn, checkOut, guests, status, totalAmount, balanceDue?, currency }`
  - `checkOut` is the departure date, so the calendar bar ends the night before.
  - `collection` sets the bar color: `Serenity | Villa Spectra | Allure Penthouse | Riviera | Riviera 2`.
  - `totalAmount`/`balanceDue` are major units (e.g. `1380` = $1,380.00).
- `Movement`: `{ id, time, guestName, residence, guests, status }`, where `time` is a display string such as `"2:00 PM"`.

## Payments (Stripe)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/payments/create-payment-intent` | `{ reservationId, amount, currency }` (`amount` in cents) | `{ clientSecret }` |

Create the intent with `stripe.paymentIntents.create({ amount, currency, metadata: { reservationId }, automatic_payment_methods: { enabled: true } })`.
Don't trust `amount` from the client: recompute it from the reservation. Mark the reservation paid from the
`payment_intent.succeeded` webhook, not from the browser.

## Residences & smart home

| Method | Path | Body |
|---|---|---|
| GET | `/residences` | → `Residence[]` |
| PATCH | `/residences/:id/devices/:deviceId` | `{ on }` |
| PATCH | `/residences/:id/climate` | `{ targetTemp }` (16–30) |
| POST | `/residences/:id/scene` | `{ scene }` (`welcome | relax | sleep | away | wake up`) |

`Residence`: `{ id, name, collection, guestName, status, panoramaUrl, targetTemp, scene }`
- `status`: `Occupied | Arriving | Maintenance | Cleaning | Vacant | Ready`
- `panoramaUrl`: an equirectangular JPEG for the 360° tour (pannellum), or `null`. Serve it from the same origin or with CORS headers.
- `deviceId` is currently `"<Room>/<Device>"`, e.g. `Living Room/Lights`. Return real device IDs from the API to replace it.

## Housekeeping

| Method | Path | Body |
|---|---|---|
| GET | `/housekeeping/rooms` | → `HousekeepingRoom[]` |
| PATCH | `/housekeeping/rooms/:id` | `{ status }` — also emit `housekeeping:updated` |

`HousekeepingRoom`: `{ id, residence, status, note }`, where `status` is `Occupied | Dirty | Cleaning | Inspect | Ready`.

## Dining

| Method | Path | Body |
|---|---|---|
| GET | `/dining/tables` | → `DiningTable[]` |
| PATCH | `/dining/tables/:id` | `{ status }` |

`DiningTable`: `{ id, status, guestName }`, where `status` is `Available | Seated | Reserved | Cleaning`.

## FAY AI

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/ai/ask` | `{ prompt }` | `{ answer }` |

## Notifications

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/notifications` | — | `Notification[]` newest first |
| PATCH | `/notifications/read-all` | — | `{ ok: true }` |
| POST | `/notifications/device-token` | `{ token, platform: "web" }` | `{ ok: true }` |

- `Notification`: `{ id, title, body, createdAt, read }`
- Store device tokens per user. Push with `admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } })`.

## Settings

| Method | Path | Body |
|---|---|---|
| GET | `/settings/property` | → `Property` |
| PUT | `/settings/property` | `Property` → `Property` |

`Property`: `{ name, brand, timeZone, currency, checkInTime, checkOutTime, phone, email }`. `phone` is digits only with the country code (react-phone-input-2), e.g. `971501234567`.

## Socket.io

The client connects to `REACT_APP_SOCKET_URL` (defaults to the API origin) with `auth: { token: <jwt> }`.

| Event (server → client) | Payload |
|---|---|
| `message:new` | `Message` |
| `service-request:created` | `ServiceRequest` |
| `service-request:updated` | `ServiceRequest`, or a partial with `id` |
| `housekeeping:updated` | `{ id, status, note? }` |
| `notification:new` | `Notification` |

## Express wiring sketch

```js
// server.js
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL /* http://localhost:3000 */, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), authRoutes);
app.use('/api', requireJwt, apiRoutes); // requireJwt: jwt.verify(req.headers.authorization?.split(' ')[1], JWT_SECRET)

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL } });
io.use((socket, next) => {
  try {
    socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});
app.set('io', io); // in a route: req.app.get('io').emit('service-request:updated', row)
server.listen(process.env.PORT || 5000);
```

Mount the Stripe webhook route with `express.raw({ type: 'application/json' })` **before** `express.json()`.

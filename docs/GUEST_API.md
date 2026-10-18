# Faysha guest app — API

The guest app (`mobile/`) talks to `/api/guest/*` (`backend/routes/guest/index.js`) for everything about the
signed-in guest's stay, plus the existing `/api/auth`, `/api/bookings`, `/api/payments`, `/api/wellness*` and
`/api/deposit-box` routes. The app's client is `mobile/src/services/guestService.js`.

Every `/api/guest` route needs `Authorization: Bearer <jwt>` and works only on the caller's own data. A guest's
bookings are those linked to the account, plus bookings made with the same email before the account existed.
Errors are `{ "message": "…" }` with the HTTP status (400 invalid, 404 not found, 409 not possible right now).

The routes write to the same tables FAY OS (the manager dashboard) uses, so whatever a guest does appears for staff
at once (Socket.io events to the `staff` room and a header notification), and staff changes come back to the guest
(see [Notifications](#notifications-to-the-guest)).

## Accounts

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` `{ fullName, email, password, phone? }` | Guest sign-up. Password: 8+ characters with letters and a number. 409 `{ code: "ACCOUNT_EXISTS" }` if the email is taken. Returns `{ token, user }` like sign-in and links earlier bookings made with that email |
| POST | `/api/guest/account/delete` `{ password }` | Closes the account (required by the app stores): personal details are removed, the email is freed, every token stops working. Stays and payments are kept for accounting. Not while in residence (409); staff accounts are refused (403) |

## Stay

| Method | Path | Notes |
|---|---|---|
| GET | `/overview` | `{ stay, openRequests, activeOrders, points, tier }`. `stay` is the current stay: in residence, else the next confirmed or awaiting-payment one, or `null` |
| GET | `/stays` | every stay, newest first |
| GET | `/stays/:id` | one stay with its `folio` |
| GET | `/folio?stay=` | the bill: stay line, folio charges (dining, experiences …), payments, total, paid, balance (current stay by default) |

A stay: `{ id, number, status, checkIn, checkOut, nights, guests, residence: { unit, floor, building, name, image },
stayTotal, extras, total, paid, balance, awaitingMobileMoney, termsAccepted, inHouse, canControlHome, specialRequests }`.

## Services

| Method | Path | Writes to (FAY OS screen) | Notes |
|---|---|---|---|
| GET / POST | `/requests` `{ department, title, notes?, urgent?, location? }` | `service_requests` (Service Requests) | departments: Housekeeping, Maintenance, Concierge, Dining, Wellness, Transportation, Experiences. Needs a confirmed or in-house stay |
| POST | `/requests/:id/cancel` | | while not yet in progress |
| GET | `/dining/menu` | `menu_items` | available dishes |
| GET / POST | `/dining/orders` `{ items: [{ id, qty }], time?: "HH:MM" \| "asap", notes? }` | `dining_orders` + `folio_charges` (Dining) | in residence only; prices come from the menu, never from the app; charged to the stay |
| GET / POST | `/dining/reservations` `{ venue, date, time, guests, notes? }` | `dining_reservations` (Dining) | status `pending` until the restaurant confirms |
| POST | `/dining/reservations/:id/cancel` | | |
| GET | `/experiences`, `/experiences/bookings` | `experiences`, `experience_bookings` | |
| POST | `/experiences/:id/book` `{ date, time, guests, notes? }` | `experience_bookings` + `folio_charges` (Experiences) | capacity is checked per start time |
| GET / POST | `/transfers` `{ kind, date, time, from?, to?, flight? }` | `transfers` (Transportation) | kinds: Airport pickup, Airport drop-off, City ride |
| GET | `/home` | `residence_controls` (Residences) | in residence only: climate, scene, devices by room, front door, do not disturb |
| PATCH | `/home/climate` `{ targetTemp }` · POST `/home/scene` `{ scene }` · PATCH `/home/devices/:key` `{ on }` · PATCH `/home/privacy` `{ doNotDisturb }` | | same rooms and device keys as FAY OS |
| GET | `/rewards` | | Faysha Circle: 1 point per 1,000 XAF of completed stays and extras; tiers Serenity, Gold (500), Platinum (1,500), Legend (4,000) |
| GET | `/tour` | `apartment_media` | the 360° panoramas uploaded in HQ, for the estate tour |
| POST / DELETE | `/push-token` `{ token, platform?, device? }` | `fcm_tokens` | the device's Expo push token |

Other routes the app uses: `GET /api/bookings/availability`, `POST /api/bookings/check-availability`,
`POST /api/bookings` → `POST /api/payments/create-intent` → `POST /api/bookings/:id/confirm` (card) or
`POST /api/payments/mobile-money` with `source: "app"` (MTN / Orange), `GET /api/bookings/user/my-keys` (digital key,
plus the Wi-Fi from `PROPERTY_WIFI_SSID` / `PROPERTY_WIFI_PASSWORD`), `/api/wellness/concierge/messages` (concierge
chat), `/api/wellness-unified/*` (wellness bookings), `/api/deposit-box/*`, `POST /api/feedback/submit`.

## Notifications to the guest

`backend/services/guestPush.js#notifyGuest` sends a Socket.io event to the room `user_<id>` (the app joins it with its
token) and an Expo push notification to the guest's devices. Payloads carry `{ title, body, screen }`; the app shows an
in-app banner and opens `screen` when tapped.

| Event | When |
|---|---|
| `request:updated` | staff change a request's status in FAY OS |
| `dining:updated` | an order is being prepared, ready or delivered |
| `transfer:updated` | a ride is assigned, en route, delayed or cancelled |
| `stay:confirmed` | a booking is confirmed (card payment, or staff confirming mobile money) |
| `message:push` | the concierge replies (FAY OS → Communications, or the AI concierge) |

`new_message` (the concierge chat itself) is unchanged from v1.

Push needs an EAS project id in the app build (`expo.extra.eas.projectId`); without one the app relies on the live
connection only. `POST /api/notifications/register` and `/unregister` now require a signed-in user and always use
that user (v1 accepted any `userId`).

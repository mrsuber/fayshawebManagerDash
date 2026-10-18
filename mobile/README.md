# Faysha — the guest app

The Faysha Wellness Residence app for guests (iOS and Android, Expo SDK 57 / React Native 0.86). It continues the v1
app with the same look — warm black, gold, Cinzel and Montserrat — and connects it to the v2 backend, so everything a
guest does reaches the team in FAY OS straight away, and the team's updates come back to the guest.

## What guests can do

| Tab / screen | What it does | API |
|---|---|---|
| **Home** | Greeting, the current or next stay (or an invitation to book), mood journeys, quick access, today's wellness schedule, unread concierge messages | `/guest/overview`, `/wellness-unified/my-bookings` |
| **Wellness** | Restore, recharge, reflect, explore; the guest's real sessions (upcoming, completed, minutes); wellness bookings | `/wellness-unified/*` |
| **Residence** | The stay hub: residence, dates and status, digital key, smart home, concierge, one-tap requests, services, Faysha Circle | `/guest/overview` |
| Requests | Housekeeping, maintenance, concierge, wellness, dining, transport; urgent flag; live status; cancel | `/guest/requests` |
| Dining | In-residence menu and cart (charged to the stay), order tracking, table reservations | `/guest/dining/*` |
| Experiences | Curated experiences with capacity checks; added to the bill | `/guest/experiences*` |
| Rides | Airport pickup / drop-off with flight number, city rides; driver and vehicle once assigned | `/guest/transfers` |
| Smart home | Climate, scenes, devices by room, do not disturb (in residence) | `/guest/home*` |
| My bill | Stay, extras, payments, balance | `/guest/folio` |
| Digital key | Gate QR code, door PIN, deposit box, residence Wi-Fi | `/bookings/user/my-keys` |
| **Concierge** | Chat with the team (text, photos, documents) | `/wellness/concierge/*` |
| **Profile** | My stays and stay details (with feedback after check-out), wellness bookings, deposit box, estate tour (360°), personal details, Faysha Circle rewards, settings | `/guest/stays`, `/guest/rewards`, `/guest/tour`, `/auth/profile` |
| Settings | Notifications on this phone, password, help and emergency numbers, legal, close account | `/guest/push-token`, `/guest/account/delete` |
| Book a stay | Dates and guests → residence → details → terms of stay → card (Stripe) or MTN / Orange mobile money → confirmation. Works signed in or as a new guest | `/bookings/*`, `/payments/*` |
| Sign in / create account | Sign-up in the app; a temporary password (from a booking email) must be changed first | `/auth/*` |

Updates from staff — a request in progress, an order on its way, a driver assigned, a booking confirmed, a concierge
reply — arrive as an in-app banner (live socket) and as push notifications, and open the right screen when tapped.
The full API is in [docs/GUEST_API.md](../docs/GUEST_API.md).

## Run it

```bash
cd mobile
npm install
npx expo start          # then press i / a, or scan the QR code
```

The app talks to the server in `app.json → expo.extra.apiUrl` (default `https://fayshaa.com/api`). To use a local
backend on a phone, set it to your computer's address, e.g. `http://192.168.1.20:5001/api`.

Card payments use `expo.extra.stripePublishableKey` (the test key today — put the live publishable key here for
release). Stripe, push notifications and the secure token store need a development build (`npx expo run:ios` /
`run:android`, or EAS Build); Expo Go is enough for everything else.

### Push notifications

1. Create the project on expo.dev and run `eas init` — it writes `expo.extra.eas.projectId` into `app.json`.
2. For Android, add the FCM credentials to the Expo project (`eas credentials`); iOS push keys are created by EAS.
3. Build with EAS. The app asks for permission after sign-in and registers its token with `/api/guest/push-token`.

Without a project id the app still gets every update live while it's open; only background pushes are skipped.

## Build for the stores

```bash
npm install -g eas-cli
eas build --platform ios       # or android, or all
eas submit --platform ios
```

Bundle identifier / package: `com.fayshaa.app`. Version `2.0.0` (bump `version`, `ios.buildNumber` and
`android.versionCode` for each release). Icons, splash and the notification icon are generated from the Faysha logo
in `assets/`.

## Code

```
App.js                     fonts, splash, providers (Stripe, Auth, Live), navigator
src/config.js              API URL, Stripe key, app info (from app.json extra)
src/navigation/            AppNavigator (signed out / change password / signed in), navigationRef
src/contexts/              AuthContext (session), LiveContext (socket, banners, unread, push taps)
src/services/              api (one axios client), session (secure token), authService, guestService, push,
                           bookingService and wellnessUnifiedService (v1)
src/components/ui.jsx      shared UI: Screen, Card, Button, Field, PickerField, Sheet, Pill, Notice, …
src/hooks/useLoad.js       load on focus, pull to refresh
src/screens/stay/          Residence, Requests, Dining, Experiences, Rides, Smart home, Bill, My stays, Stay, Rewards
src/screens/booking/       Book a stay
src/screens/wellness/      Home, Wellness, Concierge, Profile, Digital key, Deposit box, Explore and the v1 wellness screens
src/screens/auth/          Sign in, create account, password screens
```

# Faysha v2.1 — how it works, and how to run it at the top

This guide explains what changed in v2.1, how each part works underneath, why it was built that way, the traps to
avoid, and what still separates Faysha from the very best properties. It is written for the owner and the managers, not
only for developers.

Contents

1. [Booking, accounts and the digital key](#1-booking-accounts-and-the-digital-key)
2. [Notifications and the operations monitor](#2-notifications-and-the-operations-monitor)
3. [Events: tailored proposals instead of prices](#3-events-tailored-proposals-instead-of-prices)
4. [Content you edit without a developer](#4-content-you-edit-without-a-developer)
5. [Front of house: enquiries, chat, visitors, lockers](#5-front-of-house-enquiries-chat-visitors-lockers)
6. [Quality: ratings and inspections](#6-quality-ratings-and-inspections)
7. [Assets, preventive care and the replacement reserve](#7-assets-preventive-care-and-the-replacement-reserve)
8. [Wellness catalogue and dining pre-orders](#8-wellness-catalogue-and-dining-pre-orders)
9. [Money in several currencies](#9-money-in-several-currencies)
10. [FAY OS on a phone](#10-fay-os-on-a-phone)
11. [Deploying v2.1](#11-deploying-v21)
12. [What is still missing to be at the peak](#12-what-is-still-missing-to-be-at-the-peak)

---

## 1. Booking, accounts and the digital key

### What was wrong

When a guest paid by card, two messages reached the server almost at the same moment:

- the **Stripe webhook** (Stripe telling our server "this payment succeeded"), and
- the **app or website** calling `POST /bookings/:id/confirm` after the card form finished.

Only `/confirm` issued the digital key and sent the confirmation email. The webhook just marked the booking
`confirmed`. On a phone, the webhook usually wins the race (Stripe's servers are faster than a mobile network), so
`/confirm` then found a booking that was "already confirmed" and stopped. Result: **no key, no email, and for a new guest
no temporary password** — exactly the "key generation fails" and "the mail never comes" you saw. Bookings made by staff
in FAY OS, and check-ins, also never issued a key.

Two other faults sat next to it:

- **Deposit box PINs were shared.** Each new guest received the box's *current* PIN — the same one the previous guest
  had used. A departed guest could still open the box.
- **A later booking stole the box from the guest in residence.** Confirming a stay for next month re-pointed the box at
  that future booking.

### How it works now

Everything that follows a confirmation lives in one place, `services/stayKeys.js → finalizeStay()`, and **every** path
that confirms a stay calls it: the card confirmation, the Stripe webhook, staff recording mobile money or cash, FAY OS
reservations, status changes and check-in.

It is **idempotent** — safe to run twice — which is the standard answer to webhook races:

- The key is issued with `UPDATE … WHERE gate_qr_code IS NULL`. Only the first caller succeeds.
- The email is *claimed* before sending (`email_sent = true`), so the webhook and `/confirm` never both send. If sending
  fails, the claim is released, the error is stored on the booking, and managers get an urgent alert to resend.
- A guest who has never signed in gets working sign-in details even if an earlier email failed.

The deposit box now **belongs to one stay at a time**: the stay in progress, else the next confirmed one. Each time it
passes to a new stay its PIN changes, so the previous guest's PIN stops working. A later stay sees its box number at
once and receives its PIN when the box becomes theirs.

The confirmation email was rebuilt in the Faysha look, with the gate QR code **attached inline** (Gmail and Outlook block
`data:` images, which is why the old email showed text instead of a QR code).

### Things to know

- **Email is the weakest link.** If SMTP fails, the guest is stuck. Watch for the urgent "Confirmation email not
  delivered" alert; "Resend confirmation" in the reservation fixes it. Set SPF, DKIM and DMARC records for the sending
  domain, or confirmations will land in spam.
- **Never** show the temporary password on the booking screen itself. Anyone can book with someone else's email; the
  inbox is the proof of ownership.

---

## 2. Notifications and the operations monitor

A notification system is only as good as two things: **what it watches** and **whether people trust it**. Before,
most alerts were raised by staff's own actions (checking a guest in notified the person who did it), while bookings,
payments to confirm and every deadline raised nothing.

### Three kinds of alert

| Level | Meaning | Example |
|---|---|---|
| **Info** | Something happened | A booking was confirmed |
| **Action** | Someone must do something | Mobile money to confirm, a visitor to approve |
| **Urgent** | Do it now | Late check-out, a 1-star rating, critical equipment down |

Each alert links to the record. Alerts raised by a condition carry a **dedupe key** (`late-checkout:12`): the condition
is announced once, not every minute, and the alert is **resolved automatically** when the condition clears. "Needs
action" is therefore always true — the most important property of an alert list, because a list that is often wrong
gets ignored.

### The monitor

`services/monitor.js` runs every minute. A PostgreSQL *advisory lock* ensures that if the server ever runs twice, only one
copy checks. It watches:

- **Front desk:** late check-outs (standard time + grace), guests not arrived (no-shows), residences not ready two hours
  before an arrival.
- **Requests:** requests not picked up within their target (urgent 10 min, high 15, normal 30, low 60).
- **Guests waiting:** a message unanswered for 10 minutes; website enquiries unanswered for 4 hours.
- **Events:** requests nobody opened, deposits not received three days after acceptance, proposals about to expire,
  events in the coming week.
- **Lockers and visitors:** overdue returns, visitor passes waiting for approval.
- **Assets:** care due or overdue, time to order a replacement, spares below minimum, warranty ending, critical
  equipment out of service.

Guests also receive an **arrival-day** message (their residence and check-in time) and a **departure-morning** message
(check-out time, offer of late check-out or a ride).

### Where alerts appear

- **FAY OS bell:** "Needs action" and "All". A soft chime (twice for urgent), a desktop notification while FAY OS is in
  another tab (allow it once in the bell), and the count in the browser tab title.
- **Phone push for managers** needs Firebase web push (`REACT_APP_FIREBASE_VAPID_KEY`); without it, alerts arrive while
  FAY OS is open.
- **Guest app:** a notification inbox (bell on Home). Everything the app told the guest is kept, because push messages
  can be missed or dismissed.

### Tuning

The thresholds (SLA minutes, 10-minute reply time, 4-hour enquiry time) are in `services/monitor.js`. Start with these,
then **review the alert list weekly** for two months: an alert nobody acts on should be removed or its threshold changed.
Alert fatigue is the reason most hotel systems are ignored.

---

## 3. Events: tailored proposals instead of prices

Weddings and corporate events are sold like this in the best hotels: **enquiry → conversation → tailored proposal →
signed acceptance → deposit secures the date → event → follow-up**. Fixed online prices do not work, because the price
depends on guests, menu, spaces, services, season and day of the week.

### The flow

1. **Request** (website `/events`, app "Plan an event", or staff): occasion, date or flexible, guests, spaces, catering
   and style, dietary needs, services, rooms for guests, budget range and the client's own words.
2. **Assessing:** opening the request in FAY OS → Events moves it here. Call the client within a working day.
3. **Proposal:** line items (with presets: venue hire, catering per guest, decor, sound, rooms…), discount, tax,
   deposit percentage, validity and terms. Totals and per-guest cost are calculated as you type. Save drafts; sending
   emails a **private link**. Each revision is a new version; sending supersedes the previous one.
4. **The client** opens the link (or My events in the app), sees every line, and accepts by typing their name, or
   declines with a note. You see when the proposal was opened.
5. **Deposit:** recording the payment confirms the date.
6. **After:** mark it completed, then "Write the story" starts a journal entry.

### Pricing advice

- Price **per guest** for food and drink and **per event** for the venue. Clients compare per-guest figures.
- Ask for the **budget range** (the form does). The best events teams design to the budget instead of quoting blind.
- Typical deposits are **30–50 %** to hold the date, the balance 14–30 days before, and a written cancellation scale.
  Put this in the proposal's terms.
- Use **minimum spends** for exclusive use of the whole estate on Saturdays in high season.

### The journal (`/stories`)

Social proof sells events. After each event, with the client's permission, publish a story: a cover photo, a gallery,
the brief, the day and a quote. The events page shows the latest three. **Always get written consent** for names and
photos of guests.

---

## 4. Content you edit without a developer

FAY OS → **Content**:

- **Estate & 360° tour:** the places shown in the app's Explore (pool, spa, lounge, golf…), each with a photo and,
  optionally, a 360° image. Places with a 360° image form the virtual tour; residence panoramas uploaded in HQ follow.
  A 360° image is an *equirectangular* photo (2:1, e.g. 6000 × 3000) from a 360° camera such as a Ricoh Theta or Insta360;
  the "opens facing" angle sets the first view.
- **Terms & privacy:** edited as Markdown with a live preview, published as **numbered versions** with a summary and an
  effective date. Every booking records the version its guest accepted, so in a dispute you can show exactly what was
  agreed. Have a lawyer review the text: it was carried over from v1 and mentions "Property by Result".
- **Stories:** the journal (section 3).

Text is rendered without HTML, so nothing typed in the dashboard can inject scripts into the website.

---

## 5. Front of house: enquiries, chat, visitors, lockers

**Enquiries** (website contact form): saved and handled in FAY OS → Enquiries, with status, an owner, internal notes
and replies sent by email from the dashboard. The thread stays on file and first-response time is recorded. The team
inbox still gets a copy.

**Chat photos:** photos and documents are uploaded first (multipart, up to 10 MB), then sent. The file type is checked
from the file's content, not its name, so nothing harmful can be stored. Photos failed before because the app sent them
as base64 text inside JSON — several megabytes — which the server's request limit refused. **Raise nginx's
`client_max_body_size` to 25m** (see DEPLOY.md), or large photos will still be refused before they reach the
application.

**Visitors & gate:** a resident invites a visitor for a day of their stay. The visitor receives a link with
directions, a QR code and a 6-digit code (shown only once approved). At the gate the guard checks the code or scans the
QR in FAY OS → Visitors & Gate and presses "Open gate". Every opening is logged. To make the gate open by itself, a gate
controller (most models accept a relay or HTTP command) is connected through `GATE_WEBHOOK_URL`; until then the screen
honestly says "the guard opens it". Choose in the settings whether passes need approval.

**Lockers & loans:** extra lockers, golf clubs and balls, sport, beach and children's kit. Each physical item has a
code. Guests ask from the app, staff assign an item (a locker gets a code the guest sees in the app), hand it over and
record its return and condition. Damaged items go to maintenance; overdue loans raise an alert.

---

## 6. Quality: ratings and inspections

**Guest ratings:** after a request, a meal, equipment or the stay, the app invites the guest to rate it (1–5 stars and
a comment). The team member who served is recorded. A 1–2-star rating is an **urgent** alert. FAY OS → Quality shows
averages per person and department and records the follow-up. The service-recovery rule of the best hotels: **contact
the guest while they are still with you**. A problem fixed during the stay usually ends better than one that never
happened.

**Housekeeping inspection:** a residence goes Dirty → Cleaning → Inspect (recording who cleaned) → **Ready only after a
supervisor's checklist** (editable) and a score. A missed item sends it back to Dirty with the items to redo. Pass rates
per housekeeper appear in Quality: use them to coach, not to punish.

---

## 7. Assets, preventive care and the replacement reserve

This is how serious operators avoid "the pump died and the new one arrives in six weeks".

### The register

Record everything the business depends on: air conditioners, the generator, pumps, water heaters, kitchen and laundry
machines, gym equipment, mattresses, smart locks, vehicles, and the building itself (paintwork, waterproofing). For each:
purchase date and cost, **expected life**, **replacement cost today** (including shipping and fitting), **lead time**
from order to installed, criticality, and how many **spares or standby units** to keep.

Typical expected lives in a tropical coastal climate (salt and humidity shorten them): split AC 7–10 years, pool pump
4–6, water heater 8–10, generator 15–20 (with servicing every 250 hours), mattress 8, interior paint 3–5, exterior
paint 5–7, commercial washer 7–10.

### Three dates FAY OS calculates

- **Replace by** = purchase date + expected life.
- **Order by** = replace by − lead time − 30 days. **This is the date that matters**: order then, and the new unit
  arrives before the old one fails.
- **Next care** from the schedule.

### The replacement reserve (sinking fund)

Each asset sets money aside every month:

> monthly reserve = (replacement cost − money already reserved) ÷ months of life left

FAY OS posts each asset's contribution once a month and shows what to set aside in total, how much is reserved, and the
percentage funded. When you record a replacement, the reserve pays first and the new unit starts a new life.

To make it real, **move that amount into a separate savings account every month.** Otherwise the reserve is only a
number. Many hotel brands require 3–5 % of revenue for this ("FF&E reserve" — furniture, fixtures and equipment).

### Spares and redundancy

For anything whose failure stops the business **and** takes long to ship, keep a standby: a second pump, a spare AC
compressor, a second router, spare smart-lock batteries and keypads. Set "spares to keep" to 1–2; FAY OS alerts below
that. This is the "at least two for sensitive equipment" you asked for.

### The schedule

Recurring care for assets and areas: AC filters every 3 months, generator service every 250 hours or 3 months, pool pump
seals yearly, deep clean of the estate twice a year, repainting every 3–5 years. Marking it done logs the cost and
schedules the next from that date. The 12-month forecast combines replacements and care, so the budget is known a year
ahead.

---

## 8. Wellness catalogue and dining pre-orders

**Wellness:** the FAY OS wellness page used to have its treatments and venues written into the code. Now FAY OS → Wellness
→ Catalogue manages every experience. A **service** is one step (massage, golf, yoga). A **journey** has stages
(Restore: massage → steam → cold plunge), each with its own duration, room, floor, photo and whether that room opens
with the guest's PIN. You also set where it happens (indoors on a floor, outdoors, in the residence, off the estate), how
guests get in (open, PIN, QR, escorted), opening hours, booking notice, and equipment lent with it (golf → clubs and
balls). The app reads these from the server.

**Dining:** the restaurant serves tea, cakes and breads by default; meals are prepared on **pre-order**. When booking a
table, the guest chooses dishes from the menu. Prices come from the menu (never from the app), and each dish's notice
period ("needs 24 hours") is enforced. Mark dishes "pre-order only" and set their notice in FAY OS → Dining → menu. The
kitchen sees the pre-order with the reservation.

---

## 9. Money in several currencies

- **Prices are kept in XAF.** One base currency keeps accounting, reports and taxes simple.
- **XAF and XOF are pegged to the euro** at exactly **655.957 XAF per €1** (the CFA franc, guaranteed by the French
  Treasury). EUR and XOF are therefore fixed in FAY OS and cannot drift. USD, GBP, NGN and others **float**: update
  their rates in Settings → Currencies, at least weekly (FAY OS warns when they are over a week old). Use your bank's
  rate plus a small margin (1–3 %) to cover card conversion costs.
- **Guests choose** a display currency (website header, app settings). Converted prices show **≈**, because the rate
  moves.
- **Cards** can be charged in the chosen currency (Stripe supports this). The payment is recorded in XAF with the
  currency, amount and rate charged, so every report adds up in one currency and refunds convert at the original rate.
- **Mobile money is always XAF** — MTN and Orange charge in francs.
- **Your Stripe account** must accept the currencies you offer, and payouts arrive in your settlement currency; Stripe
  charges a conversion fee. Check the fees for Cameroon, and whether Stripe is available to your company at all —
  many Central African businesses use a local aggregator (CinetPay, Campay, Notch Pay) for cards and mobile money
  together.

---

## 10. FAY OS on a phone

On phones and tablets the sidebar is now a drawer behind the menu button, the area navigation is one scrolling row,
page headings are compact, KPI tiles sit two per row, dialogs use the whole screen, and split views (list then detail)
show one pane at a time with a Back button. The header shows the signed-in person. The search icon opens a page finder
(Ctrl/⌘+K on a computer).

Some older pages (Guest 360, Reservations, Service Requests) still have dense tables that scroll sideways on a phone.
They work, but are built for a desk. Rebuild them in the new style as they are next touched.

---

## 11. Deploying v2.1

Follow [DEPLOY.md](DEPLOY.md). What is new:

1. **Migrations.** After copying the backend, run `NODE_ENV=production node db/setup.js`. It applies the new
   `db/migrations/*.sql` (each once, each in a transaction) and prints them. Back up the database first.
2. **nginx:** `client_max_body_size 25m;` (photos in chat, 360° images).
3. **New environment variables** (all optional): `GATE_WEBHOOK_URL`, `GATE_WEBHOOK_SECRET` (gate controller),
   `MONITOR_DISABLED` (to switch the monitor off).
4. **After deploying**, in FAY OS:
   - **Settings → Property:** check the standard check-in and check-out times (14:00 / 11:00 by default).
   - **Settings → Currencies:** choose the currencies and set the floating rates.
   - **Content → Terms & privacy:** have them reviewed, then publish.
   - **Content → Estate:** add photos and 360° images.
   - **Wellness → Catalogue:** add photos, places, access and stages.
   - **Lockers & Loans:** add each locker and item.
   - **Assets:** register critical equipment first (generator, pumps, AC, water, kitchen).
   - **Visitors & Gate → Settings:** directions and the approval rule.
   - **Housekeeping:** the inspection checklist (Quality → Inspections).
5. **The guest app** needs a new build for: photo messages, events, lockers, visitors, ratings, the notification inbox,
   currencies, pre-orders and the managed terms. Until guests update, the old app keeps working against the new server.

Tests: `npm run test:e2e` (backend, now four suites including `test/e2e/v21.js`), `npm run check:sql`, `npm test`;
`npm run test:ci` (frontend).

---

## 12. What is still missing to be at the peak

The platform now covers the operation end to end. These are the steps that would put it level with the best
independent luxury properties, roughly in order of value:

1. **A payment provider for Cameroon.** Card and mobile money through one local aggregator, with automatic confirmation
   instead of staff confirming mobile money by hand. This removes the slowest step in booking.
2. **Hardware integration.** Smart locks that receive the door PIN automatically (Nuki, TTLock, Salto), and the gate
   controller. Today PINs are generated and shown; the locks must be programmed to match.
3. **A staff app** (already on the roadmap): housekeepers and technicians receive tasks, mark rooms cleaned, attach
   photos, and the inspection happens on a tablet in the room.
4. **Revenue management.** Prices per date (season, weekends, events in town), minimum stays, and occupancy-based
   adjustments. The `calculatePrice` function still uses one price per night.
5. **Channel manager.** Booking.com, Airbnb and Expedia calendars synchronised, so the same night is never sold twice.
6. **Guest profile intelligence.** Preferences remembered across stays (pillow, room temperature, dietary needs), birthdays
   and anniversaries flagged before arrival. FAY OS has the profile; feed it from every service.
7. **Reviews loop.** After check-out, guests who rated 4–5 stars are invited to review on Google and TripAdvisor; 1–3
   stars go to the manager first.
8. **Reporting for the owner.** RevPAR, ADR, occupancy, cost per occupied room, F&B margin, maintenance spend against
   reserve, guest satisfaction — monthly, compared with last year.
9. **Content quality.** Professional photography (residences, spa, food, the estate at golden hour) and real 360° images.
   In luxury hospitality, photography is the single largest driver of direct bookings.
10. **Security hygiene.** Two-factor sign-in for managers, a password policy for staff, regular database backups tested
    by restoring them, and the guest app's socket authentication (`SOCKET_REQUIRE_AUTH=true` once all guests run the
    new app).

Things noticed along the way that still show sample or invented data, to replace or remove: the "24 min average
response" and response-time chart on Service Requests, the wellness metrics (sleep 90 %, mood "Calm") in the guest app,
the FAY OS Maintenance page's built-in list of locations, and the Guest 360 portrait placeholder.

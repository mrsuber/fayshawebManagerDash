# Manual test: set up and check the whole platform

Work through this in order on https://fayshaa.com. Each part builds on the one before. Tick the boxes as you go;
anything that doesn't behave as described is a bug to report (note the step number and what you saw).

**Test emails:** use addresses you can read. With Gmail, `you+hr@gmail.com`, `you+guest1@gmail.com` and so on all
arrive in your own inbox but count as different accounts.

**Private windows:** to be two people at once (HQ and a guest, or the super administrator and the HR manager), use a
normal window for one and a private/incognito window for the other.

---

## 0. Before you start

- [ ] Sign in at **/login** with the super administrator account from the deployment.
- [ ] You land on **HQ → Overview**. All figures are 0, with no red "Something went wrong" box.
- [ ] Under **Needs your attention**, note whether it says **Outgoing email is not configured** or **Card payments
      are not configured**. This changes some steps:
  - **No email:** passwords for new staff are shown on screen once instead of emailed (copy them). Guests who book
    on the website don't receive their first password, so for guest tests use the "sign up in the app first" route
    in part 6.
  - **No card payments:** the website offers MTN / Orange mobile money only. That is expected.
- [ ] Top right, the key icon opens **Change password**. Change the super administrator password to one only you know.

## 1. People and roles

**HQ → Staff & departments**

- [ ] The **Departments** list already has Management, Front Office, Housekeeping, Maintenance, Wellness, Food &
      Beverage, Transport, Security, Finance and Human Resources.
- [ ] **Add department** → "Concierge". It appears in the list.
- [ ] **Add staff member** → name, your `+hr` email, role **HR Manager**, department Human Resources →
      save. Copy the temporary password if it is shown.
- [ ] Add a second member: your `+manager` email, role **Manager**, department Management.
- [ ] Add a third: your `+staff` email, role **Staff**, department Housekeeping.
- [ ] Edit one of them (change the job title). The change saves.
- [ ] Click the eye icon (**View as**) on the HR manager. A read-only session opens showing only HR. Try to change
      something: it is refused. A banner lets you return to HQ.

**HQ → Roles & permissions**

- [ ] **+ New role** → "Finance Director": tick **Finance: view** and **Approvals: view, approve** → **Create role**.
- [ ] Add a staff member with that role (your `+finance` email).

**Sign in as each new person** (private window, `/login`, temporary password, then choose a new one)

- [ ] HR manager: is asked to change the password, then sees **only the HR section**.
- [ ] Manager: lands in **FAY OS** (/manager). Opening /admin sends them back: HQ is not part of the Manager role.
- [ ] Finance Director: sees only **Finance** and **Approvals** in HQ.
- [ ] Staff: after choosing a password, stays on the website's account page with nothing to open. Expected: the
      staff app comes later.
- [ ] Back as super administrator: **HQ → Audit log** lists the staff you created and the role you added, with your
      name. **Sign-ins** shows each person's sign-in.

## 2. Residences (what guests book)

**HQ → Residences → Categories** → **Add Category**. Create at least two, for example:

| Field | Example 1 | Example 2 |
|---|---|---|
| Name (code) | `studio` | `one-bedroom` |
| Display name | Studio Residence | One Bedroom Residence |
| Base price (XAF per night) | 28000 | 45000 |
| Max guests | 2 | 3 |
| Bedrooms / bathrooms | 0 / 1 | 1 / 1 |
| Features | WiFi, Smart TV, Air conditioning | WiFi, Full kitchen, Balcony |
| Amenities | Pool, Gym | Pool, Gym, Concierge |

- [ ] Both appear in the list as active.

**Residences → Units & photos** → **Add Apartment**. Create the real units, for example two per category:

- [ ] Unit number (e.g. `A101`), category, floor, building. Leave the custom price empty to use the category price.
- [ ] Open a unit → **Upload New Media** → add 2–3 photos → then click **Set Primary** on the best one.
      **Only the primary photo shows on the website**; without it the website shows a striped placeholder.
- [ ] Optional: upload a **360°** panorama and a video tour for one unit.
- [ ] **Residences → Deposit boxes**: every unit already has a box (`DB-A101` …). You didn't create these; they come
      with each unit.

**Check on the website** (private window, not signed in)

- [ ] **/residences** shows your categories with the primary photo, "X available" and the right price per night and total.
- [ ] Change the dates and guests: totals update. Set guests above a category's maximum: it disappears.
- [ ] **Details** on a residence shows its photos (and 360° view if uploaded).

## 3. A website booking, paid by mobile money

As a guest, in a private window:

- [ ] **/residences** → dates a few days ahead → **Reserve** on a residence.
- [ ] Step 1, your details: name, your `+guest1` email, phone → **Continue**.
- [ ] Step 2: both boxes are needed before **Continue** works.
- [ ] Step 3: choose **MTN** (or Orange) → number → **Request payment**.
- [ ] Step 4: "Your booking is reserved", with a booking number `FAY-…`. Note it.
- [ ] Back on /residences with the same dates: that unit is no longer offered.

As super administrator:

- [ ] **HQ → Overview**: "Mobile money to confirm" shows 1 with the amount.
- [ ] **HQ → Finance** → the pending mobile money payment → **Mark received** → confirm. The message says the
      booking is confirmed and the key sent.
- [ ] **HQ → Bookings** → click the booking: status **confirmed**, with a door PIN, gate QR code and deposit box.
- [ ] If email is configured: `+guest1` receives the confirmation with the digital key and a first password.

**Hold expiry (optional, takes an hour):** start another booking, stop at the payment step and close the window.
After 60 minutes the residence is offered again for those dates.

## 4. Booking changes in HQ

**HQ → Bookings**, on the confirmed booking:

- [ ] **Check In** → status checked in. **Check Out** → checked out.
- [ ] Make a second booking (part 3) and **Cancel** it from HQ: the dates become free on the website.
- [ ] **Residences → Availability**: the calendar shows the bookings in their colours.

## 5. Wellness catalogue

**HQ → Wellness catalogue**

- [ ] **Activities**: the four journeys (Restore, Recharge, Reflect, Explore) and the services are there. Edit one:
      set a price (e.g. Massage Therapy 25000) and a description. Remove one and use **Offer again** to bring it back.
- [ ] **Add Activity**, e.g. "Aromatherapy", Spa, 50 minutes, 2 guests per session.
- [ ] **Availability** → **Create Availability**: Aromatherapy, a date range, a start time. The slots appear, each
      lasting the activity's duration, with capacity 0 / 2.
- [ ] **Zones** → add one (e.g. "Garden") — it appears in the list.

## 6. The guest app

Use the newest Faysha app build. Older builds work, but sign-up exists only in the new one.

**If email is not configured** (otherwise you can sign in with the password from the confirmation email):

- [ ] In the app, **sign up** with a new address (`+guest2`) and your own password.
- [ ] On the website, book with **that same email** (part 3) and confirm it in HQ → Finance. The stay is linked
      to the account you just made.

Then, signed in to the app as that guest:

- [ ] **Home / My stays**: the stay is there with the right dates.
- [ ] **Digital key**: door PIN, gate QR and deposit box (only once the stay is confirmed).
- [ ] **Wellness** → Restore → book a time: times already passed today are greyed out; booking succeeds; the journey
      gets a PIN on the Digital key screen. Book Massage Therapy at a time, then try the same time with a second
      guest: refused (one guest per session). Cancel a booking: it is marked cancelled.
- [ ] **Concierge chat**: send a message. In **FAY OS → Communications** (or HQ → Wellness → Concierge) it appears;
      reply, and the reply shows in the app.
- [ ] **Requests**: ask for towels. It appears in **FAY OS → Service Requests**.
- [ ] After **check-in** (HQ → Bookings → Check In, or FAY OS): **Dining** order from the menu; **Smart home**
      temperature and scenes; **Rides** ask for a transfer; **Bill** lists the charges.
- [ ] **Book a stay** in the app (mobile money): same as the website; confirm it in HQ → Finance.

## 7. FAY OS (operations), signed in as the manager

- [ ] **Guest 360**: the guests from parts 3 and 6, with stays, value and timeline. Add a note.
- [ ] **Reservations** → new reservation for an existing guest; try overlapping dates on the same unit: refused.
- [ ] **Today's arrivals / departures**: check a guest in and out.
- [ ] **Service Requests**: move the towels request to In Progress → Completed.
- [ ] **Housekeeping**: add a task, complete it. **Maintenance**: add a work order.
- [ ] **Dining**: add menu items (the guest app's menu comes from here); see the guest's order and move it to
      Preparing → Ready → Delivered.
- [ ] **Transportation**: add a vehicle and a driver; assign the guest's transfer.
- [ ] **Experiences**: add an experience with a price and capacity; book it for a guest.
- [ ] **Wellness & Spa**: the app bookings appear; add an appointment for a guest.
- [ ] **Settings → Property**: phone and email; save.

## 8. HR (signed in as the HR manager)

- [ ] **Employees → Add Employee**: name, email, job title, department; keep "create user account" ticked. The
      success message shows the sign-in email and a one-time password (never `employee123`).
- [ ] Edit the employee: the change saves and the status stays **active**.
- [ ] **Recruitment → Create Job Posting**: e.g. "Front Office Agent", department, description, status Open.
- [ ] On the website (private window): **/careers** shows the job. Apply with a **PDF** CV. Try a .jpg instead:
      refused with "Only PDF, DOC and DOCX".
- [ ] **Applications**: the application is there. Open it → **Download CV** (the PDF downloads). Move it through
      Reviewed → Shortlisted → Interviewed → Hired (or Rejected) with review notes.
- [ ] **Attendance**: today's list loads.
- [ ] **Leave**: the tabs load. *There is no screen yet where an employee requests leave* (that comes with the staff
      app), so approving leave can't be tested from the UI.

## 9. Money and approvals (as the Finance Director)

- [ ] **Finance**: revenue for the stays so far, money collected by method, and the payments list. **Export CSV** downloads.
- [ ] **Approvals → Add request**: an expense, e.g. "Pool chemicals, 120 000 XAF".
- [ ] Approve it. As super administrator, **Audit log** shows who approved it.

## 10. Website forms

- [ ] **/feedback**: submit a testimonial with 5 stars. In **HQ → Feedback**: open it → **Approve & Feature**. It
      appears on the home page.
- [ ] **/contact**: send a message. If email is configured, it arrives at the contact address.
- [ ] **/login → Forgot password** (needs email): the reset link works.
- [ ] Switch **EN / FR** on a few pages.
- [ ] **HQ → Website content**: change a sentence on the home page; it shows on the live site.

## Afterwards

The test bookings, guests and staff stay in the database. Before opening to real guests, either cancel and
deactivate them in HQ, or start again from an empty database: create a new database and run `db/setup.js` as in
docs/DEPLOY.md step 4, then point `DB_NAME` at it.

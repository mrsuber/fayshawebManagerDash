# FAY OS — Faysha Wellness Residence dashboard

React + Vite + TypeScript implementation of the FAY OS Claude Design handoff (`FAY OS.dc.html` and its 15 page files).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Structure

```
src/
  main.tsx              entry (BrowserRouter)
  App.tsx               routes — one per page; "/" redirects to the last page visited
  styles.css            design tokens (:root vars) + shared classes (card, chip, tab, toggle, kpi…)
  data/pages.ts         page titles/subtitles/taglines, sidebar order, top-nav groups
  components/
    Layout.tsx          sidebar, top nav, hero header, <Outlet/>
    ui.tsx              shared primitives: Card, KpiGrid, Toggle, Bar, Donut, Chip, QuickActions, Placeholder…
  pages/                one file per screen (Guest360, GuestJourney, Communications, ServiceRequests,
                        Reservations, Residences, Housekeeping, Maintenance, Wellness, Dining,
                        Transportation, Experiences, Analytics, AICommand, Settings)
```

| Route           | Page                          | Design file                 |
|-----------------|-------------------------------|-----------------------------|
| `/guest360`     | Guest 360                     | `Guest360.dc.html`          |
| `/journey`      | Guest Journey                 | `GuestJourney.dc.html`      |
| `/comms`        | Communications Center         | `Communications.dc.html`    |
| `/requests`     | Service Requests & Operations | `ServiceRequests.dc.html`   |
| `/reservations` | Reservations Management       | `Reservations.dc.html`      |
| `/residences`   | Residences & Smart Home       | `Residences.dc.html`        |
| `/housekeeping` | Housekeeping                  | `Housekeeping.dc.html`      |
| `/maintenance`  | Maintenance                   | `Maintenance.dc.html`       |
| `/wellness`     | Wellness & Spa                | `Wellness.dc.html`          |
| `/dining`       | Dining Management             | `Dining.dc.html`            |
| `/transport`    | Transportation                | `Transportation.dc.html`    |
| `/experiences`  | Experiences                   | `Experiences.dc.html`       |
| `/analytics`    | Analytics                     | `Analytics.dc.html`         |
| `/ai`           | FAY AI Command Center         | `AICommand.dc.html`         |
| `/settings`     | Settings                      | `Settings.dc.html`          |

## Data

Every page keeps its sample data as constants at the top of the file under
`// Mock data — replace with API calls.` Swap those for fetches/hooks when the backend exists.

## Interactions carried over from the prototype

- Communications: pick a thread, switch channels, type + send (Enter or Send), "Use" an AI suggested reply.
- Service Requests: filter by department, select a row, "Mark as Completed".
- Reservations: tabs and Month/Week/Day toggles (visual state only).
- Residences: pick a residence, scenes, per-device toggles, climate −/+ (16–30°).
- Housekeeping: tap a non-occupied residence to advance Dirty → Cleaning → Inspect → Ready.
- Dining: venue filter on reservations; tap a table to cycle its status (legend counts update).
- Experiences / Analytics: category and date-range chips.
- AI Command: canned answers for the suggested prompts, free-text fallback, mic on/off.
- Guest Journey / Settings: working toggles.

## Placeholders

Photos are striped placeholders labelled with what goes there (e.g. "guest portrait", "residence photo").
Icons use the Material Symbols Outlined font; type faces are Cormorant Garamond (headings) and Jost (body).

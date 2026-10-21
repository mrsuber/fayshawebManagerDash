# Faysha HQ — API

Faysha HQ (`frontend/src/admin`, served at `/admin`) talks to `/api/admin/*` (`backend/routes/admin`).
The client is `frontend/src/admin/api.js`.

Database: `backend/db/schema.sql`, created by `node db/setup.js` (see docs/DEPLOY.md).

## Access

Every route needs a signed-in user (`Authorization: Bearer <jwt>`) whose role grants the route's **HQ area**
(`backend/middleware/hq.js`):

| Area | view | manage | approve |
|---|---|---|---|
| `overview` | Overview | — | — |
| `finance` | revenue, payments | — | mark payments received |
| `approvals` | the queue | — | decide |
| `staff` | staff, departments | invite, edit, deactivate, reset passwords | — |
| `roles` | roles | create, edit, delete | — |
| `hr` | HR pages and `/api/employees`, `/attendance`, `/leave`, job management | change HR records | decide leave |
| `properties` | properties | add, edit | — |
| `website` | Page Management | edit content | — |
| `audit` | audit log, sign-ins | — | — |

Grants live in `roles.permissions`, e.g. `{"finance": {"view": true, "approve": true}}`. Super administrators have
every area. `manage` or `approve` imply `view`. Older keys still count: `pages`/`content` open `website`, and
`users` opens `staff`.

Errors are `{ "message": "…" }` with the HTTP status: 401 not signed in, 403 no access, 409 conflict.

## View as (read-only sessions)

`POST /api/admin/staff/:id/view-as` (super administrators only) returns `{ token, user, expiresAt }`, a 30-minute
JWT for that person carrying `imp: <super administrator id>`. With that token, `middleware/auth.js` refuses every
non-GET request on every route. Public routes treat the token as signed out (`userFromRequest`), and sockets get
no staff channel. The frontend keeps the super administrator's own token aside and shows a "Return to HQ"
banner (`src/admin/viewAs.js`, `components/ViewAsBanner.jsx`).

## Audit trail

`middleware/hq.js#auditTrail` runs for all of `/api`. After every successful POST, PUT, PATCH or DELETE by a
signed-in user it writes a row to `audit_log`: actor, role, view-as origin, method, path, area, entity, id,
action and a readable summary such as "Check in reservations #12". It skips notification reads, device tokens,
sign-in and password endpoints, and AI questions. A failed write is logged and never affects the request.

## Routes

| Method | Path | Area | Notes |
|---|---|---|---|
| GET | `/me` | any | `{ user, areas, can, legacy, viewAs }`; 403 if the role has no area |
| GET | `/overview?property=` | overview | stays today, revenue (today, month to date vs last month, by stream, 14-day trend), approvals, mobile money, operations, staff, alerts, recent activity |
| GET | `/revenue?from=&to=&property=` | finance | earned per day and by stream, previous period and change, by residence type, collected by method, occupancy, ADR, RevPAR (at most 2 years) |
| GET | `/payments?status=&method=&q=&limit=` | finance | payments with booking and guest; mobile money provider and payer number |
| POST | `/payments/:id/mark-paid` `{ reference? }` | finance · approve | pending non-card payment → completed. The client then confirms the booking (`POST /api/bookings/:id/confirm`, which needs a super administrator or manager) to send the key |
| GET | `/approvals?status=pending\|approved\|rejected\|all` | approvals | approvals rows plus leave requests (`id: "leave-<id>"`) |
| POST | `/approvals` `{ type, title, detail, amount, referenceType, referenceId }` | super administrator, manager, or approvals | types: refund (needs `referenceType: "payment"`), discount, expense, purchase, other |
| POST | `/approvals/:id/decide` `{ decision: approved\|rejected, note }` | approvals · approve | refunds run `processRefund`; leave runs `decideLeave`. A request can't be approved twice, and non-super administrators can't approve their own |
| GET | `/staff` | staff | every non-guest account with role, department, property and HR record |
| POST | `/staff` `{ name, email, roleId, department, jobTitle, propertyId, phone }` | staff · manage | emails a temporary password; returns it once in `tempPassword` when email fails |
| PATCH | `/staff/:id` | staff · manage | name, roleId, department, jobTitle, propertyId, phone, status `active\|inactive`. Not your own role or status; only super administrators touch super administrators |
| POST | `/staff/:id/reset-password` | staff · manage | new temporary password, must change on sign-in, unlocks |
| POST | `/staff/:id/view-as` | super administrator | see above |
| GET / POST / PATCH | `/departments`, `/departments/:id` | staff (· manage) | departments with staff and HR counts |
| GET / POST / PATCH / DELETE | `/roles`, `/roles/:id` | roles (· manage) | super administrator role is fixed; built-in roles can't be deleted; roles with members can't be deleted |
| GET | `/audit?q=&area=&from=&to=&viewAs=&limit=&offset=` | audit | `{ total, areas, items }` |
| GET | `/audit/sign-ins` | audit | last 100 staff sign-ins (successful and failed) |
| GET | `/properties` | any HQ user | with unit and staff counts |
| POST / PATCH | `/properties`, `/properties/:id` | properties · manage | code, name, city, country, address, timezone, currency, status `active\|opening\|inactive`, openedOn |

## Shared logic changed for HQ

- `routes/payments.js#processRefund` is used by `POST /api/payments/:id/refund` and by approvals.
- `routes/leave.js#decideLeave` is used by `PUT /api/leave/:id/approve|reject` and by approvals. The approver is
  now the signed-in user (v1 trusted an `approved_by` field from the browser), and a request that is no longer
  pending can't be decided again (v1 deducted the leave balance a second time).

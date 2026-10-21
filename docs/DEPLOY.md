# Deploying Faysha v2 to the VPS

v2 replaces v1 on the same server: same PM2 process and nginx site, and a **new database** built from
`backend/db/schema.sql`. The old database is left untouched (not used by v2), so rolling back is a one-line change.

| | |
|---|---|
| SSH | `ssh -i ~/.ssh/id_rsa_divisionalofficer -p 2222 divisionalofficeruser@76.13.41.99` |
| App folder | `/home/divisionalofficeruser/fayshaa` (`backend/`, `frontend/build/`) — confirm with `pm2 describe` |
| Backend | PM2 process `fayshaa` (older notes say `fayshaa-backend`; check `pm2 list`), port from `backend/.env` (`PORT`, 3000 in v1) |
| Website | static files in `frontend/build/`, served by nginx, which proxies `/api`, `/socket.io` and `/uploads` to the backend |
| Database | PostgreSQL; name and credentials in `backend/.env` (`DB_NAME`). v2 uses a new database, e.g. `fayshaa_v2` |

## 1. Look before changing anything

```bash
pm2 list && pm2 describe <name>          # name, cwd, script, node version
node -v                                  # needs 18+ (v1 server: 20)
grep -n "root\|proxy_pass\|location" /etc/nginx/sites-enabled/*fayshaa*   # where the build is served from
ls ~/fayshaa/backend/.env ~/fayshaa/backend/uploads
```

## 2. Back up

```bash
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p ~/backups/$STAMP
set -a; . ~/fayshaa/backend/.env; set +a
PGPASSWORD="$DB_PASSWORD" pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" "$DB_NAME" | gzip > ~/backups/$STAMP/db.sql.gz
tar --exclude=node_modules --exclude=uploads -czf ~/backups/$STAMP/backend.tgz -C ~/fayshaa backend
tar -czf ~/backups/$STAMP/frontend-build.tgz -C ~/fayshaa/frontend build
```

## 3. Backend

From a local clone of `mrsuber/fayshawebManagerDash` on the branch being deployed:

```bash
rsync -avz -e "ssh -i ~/.ssh/id_rsa_divisionalofficer -p 2222" \
  --exclude node_modules --exclude .env --exclude uploads --exclude 'config/firebase-service-account.json' \
  backend/ divisionalofficeruser@76.13.41.99:/home/divisionalofficeruser/fayshaa/backend/
```

Never use `--delete` (it would remove uploads and server-only files). The old `backend/migrations/` folder stays on
the server unused; delete it if you like. On the server:

```bash
cd ~/fayshaa/backend && npm ci --omit=dev
```

Add any of these to `backend/.env` that are missing (keep existing values; see `.env.example`):

```
PROPERTY_TZ=Africa/Douala
APP_URL=https://fayshaa.com
CONTACT_EMAIL=            # contact form recipient (defaults to EMAIL_FROM)
PROPERTY_WIFI_SSID=       # shown with the digital key
PROPERTY_WIFI_PASSWORD=
STRIPE_WEBHOOK_SECRET=    # if the Stripe webhook is used
SOCKET_REQUIRE_AUTH=false # keep false until every guest has the new app
RATE_LIMIT_MAX_REQUESTS=3000   # v1 used 100, which the dashboards exceed within minutes (HTTP 429)
AUTH_RATE_LIMIT_MAX=30         # sign-in and password attempts per IP per 15 minutes
```

**Change `RATE_LIMIT_MAX_REQUESTS` if it is set to 100**, or remove the line (the default is 3000). Optional:
`CORS_ORIGIN` (extra browser origins; fayshaa.com and www.fayshaa.com are built in), `CARD_HOLD_MINUTES` (default 60)
and `MOBILE_MONEY_HOLD_HOURS` (default 48) — how long an unpaid booking holds its residence.

## 4. Database

Needs PostgreSQL 13 or later (the schema uses the `btree_gist` extension to prevent double bookings; the
database owner can enable it). Check with `psql --version`.

Create a new, empty database for v2, point `.env` at it and let setup build it:

```bash
cd ~/fayshaa/backend
set -a; . ./.env; set +a
PGPASSWORD="$DB_PASSWORD" psql -h "${DB_HOST:-localhost}" -U "$DB_USER" -d postgres -c "CREATE DATABASE fayshaa_v2"
#   (if the user may not create databases: sudo -u postgres createdb -O "$DB_USER" fayshaa_v2)
sed -i 's/^DB_NAME=.*/DB_NAME=fayshaa_v2/' .env
SEED_ADMIN_EMAIL=<your email> SEED_ADMIN_PASSWORD='<a strong password>' NODE_ENV=production node db/setup.js
```

Setup creates the schema, the base data (the property, roles, settings, HR departments and leave types, the
wellness catalogue) and the first super administrator. Without `SEED_ADMIN_PASSWORD` it prints a one-time
password that must be changed at first sign-in. Running it again later is safe: it only adds what is missing.

Then, in HQ: **Residences → Categories** and **Units & photos** (each unit gets its deposit box automatically),
**Staff & departments** to invite the team, and **HR** for employees. Until a residence exists the website
says no residence matches the dates.

`npm run check:sql` (from `backend/`) checks every SQL statement in the code against the database; it should
report 0 failed.

## 5. Restart

```bash
pm2 restart <name> --update-env && pm2 save
pm2 logs <name> --lines 60 --nostream
```

## 6. Website and dashboards

Build locally and upload the build (the server doesn't need to build):

```bash
cd frontend && npm ci
REACT_APP_API_URL=/api REACT_APP_STRIPE_PUBLISHABLE_KEY=<publishable key> npm run build
rsync -avz -e "ssh -i ~/.ssh/id_rsa_divisionalofficer -p 2222" build/ \
  divisionalofficeruser@76.13.41.99:/home/divisionalofficeruser/fayshaa/frontend/build/
```

Use the folder nginx actually serves (step 1).

## 7. Check

```bash
curl -s https://fayshaa.com/health
curl -s -o /dev/null -w "%{http_code}\n" https://fayshaa.com/            # 200
curl -s -o /dev/null -w "%{http_code}\n" https://fayshaa.com/manager     # 200
curl -s -o /dev/null -w "%{http_code}\n" https://fayshaa.com/admin       # 200
curl -s "https://fayshaa.com/api/apartments/categories?active_only=true" | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" https://fayshaa.com/api/guest/overview   # 401 (route exists, needs sign-in)
curl -s -X POST https://fayshaa.com/api/auth/register -H 'content-type: application/json' -d '{}'   # 400 (route exists)
```

Then sign in at `/login` as a super administrator and open `/admin` and `/manager`.

## Roll back

```bash
cd ~/fayshaa && rm -rf backend.new && mkdir backend.new && tar -xzf ~/backups/<STAMP>/backend.tgz -C backend.new
rsync -a --exclude node_modules --exclude uploads backend.new/backend/ backend/ && (cd backend && npm ci --omit=dev)
tar -xzf ~/backups/<STAMP>/frontend-build.tgz -C frontend
pm2 restart <name> --update-env
```

v2 never touches the old database. To go back, restore the old backend and build as above, set `DB_NAME` in
`backend/.env` back to the old database, and restart.

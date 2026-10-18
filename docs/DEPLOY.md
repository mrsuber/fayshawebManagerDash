# Deploying Faysha v2 to the VPS

v2 replaces v1 in place on the same server: same database, same PM2 process, same nginx site.

| | |
|---|---|
| SSH | `ssh -i ~/.ssh/id_rsa_divisionalofficer -p 2222 divisionalofficeruser@76.13.41.99` |
| App folder | `/home/divisionalofficeruser/fayshaa` (`backend/`, `frontend/build/`) — confirm with `pm2 describe` |
| Backend | PM2 process `fayshaa` (older notes say `fayshaa-backend`; check `pm2 list`), port from `backend/.env` (`PORT`, 3000 in v1) |
| Website | static files in `frontend/build/`, served by nginx, which proxies `/api`, `/socket.io` and `/uploads` to the backend |
| Database | PostgreSQL `fayshaa`; credentials in `backend/.env` |

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

Never use `--delete` (it would remove uploads and server-only files). On the server:

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
```

## 4. Database migrations

All three are additive and safe to re-run (019 is superseded by 020 — don't run it):

```bash
cd ~/fayshaa/backend
node migrations/run.js 020_create_manager_operations.sql   # FAY OS tables
node migrations/run.js 021_create_hq.sql                   # HQ: properties, audit log, approvals, HR Manager role
node migrations/run.js 022_align_wellness_schema.sql       # wellness tables for the app and FAY OS
```

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

The migrations only add tables and columns, so the v1 code keeps working on the migrated database; restore
`db.sql.gz` only if data itself went wrong.

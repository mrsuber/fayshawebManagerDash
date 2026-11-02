# Deploying with a local AI assistant

Paste the prompt below into the AI coding assistant on your computer (for example Claude Code), opened in a clone
of this repository on `main`. The assistant needs the SSH key in `~/.ssh/id_rsa_divisionalofficer`. It works
from [DEPLOY.md](DEPLOY.md) and stops to ask you before anything that cannot be undone.


## Updating a running site (v2.1 and later)

Use this prompt when Faysha v2 is already live and you are deploying a newer `main` (for example v2.1). The database is
kept and brought up to date with migrations; nothing is recreated.

```text
Update the live Faysha platform to the latest main of this repository. Faysha v2 is already running in production
with its database (DB_NAME in backend/.env, normally fayshaa_v2). This is an UPDATE: keep the database, apply the new
migrations, deploy the new backend and website. Read docs/DEPLOY.md and docs/V2_1_GUIDE.md (section 11) in full first.

Server: ssh -i ~/.ssh/id_rsa_divisionalofficer -p 2222 divisionalofficeruser@76.13.41.99
App folder: /home/divisionalofficeruser/fayshaa (confirm with `pm2 describe`)

Rules:
- Work step by step and show me the output of every command you run on the server.
- Never drop, recreate or reset the database. Never run db/setup.js with --reset or --demo, and never `npm run db:reset`.
- Never use rsync --delete. Never overwrite backend/.env, backend/uploads or config/firebase-service-account.json.
- Never print secrets from backend/.env; mask values when you show it.
- Stop and ask me before: applying migrations, restarting PM2, changing nginx, and whenever something does not match
  what the docs expect (folder, PM2 name, Node older than 18, PostgreSQL older than 13, a failing command,
  check:sql reporting any failure, a migration failing).
- If anything fails after the restart, follow "Roll back" in docs/DEPLOY.md (restore the backend and build from the
  backup, and the database from the dump taken in step 3) and tell me.

Steps:
1. Locally: git checkout main && git pull. Run `cd backend && npm ci && npm test` and
   `cd frontend && npm ci && npm run test:ci`. Stop if anything fails.
2. On the server, "1. Look before changing anything": report the PM2 process name and cwd, Node version,
   psql --version, DB_NAME from .env (name only), the folder nginx serves the website from, and the current
   client_max_body_size in the nginx site (or that it is not set).
   Also show which migrations the database already has:
   psql … -c "SELECT name FROM schema_migrations ORDER BY name"  (the table may not exist yet: that is expected
   before v2.1).
3. Back up (docs/DEPLOY.md "2. Back up"): the full database dump with host, port and user from .env,
   backend.tgz and the current website build. Show me the files and their sizes. Do not continue if the
   database dump is empty or tiny.
4. Backend: rsync backend/ with the exclusions in docs/DEPLOY.md "3. Backend" (no --delete), then on the server
   `npm ci --omit=dev`. Compare backend/.env with backend/.env.example and list the missing variable NAMES only.
   These new ones are optional and may stay empty: GATE_WEBHOOK_URL, GATE_WEBHOOK_SECRET, MONITOR_DISABLED.
   Make sure PROPERTY_TZ=Africa/Douala and APP_URL=https://fayshaa.com are set. Show me a masked diff of .env.
5. Ask me, then apply the migrations: cd backend && NODE_ENV=production node db/setup.js
   It must print "Applying migration 001_…" up to "011_…" (only the ones not yet applied) and "Base data is in place",
   with no "Setup failed". Then `npm run check:sql`: it must say 0 failed. If a migration fails, stop: nothing
   from that migration is applied (each runs in a transaction); show me the error.
6. Ask me, then nginx: in the fayshaa server block set `client_max_body_size 25m;` (add it if missing), then
   `sudo nginx -t` and only if the test passes `sudo systemctl reload nginx`.
7. Ask me, then "5. Restart": pm2 restart <name> --update-env && pm2 save. Show the last 60 log lines. There must be
   no errors other than Firebase or email not being configured. Within about a minute there should be no
   "Monitor rule … failed" lines; if there are, show them to me.
8. Website: build locally with REACT_APP_API_URL=/api (ask me for the Stripe publishable key, or keep the one used
   last time if I give it, or leave it empty) and rsync frontend/build/ to the folder nginx serves (step 2).
9. Check, and show every result:
   - https://fayshaa.com/ , /residences , /events , /stories , /terms load (HTTP 200).
   - https://fayshaa.com/api/content/places and /api/content/stay-policy return JSON (200).
   - https://fayshaa.com/api/content/legal/terms returns version 1 or later.
   - https://fayshaa.com/api/manager/events returns 401 (not 500) without a token.
   - https://fayshaa.com/api/admin/overview returns 401.
   - An uploaded residence photo URL from /api/apartments/categories (primary_image) opens with 200.
10. Report: what was done, the backup folder name, the migrations applied, anything that needs my attention
    (email or Stripe not configured, missing .env values, nginx not changed).

After you finish, remind me to do the setup list in docs/V2_1_GUIDE.md section 11, step 4 (stay times, currencies,
terms review, estate photos, wellness catalogue, lockers, assets, visitor settings, inspection checklist), and that the
guest app needs a new build to get the v2.1 app features.
```

## First installation of v2

---

```text
Deploy the Faysha platform (this repository, branch main) to the production server, following docs/DEPLOY.md
exactly. Read docs/DEPLOY.md in full before you start.

Server: ssh -i ~/.ssh/id_rsa_divisionalofficer -p 2222 divisionalofficeruser@76.13.41.99
App folder: /home/divisionalofficeruser/fayshaa (confirm with `pm2 describe`)

Rules:
- Work step by step and show me the output of every command you run on the server.
- Never delete or modify the existing database, and never use rsync --delete.
- Never print or commit secrets from backend/.env (passwords, keys). When you need to show .env, mask values.
- Stop and ask me before: restarting PM2, changing nginx, and if anything in a step does not match what
  docs/DEPLOY.md expects (different folder, process name, Node older than 18, PostgreSQL older than 13,
  a failing command, or check:sql reporting any failure).
- If a step fails after the restart, follow "Roll back" in docs/DEPLOY.md and tell me.

Steps:
1. Locally: git checkout main && git pull. Run `cd frontend && npm ci && npm run test:ci` and
   `cd backend && npm ci && npm test`. Stop if anything fails.
2. On the server: do "1. Look before changing anything" and report the PM2 process name, its cwd,
   Node version, PostgreSQL version (psql --version), and the folder nginx serves the website from.
3. Do "2. Back up" and show me the backup files with their sizes.
4. Do "3. Backend": rsync backend/ (with the exclusions in the doc), then `npm ci --omit=dev` on the server.
   Check backend/.env for the variables listed there and add the missing ones. If RATE_LIMIT_MAX_REQUESTS is 100,
   set it to 3000. Show me a masked diff of .env.
5. Do "4. Database": create the new database fayshaa_v2, point DB_NAME at it, and run db/setup.js with
   NODE_ENV=production. Ask me for the super administrator email first, and generate a strong password
   (at least 16 characters) for SEED_ADMIN_PASSWORD; give it to me once at the end, nowhere else.
   Then run `npm run check:sql` on the server: it must say 0 failed.
6. Ask me, then do "5. Restart". Show the last 60 log lines; there must be no errors other than Firebase
   or email not being configured.
7. Do "6. Website and dashboards": build locally with REACT_APP_API_URL=/api (ask me for the Stripe publishable
   key, or leave it empty if card payments are not set up yet) and rsync the build to the folder nginx serves.
8. Do "7. Check" and show every result. Also confirm that https://fayshaa.com/api/admin/overview returns 401
   (not 500) and that https://fayshaa.com/api/wellness-unified/activities returns 401.
9. Report: what was done, the backup folder name, the new super administrator email and password, and
   anything that needs my attention (for example email or Stripe not configured).

After you finish, remind me to sign in at https://fayshaa.com/login, change nothing else, and then add the
residences in HQ → Residences → Categories and Units & photos.
```

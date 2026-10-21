# Deploying with a local AI assistant

Paste the prompt below into the AI coding assistant on your computer (for example Claude Code), opened in a clone
of this repository on `main`. The assistant needs the SSH key in `~/.ssh/id_rsa_divisionalofficer`. It works
from [DEPLOY.md](DEPLOY.md) and stops to ask you before anything that cannot be undone.

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

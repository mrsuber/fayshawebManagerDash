/**
 * Manager-side services: who am I, notifications, settings (property, preferences, team,
 * integrations), analytics, FAY AI and card payments.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, ah, httpError, isoDate, isoTime, notify, getSetting } = require('./lib');
const { crud } = require('./crud');
const { folioOf } = require('./guests');
const { guestRow } = require('./guestData');

const router = express.Router();

// ---------------- Auth ----------------

router.get('/auth/me', (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.fullName, email: req.user.email, role: req.user.role } });
});

// ---------------- Notifications ----------------

router.get(
  '/notifications',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT n.*, (r.user_id IS NOT NULL) AS read FROM staff_notifications n
         LEFT JOIN staff_notification_reads r ON r.notification_id = n.id AND r.user_id = $1
        WHERE n.user_id IS NULL OR n.user_id = $1
        ORDER BY n.created_at DESC LIMIT 100`,
      [req.user.id],
    );
    res.json(rows.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: isoTime(n.created_at), read: n.read })));
  }),
);

router.patch(
  '/notifications/read-all',
  ah(async (req, res) => {
    await db.query(
      `INSERT INTO staff_notification_reads (notification_id, user_id)
       SELECT id, $1 FROM staff_notifications WHERE user_id IS NULL OR user_id = $1
       ON CONFLICT DO NOTHING`,
      [req.user.id],
    );
    res.json({ ok: true });
  }),
);

/** POST { token, platform } — stores this browser's FCM token for staff pushes. */
router.post(
  '/notifications/device-token',
  ah(async (req, res) => {
    const { token, platform = 'web' } = req.body || {};
    if (!token) throw httpError(400, 'token is required');
    await db.query(
      `INSERT INTO fcm_tokens (user_id, token, platform, is_active) VALUES ($1, $2, $3, true)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, is_active = true, updated_at = NOW()`,
      [req.user.id, token, ['web', 'ios', 'android'].includes(platform) ? platform : 'web'],
    );
    res.json({ ok: true });
  }),
);

router.post(
  '/notifications/test',
  ah(async (req, res) => {
    await notify(req, 'Test notification', 'Your notification settings work 🎉', { userId: req.user.id });
    res.json({ ok: true });
  }),
);

// ---------------- Settings ----------------

router.get(
  '/settings/property',
  ah(async (req, res) => res.json(await getSetting('property'))),
);

router.put(
  '/settings/property',
  ah(async (req, res) => {
    const keys = ['name', 'brand', 'timeZone', 'currency', 'checkInTime', 'checkOutTime', 'phone', 'email'];
    const value = Object.fromEntries(keys.map((k) => [k, req.body?.[k] ?? '']));
    if (!value.name) throw httpError(400, 'Property name is required');
    await db.query(
      `INSERT INTO app_settings (key, value, updated_by) VALUES ('property', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2`,
      [JSON.stringify(value), req.user.id],
    );
    res.json(value);
  }),
);

router.get(
  '/settings/preferences',
  ah(async (req, res) => res.json(await getSetting('preferences'))),
);

/** PATCH { ai?, notifications?, billing? } — each group is merged into what's stored. */
router.patch(
  '/settings/preferences',
  ah(async (req, res) => {
    const current = await getSetting('preferences');
    for (const group of ['ai', 'notifications', 'billing']) {
      if (req.body?.[group] && typeof req.body[group] === 'object') current[group] = { ...(current[group] || {}), ...req.body[group] };
    }
    await db.query(
      `INSERT INTO app_settings (key, value, updated_by) VALUES ('preferences', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2`,
      [JSON.stringify(current), req.user.id],
    );
    res.json(current);
  }),
);

// ---- Team = staff user accounts (the same users /admin → User Management lists) ----

const MANAGER_TITLES = ['Administrator', 'General Manager'];
const TEAM_STATUS = (u) => (u.status !== 'active' ? 'Deactivated' : u.must_change_password && !u.last_login ? 'Invited' : 'Active');

const TEAM_SELECT = `
  SELECT u.id, u.full_name, u.email, u.job_title, u.department, u.status, u.must_change_password, u.last_login, r.name AS role_name, r.display_name AS role_display
    FROM users u JOIN roles r ON r.id = u.role_id
   WHERE u.deleted_at IS NULL AND r.name IN ('manager', 'staff', 'superadmin')`;

const toMember = (u) => ({
  id: u.id,
  name: u.full_name,
  email: u.email,
  role: u.job_title || (u.role_name === 'superadmin' ? 'Administrator' : u.role_display),
  department: u.department || (u.role_name === 'staff' ? '' : 'Management'),
  status: TEAM_STATUS(u),
  systemRole: u.role_name,
});

async function member(id) {
  const { rows } = await db.query(`${TEAM_SELECT} AND u.id = $1`, [id]);
  if (!rows.length) throw httpError(404, 'Team member not found');
  return rows[0];
}

router.get(
  '/settings/team',
  ah(async (req, res) => {
    const { rows } = await db.query(`${TEAM_SELECT} ORDER BY r.name = 'superadmin' DESC, u.full_name`);
    res.json(rows.map(toMember));
  }),
);

/** POST { name, email, role, department } — creates the account and emails a one-time password. */
router.post(
  '/settings/team',
  ah(async (req, res) => {
    const { name, email, role = 'Staff', department = '' } = req.body || {};
    if (!name || !email) throw httpError(400, 'name and email are required');
    const exists = await db.query('SELECT id, deleted_at FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (exists.rows.length) throw httpError(409, 'A user with this email already exists');
    const roleName = MANAGER_TITLES.includes(role) ? 'manager' : 'staff';
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const username = `${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}_${crypto.randomInt(1000, 9999)}`;
    const { rows } = await db.query(
      `INSERT INTO users (email, username, password_hash, full_name, role_id, status, email_verified, is_password_temporary, must_change_password, created_by, job_title, department)
       VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5), 'active', true, true, true, $6, $7, $8) RETURNING id`,
      [email.toLowerCase(), username, await bcrypt.hash(tempPassword, 10), name, roleName, req.user.id, role, department],
    );
    const emailService = require('../../services/email.service');
    const loginUrl = `${process.env.APP_URL || 'https://fayshaa.com'}/login`;
    emailService
      .sendEmail({
        to: email,
        subject: 'You have been invited to FAY OS',
        text: `Hello ${name},\n\nYou have been added to the Faysha team as ${role}.\nSign in at ${loginUrl} with:\n  Email: ${email}\n  Temporary password: ${tempPassword}\n\nYou will be asked to choose a new password.`,
        html: `<p>Hello ${name},</p><p>You have been added to the Faysha team as <b>${role}</b>.</p><p>Sign in at <a href="${loginUrl}">${loginUrl}</a> with<br>Email: ${email}<br>Temporary password: <code>${tempPassword}</code></p><p>You will be asked to choose a new password.</p>`,
      })
      .catch((e) => console.error('Team invite email failed:', e.message));
    res.status(201).json(toMember(await member(rows[0].id)));
  }),
);

/** PATCH { name?, role?, department?, status? } (status: Active | Deactivated) */
router.patch(
  '/settings/team/:id',
  ah(async (req, res) => {
    const target = await member(req.params.id);
    if (target.role_name === 'superadmin' && req.user.role !== 'superadmin') throw httpError(403, 'Only a super administrator can change this account');
    const { name, role, department, status } = req.body || {};
    if (status === 'Deactivated' && Number(req.params.id) === req.user.id) throw httpError(400, "You can't deactivate your own account");
    const sets = [];
    const params = [];
    const set = (sql, v) => {
      params.push(v);
      sets.push(`${sql} = $${params.length}`);
    };
    if (name) set('full_name', name);
    if (department !== undefined) set('department', department);
    if (role) {
      set('job_title', role);
      if (target.role_name !== 'superadmin') {
        params.push(MANAGER_TITLES.includes(role) ? 'manager' : 'staff');
        sets.push(`role_id = (SELECT id FROM roles WHERE name = $${params.length})`);
      }
    }
    if (status === 'Deactivated') set('status', 'inactive');
    if (status === 'Active') set('status', 'active');
    if (sets.length) {
      params.push(req.params.id);
      await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    }
    res.json(toMember(await member(req.params.id)));
  }),
);

router.delete(
  '/settings/team/:id',
  ah(async (req, res) => {
    const target = await member(req.params.id);
    if (Number(req.params.id) === req.user.id) throw httpError(400, "You can't remove your own account");
    if (target.role_name === 'superadmin') throw httpError(403, 'Super administrator accounts are managed in /admin');
    await db.query("UPDATE users SET deleted_at = NOW(), status = 'inactive' WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  }),
);

// ---- Integrations: stored rows plus live status of what this server is configured with ----

function liveIntegrations() {
  const firebaseReady = (() => {
    try {
      return Boolean(require('../../config/firebase').getFirebaseApp());
    } catch {
      return false;
    }
  })();
  return [
    { id: 'smtp', icon: 'mail', name: 'Email (SMTP)', detail: 'Nodemailer · confirmations & invites', status: process.env.SMTP_USER ? 'Connected' : 'Disconnected', managed: true },
    { id: 'stripe', icon: 'payments', name: 'Payments (Stripe)', detail: 'Card payments & deposits', status: process.env.STRIPE_SECRET_KEY ? (process.env.STRIPE_WEBHOOK_SECRET ? 'Connected' : 'Action needed') : 'Disconnected', managed: true },
    { id: 'firebase', icon: 'notifications_active', name: 'Push Notifications (Firebase)', detail: 'Staff & guest app alerts', status: firebaseReady ? 'Connected' : 'Disconnected', managed: true },
    { id: 'claude', icon: 'smart_toy', name: 'FAY AI (Claude)', detail: 'Answers in the AI Command Center', status: process.env.ANTHROPIC_API_KEY ? 'Connected' : 'Disconnected', managed: true },
  ];
}

const integrations = crud({ table: 'integrations', fields: { icon: 'icon', name: 'name', detail: 'detail', status: 'status' }, required: ['name'], order: 'id' });
router.get(
  '/settings/integrations',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM integrations ORDER BY id');
    res.json([...liveIntegrations(), ...rows.map((r) => ({ id: r.id, icon: r.icon, name: r.name, detail: r.detail, status: r.status }))]);
  }),
);
router.use('/settings/integrations', (req, res, next) => {
  if (['smtp', 'stripe', 'firebase', 'claude'].includes(req.path.slice(1))) return next(httpError(400, 'This integration is configured in the server environment'));
  return next();
});
router.use('/settings/integrations', integrations);

// ---------------- Analytics ----------------

const pct = (now, before) => {
  if (!before) return now ? '↑ new' : '—';
  const d = Math.round(((now - before) / before) * 100);
  return `${d >= 0 ? '↑' : '↓'} ${Math.abs(d)}%`;
};

async function periodTotals(from, to) {
  const { rows } = await db.query(
    `WITH nights AS (
       SELECT b.id, b.user_id, a.category_id, n::date AS night, b.final_price / GREATEST(b.number_of_nights, 1) AS revenue
         FROM bookings b JOIN apartments a ON a.id = b.apartment_id
         CROSS JOIN generate_series(b.check_in_date, b.check_out_date - 1, INTERVAL '1 day') n
        WHERE b.status <> 'cancelled' AND b.check_in_date <= $2::date AND b.check_out_date > $1::date
     )
     SELECT
       COALESCE((SELECT SUM(revenue) FROM nights WHERE night BETWEEN $1 AND $2), 0) AS stays,
       COALESCE((SELECT COUNT(*) FROM nights WHERE night BETWEEN $1 AND $2), 0)::int AS occupied,
       (SELECT COUNT(*) FROM apartments WHERE is_active = true)::int AS units,
       COALESCE((SELECT SUM(total) FROM dining_orders WHERE created_at::date BETWEEN $1 AND $2), 0) AS dining,
       COALESCE((SELECT SUM(total_price) FROM experience_bookings WHERE status <> 'cancelled' AND experience_date BETWEEN $1 AND $2), 0) AS experiences,
       COALESCE((SELECT SUM(amount_paid) FROM wellness_bookings WHERE status <> 'cancelled' AND booking_date BETWEEN $1 AND $2), 0) AS wellness,
       COALESCE((SELECT SUM(amount) FROM folio_charges WHERE source_type IS NULL AND created_at::date BETWEEN $1 AND $2), 0) AS other,
       (SELECT ROUND(AVG(rating) * 2, 1) FROM feedback WHERE rating IS NOT NULL AND created_at::date BETWEEN $1 AND $2) AS satisfaction,
       (SELECT COUNT(DISTINCT user_id) FROM nights WHERE night BETWEEN $1 AND $2 AND user_id IS NOT NULL)::int AS guests,
       (SELECT COUNT(DISTINCT n.user_id) FROM nights n WHERE n.night BETWEEN $1 AND $2 AND n.user_id IS NOT NULL
           AND (SELECT COUNT(*) FROM bookings x WHERE x.user_id = n.user_id AND x.status <> 'cancelled') > 1)::int AS repeat_guests`,
    [from, to],
  );
  const r = rows[0];
  const n = (v) => Number(v || 0);
  const services = n(r.dining) + n(r.experiences) + n(r.wellness) + n(r.other);
  return { ...r, stays: n(r.stays), dining: n(r.dining), experiences: n(r.experiences), wellness: n(r.wellness), other: n(r.other), services, total: n(r.stays) + services };
}

router.get(
  '/analytics',
  ah(async (req, res) => {
    const today = isoDate(new Date());
    const from = req.query.from || today;
    const to = req.query.to || today;
    const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
    const prevTo = isoDate(new Date(new Date(from).getTime() - 86400000));
    const prevFrom = isoDate(new Date(new Date(from).getTime() - days * 86400000));
    const [cur, prev] = await Promise.all([periodTotals(from, to), periodTotals(prevFrom, prevTo)]);
    const unit = days <= 14 ? 'day' : days <= 92 ? 'week' : 'month';
    const occ = (t) => (t.units ? Math.round((t.occupied / (t.units * days)) * 100) : 0);

    const series = await db.query(
      `WITH buckets AS (
         SELECT g::date AS start, (g + ('1 ' || $3)::interval)::date - 1 AS finish
           FROM generate_series(date_trunc($3, $1::date), $2::date, ('1 ' || $3)::interval) g
       ), nights AS (
         SELECT n::date AS night, b.final_price / GREATEST(b.number_of_nights, 1) AS revenue
           FROM bookings b CROSS JOIN generate_series(b.check_in_date, b.check_out_date - 1, INTERVAL '1 day') n
          WHERE b.status <> 'cancelled' AND b.check_in_date <= $2::date AND b.check_out_date > $1::date
       ), services AS (
         SELECT created_at::date AS d, total AS v FROM dining_orders
         UNION ALL SELECT experience_date, total_price FROM experience_bookings WHERE status <> 'cancelled'
         UNION ALL SELECT booking_date, amount_paid FROM wellness_bookings WHERE status <> 'cancelled'
       )
       SELECT b.start,
              COALESCE((SELECT SUM(revenue) FROM nights WHERE night BETWEEN GREATEST(b.start, $1::date) AND LEAST(b.finish, $2::date)), 0) AS stays,
              COALESCE((SELECT SUM(v) FROM services WHERE d BETWEEN GREATEST(b.start, $1::date) AND LEAST(b.finish, $2::date)), 0) AS services
         FROM buckets b ORDER BY b.start`,
      [from, to, unit],
    );
    const label = (d) => {
      const date = new Date(d);
      if (unit === 'month') return date.toLocaleString('en', { month: 'short' });
      if (unit === 'week') return `W/${date.toLocaleString('en', { month: 'short', day: 'numeric' })}`;
      return date.toLocaleString('en', { weekday: 'short', day: 'numeric' });
    };

    const occupancy = await db.query(
      `SELECT c.display_name AS l,
              ROUND(100.0 * COALESCE(SUM(LEAST(b.check_out_date, $2::date + 1) - GREATEST(b.check_in_date, $1::date)) FILTER (WHERE b.id IS NOT NULL), 0)
                    / NULLIF(COUNT(DISTINCT a.id) * $3::int, 0))::int AS v
         FROM apartment_categories c
         JOIN apartments a ON a.category_id = c.id AND a.is_active = true
         LEFT JOIN bookings b ON b.apartment_id = a.id AND b.status <> 'cancelled' AND b.check_in_date <= $2::date AND b.check_out_date > $1::date
        WHERE c.is_active = true GROUP BY c.id, c.display_name, c.sort_order ORDER BY c.sort_order`,
      [from, to, days],
    );

    const satisfaction = await db.query(
      `SELECT COALESCE(department, INITCAP(request_type::text)) AS l, ROUND(AVG(guest_rating) * 2, 1) AS v
         FROM service_requests WHERE guest_rating IS NOT NULL AND created_at::date BETWEEN $1 AND $2
        GROUP BY 1 ORDER BY 2 DESC`,
      [from, to],
    );
    const COLORS = ['#1f9d55', '#3fd283', '#e8b84a', '#9b7bf0', '#4fc3f7', '#2f6fe8', '#f06292'];

    const top = await db.query(
      `SELECT n, unit, COUNT(*)::int AS count, COALESCE(SUM(v), 0) AS revenue FROM (
         SELECT experience_name AS n, 'bookings' AS unit, total_price AS v FROM experience_bookings WHERE status <> 'cancelled' AND experience_date BETWEEN $1 AND $2
         UNION ALL SELECT activity_name, 'bookings', amount_paid FROM wellness_bookings WHERE status <> 'cancelled' AND booking_date BETWEEN $1 AND $2
         UNION ALL SELECT COALESCE(venue, 'Dining') || ' orders', 'orders', total FROM dining_orders WHERE created_at::date BETWEEN $1 AND $2
         UNION ALL SELECT restaurant_name || ' reservations', 'covers', 0 FROM dining_reservations WHERE status <> 'cancelled' AND reservation_date BETWEEN $1 AND $2
         UNION ALL SELECT COALESCE(kind, 'Transfer'), 'transfers', 0 FROM transfers WHERE status <> 'Cancelled' AND date BETWEEN $1 AND $2
       ) s GROUP BY n, unit ORDER BY revenue DESC, count DESC LIMIT 10`,
      [from, to],
    );

    const share = (v) => (cur.total ? Math.round((v / cur.total) * 100) : 0);
    const mix = [
      { l: 'Residences', v: share(cur.stays), c: '#e8b84a' },
      { l: 'Wellness & Spa', v: share(cur.wellness), c: '#9b7bf0' },
      { l: 'Dining', v: share(cur.dining), c: '#3fd283' },
      { l: 'Experiences', v: share(cur.experiences), c: '#4fc3f7' },
    ];
    mix.push({ l: 'Other', v: cur.total ? Math.max(0, 100 - mix.reduce((s, m) => s + m.v, 0)) : 0, c: '#8f897d' });
    const units = cur.units || 1;

    res.json({
      from,
      to,
      unit,
      currency: String((await getSetting('property')).currency || 'XAF').slice(0, 3).toLowerCase(),
      kpis: [
        { l: 'Total Revenue', n: cur.total, format: 'money', d: pct(cur.total, prev.total) },
        { l: 'Avg Occupancy', n: `${occ(cur)}%`, d: pct(occ(cur), occ(prev)) },
        { l: 'RevPAR', n: Math.round(cur.stays / (units * days)), format: 'money', d: pct(cur.stays, prev.stays) },
        { l: 'Guest Satisfaction', n: cur.satisfaction === null ? '—' : `${cur.satisfaction} / 10`, d: cur.satisfaction !== null && prev.satisfaction !== null ? `${cur.satisfaction >= prev.satisfaction ? '↑' : '↓'} ${Math.abs(cur.satisfaction - prev.satisfaction).toFixed(1)}` : '—' },
        { l: 'Repeat Guests', n: `${cur.guests ? Math.round((cur.repeat_guests / cur.guests) * 100) : 0}%`, d: pct(cur.repeat_guests, prev.repeat_guests) },
      ],
      series: series.rows.map((s) => ({ label: label(s.start), stays: Math.round(Number(s.stays)), services: Math.round(Number(s.services)) })),
      mix,
      total: cur.total,
      occupancy: occupancy.rows.map((o) => ({ l: o.l, v: Math.min(100, o.v || 0) })),
      satisfaction: satisfaction.rows.map((s, i) => ({ l: s.l, v: Number(s.v), c: COLORS[i % COLORS.length] })),
      topServices: top.rows.map((t) => ({ n: t.n, count: `${t.count} ${t.unit}`, revenue: Number(t.revenue) })),
    });
  }),
);

// ---------------- FAY AI ----------------

/** A compact picture of today's operations, used for the AI and the built-in summary. */
async function snapshot() {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM bookings WHERE status = 'checked_in')::int AS in_house,
       (SELECT COUNT(*) FROM apartments WHERE is_active = true)::int AS units,
       (SELECT json_agg(json_build_object('guest', b.guest_name, 'residence', a.unit_number, 'status', b.status))
          FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.check_in_date = CURRENT_DATE AND b.status <> 'cancelled') AS arrivals_today,
       (SELECT json_agg(json_build_object('guest', b.guest_name, 'residence', a.unit_number, 'status', b.status))
          FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.check_in_date = CURRENT_DATE + 1 AND b.status <> 'cancelled') AS arrivals_tomorrow,
       (SELECT json_agg(json_build_object('guest', b.guest_name, 'residence', a.unit_number, 'status', b.status))
          FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.check_out_date = CURRENT_DATE AND b.status <> 'cancelled') AS departures_today,
       (SELECT json_object_agg(s, c) FROM (SELECT status::text AS s, COUNT(*) AS c FROM service_requests WHERE created_at::date = CURRENT_DATE GROUP BY status) x) AS requests_today,
       (SELECT json_agg(json_build_object('title', title, 'department', department, 'priority', priority))
          FROM service_requests WHERE status IN ('pending', 'escalated', 'in_progress', 'on_hold')) AS open_requests,
       (SELECT json_agg(json_build_object('number', number, 'title', title, 'location', location, 'priority', priority, 'status', status))
          FROM work_orders WHERE status <> 'Completed') AS open_work_orders,
       (SELECT json_object_agg(s, c) FROM (SELECT COALESCE(housekeeping_status, 'Ready') AS s, COUNT(*) AS c FROM residence_controls GROUP BY 1) x) AS housekeeping,
       (SELECT COUNT(*) FROM wellness_bookings WHERE booking_date = CURRENT_DATE AND status <> 'cancelled')::int AS wellness_today,
       (SELECT COUNT(*) FROM dining_reservations WHERE reservation_date = CURRENT_DATE AND status <> 'cancelled')::int AS dining_today,
       (SELECT COUNT(*) FROM concierge_messages WHERE sender_type = 'user' AND is_read = false)::int AS unread_messages,
       (SELECT COALESCE(SUM(final_price), 0) FROM bookings WHERE status <> 'cancelled' AND date_trunc('month', check_in_date) = date_trunc('month', CURRENT_DATE)) AS month_room_revenue`,
  );
  return rows[0];
}

function builtInAnswer(prompt, s) {
  const list = (a) => (a && a.length ? a.map((x) => `${x.guest} (${x.residence})`).join(', ') : 'none');
  const occ = s.units ? Math.round((s.in_house / s.units) * 100) : 0;
  const p = prompt.toLowerCase();
  if (p.includes('arrival') || p.includes('vip')) return `Arrivals today: ${list(s.arrivals_today)}. Tomorrow: ${list(s.arrivals_tomorrow)}.`;
  if (p.includes('housekeeping')) {
    const hk = s.housekeeping || {};
    return `Housekeeping board: ${Object.entries(hk).map(([k, v]) => `${v} ${k}`).join(', ') || 'no data yet'}. Departures today: ${list(s.departures_today)} — prioritise those cleans before today's arrivals (${list(s.arrivals_today)}).`;
  }
  if (p.includes('performance') || p.includes('month')) return `Room revenue booked this month: ${Number(s.month_room_revenue).toLocaleString()}. Occupancy right now: ${occ}% (${s.in_house}/${s.units}). Open the Analytics page for the full breakdown.`;
  const req = s.requests_today || {};
  const totalReq = Object.values(req).reduce((a, b) => a + Number(b), 0);
  return [
    `Occupancy ${occ}% (${s.in_house}/${s.units} residences in house).`,
    `${totalReq} requests today${totalReq ? ` (${Object.entries(req).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(', ')})` : ''}; ${(s.open_requests || []).length} still open.`,
    `${(s.open_work_orders || []).length} open work orders.`,
    `${s.wellness_today} wellness and ${s.dining_today} dining bookings today.`,
    `${s.unread_messages} unread guest messages.`,
  ].join(' ');
}

let anthropic = null;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new (Anthropic.default || Anthropic)();
  }
  return anthropic;
}

/** POST { prompt } → { answer, source } */
router.post(
  '/ai/ask',
  ah(async (req, res) => {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) throw httpError(400, 'Ask FAY something');
    const data = await snapshot();
    const client = claude();
    if (!client) return res.json({ answer: builtInAnswer(prompt, data), source: 'summary' });
    try {
      const response = await client.beta.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system:
          'You are FAY, the operations assistant for Faysha Wellness Residence. Answer the manager using only the live data provided. ' +
          'Be concise (at most 5 sentences or a short list), name guests and residences when relevant, and suggest a concrete next step. ' +
          'If the data does not cover the question, say so plainly.',
        messages: [{ role: 'user', content: `Live operations data (JSON):\n${JSON.stringify(data)}\n\nQuestion: ${prompt}` }],
      });
      if (response.stop_reason === 'refusal') return res.json({ answer: builtInAnswer(prompt, data), source: 'summary' });
      const answer = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return res.json({ answer: answer || builtInAnswer(prompt, data), source: 'claude' });
    } catch (e) {
      console.error('FAY AI request failed:', e.status || '', e.message);
      return res.json({ answer: builtInAnswer(prompt, data), source: 'summary' });
    }
  }),
);

// ---------------- Card payments (Stripe) ----------------

const ZERO_DECIMAL = ['xaf', 'xof', 'jpy', 'krw', 'vnd', 'clp', 'pyg', 'ugx', 'rwf', 'gnf', 'kmf', 'mga', 'bif', 'djf', 'vuv', 'xpf'];

/** POST { reservationId } or { guestId } → { clientSecret }. The amount is the outstanding balance, computed here. */
router.post(
  '/payments/create-payment-intent',
  ah(async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) throw httpError(503, 'Card payments are not configured (STRIPE_SECRET_KEY)');
    const { reservationId, guestId } = req.body || {};
    let bookingId = reservationId;
    let balance;
    let currency;
    if (guestId) {
      const folio = await folioOf(await guestRow(guestId));
      ({ bookingId, balance, currency } = folio);
    } else {
      const b = (
        await db.query(
          `SELECT b.id, b.final_price - COALESCE((SELECT SUM(amount - COALESCE(refund_amount, 0)) FROM payments WHERE booking_id = b.id AND status IN ('completed', 'refunded')), 0) AS balance
             FROM bookings b WHERE b.id = $1`,
          [reservationId],
        )
      ).rows[0];
      if (!b) throw httpError(404, 'Reservation not found');
      balance = Number(b.balance);
      currency = String((await getSetting('property')).currency || 'XAF').slice(0, 3).toLowerCase();
    }
    if (!bookingId || !(balance > 0)) throw httpError(400, 'Nothing to pay on this reservation');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const amount = ZERO_DECIMAL.includes(currency) ? Math.round(balance) : Math.round(balance * 100);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { booking_id: String(bookingId), source: 'manager_dashboard', staff_id: String(req.user.id) },
      automatic_payment_methods: { enabled: true },
    });
    // Marked completed by the existing Stripe webhook (routes/payments.js).
    await db.query(
      `INSERT INTO payments (booking_id, payment_method, amount, currency, status, stripe_payment_intent_id, payment_metadata)
       VALUES ($1, 'stripe', $2, $3, 'pending', $4, $5)`,
      [bookingId, balance, currency.toUpperCase(), intent.id, JSON.stringify({ source: 'manager_dashboard', staffId: req.user.id })],
    );
    res.json({ clientSecret: intent.client_secret, amount: balance, currency });
  }),
);

module.exports = router;

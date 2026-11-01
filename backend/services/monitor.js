/**
 * The operations monitor: every minute it looks for things that need someone and raises an alert once (dedupe key),
 * then resolves it when the condition clears. It also sends guests their day-of-arrival and day-of-departure messages.
 *
 * One server process runs it at a time (a PostgreSQL advisory lock), so a second instance never doubles alerts.
 * Times are the property's (PROPERTY_TZ) and the standard check-in / check-out times from FAY OS → Settings.
 *
 * Each rule: { key, level, category, sql (rows with id, title, body, link), prefix } — rows are the conditions that hold
 * now; alerts with the rule's prefix that are not among them are resolved.
 */
const db = require('../config/database');
const { staffAlert, resolve } = require('./notify');
const { notifyGuest } = require('./guestPush');

const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';
const LOCK = 727274; // advisory lock id for the monitor
const SLA_MINUTES = { urgent: 10, high: 15, normal: 30, low: 60 };

async function policy() {
  const { rows } = await db.query(`SELECT value FROM app_settings WHERE key = 'property'`);
  const p = rows[0]?.value || {};
  const hhmm = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? v : d);
  return {
    checkIn: hhmm(p.standardCheckIn, '14:00'),
    checkOut: hhmm(p.standardCheckOut, '11:00'),
    grace: Math.max(0, Number(p.lateCheckoutGraceMinutes ?? 30)),
    noShowHours: Math.max(1, Number(p.noShowAfterHours ?? 6)),
  };
}

/** Rules evaluated each minute. `$1` = property time zone, `$2` = check-in time, `$3` = check-out time, `$4` = grace minutes, `$5` = no-show hours. */
const RULES = [
  {
    prefix: 'late-checkout',
    level: 'urgent',
    category: 'front-desk',
    sql: `SELECT b.id, 'Late check-out · ' || a.unit_number AS title,
                 b.guest_name || ' was due out ' || CASE WHEN b.check_out_date < (NOW() AT TIME ZONE $1)::date THEN 'on ' || to_char(b.check_out_date, 'DD Mon') ELSE 'at ' || $3 END || ' and is still checked in' AS body,
                 '/reservations' AS link
            FROM bookings b JOIN apartments a ON a.id = b.apartment_id
           WHERE b.status = 'checked_in'
             AND (b.check_out_date < (NOW() AT TIME ZONE $1)::date
                  OR (b.check_out_date = (NOW() AT TIME ZONE $1)::date AND (NOW() AT TIME ZONE $1)::time > $3::time + make_interval(mins => $4::int)))
             AND $2::text IS NOT NULL AND $5::int IS NOT NULL`,
  },
  {
    prefix: 'no-show',
    level: 'action',
    category: 'front-desk',
    sql: `SELECT b.id, 'Not arrived · ' || a.unit_number AS title,
                 b.guest_name || ' was expected from ' || $2 || CASE WHEN b.check_in_date < (NOW() AT TIME ZONE $1)::date THEN ' on ' || to_char(b.check_in_date, 'DD Mon') ELSE ' today' END || '. Contact the guest or mark a no-show.' AS body,
                 '/reservations' AS link
            FROM bookings b JOIN apartments a ON a.id = b.apartment_id
           WHERE b.status = 'confirmed' AND b.check_out_date > (NOW() AT TIME ZONE $1)::date
             AND (b.check_in_date < (NOW() AT TIME ZONE $1)::date
                  OR (b.check_in_date = (NOW() AT TIME ZONE $1)::date AND (NOW() AT TIME ZONE $1)::time > $2::time + make_interval(hours => $5::int)))
             AND $3::text IS NOT NULL AND $4::int IS NOT NULL`,
  },
  {
    prefix: 'room-not-ready',
    level: 'urgent',
    category: 'housekeeping',
    sql: `SELECT b.id, 'Residence not ready · ' || a.unit_number AS title,
                 b.guest_name || ' arrives today from ' || $2 || ' and the residence is ' || lower(rc.housekeeping_status) AS body,
                 '/housekeeping' AS link
            FROM bookings b JOIN apartments a ON a.id = b.apartment_id JOIN residence_controls rc ON rc.apartment_id = a.id
           WHERE b.status = 'confirmed' AND b.check_in_date = (NOW() AT TIME ZONE $1)::date
             AND rc.housekeeping_status <> 'Ready'
             AND (NOW() AT TIME ZONE $1)::time > $2::time - INTERVAL '2 hours'`,
  },
  {
    prefix: 'request-sla',
    level: 'urgent',
    category: 'requests',
    sql: `SELECT r.id, 'Request waiting · ' || r.title AS title,
                 COALESCE(r.guest_name, 'A guest') || COALESCE(' · ' || NULLIF(r.location, ''), '') || ' · ' || r.priority || ' priority, not picked up within its ' || CASE r.priority WHEN 'urgent' THEN ${SLA_MINUTES.urgent} WHEN 'high' THEN ${SLA_MINUTES.high} WHEN 'low' THEN ${SLA_MINUTES.low} ELSE ${SLA_MINUTES.normal} END || '-minute target' AS body,
                 '/requests' AS link
            FROM service_requests r
           WHERE r.status = 'pending'
             AND r.created_at < NOW() - make_interval(mins => CASE r.priority WHEN 'urgent' THEN ${SLA_MINUTES.urgent} WHEN 'high' THEN ${SLA_MINUTES.high} WHEN 'low' THEN ${SLA_MINUTES.low} ELSE ${SLA_MINUTES.normal} END)`,
  },
  {
    prefix: 'guest-waiting',
    level: 'action',
    category: 'messages',
    sql: `SELECT m.user_id AS id, u.full_name || ' is waiting for a reply' AS title,
                 '“' || LEFT(m.message, 90) || '” · unanswered for 10+ minutes' AS body,
                 '/comms?conversation=' || m.user_id AS link
            FROM (SELECT DISTINCT ON (user_id) user_id, message, created_at FROM concierge_messages
                   WHERE sender_type = 'user' AND is_read = false ORDER BY user_id, created_at) m
            JOIN users u ON u.id = m.user_id
           WHERE m.created_at < NOW() - INTERVAL '10 minutes'`,
  },
  {
    prefix: 'enquiry-waiting',
    level: 'action',
    category: 'enquiries',
    sql: `SELECT e.id, 'Enquiry unanswered · ' || e.name AS title, COALESCE(e.subject, LEFT(e.message, 80)) || ' · received ' || to_char(e.created_at AT TIME ZONE $1, 'DD Mon HH24:MI') AS body,
                 '/enquiries?id=' || e.id AS link
            FROM enquiries e WHERE e.status IN ('new', 'open') AND e.first_response_at IS NULL AND e.created_at < NOW() - INTERVAL '4 hours'`,
  },
  {
    prefix: 'event-new',
    level: 'action',
    category: 'events',
    sql: `SELECT e.id, 'Event request waiting · ' || e.name AS title, e.guests || ' guests' || COALESCE(' · ' || to_char(e.event_date, 'DD Mon YYYY'), '') || ' · nobody has opened it yet' AS body,
                 '/events?id=' || e.id AS link
            FROM event_requests e WHERE e.status = 'new' AND e.created_at < NOW() - INTERVAL '4 hours'`,
  },
  {
    prefix: 'deposit-due',
    level: 'action',
    category: 'events',
    sql: `SELECT e.id, 'Deposit not received · ' || e.reference AS title, e.name || ' accepted the proposal ' || EXTRACT(DAY FROM NOW() - q.responded_at)::int || ' days ago' AS body,
                 '/events?id=' || e.id AS link
            FROM event_requests e JOIN event_quotes q ON q.event_id = e.id AND q.status = 'accepted'
           WHERE e.status = 'accepted' AND q.responded_at < NOW() - INTERVAL '3 days'`,
  },
  {
    prefix: 'quote-expiring',
    level: 'info',
    category: 'events',
    sql: `SELECT q.id, 'Proposal expires soon · ' || e.reference AS title, e.name || ' has not answered; valid until ' || to_char(q.valid_until, 'DD Mon') AS body,
                 '/events?id=' || e.id AS link
            FROM event_quotes q JOIN event_requests e ON e.id = q.event_id
           WHERE q.status = 'sent' AND q.valid_until BETWEEN (NOW() AT TIME ZONE $1)::date AND (NOW() AT TIME ZONE $1)::date + 2`,
  },
  {
    prefix: 'event-soon',
    level: 'info',
    category: 'events',
    sql: `SELECT e.id, 'Event in ' || (e.event_date - (NOW() AT TIME ZONE $1)::date) || ' days · ' || COALESCE(e.title, e.reference) AS title,
                 e.guests || ' guests · ' || to_char(e.event_date, 'Dy DD Mon') AS body, '/events?id=' || e.id AS link
            FROM event_requests e WHERE e.status = 'confirmed' AND e.event_date BETWEEN (NOW() AT TIME ZONE $1)::date AND (NOW() AT TIME ZONE $1)::date + 7`,
  },
  {
    prefix: 'loan-overdue',
    level: 'action',
    category: 'loans',
    sql: `SELECT l.id, 'Not returned · ' || COALESCE(i.code, l.category) AS title,
                 COALESCE(l.guest_name, 'A guest') || ' · ' || COALESCE(i.name, l.category) || ' was due back ' || to_char(l.due_at AT TIME ZONE $1, 'DD Mon HH24:MI') AS body,
                 '/lockers' AS link
            FROM loans l LEFT JOIN loan_items i ON i.id = l.item_id
           WHERE l.status IN ('ready', 'out') AND l.due_at < NOW()`,
  },
  {
    prefix: 'visitor-approve',
    level: 'action',
    category: 'gate',
    sql: `SELECT p.id, 'Visitor to approve · ' || p.visitor_name AS title,
                 'Expected ' || to_char(p.visit_date, 'Dy DD Mon') || COALESCE(' from ' || p.arrive_from, '') || ' · Residence ' || COALESCE(a.unit_number, '') AS body,
                 '/visitors' AS link
            FROM visitor_passes p LEFT JOIN apartments a ON a.id = p.apartment_id
           WHERE p.status = 'pending' AND p.visit_date >= (NOW() AT TIME ZONE $1)::date`,
  },
];

/** Extra rules registered by other modules (assets, lockers…). */
const extra = [];
const addRule = (rule) => extra.push(rule);

async function runRules(app, p) {
  const params = [TZ, p.checkIn, p.checkOut, p.grace, p.noShowHours];
  for (const rule of [...RULES, ...extra]) {
    try {
      // Every rule receives the same five parameters; the wrapper types them all, used or not.
      const { rows } = await db.query(
        `SELECT * FROM (${rule.sql}) rule WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL AND $3::text IS NOT NULL AND $4::int IS NOT NULL AND $5::int IS NOT NULL`,
        params,
      );
      const live = new Set(rows.map((r) => `${rule.prefix}:${r.id}`));
      for (const r of rows) {
        await staffAlert(app, { title: r.title, body: r.body, link: r.link, level: r.level || rule.level, category: rule.category, dedupeKey: `${rule.prefix}:${r.id}` });
      }
      const open = await db.query(`SELECT dedupe_key FROM staff_notifications WHERE resolved_at IS NULL AND dedupe_key LIKE $1`, [`${rule.prefix}:%`]);
      for (const { dedupe_key: key } of open.rows) if (!live.has(key)) await resolve(app, key);
    } catch (e) {
      console.error(`Monitor rule ${rule.prefix} failed:`, e.message);
    }
  }
}

/** Day-of messages to guests (once each): arrival morning and departure morning. */
async function guestReminders(app, p) {
  const now = await db.query(`SELECT (NOW() AT TIME ZONE $1)::time AS t, (NOW() AT TIME ZONE $1)::date AS d`, [TZ]);
  const hour = Number(String(now.rows[0].t).slice(0, 2));
  if (hour >= 8 && hour < 21) {
    const arrivals = await db.query(
      `SELECT b.id, b.user_id, a.unit_number FROM bookings b JOIN apartments a ON a.id = b.apartment_id
        WHERE b.status = 'confirmed' AND b.check_in_date = $1 AND b.user_id IS NOT NULL`,
      [now.rows[0].d],
    );
    for (const b of arrivals.rows) {
      await notifyGuest(app, b.user_id, {
        title: 'Welcome to Faysha today',
        body: `Residence ${b.unit_number} is yours from ${p.checkIn}. Your digital key is in the app — tell the concierge your arrival time and we will be ready.`,
        event: 'stay:arrival',
        data: { bookingId: b.id, screen: 'DigitalKey' },
        dedupeKey: `arrival:${b.id}`,
      });
    }
  }
  if (hour >= 7 && hour < 12) {
    const departures = await db.query(
      `SELECT b.id, b.user_id FROM bookings b WHERE b.status = 'checked_in' AND b.check_out_date = $1 AND b.user_id IS NOT NULL`,
      [now.rows[0].d],
    );
    for (const b of departures.rows) {
      await notifyGuest(app, b.user_id, {
        title: 'Your departure today',
        body: `Check-out is at ${p.checkOut}. Would you like a late check-out, help with luggage or a ride? Ask the concierge.`,
        event: 'stay:departure',
        data: { bookingId: b.id, screen: 'Concierge' },
        dedupeKey: `departure:${b.id}`,
      });
    }
  }
}

async function tick(app) {
  const client = await db.pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK]);
    if (!lock.rows[0].ok) return;
    try {
      const p = await policy();
      await runRules(app, p);
      await guestReminders(app, p);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK]);
    }
  } catch (e) {
    console.error('Monitor tick failed:', e.message);
  } finally {
    client.release();
  }
}

/** Starts the monitor (every minute, first run after 15 s). Returns a stop function. */
function start(app, everyMs = 60 * 1000) {
  if (process.env.MONITOR_DISABLED === 'true') return () => {};
  const first = setTimeout(() => tick(app), 15 * 1000);
  const timer = setInterval(() => tick(app), everyMs);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}

module.exports = { start, tick, addRule, RULES };

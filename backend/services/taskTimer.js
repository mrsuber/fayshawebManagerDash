/**
 * Task timers. Every request and work order given to a person carries the time allowed for it. The clock starts when
 * the task lands in the person's to-do (assigned_at) and stops when they mark it done. Past the time allowed it keeps
 * counting: the person sees how late they are, the manager sees it on FAY OS, and both are told once it goes late
 * (operations monitor, rules "task-late*").
 *
 * The time allowed is set when the task is created: the manager can give one, otherwise the standard time of the
 * department applies (FAY OS → Settings → Team → Task times, stored in preferences.taskTimes). Changing a standard later
 * does not change tasks already created, so each person is measured against what they were given.
 */
const db = require('../config/database');

/** Minutes allowed by default: per department, plus the departure clean and work orders. */
const DEFAULT_MINUTES = {
  Housekeeping: 45,
  Maintenance: 60,
  Concierge: 20,
  Dining: 30,
  Wellness: 30,
  Transportation: 20,
  Experiences: 30,
  departureClean: 90,
  workOrder: 120,
};
const MIN = 5;
const MAX = 7 * 24 * 60; // a week

const valid = (n) => Number.isFinite(n) && n >= MIN && n <= MAX;

/** Cleans a submitted number of minutes: null when empty, throws 400 when out of range. */
function cleanMinutes(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Math.round(Number(v));
  if (!valid(n)) throw Object.assign(new Error(`Time allowed must be between ${MIN} minutes and ${MAX / 60 / 24} days`), { status: 400 });
  return n;
}

/** The standard times in force (stored values over the defaults). */
async function standards(q = db) {
  const { rows } = await q.query(`SELECT value FROM app_settings WHERE key = 'preferences'`);
  const stored = rows[0]?.value?.taskTimes || {};
  const out = { ...DEFAULT_MINUTES };
  for (const k of Object.keys(DEFAULT_MINUTES)) {
    const n = Number(stored[k]);
    if (valid(n)) out[k] = Math.round(n);
  }
  return out;
}

/** Minutes for a new task of `kind` (a department, 'departureClean' or 'workOrder'): the given value, else the standard. */
async function minutesFor(kind, given, q = db) {
  const explicit = cleanMinutes(given);
  if (explicit) return explicit;
  const s = await standards(q);
  return s[kind] || s.Concierge;
}

/** Validates a PATCH of preferences.taskTimes; returns the cleaned object (only known keys). */
function cleanStandards(body) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (!(k in DEFAULT_MINUTES)) continue;
    const n = cleanMinutes(v);
    if (n) out[k] = n;
  }
  return out;
}

/**
 * The clock of one task, for the apps: null when there is no time allowed or nobody has it yet.
 * { minutes, startedAt, dueAt, endedAt, takenMinutes, lateMinutes, onTime }
 * While running, takenMinutes/lateMinutes are as of now; the apps tick from dueAt themselves.
 */
function clock({ minutes, assignedAt, completedAt, closed = false }, now = new Date()) {
  if (!minutes || !assignedAt) return null;
  const start = new Date(assignedAt);
  const due = new Date(start.getTime() + minutes * 60000);
  const end = completedAt ? new Date(completedAt) : closed ? null : now;
  const taken = end ? Math.max(0, Math.round((end - start) / 60000)) : null;
  const late = end ? Math.max(0, Math.round((end - due) / 60000)) : null;
  return {
    minutes,
    startedAt: start.toISOString(),
    dueAt: due.toISOString(),
    endedAt: completedAt ? new Date(completedAt).toISOString() : null,
    running: !completedAt && !closed,
    takenMinutes: taken,
    lateMinutes: late,
    onTime: end ? end <= due : null,
  };
}

/** The clock of a service_requests row. */
const requestClock = (r, now) =>
  clock({ minutes: r.time_allowed_minutes, assignedAt: r.assigned_at, completedAt: r.completed_at, closed: r.status === 'cancelled' }, now);

/** The clock of a work_orders row. */
const orderClock = (o, now) =>
  clock({ minutes: o.time_allowed_minutes, assignedAt: o.assigned_at, completedAt: o.completed_at, closed: ['Closed', 'Cancelled'].includes(o.status) && !o.completed_at }, now);

/**
 * Timing per person over the last `days`: the tasks they finished (requests and work orders that had a time allowed),
 * how many on time, their average time, how late on average when late, the tasks open and late right now, and the guests'
 * average rating. `userId` narrows to one person.
 */
async function performance({ days = 30, userId = null } = {}, q = db) {
  const { rows } = await q.query(
    `WITH t AS (
       SELECT assigned_to AS uid, assigned_at::timestamptz AS a, completed_at::timestamptz AS c, time_allowed_minutes AS m, status IN ('completed') AS done,
              status NOT IN ('completed', 'cancelled') AS open
         FROM service_requests WHERE assigned_to IS NOT NULL AND time_allowed_minutes IS NOT NULL AND assigned_at IS NOT NULL
       UNION ALL
       SELECT assigned_to, assigned_at, completed_at, time_allowed_minutes, completed_at IS NOT NULL, status NOT IN ('Completed', 'Closed', 'Cancelled')
         FROM work_orders WHERE assigned_to IS NOT NULL AND time_allowed_minutes IS NOT NULL AND assigned_at IS NOT NULL
     ), f AS (
       SELECT uid, EXTRACT(EPOCH FROM (c - a)) / 60 AS took, EXTRACT(EPOCH FROM (c - a)) / 60 - m AS over
         FROM t WHERE done AND c IS NOT NULL AND c > NOW() - make_interval(days => $1::int)
     )
     SELECT u.id, u.full_name AS name, COALESCE(u.department, '') AS department,
            (SELECT COUNT(*) FROM f WHERE f.uid = u.id)::int AS done,
            (SELECT COUNT(*) FROM f WHERE f.uid = u.id AND f.over <= 0)::int AS on_time,
            (SELECT ROUND(AVG(took))::int FROM f WHERE f.uid = u.id) AS avg_minutes,
            (SELECT ROUND(AVG(over))::int FROM f WHERE f.uid = u.id AND f.over > 0) AS avg_late,
            (SELECT COUNT(*) FROM t WHERE t.uid = u.id AND t.open)::int AS open,
            (SELECT COUNT(*) FROM t WHERE t.uid = u.id AND t.open AND t.a + make_interval(mins => t.m) < NOW())::int AS late_now,
            (SELECT ROUND(AVG(rating)::numeric, 1)::float FROM staff_ratings s WHERE s.staff_id = u.id AND s.created_at > NOW() - make_interval(days => $1::int)) AS rating,
            (SELECT COUNT(*) FROM staff_ratings s WHERE s.staff_id = u.id AND s.created_at > NOW() - make_interval(days => $1::int))::int AS ratings
       FROM users u
      WHERE u.id IN (SELECT uid FROM t) AND ($2::int IS NULL OR u.id = $2::int)
      ORDER BY u.full_name`,
    [days, userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    department: r.department || null,
    done: r.done,
    onTime: r.on_time,
    onTimeRate: r.done ? Math.round((r.on_time / r.done) * 100) : null,
    avgMinutes: r.avg_minutes,
    avgLateMinutes: r.avg_late,
    open: r.open,
    lateNow: r.late_now,
    rating: r.rating,
    ratings: r.ratings,
  }));
}

module.exports = { DEFAULT_MINUTES, cleanMinutes, cleanStandards, standards, minutesFor, clock, requestClock, orderClock, performance };

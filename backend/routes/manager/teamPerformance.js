/**
 * FAY OS → Team performance: every team member's record, and one person's full work history.
 *
 *   GET /team-performance?days=30        { days, people: [summary…] } — every active team member (not guests)
 *   GET /team-performance/:id?days=30    { person, period, allTime, stars, ratings, history, months, warnings, attendance }
 *
 * Work counted: service requests and work orders assigned to the person, and wellness sessions they lead.
 * "On time" uses the task timer (services/taskTimer): finished within the time allowed from the moment it was given.
 * Ratings are the ones guests gave for that person's service (staff_ratings). The score mixes the average rating
 * (60%) and the on-time rate (40%), less 5 points per warning in the period; it needs 3 finished tasks or 1 rating.
 */
const express = require('express');
const { db, ah, httpError, isoTime } = require('./lib');
const desk = require('../../services/staffDesk');

const router = express.Router();
const daysOf = (q) => Math.max(1, Math.min(3650, parseInt(q, 10) || 30));

// Every task given to a person, one shape: who, when given, when finished, minutes allowed, done / open / verified.
const TASKS = `
  SELECT 'request' AS kind, r.id, r.assigned_to AS uid, r.created_at::timestamptz AS created, r.assigned_at::timestamptz AS a,
         r.started_at::timestamptz AS s, r.completed_at::timestamptz AS c, r.time_allowed_minutes AS m,
         r.status::text = 'completed' AS done, r.status::text NOT IN ('completed', 'cancelled') AS open, r.status::text = 'cancelled' AS cancelled,
         r.verified_at IS NOT NULL AS verified
    FROM service_requests r WHERE r.assigned_to IS NOT NULL
  UNION ALL
  SELECT 'work_order', o.id, o.assigned_to, o.created_at, o.assigned_at::timestamptz, o.started_at, o.completed_at, o.time_allowed_minutes,
         o.completed_at IS NOT NULL OR o.status IN ('Completed', 'Closed'), o.status NOT IN ('Completed', 'Closed', 'Cancelled'), o.status = 'Cancelled', FALSE
    FROM work_orders o WHERE o.assigned_to IS NOT NULL
  UNION ALL
  SELECT 'wellness', w.id, w.staff_id, w.created_at::timestamptz, COALESCE(w.assigned_at, w.created_at)::timestamptz, w.checked_in_at::timestamptz,
         CASE WHEN w.status = 'completed' THEN (w.booking_date + w.end_time)::timestamptz END, NULL,
         w.status = 'completed', w.status IN ('requested', 'upcoming', 'in_progress'), w.status IN ('cancelled', 'no_show'), FALSE
    FROM wellness_bookings w WHERE w.staff_id IS NOT NULL`;

/**
 * Summary per person over `days` (userId narrows to one). Includes team members with no work yet, so the list is the
 * whole team; with userId, also a person who has since left.
 */
async function summaries(days, userId = null) {
  const { rows } = await db.query(
    `WITH t AS (${TASKS}),
     f AS (
       SELECT uid, kind, EXTRACT(EPOCH FROM (c - a)) / 60 AS took, CASE WHEN m IS NOT NULL THEN EXTRACT(EPOCH FROM (c - a)) / 60 - m END AS over, verified
         FROM t WHERE done AND COALESCE(c, a) > NOW() - make_interval(days => $1::int)
     ),
     tf AS (
       SELECT uid, COUNT(*)::int AS done,
              COUNT(*) FILTER (WHERE kind = 'request')::int AS requests,
              COUNT(*) FILTER (WHERE kind = 'work_order')::int AS work_orders,
              COUNT(*) FILTER (WHERE kind = 'wellness')::int AS sessions,
              COUNT(*) FILTER (WHERE over IS NOT NULL)::int AS timed,
              COUNT(*) FILTER (WHERE over <= 0)::int AS on_time,
              ROUND(AVG(took) FILTER (WHERE kind <> 'wellness' AND took >= 0))::int AS avg_minutes,
              ROUND(AVG(over) FILTER (WHERE over > 0))::int AS avg_late,
              COUNT(*) FILTER (WHERE verified)::int AS verified
         FROM f GROUP BY uid
     ),
     tn AS (
       SELECT uid, COUNT(*) FILTER (WHERE open)::int AS open,
              COUNT(*) FILTER (WHERE open AND m IS NOT NULL AND a + make_interval(mins => m) < NOW())::int AS late_now,
              COUNT(*) FILTER (WHERE cancelled AND created > NOW() - make_interval(days => $1::int))::int AS cancelled,
              MAX(c) AS last_done
         FROM t GROUP BY uid
     ),
     rt AS (
       SELECT staff_id AS uid, ROUND(AVG(rating)::numeric, 2)::float AS rating, COUNT(*)::int AS ratings,
              COUNT(*) FILTER (WHERE rating <= 2)::int AS low, COUNT(*) FILTER (WHERE rating >= 4)::int AS happy
         FROM staff_ratings WHERE staff_id IS NOT NULL AND created_at > NOW() - make_interval(days => $1::int) GROUP BY staff_id
     ),
     wr AS (
       SELECT staff_id AS uid, COUNT(*)::int AS warnings FROM staff_warnings WHERE created_at > NOW() - make_interval(days => $1::int) GROUP BY staff_id
     )
     SELECT u.id, u.full_name, u.email, u.phone, u.status, u.profile_image_url, r.display_name AS role,
            COALESCE(u.department, hr.department) AS department, COALESCE(u.job_title, hr.job_title) AS job_title, hr.hire_date,
            COALESCE(tf.done, 0) AS done, COALESCE(tf.requests, 0) AS requests, COALESCE(tf.work_orders, 0) AS work_orders,
            COALESCE(tf.sessions, 0) AS sessions, COALESCE(tf.timed, 0) AS timed, COALESCE(tf.on_time, 0) AS on_time,
            tf.avg_minutes, tf.avg_late, COALESCE(tf.verified, 0) AS verified,
            COALESCE(tn.open, 0) AS open, COALESCE(tn.late_now, 0) AS late_now, COALESCE(tn.cancelled, 0) AS cancelled, tn.last_done,
            rt.rating, COALESCE(rt.ratings, 0) AS ratings, COALESCE(rt.low, 0) AS low, COALESCE(rt.happy, 0) AS happy,
            COALESCE(wr.warnings, 0) AS warnings
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT e.job_title, e.hire_date, d.name AS department FROM employees e LEFT JOIN departments d ON d.id = e.department_id
          WHERE e.user_id = u.id ORDER BY e.id DESC LIMIT 1
       ) hr ON TRUE
       LEFT JOIN tf ON tf.uid = u.id LEFT JOIN tn ON tn.uid = u.id LEFT JOIN rt ON rt.uid = u.id LEFT JOIN wr ON wr.uid = u.id
      WHERE r.name <> 'guest' AND ($2::int IS NULL AND u.status = 'active' AND u.deleted_at IS NULL OR u.id = $2::int)
      ORDER BY u.full_name`,
    [days, userId],
  );
  return rows.map(toSummary);
}

/** Score 0–100 and a word for it; null while there is too little to judge. */
function standing({ done, timed, onTime, rating, ratings, warnings }) {
  if (done < 3 && ratings < 1) return { score: null, label: 'Not enough work yet' };
  const parts = [];
  if (ratings) parts.push([(rating / 5) * 100, 0.6]);
  if (timed) parts.push([(onTime / timed) * 100, 0.4]);
  if (!parts.length) return { score: null, label: 'Not enough work yet' };
  const weight = parts.reduce((s, [, w]) => s + w, 0);
  const score = Math.max(0, Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / weight - 5 * warnings));
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs attention';
  return { score, label };
}

function toSummary(r) {
  const s = {
    id: r.id,
    name: r.full_name,
    email: r.email,
    phone: r.phone || null,
    photo: r.profile_image_url || null,
    active: r.status === 'active',
    role: r.role,
    department: r.department || null,
    jobTitle: r.job_title || null,
    since: r.hire_date ? new Date(r.hire_date).toISOString().slice(0, 10) : null,
    done: r.done,
    requests: r.requests,
    workOrders: r.work_orders,
    sessions: r.sessions,
    timed: r.timed,
    onTime: r.on_time,
    onTimeRate: r.timed ? Math.round((r.on_time / r.timed) * 100) : null,
    avgMinutes: r.avg_minutes,
    avgLateMinutes: r.avg_late,
    verified: r.verified,
    open: r.open,
    lateNow: r.late_now,
    cancelled: r.cancelled,
    lastDoneAt: isoTime(r.last_done),
    rating: r.rating,
    ratings: r.ratings,
    lowRatings: r.low,
    happyRatings: r.happy,
    warnings: r.warnings,
  };
  return { ...s, ...standing(s) };
}

router.get(
  '/team-performance',
  ah(async (req, res) => {
    const days = daysOf(req.query.days);
    res.json({ days, people: await summaries(days) });
  }),
);

const REQ_STATUS = { pending: 'New', acknowledged: 'Seen', in_progress: 'In progress', scheduled: 'Scheduled', escalated: 'Escalated', on_hold: 'On hold', completed: 'Done', cancelled: 'Cancelled' };
const WELL_STATUS = { requested: 'Requested', upcoming: 'Upcoming', in_progress: 'In session', completed: 'Done', cancelled: 'Cancelled', no_show: 'No-show' };

router.get(
  '/team-performance/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const days = daysOf(req.query.days);
    const [period] = await summaries(days, id);
    if (!period) throw httpError(404, 'Team member not found');
    const [[allTime], stars, ratings, history, months, warnings, attendance] = await Promise.all([
      summaries(3650, id),
      db.query(`SELECT rating, COUNT(*)::int AS n FROM staff_ratings WHERE staff_id = $1 GROUP BY rating`, [id]),
      db.query(
        `SELECT s.id, s.rating, s.comment, s.context, s.context_id, s.department, s.status, s.follow_up, s.created_at, g.id AS guest_id, g.full_name AS guest
           FROM staff_ratings s LEFT JOIN users g ON g.id = s.user_id WHERE s.staff_id = $1 ORDER BY s.created_at DESC LIMIT 100`,
        [id],
      ),
      db.query(
        `SELECT * FROM (
           SELECT 'request' AS kind, r.id, r.request_number AS number, r.title, r.department, r.priority::text AS priority, r.status::text AS status,
                  COALESCE(r.guest_name, g.full_name) AS guest, r.guest_id, COALESCE(r.location, 'Residence ' || ap.unit_number) AS place,
                  r.created_at::timestamptz AS created, r.assigned_at::timestamptz AS assigned, r.started_at::timestamptz AS started,
                  r.completed_at::timestamptz AS completed, r.time_allowed_minutes AS minutes, r.resolution_notes AS note,
                  r.verified_at::timestamptz AS verified, v.full_name AS verified_by
             FROM service_requests r LEFT JOIN users g ON g.id = r.guest_id LEFT JOIN apartments ap ON ap.id = r.apartment_id
             LEFT JOIN users v ON v.id = r.verified_by
            WHERE r.assigned_to = $1
           UNION ALL
           SELECT 'work_order', o.id, o.number, o.title, 'Maintenance', o.priority, o.status, NULL, NULL, o.location,
                  o.created_at, o.assigned_at::timestamptz, o.started_at, o.completed_at, o.time_allowed_minutes, o.completion_notes, NULL, NULL
             FROM work_orders o WHERE o.assigned_to = $1
           UNION ALL
           SELECT 'wellness', w.id, w.booking_code, w.activity_name, 'Wellness', NULL, w.status, g.full_name, w.user_id, w.room,
                  (w.booking_date + w.start_time)::timestamptz, COALESCE(w.assigned_at, w.created_at)::timestamptz, w.checked_in_at::timestamptz,
                  CASE WHEN w.status = 'completed' THEN (w.booking_date + w.end_time)::timestamptz END, NULL, w.notes, NULL, NULL
             FROM wellness_bookings w LEFT JOIN users g ON g.id = w.user_id WHERE w.staff_id = $1
         ) x ORDER BY COALESCE(completed, started, assigned, created) DESC NULLS LAST LIMIT 300`,
        [id],
      ),
      db.query(
        `WITH t AS (${TASKS}),
         m AS (SELECT generate_series(date_trunc('month', NOW()) - INTERVAL '5 months', date_trunc('month', NOW()), INTERVAL '1 month') AS month)
         SELECT m.month,
                (SELECT COUNT(*) FROM t WHERE t.uid = $1 AND t.done AND date_trunc('month', COALESCE(t.c, t.a)) = m.month)::int AS done,
                (SELECT COUNT(*) FROM t WHERE t.uid = $1 AND t.done AND t.m IS NOT NULL AND t.c IS NOT NULL AND date_trunc('month', t.c) = m.month)::int AS timed,
                (SELECT COUNT(*) FROM t WHERE t.uid = $1 AND t.done AND t.m IS NOT NULL AND t.c IS NOT NULL AND date_trunc('month', t.c) = m.month
                    AND t.c <= t.a + make_interval(mins => t.m))::int AS on_time,
                (SELECT ROUND(AVG(rating)::numeric, 2)::float FROM staff_ratings s WHERE s.staff_id = $1 AND date_trunc('month', s.created_at) = m.month) AS rating,
                (SELECT COUNT(*) FROM staff_ratings s WHERE s.staff_id = $1 AND date_trunc('month', s.created_at) = m.month)::int AS ratings
           FROM m ORDER BY m.month`,
        [id],
      ),
      desk.warnings(id),
      db.query(
        `SELECT COUNT(DISTINCT a.clock_in_time::date)::int AS days, COALESCE(SUM(a.total_hours), 0)::float AS hours,
                COUNT(*) FILTER (WHERE a.status = 'late')::int AS late, COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent
           FROM employee_attendance a JOIN employees e ON e.id = a.employee_id
          WHERE e.user_id = $1 AND a.clock_in_time > NOW() - make_interval(days => $2::int)`,
        [id, days],
      ),
    ]);

    // Ratings attached to the task they were given for.
    const rated = new Map(ratings.rows.filter((r) => r.context_id).map((r) => [`${r.context}:${r.context_id}`, r]));
    const now = new Date();
    const out = history.rows.map((h) => {
      const rt = rated.get(`${h.kind}:${h.id}`);
      const due = h.minutes && h.assigned ? new Date(new Date(h.assigned).getTime() + h.minutes * 60000) : null;
      const end = h.completed ? new Date(h.completed) : null;
      const open = h.kind === 'request' ? !['completed', 'cancelled'].includes(h.status) : h.kind === 'work_order' ? !['Completed', 'Closed', 'Cancelled'].includes(h.status) : ['requested', 'upcoming', 'in_progress'].includes(h.status);
      return {
        kind: h.kind,
        id: h.id,
        number: h.number,
        title: h.title,
        department: h.department,
        priority: h.priority,
        status: h.kind === 'request' ? REQ_STATUS[h.status] || h.status : h.kind === 'wellness' ? WELL_STATUS[h.status] || h.status : h.status,
        open,
        guest: h.guest || null,
        guestId: h.guest_id || null,
        place: h.place || null,
        createdAt: isoTime(h.created),
        assignedAt: isoTime(h.assigned),
        startedAt: isoTime(h.started),
        completedAt: isoTime(h.completed),
        minutesAllowed: h.minutes || null,
        takenMinutes: end && h.assigned && h.kind !== 'wellness' ? Math.max(0, Math.round((end - new Date(h.assigned)) / 60000)) : null,
        onTime: due ? (end ? end <= due : open ? (now <= due ? null : false) : null) : null,
        lateMinutes: due && (end || open) && (end || now) > due ? Math.round(((end || now) - due) / 60000) : 0,
        note: h.note || null,
        verifiedAt: isoTime(h.verified),
        verifiedBy: h.verified_by || null,
        rating: rt ? { stars: rt.rating, comment: rt.comment || null } : null,
      };
    });

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of stars.rows) dist[s.rating] = s.n;
    const a = attendance.rows[0] || {};
    res.json({
      days,
      person: { id: period.id, name: period.name, email: period.email, phone: period.phone, photo: period.photo, active: period.active, role: period.role, department: period.department, jobTitle: period.jobTitle, since: period.since },
      period,
      allTime,
      stars: dist,
      ratings: ratings.rows.map((r) => ({
        id: r.id, stars: r.rating, comment: r.comment || null, context: r.context, department: r.department, status: r.status,
        followUp: r.follow_up || null, at: isoTime(r.created_at), guest: r.guest || null, guestId: r.guest_id || null,
        task: r.context_id ? out.find((h) => h.kind === r.context && h.id === r.context_id)?.title || null : null,
      })),
      history: out,
      months: months.rows.map((m) => ({
        month: isoTime(m.month).slice(0, 7), done: m.done, onTimeRate: m.timed ? Math.round((m.on_time / m.timed) * 100) : null, rating: m.rating, ratings: m.ratings,
      })),
      warnings,
      attendance: { days: a.days || 0, hours: Math.round((a.hours || 0) * 10) / 10, late: a.late || 0, absent: a.absent || 0 },
    });
  }),
);

module.exports = router;
module.exports.standing = standing;

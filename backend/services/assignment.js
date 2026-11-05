/**
 * Giving work to a person. Requests, wellness sessions, work orders and events can each be assigned to a team member;
 * the person is notified and finds it in "My work" (/work). A manager picks the person, or lets Faysha suggest the
 * active member of that department with the fewest open tasks (FAY OS → Settings → FAY AI → Auto-assign service
 * requests also does it for every new request).
 */
const db = require('../config/database');

// Department names used across FAY OS, and the words that identify them in a team member's department or job.
const DEPARTMENTS = {
  Housekeeping: ['housekeep', 'cleaning', 'room'],
  Maintenance: ['mainten', 'technic', 'engineer', 'repair'],
  Concierge: ['concierge', 'front', 'reception', 'guest'],
  Dining: ['dining', 'food', 'kitchen', 'restaurant', 'f&b', 'chef', 'waiter'],
  Wellness: ['wellness', 'spa', 'gym', 'fitness', 'therap', 'yoga', 'trainer'],
  Transportation: ['transport', 'driver', 'chauffeur', 'fleet'],
  Experiences: ['experience', 'activit', 'guide', 'event'],
  Events: ['event', 'banquet', 'sales'],
};

// Open work per person (requests, wellness sessions today and later, work orders).
const OPEN_COUNT = `
  (SELECT COUNT(*) FROM service_requests r WHERE r.assigned_to = u.id AND r.status IN ('pending','acknowledged','in_progress','scheduled','escalated','on_hold'))
  + (SELECT COUNT(*) FROM wellness_bookings w WHERE w.staff_id = u.id AND w.status IN ('requested','upcoming','in_progress') AND w.booking_date >= CURRENT_DATE)
  + (SELECT COUNT(*) FROM work_orders o WHERE o.assigned_to = u.id AND o.status NOT IN ('Completed','Closed','Cancelled'))`;

/** Active team members (not guests), the people of `department` first, each with their open tasks. */
async function candidates(department) {
  const words = DEPARTMENTS[department] || (department ? [String(department).toLowerCase()] : []);
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, COALESCE(u.department, hr.department) AS department, r.name AS role, r.display_name AS role_name,
            COALESCE(u.job_title, hr.job_title) AS job_title,
            (${OPEN_COUNT})::int AS open_tasks,
            (SELECT ROUND(AVG(rating)::numeric, 1) FROM staff_ratings s WHERE s.staff_id = u.id) AS rating
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT e.job_title, d.name AS department FROM employees e LEFT JOIN departments d ON d.id = e.department_id
          WHERE e.user_id = u.id ORDER BY e.id DESC LIMIT 1
       ) hr ON TRUE
      WHERE u.status = 'active' AND u.deleted_at IS NULL AND r.name <> 'guest'
      ORDER BY u.full_name`,
  );
  const inDept = (u) => words.some((w) => `${u.department || ''} ${u.job_title || ''} ${u.role_name || ''}`.toLowerCase().includes(w));
  return rows
    .map((u) => ({
      id: u.id,
      name: u.full_name,
      department: u.department || null,
      jobTitle: u.job_title || null,
      role: u.role_name || u.role,
      roleKey: u.role,
      openTasks: u.open_tasks,
      rating: u.rating === null ? null : Number(u.rating),
      inDepartment: inDept(u),
    }))
    .sort((a, b) => Number(b.inDepartment) - Number(a.inDepartment) || a.openTasks - b.openTasks || a.name.localeCompare(b.name));
}

/** The suggested person: in the department, fewest open tasks (null when nobody is in that department). */
async function suggest(department) {
  const list = await candidates(department);
  return list.find((c) => c.inDepartment && c.roleKey !== 'superadmin') || null;
}

/** Validates a chosen person (an active team member). Returns { id, name } or throws 400. */
async function person(userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.status = 'active' AND u.deleted_at IS NULL AND r.name <> 'guest'`,
    [userId],
  );
  if (!rows[0]) throw Object.assign(new Error('Choose an active team member'), { status: 400 });
  return { id: rows[0].id, name: rows[0].full_name };
}

/** Tells the person they have new work (bell in FAY OS / My work, push, socket). */
async function notifyAssignee(app, userId, { title, body, link = '/work', key }) {
  if (!userId) return;
  await require('./notify').staffAlert(app, { title, body, link, level: 'action', category: 'assignment', dedupeKey: key ? `assigned:${key}:${userId}` : null, userId });
}

async function autoAssignOn() {
  const { rows } = await db.query(`SELECT value FROM app_settings WHERE key = 'preferences'`);
  return Boolean(rows[0]?.value?.ai?.autoAssign);
}

module.exports = { DEPARTMENTS, candidates, suggest, person, notifyAssignee, autoAssignOn };

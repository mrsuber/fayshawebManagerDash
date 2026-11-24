/**
 * The staff desk: what a team member needs besides their tasks, shared by My work (/api/work, the team member) and
 * FAY OS → Team desk (/api/manager/staff-desk, the managers).
 *
 *  - Messages: one conversation per team member with the managers, optionally about a task, with photos.
 *  - Time off: their leave balances and requests (HR tables: leave_types, employee_leave_balance, leave_requests);
 *    managers decide in Team desk or HQ → Approvals (routes/leave.js decideLeave).
 *  - Warnings: given by a manager, seen and acknowledged by the team member (with their side if they want).
 *  - Clock in / out: employee_attendance, from the phone.
 *
 * A team member without an HR record (employees.user_id) can use messages and warnings; time off and the clock need
 * HR to add them (HQ → Staff).
 */
const db = require('../config/database');
const { staffAlert } = require('./notify');

const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';
const iso = (d) => (d ? new Date(d).toISOString() : null);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const fail = (status, message) => Object.assign(new Error(message), { status });

/** Only files this server stored (uploads/chat, and still there) can be attached. */
function cleanAttachments(list) {
  if (!Array.isArray(list)) return [];
  const { clean } = require('./attachments');
  return list.map(clean).filter(Boolean).slice(0, 6);
}

async function employeeOf(userId, q = db) {
  return (await q.query('SELECT id, first_name, last_name FROM employees WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId])).rows[0] || null;
}

// ---------------------------------------------------------------- Messages
const toMessage = (m) => ({
  id: m.id,
  fromStaff: m.from_staff,
  sender: m.sender_name || null,
  body: m.body,
  attachments: m.attachments || [],
  about: m.about || null,
  read: Boolean(m.read_at),
  at: iso(m.created_at),
});

async function messages(staffId, { limit = 100 } = {}) {
  const { rows } = await db.query(
    `SELECT m.*, u.full_name AS sender_name FROM staff_messages m LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.staff_id = $1 ORDER BY m.created_at DESC LIMIT $2`,
    [staffId, limit],
  );
  return rows.reverse().map(toMessage);
}

/** Marks the other side's messages read (the team member reads the managers' messages, and the other way round). */
async function markRead(staffId, byStaff) {
  await db.query(`UPDATE staff_messages SET read_at = NOW() WHERE staff_id = $1 AND from_staff = $2 AND read_at IS NULL`, [staffId, !byStaff]);
}

/** Sends a message in a team member's conversation. The other side is told (bell, push, socket). */
async function send(app, { staffId, sender, fromStaff, body, attachments, about }) {
  const text = String(body || '').trim().slice(0, 4000);
  const files = cleanAttachments(attachments);
  if (!text && !files.length) throw fail(400, 'Write a message or add a photo');
  let ref = null;
  if (about && ['request', 'work_order'].includes(about.kind) && Number(about.id)) {
    const table = about.kind === 'request' ? 'service_requests' : 'work_orders';
    const row = (await db.query(`SELECT id, title FROM ${table} WHERE id = $1`, [about.id])).rows[0];
    if (row) ref = { kind: about.kind, id: row.id, title: row.title };
  }
  const { rows } = await db.query(
    `INSERT INTO staff_messages (staff_id, sender_id, from_staff, body, attachments, about) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [staffId, sender.id, fromStaff, text, JSON.stringify(files), ref ? JSON.stringify(ref) : null],
  );
  const preview = `${ref ? `[${ref.title}] ` : ''}${text || (files.length ? '📷 Photo' : '')}`.slice(0, 160);
  if (fromStaff) {
    await staffAlert(app, { title: `Message from ${sender.fullName}`, body: preview, link: `/team?staff=${staffId}`, level: 'action', category: 'team' });
  } else {
    await staffAlert(app, { title: `Message from ${sender.fullName}`, body: preview, link: '/work?tab=messages', level: 'action', category: 'team', userId: staffId });
  }
  const io = app && app.get && app.get('io');
  const msg = toMessage({ ...rows[0], sender_name: sender.fullName });
  if (io) {
    io.to('staff').emit('staff-message:new', { staffId, message: msg });
    io.to(`user_${staffId}`).emit('staff-message:new', { staffId, message: msg });
  }
  return msg;
}

/** FAY OS: every team member who has a conversation, newest first, with unread counts. */
async function inbox() {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, COALESCE(u.department, '') AS department, u.job_title,
            last.body, last.created_at, last.from_staff,
            (SELECT COUNT(*) FROM staff_messages x WHERE x.staff_id = u.id AND x.from_staff AND x.read_at IS NULL)::int AS unread
       FROM users u
       JOIN LATERAL (SELECT body, created_at, from_staff, attachments FROM staff_messages m WHERE m.staff_id = u.id ORDER BY created_at DESC LIMIT 1) last ON TRUE
      ORDER BY last.created_at DESC`,
  );
  return rows.map((r) => ({ id: r.id, name: r.full_name, department: r.department || null, jobTitle: r.job_title, last: { body: r.body || '📷 Photo', at: iso(r.created_at), fromStaff: r.from_staff }, unread: r.unread }));
}

// ---------------------------------------------------------------- Time off
async function leaveFor(userId) {
  const emp = await employeeOf(userId);
  if (!emp) return { available: false, types: [], requests: [] };
  const year = new Date().getFullYear();
  const [types, requests] = await Promise.all([
    db.query(
      `SELECT t.id, t.name, t.is_paid, t.days_per_year, b.total_days, b.remaining_days,
              COALESCE((SELECT SUM(number_of_days) FROM leave_requests r WHERE r.employee_id = $1 AND r.leave_type_id = t.id AND r.status = 'pending'), 0) AS pending_days
         FROM leave_types t LEFT JOIN employee_leave_balance b ON b.leave_type_id = t.id AND b.employee_id = $1 AND b.year = $2
        WHERE t.is_active ORDER BY t.id`,
      [emp.id, year],
    ),
    db.query(
      `SELECT r.*, t.name AS type_name, u.full_name AS decided_by FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
         LEFT JOIN users u ON u.id = r.approved_by WHERE r.employee_id = $1 ORDER BY r.requested_at DESC LIMIT 30`,
      [emp.id],
    ),
  ]);
  return {
    available: true,
    types: types.rows.map((t) => {
      const total = t.total_days === null ? Number(t.days_per_year) : Number(t.total_days);
      const remaining = t.remaining_days === null ? Number(t.days_per_year) : Number(t.remaining_days);
      return { id: t.id, name: t.name, paid: t.is_paid, total, remaining, pending: Number(t.pending_days), limited: Number(t.days_per_year) > 0 || t.total_days !== null };
    }),
    requests: requests.rows.map(toLeave),
  };
}

const toLeave = (r) => ({
  id: r.id,
  type: r.type_name,
  from: day(r.start_date),
  to: day(r.end_date),
  days: Number(r.number_of_days),
  reason: r.reason,
  status: r.status,
  decidedBy: r.decided_by || null,
  rejectionReason: r.rejection_reason || null,
  requestedAt: iso(r.requested_at),
});

/** A team member asks for time off; the managers (Team desk) and HQ (Approvals) see it. */
async function requestLeave(app, user, { leaveTypeId, from, to, reason }) {
  const emp = await employeeOf(user.id);
  if (!emp) throw fail(409, 'Your HR record is not set up yet — ask HR to add you (HQ → Staff)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) throw fail(400, 'Choose the first and last day');
  if (to < from) throw fail(400, 'The last day must be on or after the first day');
  const today = (await db.query(`SELECT (NOW() AT TIME ZONE $1)::date::text AS d`, [TZ])).rows[0].d;
  if (from < today) throw fail(400, 'Choose days from today on');
  const why = String(reason || '').trim().slice(0, 1000);
  if (!why) throw fail(400, 'Say in a few words why');
  const type = (await db.query('SELECT * FROM leave_types WHERE id = $1 AND is_active', [leaveTypeId])).rows[0];
  if (!type) throw fail(400, 'Choose the kind of leave');
  const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  if (type.max_consecutive_days && days > type.max_consecutive_days) throw fail(400, `${type.name}: up to ${type.max_consecutive_days} days in a row`);
  const overlap = await db.query(
    `SELECT 1 FROM leave_requests WHERE employee_id = $1 AND status IN ('pending', 'approved') AND start_date <= $3 AND end_date >= $2 LIMIT 1`,
    [emp.id, from, to],
  );
  if (overlap.rows.length) throw fail(409, 'You already have leave asked or approved on some of these days');
  const summary = (await leaveFor(user.id)).types.find((t) => t.id === type.id);
  if (summary && summary.limited && days > summary.remaining - summary.pending) {
    throw fail(400, `${type.name}: ${Math.max(0, summary.remaining - summary.pending)} day(s) left this year (${days} asked)`);
  }
  const { rows } = await db.query(
    `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, number_of_days, reason) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [emp.id, type.id, from, to, days, why],
  );
  await staffAlert(app, {
    title: `Time off asked · ${user.fullName}`,
    body: `${type.name} · ${from} → ${to} (${days} day${days > 1 ? 's' : ''}) · ${why.slice(0, 100)}`,
    link: '/team?tab=leave',
    level: 'action',
    category: 'team',
    dedupeKey: `leave:${rows[0].id}`,
  });
  return toLeave({ ...rows[0], type_name: type.name });
}

async function cancelLeave(app, userId, id) {
  const emp = await employeeOf(userId);
  const { rows } = await db.query(
    `UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND employee_id = $2 AND status = 'pending' RETURNING id`,
    [id, emp?.id || 0],
  );
  if (!rows[0]) throw fail(409, 'Only a request still waiting can be cancelled');
  await require('./notify').resolve(app, `leave:${id}`);
}

/** FAY OS: time off asked and coming up, for everyone. */
async function leaveBoard() {
  const { rows } = await db.query(
    `SELECT r.*, t.name AS type_name, u.full_name AS decided_by, e.user_id, COALESCE(su.full_name, e.first_name || ' ' || e.last_name) AS staff_name
       FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id JOIN employees e ON e.id = r.employee_id
       LEFT JOIN users su ON su.id = e.user_id LEFT JOIN users u ON u.id = r.approved_by
      WHERE r.status = 'pending' OR (r.status = 'approved' AND r.end_date >= CURRENT_DATE) OR r.updated_at > NOW() - INTERVAL '14 days'
      ORDER BY r.status = 'pending' DESC, r.start_date LIMIT 200`,
  );
  return rows.map((r) => ({ ...toLeave(r), staff: { id: r.user_id, name: r.staff_name } }));
}

// ---------------------------------------------------------------- Warnings
const LEVEL = { verbal: 'Verbal warning', written: 'Written warning', final: 'Final warning' };
const toWarning = (w) => ({
  id: w.id,
  level: w.level,
  label: LEVEL[w.level],
  reason: w.reason,
  by: w.issued_by_name || null,
  at: iso(w.created_at),
  acknowledgedAt: iso(w.acknowledged_at),
  response: w.response || null,
  staff: w.staff_name ? { id: w.staff_id, name: w.staff_name } : undefined,
});

async function warnings(staffId) {
  const { rows } = await db.query(
    `SELECT w.*, u.full_name AS issued_by_name FROM staff_warnings w LEFT JOIN users u ON u.id = w.issued_by WHERE w.staff_id = $1 ORDER BY w.created_at DESC`,
    [staffId],
  );
  return rows.map(toWarning);
}

async function allWarnings() {
  const { rows } = await db.query(
    `SELECT w.*, u.full_name AS issued_by_name, s.full_name AS staff_name FROM staff_warnings w LEFT JOIN users u ON u.id = w.issued_by
       JOIN users s ON s.id = w.staff_id ORDER BY w.created_at DESC LIMIT 200`,
  );
  return rows.map(toWarning);
}

async function issueWarning(app, by, { staffId, level, reason }) {
  if (!LEVEL[level]) throw fail(400, 'Choose verbal, written or final');
  const why = String(reason || '').trim().slice(0, 2000);
  if (!why) throw fail(400, 'Write the reason: the team member reads it');
  const staff = (await db.query(`SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.name <> 'guest'`, [staffId])).rows[0];
  if (!staff) throw fail(400, 'Choose a team member');
  const { rows } = await db.query(`INSERT INTO staff_warnings (staff_id, level, reason, issued_by) VALUES ($1, $2, $3, $4) RETURNING *`, [staff.id, level, why, by.id]);
  await staffAlert(app, { title: `${LEVEL[level]} from ${by.fullName}`, body: why.slice(0, 200), link: '/work?tab=me', level: 'urgent', category: 'team', userId: staff.id });
  return toWarning({ ...rows[0], issued_by_name: by.fullName, staff_name: staff.full_name });
}

async function acknowledge(staffId, id, response) {
  const { rows } = await db.query(
    `UPDATE staff_warnings SET acknowledged_at = NOW(), response = $3 WHERE id = $1 AND staff_id = $2 AND acknowledged_at IS NULL RETURNING *`,
    [id, staffId, String(response || '').trim().slice(0, 2000) || null],
  );
  if (!rows[0]) throw fail(409, 'Already acknowledged');
  return toWarning(rows[0]);
}

// ---------------------------------------------------------------- Clock in / out
async function clock(userId) {
  const emp = await employeeOf(userId);
  if (!emp) return { available: false };
  const { rows } = await db.query(
    `SELECT * FROM employee_attendance WHERE employee_id = $1 AND clock_in_time > NOW() - INTERVAL '20 hours' ORDER BY clock_in_time DESC LIMIT 1`,
    [emp.id],
  );
  const a = rows[0];
  const week = (await db.query(
    `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out_time, LOCALTIMESTAMP) - clock_in_time)) / 3600), 0)::float AS h
       FROM employee_attendance WHERE employee_id = $1 AND clock_in_time > date_trunc('week', LOCALTIMESTAMP)`,
    [emp.id],
  )).rows[0].h;
  return { available: true, in: a && !a.clock_out_time ? iso(a.clock_in_time) : null, lastOut: a?.clock_out_time ? iso(a.clock_out_time) : null, weekHours: Math.round(week * 10) / 10 };
}

async function clockIn(userId) {
  const emp = await employeeOf(userId);
  if (!emp) throw fail(409, 'Your HR record is not set up yet — ask HR to add you');
  const open = await db.query(`SELECT 1 FROM employee_attendance WHERE employee_id = $1 AND clock_out_time IS NULL AND clock_in_time > NOW() - INTERVAL '20 hours'`, [emp.id]);
  if (open.rows.length) throw fail(409, 'You are already clocked in');
  await db.query(`INSERT INTO employee_attendance (employee_id, clock_in_time, clock_in_method, clock_in_location, status) VALUES ($1, LOCALTIMESTAMP, 'mobile', 'My work', 'present')`, [emp.id]);
  return clock(userId);
}

async function clockOut(userId) {
  const emp = await employeeOf(userId);
  const { rows } = await db.query(
    `UPDATE employee_attendance SET clock_out_time = LOCALTIMESTAMP, clock_out_method = 'mobile', clock_out_location = 'My work',
            total_hours = ROUND((EXTRACT(EPOCH FROM (LOCALTIMESTAMP - clock_in_time)) / 3600)::numeric, 2)
      WHERE id = (SELECT id FROM employee_attendance WHERE employee_id = $1 AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1) RETURNING id`,
    [emp?.id || 0],
  );
  if (!rows[0]) throw fail(409, 'You are not clocked in');
  return clock(userId);
}

module.exports = {
  cleanAttachments, employeeOf, messages, markRead, send, inbox, leaveFor, requestLeave, cancelLeave, leaveBoard,
  LEVEL, warnings, allWarnings, issueWarning, acknowledge, clock, clockIn, clockOut,
};

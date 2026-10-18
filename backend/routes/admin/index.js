/**
 * Faysha HQ API — the super administrator dashboard (/admin), mounted at /api/admin.
 *
 * Every route is guarded by an HQ area (middleware/hq.js): super administrators have them all, and other
 * roles get the areas their permissions grant (HQ → Roles & permissions). Responses are camelCase JSON;
 * errors are { message }.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { authenticateToken, checkPasswordChangeRequired } = require('../../middleware/auth');
const { HQ_AREAS, HQ_ACTIONS, hasArea, areasOf, requireArea } = require('../../middleware/hq');
const { db, ah, httpError, isoDate, camelRow } = require('../manager/lib');
const { processRefund } = require('../payments');
const { decideLeave } = require('../leave');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const signedIn = [authenticateToken, checkPasswordChangeRequired];
const num = (v) => Number(v || 0);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const propertyParam = (req) => (req.query.property && /^\d+$/.test(req.query.property) ? Number(req.query.property) : null);

// ======================================================================
// Me — who is signed in and which HQ areas they can open
// ======================================================================
router.get(
  '/me',
  signedIn,
  ah(async (req, res) => {
    const areas = areasOf(req.user);
    if (!areas.length) throw httpError(403, 'Your role has no access to HQ');
    const can = Object.fromEntries(HQ_AREAS.map((a) => [a, Object.fromEntries(HQ_ACTIONS.map((x) => [x, hasArea(req.user, a, x)]))]));
    res.json({
      user: { id: req.user.id, name: req.user.fullName, email: req.user.email, role: req.user.role, roleName: req.user.roleDisplayName },
      areas,
      can,
      legacy: req.user.role === 'superadmin',
      viewAs: Boolean(req.user.impersonatedBy),
    });
  }),
);

// ======================================================================
// Overview — the boss's morning view
// ======================================================================

/** Earned revenue per day (stays by night, plus services), the same rules as the manager's Analytics. */
async function dailyRevenue(from, to, property) {
  const { rows } = await db.query(
    `WITH days AS (SELECT d::date AS day FROM generate_series($1::date, $2::date, INTERVAL '1 day') d),
     nights AS (
       SELECT n::date AS night, b.final_price / GREATEST(b.number_of_nights, 1) AS revenue
         FROM bookings b JOIN apartments a ON a.id = b.apartment_id
         CROSS JOIN generate_series(b.check_in_date, b.check_out_date - 1, INTERVAL '1 day') n
        WHERE b.status <> 'cancelled' AND b.check_in_date <= $2::date AND b.check_out_date > $1::date
          AND ($3::int IS NULL OR a.property_id = $3)
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
       COALESCE((SELECT SUM(revenue) FROM nights WHERE night = d.day), 0) AS stays,
       COALESCE((SELECT SUM(total) FROM dining_orders WHERE created_at::date = d.day), 0) AS dining,
       COALESCE((SELECT SUM(amount_paid) FROM wellness_bookings WHERE status <> 'cancelled' AND booking_date = d.day), 0) AS wellness,
       COALESCE((SELECT SUM(total_price) FROM experience_bookings WHERE status <> 'cancelled' AND experience_date = d.day), 0) AS experiences,
       COALESCE((SELECT SUM(amount) FROM folio_charges WHERE source_type IS NULL AND created_at::date = d.day), 0) AS other
     FROM days d ORDER BY d.day`,
    [from, to, property],
  );
  return rows.map((r) => {
    const row = { day: r.day, stays: num(r.stays), dining: num(r.dining), wellness: num(r.wellness), experiences: num(r.experiences), other: num(r.other) };
    row.total = row.stays + row.dining + row.wellness + row.experiences + row.other;
    return row;
  });
}

const STREAMS = ['stays', 'dining', 'wellness', 'experiences', 'other'];
function sumRows(rows) {
  const t = Object.fromEntries([...STREAMS, 'total'].map((k) => [k, 0]));
  rows.forEach((r) => [...STREAMS, 'total'].forEach((k) => (t[k] += r[k])));
  return t;
}
const change = (now, before) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);

router.get(
  '/overview',
  requireArea('overview'),
  ah(async (req, res) => {
    const property = propertyParam(req);
    const today = isoDate(new Date());
    const monthStart = `${today.slice(0, 8)}01`;
    const dayOfMonth = Number(today.slice(8, 10));
    const prevMonthStart = (() => {
      const d = new Date(`${monthStart}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const prevMonthSameDay = addDays(prevMonthStart, dayOfMonth - 1);

    const [trend, mtdRows, prevRows, stays, approvals, money, ops, staff, leave, audit, stale] = await Promise.all([
      dailyRevenue(addDays(today, -13), today, property),
      dailyRevenue(monthStart, today, property),
      dailyRevenue(prevMonthStart, prevMonthSameDay, property),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM apartments a WHERE a.is_active = true AND ($2::int IS NULL OR a.property_id = $2))::int AS units,
           COUNT(*) FILTER (WHERE b.check_in_date = $1 AND b.status IN ('confirmed', 'pending'))::int AS arrivals,
           COUNT(*) FILTER (WHERE b.check_out_date = $1 AND b.status IN ('confirmed', 'checked_in'))::int AS departures,
           COUNT(*) FILTER (WHERE b.check_in_date <= $1 AND b.check_out_date > $1 AND b.status IN ('confirmed', 'checked_in'))::int AS in_house
         FROM bookings b JOIN apartments a ON a.id = b.apartment_id
         WHERE ($2::int IS NULL OR a.property_id = $2)`,
        [today, property],
      ),
      db.query(
        `SELECT (SELECT COUNT(*) FROM approvals WHERE status = 'pending')::int AS approvals,
                (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending')::int AS leave`,
      ),
      db.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS amount
           FROM payments WHERE payment_method = 'mobile_money' AND status = 'pending'`,
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM service_requests WHERE status IN ('pending','acknowledged','in_progress','escalated','on_hold','scheduled'))::int AS open_requests,
           (SELECT COUNT(*) FROM service_requests WHERE priority = 'urgent' AND status IN ('pending','acknowledged','in_progress','escalated'))::int AS urgent_requests,
           (SELECT COUNT(*) FROM maintenance_alerts WHERE LOWER(COALESCE(status, 'open')) NOT IN ('resolved','closed','dismissed','done'))::int AS alerts`,
      ),
      db.query(
        `SELECT COALESCE(NULLIF(u.department, ''), 'Unassigned') AS department, COUNT(*)::int AS count
           FROM users u JOIN roles r ON r.id = u.role_id
          WHERE u.deleted_at IS NULL AND u.status = 'active' AND r.name <> 'guest'
          GROUP BY 1 ORDER BY 2 DESC, 1`,
      ),
      db.query(
        `SELECT COUNT(*)::int AS count FROM leave_requests WHERE status = 'approved' AND $1::date BETWEEN start_date AND end_date`,
        [today],
      ),
      db.query('SELECT id, actor_name, actor_role, impersonated_by, summary, method, area, created_at FROM audit_log ORDER BY created_at DESC LIMIT 8'),
      db.query(
        `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'`,
      ),
    ]);

    const s = stays.rows[0];
    const mtd = sumRows(mtdRows);
    const prev = sumRows(prevRows);
    const todayRow = trend[trend.length - 1] || { total: 0 };
    const a = approvals.rows[0];
    const o = ops.rows[0];
    const m = money.rows[0];

    const alerts = [];
    if (m.count) alerts.push({ level: 'warning', icon: 'phone_iphone', text: `${m.count} mobile money payment${m.count > 1 ? 's' : ''} awaiting confirmation`, to: 'finance' });
    if (a.approvals + a.leave) alerts.push({ level: 'info', icon: 'approval', text: `${a.approvals + a.leave} decision${a.approvals + a.leave > 1 ? 's' : ''} waiting for you`, to: 'approvals' });
    if (o.urgent_requests) alerts.push({ level: 'danger', icon: 'priority_high', text: `${o.urgent_requests} urgent guest request${o.urgent_requests > 1 ? 's' : ''} open`, to: 'manager:requests' });
    if (o.alerts) alerts.push({ level: 'warning', icon: 'build', text: `${o.alerts} maintenance alert${o.alerts > 1 ? 's' : ''} open`, to: 'manager:maintenance' });
    if (stale.rows[0].count) alerts.push({ level: 'warning', icon: 'schedule', text: `${stale.rows[0].count} booking${stale.rows[0].count > 1 ? 's' : ''} unpaid for over 24 hours`, to: 'legacy:bookings' });
    if (!process.env.STRIPE_SECRET_KEY) alerts.push({ level: 'info', icon: 'credit_card_off', text: 'Card payments are not configured (STRIPE_SECRET_KEY)', to: null });
    if (!process.env.SMTP_USER) alerts.push({ level: 'info', icon: 'mail', text: 'Outgoing email is not configured (SMTP_USER)', to: null });

    const staffTotal = staff.rows.reduce((n, r) => n + r.count, 0);
    res.json({
      today,
      property,
      stays: { units: s.units, arrivals: s.arrivals, departures: s.departures, inHouse: s.in_house, occupancy: s.units ? Math.round((s.in_house / s.units) * 100) : 0 },
      revenue: { today: todayRow.total, mtd: mtd.total, mtdChange: change(mtd.total, prev.total), streams: mtd, trend },
      approvals: { pending: a.approvals + a.leave, leave: a.leave, other: a.approvals },
      mobileMoney: { count: m.count, amount: num(m.amount) },
      operations: { openRequests: o.open_requests, urgentRequests: o.urgent_requests, maintenanceAlerts: o.alerts },
      staff: { total: staffTotal, onLeaveToday: leave.rows[0].count, byDepartment: staff.rows },
      alerts,
      recentActivity: audit.rows.map((r) => camelRow(r)),
    });
  }),
);

// ======================================================================
// Finance
// ======================================================================
router.get(
  '/revenue',
  requireArea('finance'),
  ah(async (req, res) => {
    const today = isoDate(new Date());
    const to = isDate(req.query.to) ? req.query.to : today;
    const from = isDate(req.query.from) ? req.query.from : addDays(to, -29);
    if (from > to) throw httpError(400, 'from must be on or before to');
    const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    if (days > 731) throw httpError(400, 'Choose a range of two years or less');
    const property = propertyParam(req);

    const [series, prevSeries, byType, collected, occupancy] = await Promise.all([
      dailyRevenue(from, to, property),
      dailyRevenue(addDays(from, -days), addDays(from, -1), property),
      db.query(
        `SELECT c.display_name AS name, SUM(b.final_price / GREATEST(b.number_of_nights, 1))::numeric AS revenue, COUNT(*)::int AS nights
           FROM bookings b JOIN apartments a ON a.id = b.apartment_id JOIN apartment_categories c ON c.id = a.category_id
           CROSS JOIN generate_series(b.check_in_date, b.check_out_date - 1, INTERVAL '1 day') n
          WHERE b.status <> 'cancelled' AND n::date BETWEEN $1 AND $2 AND ($3::int IS NULL OR a.property_id = $3)
          GROUP BY c.display_name ORDER BY 2 DESC`,
        [from, to, property],
      ),
      db.query(
        `SELECT p.payment_method AS method,
                COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('completed', 'refunded')), 0) AS collected,
                COALESCE(SUM(COALESCE(p.refund_amount, p.amount)) FILTER (WHERE p.status = 'refunded'), 0) AS refunded,
                COUNT(*) FILTER (WHERE p.status IN ('completed', 'refunded'))::int AS count
           FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN apartments a ON a.id = b.apartment_id
          WHERE COALESCE(p.paid_at, p.created_at)::date BETWEEN $1 AND $2 AND ($3::int IS NULL OR a.property_id = $3)
          GROUP BY p.payment_method ORDER BY 2 DESC`,
        [from, to, property],
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM apartments a WHERE a.is_active = true AND ($3::int IS NULL OR a.property_id = $3))::int AS units,
           (SELECT COUNT(*) FROM bookings b JOIN apartments a ON a.id = b.apartment_id
              CROSS JOIN generate_series(b.check_in_date, b.check_out_date - 1, INTERVAL '1 day') n
             WHERE b.status <> 'cancelled' AND n::date BETWEEN $1 AND $2 AND ($3::int IS NULL OR a.property_id = $3))::int AS nights`,
        [from, to, property],
      ),
    ]);

    const totals = sumRows(series);
    const previous = sumRows(prevSeries);
    const occ = occupancy.rows[0];
    const available = occ.units * days;
    res.json({
      from,
      to,
      days,
      totals,
      previous,
      change: Object.fromEntries([...STREAMS, 'total'].map((k) => [k, change(totals[k], previous[k])])),
      series,
      byResidenceType: byType.rows.map((r) => ({ name: r.name, revenue: num(r.revenue), nights: r.nights })),
      collected: collected.rows.map((r) => ({ method: r.method, collected: num(r.collected), refunded: num(r.refunded), count: r.count })),
      occupancy: { nights: occ.nights, available, rate: available ? Math.round((occ.nights / available) * 1000) / 10 : 0 },
      adr: occ.nights ? Math.round(totals.stays / occ.nights) : 0,
      revpar: available ? Math.round(totals.stays / available) : 0,
    });
  }),
);

router.get(
  '/payments',
  requireArea('finance'),
  ah(async (req, res) => {
    const params = [];
    const where = [];
    const add = (sql, v) => {
      params.push(v);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (req.query.status) add('p.status = ?', req.query.status);
    if (req.query.method) add('p.payment_method = ?', req.query.method);
    if (req.query.q) add('(b.booking_number ILIKE ? OR b.guest_name ILIKE ? OR b.guest_email ILIKE ?)', `%${req.query.q}%`);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const { rows } = await db.query(
      `SELECT p.id, p.booking_id, p.payment_method AS method, p.amount, p.currency, p.status, p.paid_at, p.created_at, p.refund_amount,
              p.payment_metadata, b.booking_number, b.guest_name, b.guest_email, b.guest_phone, b.status AS booking_status,
              b.check_in_date, a.unit_number
         FROM payments p JOIN bookings b ON b.id = p.booking_id LEFT JOIN apartments a ON a.id = b.apartment_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.created_at DESC LIMIT ${limit}`,
      params,
    );
    res.json(
      rows.map((r) => {
        let meta = r.payment_metadata;
        if (typeof meta === 'string') {
          try {
            meta = JSON.parse(meta);
          } catch {
            meta = {};
          }
        }
        return {
          id: r.id, bookingId: r.booking_id, bookingNumber: r.booking_number, guestName: r.guest_name, guestEmail: r.guest_email,
          guestPhone: r.guest_phone, bookingStatus: r.booking_status, checkIn: r.check_in_date ? isoDate(r.check_in_date) : null, unit: r.unit_number,
          method: r.method, amount: num(r.amount), currency: r.currency, status: r.status, paidAt: r.paid_at, createdAt: r.created_at,
          refundAmount: r.refund_amount == null ? null : num(r.refund_amount),
          provider: meta?.provider || null, payerPhone: meta?.phone || null,
        };
      }),
    );
  }),
);

/** Records money received outside Stripe (mobile money, cash, transfer). The booking is then confirmed by staff. */
router.post(
  '/payments/:id/mark-paid',
  requireArea('finance', 'approve'),
  ah(async (req, res) => {
    const { rows } = await db.query(
      `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP, transaction_reference = COALESCE($2, transaction_reference)
        WHERE id = $1 AND status = 'pending' AND payment_method <> 'stripe' RETURNING id, booking_id`,
      [req.params.id, req.body?.reference || null],
    ).catch(async (e) => {
      // Older databases have no transaction_reference column.
      if (e.code !== '42703') throw e;
      return db.query(
        `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND status = 'pending' AND payment_method <> 'stripe' RETURNING id, booking_id`,
        [req.params.id],
      );
    });
    if (!rows.length) throw httpError(409, 'Only pending mobile money, cash or transfer payments can be marked as received');
    res.json({ ok: true, paymentId: rows[0].id, bookingId: rows[0].booking_id });
  }),
);

// ======================================================================
// Approvals — refunds, discounts, expenses, purchases, and HR leave in one queue
// ======================================================================
const APPROVAL_TYPES = ['refund', 'discount', 'expense', 'purchase', 'other'];

router.get(
  '/approvals',
  requireArea('approvals'),
  ah(async (req, res) => {
    const status = ['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(req.query.status) ? req.query.status : 'pending';
    const [items, leave] = await Promise.all([
      db.query(
        `SELECT ap.*, rq.full_name AS requested_by_name, dc.full_name AS decided_by_name
           FROM approvals ap LEFT JOIN users rq ON rq.id = ap.requested_by LEFT JOIN users dc ON dc.id = ap.decided_by
          WHERE ($1 = 'all' OR ap.status = $1) ORDER BY ap.created_at DESC LIMIT 200`,
        [status],
      ),
      db.query(
        `SELECT lr.*, e.first_name, e.last_name, e.job_title, d.name AS department, lt.name AS leave_type, dc.full_name AS decided_by_name
           FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
           LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
           LEFT JOIN users dc ON dc.id = lr.approved_by
          WHERE ($1 = 'all' OR lr.status = $1) ORDER BY lr.requested_at DESC LIMIT 200`,
        [status],
      ),
    ]);
    const list = [
      ...items.rows.map((r) => ({
        id: String(r.id), kind: 'approval', type: r.type, title: r.title, detail: r.detail, amount: r.amount == null ? null : num(r.amount),
        currency: r.currency, reference: r.reference_type ? { type: r.reference_type, id: r.reference_id } : null, status: r.status,
        requestedBy: r.requested_by_name, requestedAt: r.created_at, decidedBy: r.decided_by_name, decidedAt: r.decided_at, note: r.decision_note,
      })),
      ...leave.rows.map((r) => ({
        id: `leave-${r.id}`, kind: 'leave', type: 'leave', title: `${r.leave_type || 'Leave'} · ${r.first_name} ${r.last_name}`,
        detail: `${isoDate(r.start_date)} → ${isoDate(r.end_date)} (${num(r.number_of_days)} day${num(r.number_of_days) === 1 ? '' : 's'})${r.reason ? ` — ${r.reason}` : ''}`,
        amount: null, currency: null, reference: { type: 'leave_request', id: r.id }, status: r.status,
        requestedBy: `${r.first_name} ${r.last_name}${r.department ? ` · ${r.department}` : ''}`, requestedAt: r.requested_at,
        decidedBy: r.decided_by_name, decidedAt: r.approved_at, note: r.rejection_reason,
      })),
    ].sort((x, y) => new Date(y.requestedAt) - new Date(x.requestedAt));
    res.json(list);
  }),
);

/** Raise a request for a decision. Managers can raise them too (from FAY OS). */
router.post(
  '/approvals',
  signedIn,
  ah(async (req, res) => {
    if (!(['superadmin', 'manager'].includes(req.user.role) || hasArea(req.user, 'approvals'))) throw httpError(403, 'You cannot raise approval requests');
    const { type, title, detail, amount, referenceType, referenceId, propertyId } = req.body || {};
    if (!APPROVAL_TYPES.includes(type)) throw httpError(400, `type must be one of ${APPROVAL_TYPES.join(', ')}`);
    if (!title || !String(title).trim()) throw httpError(400, 'title is required');
    if (type === 'refund' && !(referenceType === 'payment' && referenceId)) throw httpError(400, 'A refund needs the payment it refunds (referenceType "payment", referenceId)');
    const { rows } = await db.query(
      `INSERT INTO approvals (type, title, detail, amount, reference_type, reference_id, requested_by, property_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [type, String(title).trim().slice(0, 200), detail || null, amount ?? null, referenceType || null, referenceId || null, req.user.id, propertyId || null],
    );
    res.status(201).json({ id: String(rows[0].id) });
  }),
);

router.post(
  '/approvals/:id/decide',
  requireArea('approvals', 'approve'),
  ah(async (req, res) => {
    const decision = req.body?.decision;
    const note = (req.body?.note || '').trim();
    if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'decision must be approved or rejected');

    const leaveMatch = /^leave-(\d+)$/.exec(req.params.id);
    if (leaveMatch) {
      if (!hasArea(req.user, 'hr', 'approve') && !hasArea(req.user, 'approvals', 'approve')) throw httpError(403, 'You cannot decide leave');
      await decideLeave(Number(leaveMatch[1]), decision, req.user.id, note || (decision === 'rejected' ? 'Not approved' : null));
      return res.json({ ok: true });
    }
    if (!/^\d+$/.test(req.params.id)) throw httpError(404, 'Approval not found');

    const { rows } = await db.query('SELECT * FROM approvals WHERE id = $1', [req.params.id]);
    const item = rows[0];
    if (!item) throw httpError(404, 'Approval not found');
    if (item.status !== 'pending') throw httpError(409, `This request is already ${item.status}`);
    if (item.requested_by === req.user.id && req.user.role !== 'superadmin') throw httpError(403, "You can't approve your own request");

    // An approved refund is carried out now; if the refund fails, the request stays pending.
    if (decision === 'approved' && item.type === 'refund' && item.reference_type === 'payment') {
      await processRefund(item.reference_id, item.amount, note || item.title);
    }
    await db.query(
      `UPDATE approvals SET status = $1, decided_by = $2, decided_at = CURRENT_TIMESTAMP, decision_note = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND status = 'pending'`,
      [decision, req.user.id, note || null, item.id],
    );
    res.json({ ok: true });
  }),
);

// ======================================================================
// Staff & departments
// ======================================================================
const STAFF_SELECT = `
  SELECT u.id, u.full_name, u.email, u.username, u.phone, u.status, u.job_title, u.department, u.last_login, u.created_at,
         u.must_change_password, u.locked_until, u.property_id, p.name AS property_name,
         r.id AS role_id, r.name AS role_name, r.display_name AS role_display_name,
         e.id AS employee_id, e.employee_number
    FROM users u JOIN roles r ON r.id = u.role_id
    LEFT JOIN properties p ON p.id = u.property_id
    LEFT JOIN LATERAL (SELECT id, employee_number FROM employees WHERE user_id = u.id ORDER BY id LIMIT 1) e ON true
   WHERE u.deleted_at IS NULL AND r.name <> 'guest'`;

const toStaff = (r) => ({
  id: r.id, name: r.full_name, email: r.email, username: r.username, phone: r.phone, status: r.status, jobTitle: r.job_title,
  department: r.department, lastLogin: r.last_login, createdAt: r.created_at, mustChangePassword: r.must_change_password,
  locked: Boolean(r.locked_until && new Date(r.locked_until) > new Date()),
  property: r.property_id ? { id: r.property_id, name: r.property_name } : null,
  role: { id: r.role_id, name: r.role_name, displayName: r.role_display_name },
  employee: r.employee_id ? { id: r.employee_id, number: r.employee_number } : null,
});

async function staffMember(id) {
  const { rows } = await db.query(`${STAFF_SELECT} AND u.id = $1`, [id]);
  if (!rows.length) throw httpError(404, 'Staff member not found');
  return rows[0];
}

async function roleById(id) {
  const { rows } = await db.query('SELECT * FROM roles WHERE id = $1', [id]);
  if (!rows.length) throw httpError(400, 'That role does not exist');
  if (rows[0].name === 'guest') throw httpError(400, 'Guests are not staff');
  return rows[0];
}

async function sendTempPassword({ name, email, password, roleName, reset }) {
  const emailService = require('../../services/email.service');
  const loginUrl = `${process.env.APP_URL || 'https://fayshaa.com'}/login`;
  const intro = reset ? 'Your Faysha password has been reset.' : `You have been added to the Faysha team as ${roleName}.`;
  return emailService
    .sendEmail({
      to: email,
      subject: reset ? 'Your Faysha password was reset' : 'Welcome to the Faysha team',
      text: `Hello ${name},\n\n${intro}\nSign in at ${loginUrl} with:\n  Email: ${email}\n  Temporary password: ${password}\n\nYou will be asked to choose a new password.`,
      html: `<p>Hello ${name},</p><p>${intro}</p><p>Sign in at <a href="${loginUrl}">${loginUrl}</a> with<br>Email: ${email}<br>Temporary password: <code>${password}</code></p><p>You will be asked to choose a new password.</p>`,
    })
    .then(() => true)
    .catch((e) => {
      console.error('Staff email failed:', e.message);
      return false;
    });
}

router.get(
  '/staff',
  requireArea('staff'),
  ah(async (req, res) => {
    const { rows } = await db.query(`${STAFF_SELECT} ORDER BY (r.name = 'superadmin') DESC, u.full_name`);
    res.json(rows.map(toStaff));
  }),
);

/** POST { name, email, roleId, department, jobTitle, propertyId, phone } — creates the account and emails a temporary password. */
router.post(
  '/staff',
  requireArea('staff', 'manage'),
  ah(async (req, res) => {
    const { name, email, roleId, department = null, jobTitle = null, propertyId = null, phone = null } = req.body || {};
    if (!name || !email || !roleId) throw httpError(400, 'name, email and role are required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email address');
    const role = await roleById(roleId);
    if (role.name === 'superadmin' && req.user.role !== 'superadmin') throw httpError(403, 'Only a super administrator can create another');
    const exists = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (exists.rows.length) throw httpError(409, 'A user with this email already exists');
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const username = `${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}_${crypto.randomInt(1000, 9999)}`;
    const { rows } = await db.query(
      `INSERT INTO users (email, username, password_hash, full_name, role_id, status, email_verified, is_password_temporary, must_change_password,
                          created_by, job_title, department, property_id, phone)
       VALUES ($1,$2,$3,$4,$5,'active',true,true,true,$6,$7,$8,$9,$10) RETURNING id`,
      [email.toLowerCase(), username, await bcrypt.hash(tempPassword, 10), name, role.id, req.user.id, jobTitle, department, propertyId, phone],
    );
    const emailed = await sendTempPassword({ name, email, password: tempPassword, roleName: role.display_name });
    // The temporary password is shown once to the creator only when the email could not be sent.
    res.status(201).json({ member: toStaff(await staffMember(rows[0].id)), emailed, tempPassword: emailed ? undefined : tempPassword });
  }),
);

/** PATCH { name, roleId, department, jobTitle, propertyId, phone, status: 'active' | 'inactive' } */
router.patch(
  '/staff/:id',
  requireArea('staff', 'manage'),
  ah(async (req, res) => {
    const target = await staffMember(req.params.id);
    const self = Number(req.params.id) === req.user.id;
    const isSuper = req.user.role === 'superadmin';
    if (target.role_name === 'superadmin' && !isSuper) throw httpError(403, 'Only a super administrator can change this account');
    const { name, roleId, department, jobTitle, propertyId, phone, status } = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, v) => {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    };
    if (name !== undefined) set('full_name', name);
    if (department !== undefined) set('department', department || null);
    if (jobTitle !== undefined) set('job_title', jobTitle || null);
    if (phone !== undefined) set('phone', phone || null);
    if (propertyId !== undefined) set('property_id', propertyId || null);
    if (roleId !== undefined && Number(roleId) !== target.role_id) {
      if (self) throw httpError(400, "You can't change your own role");
      const role = await roleById(roleId);
      if (role.name === 'superadmin' && !isSuper) throw httpError(403, 'Only a super administrator can grant that role');
      set('role_id', role.id);
    }
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) throw httpError(400, 'status must be active or inactive');
      if (self && status !== 'active') throw httpError(400, "You can't deactivate your own account");
      set('status', status);
    }
    if (sets.length) {
      params.push(req.params.id);
      await db.query(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`, params);
    }
    res.json(toStaff(await staffMember(req.params.id)));
  }),
);

router.post(
  '/staff/:id/reset-password',
  requireArea('staff', 'manage'),
  ah(async (req, res) => {
    const target = await staffMember(req.params.id);
    if (target.role_name === 'superadmin' && req.user.role !== 'superadmin') throw httpError(403, 'Only a super administrator can reset this password');
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    await db.query(
      `UPDATE users SET password_hash = $1, is_password_temporary = true, must_change_password = true, login_attempts = 0, locked_until = NULL,
                        updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [await bcrypt.hash(tempPassword, 10), target.id],
    );
    const emailed = await sendTempPassword({ name: target.full_name, email: target.email, password: tempPassword, reset: true });
    res.json({ emailed, tempPassword: emailed ? undefined : tempPassword });
  }),
);

/**
 * View as: a 30-minute, read-only session as another staff member, so the boss can see exactly what they
 * see. Only super administrators, never as another super administrator. Every change is refused for the
 * token (middleware/auth.js), and starting a session is recorded in the audit log.
 */
router.post(
  '/staff/:id/view-as',
  signedIn,
  ah(async (req, res) => {
    if (req.user.role !== 'superadmin' || req.user.impersonatedBy) throw httpError(403, 'Only a super administrator can view as someone else');
    const target = await staffMember(req.params.id);
    if (target.role_name === 'superadmin') throw httpError(400, "You can't view as another super administrator");
    if (target.status !== 'active') throw httpError(400, 'That account is not active');
    const { rows } = await db.query('SELECT permissions, display_name FROM roles WHERE id = $1', [target.role_id]);
    const expiresIn = 30 * 60;
    const token = jwt.sign({ userId: target.id, email: target.email, role: target.role_name, imp: req.user.id }, JWT_SECRET, { expiresIn });
    res.json({
      token,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      user: {
        id: target.id, email: target.email, username: target.username, name: target.full_name, role: target.role_name,
        roleDisplayName: rows[0].display_name, permissions: rows[0].permissions, emailVerified: true,
        mustChangePassword: false, isPasswordTemporary: false, viewAs: true,
      },
    });
  }),
);

router.get(
  '/departments',
  requireArea('staff'),
  ah(async (req, res) => {
    const { rows } = await db.query(
      `WITH names AS (
         SELECT name FROM departments WHERE is_active IS NOT FALSE
         UNION SELECT department FROM users WHERE department IS NOT NULL AND department <> '' AND deleted_at IS NULL
       )
       SELECT n.name, d.id, d.description, d.manager_id, m.full_name AS manager_name,
              (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.department = n.name AND u.deleted_at IS NULL AND u.status = 'active' AND r.name <> 'guest')::int AS staff,
              (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.is_active IS NOT FALSE)::int AS employees
         FROM names n LEFT JOIN departments d ON d.name = n.name LEFT JOIN users m ON m.id = d.manager_id
        ORDER BY n.name`,
    );
    res.json(rows.map((r) => ({ id: r.id, name: r.name, description: r.description, manager: r.manager_id ? { id: r.manager_id, name: r.manager_name } : null, staff: r.staff, employees: r.employees })));
  }),
);

router.post(
  '/departments',
  requireArea('staff', 'manage'),
  ah(async (req, res) => {
    const { name, description = null, managerId = null } = req.body || {};
    if (!name || !String(name).trim()) throw httpError(400, 'name is required');
    const { rows } = await db.query(
      `INSERT INTO departments (name, description, manager_id, is_active) VALUES ($1,$2,$3,true) RETURNING id`,
      [String(name).trim(), description, managerId],
    );
    res.status(201).json({ id: rows[0].id });
  }),
);

router.patch(
  '/departments/:id',
  requireArea('staff', 'manage'),
  ah(async (req, res) => {
    const { description, managerId } = req.body || {};
    const { rowCount } = await db.query(
      `UPDATE departments SET description = COALESCE($1, description), manager_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [description ?? null, managerId || null, req.params.id],
    );
    if (!rowCount) throw httpError(404, 'Department not found');
    res.json({ ok: true });
  }),
);

// ======================================================================
// Roles & permissions
// ======================================================================
const ROLE_NAME = /^[a-z][a-z0-9_]{2,39}$/;

function cleanPermissions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw httpError(400, 'permissions must be an object');
  const out = {};
  Object.entries(input).forEach(([resource, actions]) => {
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(resource) || !actions || typeof actions !== 'object' || Array.isArray(actions)) {
      throw httpError(400, `Invalid permissions for "${resource}"`);
    }
    out[resource] = {};
    Object.entries(actions).forEach(([action, allowed]) => {
      if (!/^[a-z][a-z0-9_]{1,30}$/.test(action) || typeof allowed !== 'boolean') throw httpError(400, `Invalid permission "${resource}.${action}"`);
      out[resource][action] = allowed;
    });
  });
  return out;
}

router.get(
  '/roles',
  requireArea('roles'),
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL)::int AS members
         FROM roles r ORDER BY (r.name = 'superadmin') DESC, r.is_system_role DESC, r.display_name`,
    );
    res.json(
      rows.map((r) => ({
        id: r.id, name: r.name, displayName: r.display_name, description: r.description, permissions: r.permissions || {},
        system: r.is_system_role, members: r.members, locked: r.name === 'superadmin', isGuest: r.name === 'guest',
      })),
    );
  }),
);

router.post(
  '/roles',
  requireArea('roles', 'manage'),
  ah(async (req, res) => {
    const { name, displayName, description = null, permissions = {} } = req.body || {};
    if (!ROLE_NAME.test(name || '')) throw httpError(400, 'Role key must be 3–40 lower-case letters, digits or underscores, starting with a letter');
    if (!displayName) throw httpError(400, 'displayName is required');
    const { rows } = await db.query(
      `INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES ($1,$2,$3,$4,false) RETURNING id`,
      [name, displayName, description, JSON.stringify(cleanPermissions(permissions))],
    );
    res.status(201).json({ id: rows[0].id });
  }),
);

router.patch(
  '/roles/:id',
  requireArea('roles', 'manage'),
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    const role = rows[0];
    if (!role) throw httpError(404, 'Role not found');
    if (role.name === 'superadmin') throw httpError(400, 'The super administrator role always has full access');
    const { displayName, description, permissions } = req.body || {};
    await db.query(
      `UPDATE roles SET display_name = COALESCE($1, display_name), description = COALESCE($2, description),
                        permissions = COALESCE($3::jsonb, permissions), updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
      [displayName || null, description ?? null, permissions ? JSON.stringify(cleanPermissions(permissions)) : null, role.id],
    );
    res.json({ ok: true });
  }),
);

router.delete(
  '/roles/:id',
  requireArea('roles', 'manage'),
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL)::int AS members FROM roles r WHERE r.id = $1`,
      [req.params.id],
    );
    const role = rows[0];
    if (!role) throw httpError(404, 'Role not found');
    if (role.is_system_role) throw httpError(400, 'Built-in roles cannot be deleted');
    if (role.members) throw httpError(409, `Move the ${role.members} member${role.members > 1 ? 's' : ''} of this role to another role first`);
    await db.query('DELETE FROM roles WHERE id = $1', [role.id]);
    res.json({ ok: true });
  }),
);

// ======================================================================
// Audit log
// ======================================================================
router.get(
  '/audit',
  requireArea('audit'),
  ah(async (req, res) => {
    const params = [];
    const where = [];
    const add = (sql, v) => {
      params.push(v);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (req.query.actor && /^\d+$/.test(req.query.actor)) add('l.actor_id = ?', Number(req.query.actor));
    if (req.query.area) add('l.area = ?', req.query.area);
    if (req.query.q) add('(l.summary ILIKE ? OR l.actor_name ILIKE ? OR l.path ILIKE ?)', `%${req.query.q}%`);
    if (isDate(req.query.from)) add('l.created_at >= ?::date', req.query.from);
    if (isDate(req.query.to)) add("l.created_at < (?::date + INTERVAL '1 day')", req.query.to);
    if (req.query.viewAs === 'true') where.push('l.impersonated_by IS NOT NULL');
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [list, count, areas] = await Promise.all([
      db.query(
        `SELECT l.*, imp.full_name AS impersonated_by_name FROM audit_log l LEFT JOIN users imp ON imp.id = l.impersonated_by
         ${whereSql} ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      db.query(`SELECT COUNT(*)::int AS n FROM audit_log l ${whereSql}`, params),
      db.query('SELECT DISTINCT area FROM audit_log WHERE area IS NOT NULL ORDER BY area'),
    ]);
    res.json({
      total: count.rows[0].n,
      areas: areas.rows.map((r) => r.area),
      items: list.rows.map((r) => ({
        id: String(r.id), actorId: r.actor_id, actorName: r.actor_name, actorRole: r.actor_role, viewAsBy: r.impersonated_by_name,
        method: r.method, path: r.path, area: r.area, entity: r.entity, entityId: r.entity_id, action: r.action, summary: r.summary,
        ip: r.ip, createdAt: r.created_at,
      })),
    });
  }),
);

router.get(
  '/audit/sign-ins',
  requireArea('audit'),
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT h.id, h.user_id, u.full_name, u.email, r.name AS role, h.ip_address::text AS ip, h.user_agent, h.login_successful, h.failure_reason, h.created_at
         FROM login_history h LEFT JOIN users u ON u.id = h.user_id LEFT JOIN roles r ON r.id = u.role_id
        WHERE r.name IS DISTINCT FROM 'guest'
        ORDER BY h.created_at DESC LIMIT 100`,
    );
    res.json(rows.map((r) => ({ id: r.id, userId: r.user_id, name: r.full_name, email: r.email, role: r.role, ip: r.ip, userAgent: r.user_agent, success: r.login_successful, reason: r.failure_reason, at: r.created_at })));
  }),
);

// ======================================================================
// Properties
// ======================================================================
router.get(
  '/properties',
  signedIn,
  ah(async (req, res) => {
    if (!areasOf(req.user).length) throw httpError(403, 'Your role has no access to HQ');
    const { rows } = await db.query(
      `SELECT p.*, (SELECT COUNT(*) FROM apartments a WHERE a.property_id = p.id AND a.is_active = true)::int AS units,
              (SELECT COUNT(*) FROM users u WHERE u.property_id = p.id AND u.deleted_at IS NULL)::int AS staff
         FROM properties p ORDER BY p.id`,
    );
    res.json(rows.map((r) => ({ ...camelRow(r), units: r.units, staff: r.staff })));
  }),
);

const PROPERTY_FIELDS = { code: 'code', name: 'name', city: 'city', country: 'country', address: 'address', timezone: 'timezone', currency: 'currency', status: 'status', openedOn: 'opened_on' };

router.post(
  '/properties',
  requireArea('properties', 'manage'),
  ah(async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.code) throw httpError(400, 'name and code are required');
    const cols = Object.entries(PROPERTY_FIELDS).filter(([k]) => b[k] !== undefined && b[k] !== '');
    const { rows } = await db.query(
      `INSERT INTO properties (${cols.map(([, c]) => c).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      cols.map(([k]) => (k === 'code' ? String(b[k]).toUpperCase() : b[k])),
    );
    res.status(201).json({ id: rows[0].id });
  }),
);

router.patch(
  '/properties/:id',
  requireArea('properties', 'manage'),
  ah(async (req, res) => {
    const b = req.body || {};
    const cols = Object.entries(PROPERTY_FIELDS).filter(([k]) => b[k] !== undefined);
    if (!cols.length) return res.json({ ok: true });
    const { rowCount } = await db.query(
      `UPDATE properties SET ${cols.map(([, c], i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${cols.length + 1}`,
      [...cols.map(([k]) => (b[k] === '' ? null : k === 'code' ? String(b[k]).toUpperCase() : b[k])), req.params.id],
    );
    if (!rowCount) throw httpError(404, 'Property not found');
    return res.json({ ok: true });
  }),
);

// ======================================================================
router.use((req, res) => res.status(404).json({ message: `No HQ route ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const pg = { 23505: [409, 'That already exists'], 23503: [400, 'A linked record does not exist'], '22P02': [400, 'Invalid value'], 22007: [400, 'Invalid date'], 23514: [400, 'A value is out of range'] };
  const [status, message] = err.status ? [err.status, err.message] : pg[err.code] || [500, 'Something went wrong'];
  if (status >= 500) console.error('HQ API error:', req.method, req.originalUrl, err);
  res.status(status).json({ message });
});

module.exports = router;
module.exports.dailyRevenue = dailyRevenue;

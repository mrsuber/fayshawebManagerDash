/**
 * Service requests (table from migration 019/020), in the dashboard's vocabulary.
 */

const express = require('express');
const { notifyGuest } = require('../../services/guestPush');
const { db, ah, httpError, isoTime, emit, addTimeline, notify, findGuest } = require('./lib');

const router = express.Router();

const STATUS_IN = { New: 'pending', 'In Progress': 'in_progress', Completed: 'completed', Scheduled: 'scheduled', Escalated: 'escalated', 'On Hold': 'on_hold', Cancelled: 'cancelled' };
const STATUS_OUT = { pending: 'New', acknowledged: 'In Progress', ...Object.fromEntries(Object.entries(STATUS_IN).map(([k, v]) => [v, k])) };
const PRIORITY_IN = { High: 'high', Normal: 'normal', Low: 'low', Urgent: 'urgent' };
const PRIORITY_OUT = { urgent: 'High', high: 'High', normal: 'Normal', low: 'Low' };
const TYPE_OF = { Housekeeping: 'housekeeping', Maintenance: 'maintenance', Dining: 'dining', Wellness: 'wellness', Transportation: 'transport', Experiences: 'experience', Concierge: 'concierge' };
const DEPT_OF = Object.fromEntries(Object.entries(TYPE_OF).map(([k, v]) => [v, k]));

const SELECT = `SELECT r.*, COALESCE(r.guest_name, u.full_name) AS display_name FROM service_requests r LEFT JOIN users u ON u.id = r.guest_id`;

function toRequest(r) {
  return {
    id: r.id,
    number: r.request_number,
    createdAt: isoTime(r.created_at),
    guestId: r.guest_id,
    guestName: r.display_name || '',
    title: r.title,
    location: r.location || '',
    priority: PRIORITY_OUT[r.priority] || 'Normal',
    status: STATUS_OUT[r.status] || r.status,
    department: r.department || DEPT_OF[r.request_type] || 'Concierge',
    notes: r.description || '',
  };
}

async function one(id) {
  const { rows } = await db.query(`${SELECT} WHERE r.id = $1`, [id]);
  if (!rows.length) throw httpError(404, 'Request not found');
  return toRequest(rows[0]);
}

router.get(
  '/',
  ah(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.guestId) {
      params.push(req.query.guestId);
      where.push(`r.guest_id = $${params.length}`);
    }
    if (req.query.department) {
      params.push(req.query.department, TYPE_OF[req.query.department] || null);
      where.push(`(r.department = $${params.length - 1} OR (r.department IS NULL AND r.request_type::text = $${params.length}))`);
    }
    const { rows } = await db.query(`${SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY r.created_at DESC LIMIT 500`, params);
    res.json(rows.map(toRequest));
  }),
);

/** POST { guestId, title, department, priority, location, notes } */
router.post(
  '/',
  ah(async (req, res) => {
    const { guestId, guestName, title, department = 'Concierge', priority = 'Normal', location, notes } = req.body || {};
    if (!title) throw httpError(400, 'title is required');
    if (!TYPE_OF[department]) throw httpError(400, `Unknown department "${department}"`);
    const guest = await findGuest(null, guestId);
    const { rows } = await db.query(
      `WITH n AS (SELECT nextval(pg_get_serial_sequence('service_requests', 'id')) AS id)
       INSERT INTO service_requests (id, request_number, guest_id, guest_name, booking_id, apartment_id, request_type, department, title, description, priority, location, metadata)
       SELECT n.id, '#' || n.id, $1, $2,
              (SELECT id FROM bookings WHERE user_id = $1 AND status IN ('checked_in', 'confirmed') ORDER BY status = 'checked_in' DESC, check_in_date LIMIT 1),
              (SELECT apartment_id FROM bookings WHERE user_id = $1 AND status IN ('checked_in', 'confirmed') ORDER BY status = 'checked_in' DESC, check_in_date LIMIT 1),
              $3, $4, $5, $6, $7, $8, $9
         FROM n RETURNING id`,
      [
        guest?.id ?? null,
        guest ? null : guestName || null,
        TYPE_OF[department],
        department,
        title,
        notes || null,
        PRIORITY_IN[priority] || 'normal',
        location || null,
        JSON.stringify({ createdBy: req.user.id }),
      ],
    );
    const request = await one(rows[0].id);
    emit(req, 'service-request:created', request);
    await notify(req, `New ${department} request`, `${title}${request.guestName ? ` · ${request.guestName}` : ''}`, { link: '/requests' });
    res.status(201).json(request);
  }),
);

/** PATCH { status?, priority?, department?, location?, notes? } */
router.patch(
  '/:id',
  ah(async (req, res) => {
    const before = await one(req.params.id);
    const { status, priority, department, location, notes, title } = req.body || {};
    const sets = [];
    const params = [];
    const set = (sql, v) => {
      params.push(v);
      sets.push(`${sql} = $${params.length}`);
    };
    if (status !== undefined) {
      if (!STATUS_IN[status]) throw httpError(400, `Unknown status "${status}"`);
      set('status', STATUS_IN[status]);
      if (status === 'In Progress') sets.push('started_at = COALESCE(started_at, NOW())');
      if (status === 'Completed') sets.push('completed_at = NOW()');
      if (status === 'Cancelled') sets.push('cancelled_at = NOW()');
    }
    if (priority !== undefined) set('priority', PRIORITY_IN[priority] || 'normal');
    if (department !== undefined) {
      if (!TYPE_OF[department]) throw httpError(400, `Unknown department "${department}"`);
      set('department', department);
      set('request_type', TYPE_OF[department]);
    }
    if (location !== undefined) set('location', location);
    if (notes !== undefined) set('description', notes);
    if (title !== undefined) set('title', title);
    if (sets.length) {
      params.push(req.params.id);
      await db.query(`UPDATE service_requests SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    }
    const request = await one(req.params.id);
    if (status && status !== before.status) {
      await addTimeline(null, request.guestId, `${request.title} – ${status}`, 'Service Request', { performedBy: req.user.id });
      const words = { 'In Progress': 'is being taken care of', Completed: 'is done', Scheduled: 'is scheduled', Cancelled: 'was cancelled', 'On Hold': 'is on hold' };
      if (request.guestId && words[status]) {
        notifyGuest(req.app, request.guestId, { title: `${request.department}`, body: `Your request “${request.title}” ${words[status]}.`, event: 'request:updated', data: { id: request.id, status, screen: 'Requests' } });
      }
      if (status === 'Escalated') await notify(req, 'Request escalated', `${request.title} · ${request.department}`, { link: '/requests' });
    }
    emit(req, 'service-request:updated', request);
    res.json(request);
  }),
);

module.exports = router;

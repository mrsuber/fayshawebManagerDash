/**
 * My work — /api/work. Every team member (any signed-in role except guest) sees the work assigned to them and moves
 * it forward: service requests, wellness sessions, work orders, and the events they lead. The web page is /work;
 * the staff app will use the same endpoints.
 *
 *   GET  /                                 { me, requests, wellness, workOrders, events, ratings, timing }
 *
 * Requests and work orders carry `timer` (services/taskTimer): the clock starts when the task is given to me and keeps
 * counting past the time allowed, so I can see I am late. `timing` is my record over 30 days (on time, average time).
 *   POST /requests/:id/start               I'm on it (the guest is told)
 *   POST /requests/:id/done   { note }     done, with what was done (the guest is told and asked to rate it)
 *   POST /wellness/check-in   { code }     the guest's booking code (or PIN journey code) — my sessions or unassigned ones
 *   POST /wellness/:id/complete | /no-show
 *   POST /work-orders/:id/start
 *   POST /work-orders/:id/done { note, cost, photos? }
 *
 * The rest of the staff desk (services/staffDesk):
 *   POST /photos                multipart "file" → { url, name, type } (a photo of the work, for "done" or a message)
 *   POST /messages              { body, attachments?, about?: { kind: request | work_order, id } } — to the managers
 *   POST /messages/read
 *   POST /leave                 { leaveTypeId, from, to, reason } — time off, decided in FAY OS → Team desk or HQ
 *   POST /leave/:id/cancel
 *   POST /warnings/:id/acknowledge { response? }
 *   POST /clock-in | /clock-out
 *   POST /notices/read          HR notices (leave decided…) marked read
 */
const express = require('express');
const { authenticateToken, checkPasswordChangeRequired } = require('../middleware/auth');
const { db, ah, httpError, isoTime, isoDate, emit, addTimeline } = require('./manager/lib');
const { notifyGuest } = require('../services/guestPush');
const wellness = require('./manager/wellnessBookings');
const { cleanCode } = require('../services/wellnessBooking');
const taskTimer = require('../services/taskTimer');
const departureClean = require('../services/departureClean');

const desk = require('../services/staffDesk');

const SOURCE = { guest: 'Guest request', manager: 'From the manager', system: 'Automatic' };

const router = express.Router();
router.use(authenticateToken, checkPasswordChangeRequired, (req, res, next) => {
  if (!req.user || req.user.role === 'guest') return res.status(403).json({ message: 'My work is for the Faysha team' });
  if (req.user.impersonatedBy && req.method !== 'GET') return res.status(403).json({ message: 'This is a read-only view' });
  return next();
});

const OPEN = ['pending', 'acknowledged', 'in_progress', 'scheduled', 'escalated', 'on_hold'];
const REQ_STATUS = { pending: 'New', acknowledged: 'Seen', in_progress: 'In progress', scheduled: 'Scheduled', escalated: 'Escalated', on_hold: 'On hold', completed: 'Done', cancelled: 'Cancelled' };

router.get(
  '/',
  ah(async (req, res) => {
    const uid = req.user.id;
    const [me, requests, sessions, orders, events, ratings, timing] = await Promise.all([
      db.query(`SELECT u.id, u.full_name, u.department, u.job_title, r.display_name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [uid]),
      db.query(
        `SELECT r.*, COALESCE(r.guest_name, g.full_name) AS guest, a.unit_number
           FROM service_requests r LEFT JOIN users g ON g.id = r.guest_id LEFT JOIN apartments a ON a.id = r.apartment_id
          WHERE r.assigned_to = $1 AND (r.status = ANY($2) OR r.completed_at > NOW() - INTERVAL '24 hours')
          ORDER BY r.status = ANY($2) DESC, r.priority = 'urgent' DESC, r.created_at`,
        [uid, OPEN],
      ),
      db.query(
        `${wellness.SELECT} WHERE b.staff_id = $1 AND b.booking_date BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 7
           AND b.status IN ('requested', 'upcoming', 'in_progress', 'completed', 'no_show')
         ORDER BY b.booking_date, b.start_time`,
        [uid],
      ),
      db.query(
        `SELECT o.*, a.name AS asset_name FROM work_orders o LEFT JOIN assets a ON a.id = o.asset_id
          WHERE o.assigned_to = $1 AND (o.status NOT IN ('Completed', 'Closed', 'Cancelled') OR o.completed_at > NOW() - INTERVAL '24 hours')
          ORDER BY o.status IN ('Completed', 'Closed', 'Cancelled'), o.created_at`,
        [uid],
      ),
      db.query(
        `SELECT id, reference, name, title, event_type, event_date, guests, status FROM event_requests
          WHERE assigned_to = $1 AND status NOT IN ('completed', 'cancelled', 'declined', 'lost') ORDER BY event_date NULLS LAST`,
        [uid],
      ),
      db.query(
        `SELECT rating, comment, context, department, created_at FROM staff_ratings WHERE staff_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [uid],
      ),
      taskTimer.performance({ days: 30, userId: uid }),
    ]);
    const [messages, leave, warnings, clockState, notices, low] = await Promise.all([
      desk.messages(uid, { limit: 60 }),
      desk.leaveFor(uid),
      desk.warnings(uid),
      desk.clock(uid),
      db.query(
        `SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at FROM employee_notifications n JOIN employees e ON e.id = n.employee_id
          WHERE e.user_id = $1 ORDER BY n.created_at DESC LIMIT 20`,
        [uid],
      ),
      // Low ratings stay visible for 90 days, with what the manager did about them.
      db.query(
        `SELECT rating, comment, context, status, follow_up, created_at FROM staff_ratings WHERE staff_id = $1 AND rating <= 2 AND created_at > NOW() - INTERVAL '90 days' ORDER BY created_at DESC`,
        [uid],
      ),
    ]);
    const m = me.rows[0];
    const now = new Date();
    const rs = ratings.rows;
    res.json({
      me: { id: m.id, name: m.full_name, department: m.department, jobTitle: m.job_title, role: m.role },
      requests: requests.rows.map((r) => ({
        id: r.id,
        number: r.request_number,
        title: r.title,
        notes: r.description || '',
        department: r.department,
        priority: r.priority,
        urgent: r.priority === 'urgent' || r.priority === 'high',
        status: REQ_STATUS[r.status] || r.status,
        open: OPEN.includes(r.status),
        started: Boolean(r.started_at),
        guest: r.guest,
        location: r.location || (r.unit_number ? `Residence ${r.unit_number}` : ''),
        createdAt: isoTime(r.created_at),
        completedAt: isoTime(r.completed_at),
        resolution: r.resolution_notes || '',
        photos: r.resolution_attachments || [],
        source: r.source || 'guest',
        sourceLabel: SOURCE[r.source] || SOURCE.guest,
        timer: taskTimer.requestClock(r, now),
      })),
      wellness: sessions.rows.map((r) => wellness.toItem(r)),
      workOrders: orders.rows.map((o) => ({
        id: o.id,
        number: o.number,
        title: o.title,
        location: o.location,
        priority: o.priority,
        status: o.status,
        asset: o.asset_name || null,
        started: Boolean(o.started_at),
        createdAt: isoTime(o.created_at),
        completedAt: isoTime(o.completed_at),
        notes: o.completion_notes || '',
        cost: o.cost === null ? null : Number(o.cost),
        photos: o.photos || [],
        timer: taskTimer.orderClock(o, now),
      })),
      events: events.rows.map((e) => ({ id: e.id, reference: e.reference, name: e.name, title: e.title, type: e.event_type, date: isoDate(e.event_date), guests: e.guests, status: e.status })),
      ratings: {
        average: rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : null,
        count: rs.length,
        recent: rs.slice(0, 5).map((r) => ({ rating: r.rating, comment: r.comment, context: r.context, at: isoTime(r.created_at) })),
        low: low.rows.map((r) => ({ rating: r.rating, comment: r.comment, context: r.context, followedUp: r.status === 'followed_up', followUp: r.follow_up || null, at: isoTime(r.created_at) })),
      },
      messages,
      unreadMessages: messages.filter((x) => !x.fromStaff && !x.read).length,
      leave,
      warnings,
      clock: clockState,
      notices: notices.rows.map((n) => ({ id: n.id, title: n.title, message: n.message, type: n.type, read: n.is_read, at: isoTime(n.created_at) })),
      timing: timing[0] || { done: 0, onTime: 0, onTimeRate: null, avgMinutes: null, avgLateMinutes: null, open: 0, lateNow: 0 },
    });
  }),
);

// ------------------------------------------------------------------ requests
async function myRequest(req) {
  const r = (await db.query('SELECT * FROM service_requests WHERE id = $1', [req.params.id])).rows[0];
  if (!r || r.assigned_to !== req.user.id) throw httpError(404, 'This request is not assigned to you');
  return r;
}

router.post(
  '/requests/:id/start',
  ah(async (req, res) => {
    const r = await myRequest(req);
    if (!OPEN.includes(r.status)) throw httpError(409, 'This request is already closed');
    await db.query(
      `UPDATE service_requests SET status = 'in_progress', acknowledged_at = COALESCE(acknowledged_at, NOW()), started_at = COALESCE(started_at, NOW()) WHERE id = $1`,
      [r.id],
    );
    if (r.guest_id) notifyGuest(req.app, r.guest_id, { title: r.department || 'Your request', body: `Your request “${r.title}” is being taken care of by ${req.user.fullName}.`, event: 'request:updated', data: { id: r.id, status: 'In Progress', screen: 'Requests' } });
    await addTimeline(null, r.guest_id, `${r.title} – started by ${req.user.fullName}`, 'Service Request', { performedBy: req.user.id });
    require('../services/notify').resolve(req.app, `request-sla:${r.id}`).catch(() => {});
    await departureClean.progress(req.app, r, 'start');
    emit(req, 'service-request:updated', await require('./manager/serviceRequests').one(r.id));
    res.json({ ok: true });
  }),
);

router.post(
  '/requests/:id/done',
  ah(async (req, res) => {
    const r = await myRequest(req);
    if (!OPEN.includes(r.status)) throw httpError(409, 'This request is already closed');
    const note = String(req.body?.note || '').trim().slice(0, 2000);
    if (!note) throw httpError(400, 'Say in a few words what was done');
    await db.query(
      `UPDATE service_requests SET status = 'completed', completed_at = NOW(), started_at = COALESCE(started_at, NOW()),
              acknowledged_at = COALESCE(acknowledged_at, NOW()), resolution_notes = $2, resolution_attachments = $3 WHERE id = $1`,
      [r.id, note, JSON.stringify(desk.cleanAttachments(req.body?.photos))],
    );
    if (r.guest_id) {
      notifyGuest(req.app, r.guest_id, { title: r.department || 'Your request', body: `Your request “${r.title}” is done. Tap to tell us how it went.`, event: 'request:updated', data: { id: r.id, status: 'Completed', screen: 'Rate' } });
    }
    await addTimeline(null, r.guest_id, `${r.title} – done by ${req.user.fullName}: ${note.slice(0, 120)}`, 'Service Request', { performedBy: req.user.id });
    require('../services/notify').resolve(req.app, `request-sla:${r.id}`).catch(() => {});
    await departureClean.progress(req.app, r, 'done', req.user.fullName);
    const clock = taskTimer.requestClock({ ...r, completed_at: new Date() });
    emit(req, 'service-request:updated', await require('./manager/serviceRequests').one(r.id));
    res.json({ ok: true, timer: clock });
  }),
);

// ------------------------------------------------------------------ wellness sessions
async function mineOrOpen(req, id) {
  const b = (await db.query('SELECT id, staff_id FROM wellness_bookings WHERE id = $1', [id])).rows[0];
  if (!b) throw httpError(404, 'Booking not found');
  if (b.staff_id && b.staff_id !== req.user.id) throw httpError(403, 'This session is assigned to someone else');
  return b;
}

router.post(
  '/wellness/check-in',
  ah(async (req, res) => {
    const code = cleanCode(req.body?.code);
    if (!code) throw httpError(400, 'Enter the guest’s booking code');
    const b = (await db.query('SELECT id FROM wellness_bookings WHERE booking_code = $1', [code])).rows[0];
    if (!b) throw httpError(404, `No booking with code ${code}`);
    await mineOrOpen(req, b.id);
    res.json(await wellness.checkIn(req, b.id));
  }),
);

for (const action of ['complete', 'no-show']) {
  router.post(
    `/wellness/:id/${action}`,
    ah(async (req, res) => {
      await mineOrOpen(req, req.params.id);
      res.json(await wellness.finish(req, req.params.id, action));
    }),
  );
}

// ------------------------------------------------------------------ work orders
async function myOrder(req) {
  const o = (await db.query('SELECT * FROM work_orders WHERE id = $1', [req.params.id])).rows[0];
  if (!o || o.assigned_to !== req.user.id) throw httpError(404, 'This work order is not assigned to you');
  return o;
}

router.post(
  '/work-orders/:id/start',
  ah(async (req, res) => {
    const o = await myOrder(req);
    await db.query(`UPDATE work_orders SET status = 'In Progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1`, [o.id]);
    emit(req, 'maintenance:updated', { id: o.id });
    res.json({ ok: true });
  }),
);

router.post(
  '/work-orders/:id/done',
  ah(async (req, res) => {
    const o = await myOrder(req);
    const note = String(req.body?.note || '').trim().slice(0, 2000);
    if (!note) throw httpError(400, 'Say in a few words what was done');
    const cost = req.body?.cost === undefined || req.body?.cost === '' || req.body?.cost === null ? null : Number(req.body.cost);
    if (cost !== null && !(cost >= 0)) throw httpError(400, 'Enter the cost as a number');
    await db.query(
      `UPDATE work_orders SET status = 'Completed', completed_at = NOW(), started_at = COALESCE(started_at, NOW()), completion_notes = $2, cost = $3,
              photos = $4, updated_at = NOW() WHERE id = $1`,
      [o.id, note, cost, JSON.stringify(desk.cleanAttachments(req.body?.photos))],
    );
    // The repair joins the asset's history (FAY OS → Assets & lifecycle).
    if (o.asset_id) {
      await db.query(
        `INSERT INTO asset_logs (asset_id, kind, notes, cost, by_name, user_id) VALUES ($1, 'repair', $2, $3, $4, $5)`,
        [o.asset_id, `${o.number || 'Work order'}: ${note}`.slice(0, 2000), cost || 0, req.user.fullName, req.user.id],
      ).catch((e) => console.error('Asset log failed:', e.message));
    }
    await require('../services/notify').staffAlert(req.app, { title: `Work order done · ${o.number || o.id}`, body: `${o.title} — ${req.user.fullName}: ${note.slice(0, 120)}`, link: '/maintenance', level: 'info', category: 'maintenance' });
    emit(req, 'maintenance:updated', { id: o.id });
    res.json({ ok: true, timer: taskTimer.orderClock({ ...o, completed_at: new Date() }) });
  }),
);

// ------------------------------------------------------------------ the staff desk
router.post('/photos', require('../services/attachments').handler);

router.post('/messages', ah(async (req, res) => {
  const msg = await desk.send(req.app, { staffId: req.user.id, sender: req.user, fromStaff: true, body: req.body?.body, attachments: req.body?.attachments, about: req.body?.about });
  res.status(201).json(msg);
}));
router.post('/messages/read', ah(async (req, res) => {
  await desk.markRead(req.user.id, true);
  res.json({ ok: true });
}));

router.post('/leave', ah(async (req, res) => res.status(201).json(await desk.requestLeave(req.app, req.user, req.body || {}))));
router.post('/leave/:id/cancel', ah(async (req, res) => {
  await desk.cancelLeave(req.app, req.user.id, req.params.id);
  res.json({ ok: true });
}));

router.post('/warnings/:id/acknowledge', ah(async (req, res) => {
  const w = await desk.acknowledge(req.user.id, req.params.id, req.body?.response);
  await require('../services/notify').staffAlert(req.app, {
    title: `Warning acknowledged · ${req.user.fullName}`,
    body: w.response ? `Their side: “${w.response.slice(0, 160)}”` : 'Read, without comment',
    link: `/team?tab=warnings`,
    level: 'info',
    category: 'team',
  });
  res.json(w);
}));

router.post('/clock-in', ah(async (req, res) => res.json(await desk.clockIn(req.user.id))));
router.post('/clock-out', ah(async (req, res) => res.json(await desk.clockOut(req.user.id))));

router.post('/notices/read', ah(async (req, res) => {
  await db.query(`UPDATE employee_notifications SET is_read = true, read_at = NOW() WHERE is_read = false AND employee_id IN (SELECT id FROM employees WHERE user_id = $1)`, [req.user.id]);
  res.json({ ok: true });
}));

router.use((req, res) => res.status(404).json({ message: `No route ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('My work API error:', req.method, req.originalUrl, err);
  res.status(status).json({ message: status >= 500 ? 'Something went wrong' : err.message });
});

module.exports = router;

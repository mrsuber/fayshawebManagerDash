/**
 * Shared helpers for the manager dashboard API (/api/manager).
 * Responses follow the dashboard contract: camelCase JSON, errors as { message }.
 */

const db = require('../../config/database');

/** Wraps an async handler so rejections reach the error middleware. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Error with an HTTP status, rendered as { message } by the manager error handler. */
const httpError = (status, message) => Object.assign(new Error(message), { status });

const camelKey = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

/** snake_case row → camelCase object; DECIMAL strings → numbers. */
function camelRow(row, numeric = []) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = camelKey(k);
    out[key] = numeric.includes(key) && v !== null && v !== undefined ? Number(v) : v;
  }
  return out;
}

const isoDate = (d) => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isoTime = (d) => (d ? new Date(d).toISOString() : null);

/** "14:30" or "14:30:00" → "2:30 PM" */
function displayTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Emits a Socket.io event to signed-in staff (see socket auth in server.js). */
function emit(req, event, payload) {
  const io = req.app.get('io');
  if (io) io.to('staff').emit(event, payload);
}

/** Adds a guest timeline entry. Accepts a pg client so it can join a transaction. */
async function addTimeline(q, guestId, title, category, { bookingId = null, performedBy = null } = {}) {
  if (!guestId) return;
  await (q || db).query(
    `INSERT INTO guest_activities (guest_id, booking_id, activity_type, title, category, performed_by, is_automated)
     VALUES ($1, $2, 'custom', $3, $4, $5, $6)`,
    [guestId, bookingId, title, category, performedBy, !performedBy],
  );
}

/**
 * Creates a header notification for managers, pushes it over Socket.io and (best effort) FCM.
 * userId = null means every manager.
 */
async function notify(req, title, body, { userId = null, link = null } = {}) {
  const { rows } = await db.query(
    'INSERT INTO staff_notifications (user_id, title, body, link) VALUES ($1, $2, $3, $4) RETURNING id, title, body, link, created_at',
    [userId, title, body || '', link],
  );
  const n = { id: rows[0].id, title, body: body || '', link, createdAt: isoTime(rows[0].created_at), read: false };
  const io = req.app.get('io');
  if (io) io.to(userId ? `user_${userId}` : 'staff').emit('notification:new', n);
  pushToStaff(title, body, userId).catch(() => {});
  return n;
}

async function pushToStaff(title, body, userId) {
  const { rows } = await db.query(
    `SELECT t.token FROM fcm_tokens t
       JOIN users u ON u.id = t.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE t.is_active = true AND t.platform = 'web'
        AND r.name IN ('manager', 'superadmin')
        AND ($1::int IS NULL OR u.id = $1)`,
    [userId],
  );
  if (!rows.length) return;
  // Loaded lazily: Firebase is optional and may not be configured.
  const { sendNotificationToMultipleDevices } = require('../../services/notificationService');
  await sendNotificationToMultipleDevices(rows.map((r) => r.token), { title, body: body || '' });
}

/** Returns { id, name } of a user, or a 400 if they don't exist. */
async function findGuest(q, guestId) {
  if (guestId === undefined || guestId === null || guestId === '') return null;
  const { rows } = await (q || db).query('SELECT id, full_name FROM users WHERE id = $1 AND deleted_at IS NULL', [guestId]);
  if (!rows.length) throw httpError(400, 'Guest not found');
  return { id: rows[0].id, name: rows[0].full_name };
}

/** Runs fn(client) in a transaction. */
async function tx(fn) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Key/value settings stored in app_settings. */
async function getSetting(key) {
  const { rows } = await db.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : {};
}

module.exports = {
  db,
  ah,
  httpError,
  camelKey,
  camelRow,
  isoDate,
  isoTime,
  displayTime,
  emit,
  addTimeline,
  notify,
  findGuest,
  tx,
  getSetting,
};

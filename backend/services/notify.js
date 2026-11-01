/**
 * Staff alerts (FAY OS bell, live over Socket.io, web push when configured).
 *
 *   staffAlert(app, { title, body, link, level, category, dedupeKey, userId })
 *     level:     'info' (something happened) | 'action' (someone must act) | 'urgent' (act now)
 *     dedupeKey: the condition's identity, e.g. 'late-checkout:12'. While an alert with that key exists it is not
 *                raised again; resolve(dedupeKey) closes it when the condition clears.
 *     userId:    one team member; otherwise every manager.
 *
 * Never throws: an alert failing must not break the action that raised it.
 */
const db = require('../config/database');

const LEVELS = ['info', 'action', 'urgent'];
const toAlert = (r) => ({
  id: r.id,
  title: r.title,
  body: r.body || '',
  link: r.link,
  level: r.level,
  category: r.category,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
  read: false,
});

async function staffAlert(app, { title, body = '', link = null, level = 'info', category = null, dedupeKey = null, userId = null }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO staff_notifications (user_id, title, body, link, level, category, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING *`,
      [userId, String(title).slice(0, 255), String(body || '').slice(0, 2000), link, LEVELS.includes(level) ? level : 'info', category, dedupeKey],
    );
    if (!rows[0]) return null; // already announced
    const alert = toAlert(rows[0]);
    const io = app && app.get && app.get('io');
    if (io) io.to(userId ? `user_${userId}` : 'staff').emit('notification:new', alert);
    pushToStaff(alert, userId).catch(() => {});
    return alert;
  } catch (e) {
    console.error('Staff alert failed:', e.message);
    return null;
  }
}

/** Closes alerts whose condition has cleared (by exact key, or every key starting with prefix + ':' when prefix is true). */
async function resolve(app, dedupeKey) {
  try {
    const { rows } = await db.query(
      `UPDATE staff_notifications SET resolved_at = NOW() WHERE dedupe_key = $1 AND resolved_at IS NULL RETURNING id`,
      [dedupeKey],
    );
    const io = app && app.get && app.get('io');
    if (io && rows.length) io.to('staff').emit('notification:resolved', { ids: rows.map((r) => r.id) });
    return rows.length;
  } catch (e) {
    console.error('Resolve alert failed:', e.message);
    return 0;
  }
}

async function pushToStaff(alert, userId) {
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
  const { sendNotificationToMultipleDevices } = require('./notificationService');
  await sendNotificationToMultipleDevices(rows.map((r) => r.token), { title: alert.title, body: alert.body, data: { link: alert.link || '' } });
}

module.exports = { staffAlert, resolve, LEVELS };

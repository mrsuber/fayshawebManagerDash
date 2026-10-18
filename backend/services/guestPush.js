/**
 * Notifications to guests in the Faysha app: a live Socket.io event (when the app is open) and an Expo push
 * notification (when it is not). The app registers its Expo push token with POST /api/guest/push-token;
 * tokens are stored in fcm_tokens (platform ios/android) and recognised by their Expo prefix. Everything here is best effort and never throws.
 */
const db = require('../config/database');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function expoTokens(userId) {
  const { rows } = await db.query(
    "SELECT token FROM fcm_tokens WHERE user_id = $1 AND is_active = true AND (token LIKE 'ExponentPushToken[%' OR token LIKE 'ExpoPushToken[%')",
    [userId]
  );
  return rows.map((r) => r.token).filter((t) => /^Expo(nent)?PushToken\[/.test(t));
}

async function sendExpo(tokens, { title, body, data }) {
  if (!tokens.length || typeof fetch !== 'function') return;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: 'default', channelId: 'default' }))),
  });
  const json = await res.json().catch(() => ({}));
  // Forget tokens Expo says are no longer valid (app uninstalled, permission revoked).
  const tickets = Array.isArray(json.data) ? json.data : [];
  const dead = tickets
    .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
    .filter(Boolean);
  if (dead.length) await db.query('UPDATE fcm_tokens SET is_active = false WHERE token = ANY($1)', [dead]);
}

/**
 * Tells a guest something happened: socket event `event` to room user_<id>, plus a push notification.
 * `app` is the Express app (for the Socket.io server), e.g. req.app.
 */
async function notifyGuest(app, userId, { title, body, event = 'guest:notification', data = {} }) {
  if (!userId) return;
  try {
    const io = app && app.get && app.get('io');
    if (io) io.to(`user_${userId}`).emit(event, { title, body, ...data });
    await sendExpo(await expoTokens(userId), { title, body, data: { event, ...data } });
  } catch (error) {
    console.error('Guest notification failed:', error.message);
  }
}

module.exports = { notifyGuest };

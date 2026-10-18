/**
 * Communications: one conversation per guest, stored in concierge_messages — the same table the
 * guest app chat and the n8n AI concierge use. Conversation id = the guest's user id.
 */

const express = require('express');
const { db, ah, httpError, isoTime, emit } = require('./lib');
const { stayStatuses } = require('./guestData');

const router = express.Router();

const CHANNELS = ['in_app', 'whatsapp', 'email', 'sms', 'phone', 'note'];

function senderOf(row) {
  if (row.sender_type === 'user') return row.guest_name || 'Guest';
  if (row.sender_type === 'system') return 'FAY System';
  return row.staff_name || 'FAY AI Concierge';
}

function messageOf(row) {
  const attachment = row.metadata && row.metadata.attachment;
  return {
    id: row.id,
    conversationId: row.user_id,
    fromStaff: row.sender_type !== 'user',
    sender: senderOf(row),
    body: row.message,
    channel: row.is_internal ? 'note' : row.channel || 'in_app',
    internal: Boolean(row.is_internal),
    attachment: attachment && attachment.url ? { url: attachment.url, name: attachment.name, type: attachment.type } : undefined,
    createdAt: isoTime(row.created_at),
  };
}

const MESSAGE_SELECT = `
  SELECT m.*, g.full_name AS guest_name, s.full_name AS staff_name
    FROM concierge_messages m
    JOIN users g ON g.id = m.user_id
    LEFT JOIN users s ON s.id = m.staff_id`;

async function messagesFor(guestId) {
  const { rows } = await db.query(`${MESSAGE_SELECT} WHERE m.user_id = $1 ORDER BY m.created_at, m.id`, [guestId]);
  return rows.map(messageOf);
}

async function conversations({ channel, guestId } = {}) {
  const params = [];
  const where = ['u.deleted_at IS NULL'];
  if (guestId) {
    params.push(guestId);
    where.push(`last.user_id = $${params.length}`);
  }
  const { rows } = await db.query(
    `SELECT last.*, u.full_name,
            (SELECT x.channel FROM concierge_messages x WHERE x.user_id = last.user_id AND x.is_internal = false ORDER BY x.created_at DESC LIMIT 1) AS guest_channel,
            (SELECT COUNT(*) FROM concierge_messages x WHERE x.user_id = last.user_id AND x.sender_type = 'user' AND x.is_read = false)::int AS unread
       FROM (SELECT DISTINCT ON (user_id) * FROM concierge_messages ORDER BY user_id, created_at DESC, id DESC) last
       JOIN users u ON u.id = last.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY last.created_at DESC`,
    params,
  );
  const statuses = await stayStatuses(rows.map((r) => r.user_id));
  return rows
    .map((r) => ({
      id: r.user_id,
      guestId: r.user_id,
      guestName: r.full_name,
      lastMessage: r.message,
      lastAt: isoTime(r.created_at),
      channel: r.guest_channel || 'in_app',
      stayStatus: statuses[r.user_id] === 'Upcoming' ? 'Arriving' : statuses[r.user_id] || 'Checked Out',
      unread: r.unread,
    }))
    .filter((c) => !channel || c.channel === channel);
}

/**
 * Saves a staff message and delivers it: the guest app gets it over Socket.io (`new_message`,
 * same payload as before), email goes out by SMTP, and other staff screens get `message:new`.
 * channel 'note' is an internal note the guest never sees.
 */
async function sendStaffMessage(req, guestId, { channel = 'in_app', body }) {
  if (!body || !String(body).trim()) throw httpError(400, 'Message body is required');
  if (!CHANNELS.includes(channel)) throw httpError(400, `Unknown channel "${channel}"`);
  const guest = await db.query('SELECT id, full_name, email FROM users WHERE id = $1 AND deleted_at IS NULL', [guestId]);
  if (!guest.rows.length) throw httpError(404, 'Guest not found');

  const internal = channel === 'note';
  const { rows } = await db.query(
    `INSERT INTO concierge_messages (user_id, message, sender_type, metadata, channel, staff_id, is_internal, is_read)
     VALUES ($1, $2, 'concierge', $3, $4, $5, $6, true) RETURNING *`,
    [guestId, String(body).trim(), JSON.stringify({ auto: false, staffName: req.user.fullName }), internal ? 'in_app' : channel, req.user.id, internal],
  );
  // Staff have now seen the guest's side of the thread.
  await db.query("UPDATE concierge_messages SET is_read = true WHERE user_id = $1 AND sender_type = 'user' AND is_read = false", [guestId]);

  const row = { ...rows[0], guest_name: guest.rows[0].full_name, staff_name: req.user.fullName };
  const message = messageOf(row);
  const io = req.app.get('io');
  if (io && !internal) {
    io.to(`user_${guestId}`).emit('new_message', rows[0]);
    io.to('admin').emit('new_message', rows[0]);
  }
  emit(req, 'message:new', message);

  if (channel === 'email' && guest.rows[0].email) {
    // Loaded lazily so a missing SMTP config never breaks the chat itself.
    const emailService = require('../../services/email.service');
    emailService
      .sendEmail({
        to: guest.rows[0].email,
        subject: 'A message from Faysha',
        text: message.body,
        html: `<p>${message.body.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]).replace(/\n/g, '<br>')}</p>`,
      })
      .catch((e) => console.error('Manager email message failed:', e.message));
  }
  return message;
}

router.get(
  '/',
  ah(async (req, res) => res.json(await conversations({ channel: req.query.channel }))),
);

router.get(
  '/:id/messages',
  ah(async (req, res) => res.json(await messagesFor(req.params.id))),
);

router.post(
  '/:id/messages',
  ah(async (req, res) => {
    const last = await db.query('SELECT channel FROM concierge_messages WHERE user_id = $1 AND is_internal = false ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const channel = req.body.channel || last.rows[0]?.channel || 'in_app';
    res.status(201).json(await sendStaffMessage(req, req.params.id, { channel, body: req.body.body }));
  }),
);

module.exports = { router, conversations, messagesFor, sendStaffMessage };

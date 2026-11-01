/**
 * Enquiries (FAY OS → Enquiries): messages from the website contact form, followed up by the team.
 *
 *   GET    /enquiries?status=&q=        list (newest first) with counts per status
 *   GET    /enquiries/:id               one enquiry with its thread (notes, replies, status changes)
 *   PATCH  /enquiries/:id               { status?, assignedTo? }
 *   POST   /enquiries/:id/notes         { body }              internal note
 *   POST   /enquiries/:id/reply         { body }              emails the enquirer and records the reply
 */
const express = require('express');
const { db, ah, httpError, isoTime } = require('./lib');
const emailService = require('../../services/email.service');
const { layout, esc } = require('../../services/emailLayout');

const router = express.Router();

const STATUSES = ['new', 'open', 'replied', 'closed', 'spam'];
const LABEL = { new: 'New', open: 'Open', replied: 'Replied', closed: 'Closed', spam: 'Spam' };
const FROM_LABEL = Object.fromEntries(Object.entries(LABEL).map(([k, v]) => [v, k]));

const toEnquiry = (r) => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  email: r.email,
  phone: r.phone,
  subject: r.subject,
  message: r.message,
  source: r.source,
  status: LABEL[r.status] || r.status,
  guestId: r.user_id,
  assignedTo: r.assigned_to,
  assignedName: r.assigned_name || null,
  createdAt: isoTime(r.created_at),
  updatedAt: isoTime(r.updated_at),
  firstResponseAt: r.first_response_at ? isoTime(r.first_response_at) : null,
  replies: Number(r.replies || 0),
});

const SELECT = `
  SELECT e.*, s.full_name AS assigned_name,
         (SELECT COUNT(*) FROM enquiry_notes n WHERE n.enquiry_id = e.id AND n.kind = 'reply') AS replies
    FROM enquiries e LEFT JOIN users s ON s.id = e.assigned_to`;

async function one(id) {
  const row = (await db.query(`${SELECT} WHERE e.id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Enquiry not found');
  const thread = await db.query(
    `SELECT n.id, n.kind, n.body, n.created_at, u.full_name AS author
       FROM enquiry_notes n LEFT JOIN users u ON u.id = n.author_id
      WHERE n.enquiry_id = $1 ORDER BY n.created_at, n.id`,
    [id],
  );
  return {
    ...toEnquiry(row),
    thread: thread.rows.map((n) => ({ id: n.id, kind: n.kind, body: n.body, author: n.author || 'System', at: isoTime(n.created_at) })),
  };
}

const addNote = (id, authorId, kind, body) =>
  db.query('INSERT INTO enquiry_notes (enquiry_id, author_id, kind, body) VALUES ($1, $2, $3, $4)', [id, authorId, kind, body]);

router.get(
  '/',
  ah(async (req, res) => {
    const params = [];
    const where = [];
    const status = FROM_LABEL[req.query.status] || (STATUSES.includes(req.query.status) ? req.query.status : null);
    if (status) {
      params.push(status);
      where.push(`e.status = $${params.length}`);
    } else {
      where.push(`e.status <> 'spam'`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).toLowerCase()}%`);
      where.push(`lower(e.name || ' ' || e.email || ' ' || COALESCE(e.subject, '') || ' ' || e.message) LIKE $${params.length}`);
    }
    const { rows } = await db.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC LIMIT 500`, params);
    const counts = await db.query(`SELECT status, COUNT(*)::int AS n FROM enquiries GROUP BY status`);
    res.json({
      items: rows.map(toEnquiry),
      counts: Object.fromEntries(STATUSES.map((s) => [LABEL[s], counts.rows.find((c) => c.status === s)?.n || 0])),
    });
  }),
);

router.get('/:id', ah(async (req, res) => res.json(await one(req.params.id))));

router.patch(
  '/:id',
  ah(async (req, res) => {
    const cur = (await db.query('SELECT * FROM enquiries WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Enquiry not found');
    const { status, assignedTo } = req.body || {};
    if (status !== undefined) {
      const next = FROM_LABEL[status] || status;
      if (!STATUSES.includes(next)) throw httpError(400, `Status must be one of ${Object.values(LABEL).join(', ')}`);
      if (next !== cur.status) {
        await db.query(
          `UPDATE enquiries SET status = $2, updated_at = NOW(), closed_at = CASE WHEN $2 IN ('closed', 'spam') THEN NOW() ELSE NULL END WHERE id = $1`,
          [cur.id, next],
        );
        await addNote(cur.id, req.user.id, 'event', `Marked as ${LABEL[next]}`);
      }
    }
    if (assignedTo !== undefined) {
      const staff = assignedTo ? (await db.query('SELECT id, full_name FROM users WHERE id = $1 AND deleted_at IS NULL', [assignedTo])).rows[0] : null;
      if (assignedTo && !staff) throw httpError(400, 'Team member not found');
      await db.query('UPDATE enquiries SET assigned_to = $2, updated_at = NOW() WHERE id = $1', [cur.id, staff ? staff.id : null]);
      await addNote(cur.id, req.user.id, 'event', staff ? `Assigned to ${staff.full_name}` : 'Unassigned');
    }
    // Opening a new enquiry moves it to Open.
    if (status === undefined && cur.status === 'new') await db.query(`UPDATE enquiries SET status = 'open', updated_at = NOW() WHERE id = $1`, [cur.id]);
    const out = await one(cur.id);
    req.app.get('io')?.to('staff').emit('enquiry:updated', out);
    res.json(out);
  }),
);

router.post(
  '/:id/notes',
  ah(async (req, res) => {
    const body = String(req.body?.body || '').trim();
    if (!body) throw httpError(400, 'Write a note first');
    const cur = (await db.query('SELECT id, status FROM enquiries WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Enquiry not found');
    await addNote(cur.id, req.user.id, 'note', body.slice(0, 5000));
    await db.query(`UPDATE enquiries SET updated_at = NOW(), status = CASE WHEN status = 'new' THEN 'open' ELSE status END WHERE id = $1`, [cur.id]);
    res.status(201).json(await one(cur.id));
  }),
);

router.post(
  '/:id/reply',
  ah(async (req, res) => {
    const body = String(req.body?.body || '').trim();
    if (!body) throw httpError(400, 'Write your reply first');
    const cur = (await db.query('SELECT * FROM enquiries WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Enquiry not found');
    if (!emailService.configured) throw httpError(503, 'Outgoing email is not configured on the server (SMTP), so replies cannot be sent from here');
    const staff = (await db.query('SELECT full_name FROM users WHERE id = $1', [req.user.id])).rows[0];
    const html = layout({
      preheader: body.slice(0, 120),
      title: cur.subject ? `Re: ${cur.subject}` : 'Thank you for your message',
      intro: `Dear ${esc(cur.name)},`,
      body: `<div style="font:15px/1.7 Jost,Arial,sans-serif;color:#ece6da;white-space:pre-wrap;margin-top:14px">${esc(body)}</div>
        <p style="font:14px Jost,Arial,sans-serif;color:#a49d90;margin-top:22px">${esc(staff?.full_name || 'The Faysha team')}<br>Faysha Wellness Residence</p>
        <div style="margin-top:26px;padding-top:16px;border-top:1px solid #262a31;font:13px/1.6 Jost,Arial,sans-serif;color:#7d776c">
          Your message on ${esc(new Date(cur.created_at).toDateString())}:<br><span style="white-space:pre-wrap">${esc(cur.message)}</span></div>`,
    });
    try {
      await emailService.sendEmail({
        to: cur.email,
        replyTo: process.env.CONTACT_EMAIL || undefined,
        subject: cur.subject ? `Re: ${cur.subject}` : 'Your message to Faysha Wellness Residence',
        html,
        text: `Dear ${cur.name},\n\n${body}\n\n${staff?.full_name || 'The Faysha team'}\nFaysha Wellness Residence\n\n---\nYour message:\n${cur.message}`,
      });
    } catch (e) {
      throw httpError(502, `The email could not be sent: ${e.message}`);
    }
    await addNote(cur.id, req.user.id, 'reply', body);
    await db.query(
      `UPDATE enquiries SET status = 'replied', updated_at = NOW(), first_response_at = COALESCE(first_response_at, NOW()),
              assigned_to = COALESCE(assigned_to, $2) WHERE id = $1`,
      [cur.id, req.user.id],
    );
    const out = await one(cur.id);
    req.app.get('io')?.to('staff').emit('enquiry:updated', out);
    res.status(201).json(out);
  }),
);

module.exports = router;

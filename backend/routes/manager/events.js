/**
 * FAY OS → Events: the pipeline from request to completed event.
 *
 *   GET    /events?status=&q=               pipeline (with counts and pipeline value)
 *   POST   /events                          a request taken by staff (phone, walk-in)
 *   GET    /events/:id                      request, quotes and thread
 *   PATCH  /events/:id                      { status?, assignedTo?, ...brief fields }
 *   POST   /events/:id/notes                { body }  internal note
 *   POST   /events/:id/quotes               { items, discount, taxRate, depositPercent, currency, validUntil, notes }  save a draft quote
 *   PATCH  /events/:id/quotes/:qid          same fields (drafts only)
 *   POST   /events/:id/quotes/:qid/send     emails the client a private link; earlier sent quotes are superseded
 *   POST   /events/:id/deposit              { amount, method, reference }  deposit received → confirmed
 *   POST   /events/:id/story                creates a draft story from the event (Content → Stories)
 */
const express = require('express');
const { db, ah, httpError, isoTime } = require('./lib');
const ev = require('../../services/events');
const emailService = require('../../services/email.service');
const { formatMoney } = require('../../utils/money');

const router = express.Router();

const SELECT = `SELECT e.*, u.full_name AS assigned_name FROM event_requests e LEFT JOIN users u ON u.id = e.assigned_to`;
const MOVES = {
  new: ['assessing', 'declined', 'lost'],
  assessing: ['quoted', 'declined', 'lost', 'new'],
  quoted: ['assessing', 'accepted', 'declined', 'lost'],
  accepted: ['confirmed', 'cancelled', 'quoted'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  declined: ['assessing'],
  cancelled: ['assessing'],
  lost: ['assessing'],
};
const STATUS_LABEL = { new: 'New', assessing: 'Assessing', quoted: 'Quoted', accepted: 'Accepted', confirmed: 'Confirmed', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled', lost: 'Lost' };

const note = (id, authorId, kind, body) => db.query('INSERT INTO event_notes (event_id, author_id, kind, body) VALUES ($1, $2, $3, $4)', [id, authorId, kind, body]);
const changed = (req, id) => req.app.get('io')?.to('staff').emit('event:updated', { id: Number(id) });

async function full(id) {
  const row = (await db.query(`${SELECT} WHERE e.id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Event request not found');
  const [quotes, thread] = await Promise.all([
    db.query(`SELECT q.*, u.full_name AS author FROM event_quotes q LEFT JOIN users u ON u.id = q.created_by WHERE q.event_id = $1 ORDER BY q.version DESC`, [id]),
    db.query(`SELECT n.*, u.full_name AS author FROM event_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.event_id = $1 ORDER BY n.created_at, n.id`, [id]),
  ]);
  return {
    ...ev.toEvent(row),
    moves: MOVES[row.status] || [],
    quotes: quotes.rows.map((q) => ({ ...ev.toQuote(q, { includeToken: true }), author: q.author })),
    thread: thread.rows.map((n) => ({ id: n.id, kind: n.kind === 'client' ? 'reply' : n.kind, client: n.kind === 'client', body: n.body, author: n.kind === 'client' ? 'Client' : n.author || 'System', at: isoTime(n.created_at) })),
  };
}

router.get(
  '/',
  ah(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.status === 'open') where.push(`e.status IN ('new', 'assessing', 'quoted', 'accepted')`);
    else if (req.query.status === 'upcoming') where.push(`e.status = 'confirmed'`);
    else if (req.query.status === 'closed') where.push(`e.status IN ('completed', 'declined', 'cancelled', 'lost')`);
    else if (ev.STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      where.push(`e.status = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).toLowerCase()}%`);
      where.push(`lower(e.name || ' ' || e.email || ' ' || COALESCE(e.reference, '') || ' ' || COALESCE(e.title, '') || ' ' || COALESCE(e.organisation, '')) LIKE $${params.length}`);
    }
    const { rows } = await db.query(
      `SELECT e.*, u.full_name AS assigned_name, q.total, q.currency AS quote_currency
         FROM event_requests e
         LEFT JOIN users u ON u.id = e.assigned_to
         LEFT JOIN LATERAL (SELECT total, currency FROM event_quotes WHERE event_id = e.id AND status <> 'draft' ORDER BY version DESC LIMIT 1) q ON true
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY CASE e.status WHEN 'new' THEN 0 WHEN 'accepted' THEN 1 WHEN 'assessing' THEN 2 WHEN 'quoted' THEN 3 WHEN 'confirmed' THEN 4 ELSE 5 END,
                e.event_date NULLS LAST, e.created_at DESC
       LIMIT 500`,
      params,
    );
    const counts = (await db.query(`SELECT status, COUNT(*)::int AS n FROM event_requests GROUP BY status`)).rows;
    const pipeline = (
      await db.query(
        `SELECT q.currency, SUM(q.total)::float AS total FROM event_requests e
           JOIN LATERAL (SELECT total, currency FROM event_quotes WHERE event_id = e.id AND status IN ('sent', 'accepted') ORDER BY version DESC LIMIT 1) q ON true
          WHERE e.status IN ('quoted', 'accepted', 'confirmed') GROUP BY q.currency`,
      )
    ).rows;
    res.json({
      items: rows.map((r) => ({ ...ev.toEvent(r), quoteTotal: r.total === null || r.total === undefined ? null : Number(r.total), quoteCurrency: r.quote_currency || null })),
      counts: Object.fromEntries(ev.STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.n || 0])),
      pipeline,
    });
  }),
);

router.post(
  '/',
  ah(async (req, res) => {
    const fields = ev.cleanRequest(req.body || {});
    const row = await ev.createRequest(fields, { source: 'staff', app: req.app });
    await note(row.id, req.user.id, 'event', `Taken by ${req.user.fullName}`);
    res.status(201).json(await full(row.id));
  }),
);

router.get('/:id', ah(async (req, res) => res.json(await full(req.params.id))));

router.patch(
  '/:id',
  ah(async (req, res) => {
    const cur = (await db.query('SELECT * FROM event_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw httpError(404, 'Event request not found');
    const { status, assignedTo } = req.body || {};
    if (status !== undefined && status !== cur.status) {
      if (!(MOVES[cur.status] || []).includes(status)) throw httpError(409, `A ${STATUS_LABEL[cur.status].toLowerCase()} request cannot move to ${STATUS_LABEL[status] || status}`);
      if (status === 'quoted') {
        const sent = await db.query(`SELECT 1 FROM event_quotes WHERE event_id = $1 AND status = 'sent'`, [cur.id]);
        if (!sent.rows.length) throw httpError(409, 'Send a proposal first — it moves the request to Quoted');
      }
      await db.query('UPDATE event_requests SET status = $2, updated_at = NOW() WHERE id = $1', [cur.id, status]);
      await note(cur.id, req.user.id, 'event', `${STATUS_LABEL[cur.status]} → ${STATUS_LABEL[status]}${req.body.reason ? `: ${String(req.body.reason).slice(0, 300)}` : ''}`);
    }
    if (assignedTo !== undefined) {
      const staff = assignedTo ? (await db.query('SELECT id, full_name FROM users WHERE id = $1 AND deleted_at IS NULL', [assignedTo])).rows[0] : null;
      if (assignedTo && !staff) throw httpError(400, 'Team member not found');
      await db.query('UPDATE event_requests SET assigned_to = $2, updated_at = NOW() WHERE id = $1', [cur.id, staff?.id || null]);
      if (staff && staff.id !== cur.assigned_to) {
        await require('../../services/assignment').notifyAssignee(req.app, staff.id, {
          title: `You lead ${cur.reference}`,
          body: `${cur.name}${cur.event_date ? ` · ${new Date(cur.event_date).toISOString().slice(0, 10)}` : ''}${cur.guests ? ` · ${cur.guests} guests` : ''}`,
          link: '/work',
          key: `event:${cur.id}`,
        });
      }
      await note(cur.id, req.user.id, 'event', staff ? `Assigned to ${staff.full_name}` : 'Unassigned');
    }
    // Brief corrections after a call with the client.
    const brief = {};
    if (req.body.eventDate !== undefined) brief.event_date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.eventDate || '') ? req.body.eventDate : null;
    if (req.body.guests !== undefined) {
      const g = parseInt(req.body.guests, 10);
      if (!(g > 0)) throw httpError(400, 'Guests must be a positive number');
      brief.guests = g;
    }
    if (req.body.title !== undefined) brief.title = String(req.body.title || '').slice(0, 200) || null;
    if (req.body.startTime !== undefined) brief.start_time = req.body.startTime || null;
    if (req.body.endTime !== undefined) brief.end_time = req.body.endTime || null;
    if (Object.keys(brief).length) {
      const cols = Object.keys(brief);
      await db.query(`UPDATE event_requests SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`, [cur.id, ...cols.map((c) => brief[c])]);
      await note(cur.id, req.user.id, 'event', `Brief updated (${cols.map((c) => c.replace('_', ' ')).join(', ')})`);
    }
    if (status === undefined && cur.status === 'new' && assignedTo === undefined && !Object.keys(brief).length) {
      // Opening a new request starts the assessment.
      await db.query(`UPDATE event_requests SET status = 'assessing', updated_at = NOW() WHERE id = $1`, [cur.id]);
      await note(cur.id, req.user.id, 'event', 'New → Assessing');
    }
    changed(req, cur.id);
    res.json(await full(cur.id));
  }),
);

router.post(
  '/:id/notes',
  ah(async (req, res) => {
    const body = String(req.body?.body || '').trim();
    if (!body) throw httpError(400, 'Write a note first');
    await full(req.params.id);
    await note(req.params.id, req.user.id, 'note', body.slice(0, 5000));
    res.status(201).json(await full(req.params.id));
  }),
);

router.post(
  '/:id/reply',
  ah(async (req, res) => {
    const body = String(req.body?.body || '').trim();
    if (!body) throw httpError(400, 'Write your message first');
    const e = (await db.query('SELECT * FROM event_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!e) throw httpError(404, 'Event request not found');
    if (!emailService.configured) throw httpError(503, 'Outgoing email is not configured on the server (SMTP)');
    const { layout, esc } = require('../../services/emailLayout');
    await emailService
      .sendEmail({
        to: e.email,
        replyTo: process.env.CONTACT_EMAIL || undefined,
        subject: `Your ${ev.TYPE_LABEL[e.event_type].toLowerCase()} at Faysha · ${e.reference}`,
        html: layout({
          title: e.title || `Your ${ev.TYPE_LABEL[e.event_type].toLowerCase()}`,
          intro: `Dear ${esc(e.name)},`,
          body: `<div style="font:15px/1.7 Jost,Arial,sans-serif;color:#ece6da;white-space:pre-wrap;margin-top:14px">${esc(body)}</div>
            <p style="font:14px Jost,Arial,sans-serif;color:#a49d90;margin-top:22px">${esc(req.user.fullName || 'The Faysha events team')}<br>Faysha Wellness Residence</p>`,
        }),
        text: `Dear ${e.name},\n\n${body}\n\n${req.user.fullName || 'The Faysha events team'}\nFaysha Wellness Residence`,
      })
      .catch((err) => {
        throw httpError(502, `The email could not be sent: ${err.message}`);
      });
    await note(e.id, req.user.id, 'reply', body);
    if (e.status === 'new') await db.query(`UPDATE event_requests SET status = 'assessing', updated_at = NOW() WHERE id = $1`, [e.id]);
    res.status(201).json(await full(e.id));
  }),
);

// ---------- Quotes ----------
function quoteValues(b, currency) {
  const priced = ev.priceQuote({ items: b.items, discount: b.discount, taxRate: b.taxRate, depositPercent: b.depositPercent ?? 30, currency });
  const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil || '') ? b.validUntil : null;
  return { ...priced, validUntil, notes: b.notes ? String(b.notes).slice(0, 5000) : null };
}

router.post(
  '/:id/quotes',
  ah(async (req, res) => {
    const e = (await db.query('SELECT id, currency, status FROM event_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!e) throw httpError(404, 'Event request not found');
    if (['completed', 'cancelled'].includes(e.status)) throw httpError(409, `This request is ${e.status}`);
    const currency = /^[A-Z]{3}$/.test(req.body?.currency || '') ? req.body.currency : e.currency;
    const v = quoteValues(req.body || {}, currency);
    const { rows } = await db.query(
      `INSERT INTO event_quotes (event_id, version, currency, items, discount, tax_rate, subtotal, tax, total, deposit_percent, deposit_amount, valid_until, notes, created_by)
       VALUES ($1, (SELECT COALESCE(MAX(version), 0) + 1 FROM event_quotes WHERE event_id = $1), $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING version`,
      [e.id, currency, JSON.stringify(v.items), v.discount, v.taxRate, v.subtotal, v.tax, v.total, v.depositPercent, v.depositAmount, v.validUntil, v.notes, req.user.id],
    );
    await note(e.id, req.user.id, 'event', `Proposal v${rows[0].version} drafted · ${formatMoney(v.total, currency)}`);
    if (e.status === 'new') await db.query(`UPDATE event_requests SET status = 'assessing', updated_at = NOW() WHERE id = $1`, [e.id]);
    res.status(201).json(await full(e.id));
  }),
);

router.patch(
  '/:id/quotes/:qid',
  ah(async (req, res) => {
    const q = (await db.query('SELECT * FROM event_quotes WHERE id = $1 AND event_id = $2', [req.params.qid, req.params.id])).rows[0];
    if (!q) throw httpError(404, 'Proposal not found');
    if (q.status !== 'draft') throw httpError(409, 'A sent proposal cannot be changed — create a new version');
    const currency = /^[A-Z]{3}$/.test(req.body?.currency || '') ? req.body.currency : q.currency;
    const v = quoteValues(req.body || {}, currency);
    await db.query(
      `UPDATE event_quotes SET currency = $2, items = $3::jsonb, discount = $4, tax_rate = $5, subtotal = $6, tax = $7, total = $8,
              deposit_percent = $9, deposit_amount = $10, valid_until = $11, notes = $12 WHERE id = $1`,
      [q.id, currency, JSON.stringify(v.items), v.discount, v.taxRate, v.subtotal, v.tax, v.total, v.depositPercent, v.depositAmount, v.validUntil, v.notes],
    );
    res.json(await full(req.params.id));
  }),
);

router.post(
  '/:id/quotes/:qid/send',
  ah(async (req, res) => {
    const e = (await db.query('SELECT * FROM event_requests WHERE id = $1', [req.params.id])).rows[0];
    const q = (await db.query('SELECT * FROM event_quotes WHERE id = $1 AND event_id = $2', [req.params.qid, req.params.id])).rows[0];
    if (!e || !q) throw httpError(404, 'Proposal not found');
    if (q.status !== 'draft') throw httpError(409, 'This proposal was already sent');
    if (!emailService.configured) throw httpError(503, 'Outgoing email is not configured on the server (SMTP), so the proposal cannot be sent');
    const token = ev.newToken();
    const sent = (await db.query(`UPDATE event_quotes SET status = 'sent', sent_at = NOW(), token = $2 WHERE id = $1 RETURNING *`, [q.id, token])).rows[0];
    try {
      await ev.emailQuote(e, sent);
    } catch (err) {
      await db.query(`UPDATE event_quotes SET status = 'draft', sent_at = NULL, token = NULL WHERE id = $1`, [q.id]);
      throw httpError(502, `The proposal email could not be sent: ${err.message}`);
    }
    await db.query(`UPDATE event_quotes SET status = 'superseded' WHERE event_id = $1 AND id <> $2 AND status = 'sent'`, [e.id, q.id]);
    await db.query(`UPDATE event_requests SET status = 'quoted', updated_at = NOW() WHERE id = $1 AND status IN ('new', 'assessing', 'quoted', 'declined')`, [e.id]);
    await note(e.id, req.user.id, 'event', `Proposal v${q.version} sent to ${e.email} · ${formatMoney(sent.total, sent.currency)}`);
    if (e.user_id) {
      require('../../services/guestPush').notifyGuest(req.app, e.user_id, {
        title: 'Your event proposal is ready',
        body: `${ev.TYPE_LABEL[e.event_type]} · ${formatMoney(sent.total, sent.currency)}. Open it to accept.`,
        event: 'event:quote',
        data: { screen: 'MyEvents', eventId: e.id },
      });
    }
    changed(req, e.id);
    res.json(await full(e.id));
  }),
);

router.post(
  '/:id/deposit',
  ah(async (req, res) => {
    const e = (await db.query('SELECT * FROM event_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!e) throw httpError(404, 'Event request not found');
    if (!['accepted', 'confirmed'].includes(e.status)) throw httpError(409, 'Record the deposit once the client has accepted a proposal');
    const amount = Number(req.body?.amount);
    if (!(amount > 0)) throw httpError(400, 'Enter the amount received');
    const accepted = (await db.query(`SELECT currency, deposit_amount FROM event_quotes WHERE event_id = $1 AND status = 'accepted' ORDER BY version DESC LIMIT 1`, [e.id])).rows[0];
    const method = String(req.body?.method || 'bank_transfer').slice(0, 30);
    await db.query(
      `UPDATE event_requests SET deposit_paid = deposit_paid + $2, deposit_paid_at = COALESCE(deposit_paid_at, NOW()), status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [e.id, amount],
    );
    await note(
      e.id,
      req.user.id,
      'event',
      `Deposit received: ${formatMoney(amount, accepted?.currency || e.currency)} by ${method.replace('_', ' ')}${req.body?.reference ? ` (ref. ${String(req.body.reference).slice(0, 60)})` : ''}${e.status !== 'confirmed' ? ' · date confirmed' : ''}`,
    );
    changed(req, e.id);
    res.status(201).json(await full(e.id));
  }),
);

router.post(
  '/:id/story',
  ah(async (req, res) => {
    const e = (await db.query('SELECT * FROM event_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!e) throw httpError(404, 'Event request not found');
    if (e.story_id) return res.json({ storyId: e.story_id });
    const category = { wedding: 'wedding', engagement: 'celebration', birthday: 'celebration', anniversary: 'celebration', corporate: 'corporate', conference: 'corporate', retreat: 'retreat' }[e.event_type] || 'celebration';
    const title = e.title || `${ev.TYPE_LABEL[e.event_type]} for ${e.guests} at Faysha`;
    const slug = `${title}-${e.id}`.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140);
    const { rows } = await db.query(
      `INSERT INTO stories (slug, title, category, event_date, guests, author_id, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [slug, title, category, e.event_date, e.guests, req.user.id, '## The brief\n\n\n## The day\n\n\n## In their words\n\n'],
    );
    await db.query('UPDATE event_requests SET story_id = $2 WHERE id = $1', [e.id, rows[0].id]);
    await note(e.id, req.user.id, 'event', 'Story drafted (Content → Stories). Ask the client before publishing names or photos.');
    res.status(201).json({ storyId: rows[0].id });
  }),
);

module.exports = router;

/**
 * Events — public side (website and guest app).
 *
 *   POST /api/events                        an event request (signed in or not; a signed-in guest's account is linked)
 *   GET  /api/events/mine                   the signed-in guest's requests with their latest quote
 *   GET  /api/events/quote/:token           a quote sent to the client (private link)
 *   POST /api/events/quote/:token/respond   { decision: 'accept' | 'decline', name, note }
 */
const express = require('express');
const db = require('../config/database');
const { authenticateToken, userFromRequest } = require('../middleware/auth');
const ev = require('../services/events');
const { alertManagers } = require('../services/stayKeys');

const router = express.Router();

const fail = (res, e, fallback) => {
  if (!e.status) console.error(fallback, e);
  res.status(e.status || 500).json({ success: false, message: e.status ? e.message : fallback });
};

router.post('/', async (req, res) => {
  try {
    if (req.body?.website) return res.status(201).json({ success: true }); // honeypot
    const user = await userFromRequest(req).catch(() => null);
    const fields = ev.cleanRequest(req.body || {});
    const row = await ev.createRequest(fields, { source: req.body?.source === 'app' ? 'app' : 'website', userId: user?.role === 'guest' ? user.id : null, app: req.app });
    res.status(201).json({ success: true, reference: row.reference, id: row.id });
  } catch (e) {
    fail(res, e, 'We could not send your request. Please call or email us.');
  }
});

router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, q.id AS q_id FROM event_requests e
         LEFT JOIN LATERAL (SELECT id FROM event_quotes WHERE event_id = e.id AND status IN ('sent', 'accepted', 'declined') ORDER BY version DESC LIMIT 1) q ON true
        WHERE e.user_id = $1 OR lower(e.email) = lower($2)
        ORDER BY e.created_at DESC`,
      [req.user.id, req.user.email || ''],
    );
    const quotes = rows.length
      ? (await db.query('SELECT * FROM event_quotes WHERE id = ANY($1)', [rows.map((r) => r.q_id).filter(Boolean)])).rows
      : [];
    res.json(
      rows.map((r) => {
        const q = quotes.find((x) => x.id === r.q_id);
        const { assignedTo, assignedName, ...out } = ev.toEvent(r);
        return { ...out, quote: q ? ev.toQuote(q, { includeToken: true }) : null, quoteToken: q ? q.token : null };
      }),
    );
  } catch (e) {
    fail(res, e, 'Could not load your events');
  }
});

async function quoteByToken(token) {
  const { rows } = await db.query(
    `SELECT q.*, e.reference, e.name, e.event_type, e.title, e.event_date, e.guests, e.status AS event_status, e.id AS ev_id
       FROM event_quotes q JOIN event_requests e ON e.id = q.event_id WHERE q.token = $1`,
    [String(token || '')],
  );
  if (!rows[0]) throw ev.httpError(404, 'This proposal link is not valid. Please contact us.');
  return rows[0];
}

router.get('/quote/:token', async (req, res) => {
  try {
    const q = await quoteByToken(req.params.token);
    if (q.status === 'sent' && !q.viewed_at) {
      await db.query('UPDATE event_quotes SET viewed_at = NOW() WHERE id = $1', [q.id]);
      await db.query(`INSERT INTO event_notes (event_id, kind, body) VALUES ($1, 'event', $2)`, [q.ev_id, `Proposal v${q.version} opened by the client`]);
    }
    const expired = q.status === 'sent' && q.valid_until && new Date(q.valid_until) < new Date(new Date().toISOString().slice(0, 10));
    res.json({
      reference: q.reference,
      name: q.name,
      eventType: q.event_type,
      typeLabel: ev.TYPE_LABEL[q.event_type],
      title: q.title,
      eventDate: q.event_date ? q.event_date.toISOString().slice(0, 10) : null,
      guests: q.guests,
      quote: { ...ev.toQuote(q), status: expired ? 'expired' : q.status },
    });
  } catch (e) {
    fail(res, e, 'Could not load the proposal');
  }
});

router.post('/quote/:token/respond', async (req, res) => {
  try {
    const q = await quoteByToken(req.params.token);
    const decision = req.body?.decision;
    if (!['accept', 'decline'].includes(decision)) throw ev.httpError(400, 'Accept or decline the proposal');
    if (q.status !== 'sent') throw ev.httpError(409, q.status === 'superseded' ? 'This proposal has been replaced by a newer one — please check your latest email' : `This proposal is already ${q.status}`);
    if (q.valid_until && new Date(q.valid_until) < new Date(new Date().toISOString().slice(0, 10))) throw ev.httpError(409, 'This proposal has expired. Please contact us for an updated one.');
    const name = String(req.body?.name || '').trim();
    if (decision === 'accept' && !name) throw ev.httpError(400, 'Type your full name to accept');
    const note = req.body?.note ? String(req.body.note).slice(0, 2000) : null;
    await db.query(
      `UPDATE event_quotes SET status = $2, responded_at = NOW(), response_name = $3, response_note = $4 WHERE id = $1`,
      [q.id, decision === 'accept' ? 'accepted' : 'declined', name || null, note],
    );
    await db.query(`UPDATE event_requests SET status = $2, updated_at = NOW() WHERE id = $1`, [q.ev_id, decision === 'accept' ? 'accepted' : 'declined']);
    await db.query(`INSERT INTO event_notes (event_id, kind, body) VALUES ($1, 'client', $2)`, [
      q.ev_id,
      decision === 'accept'
        ? `Proposal v${q.version} accepted by ${name} (from ${req.ip})${note ? `\n“${note}”` : ''}`
        : `Proposal v${q.version} declined${note ? `\n“${note}”` : ''}`,
    ]);
    await alertManagers(
      req.app,
      decision === 'accept' ? `Proposal accepted · ${q.reference}` : `Proposal declined · ${q.reference}`,
      decision === 'accept' ? `${q.name} accepted. Deposit to collect.` : `${q.name}${note ? `: ${note.slice(0, 100)}` : ''}`,
      `/events?id=${q.ev_id}`,
    );
    req.app.get('io')?.to('staff').emit('event:updated', { id: q.ev_id });
    res.json({ success: true, status: decision === 'accept' ? 'accepted' : 'declined' });
  } catch (e) {
    fail(res, e, 'Could not record your answer');
  }
});

// ----------------------------------------------------------------------------------- deposit paid online
// From the proposal page once accepted: card (Stripe) or MTN / Orange money (PayWithCAMSOL). See services/payments/eventDeposits.js.
const deposits = require('../services/payments/eventDeposits');

router.get('/quote/:token/deposit', async (req, res) => {
  try {
    const q = await deposits.dueFor(req.params.token);
    const pay = await require('../services/payments/settings').publicConfig();
    res.json({
      due: q.due,
      paid: Number(q.deposit_paid),
      deposit: Number(q.deposit_amount),
      currency: q.currency,
      card: pay.card,
      mobileMoney: { automatic: pay.mobileMoney.automatic && String(q.currency).toUpperCase() === 'XAF' },
    });
  } catch (e) {
    fail(res, e, 'Could not load the deposit');
  }
});

router.post('/quote/:token/deposit/card', async (req, res) => {
  try {
    res.json(await deposits.startCard(req.params.token));
  } catch (e) {
    fail(res, e, 'Could not start the card payment');
  }
});

router.post('/quote/:token/deposit/card/confirm', async (req, res) => {
  try {
    res.json(await deposits.confirmCard(req.params.token, req.body?.payment_intent_id, req.app));
  } catch (e) {
    fail(res, e, 'Could not confirm the payment');
  }
});

router.post('/quote/:token/deposit/mobile-money', async (req, res) => {
  try {
    res.json(await deposits.startMobileMoney(req.params.token, { provider: req.body?.provider, phone: req.body?.phone }));
  } catch (e) {
    fail(res, e, 'Could not request the mobile money payment');
  }
});

router.get('/quote/:token/deposit/:paymentId', async (req, res) => {
  try {
    res.json(await deposits.statusOf(req.params.token, req.params.paymentId, req.app));
  } catch (e) {
    fail(res, e, 'Could not check the payment');
  }
});

module.exports = router;

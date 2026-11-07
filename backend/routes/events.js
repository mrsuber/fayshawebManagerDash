/**
 * Events — public side (website and guest app).
 *
 *   POST /api/events                        an event request (signed in or not; a signed-in guest's account is linked)
 *   GET  /api/events/mine                   the signed-in guest's requests with their latest quote
 *   GET  /api/events/quote/:token           a quote sent to the client (private link)
 *   POST /api/events/quote/:token/respond   { decision: 'accept' | 'counter' | 'decline', name?, budget?, note? }
 *                                           counter = "too much for us": the client gives their budget and the team revises
 *   GET  /api/events/quote/:token/invoice   the invoice (printable page) once accepted
 *   GET  /api/events/quote/:token/receipt/:paymentId   a payment's receipt (printable page)
 */
const express = require('express');
const db = require('../config/database');
const { authenticateToken, userFromRequest } = require('../middleware/auth');
const ev = require('../services/events');
const billing = require('../services/eventBilling');
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
      await Promise.all(
        rows.map(async (r) => {
          const q = quotes.find((x) => x.id === r.q_id);
          const { assignedTo, assignedName, ...out } = ev.toEvent(r);
          let account = null;
          if (q && q.status === 'accepted') {
            const acc = await billing.account(r.id);
            const docs = billing.links(q.token);
            account = {
              invoiceNumber: q.invoice_number, invoiceUrl: q.invoice_number ? docs.invoice : null, total: acc.total, paid: acc.paid,
              balance: acc.balance, depositDue: acc.depositDue, paidInFull: acc.paidInFull,
              payments: acc.payments.map((p) => ({ ...p, receiptUrl: p.receiptNumber ? docs.receipt(p.id) : null })),
            };
          }
          return { ...out, quote: q ? ev.toQuote(q, { includeToken: true }) : null, quoteToken: q ? q.token : null, account };
        }),
      ),
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
    const acc = q.status === 'accepted' ? await billing.account(q.ev_id) : null;
    const docs = billing.links(q.token);
    res.json({
      reference: q.reference,
      name: q.name,
      eventType: q.event_type,
      typeLabel: ev.TYPE_LABEL[q.event_type],
      title: q.title,
      eventDate: q.event_date ? q.event_date.toISOString().slice(0, 10) : null,
      guests: q.guests,
      quote: { ...ev.toQuote(q), status: expired ? 'expired' : q.status },
      // Once accepted: the invoice, what is paid and each payment's receipt.
      account: acc && {
        invoiceNumber: q.invoice_number,
        invoiceUrl: q.invoice_number ? docs.invoice : null,
        total: acc.total,
        paid: acc.paid,
        balance: acc.balance,
        depositDue: acc.depositDue,
        paidInFull: acc.paidInFull,
        payments: acc.payments.map((p) => ({ ...p, receiptUrl: p.receiptNumber ? docs.receipt(p.id) : null })),
      },
    });
  } catch (e) {
    fail(res, e, 'Could not load the proposal');
  }
});

router.post('/quote/:token/respond', async (req, res) => {
  try {
    const q = await quoteByToken(req.params.token);
    const decision = req.body?.decision;
    if (!['accept', 'counter', 'decline'].includes(decision)) throw ev.httpError(400, 'Accept the proposal, tell us your budget, or decline');
    if (q.status !== 'sent') throw ev.httpError(409, q.status === 'superseded' ? 'This proposal has been replaced by a newer one — please check your latest email' : `This proposal is already ${q.status}`);
    if (q.valid_until && new Date(q.valid_until) < new Date(new Date().toISOString().slice(0, 10))) throw ev.httpError(409, 'This proposal has expired. Please contact us for an updated one.');
    const name = String(req.body?.name || '').trim();
    if (decision === 'accept' && !name) throw ev.httpError(400, 'Type your full name to accept');
    const note = req.body?.note ? String(req.body.note).slice(0, 2000) : null;
    const budget = decision === 'counter' ? Math.round(Number(req.body?.budget)) : null;
    if (decision === 'counter' && !(budget > 0)) throw ev.httpError(400, 'Tell us the budget you have in mind');
    const money = (n) => `${Number(n).toLocaleString('en-US')} ${q.currency}`;
    await db.query(
      `UPDATE event_quotes SET status = $2, responded_at = NOW(), response_name = $3, response_note = $4, counter_budget = $5 WHERE id = $1`,
      [q.id, decision === 'accept' ? 'accepted' : 'declined', name || null, note, budget],
    );
    // A counter keeps the conversation open: back to the team to revise the proposal around the client's budget.
    const status = { accept: 'accepted', counter: 'assessing', decline: 'declined' }[decision];
    await db.query(`UPDATE event_requests SET status = $2, client_budget = COALESCE($3, client_budget), updated_at = NOW() WHERE id = $1`, [q.ev_id, status, budget]);
    await db.query(`INSERT INTO event_notes (event_id, kind, body) VALUES ($1, 'client', $2)`, [
      q.ev_id,
      {
        accept: `Proposal v${q.version} accepted by ${name} (from ${req.ip})${note ? `\n“${note}”` : ''}`,
        counter: `Proposal v${q.version} is above the client's budget. Their budget: ${money(budget)} (the proposal was ${money(q.total)})${note ? `\n“${note}”` : ''}`,
        decline: `Proposal v${q.version} declined${note ? `\n“${note}”` : ''}`,
      }[decision],
    ]);
    if (decision === 'accept') {
      await billing.ensureInvoice(q.id);
      billing.emailInvoice(q.id).catch((err) => console.error('Invoice email failed:', err.message));
    }
    await alertManagers(
      req.app,
      { accept: `Proposal accepted · ${q.reference}`, counter: `Revise the proposal · ${q.reference}`, decline: `Proposal declined · ${q.reference}` }[decision],
      {
        accept: `${q.name} accepted. Invoice issued; deposit to collect.`,
        counter: `${q.name} can spend ${money(budget)} (proposal ${money(q.total)}). Prepare a revised proposal.`,
        decline: `${q.name}${note ? `: ${note.slice(0, 100)}` : ''}`,
      }[decision],
      `/events?id=${q.ev_id}`,
    );
    req.app.get('io')?.to('staff').emit('event:updated', { id: q.ev_id });
    res.json({ success: true, status: { accept: 'accepted', counter: 'revising', decline: 'declined' }[decision] });
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
      stage: q.stage, // deposit (confirms the date) → balance → paid
      paid: q.paid,
      balance: q.balance,
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

// ----------------------------------------------------------------------------------- invoice and receipts
const sendPage = (res, html) =>
  res.set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex')
    // A document page with its own inline styles and a print button; nothing else is loaded.
    .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:")
    .send(html);

router.get('/quote/:token/invoice', async (req, res) => {
  try {
    sendPage(res, await billing.invoiceHtml(req.params.token));
  } catch (e) {
    res.status(e.status || 500).send(e.status ? e.message : 'Could not load the invoice');
  }
});

router.get('/quote/:token/receipt/:paymentId', async (req, res) => {
  try {
    sendPage(res, await billing.receiptHtml(req.params.token, req.params.paymentId));
  } catch (e) {
    res.status(e.status || 500).send(e.status ? e.message : 'Could not load the receipt');
  }
});

module.exports = router;

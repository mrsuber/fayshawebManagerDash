/**
 * Event deposits paid online from the proposal page (/events/quote/:token): by card (Stripe) or MTN / Orange money
 * (PayWithCAMSOL). A paid deposit is recorded on the event request (deposit_paid), confirms the event and tells the
 * team — the same result as FAY OS → Events → Record deposit.
 */
const db = require('../../config/database');
const settings = require('./settings');
const { getStripe } = require('./stripe');
const camsol = require('./camsol');

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** The accepted proposal and what is still due on its deposit. */
async function dueFor(token) {
  const { rows } = await db.query(
    `SELECT q.id AS quote_id, q.currency, q.deposit_amount, q.total, q.status AS quote_status,
            e.id AS event_id, e.reference, e.name, e.email, e.status AS event_status, e.deposit_paid, e.user_id
       FROM event_quotes q JOIN event_requests e ON e.id = q.event_id WHERE q.token = $1`,
    [String(token || '')],
  );
  const q = rows[0];
  if (!q) throw httpError(404, 'This proposal link is not valid. Please contact us.');
  if (q.quote_status !== 'accepted') throw httpError(409, 'Accept the proposal first, then pay the deposit');
  const due = Math.max(0, Math.round((Number(q.deposit_amount) - Number(q.deposit_paid)) * 100) / 100);
  return { ...q, due };
}

/** Starts a card payment for the deposit due. Returns { client_secret, publishable_key, payment_id, amount, currency }. */
async function startCard(token) {
  const q = await dueFor(token);
  if (!(q.due > 0)) throw httpError(409, 'The deposit is already paid — thank you');
  const stripe = await getStripe();
  const { stripe: keys } = await settings.load();
  if (!stripe || !keys.publishableKey) throw httpError(503, 'Card payments are not available right now. Please choose mobile money.');
  const fx = require('../currency');
  const currency = String(q.currency || 'XAF').toUpperCase();
  if (!fx.CARD_CURRENCIES.includes(currency)) throw httpError(400, `Card payments are not available in ${currency}`);
  const intent = await stripe.paymentIntents.create({
    amount: fx.toStripeAmount(q.due, currency),
    currency: currency.toLowerCase(),
    metadata: { kind: 'event_deposit', event_id: String(q.event_id), reference: q.reference },
    receipt_email: q.email,
    description: `Event deposit ${q.reference}`,
  });
  const p = await db.query(
    `INSERT INTO payments (event_request_id, payment_method, amount, currency, status, stripe_payment_intent_id, payment_metadata)
     VALUES ($1, 'stripe', $2, $3, 'pending', $4, $5) RETURNING id`,
    [q.event_id, q.due, currency, intent.id, JSON.stringify({ kind: 'event_deposit', quote_id: q.quote_id })],
  );
  return { client_secret: intent.client_secret, publishable_key: keys.publishableKey, payment_id: p.rows[0].id, amount: q.due, currency };
}

/** After the card form succeeds: checks the PaymentIntent with Stripe, then records the deposit. */
async function confirmCard(token, paymentIntentId, app) {
  const q = await dueFor(token);
  const stripe = await getStripe();
  if (!stripe) throw httpError(503, 'Card payments are not available right now');
  const intent = await stripe.paymentIntents.retrieve(String(paymentIntentId || ''));
  if (intent.status !== 'succeeded' || String(intent.metadata?.event_id) !== String(q.event_id)) throw httpError(402, 'The payment has not been completed');
  const p = (await db.query(`SELECT * FROM payments WHERE stripe_payment_intent_id = $1 AND event_request_id = $2`, [intent.id, q.event_id])).rows[0];
  if (!p) throw httpError(404, 'Payment not found');
  await recordPaid(p, app);
  return { status: 'completed' };
}

/** Asks the client's phone to approve the deposit (XAF only). Returns { payment_id, automatic }. */
async function startMobileMoney(token, { provider, phone }) {
  const q = await dueFor(token);
  if (!(q.due > 0)) throw httpError(409, 'The deposit is already paid — thank you');
  if (!['mtn', 'orange'].includes(provider)) throw httpError(400, 'Choose MTN Mobile Money or Orange Money');
  if (String(q.currency).toUpperCase() !== 'XAF') throw httpError(400, 'Mobile money is available for proposals in XAF');
  const { mobileMoney } = await settings.publicConfig();
  if (!mobileMoney.automatic) throw httpError(503, 'Online mobile money is not available yet. Your coordinator will send payment details.');
  camsol.accountNumber(phone);
  const started = await camsol.startCollection({ amount: q.due, phone });
  const p = await db.query(
    `INSERT INTO payments (event_request_id, payment_method, amount, currency, status, payment_metadata)
     VALUES ($1, 'mobile_money', $2, 'XAF', $3, $4) RETURNING id`,
    [q.event_id, q.due, started.state === 'failed' ? 'failed' : 'pending',
      JSON.stringify({ kind: 'event_deposit', quote_id: q.quote_id, provider, phone: String(phone).trim(), gateway: 'camsol', camsolId: started.id, simulated: Boolean(started.simulated), requestedAt: new Date().toISOString() })],
  );
  if (started.state === 'failed') throw httpError(402, started.reason || 'The payment was declined');
  return { payment_id: p.rows[0].id, automatic: true };
}

/** Status of a deposit payment for the proposal page (and settles mobile money that is still waiting). */
async function statusOf(token, paymentId, app) {
  const p = (await db.query(
    `SELECT p.* FROM payments p JOIN event_quotes eq ON eq.event_id = p.event_request_id WHERE p.id = $1 AND eq.token = $2 LIMIT 1`,
    [paymentId, String(token || '')],
  )).rows[0];
  if (!p) throw httpError(404, 'Payment not found');
  if (p.status === 'pending' && p.payment_method === 'mobile_money') await require('./mobileMoney').settle(p.id, app);
  const fresh = (await db.query('SELECT status, error_message FROM payments WHERE id = $1', [p.id])).rows[0];
  const q = await dueFor(token).catch(() => null);
  return { status: fresh.status, message: fresh.error_message || null, due: q ? q.due : 0 };
}

/** Money received for a deposit: completes the payment, adds it to the event and confirms the event. Idempotent. */
async function recordPaid(payment, app) {
  const done = await db.query(
    `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP, updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'failed') RETURNING *`,
    [payment.id],
  );
  if (!done.rows[0]) return { already: true };
  const p = done.rows[0];
  const e = (await db.query(
    `UPDATE event_requests SET deposit_paid = deposit_paid + $2, deposit_paid_at = COALESCE(deposit_paid_at, NOW()),
            status = CASE WHEN status IN ('accepted', 'confirmed') THEN 'confirmed' ELSE status END, updated_at = NOW()
      WHERE id = $1 RETURNING id, reference, name, currency, user_id`,
    [p.event_request_id, p.amount],
  )).rows[0];
  if (!e) return { missing: true };
  const amount = `${Number(p.amount).toLocaleString('en-US')} ${p.currency || e.currency}`;
  const how = p.payment_method === 'stripe' ? 'card' : 'mobile money';
  await db.query(`INSERT INTO event_notes (event_id, kind, body) VALUES ($1, 'event', $2)`, [e.id, `Deposit paid online: ${amount} by ${how} · date confirmed`]);
  await require('../stayKeys').alertManagers(app, `Deposit paid · ${e.reference}`, `${e.name} paid ${amount} by ${how}. The event is confirmed.`, `/events?id=${e.id}`);
  app?.get?.('io')?.to('staff').emit('event:updated', { id: e.id });
  if (e.user_id) {
    try {
      await require('../guestPush').notifyGuest(app, e.user_id, { title: 'Deposit received', body: `Thank you — your ${amount} deposit for ${e.reference} is received and your date is confirmed.`, event: 'event:updated', data: { screen: 'MyEvents', id: e.id } });
    } catch {
      // the client also sees it on the proposal page
    }
  }
  return { confirmed: true };
}

module.exports = { dueFor, startCard, confirmCard, startMobileMoney, statusOf, recordPaid };

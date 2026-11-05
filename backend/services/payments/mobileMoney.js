/**
 * Mobile money for stays (MTN Mobile Money, Orange Money).
 *
 * With PayWithCAMSOL keys (or simulated in development) the guest approves the payment on their phone and the stay
 * is confirmed automatically: by the PayWithCAMSOL webhook, by the guest's page asking for the status, or by the
 * check every 30 seconds — whichever comes first (settling is idempotent). Without keys, the payment is recorded
 * and the team confirms it when the money arrives (HQ → Finance, FAY OS → Reservations), as before.
 */
const db = require('../../config/database');
const camsol = require('./camsol');
const settings = require('./settings');
const { finalizeStay } = require('../stayKeys');
const { HOLD_EXPIRED } = require('../bookingHolds');

const PENDING_LIMIT_HOURS = 24;
const metaOf = (p) => (typeof p.payment_metadata === 'string' ? JSON.parse(p.payment_metadata || '{}') : p.payment_metadata || {});

/**
 * Records (or updates) the booking's pending mobile money payment and, when automatic, asks the guest's phone to
 * approve it. Returns { payment, automatic, simulated }. Throws errors with an HTTP status (400 bad number, 402 refused).
 */
async function request({ booking, provider, phone, source, app }) {
  const { mobileMoney } = await settings.publicConfig();
  if (mobileMoney.automatic) camsol.accountNumber(phone); // a number PayWithCAMSOL can charge, before anything is recorded
  const details = { provider, phone: String(phone).trim(), source: source === 'app' ? 'app' : 'website' };
  const existing = await db.query(
    `UPDATE payments SET payment_metadata = $2, amount = $3, error_message = NULL
      WHERE id = (SELECT id FROM payments WHERE booking_id = $1 AND payment_method = 'mobile_money' AND status = 'pending' LIMIT 1)
      RETURNING *`,
    [booking.id, JSON.stringify(details), booking.final_price],
  );
  const payment = existing.rows[0] || (await db.query(
    `INSERT INTO payments (booking_id, payment_method, amount, currency, status, payment_metadata)
     VALUES ($1, 'mobile_money', $2, 'XAF', 'pending', $3) RETURNING *`,
    [booking.id, booking.final_price, JSON.stringify(details)],
  )).rows[0];

  if (mobileMoney.automatic) {
    try {
      const started = await camsol.startCollection({ amount: booking.final_price, phone });
      await db.query(
        `UPDATE payments SET payment_metadata = payment_metadata || jsonb_build_object('gateway', 'camsol', 'camsolId', $2::text, 'simulated', $3::boolean, 'requestedAt', NOW())
          WHERE id = $1`,
        [payment.id, started.id, Boolean(started.simulated)],
      );
      if (started.state === 'failed') {
        await markFailed(payment.id, started.reason || 'The payment was declined');
        throw Object.assign(new Error(started.reason || 'The payment was declined. Check the number and try again.'), { status: 402 });
      }
      return { payment: { ...payment, status: 'pending' }, automatic: true, simulated: Boolean(started.simulated) };
    } catch (e) {
      if (e.status === 400 || e.status === 402) {
        if (e.status === 402) await markFailed(payment.id, e.message);
        throw e;
      }
      // Gateway down or not set up: fall back to confirmation by the team.
      console.error('PayWithCAMSOL unavailable, mobile money falls back to manual confirmation:', e.message);
    }
  }

  await require('../notify').staffAlert(app, {
    title: `Mobile money to confirm · ${booking.booking_number}`,
    body: `${booking.guest_name} · ${Number(booking.final_price).toLocaleString('en-US')} XAF · ${provider === 'mtn' ? 'MTN MoMo' : 'Orange Money'} ${String(phone).slice(-4).padStart(String(phone).length, '•')}`,
    link: `/reservations?booking=${booking.id}`,
    level: 'action',
    category: 'payment',
    dedupeKey: `momo:${booking.id}`,
  });
  return { payment, automatic: false, simulated: false };
}

async function markFailed(paymentId, reason) {
  await db.query(`UPDATE payments SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'`, [paymentId, reason]);
}

/**
 * Money received: completes the payment and confirms the stay (reinstating it if its hold had just expired).
 * If the nights were sold in the meantime the money is kept on record and the team is asked to refund it.
 */
async function markPaid(payment, app) {
  const meta = metaOf(payment);
  const done = await db.query(
    `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP, transaction_reference = COALESCE(transaction_reference, $2), updated_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'failed') RETURNING *`,
    [payment.id, meta.camsolId || null],
  );
  if (!done.rows[0]) return { already: true };
  try {
    await db.query(
      `UPDATE bookings SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, cancelled_at = NULL, cancellation_reason = NULL
        WHERE id = $1 AND (status = 'pending' OR (status = 'cancelled' AND cancellation_reason = $2))`,
      [payment.booking_id, HOLD_EXPIRED],
    );
  } catch (e) {
    if (e.code !== '23P01') throw e;
    const b = (await db.query('SELECT booking_number, guest_name FROM bookings WHERE id = $1', [payment.booking_id])).rows[0];
    await require('../notify').staffAlert(app, {
      title: `Refund mobile money · ${b?.booking_number || payment.booking_id}`,
      body: `${b?.guest_name || 'A guest'} paid ${Number(payment.amount).toLocaleString('en-US')} XAF after the nights were taken. Refund them from HQ → Approvals.`,
      link: `/reservations?booking=${payment.booking_id}`,
      level: 'urgent',
      category: 'payment',
      dedupeKey: `momo-refund:${payment.id}`,
    });
    return { conflict: true };
  }
  await finalizeStay(payment.booking_id, { app });
  return { confirmed: true };
}

/** Looks up a pending automatic payment at PayWithCAMSOL and applies the outcome. Safe to call any number of times. */
async function settle(paymentId, app) {
  const p = (await db.query(`SELECT * FROM payments WHERE id = $1`, [paymentId])).rows[0];
  if (!p || p.payment_method !== 'mobile_money' || p.status !== 'pending') return p ? p.status : null;
  const meta = metaOf(p);
  if (!meta.camsolId) return 'pending';
  let outcome;
  try {
    outcome = await camsol.getCollection(meta.camsolId);
  } catch (e) {
    if (e.status === 402) outcome = { state: 'failed', reason: e.message };
    else return 'pending';
  }
  if (outcome.state === 'succeeded') {
    if (p.event_request_id) await require('./eventDeposits').recordPaid(p, app);
    else await markPaid(p, app);
    return 'completed';
  }
  const ageHours = (Date.now() - new Date(meta.requestedAt || p.created_at).getTime()) / 3600000;
  if (outcome.state === 'failed' || ageHours > PENDING_LIMIT_HOURS) {
    await markFailed(p.id, outcome.reason || (outcome.state === 'failed' ? 'The payment was declined' : 'The payment was not approved in time'));
    return 'failed';
  }
  return 'pending';
}

/** Settles every automatic mobile money payment still waiting. */
async function refreshPending(app) {
  const { rows } = await db.query(
    `SELECT id FROM payments WHERE payment_method = 'mobile_money' AND status = 'pending' AND payment_metadata ? 'camsolId' ORDER BY created_at LIMIT 100`,
  );
  for (const r of rows) {
    try {
      await settle(r.id, app);
    } catch (e) {
      console.error('Mobile money check failed for payment', r.id, e.message);
    }
  }
}

/** Every 30 seconds (FINANCE_POLL_SECONDS), for the life of the process. */
function startPoller(app) {
  const seconds = parseInt(process.env.FINANCE_POLL_SECONDS, 10) || 30;
  const tick = () => refreshPending(app).catch((e) => console.error('Mobile money check failed:', e.message));
  return setInterval(tick, seconds * 1000).unref();
}

/** The payment PayWithCAMSOL's webhook refers to (by its id or our reference). */
async function findByGatewayId(id) {
  if (!id) return null;
  const { rows } = await db.query(`SELECT id FROM payments WHERE payment_method = 'mobile_money' AND payment_metadata->>'camsolId' = $1 LIMIT 1`, [String(id)]);
  return rows[0]?.id || null;
}

module.exports = { request, settle, refreshPending, startPoller, markPaid, findByGatewayId };

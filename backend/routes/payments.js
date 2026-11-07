const express = require('express');
const router = express.Router();
// The pg Pool itself: confirm/refund use pool.connect() for transactions.
const { pool } = require('../config/database');
const { requireStaff } = require('../middleware/auth');
const { finalizeStay } = require('../services/stayKeys');
// Keys come from HQ → Settings → Payments (or the environment): see services/payments/settings.js.
const paymentSettings = require('../services/payments/settings');
const { getStripe } = require('../services/payments/stripe');
const mobileMoney = require('../services/payments/mobileMoney');
const camsol = require('../services/payments/camsol');

// ============================================
// PAYMENT ROUTES
// ============================================

// Get all payments
router.get('/', requireStaff, async (req, res) => {
  try {
    const { booking_id, status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        p.*,
        b.booking_number,
        b.guest_name,
        b.guest_email
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (booking_id) {
      query += ` AND p.booking_id = $${paramCount}`;
      params.push(booking_id);
      paramCount++;
    }

    if (status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      payments: result.rows
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
});

// Which ways to pay are open, and the public Stripe key, for the website and the app.
router.get('/config', async (req, res) => {
  try {
    res.json({ success: true, ...(await paymentSettings.publicConfig()) });
  } catch (error) {
    console.error('Error reading payment config:', error);
    res.json({ success: true, card: null, mobileMoney: { automatic: false } });
  }
});

// Status of a mobile money payment, asked by the guest's page while they approve it on their phone.
// The booking number is required with the id so payments can't be looked up one by one.
router.get('/mobile-money/:id/status', async (req, res) => {
  try {
    const found = await pool.query(
      `SELECT p.id, p.status, p.error_message, b.booking_number, b.status AS booking_status
         FROM payments p JOIN bookings b ON b.id = p.booking_id
        WHERE p.id = $1 AND p.payment_method = 'mobile_money'`,
      [req.params.id]
    );
    const p = found.rows[0];
    if (!p || String(req.query.booking || '') !== p.booking_number) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    const status = p.status === 'pending' ? await mobileMoney.settle(p.id, req.app) : p.status;
    const fresh = status === p.status ? p : (await pool.query(
      `SELECT p.status, p.error_message, b.status AS booking_status FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.id = $1`,
      [p.id]
    )).rows[0];
    res.json({ success: true, status: fresh.status, message: fresh.error_message || null, booking_status: fresh.booking_status });
  } catch (error) {
    console.error('Error checking mobile money payment:', error);
    res.status(500).json({ success: false, message: 'Could not check the payment' });
  }
});

// Get single payment
router.get('/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        p.*,
        b.booking_number,
        b.guest_name,
        b.guest_email,
        b.total_price as booking_amount
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
});

// Create payment intent (Stripe). A retry after a failed card reuses the booking's open intent.
router.post('/create-intent', async (req, res) => {
  try {
    const { booking_id } = req.body;
    const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
    const booking = bookingResult.rows[0];
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'pending') {
      return res.status(409).json({ success: false, message: booking.status === 'cancelled' ? 'This booking has expired. Please book again.' : 'This booking is already paid' });
    }
    const stripe = await getStripe();
    const { stripe: stripeKeys } = await paymentSettings.load();
    if (!stripe) {
      return res.status(503).json({ success: false, message: 'Card payments are not available right now. Please choose mobile money.' });
    }

    // The guest may pay in another accepted currency: the amount is converted at today's rate, which is recorded.
    // The payment itself is kept in the base currency (XAF) so every report adds up in one currency.
    const fx = require('../services/currency');
    const cur = await fx.settings();
    const currency = String(req.body.currency || cur.base).toUpperCase();
    if (!cur.accepted.includes(currency) || !fx.CARD_CURRENCIES.includes(currency)) {
      return res.status(400).json({ success: false, message: `Card payments are available in ${cur.accepted.filter((c) => fx.CARD_CURRENCIES.includes(c)).join(', ')}` });
    }
    const charged = currency === cur.base ? Number(booking.final_price) : fx.fromBase(booking.final_price, currency, cur.rates);
    const stripeAmount = fx.toStripeAmount(charged, currency);

    const open = await pool.query(
      `SELECT * FROM payments WHERE booking_id = $1 AND payment_method = 'stripe' AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
      [booking.id]
    );
    if (open.rows[0]) {
      const intent = await stripe.paymentIntents.retrieve(open.rows[0].stripe_payment_intent_id);
      if (!['succeeded', 'canceled'].includes(intent.status) && Number(intent.amount) === stripeAmount && intent.currency === currency.toLowerCase()) {
        return res.json({ success: true, payment: open.rows[0], client_secret: intent.client_secret, publishable_key: stripeKeys.publishableKey, currency, amount: charged });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: currency.toLowerCase(),
      metadata: {
        booking_id: booking.id,
        booking_number: booking.booking_number,
        guest_email: booking.guest_email,
        guest_name: booking.guest_name,
        base_amount: String(booking.final_price),
        base_currency: cur.base,
        fx_rate: String(cur.rates[currency]),
      },
      receipt_email: booking.guest_email,
      description: `Booking ${booking.booking_number}`
    });

    const paymentResult = await pool.query(`
      INSERT INTO payments (booking_id, payment_method, amount, currency, status, stripe_payment_intent_id, payment_metadata)
      VALUES ($1, 'stripe', $2, $3, 'pending', $4, $5)
      RETURNING *
    `, [booking.id, booking.final_price, cur.base, paymentIntent.id, JSON.stringify({ charged_currency: currency, charged_amount: charged, fx_rate: cur.rates[currency] })]);

    res.json({
      success: true,
      payment: paymentResult.rows[0],
      client_secret: paymentIntent.client_secret,
      publishable_key: stripeKeys.publishableKey,
      currency,
      amount: charged
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(502).json({ success: false, message: 'Could not start the card payment. Please try again.' });
  }
});

// Request a mobile money payment (MTN Mobile Money / Orange Money) from the website or the guest app:
// automatic through PayWithCAMSOL when its keys are set, otherwise confirmed by the team (services/payments/mobileMoney.js).
const MOBILE_MONEY_PROVIDERS = ['mtn', 'orange'];
router.post('/mobile-money', async (req, res) => {
  try {
    const { booking_id, provider, phone, terms_accepted, terms_accepted_at, source } = req.body;

    if (!MOBILE_MONEY_PROVIDERS.includes(provider)) {
      return res.status(400).json({ success: false, message: 'Choose MTN Mobile Money or Orange Money' });
    }
    if (!phone || String(phone).replace(/\D/g, '').length < 8) {
      return res.status(400).json({ success: false, message: 'Enter the mobile money number to charge' });
    }
    if (!terms_accepted) {
      return res.status(400).json({ success: false, message: 'Please accept the terms of stay' });
    }

    const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = bookingResult.rows[0];
    if (booking.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'This booking is no longer awaiting payment' });
    }

    await pool.query(
      `UPDATE bookings SET terms_accepted = TRUE, terms_accepted_at = $2,
              terms_version = COALESCE(terms_version, (SELECT version FROM legal_documents WHERE slug = 'terms')) WHERE id = $1`,
      [booking.id, terms_accepted_at || new Date().toISOString()]
    );

    // One mobile money request per booking: asking again updates the number or provider. With PayWithCAMSOL the
    // guest approves on their phone and the stay confirms itself; otherwise the team confirms when the money arrives.
    const result = await mobileMoney.request({ booking, provider, phone, source, app: req.app });
    const { payment_metadata: _meta, ...payment } = result.payment;

    res.json({
      success: true,
      payment,
      automatic: result.automatic,
      simulated: result.simulated,
      booking: { id: booking.id, booking_number: booking.booking_number, status: booking.status },
    });
  } catch (error) {
    if (error.status && error.status < 500) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Error recording mobile money payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record the mobile money payment' });
  }
});

// Confirm payment
router.post('/:id/confirm', requireStaff, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { transaction_reference } = req.body;

    // Get payment
    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const payment = paymentResult.rows[0];

    // Update payment status
    await client.query(`
      UPDATE payments
      SET status = 'completed', paid_at = CURRENT_TIMESTAMP, transaction_reference = $1
      WHERE id = $2
    `, [transaction_reference, id]);

    // Update booking status to confirmed
    await client.query(`
      UPDATE bookings
      SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [payment.booking_id]);

    await client.query('COMMIT');
    await finalizeStay(payment.booking_id, { app: req.app });

    res.json({
      success: true,
      message: 'Payment confirmed and booking updated'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Handle Stripe webhook
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const stripe = await getStripe();
    const signingSecret = (await paymentSettings.load()).stripe.webhookSecret;
    if (!signingSecret) {
      // Unsigned events could mark any booking as paid, so they are only accepted outside production.
      if (process.env.NODE_ENV === 'production') {
        console.error('Stripe webhook rejected: no webhook signing secret (HQ → Settings → Payments)');
        return res.status(400).send('Webhook signing secret not configured');
      }
      console.log('Webhook received without a signing secret (accepted outside production)');
    }

    let event;
    if (signingSecret) {
      // Verifying a signature needs no secret key; a placeholder client does it when cards are not set up yet.
      event = (stripe || require('stripe')('sk_test_signature_check_only')).webhooks.constructEvent(req.body, req.headers['stripe-signature'], signingSecret);
    } else {
      // Development without a signing secret: the raw body still needs parsing.
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('PaymentIntent succeeded:', paymentIntent.id);

        // Update payment and booking status
        await pool.query(`
          UPDATE payments
          SET status = 'completed', paid_at = CURRENT_TIMESTAMP,
              stripe_charge_id = $2
          WHERE stripe_payment_intent_id = $1 AND event_request_id IS NULL
        `, [paymentIntent.id, paymentIntent.latest_charge]);

        const paymentResult = await pool.query(
          'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
          [paymentIntent.id]
        );

        if (paymentResult.rows[0]?.event_request_id) {
          // An event deposit paid from the proposal page.
          await pool.query('UPDATE payments SET stripe_charge_id = $2 WHERE id = $1', [paymentResult.rows[0].id, paymentIntent.latest_charge]);
          await require('../services/payments/eventDeposits').recordPaid(paymentResult.rows[0], req.app);
        } else if (paymentResult.rows.length > 0) {
          await pool.query(`
            UPDATE bookings
            SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'pending'
          `, [paymentResult.rows[0].booking_id]);
          // (A payment that lands after its hold expired is reinstated by POST /bookings/:id/confirm, which checks the dates.)

          console.log('Booking confirmed:', paymentResult.rows[0].booking_id);
          // Key, deposit box, confirmation email and app notification (the app's own /confirm may race this; both are safe).
          await finalizeStay(paymentResult.rows[0].booking_id, { app: req.app });
        }
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object;
        console.log('PaymentIntent failed:', failedIntent.id);

        await pool.query(`
          UPDATE payments
          SET status = 'failed',
              error_message = $2
          WHERE stripe_payment_intent_id = $1
        `, [failedIntent.id, failedIntent.last_payment_error?.message || 'Payment failed']);
        break;

      case 'charge.refunded':
        const refund = event.data.object;
        console.log('Charge refunded:', refund.id);

        // Stripe reports the refund in the charged currency's smallest unit; it is stored in the base currency.
        const { decimalsOf } = require('../utils/money');
        const charged = String(refund.currency || 'xaf').toUpperCase();
        const refundedInCharged = Number(refund.amount_refunded) / 10 ** decimalsOf(charged);
        await pool.query(`
          UPDATE payments
          SET status = 'refunded',
              refunded_at = CURRENT_TIMESTAMP,
              refund_amount = ROUND($2::numeric * COALESCE(NULLIF(payment_metadata->>'fx_rate', '')::numeric, 1), 2)
          WHERE stripe_charge_id = $1
        `, [refund.id, refundedInCharged]);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// PayWithCAMSOL webhook: signed with the webhook secret. The body is never trusted — the payment's status is
// fetched from PayWithCAMSOL again (services/payments/mobileMoney.js#settle). Always answers 200 once verified.
router.post('/webhook/camsol', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!(await camsol.verifyWebhook(raw, req.headers))) return res.status(401).json({ received: false });
    let body = {};
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      body = {};
    }
    const data = body.data || body;
    const id = await mobileMoney.findByGatewayId(data.refillId || data.id || data.reference);
    if (id) await mobileMoney.settle(id, req.app);
    res.json({ received: true });
  } catch (error) {
    console.error('PayWithCAMSOL webhook error:', error);
    res.json({ received: true });
  }
});

const refundError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Refunds a completed payment (through Stripe when it was a card payment). A full refund cancels a booking that has
 * not started; a partial one leaves the booking as it is.
 * Shared by POST /api/payments/:id/refund and HQ approvals. Throws errors carrying an HTTP status.
 */
async function processRefund(id, refundAmount, refundReason) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentResult = await client.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (paymentResult.rows.length === 0) throw refundError(404, 'Payment not found');
    const payment = paymentResult.rows[0];
    if (payment.status !== 'completed') throw refundError(400, 'Only completed payments can be refunded');

    // Process Stripe refund if payment was through Stripe
    if (payment.payment_method === 'stripe' && payment.stripe_payment_intent_id) {
      try {
        // Refunds are asked for in the base currency; the card is refunded in the currency it was charged in, at
        // the rate of the original payment.
        const meta = payment.payment_metadata || {};
        const chargedCurrency = meta.charged_currency || payment.currency || 'XAF';
        const rate = Number(meta.fx_rate) || 1;
        const { toStripeAmount } = require('../services/currency');
        const stripe = await getStripe();
        if (!stripe) throw refundError(503, 'Card refunds need the Stripe keys (HQ → Settings → Payments)');
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          amount: refundAmount ? toStripeAmount(chargedCurrency === (payment.currency || 'XAF') ? parseFloat(refundAmount) : parseFloat(refundAmount) / rate, chargedCurrency) : undefined,
          reason: 'requested_by_customer'
        });
        console.log('Stripe refund created:', refund.id);
      } catch (stripeError) {
        console.error('Stripe refund error:', stripeError);
        throw refundError(500, `Failed to process Stripe refund: ${stripeError.message}`);
      }
    }

    await client.query(`
      UPDATE payments
      SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP,
          refund_amount = $1, refund_reason = $2
      WHERE id = $3
    `, [refundAmount || payment.amount, refundReason, id]);

    // A full refund ends the stay; a partial one (a price difference, a goodwill gesture) leaves it as it is.
    const full = !refundAmount || Number(refundAmount) >= Number(payment.amount);
    if (full && payment.booking_id) {
      await client.query(`
        UPDATE bookings
        SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP),
            cancellation_reason = COALESCE(cancellation_reason, $1)
        WHERE id = $2 AND status IN ('pending', 'confirmed', 'cancelled')
      `, [refundReason, payment.booking_id]);
    }

    await client.query('COMMIT');
    return payment;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Process refund
router.post('/:id/refund', requireStaff, async (req, res) => {
  try {
    const { refund_amount, refund_reason } = req.body;
    await processRefund(req.params.id, refund_amount, refund_reason);
    res.json({
      success: true,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Failed to process refund',
      error: error.message
    });
  }
});

// Get payment statistics
router.get('/stats/overview', requireStaff, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_payments,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
        SUM(amount) FILTER (WHERE status = 'completed') as total_revenue,
        SUM(amount) FILTER (WHERE status = 'completed' AND DATE(paid_at) = CURRENT_DATE) as today_revenue,
        SUM(refund_amount) as total_refunds
      FROM payments
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
});

module.exports = router;
module.exports.processRefund = processRefund;

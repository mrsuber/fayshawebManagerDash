const express = require('express');
const router = express.Router();
// The pg Pool itself: confirm/refund use pool.connect() for transactions.
const { pool } = require('../config/database');
const { requireStaff } = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

// Create payment intent (Stripe)
router.post('/create-intent', async (req, res) => {
  try {
    const { booking_id } = req.body;

    console.log('📝 Payment intent requested for booking ID:', booking_id);
    console.log('📝 Booking ID type:', typeof booking_id);

    // Get booking details
    const bookingResult = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [booking_id]
    );

    console.log('📝 Query result: found', bookingResult.rows.length, 'booking(s)');

    if (bookingResult.rows.length === 0) {
      // Log recent bookings to help debug
      const recentBookings = await pool.query(
        'SELECT id, booking_number, guest_email, created_at FROM bookings ORDER BY created_at DESC LIMIT 5'
      );
      console.log('📝 Recent bookings:', recentBookings.rows.map(b => `ID: ${b.id}, Number: ${b.booking_number}`).join(', '));

      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Stripe not configured. Please add STRIPE_SECRET_KEY to environment variables.'
      });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(booking.final_price), // Amount in XAF (no decimal conversion needed)
      currency: 'xaf',
      metadata: {
        booking_id: booking.id,
        booking_number: booking.booking_number,
        guest_email: booking.guest_email,
        guest_name: booking.guest_name
      },
      receipt_email: booking.guest_email,
      description: `Booking ${booking.booking_number} - Check-in: ${booking.check_in_date}`
    });

    // Save payment record
    const paymentResult = await pool.query(`
      INSERT INTO payments (
        booking_id, payment_method, amount, currency, status,
        stripe_payment_intent_id, payment_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      booking_id,
      'stripe',
      booking.final_price,
      'XAF',
      'pending',
      paymentIntent.id,
      JSON.stringify({ client_secret: paymentIntent.client_secret })
    ]);

    res.json({
      success: true,
      payment: paymentResult.rows[0],
      client_secret: paymentIntent.client_secret,
      publishable_key: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// Request a mobile money payment (MTN Mobile Money / Orange Money) from the website.
// No mobile money gateway is connected yet, so this records a pending payment with the guest's
// number and their terms acceptance; staff confirm the booking once the money arrives
// (POST /api/bookings/:id/confirm as staff, or the manager dashboard).
const MOBILE_MONEY_PROVIDERS = ['mtn', 'orange'];
router.post('/mobile-money', async (req, res) => {
  try {
    const { booking_id, provider, phone, terms_accepted, terms_accepted_at } = req.body;

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

    const paymentResult = await pool.query(`
      INSERT INTO payments (booking_id, payment_method, amount, currency, status, payment_metadata)
      VALUES ($1, 'mobile_money', $2, 'XAF', 'pending', $3)
      RETURNING id, booking_id, payment_method, amount, currency, status, created_at
    `, [booking.id, booking.final_price, JSON.stringify({ provider, phone: String(phone).trim(), source: 'website' })]);

    await pool.query(
      'UPDATE bookings SET terms_accepted = TRUE, terms_accepted_at = $2 WHERE id = $1',
      [booking.id, terms_accepted_at || new Date().toISOString()]
    );

    res.json({
      success: true,
      payment: paymentResult.rows[0],
      booking: { id: booking.id, booking_number: booking.booking_number, status: booking.status },
    });
  } catch (error) {
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
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      // Unsigned events could mark any booking as paid, so they are only accepted outside production.
      if (process.env.NODE_ENV === 'production') {
        console.error('Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured');
        return res.status(400).send('Webhook signing secret not configured');
      }
      console.log('Webhook received but STRIPE_WEBHOOK_SECRET not configured (accepted outside production)');
    }

    let event;

    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
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
          WHERE stripe_payment_intent_id = $1
        `, [paymentIntent.id, paymentIntent.latest_charge]);

        const paymentResult = await pool.query(
          'SELECT booking_id FROM payments WHERE stripe_payment_intent_id = $1',
          [paymentIntent.id]
        );

        if (paymentResult.rows.length > 0) {
          await pool.query(`
            UPDATE bookings
            SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [paymentResult.rows[0].booking_id]);

          console.log('Booking confirmed:', paymentResult.rows[0].booking_id);
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

        await pool.query(`
          UPDATE payments
          SET status = 'refunded',
              refunded_at = CURRENT_TIMESTAMP,
              refund_amount = $2
          WHERE stripe_charge_id = $1
        `, [refund.id, refund.amount_refunded]);
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

// Process refund
router.post('/:id/refund', requireStaff, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { refund_amount, refund_reason } = req.body;

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

    if (payment.status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Only completed payments can be refunded'
      });
    }

    // Process Stripe refund if payment was through Stripe
    if (payment.payment_method === 'stripe' && payment.stripe_payment_intent_id) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          amount: refund_amount ? Math.round(parseFloat(refund_amount)) : undefined,
          reason: 'requested_by_customer'
        });
        console.log('Stripe refund created:', refund.id);
      } catch (stripeError) {
        console.error('Stripe refund error:', stripeError);
        await client.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          message: 'Failed to process Stripe refund',
          error: stripeError.message
        });
      }
    }

    // Update payment
    await client.query(`
      UPDATE payments
      SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP,
          refund_amount = $1, refund_reason = $2
      WHERE id = $3
    `, [refund_amount, refund_reason, id]);

    // Update booking to cancelled
    await client.query(`
      UPDATE bookings
      SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = $1
      WHERE id = $2
    `, [refund_reason, payment.booking_id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  } finally {
    client.release();
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

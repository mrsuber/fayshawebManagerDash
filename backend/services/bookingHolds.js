/**
 * Booking holds. A booking is created as `pending` before payment and holds its residence. Guests who leave
 * at the payment step would otherwise block those dates for good, so unpaid holds expire:
 *
 *  - card checkouts: CARD_HOLD_MINUTES (default 60) after the booking was made;
 *  - mobile money awaiting staff confirmation: MOBILE_MONEY_HOLD_HOURS (default 48).
 *
 * Bookings created by staff (FAY OS reservations) never expire on their own.
 */
const db = require('../config/database');

const HOLD_EXPIRED = 'Payment not completed in time';
const cardMinutes = () => parseInt(process.env.CARD_HOLD_MINUTES, 10) || 60;
const momoHours = () => parseInt(process.env.MOBILE_MONEY_HOLD_HOURS, 10) || 48;

/** Cancels expired holds (and fails their pending payments). `q` is the pool module or a transaction client. */
async function releaseExpiredHolds(q = db) {
  await q.query(
    `WITH expired AS (
       UPDATE bookings b
          SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = $1
        WHERE b.status = 'pending'
          AND b.created_by IS NULL
          AND (
            b.created_at < NOW() - make_interval(hours => $3)
            OR (b.created_at < NOW() - make_interval(mins => $2)
                AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.payment_method <> 'stripe' AND p.status IN ('pending', 'completed')))
          )
        RETURNING b.id
     )
     UPDATE payments p SET status = 'failed', error_message = $1
       FROM expired e WHERE p.booking_id = e.id AND p.status = 'pending'`,
    [HOLD_EXPIRED, cardMinutes(), momoHours()]
  );
}

/** Runs releaseExpiredHolds every few minutes for the life of the process. */
function startHoldSweeper(intervalMs = 5 * 60 * 1000) {
  const sweep = () => releaseExpiredHolds().catch((e) => console.error('Releasing expired booking holds failed:', e.message));
  sweep();
  return setInterval(sweep, intervalMs).unref();
}

module.exports = { releaseExpiredHolds, startHoldSweeper, HOLD_EXPIRED };

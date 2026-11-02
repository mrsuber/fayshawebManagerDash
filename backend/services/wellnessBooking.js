/**
 * Wellness bookings: codes, confirmation and what follows it.
 *
 * Every booking has a code (W + 6 characters, no 0/O/1/I) the guest shows on arrival; staff check them in with it.
 * A booking at a time the team opened in Availability is confirmed at once. Any other time is a request
 * (status 'requested') that a manager confirms or declines in FAY OS → Wellness → Bookings. Confirming issues the
 * journey PIN when the experience opens with one, and adds a priced experience to the guest's bill.
 */
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode() {
  let s = 'W';
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

/** A code no other booking uses. */
async function newCode(q) {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const { rows } = await q.query('SELECT 1 FROM wellness_bookings WHERE booking_code = $1', [code]);
    if (!rows.length) return code;
  }
  throw new Error('Could not create a booking code');
}

/** Normalises what a guest or staff member types: "w-7k3 q9a" → "W7K3Q9A". */
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

/**
 * Confirms a booking inside the caller's transaction: PIN for experiences that open with one, the charge on the
 * stay's bill (once), status 'upcoming'. Returns the updated row.
 */
async function confirmBooking(q, booking, activity, byUserId = null) {
  const needsPin = activity && (activity.requires_access_pin || activity.access_mode === 'pin');
  const pin = booking.activity_pin || (needsPin ? String(crypto.randomInt(1000, 10000)) : null);
  const qr = booking.qr_code || (pin ? `FAYSHAA-WELLNESS-${booking.activity_id}-${booking.user_id}-${Date.now()}` : null);
  const { rows } = await q.query(
    `UPDATE wellness_bookings
        SET status = 'upcoming', activity_pin = $2, qr_code = $3,
            keys_generated_at = CASE WHEN $2::varchar IS NULL THEN keys_generated_at ELSE COALESCE(keys_generated_at, CURRENT_TIMESTAMP) END,
            confirmed_at = CURRENT_TIMESTAMP, confirmed_by = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`,
    [booking.id, pin, qr, byUserId],
  );
  const price = Number(activity && activity.base_price) * Math.max(1, Number(booking.people) || 1);
  if (price > 0 && booking.apartment_booking_id) {
    const has = await q.query(`SELECT 1 FROM folio_charges WHERE source_type = 'wellness_booking' AND source_id = $1`, [booking.id]);
    if (!has.rows.length) {
      await q.query(
        `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount, source_type, source_id)
         VALUES ($1, $2, $3, 'Wellness', $4, 'wellness_booking', $5)`,
        [booking.user_id, booking.apartment_booking_id, `${booking.activity_name} — ${String(booking.booking_date).slice(0, 10)} ${String(booking.start_time).slice(0, 5)}`, price, booking.id],
      );
    }
  }
  return rows[0];
}

/** Removes the bill line of a booking that will not happen (cancelled or declined). */
async function dropCharge(q, bookingId) {
  await q.query(`DELETE FROM folio_charges WHERE source_type = 'wellness_booking' AND source_id = $1`, [bookingId]);
}

module.exports = { newCode, cleanCode, confirmBooking, dropCharge };

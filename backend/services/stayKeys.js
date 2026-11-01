/**
 * What happens once a stay is confirmed, from whichever path confirmed it (card payment in the browser or app,
 * the Stripe webhook, staff recording mobile money or cash, a reservation made in FAY OS, a check-in).
 *
 *   finalizeStay(bookingId, { app })
 *     1. issues the digital key (gate QR and door PIN) if the booking has none yet,
 *     2. hands the residence's deposit box to the right stay (see handOverDepositBox),
 *     3. emails the confirmation with the key, plus sign-in details for a guest who has never signed in,
 *     4. tells the guest in the app.
 *
 * Every step is idempotent and safe to run concurrently: the Stripe webhook and the app's own confirmation
 * usually arrive within the same second, and only one of them issues the key and sends the email.
 * It never throws: a confirmed booking stays confirmed even if email is down. Failures are recorded on the
 * booking (confirmation_error) and raised to managers so they can resend.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const db = require('../config/database');
const emailService = require('./email.service');
const { notifyGuest } = require('./guestPush');

const LIVE = ['confirmed', 'checked_in'];

const pin4 = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');
const gateCode = (bookingId, userId) =>
  `FAYSHAA-APT-${bookingId}-${userId || 0}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/** A first password that meets the sign-in rules (upper, lower, digit, symbol). */
function temporaryPassword() {
  const pick = (set) => set[crypto.randomInt(0, set.length)];
  const all = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const chars = [pick('ABCDEFGHJKLMNPQRSTUVWXYZ'), pick('abcdefghijkmnpqrstuvwxyz'), pick('23456789'), pick('!@#$%&*')];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * The deposit box of a residence belongs to one stay at a time: the stay in progress, or else the next confirmed
 * one. When it passes to a new stay, its PIN changes, so the previous guest's PIN stops working; the new PIN is
 * written on the new stay. Call after anything that changes which stay that is (confirm, check-in, check-out,
 * cancel). Returns the booking id now holding the box, or null.
 */
async function handOverDepositBox(apartmentId, q = db) {
  const box = (await q.query('SELECT id, current_booking_id FROM deposit_boxes WHERE apartment_id = $1 ORDER BY id LIMIT 1', [apartmentId])).rows[0];
  if (!box) return null;
  const holder = (
    await q.query(
      `SELECT id FROM bookings
        WHERE apartment_id = $1 AND status IN ('confirmed', 'checked_in') AND check_out_date >= CURRENT_DATE
        ORDER BY status = 'checked_in' DESC, check_in_date, id LIMIT 1`,
      [apartmentId],
    )
  ).rows[0];
  const holderId = holder ? holder.id : null;
  if (holderId === box.current_booking_id) {
    if (holderId) {
      // Already the holder: make sure the stay shows the box (e.g. a key issued before this logic existed).
      await q.query(
        `UPDATE bookings b SET deposit_box_number = d.box_number, deposit_box_pin = d.current_pin
           FROM deposit_boxes d WHERE d.id = $1 AND b.id = $2 AND (b.deposit_box_pin IS DISTINCT FROM d.current_pin OR b.deposit_box_number IS DISTINCT FROM d.box_number)`,
        [box.id, holderId],
      );
    }
    return holderId;
  }
  const newPin = (await q.query('SELECT generate_deposit_box_pin() AS pin')).rows[0].pin;
  await q.query(
    `UPDATE deposit_boxes SET current_booking_id = $2, current_pin = $3, pin_changed_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [box.id, holderId, newPin],
  );
  // The previous stay no longer has a PIN for this box.
  if (box.current_booking_id) await q.query('UPDATE bookings SET deposit_box_pin = NULL WHERE id = $1', [box.current_booking_id]);
  if (holderId) {
    await q.query(
      `UPDATE bookings SET deposit_box_number = (SELECT box_number FROM deposit_boxes WHERE id = $1), deposit_box_pin = $2 WHERE id = $3`,
      [box.id, newPin, holderId],
    );
  }
  return holderId;
}

/** Issues the gate QR code and door PIN once. Returns true when this call issued them. */
async function issueKey(booking) {
  const { rowCount } = await db.query(
    `UPDATE bookings SET gate_qr_code = $2, door_pin = $3, keys_generated_at = NOW()
      WHERE id = $1 AND gate_qr_code IS NULL`,
    [booking.id, gateCode(booking.id, booking.user_id), pin4()],
  );
  return rowCount > 0;
}

/**
 * Sign-in details to include in the confirmation, for a guest who has not yet signed in for the first time.
 * The password saved with the booking is used if there is one; otherwise (it was lost, e.g. an earlier email failed
 * and was cleared) a fresh one is set, which is safe because nobody has signed in with the old one.
 */
async function credentialsFor(booking) {
  if (!booking.user_id) return null;
  const user = (
    await db.query('SELECT id, username, email, must_change_password, last_login FROM users WHERE id = $1 AND deleted_at IS NULL', [booking.user_id])
  ).rows[0];
  if (!user || !user.must_change_password || user.last_login) return null;
  let password = booking.temporary_password;
  if (!password) {
    password = temporaryPassword();
    await db.query('UPDATE users SET password_hash = $2, is_password_temporary = true, updated_at = NOW() WHERE id = $1', [
      user.id,
      await bcrypt.hash(password, 10),
    ]);
  }
  return { username: user.username, email: user.email, temporaryPassword: password };
}

const longDay = (d) =>
  new Date(`${d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

async function loadStay(bookingId) {
  return (
    await db.query(
      `SELECT b.*, a.unit_number, a.floor, a.building, c.display_name AS category_display_name
         FROM bookings b JOIN apartments a ON a.id = b.apartment_id JOIN apartment_categories c ON c.id = a.category_id
        WHERE b.id = $1`,
      [bookingId],
    )
  ).rows[0];
}

/** Times shown in emails, from FAY OS settings (Settings → Property), defaulting to 14:00 / 11:00. */
async function stayTimes() {
  const { rows } = await db.query(`SELECT value FROM app_settings WHERE key = 'property'`).catch(() => ({ rows: [] }));
  const p = (rows[0] && rows[0].value) || {};
  return { checkIn: p.standardCheckIn || '14:00', checkOut: p.standardCheckOut || '11:00' };
}

/**
 * Sends the confirmation email with the key. Claims the send first (email_sent = true) so concurrent calls send
 * once; releases the claim and records the error if sending fails. `force` resends (staff "Resend").
 */
async function sendConfirmation(bookingId, { force = false } = {}) {
  const claim = await db.query(
    `UPDATE bookings SET email_sent = true, email_sent_at = NOW() WHERE id = $1 AND ($2 OR email_sent IS NOT TRUE) RETURNING id`,
    [bookingId, force],
  );
  if (!claim.rowCount) return { sent: false, skipped: true };
  const b = await loadStay(bookingId);
  try {
    const credentials = await credentialsFor(b);
    const times = await stayTimes();
    await emailService.sendBookingConfirmation({
      to: b.guest_email,
      guestName: b.guest_name,
      bookingNumber: b.booking_number,
      checkInDate: longDay(b.check_in_date),
      checkOutDate: longDay(b.check_out_date),
      checkInTime: times.checkIn,
      checkOutTime: times.checkOut,
      unitNumber: b.unit_number,
      apartmentCategory: b.category_display_name,
      numberOfNights: b.number_of_nights,
      totalPrice: b.final_price,
      currency: b.currency || 'XAF',
      accessCode: b.access_code,
      gateCode: b.gate_qr_code,
      qrCodePng: b.gate_qr_code ? await QRCode.toBuffer(b.gate_qr_code, { width: 400, margin: 2 }) : null,
      doorPIN: b.door_pin,
      depositBoxNumber: b.deposit_box_number,
      depositBoxPIN: b.deposit_box_pin,
      credentials,
    });
    // The first password has been delivered: it is not kept any longer.
    await db.query('UPDATE bookings SET temporary_password = NULL, confirmation_error = NULL WHERE id = $1', [bookingId]);
    return { sent: true, to: b.guest_email };
  } catch (e) {
    await db.query('UPDATE bookings SET email_sent = false, email_sent_at = NULL, confirmation_error = $2 WHERE id = $1', [
      bookingId,
      String(e.message || e).slice(0, 500),
    ]);
    return { sent: false, error: e.message || String(e), to: b.guest_email };
  }
}

/** Raises a manager notification (header bell, live, push) without needing a request object. */
async function alertManagers(app, title, body, link) {
  try {
    const { rows } = await db.query(
      'INSERT INTO staff_notifications (user_id, title, body, link) VALUES (NULL, $1, $2, $3) RETURNING id, created_at',
      [title, body, link],
    );
    const io = app && app.get && app.get('io');
    if (io) io.to('staff').emit('notification:new', { id: rows[0].id, title, body, link, createdAt: rows[0].created_at, read: false });
  } catch (e) {
    console.error('Could not raise manager alert:', e.message);
  }
}

/**
 * Everything that follows a confirmation (see top of file). Never throws.
 * Returns { keyIssued, email: { sent, skipped, error } } for callers that want to report it.
 */
async function finalizeStay(bookingId, { app = null, notify = true } = {}) {
  const out = { keyIssued: false, email: null };
  try {
    const b = await loadStay(bookingId);
    if (!b || !LIVE.includes(b.status)) return out;
    out.keyIssued = await issueKey(b);
    await handOverDepositBox(b.apartment_id);
    // A later stay knows its box number now; its PIN comes when the box passes to it.
    await db.query(
      `UPDATE bookings SET deposit_box_number = (SELECT box_number FROM deposit_boxes WHERE apartment_id = $2 ORDER BY id LIMIT 1)
        WHERE id = $1 AND deposit_box_number IS NULL`,
      [b.id, b.apartment_id],
    );
    out.email = await sendConfirmation(b.id);
    if (out.email.error) {
      console.error(`Confirmation email for ${b.booking_number} failed: ${out.email.error}`);
      await alertManagers(app, 'Confirmation email not delivered', `${b.guest_name} · ${b.booking_number}: ${out.email.error}. Open the reservation to resend.`, '/reservations');
    }
    if (notify && out.keyIssued && b.user_id) {
      notifyGuest(app, b.user_id, {
        title: 'Your stay is confirmed',
        body: `${b.category_display_name} · ${longDay(b.check_in_date)}. Your digital key is ready in the app.`,
        event: 'stay:confirmed',
        data: { bookingId: b.id, screen: 'DigitalKey' },
      });
    }
  } catch (e) {
    console.error(`Could not finalize booking ${bookingId}:`, e);
  }
  return out;
}

module.exports = { finalizeStay, sendConfirmation, handOverDepositBox, issueKey, temporaryPassword, alertManagers };

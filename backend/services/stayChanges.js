/**
 * Changing, cancelling and closing stays — the same rules for the guest app and FAY OS, and the guest is always told.
 *
 * Cancellation (terms of stay): more than 14 days before check-in → full refund; 7 to 14 days → 50 %; under 7 days or
 * a no-show → no refund. A refund is raised as an HQ approval (HQ → Approvals) and carried out once approved
 * (through Stripe for cards). An unpaid booking is simply released.
 */
const db = require('../config/database');
const { notifyGuest } = require('./guestPush');
const { handOverDepositBox } = require('./stayKeys');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';
const iso = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : String(d).slice(0, 10));

/** Share of the money refunded when cancelling `daysBefore` days before check-in. */
const refundPercent = (daysBefore) => (daysBefore > 14 ? 100 : daysBefore >= 7 ? 50 : 0);

async function load(id) {
  const { rows } = await db.query(
    `SELECT b.*, a.unit_number, c.display_name AS residence_name,
            ((b.check_in_date - (NOW() AT TIME ZONE $2)::date))::int AS days_before,
            COALESCE((SELECT SUM(amount - COALESCE(refund_amount, 0)) FROM payments p WHERE p.booking_id = b.id AND p.status = 'completed'), 0) AS paid
       FROM bookings b JOIN apartments a ON a.id = b.apartment_id JOIN apartment_categories c ON c.id = a.category_id
      WHERE b.id = $1`,
    [id, TZ],
  );
  if (!rows[0]) throw httpError(404, 'Stay not found');
  return rows[0];
}

/** What cancelling now would mean: { daysBefore, percent, paid, refund, currency, canCancel, reason? }. */
async function cancellationQuote(id) {
  const b = await load(id);
  const percent = refundPercent(b.days_before);
  const paid = Number(b.paid);
  const canCancel = ['pending', 'confirmed'].includes(b.status);
  return {
    bookingNumber: b.booking_number,
    status: b.status,
    daysBefore: b.days_before,
    percent,
    paid,
    refund: Math.round((paid * percent) / 100),
    currency: 'XAF',
    canCancel,
    reason: canCancel ? null : b.status === 'checked_in' ? 'You are in residence: talk to the front desk to leave early' : `This stay is ${b.status.replace('_', ' ')}`,
    policy: 'More than 14 days before check-in: full refund · 7 to 14 days: 50 % · under 7 days or no-show: no refund',
  };
}

async function alertTeam(app, title, body, link) {
  await require('./notify').staffAlert(app, { title, body, link, level: 'action', category: 'reservation' });
}

async function tellGuest(app, b, { title, body, screen = 'MyStays', email }) {
  if (b.user_id) notifyGuest(app, b.user_id, { title, body, event: 'stay:updated', data: { id: b.id, screen } }).catch(() => {});
  if (email && b.guest_email) {
    require('./email.service')
      .sendEmail({ to: b.guest_email, subject: title, text: `${b.guest_name || 'Hello'},\n\n${body}\n\nFaysha Wellness Residence` })
      .catch((e) => console.error('Stay email failed:', e.message));
  }
}

/**
 * Cancels a pending or confirmed stay. by: 'guest' | 'staff'. refund: raise the refund approval (staff choose; a guest
 * always gets what the policy gives). Returns { refund, approvalIds }.
 */
async function cancelStay({ id, by, reason, refund = by === 'guest', actorId = null, app }) {
  const quote = await cancellationQuote(id);
  if (!quote.canCancel) throw httpError(409, quote.reason);
  const b = await load(id);
  const why = String(reason || '').trim().slice(0, 300) || (by === 'guest' ? 'Cancelled by the guest' : 'Cancelled by Faysha');
  await db.query(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2, cancelled_by = $3,
            gate_qr_code = NULL, door_pin = NULL, updated_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'confirmed')`,
    [id, why, by],
  );
  await db.query(`UPDATE payments SET status = 'failed', error_message = 'Booking cancelled' WHERE booking_id = $1 AND status = 'pending'`, [id]);
  require('./notify').resolve(app, `momo:${id}`).catch(() => {});
  await handOverDepositBox(b.apartment_id).catch(() => {});

  // Refunds: proportional to each completed payment, raised for HQ to approve.
  const approvalIds = [];
  let refundTotal = 0;
  // A cancellation by Faysha is always refunded in full (terms of stay); a guest gets what the policy gives.
  const percent = by === 'staff' ? 100 : quote.percent;
  if (refund && quote.paid > 0 && percent > 0) {
    const share = percent / 100;
    const { rows: pays } = await db.query(
      `SELECT id, amount, COALESCE(refund_amount, 0) AS refunded, payment_method FROM payments WHERE booking_id = $1 AND status = 'completed'`,
      [id],
    );
    for (const p of pays) {
      const amount = Math.round((Number(p.amount) - Number(p.refunded)) * share);
      if (!(amount > 0)) continue;
      const { rows } = await db.query(
        `INSERT INTO approvals (type, title, detail, amount, currency, reference_type, reference_id, requested_by)
         VALUES ('refund', $1, $2, $3, 'XAF', 'payment', $4, $5) RETURNING id`,
        [
          `Refund ${b.booking_number} · ${percent}%`,
          `${by === 'guest' ? `${b.guest_name} cancelled ${quote.daysBefore} day(s) before check-in` : 'Cancelled by Faysha'} (${why}). ${p.payment_method === 'stripe' ? 'Card: refunded through Stripe once approved.' : 'Pay back by the same method once approved.'}`,
          amount,
          p.id,
          actorId,
        ],
      );
      approvalIds.push(rows[0].id);
      refundTotal += amount;
    }
  }

  const money = (n) => `${Number(n).toLocaleString('en-US')} XAF`;
  await tellGuest(app, b, {
    title: `Booking ${b.booking_number} cancelled`,
    body:
      by === 'guest'
        ? `Your stay at ${b.residence_name} (${iso(b.check_in_date)} → ${iso(b.check_out_date)}) is cancelled.${refundTotal ? ` A refund of ${money(refundTotal)} is on its way.` : quote.paid ? ' Under our terms this cancellation is not refundable.' : ''}`
        : `We are sorry: your stay at ${b.residence_name} (${iso(b.check_in_date)} → ${iso(b.check_out_date)}) has been cancelled. ${why}.${refundTotal ? ` A refund of ${money(refundTotal)} is on its way.` : ''} Our concierge will contact you.`,
    email: true,
  });
  if (by === 'guest') {
    await alertTeam(app, `Cancelled by guest · ${b.booking_number}`, `${b.guest_name} · Residence ${b.unit_number} · ${iso(b.check_in_date)}${refundTotal ? ` · refund ${money(refundTotal)} to approve` : ''}`, `/reservations?booking=${id}`);
  }
  return { refund: refundTotal, percent, approvalIds };
}

/** Moves a stay to new dates (and optionally another residence). The price is recalculated; the difference is due or owed. */
async function changeDates({ id, checkIn, checkOut, apartmentId, app }) {
  const b = await load(id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn || '') || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut || '')) throw httpError(400, 'Choose the new dates');
  const nights = Math.round((new Date(`${checkOut}T00:00:00Z`) - new Date(`${checkIn}T00:00:00Z`)) / 86400000);
  if (!(nights >= 1)) throw httpError(400, 'Check-out must be after check-in');
  if (!['pending', 'confirmed', 'checked_in'].includes(b.status)) throw httpError(409, `This stay is ${b.status.replace('_', ' ')}`);
  if (b.status === 'checked_in' && checkIn !== iso(b.check_in_date)) throw httpError(409, 'The guest is in residence: only the departure date can change');
  const apt = apartmentId || b.apartment_id;
  const { rows: rate } = await db.query(
    `SELECT COALESCE(a.custom_price, c.base_price) AS rate, a.unit_number FROM apartments a JOIN apartment_categories c ON c.id = a.category_id WHERE a.id = $1`,
    [apt],
  );
  if (!rate[0]) throw httpError(404, 'Residence not found');
  const price = Number(rate[0].rate);
  const total = price * nights;
  try {
    await db.query(
      `UPDATE bookings SET check_in_date = $2, check_out_date = $3, apartment_id = $4, number_of_nights = $5, price_per_night = $6,
              total_price = $7, final_price = $7 - COALESCE(discount_amount, 0), changed_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [id, checkIn, checkOut, apt, nights, price, total],
    );
  } catch (e) {
    if (e.code === '23P01') throw httpError(409, 'Those dates are not free for this residence');
    throw e;
  }
  const after = await load(id);
  const difference = Number(after.final_price) - Number(b.final_price);
  // Paid more than the new price: the difference is raised as a refund for HQ to approve.
  const over = Math.round(Number(after.paid) - Number(after.final_price));
  if (over > 0) {
    const pay = (await db.query(`SELECT id FROM payments WHERE booking_id = $1 AND status = 'completed' ORDER BY amount DESC LIMIT 1`, [id])).rows[0];
    if (pay) {
      await db.query(
        `INSERT INTO approvals (type, title, detail, amount, currency, reference_type, reference_id)
         VALUES ('refund', $1, $2, $3, 'XAF', 'payment', $4)`,
        [`Refund difference ${b.booking_number}`, `Dates changed to ${checkIn} → ${checkOut}: the stay now costs less than was paid.`, over, pay.id],
      );
    }
  }
  const money = (n) => `${Math.abs(Number(n)).toLocaleString('en-US')} XAF`;
  await tellGuest(app, after, {
    title: `Booking ${b.booking_number} updated`,
    body: `Your stay is now ${checkIn} → ${checkOut} (${nights} night${nights > 1 ? 's' : ''}) in Residence ${rate[0].unit_number}.${difference > 0 ? ` ${money(difference)} is added to your bill.` : difference < 0 ? ` Your bill goes down by ${money(difference)}.` : ''}`,
    email: true,
  });
  return { checkIn, checkOut, nights, total: Number(after.final_price), difference };
}

/** The guest never came: closed as a no-show (frees the residence; no refund under the terms). */
async function markNoShow({ id, app }) {
  const b = await load(id);
  if (!['pending', 'confirmed'].includes(b.status)) throw httpError(409, `This stay is ${b.status.replace('_', ' ')}`);
  if (b.days_before > 0) throw httpError(409, 'A no-show can only be recorded from the arrival day');
  await db.query(`UPDATE bookings SET status = 'no_show', cancelled_at = NOW(), cancelled_by = 'staff', cancellation_reason = 'No-show', gate_qr_code = NULL, door_pin = NULL WHERE id = $1`, [id]);
  require('./notify').resolve(app, `no-show:${id}`).catch(() => {});
  await handOverDepositBox(b.apartment_id).catch(() => {});
  await tellGuest(app, b, { title: `We missed you · ${b.booking_number}`, body: `Your stay starting ${iso(b.check_in_date)} was closed as you did not arrive. If this is a mistake, please contact our concierge.` });
  return { ok: true };
}

module.exports = { refundPercent, cancellationQuote, cancelStay, changeDates, markNoShow };

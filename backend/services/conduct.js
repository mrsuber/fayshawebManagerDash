/**
 * Guest conduct. The team records breaches of the house rules a guest accepted with the terms (visitors after hours,
 * more people than the residence sleeps, noise, damage, children left alone…) on the guest's record in Guest 360.
 * A guest who keeps breaking them can be flagged, matched on their account, email or phone:
 *  - 'review' (default): a booking from the website or the app becomes a request — no payment, the dates are held —
 *    and Faysha accepts it (confirmed, paid on the bill) or declines it in FAY OS → Reservations;
 *  - 'decline': it is declined at once with a neutral message ("contact our reservations team").
 * The guest is never told why; the managers are told each time.
 *
 * None of this is shown to the guest in the app.
 */
const db = require('../config/database');
const { staffAlert } = require('./notify');

const KINDS = {
  visitors: 'Visitors outside the rules',
  overcrowding: 'More people than the residence sleeps',
  noise: 'Noise / disturbance',
  damage: 'Damage to the property',
  children: 'Children left unsupervised',
  smoking: 'Smoking indoors',
  conduct: 'Behaviour towards staff or neighbours',
  other: 'Other',
};
/** Incidents in 12 months after which the managers are advised to consider blocking. */
const ADVISE_AFTER = 3;

const digits = (s) => String(s || '').replace(/\D/g, '').slice(-8);

/** The flagged account matching a user, email or phone ({ id, full_name, booking_restriction, … }), or null. */
async function restrictionFor({ userId = null, email = null, phone = null }, q = db) {
  const tel = digits(phone);
  const { rows } = await q.query(
    `SELECT id, full_name, email, booking_restriction, booking_restricted_at, booking_restriction_reason FROM users
      WHERE booking_restriction IS NOT NULL
        AND (id = $1::int OR ($2::text <> '' AND LOWER(email) = $2::text)
             OR (length($3::text) = 8 AND right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 8) = $3::text))
      ORDER BY booking_restriction = 'decline' DESC LIMIT 1`,
    [userId, String(email || '').trim().toLowerCase(), tel],
  );
  return rows[0] || null;
}

/** What the guest sees: polite, and never why. */
const DECLINED_MESSAGE = 'We are unable to accept this booking online. Please contact our reservations team.';
const REVIEW_MESSAGE = 'Thank you — your booking request is received. Our reservations team will confirm it shortly; no payment is taken until then.';

/** Tells the managers about a flagged guest's booking (declined at once, or waiting for their decision). */
async function announce(app, flagged, { booking = null, where }) {
  const reason = flagged.booking_restriction_reason ? ` — flagged: ${flagged.booking_restriction_reason}` : '';
  if (booking) {
    await staffAlert(app, {
      title: `Booking to review · ${flagged.full_name}`,
      body: `${booking.booking_number} · ${where}${reason}. Accept or decline in Reservations.`.slice(0, 500),
      link: `/reservations?booking=${booking.id}`,
      level: 'urgent',
      category: 'front-desk',
      dedupeKey: `booking-review:${booking.id}`,
    });
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  await staffAlert(app, {
    title: `Booking declined automatically · ${flagged.full_name}`,
    body: `${where}${reason}`.slice(0, 500),
    link: `/guest360?guest=${flagged.id}`,
    level: 'info',
    category: 'front-desk',
    dedupeKey: `booking-declined:${flagged.id}:${day}`,
  });
}

/** A guest's record: incidents (newest first), the block, and counts. */
async function record(guestId) {
  const [inc, user] = await Promise.all([
    db.query(
      `SELECT i.*, u.full_name AS by_name, b.booking_number, a.unit_number
         FROM guest_incidents i LEFT JOIN users u ON u.id = i.recorded_by
         LEFT JOIN bookings b ON b.id = i.booking_id LEFT JOIN apartments a ON a.id = b.apartment_id
        WHERE i.guest_id = $1 ORDER BY i.created_at DESC`,
      [guestId],
    ),
    db.query(
      `SELECT u.booking_restriction, u.booking_restricted_at, u.booking_restriction_reason, s.full_name AS restricted_by FROM users u LEFT JOIN users s ON s.id = u.booking_restricted_by WHERE u.id = $1`,
      [guestId],
    ),
  ]);
  const u = user.rows[0] || {};
  const yearAgo = Date.now() - 365 * 86400000;
  const incidents = inc.rows.map((i) => ({
    id: i.id,
    kind: i.kind,
    label: KINDS[i.kind] || i.kind,
    severity: i.severity,
    note: i.note,
    charge: i.charge === null ? null : Number(i.charge),
    booking: i.booking_number ? { id: i.booking_id, number: i.booking_number, residence: i.unit_number } : null,
    by: i.by_name || null,
    at: new Date(i.created_at).toISOString(),
  }));
  const lastYear = incidents.filter((i) => new Date(i.at).getTime() > yearAgo);
  return {
    incidents,
    lastYear: lastYear.length,
    serious: lastYear.filter((i) => i.severity === 'serious').length,
    advise: !u.booking_restriction && (lastYear.length >= ADVISE_AFTER || lastYear.some((i) => i.severity === 'serious')),
    restriction: u.booking_restriction
      ? { mode: u.booking_restriction, at: new Date(u.booking_restricted_at).toISOString(), reason: u.booking_restriction_reason || '', by: u.restricted_by || null }
      : null,
    kinds: KINDS,
  };
}

module.exports = { KINDS, ADVISE_AFTER, restrictionFor, DECLINED_MESSAGE, REVIEW_MESSAGE, announce, record };

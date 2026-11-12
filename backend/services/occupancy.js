const db = require('../config/database');

/**
 * Occupancy and the visitor policy (FAY OS → Visitors → Policy; app_settings 'visitors').
 * Strict enough to protect the residences, not so strict that living there is awkward:
 * day visits within visiting hours, a few people at a time, nobody sleeps over on a visitor pass — they are
 * added to the stay instead, within the residence's capacity.
 */
const DEFAULTS = {
  autoApprove: false,
  autoApproveStayGuests: false, // overnight guests within capacity are registered at once (no one waits on a manager at 23:00)
  visitFrom: '08:00',
  visitUntil: '22:00',
  maxPeoplePerVisit: 4,
  maxVisitorsPerDay: 6, // people, across all passes of a residence on one day
  maxPassesPerDay: 3,
  maxPassesPerWeek: 12,
  frequentVisitorDays: 4, // the same visitor on this many days in 7 → flagged, needs approval
  allowDiscreet: true,
  extraGuestFeePerNight: 0, // XAF per added guest per night (0 = included)
  overstayMinutes: 30,
  directions: '',
  mapsUrl: '',
  gatePhone: '',
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const int = (v, d, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

async function policy() {
  const saved = (await db.query(`SELECT value FROM app_settings WHERE key = 'visitors'`)).rows[0]?.value || {};
  return { ...DEFAULTS, ...saved };
}

/** Cleans what a manager saves. */
function clean(b = {}) {
  return {
    autoApprove: Boolean(b.autoApprove),
    autoApproveStayGuests: Boolean(b.autoApproveStayGuests),
    visitFrom: HHMM.test(b.visitFrom || '') ? b.visitFrom : DEFAULTS.visitFrom,
    visitUntil: HHMM.test(b.visitUntil || '') ? b.visitUntil : DEFAULTS.visitUntil,
    maxPeoplePerVisit: int(b.maxPeoplePerVisit, DEFAULTS.maxPeoplePerVisit, 1, 20),
    maxVisitorsPerDay: int(b.maxVisitorsPerDay, DEFAULTS.maxVisitorsPerDay, 1, 50),
    maxPassesPerDay: int(b.maxPassesPerDay, DEFAULTS.maxPassesPerDay, 1, 20),
    maxPassesPerWeek: int(b.maxPassesPerWeek, DEFAULTS.maxPassesPerWeek, 1, 100),
    frequentVisitorDays: int(b.frequentVisitorDays, DEFAULTS.frequentVisitorDays, 2, 7),
    allowDiscreet: b.allowDiscreet === undefined ? true : Boolean(b.allowDiscreet),
    extraGuestFeePerNight: int(b.extraGuestFeePerNight, 0, 0, 10000000),
    overstayMinutes: int(b.overstayMinutes, DEFAULTS.overstayMinutes, 0, 600),
    directions: String(b.directions || '').slice(0, 2000),
    mapsUrl: /^https?:\/\//.test(b.mapsUrl || '') ? b.mapsUrl : '',
    gatePhone: String(b.gatePhone || '').slice(0, 40),
  };
}

/** How many people may sleep in the residence: its own figure, else its category's. */
async function capacityOf(apartmentId, q = db) {
  const r = (await q.query(`SELECT COALESCE(a.max_occupancy, c.max_guests) AS cap FROM apartments a JOIN apartment_categories c ON c.id = a.category_id WHERE a.id = $1`, [apartmentId])).rows[0];
  return r ? Number(r.cap) : 0;
}

/** The most people registered on any night between from and to (the booking's guests plus approved/pending added guests). */
async function peakOccupancy(bookingId, from, to, { excludeId = null } = {}) {
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(n), 0) AS peak FROM (
       SELECT d::date AS night,
              (SELECT COUNT(*) FROM stay_guests g WHERE g.booking_id = $1 AND g.status IN ('pending', 'approved')
                  AND ($4::int IS NULL OR g.id <> $4) AND d::date >= g.from_date AND d::date < g.to_date) AS n
         FROM generate_series($2::date, $3::date - 1, INTERVAL '1 day') d) x`,
    [bookingId, from, to, excludeId],
  );
  return Number(rows[0].peak);
}

/** Puts an approved added guest's fee on the host's bill (once). */
async function postGuestFee(g, by = null, q = db) {
  if (!(Number(g.fee) > 0)) return;
  const done = await q.query(`SELECT 1 FROM folio_charges WHERE source_type = 'stay_guest' AND source_id = $1`, [g.id]);
  if (done.rows.length) return;
  await q.query(
    `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount, source_type, source_id, created_by)
     VALUES ($1, $2, $3, 'Accommodation', $4, 'stay_guest', $5, $6)`,
    [g.user_id, g.booking_id, `Added guest · ${g.discreet ? 'private guest' : g.full_name}`.slice(0, 255), g.fee, g.id, by],
  );
}

const normal = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Checks a new visitor pass against the policy. → { flag, forceApproval } or throws a 400 with the reason.
 */
async function checkVisit({ stay, date, from, until, people, name, phone }, p) {
  const fail = (m) => Object.assign(new Error(m), { status: 400 });
  if (people > p.maxPeoplePerVisit) throw fail(`Up to ${p.maxPeoplePerVisit} people per visit. For a larger gathering, plan it with us as an event.`);
  if (from && from < p.visitFrom) throw fail(`Visiting hours start at ${p.visitFrom}`);
  if (until && until > p.visitUntil) throw fail(`Visitors leave by ${p.visitUntil}. To have someone stay the night, add them to your stay.`);
  if (from && until && until <= from) throw fail('The visit must end after it starts');
  const sameDay = (await db.query(
    `SELECT COUNT(*)::int AS passes, COALESCE(SUM(people), 0)::int AS people FROM visitor_passes
      WHERE booking_id = $1 AND visit_date = $2 AND status IN ('pending', 'approved', 'arrived', 'left')`,
    [stay.id, date],
  )).rows[0];
  if (sameDay.passes >= p.maxPassesPerDay) throw fail(`You already have ${sameDay.passes} visits that day (the limit is ${p.maxPassesPerDay}).`);
  if (sameDay.people + people > p.maxVisitorsPerDay) throw fail(`That would make ${sameDay.people + people} visitors that day; the limit is ${p.maxVisitorsPerDay}.`);
  const week = (await db.query(
    `SELECT COUNT(*)::int AS n FROM visitor_passes WHERE booking_id = $1 AND visit_date BETWEEN $2::date - 6 AND $2::date AND status IN ('pending', 'approved', 'arrived', 'left')`,
    [stay.id, date],
  )).rows[0].n;
  if (week >= p.maxPassesPerWeek) throw fail(`You have reached ${p.maxPassesPerWeek} visits in 7 days. The front desk can help if you need more.`);
  // The same person most days is someone living here unregistered: flag it and ask the team.
  const key = normal(name);
  const tel = String(phone || '').replace(/\D/g, '').slice(-8);
  const days = (await db.query(
    `SELECT COUNT(DISTINCT visit_date)::int AS n FROM visitor_passes
      WHERE booking_id = $1 AND visit_date BETWEEN $2::date - 6 AND $2::date AND visit_date <> $2::date
        AND status IN ('pending', 'approved', 'arrived', 'left')
        AND (regexp_replace(lower(visitor_name), '[^a-z0-9]', '', 'g') = $3 OR ($4 <> '' AND right(regexp_replace(COALESCE(visitor_phone, ''), '\\D', '', 'g'), 8) = $4))`,
    [stay.id, date, key, tel],
  )).rows[0].n;
  if (days + 1 >= p.frequentVisitorDays) {
    return { flag: `Frequent visitor: ${days + 1} days in a week. If they are staying, they should be added to the stay.`, forceApproval: true };
  }
  return { flag: null, forceApproval: false };
}

/**
 * When a stay ends, is cancelled or moves: visitor passes and added guests outside it stop being valid.
 * Without a range everything still open is cancelled (cancellation, no-show, check-out).
 */
async function closeForStay(bookingId, { from = null, to = null } = {}, q = db) {
  if (!from) {
    await q.query(`UPDATE visitor_passes SET status = 'cancelled' WHERE booking_id = $1 AND status IN ('pending', 'approved')`, [bookingId]);
    await q.query(`UPDATE stay_guests SET status = 'cancelled' WHERE booking_id = $1 AND status = 'pending'`, [bookingId]);
    return;
  }
  await q.query(
    `UPDATE visitor_passes SET status = 'cancelled' WHERE booking_id = $1 AND status IN ('pending', 'approved') AND (visit_date < $2::date OR visit_date > $3::date)`,
    [bookingId, from, to],
  );
  await q.query(
    `UPDATE stay_guests SET status = 'cancelled' WHERE booking_id = $1 AND status IN ('pending', 'approved') AND (from_date >= $3::date OR to_date <= $2::date)`,
    [bookingId, from, to],
  );
  await q.query(
    `UPDATE stay_guests SET from_date = GREATEST(from_date, $2::date), to_date = LEAST(to_date, $3::date)
      WHERE booking_id = $1 AND status IN ('pending', 'approved')`,
    [bookingId, from, to],
  );
}

module.exports = { closeForStay, DEFAULTS, policy, clean, capacityOf, peakOccupancy, checkVisit, postGuestFee };

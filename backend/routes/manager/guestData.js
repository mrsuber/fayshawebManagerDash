/**
 * Guest model for the dashboard. A guest is a user with at least one non-cancelled booking.
 * Their status comes from the booking that matters now ("current"):
 *   checked in → In House; confirmed/pending covering today → Arriving;
 *   confirmed/pending in the future → Upcoming; otherwise → Checked Out.
 */

const { db, httpError, isoDate, displayTime, getSetting } = require('./lib');

/** The booking that matters now, one per user. */
const CURRENT_BOOKING = `
  SELECT DISTINCT ON (b.user_id) b.*
    FROM bookings b
   WHERE b.user_id IS NOT NULL AND b.status <> 'cancelled'
   ORDER BY b.user_id,
     CASE WHEN b.status = 'checked_in' THEN 0
          WHEN b.status IN ('confirmed', 'pending') AND b.check_out_date > CURRENT_DATE THEN 1
          ELSE 2 END,
     CASE WHEN b.status IN ('confirmed', 'pending') AND b.check_out_date > CURRENT_DATE THEN b.check_in_date END ASC,
     b.check_in_date DESC`;

const STAY_STATUS = `
  CASE WHEN cur.status = 'checked_in' THEN 'In House'
       WHEN cur.status IN ('confirmed', 'pending') AND cur.check_in_date <= CURRENT_DATE AND cur.check_out_date > CURRENT_DATE THEN 'Arriving'
       WHEN cur.status IN ('confirmed', 'pending') AND cur.check_in_date > CURRENT_DATE THEN 'Upcoming'
       ELSE 'Checked Out' END`;

const GUEST_SELECT = `
  WITH cur AS (${CURRENT_BOOKING})
  SELECT u.id, u.full_name, u.email, u.phone, u.nationality, u.dietary_preferences, u.allergies,
         gp.vip, gp.tags, gp.preferences, gp.services, gp.insights, gp.purpose, gp.country, gp.language, gp.time_zone, gp.parking,
         cur.id AS booking_id, cur.status AS booking_status, cur.check_in_date, cur.check_out_date,
         cur.number_of_guests, cur.guest_phone, cur.door_pin, cur.deposit_box_number,
         a.id AS apartment_id, a.unit_number, c.display_name AS collection,
         ${STAY_STATUS} AS stay_status,
         stats.stays, stats.revenue, stats.last_stay_at,
         fb.satisfaction
    FROM users u
    JOIN cur ON cur.user_id = u.id
    LEFT JOIN guest_profiles gp ON gp.user_id = u.id
    LEFT JOIN apartments a ON a.id = cur.apartment_id
    LEFT JOIN apartment_categories c ON c.id = a.category_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS stays, COALESCE(SUM(b.final_price), 0) AS revenue, MAX(b.check_in_date) AS last_stay_at
        FROM bookings b
       WHERE b.user_id = u.id AND b.status <> 'cancelled' AND b.check_in_date <= CURRENT_DATE
    ) stats ON true
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(f.rating) * 2, 1) AS satisfaction FROM feedback f WHERE f.rating IS NOT NULL AND LOWER(f.email) = LOWER(u.email)
    ) fb ON true
   WHERE u.deleted_at IS NULL`;

const PREF_STYLE = {
  Dining: ['restaurant', '#e8b84a'],
  'Wellness & Recovery': ['spa', '#3fd283'],
  Experiences: ['sailing', '#4fc3f7'],
  Residence: ['home', '#e6e0d4'],
  Communication: ['forum', '#9b7bf0'],
  'Special Occasions': ['redeem', '#f06292'],
};

/** Profile preferences, or a starting set derived from what the guest told us at booking. */
function preferencesOf(row) {
  if (row.preferences && row.preferences.length) return row.preferences;
  const dining = [row.dietary_preferences, row.allergies && `Allergies: ${row.allergies}`].filter(Boolean).join(' · ');
  return Object.entries(PREF_STYLE).map(([title, [icon, color]], i) => ({
    key: `p${i + 1}`,
    icon,
    color,
    title,
    detail: title === 'Dining' && dining ? dining : title === 'Communication' ? 'In-app chat' : 'Not recorded yet',
  }));
}

async function servicesOf(row) {
  const services = [...(row.services || [])].filter((s) => s.key !== 'locker' && s.key !== 'access');
  if (row.deposit_box_number) {
    const { rows } = await db.query('SELECT status FROM deposit_boxes WHERE box_number = $1', [row.deposit_box_number]);
    const waiting = rows[0]?.status === 'package_waiting';
    services.unshift({
      key: 'locker',
      icon: 'deployed_code',
      color: '#4fc3f7',
      title: `Locker ${row.deposit_box_number}`,
      detail: waiting ? 'Package ready for collection' : 'Empty',
      status: waiting ? 'Ready' : '—',
    });
  }
  services.push({
    key: 'access',
    icon: 'lock',
    color: '#e8b84a',
    title: 'Digital Key',
    detail: row.booking_status === 'checked_in' ? (row.door_pin ? 'Door PIN active' : 'Active') : 'Inactive',
    status: '—',
  });
  return services;
}

async function insightsOf(row) {
  const manual = row.insights || [];
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM wellness_bookings WHERE user_id = $1 AND status <> 'cancelled')::int AS wellness,
       (SELECT COUNT(*) FROM dining_reservations WHERE guest_id = $1 AND status <> 'cancelled')::int AS dining,
       (SELECT COUNT(*) FROM experience_bookings WHERE guest_id = $1 AND status <> 'cancelled')::int AS experiences,
       (SELECT COUNT(*) FROM service_requests WHERE guest_id = $1)::int AS requests`,
    [row.id],
  );
  const s = rows[0];
  const auto = [];
  if (row.stays > 1) auto.push(`Returning guest — ${row.stays} stays`);
  if (s.wellness) auto.push(`${s.wellness} wellness booking${s.wellness > 1 ? 's' : ''} on record`);
  else if (row.stay_status === 'In House') auto.push('Has not booked a wellness activity this stay');
  if (s.dining) auto.push(`${s.dining} dining reservation${s.dining > 1 ? 's' : ''} on record`);
  if (s.experiences) auto.push(`${s.experiences} experience${s.experiences > 1 ? 's' : ''} booked`);
  if (s.requests) auto.push(`${s.requests} service request${s.requests > 1 ? 's' : ''} raised`);
  if (row.allergies) auto.push(`Allergies noted: ${row.allergies}`);
  return [...manual, ...auto.filter((a) => !manual.includes(a))];
}

function summaryOf(row) {
  return {
    id: row.id,
    name: row.full_name,
    vip: Boolean(row.vip),
    status: row.stay_status,
    residence: row.unit_number,
    collection: row.collection,
    checkIn: isoDate(row.check_in_date),
    checkOut: isoDate(row.check_out_date),
    country: row.country || row.nationality || '',
    totalStays: row.stays,
    lastStayAt: isoDate(row.last_stay_at || row.check_in_date),
  };
}

async function fullGuest(row) {
  const property = await getSetting('property');
  return {
    ...summaryOf(row),
    checkInTime: property.checkInTime || displayTime('15:00'),
    checkOutTime: property.checkOutTime || displayTime('11:00'),
    adults: row.number_of_guests || 1,
    children: 0,
    purpose: row.purpose || 'Leisure',
    tags: row.tags || [],
    contact: {
      phone: row.phone || row.guest_phone || '',
      email: row.email,
      country: row.country || row.nationality || '',
      language: row.language || 'English',
      timeZone: row.time_zone || property.timeZone || '',
    },
    flags: { digitalKey: row.booking_status === 'checked_in', parking: Boolean(row.parking) },
    preferences: preferencesOf(row),
    services: await servicesOf(row),
    insights: await insightsOf(row),
    value: {
      revenue: Number(row.revenue || 0),
      stays: row.stays,
      satisfaction: row.satisfaction === null || row.satisfaction === undefined ? null : Number(row.satisfaction),
    },
  };
}

async function listGuests({ status, q } = {}) {
  const params = [];
  let sql = GUEST_SELECT;
  if (status === 'VIP') sql += ' AND gp.vip = true';
  else if (status) {
    params.push(status);
    sql = `SELECT * FROM (${sql}) g WHERE g.stay_status = $${params.length}`;
  }
  const { rows } = await db.query(`${sql}`, params);
  const needle = (q || '').toLowerCase();
  return rows
    .filter((r) => !needle || `${r.full_name} ${r.unit_number || ''} ${r.country || r.nationality || ''} ${r.email}`.toLowerCase().includes(needle))
    .map(summaryOf)
    .sort((a, b) => String(b.lastStayAt).localeCompare(String(a.lastStayAt)));
}

async function guestRow(id) {
  const { rows } = await db.query(`${GUEST_SELECT} AND u.id = $1`, [id]);
  if (!rows.length) throw httpError(404, 'Guest not found');
  return rows[0];
}

/** Stay status for a set of user ids (used by Communications). Users without bookings get null. */
async function stayStatuses(userIds) {
  if (!userIds.length) return {};
  const { rows } = await db.query(`WITH cur AS (${CURRENT_BOOKING}) SELECT cur.user_id, ${STAY_STATUS} AS s FROM cur WHERE cur.user_id = ANY($1)`, [userIds]);
  return Object.fromEntries(rows.map((r) => [r.user_id, r.s]));
}

module.exports = { CURRENT_BOOKING, STAY_STATUS, listGuests, guestRow, fullGuest, summaryOf, stayStatuses };

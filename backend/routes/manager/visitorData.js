/**
 * Visitors and overnight guests as staff see them, shared by FAY OS → Visitors, Reservations and Guest 360.
 * Discreet ones are masked ("Private visitor" / "Private guest") unless `reveal` is asked for (the gate checking ID).
 */
const { db, httpError, isoDate } = require('./lib');
const { toPass, PASS_SELECT, toStayGuest } = require('../guest/operations');
const occupancy = require('../../services/occupancy');

const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';

const passOut = async (id, { reveal = false } = {}) => {
  const row = (await db.query(`${PASS_SELECT.replace('FROM visitor_passes p', ', u.full_name AS host, u.phone AS host_phone FROM visitor_passes p JOIN users u ON u.id = p.user_id')} WHERE p.id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Pass not found');
  const pass = { ...toPass(row), host: row.host, hostId: row.user_id, hostPhone: row.host_phone };
  // Discreet: the list shows who the host is, not who visits; the gate sees the name when it checks the pass.
  if (pass.discreet && !reveal) Object.assign(pass, { visitorName: 'Private visitor', visitorPhone: null, visitorEmail: null, vehicle: pass.vehicle ? 'Vehicle on file' : null, note: null });
  // Staying the night on this pass: registered on the stay, so the pass also opens the gate on those nights.
  const night = (await db.query(
    `SELECT id, status, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date FROM stay_guests
      WHERE pass_id = $1 AND status IN ('pending', 'approved') ORDER BY id DESC LIMIT 1`,
    [id],
  )).rows[0];
  pass.overnight = night ? { id: night.id, status: night.status, from: night.from_date, to: night.to_date } : null;
  return pass;
};

const STAY_GUEST_SELECT = `
  SELECT g.*, b.booking_number, b.number_of_guests, b.apartment_id, b.check_in_date, b.check_out_date, a.unit_number, u.full_name AS host
    FROM stay_guests g JOIN bookings b ON b.id = g.booking_id JOIN apartments a ON a.id = b.apartment_id LEFT JOIN users u ON u.id = g.user_id`;
const stayGuestOut = async (id, { reveal = false } = {}) => {
  const g = (await db.query(`${STAY_GUEST_SELECT} WHERE g.id = $1`, [id])).rows[0];
  if (!g) throw httpError(404, 'Not found');
  // Discreet: staff see the host and the nights, not who; the gate reveals the name to check it against the ID.
  const hidden = g.discreet && !reveal ? { fullName: 'Private guest', phone: null, relation: null, note: null } : {};
  return {
    ...toStayGuest(g),
    host: g.host,
    booking: g.booking_number,
    bookingId: g.booking_id,
    residence: g.unit_number,
    booked: g.number_of_guests,
    capacity: await occupancy.capacityOf(g.apartment_id),
    ...hidden,
  };
};


/**
 * Everyone on a stay: the booker and the people they booked for, registered overnight guests, and visitors
 * (passes still to come or from the last 7 days). Used by the reservation detail and Guest 360.
 */
async function peopleOnStay(bookingId) {
  const b = (await db.query(
    `SELECT b.id, b.user_id, b.guest_name, b.number_of_guests, b.apartment_id, b.check_in_date, b.check_out_date, a.unit_number,
            (NOW() AT TIME ZONE $2)::date::text AS today
       FROM bookings b JOIN apartments a ON a.id = b.apartment_id WHERE b.id = $1`,
    [bookingId, TZ],
  )).rows[0];
  if (!b) throw httpError(404, 'Reservation not found');
  const guestIds = (await db.query(
    `SELECT id FROM stay_guests WHERE booking_id = $1 AND status IN ('pending', 'approved', 'declined') ORDER BY from_date, id`,
    [bookingId],
  )).rows;
  const passIds = (await db.query(
    `SELECT id FROM visitor_passes WHERE booking_id = $1 AND status NOT IN ('cancelled')
        AND visit_date >= (NOW() AT TIME ZONE $2)::date - 7
      ORDER BY visit_date DESC, id DESC LIMIT 30`,
    [bookingId, TZ],
  )).rows;
  const guests = await Promise.all(guestIds.map((r) => stayGuestOut(r.id)));
  const visitors = await Promise.all(passIds.map((r) => passOut(r.id)));
  const today = b.today;
  const sleepsTonight = (g) => g.status === 'approved' && g.from <= today && today < g.to;
  const addedTonight = guests.filter(sleepsTonight).length;
  return {
    bookingId: b.id,
    residence: b.unit_number,
    checkIn: isoDate(b.check_in_date),
    checkOut: isoDate(b.check_out_date),
    booker: { id: b.user_id, name: b.guest_name },
    booked: Number(b.number_of_guests) || 1,
    capacity: await occupancy.capacityOf(b.apartment_id),
    tonight: { booked: Number(b.number_of_guests) || 1, added: addedTonight, total: (Number(b.number_of_guests) || 1) + addedTonight },
    guests,
    visitors,
    visitorsToday: visitors.filter((v) => v.date === today && ['approved', 'arrived', 'left'].includes(v.status)).length,
  };
}

module.exports = { passOut, stayGuestOut, STAY_GUEST_SELECT, peopleOnStay };

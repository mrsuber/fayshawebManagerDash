/**
 * Wellness time slots: what a guest can book for an activity on a day.
 *
 * Staff open slots per activity and day in HQ → Wellness → Availability (wellness_availability). On a day
 * with none, the standard slots below are offered with the activity's own capacity. A slot is full when
 * its live bookings (upcoming, in progress or completed) reach its capacity.
 */

const STANDARD_STARTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '18:00'];
const LIVE = ['upcoming', 'in_progress', 'completed'];

const toMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};
const toTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const hhmm = (t) => String(t).slice(0, 5);
const label = (t) => {
  const [h, m] = hhmm(t).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** End time of a session that starts at `start` and lasts `duration` minutes, or null past midnight. */
function endOf(start, duration) {
  const end = toMinutes(start) + Number(duration);
  return end <= 24 * 60 - 1 ? toTime(end) : null;
}

/**
 * Slots for one activity on one date (YYYY-MM-DD), with what is left in each.
 * `q` is anything with .query (the pool or a transaction client).
 */
async function slotsFor(q, activity, date) {
  const [opened, booked] = await Promise.all([
    q.query(
      `SELECT id, start_time, end_time, max_capacity, is_available, notes
         FROM wellness_availability WHERE activity_id = $1 AND available_date = $2 ORDER BY start_time`,
      [activity.id, date]
    ),
    q.query(
      `SELECT to_char(start_time, 'HH24:MI') AS start, COUNT(*)::int AS n
         FROM wellness_bookings
        WHERE activity_id = $1 AND booking_date = $2 AND status = ANY($3)
        GROUP BY 1`,
      [activity.id, date, LIVE]
    ),
  ]);
  const taken = Object.fromEntries(booked.rows.map((r) => [r.start, r.n]));

  const base = opened.rows.length
    ? opened.rows.map((s) => ({
        slot_id: s.id,
        start_time: hhmm(s.start_time),
        end_time: hhmm(s.end_time),
        capacity: s.max_capacity,
        open: s.is_available,
        notes: s.notes,
      }))
    : STANDARD_STARTS.map((start) => ({ slot_id: null, start_time: start, end_time: endOf(start, activity.duration), capacity: activity.max_capacity || 1, open: true }))
        .filter((s) => s.end_time);

  return base.map((s) => {
    const n = taken[s.start_time] || 0;
    return { ...s, label: label(s.start_time), booked: n, remaining: Math.max(0, s.capacity - n), is_available: s.open && n < s.capacity };
  });
}

module.exports = { slotsFor, endOf, toMinutes, toTime, hhmm, LIVE, STANDARD_STARTS };

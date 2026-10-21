/**
 * Wellness availability (HQ → Wellness → Availability): the time slots staff open per activity and day.
 * Guests book them through /api/wellness-unified; a day with no slots offers the standard times
 * (services/wellnessSlots.js). Booked counts are always computed from wellness_bookings.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireStaff } = require('../middleware/auth');
const { endOf, LIVE } = require('../services/wellnessSlots');

router.use(requireStaff);

const SLOT_SELECT = `
  SELECT s.id, s.activity_id, to_char(s.available_date, 'YYYY-MM-DD') AS available_date,
         to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
         s.max_capacity, s.is_available, s.notes, s.custom_price,
         a.name AS activity_name, a.category AS activity_category, a.type AS activity_type,
         COALESCE(b.n, 0)::int AS current_bookings,
         GREATEST(s.max_capacity - COALESCE(b.n, 0), 0)::int AS available_slots
    FROM wellness_availability s
    JOIN wellness_activities a ON a.id = s.activity_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS n FROM wellness_bookings wb
       WHERE wb.activity_id = s.activity_id AND wb.booking_date = s.available_date
         AND wb.start_time = s.start_time AND wb.status = ANY($1)
    ) b ON true`;

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = (v) => /^\d{2}:\d{2}/.test(String(v || ''));

/** GET / — slots, filtered by activity_id, date_from, date_to, is_available */
router.get('/', async (req, res) => {
  try {
    const { activity_id, date_from, date_to, is_available } = req.query;
    const params = [LIVE];
    const where = [];
    if (activity_id) { params.push(activity_id); where.push(`s.activity_id = $${params.length}`); }
    if (isDate(date_from)) { params.push(date_from); where.push(`s.available_date >= $${params.length}`); }
    if (isDate(date_to)) { params.push(date_to); where.push(`s.available_date <= $${params.length}`); }
    if (is_available !== undefined) { params.push(is_available === 'true'); where.push(`s.is_available = $${params.length}`); }
    const result = await db.query(
      `${SLOT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.available_date, s.start_time, a.name`,
      params
    );
    res.json({ success: true, availability: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch availability slots' });
  }
});

/** GET /stats/overview — totals across all slots from today on */
router.get('/stats/overview', async (req, res) => {
  try {
    const result = await db.query(
      `WITH slots AS (${SLOT_SELECT} WHERE s.available_date >= CURRENT_DATE)
       SELECT COUNT(*)::int AS total_slots,
              COUNT(*) FILTER (WHERE is_available AND available_slots > 0)::int AS available_slots,
              COUNT(*) FILTER (WHERE available_slots = 0)::int AS fully_booked_slots,
              COUNT(*) FILTER (WHERE NOT is_available)::int AS disabled_slots,
              COALESCE(SUM(max_capacity), 0)::int AS total_capacity,
              COALESCE(SUM(current_bookings), 0)::int AS total_bookings,
              COUNT(DISTINCT activity_id)::int AS activities_with_availability,
              COUNT(DISTINCT available_date)::int AS dates_with_availability
         FROM slots`,
      [LIVE]
    );
    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    console.error('Error fetching availability stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch availability statistics' });
  }
});

/** GET /:id */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`${SLOT_SELECT} WHERE s.id = $2`, [LIVE, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Availability slot not found' });
    res.json({ success: true, availability: result.rows[0] });
  } catch (error) {
    console.error('Error fetching availability slot:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch availability slot' });
  }
});

/**
 * POST / — open one slot, or the same slot on every day from start_date to end_date
 * (optionally only on days_of_week, 0 = Sunday). end_time defaults to start + the activity's duration.
 */
router.post('/', async (req, res) => {
  const { activity_id, start_date, end_date, start_time, max_capacity, notes, days_of_week } = req.body;
  if (!activity_id || !isDate(start_date) || !isTime(start_time)) {
    return res.status(400).json({ success: false, error: 'Activity, start date and start time are required' });
  }
  if (end_date && (!isDate(end_date) || end_date < start_date)) {
    return res.status(400).json({ success: false, error: 'The end date must be on or after the start date' });
  }
  try {
    const activity = (await db.query('SELECT id, duration, max_capacity FROM wellness_activities WHERE id = $1', [activity_id])).rows[0];
    if (!activity) return res.status(404).json({ success: false, error: 'Activity not found' });

    const end = isTime(req.body.end_time) ? req.body.end_time.slice(0, 5) : endOf(start_time, activity.duration);
    if (!end || end <= start_time.slice(0, 5)) return res.status(400).json({ success: false, error: 'The slot must end after it starts, on the same day' });
    const capacity = parseInt(max_capacity, 10) || activity.max_capacity || 1;
    if (capacity < 1) return res.status(400).json({ success: false, error: 'Capacity must be at least 1' });

    const days = Array.isArray(days_of_week) && days_of_week.length ? days_of_week.map(Number) : null;
    const result = await db.query(
      `INSERT INTO wellness_availability (activity_id, available_date, start_time, end_time, max_capacity, notes)
       SELECT $1, d::date, $2, $3, $4, $5
         FROM generate_series($6::date, $7::date, '1 day') d
        WHERE $8::int[] IS NULL OR EXTRACT(DOW FROM d)::int = ANY($8::int[])
       ON CONFLICT (activity_id, available_date, start_time) DO NOTHING
       RETURNING id`,
      [activity.id, start_time.slice(0, 5), end, capacity, notes || null, start_date, end_date || start_date, days]
    );
    const count = result.rows.length;
    res.status(201).json({
      success: true,
      count,
      message: count ? `Opened ${count} slot${count === 1 ? '' : 's'}` : 'Those slots were already open',
    });
  } catch (error) {
    console.error('Error creating availability:', error);
    res.status(500).json({ success: false, error: 'Failed to create availability slot' });
  }
});

/** PUT /:id — change times, capacity, notes or open/close a slot. Capacity cannot drop below its bookings. */
router.put('/:id', async (req, res) => {
  try {
    const slot = (await db.query(`${SLOT_SELECT} WHERE s.id = $2`, [LIVE, req.params.id])).rows[0];
    if (!slot) return res.status(404).json({ success: false, error: 'Availability slot not found' });

    const { start_time, end_time, max_capacity, is_available, notes } = req.body;
    if (slot.current_bookings > 0 && ((start_time && start_time.slice(0, 5) !== slot.start_time) || (end_time && end_time.slice(0, 5) !== slot.end_time))) {
      return res.status(400).json({ success: false, error: 'This slot has bookings, so its times cannot change. Close it instead.' });
    }
    const capacity = max_capacity !== undefined ? parseInt(max_capacity, 10) : slot.max_capacity;
    if (!(capacity >= 1)) return res.status(400).json({ success: false, error: 'Capacity must be at least 1' });
    if (capacity < slot.current_bookings) {
      return res.status(400).json({ success: false, error: `${slot.current_bookings} guests are booked in this slot; capacity cannot be lower` });
    }
    const start = isTime(start_time) ? start_time.slice(0, 5) : slot.start_time;
    const end = isTime(end_time) ? end_time.slice(0, 5) : slot.end_time;
    if (end <= start) return res.status(400).json({ success: false, error: 'The slot must end after it starts' });

    await db.query(
      `UPDATE wellness_availability SET start_time = $1, end_time = $2, max_capacity = $3,
              is_available = COALESCE($4, is_available), notes = COALESCE($5, notes)
        WHERE id = $6`,
      [start, end, capacity, typeof is_available === 'boolean' ? is_available : null, notes ?? null, slot.id]
    );
    const updated = (await db.query(`${SLOT_SELECT} WHERE s.id = $2`, [LIVE, slot.id])).rows[0];
    res.json({ success: true, message: 'Availability updated', availability: updated });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'There is already a slot at that time' });
    console.error('Error updating availability:', error);
    res.status(500).json({ success: false, error: 'Failed to update availability slot' });
  }
});

/** DELETE /:id — only a slot nobody has booked */
router.delete('/:id', async (req, res) => {
  try {
    const slot = (await db.query(`${SLOT_SELECT} WHERE s.id = $2`, [LIVE, req.params.id])).rows[0];
    if (!slot) return res.status(404).json({ success: false, error: 'Availability slot not found' });
    if (slot.current_bookings > 0) {
      return res.status(400).json({ success: false, error: 'This slot has bookings. Close it instead, or cancel the bookings first.' });
    }
    await db.query('DELETE FROM wellness_availability WHERE id = $1', [slot.id]);
    res.json({ success: true, message: 'Slot deleted' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ success: false, error: 'Failed to delete availability slot' });
  }
});

module.exports = router;

/**
 * FAY OS → Quality: what guests think of the team, and how residences pass inspection.
 *
 *   GET   /quality/summary?days=30      averages per team member and per department, inspection pass rate
 *   GET   /quality/ratings?days=&max=   ratings (max=2 → the low ones), newest first
 *   PATCH /quality/ratings/:id          { status: 'seen' | 'followed_up', followUp? }
 *   POST  /housekeeping/rooms/:id/inspect  { cleanedBy?, checklist: [{ item, ok }], score 1–5, notes? }
 *                                         passed when every item is ok → Ready; otherwise → Dirty with the failed items
 *   GET   /housekeeping/inspections?days=30
 */
const express = require('express');
const { db, ah, httpError, isoTime, emit } = require('./lib');
const { resolve } = require('../../services/notify');

const router = express.Router();
const days = (q) => Math.max(1, Math.min(365, parseInt(q, 10) || 30));

router.get(
  '/quality/summary',
  ah(async (req, res) => {
    const d = days(req.query.days);
    const [people, departments, overall, inspections, cleaners] = await Promise.all([
      db.query(
        `SELECT COALESCE(s.full_name, r.staff_name) AS name, r.staff_id, r.department, ROUND(AVG(r.rating), 2)::float AS avg, COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE r.rating <= 2)::int AS low
           FROM staff_ratings r LEFT JOIN users s ON s.id = r.staff_id
          WHERE r.created_at > NOW() - make_interval(days => $1::int) AND COALESCE(s.full_name, r.staff_name) IS NOT NULL
          GROUP BY 1, 2, 3 ORDER BY avg DESC, n DESC`,
        [d],
      ),
      db.query(
        `SELECT COALESCE(department, 'General') AS department, ROUND(AVG(rating), 2)::float AS avg, COUNT(*)::int AS n FROM staff_ratings
          WHERE created_at > NOW() - make_interval(days => $1::int) GROUP BY 1 ORDER BY n DESC`,
        [d],
      ),
      db.query(
        `SELECT ROUND(AVG(rating), 2)::float AS avg, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE rating >= 4)::int AS happy,
                COUNT(*) FILTER (WHERE rating <= 2 AND status = 'new')::int AS open_low
           FROM staff_ratings WHERE created_at > NOW() - make_interval(days => $1::int)`,
        [d],
      ),
      db.query(
        `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE passed)::int AS passed, ROUND(AVG(score), 2)::float AS avg
           FROM housekeeping_inspections WHERE created_at > NOW() - make_interval(days => $1::int)`,
        [d],
      ),
      db.query(
        `SELECT cleaned_by AS name, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE passed)::int AS passed, ROUND(AVG(score), 2)::float AS avg
           FROM housekeeping_inspections WHERE created_at > NOW() - make_interval(days => $1::int) AND cleaned_by IS NOT NULL
          GROUP BY 1 ORDER BY avg DESC NULLS LAST`,
        [d],
      ),
    ]);
    res.json({ days: d, overall: overall.rows[0], people: people.rows, departments: departments.rows, inspections: inspections.rows[0], cleaners: cleaners.rows });
  }),
);

router.get(
  '/quality/ratings',
  ah(async (req, res) => {
    const max = Math.max(1, Math.min(5, parseInt(req.query.max, 10) || 5));
    const { rows } = await db.query(
      `SELECT r.*, g.full_name AS guest, COALESCE(s.full_name, r.staff_name) AS staff, a.unit_number
         FROM staff_ratings r JOIN users g ON g.id = r.user_id LEFT JOIN users s ON s.id = r.staff_id
         LEFT JOIN bookings b ON b.id = r.booking_id LEFT JOIN apartments a ON a.id = b.apartment_id
        WHERE r.created_at > NOW() - make_interval(days => $1::int) AND r.rating <= $2
        ORDER BY r.created_at DESC LIMIT 300`,
      [days(req.query.days), max],
    );
    res.json(
      rows.map((r) => ({
        id: r.id, guest: r.guest, guestId: r.user_id, residence: r.unit_number, staff: r.staff, department: r.department, context: r.context,
        rating: r.rating, comment: r.comment, status: r.status, followUp: r.follow_up, createdAt: isoTime(r.created_at),
      })),
    );
  }),
);

router.patch(
  '/quality/ratings/:id',
  ah(async (req, res) => {
    const { status, followUp } = req.body || {};
    if (!['seen', 'followed_up'].includes(status)) throw httpError(400, 'status is seen or followed_up');
    const { rows } = await db.query(`UPDATE staff_ratings SET status = $2, follow_up = COALESCE($3, follow_up) WHERE id = $1 RETURNING id`, [req.params.id, status, followUp ? String(followUp).slice(0, 2000) : null]);
    if (!rows[0]) throw httpError(404, 'Rating not found');
    await resolve(req.app, `rating:${req.params.id}`);
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------- Housekeeping inspection
const DEFAULT_CHECKLIST = ['Bed made, linen fresh', 'Bathroom spotless, amenities stocked', 'Floors and surfaces dust-free', 'Kitchen clean, minibar stocked', 'Towels and robes in place', 'Smart home reset (climate, lights)', 'Windows, balcony and view clear', 'Welcome touches placed'];

router.get('/housekeeping/checklist', ah(async (req, res) => {
  const v = (await db.query(`SELECT value FROM app_settings WHERE key = 'inspection'`)).rows[0]?.value;
  res.json(Array.isArray(v?.items) && v.items.length ? v.items : DEFAULT_CHECKLIST);
}));

router.put('/housekeeping/checklist', ah(async (req, res) => {
  const items = (Array.isArray(req.body?.items) ? req.body.items : []).map((i) => String(i).trim()).filter(Boolean).slice(0, 30);
  if (!items.length) throw httpError(400, 'Add at least one item');
  await db.query(`INSERT INTO app_settings (key, value, updated_by) VALUES ('inspection', $1, $2) ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2`, [JSON.stringify({ items }), req.user.id]);
  res.json(items);
}));

router.post(
  '/housekeeping/rooms/:id/inspect',
  ah(async (req, res) => {
    const b = req.body || {};
    const checklist = (Array.isArray(b.checklist) ? b.checklist : []).map((c) => ({ item: String(c.item || '').slice(0, 150), ok: Boolean(c.ok) })).filter((c) => c.item);
    if (!checklist.length) throw httpError(400, 'Go through the checklist');
    const score = parseInt(b.score, 10);
    if (!(score >= 1 && score <= 5)) throw httpError(400, 'Give the clean a score from 1 to 5');
    const room = (await db.query(`SELECT rc.*, a.unit_number FROM residence_controls rc JOIN apartments a ON a.id = rc.apartment_id WHERE rc.apartment_id = $1`, [req.params.id])).rows[0];
    if (!room) throw httpError(404, 'Residence not found');
    const passed = checklist.every((c) => c.ok);
    const cleanedBy = b.cleanedBy ? String(b.cleanedBy).slice(0, 150) : room.cleaned_by;
    await db.query(
      `INSERT INTO housekeeping_inspections (apartment_id, cleaned_by, inspector_id, checklist, score, passed, notes) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [room.apartment_id, cleanedBy || null, req.user.id, JSON.stringify(checklist), score, passed, b.notes ? String(b.notes).slice(0, 2000) : null],
    );
    const failed = checklist.filter((c) => !c.ok).map((c) => c.item);
    await db.query(
      `UPDATE residence_controls SET housekeeping_status = $2, housekeeping_note = $3, cleaned_by = $4, updated_at = NOW() WHERE apartment_id = $1`,
      [room.apartment_id, passed ? 'Ready' : 'Dirty', passed ? null : `Re-clean: ${failed.join(', ')}`.slice(0, 255), cleanedBy || null],
    );
    if (passed) await resolve(req.app, `room-not-ready:${room.apartment_id}`);
    emit(req, 'housekeeping:updated', { id: room.apartment_id, status: passed ? 'Ready' : 'Dirty' });
    res.status(201).json({ passed, failed, status: passed ? 'Ready' : 'Dirty' });
  }),
);

router.get(
  '/housekeeping/inspections',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT i.*, a.unit_number, u.full_name AS inspector FROM housekeeping_inspections i JOIN apartments a ON a.id = i.apartment_id LEFT JOIN users u ON u.id = i.inspector_id
        WHERE i.created_at > NOW() - make_interval(days => $1::int) ORDER BY i.created_at DESC LIMIT 200`,
      [days(req.query.days)],
    );
    res.json(rows.map((i) => ({ id: i.id, residence: i.unit_number, cleanedBy: i.cleaned_by, inspector: i.inspector, score: i.score, passed: i.passed, checklist: i.checklist, notes: i.notes, at: isoTime(i.created_at) })));
  }),
);

module.exports = router;

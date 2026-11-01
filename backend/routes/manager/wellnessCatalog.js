/**
 * FAY OS → Wellness → Catalogue: every wellness experience the app offers, edited without a release.
 *
 *   GET    /wellness/catalog                every experience (active or not) with its stages
 *   POST   /wellness/catalog                create
 *   PATCH  /wellness/catalog/:id            any field; `stages` (array) replaces the journey's stages in order
 *   DELETE /wellness/catalog/:id            hides it if it has bookings, deletes it otherwise
 *
 * A single service (massage, golf, yoga) has no stages; a journey (Restore: massage → steam → cold plunge) has
 * stages, each with its own duration, place, floor, photo and whether its room opens with the guest's PIN.
 */
const express = require('express');
const { db, ah, httpError, isoTime, tx } = require('./lib');

const router = express.Router();
const CATEGORIES = ['restore', 'recharge', 'reflect', 'explore', 'fitness', 'spa', 'dining', 'other'];
const LOCATIONS = ['indoor', 'outdoor', 'residence', 'offsite'];
const ACCESS = ['none', 'pin', 'qr', 'staff'];
const LOANS = ['locker', 'golf', 'sport', 'beach', 'kids', 'other'];

function fields(b, partial) {
  const f = {};
  if (!partial || b.name !== undefined) {
    if (!String(b.name || '').trim()) throw httpError(400, 'Give the experience a name');
    f.name = String(b.name).trim().slice(0, 255);
  }
  if (!partial || b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) throw httpError(400, `Mood / category must be one of ${CATEGORIES.join(', ')}`);
    f.category = b.category;
  }
  const text = (k, col, max) => {
    if (b[k] !== undefined) f[col] = String(b[k] || '').trim().slice(0, max) || null;
  };
  text('displayName', 'display_name', 255);
  text('description', 'description', 4000);
  text('icon', 'icon', 50);
  text('location', 'location', 150);
  text('floor', 'floor', 20);
  text('openingHours', 'opening_hours', 120);
  if (b.image !== undefined) f.image_url = b.image || null;
  if (b.gallery !== undefined) f.gallery = JSON.stringify((Array.isArray(b.gallery) ? b.gallery : []).filter((u) => /^\/uploads\//.test(u)).slice(0, 20));
  if (b.locationKind !== undefined) {
    if (!LOCATIONS.includes(b.locationKind)) throw httpError(400, `Where: ${LOCATIONS.join(', ')}`);
    f.location_kind = b.locationKind;
  }
  if (b.accessMode !== undefined) {
    if (!ACCESS.includes(b.accessMode)) throw httpError(400, `Access: ${ACCESS.join(', ')}`);
    f.access_mode = b.accessMode;
    f.requires_access_pin = b.accessMode === 'pin';
  }
  if (b.equipmentCategory !== undefined) f.equipment_category = LOANS.includes(b.equipmentCategory) ? b.equipmentCategory : null;
  for (const [k, col, min, max] of [['duration', 'duration', 5, 1440], ['maxCapacity', 'max_capacity', 1, 500], ['bookAheadHours', 'book_ahead_hours', 0, 720], ['displayOrder', 'display_order', 0, 10000]]) {
    if (b[k] === undefined) continue;
    const n = parseInt(b[k], 10);
    if (!(n >= min && n <= max)) throw httpError(400, `${k} must be between ${min} and ${max}`);
    f[col] = n;
  }
  if (b.price !== undefined) f.base_price = Math.max(0, Number(b.price) || 0);
  if (b.currency !== undefined) f.currency = /^[A-Z]{3}$/.test(b.currency || '') ? b.currency : 'XAF';
  for (const [k, col] of [['requiresBooking', 'requires_booking'], ['requiresStaff', 'requires_staff'], ['active', 'is_active']]) if (b[k] !== undefined) f[col] = Boolean(b[k]);
  if (b.benefits !== undefined) f.benefits = (Array.isArray(b.benefits) ? b.benefits : String(b.benefits || '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
  return f;
}

function cleanStages(list) {
  if (!Array.isArray(list)) throw httpError(400, 'stages must be a list');
  return list.slice(0, 12).map((s, i) => {
    if (!String(s.name || '').trim()) throw httpError(400, `Stage ${i + 1} needs a name`);
    const duration = parseInt(s.duration, 10);
    if (!(duration >= 1 && duration <= 600)) throw httpError(400, `Stage ${i + 1}: duration in minutes`);
    return {
      name: String(s.name).trim().slice(0, 255), description: s.description ? String(s.description).slice(0, 2000) : null, duration,
      icon: s.icon ? String(s.icon).slice(0, 50) : null, location: s.location ? String(s.location).slice(0, 255) : null, floor: s.floor ? String(s.floor).slice(0, 20) : null,
      image_url: s.image || null, requires_pin: Boolean(s.requiresPin),
    };
  });
}

const toItem = (a, stages) => ({
  id: a.id, type: a.type, category: a.category, name: a.name, displayName: a.display_name, description: a.description, icon: a.icon, image: a.image_url,
  gallery: a.gallery || [], duration: a.duration, price: Number(a.base_price || 0), currency: a.currency, maxCapacity: a.max_capacity,
  requiresBooking: a.requires_booking, requiresStaff: a.requires_staff, accessMode: a.access_mode, locationKind: a.location_kind, location: a.location,
  floor: a.floor, openingHours: a.opening_hours, bookAheadHours: a.book_ahead_hours, equipmentCategory: a.equipment_category, benefits: a.benefits || [],
  displayOrder: a.display_order, active: a.is_active, bookings: Number(a.bookings || 0), updatedAt: isoTime(a.updated_at),
  stages: (stages || []).map((s) => ({ id: s.id, number: s.stage_number, name: s.name, description: s.description, duration: s.duration, icon: s.icon, location: s.location, floor: s.floor, image: s.image_url, requiresPin: s.requires_pin })),
});

async function one(id) {
  const a = (await db.query(`SELECT a.*, (SELECT COUNT(*) FROM wellness_bookings b WHERE b.activity_id = a.id) AS bookings FROM wellness_activities a WHERE a.id = $1`, [id])).rows[0];
  if (!a) throw httpError(404, 'Experience not found');
  const stages = (await db.query('SELECT * FROM wellness_activity_stages WHERE activity_id = $1 ORDER BY stage_number', [id])).rows;
  return toItem(a, stages);
}

async function saveStages(q, id, stages) {
  await q.query('DELETE FROM wellness_activity_stages WHERE activity_id = $1', [id]);
  for (const [i, s] of stages.entries()) {
    await q.query(
      `INSERT INTO wellness_activity_stages (activity_id, stage_number, name, description, duration, icon, location, floor, image_url, requires_pin, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $2)`,
      [id, i + 1, s.name, s.description, s.duration, s.icon, s.location, s.floor, s.image_url, s.requires_pin],
    );
  }
  // A journey's length is the sum of its stages.
  await q.query(
    `UPDATE wellness_activities SET type = $2, has_stages = $3, total_stages = $4, duration = CASE WHEN $3 THEN $5 ELSE duration END, updated_at = NOW() WHERE id = $1`,
    [id, stages.length ? 'journey' : 'service', stages.length > 0, stages.length || null, stages.reduce((t, s) => t + s.duration, 0)],
  );
}

router.get(
  '/wellness/catalog',
  ah(async (req, res) => {
    const acts = (await db.query(`SELECT a.*, (SELECT COUNT(*) FROM wellness_bookings b WHERE b.activity_id = a.id) AS bookings FROM wellness_activities a ORDER BY a.is_active DESC, a.category, a.display_order, a.name`)).rows;
    const stages = (await db.query('SELECT * FROM wellness_activity_stages ORDER BY activity_id, stage_number')).rows;
    res.json(acts.map((a) => toItem(a, stages.filter((s) => s.activity_id === a.id))));
  }),
);

router.post(
  '/wellness/catalog',
  ah(async (req, res) => {
    const f = fields(req.body || {}, false);
    const stages = req.body?.stages ? cleanStages(req.body.stages) : [];
    const id = await tx(async (q) => {
      const cols = Object.keys(f);
      const { rows } = await q.query(
        `INSERT INTO wellness_activities (${cols.join(', ')}) VALUES (${cols.map((c, i) => `$${i + 1}${c === 'gallery' ? '::jsonb' : ''}`).join(', ')}) RETURNING id`,
        cols.map((c) => f[c]),
      );
      await saveStages(q, rows[0].id, stages);
      return rows[0].id;
    }).catch((e) => {
      if (e.code === '23505') throw httpError(409, 'An experience with this name already exists in this mood');
      throw e;
    });
    res.status(201).json(await one(id));
  }),
);

router.patch(
  '/wellness/catalog/:id',
  ah(async (req, res) => {
    await one(req.params.id);
    const f = fields(req.body || {}, true);
    const stages = req.body?.stages !== undefined ? cleanStages(req.body.stages) : null;
    await tx(async (q) => {
      const cols = Object.keys(f);
      if (cols.length) {
        await q.query(
          `UPDATE wellness_activities SET ${cols.map((c, i) => `${c} = $${i + 2}${c === 'gallery' ? '::jsonb' : ''}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
          [req.params.id, ...cols.map((c) => f[c])],
        );
      }
      if (stages) await saveStages(q, req.params.id, stages);
    });
    res.json(await one(req.params.id));
  }),
);

router.delete(
  '/wellness/catalog/:id',
  ah(async (req, res) => {
    const a = await one(req.params.id);
    if (a.bookings) {
      await db.query('UPDATE wellness_activities SET is_active = false, updated_at = NOW() WHERE id = $1', [a.id]);
      return res.json({ hidden: true, message: 'It has bookings, so it is hidden from guests instead of deleted' });
    }
    await db.query('DELETE FROM wellness_activities WHERE id = $1', [a.id]);
    res.json({ deleted: true });
  }),
);

module.exports = router;

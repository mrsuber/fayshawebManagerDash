/**
 * Residences (apartments) with live occupancy, smart-home state and housekeeping status.
 * Smart-home changes for an occupied residence are mirrored into smart_home_controls,
 * which the guest app reads, so guest and staff see the same state.
 */

const express = require('express');
const { db, ah, httpError, emit, isoDate } = require('./lib');

const router = express.Router();
const housekeeping = express.Router();

const SELECT = `
  SELECT a.id, a.unit_number, a.status AS apartment_status, c.display_name AS collection,
         rc.target_temp, rc.scene, rc.devices_off, rc.security, rc.housekeeping_status, rc.housekeeping_note,
         inhouse.user_id AS guest_user_id, COALESCE(inhouse.guest_name, arriving.guest_name) AS guest_name,
         arriving.id AS arriving_id, next_stay.check_in_date AS next_check_in,
         (SELECT m.file_url FROM apartment_media m
           WHERE m.media_type = 'panorama_360' AND (m.apartment_id = a.id OR m.category_id = a.category_id)
           ORDER BY m.apartment_id IS NULL, m.is_primary DESC, m.sort_order LIMIT 1) AS panorama_url
    FROM apartments a
    JOIN apartment_categories c ON c.id = a.category_id
    LEFT JOIN residence_controls rc ON rc.apartment_id = a.id
    LEFT JOIN LATERAL (SELECT user_id, guest_name FROM bookings WHERE apartment_id = a.id AND status = 'checked_in' ORDER BY check_in_date DESC LIMIT 1) inhouse ON true
    LEFT JOIN LATERAL (SELECT id, guest_name FROM bookings WHERE apartment_id = a.id AND status IN ('confirmed', 'pending') AND check_in_date <= CURRENT_DATE AND check_out_date > CURRENT_DATE LIMIT 1) arriving ON true
    LEFT JOIN LATERAL (SELECT check_in_date FROM bookings WHERE apartment_id = a.id AND status IN ('confirmed', 'pending') AND check_in_date >= CURRENT_DATE ORDER BY check_in_date LIMIT 1) next_stay ON true
   WHERE a.is_active = true`;

function statusOf(r) {
  if (r.apartment_status === 'maintenance' || r.apartment_status === 'unavailable') return 'Maintenance';
  if (r.guest_user_id) return 'Occupied';
  if (r.arriving_id) return 'Arriving';
  const hk = r.housekeeping_status || 'Ready';
  if (hk !== 'Ready') return 'Cleaning';
  // Ready rooms with an arrival in the next 3 days are "Ready"; the rest are simply vacant.
  const soon = r.next_check_in && (new Date(isoDate(r.next_check_in)) - new Date(isoDate(new Date()))) / 86400000 <= 3;
  return soon ? 'Ready' : 'Vacant';
}

function toResidence(r) {
  return {
    id: r.id,
    name: r.unit_number,
    collection: r.collection,
    guestName: r.guest_name || null,
    status: statusOf(r),
    panoramaUrl: r.panorama_url || null,
    targetTemp: r.target_temp ?? 22,
    scene: r.scene || 'relax',
    devicesOff: r.devices_off || {},
    security: r.security || { front: 'Secured', garage: 'Secured', privacy: 'Off' },
  };
}

async function one(id) {
  const { rows } = await db.query(`${SELECT} AND a.id = $1`, [id]);
  if (!rows.length) throw httpError(404, 'Residence not found');
  return rows[0];
}

/** Applies a change to residence_controls (creating the row on first use). */
async function control(id, sql, params) {
  await one(id);
  await db.query('INSERT INTO residence_controls (apartment_id) VALUES ($1) ON CONFLICT (apartment_id) DO NOTHING', [id]);
  await db.query(`UPDATE residence_controls SET ${sql} WHERE apartment_id = $1`, [id, ...params]);
  return one(id);
}

/** Mirrors climate / front-door lock into the in-house guest's smart_home_controls. */
async function mirrorToGuest(row, { temp, locked }) {
  if (!row.guest_user_id) return;
  await db.query(
    `INSERT INTO smart_home_controls (user_id, villa_id, villa_name, climate_temp, is_locked)
     VALUES ($1, $2, $3, COALESCE($4, 22), COALESCE($5, true))
     ON CONFLICT (user_id) DO UPDATE SET
       climate_temp = COALESCE($4, smart_home_controls.climate_temp),
       is_locked = COALESCE($5, smart_home_controls.is_locked),
       villa_id = $2, villa_name = $3, last_action_at = NOW(), updated_at = NOW()`,
    [row.guest_user_id, row.id, row.unit_number, temp ?? null, locked ?? null],
  );
}

router.get(
  '/',
  ah(async (req, res) => {
    const { rows } = await db.query(`${SELECT} ORDER BY c.sort_order, a.unit_number`);
    res.json(rows.map(toResidence));
  }),
);

router.patch(
  '/:id/devices/:deviceId',
  ah(async (req, res) => {
    const off = req.body?.on === false;
    const row = await control(req.params.id, 'devices_off = devices_off || jsonb_build_object($2::text, $3::boolean)', [req.params.deviceId, off]);
    res.json(toResidence(row));
  }),
);

router.patch(
  '/:id/climate',
  ah(async (req, res) => {
    const temp = Number(req.body?.targetTemp);
    if (!(temp >= 16 && temp <= 30)) throw httpError(400, 'targetTemp must be between 16 and 30');
    const row = await control(req.params.id, 'target_temp = $2', [Math.round(temp)]);
    await mirrorToGuest(row, { temp: Math.round(temp) });
    res.json(toResidence(row));
  }),
);

const SCENES = ['welcome', 'relax', 'sleep', 'away', 'wake up'];
router.post(
  '/:id/scene',
  ah(async (req, res) => {
    const scene = String(req.body?.scene || '').toLowerCase();
    if (!SCENES.includes(scene)) throw httpError(400, `scene must be one of ${SCENES.join(', ')}`);
    res.json(toResidence(await control(req.params.id, 'scene = $2', [scene])));
  }),
);

router.patch(
  '/:id/security',
  ah(async (req, res) => {
    const allowed = { front: ['Secured', 'Unlocked'], garage: ['Secured', 'Open'], privacy: ['On', 'Off'] };
    const changes = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (!allowed[k]) continue;
      if (!allowed[k].includes(v)) throw httpError(400, `${k} must be ${allowed[k].join(' or ')}`);
      changes[k] = v;
    }
    const row = await control(req.params.id, 'security = security || $2::jsonb', [JSON.stringify(changes)]);
    if (changes.front) await mirrorToGuest(row, { locked: changes.front === 'Secured' });
    res.json(toResidence(row));
  }),
);

// ---- Housekeeping room board ----

const toRoom = (r) => ({
  id: r.id,
  residence: r.unit_number,
  status: r.guest_user_id ? 'Occupied' : r.housekeeping_status || 'Ready',
  note: r.housekeeping_note || (r.arriving_id ? `Arrival today · ${r.guest_name}` : '—'),
});

housekeeping.get(
  '/rooms',
  ah(async (req, res) => {
    const { rows } = await db.query(`${SELECT} ORDER BY c.sort_order, a.unit_number`);
    res.json(rows.map(toRoom));
  }),
);

/** PATCH { status, note? } — Dirty | Cleaning | Inspect | Ready */
housekeeping.patch(
  '/rooms/:id',
  ah(async (req, res) => {
    const { status, note } = req.body || {};
    if (!['Dirty', 'Cleaning', 'Inspect', 'Ready'].includes(status)) throw httpError(400, 'status must be Dirty, Cleaning, Inspect or Ready');
    const row = await control(req.params.id, "housekeeping_status = $2::text, housekeeping_note = CASE WHEN $3::text IS NOT NULL THEN $3::text WHEN $2::text = 'Ready' THEN NULL ELSE housekeeping_note END", [status, note ?? null]);
    const room = toRoom(row);
    emit(req, 'housekeeping:updated', room);
    res.json(room);
  }),
);

module.exports = { router, housekeeping };

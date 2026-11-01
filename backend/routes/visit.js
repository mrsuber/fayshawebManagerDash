/**
 * Public visitor pass (the link a resident shares with their visitor): GET /api/visit/:token and its QR code
 * GET /api/visit/:token/qr.png. The gate scans the QR (it carries the link) or types the 6-digit code.
 * Directions shown to the visitor come from FAY OS → Visitors (app_settings 'visitors').
 */
const express = require('express');
const QRCode = require('qrcode');
const db = require('../config/database');

const router = express.Router();
const appUrl = () => (process.env.APP_URL || 'https://fayshaa.com').replace(/\/$/, '');

async function load(token) {
  const { rows } = await db.query(
    `SELECT p.*, a.unit_number, a.floor, a.building, u.full_name AS host
       FROM visitor_passes p LEFT JOIN apartments a ON a.id = p.apartment_id JOIN users u ON u.id = p.user_id
      WHERE p.token = $1`,
    [String(token || '')],
  );
  return rows[0];
}

router.get('/:token', async (req, res) => {
  try {
    const p = await load(req.params.token);
    if (!p) return res.status(404).json({ message: 'This visitor pass is not valid' });
    const settings = (await db.query(`SELECT value FROM app_settings WHERE key = 'visitors'`)).rows[0]?.value || {};
    const day = p.visit_date.toISOString().slice(0, 10);
    const expired = !['arrived', 'left', 'cancelled', 'declined'].includes(p.status) && day < new Date().toISOString().slice(0, 10);
    res.json({
      visitorName: p.visitor_name,
      host: String(p.host || '').split(' ')[0],
      residence: p.unit_number,
      floor: p.floor,
      building: p.building,
      date: day,
      from: p.arrive_from,
      until: p.arrive_until,
      people: p.people,
      code: ['approved', 'arrived'].includes(p.status) ? p.code : null,
      status: expired ? 'expired' : p.status,
      directions: settings.directions || 'Show this pass at the main gate. Security will guide you to the residence.',
      mapsUrl: settings.mapsUrl || null,
      gatePhone: settings.gatePhone || null,
    });
  } catch (e) {
    res.status(500).json({ message: 'Could not load the pass' });
  }
});

router.get('/:token/qr.png', async (req, res) => {
  const p = await load(req.params.token).catch(() => null);
  if (!p || !['approved', 'arrived'].includes(p.status)) return res.status(404).end();
  const png = await QRCode.toBuffer(`${appUrl()}/visit/${p.token}`, { width: 520, margin: 2 });
  res.set('Content-Type', 'image/png').set('Cache-Control', 'no-store').set('Cross-Origin-Resource-Policy', 'cross-origin').send(png);
});

module.exports = router;

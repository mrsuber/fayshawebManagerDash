/**
 * Public content for the website and the guest app (no sign-in): managed in FAY OS → Content.
 *
 *   GET /api/content/places              published estate places (Explore; those with a panorama form the 360° tour)
 *   GET /api/content/legal/:slug         the published terms or privacy policy: { slug, title, version, effectiveDate, body }
 *   GET /api/content/stories?category=   published stories (journal);  GET /api/content/stories/:slug  one story
 *   GET /api/content/stay-policy         standard check-in / check-out times and the currencies offered
 */
const express = require('express');
const db = require('../config/database');

const router = express.Router();

const toPlace = (r) => ({
  id: r.id,
  name: r.name,
  subtitle: r.subtitle || '',
  description: r.description || '',
  features: Array.isArray(r.features) ? r.features : [],
  glyph: r.glyph || '◎',
  zone: r.zone,
  cover: r.cover_url || null,
  panorama: r.panorama_url || null,
  yaw: r.panorama_yaw || 0,
});

router.get('/places', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM estate_places WHERE is_published ORDER BY sort_order, id');
    res.set('Cache-Control', 'public, max-age=60').json(rows.map(toPlace));
  } catch (e) {
    console.error('Places failed:', e.message);
    res.status(500).json({ message: 'Could not load the estate' });
  }
});

router.get('/legal/:slug', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT v.slug, v.title, v.version, v.body, to_char(v.effective_date, 'YYYY-MM-DD') AS effective_date
         FROM legal_documents d JOIN legal_document_versions v ON v.slug = d.slug AND v.version = d.version
        WHERE d.slug = $1`,
      [req.params.slug],
    );
    if (!rows[0]) return res.status(404).json({ message: 'Document not found' });
    const r = rows[0];
    res.set('Cache-Control', 'public, max-age=60').json({ slug: r.slug, title: r.title, version: r.version, effectiveDate: r.effective_date, body: r.body });
  } catch (e) {
    console.error('Legal document failed:', e.message);
    res.status(500).json({ message: 'Could not load the document' });
  }
});

router.get('/stay-policy', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT key, value FROM app_settings WHERE key IN ('property', 'currencies')`);
    const property = rows.find((r) => r.key === 'property')?.value || {};
    const currencies = rows.find((r) => r.key === 'currencies')?.value || null;
    res.set('Cache-Control', 'public, max-age=60').json({
      checkIn: property.standardCheckIn || '14:00',
      checkOut: property.standardCheckOut || '11:00',
      lateCheckoutGraceMinutes: Number(property.lateCheckoutGraceMinutes ?? 30),
      currency: property.currency || 'XAF',
      currencies,
    });
  } catch (e) {
    res.status(500).json({ message: 'Could not load the stay policy' });
  }
});

// ---------- Stories ----------
const toStory = (r, full = false) => ({
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt || '',
  category: r.category,
  cover: r.cover_url || null,
  eventDate: r.event_date ? r.event_date.toISOString().slice(0, 10) : null,
  guests: r.guests || null,
  featured: r.featured,
  publishedAt: r.published_at,
  ...(full ? { body: r.body, gallery: Array.isArray(r.gallery) ? r.gallery : [] } : {}),
});

router.get('/stories', async (req, res) => {
  try {
    const params = [];
    let where = `status = 'published' AND published_at <= NOW()`;
    if (req.query.category) {
      params.push(String(req.query.category));
      where += ` AND category = $${params.length}`;
    }
    const { rows } = await db.query(`SELECT * FROM stories WHERE ${where} ORDER BY featured DESC, published_at DESC LIMIT 60`, params);
    res.set('Cache-Control', 'public, max-age=60').json(rows.map((r) => toStory(r)));
  } catch (e) {
    console.error('Stories failed:', e.message);
    res.status(500).json({ message: 'Could not load stories' });
  }
});

router.get('/stories/:slug', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM stories WHERE slug = $1 AND status = 'published' AND published_at <= NOW()`, [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ message: 'Story not found' });
    const more = await db.query(
      `SELECT * FROM stories WHERE status = 'published' AND published_at <= NOW() AND id <> $1 ORDER BY (category = $2) DESC, published_at DESC LIMIT 3`,
      [rows[0].id, rows[0].category],
    );
    res.set('Cache-Control', 'public, max-age=60').json({ ...toStory(rows[0], true), more: more.rows.map((r) => toStory(r)) });
  } catch (e) {
    res.status(500).json({ message: 'Could not load the story' });
  }
});

module.exports = router;
module.exports.toPlace = toPlace;
module.exports.toStory = toStory;

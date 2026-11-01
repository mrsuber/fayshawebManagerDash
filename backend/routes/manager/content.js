/**
 * FAY OS → Content: what the website and the app show, edited without a new release.
 *
 *   POST   /content/images                      multipart "file" → { url }   (covers, 360° panoramas, story images)
 *   GET    /content/places                      every estate place (published or not)
 *   POST   /content/places                      { name, subtitle, description, features[], glyph, zone, cover, panorama, yaw, published }
 *   PATCH  /content/places/:id                  any of the above
 *   DELETE /content/places/:id
 *   PUT    /content/places/order                { ids: [..] }  display order
 *   GET    /content/legal                       terms and privacy: draft, published version and history
 *   PUT    /content/legal/:slug                 { title?, draft }  save the draft
 *   POST   /content/legal/:slug/publish         { summary, effectiveDate? }  publish the draft as the next version
 */
const express = require('express');
const { db, ah, httpError, isoTime } = require('./lib');
const { imageHandler } = require('../../services/attachments');
const { toPlace, toStory } = require('../content');

const router = express.Router();

router.post('/images', imageHandler('content'));

// ---------- Estate places ----------
const ZONES = ['residences', 'wellness', 'dining', 'outdoors', 'sport', 'amenities'];
const asUpload = (v) => (v === undefined ? undefined : v ? String(v) : null);

function placeFields(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) {
    if (!String(body.name || '').trim()) throw httpError(400, 'Give the place a name');
    out.name = String(body.name).trim().slice(0, 120);
  }
  if (body.subtitle !== undefined) out.subtitle = String(body.subtitle || '').slice(0, 160);
  if (body.description !== undefined) out.description = String(body.description || '');
  if (body.features !== undefined) {
    const list = Array.isArray(body.features) ? body.features : String(body.features || '').split(/\n|,/);
    out.features = JSON.stringify(list.map((f) => String(f).trim()).filter(Boolean).slice(0, 20));
  }
  if (body.glyph !== undefined) out.glyph = String(body.glyph || '').slice(0, 8) || null;
  if (body.zone !== undefined) {
    if (!ZONES.includes(body.zone)) throw httpError(400, `Zone must be one of ${ZONES.join(', ')}`);
    out.zone = body.zone;
  }
  if (body.cover !== undefined) out.cover_url = asUpload(body.cover);
  if (body.panorama !== undefined) out.panorama_url = asUpload(body.panorama);
  if (body.yaw !== undefined) out.panorama_yaw = Math.round(Number(body.yaw) || 0) % 360;
  if (body.published !== undefined) out.is_published = Boolean(body.published);
  return out;
}

const placeOut = (r) => ({ ...toPlace(r), published: r.is_published, sortOrder: r.sort_order, updatedAt: isoTime(r.updated_at) });

router.get(
  '/places',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM estate_places ORDER BY sort_order, id');
    res.json(rows.map(placeOut));
  }),
);

router.post(
  '/places',
  ah(async (req, res) => {
    const f = placeFields(req.body || {}, false);
    const cols = Object.keys(f);
    const { rows } = await db.query(
      `INSERT INTO estate_places (${cols.join(', ')}, sort_order, updated_by)
       VALUES (${cols.map((c, i) => (c === 'features' ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ')},
               (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM estate_places), $${cols.length + 1})
       RETURNING *`,
      [...cols.map((c) => f[c]), req.user.id],
    );
    res.status(201).json(placeOut(rows[0]));
  }),
);

router.put(
  '/places/order',
  ah(async (req, res) => {
    const ids = (req.body?.ids || []).map(Number).filter(Boolean);
    await db.query(
      `UPDATE estate_places p SET sort_order = o.pos * 10 FROM unnest($1::int[]) WITH ORDINALITY AS o(id, pos) WHERE p.id = o.id`,
      [ids],
    );
    const { rows } = await db.query('SELECT * FROM estate_places ORDER BY sort_order, id');
    res.json(rows.map(placeOut));
  }),
);

router.patch(
  '/places/:id',
  ah(async (req, res) => {
    const f = placeFields(req.body || {}, true);
    const cols = Object.keys(f);
    if (!cols.length) throw httpError(400, 'Nothing to change');
    const { rows } = await db.query(
      `UPDATE estate_places SET ${cols.map((c, i) => `${c} = $${i + 2}${c === 'features' ? '::jsonb' : ''}`).join(', ')},
              updated_by = $${cols.length + 2}, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [req.params.id, ...cols.map((c) => f[c]), req.user.id],
    );
    if (!rows[0]) throw httpError(404, 'Place not found');
    res.json(placeOut(rows[0]));
  }),
);

router.delete(
  '/places/:id',
  ah(async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM estate_places WHERE id = $1', [req.params.id]);
    if (!rowCount) throw httpError(404, 'Place not found');
    res.json({ ok: true });
  }),
);

// ---------- Legal documents ----------
async function legalDoc(slug) {
  const d = (
    await db.query(
      `SELECT d.*, u.full_name AS updated_by_name FROM legal_documents d LEFT JOIN users u ON u.id = d.updated_by WHERE d.slug = $1`,
      [slug],
    )
  ).rows[0];
  if (!d) throw httpError(404, 'Document not found');
  const versions = (
    await db.query(
      `SELECT v.version, v.title, v.summary, to_char(v.effective_date, 'YYYY-MM-DD') AS effective_date, v.published_at, u.full_name AS published_by,
              length(v.body) AS length
         FROM legal_document_versions v LEFT JOIN users u ON u.id = v.published_by
        WHERE v.slug = $1 ORDER BY v.version DESC`,
      [slug],
    )
  ).rows;
  const published = versions[0]
    ? (await db.query('SELECT body FROM legal_document_versions WHERE slug = $1 AND version = $2', [slug, d.version])).rows[0]?.body
    : '';
  const accepted = (await db.query(`SELECT terms_version AS v, COUNT(*)::int AS n FROM bookings WHERE terms_version IS NOT NULL GROUP BY terms_version`)).rows;
  return {
    slug: d.slug,
    title: d.title,
    draft: d.draft,
    version: d.version,
    hasChanges: d.draft !== published,
    updatedAt: isoTime(d.updated_at),
    updatedBy: d.updated_by_name,
    versions: versions.map((v) => ({
      version: v.version,
      title: v.title,
      summary: v.summary,
      effectiveDate: v.effective_date,
      publishedAt: isoTime(v.published_at),
      publishedBy: v.published_by || 'Faysha',
      acceptedBy: slug === 'terms' ? accepted.find((a) => a.v === v.version)?.n || 0 : undefined,
    })),
  };
}

router.get(
  '/legal',
  ah(async (req, res) => {
    const { rows } = await db.query('SELECT slug FROM legal_documents ORDER BY slug DESC');
    res.json(await Promise.all(rows.map((r) => legalDoc(r.slug))));
  }),
);

router.get('/legal/:slug/versions/:version', ah(async (req, res) => {
  const v = (await db.query('SELECT title, body, version FROM legal_document_versions WHERE slug = $1 AND version = $2', [req.params.slug, req.params.version])).rows[0];
  if (!v) throw httpError(404, 'Version not found');
  res.json(v);
}));

router.put(
  '/legal/:slug',
  ah(async (req, res) => {
    const { title, draft } = req.body || {};
    if (draft !== undefined && typeof draft !== 'string') throw httpError(400, 'The text must be Markdown text');
    const { rowCount } = await db.query(
      `UPDATE legal_documents SET title = COALESCE($2, title), draft = COALESCE($3, draft), updated_by = $4, updated_at = NOW() WHERE slug = $1`,
      [req.params.slug, title ? String(title).slice(0, 160) : null, draft ?? null, req.user.id],
    );
    if (!rowCount) throw httpError(404, 'Document not found');
    res.json(await legalDoc(req.params.slug));
  }),
);

router.post(
  '/legal/:slug/publish',
  ah(async (req, res) => {
    const summary = String(req.body?.summary || '').trim();
    if (!summary) throw httpError(400, 'Say briefly what changed (kept with the version)');
    const doc = await legalDoc(req.params.slug);
    if (!doc.draft.trim()) throw httpError(400, 'The document is empty');
    if (!doc.hasChanges) throw httpError(409, 'The draft is the same as the published version');
    const effective = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.effectiveDate || '') ? req.body.effectiveDate : null;
    await db.query(
      `WITH next AS (UPDATE legal_documents SET version = version + 1, updated_at = NOW() WHERE slug = $1 RETURNING version, title, draft)
       INSERT INTO legal_document_versions (slug, version, title, body, summary, effective_date, published_by)
       SELECT $1, version, title, draft, $2, COALESCE($3::date, CURRENT_DATE), $4 FROM next`,
      [req.params.slug, summary.slice(0, 500), effective, req.user.id],
    );
    res.json(await legalDoc(req.params.slug));
  }),
);

// ---------- Stories ----------
const CATEGORIES = ['wedding', 'corporate', 'celebration', 'retreat', 'wellness', 'news'];
const slugify = (t) =>
  String(t || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'story';

const storyOut = (r) => ({ id: r.id, ...toStory(r, true), status: r.status, author: r.author_name || null, updatedAt: isoTime(r.updated_at) });

function storyFields(b, partial) {
  const f = {};
  if (!partial || b.title !== undefined) {
    if (!String(b.title || '').trim()) throw httpError(400, 'Give the story a title');
    f.title = String(b.title).trim().slice(0, 200);
  }
  if (b.excerpt !== undefined) f.excerpt = String(b.excerpt || '').slice(0, 400);
  if (b.body !== undefined) f.body = String(b.body || '');
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) throw httpError(400, `Category must be one of ${CATEGORIES.join(', ')}`);
    f.category = b.category;
  }
  if (b.cover !== undefined) f.cover_url = b.cover || null;
  if (b.gallery !== undefined) f.gallery = JSON.stringify((Array.isArray(b.gallery) ? b.gallery : []).filter((u) => /^\/uploads\//.test(u)).slice(0, 40));
  if (b.eventDate !== undefined) f.event_date = /^\d{4}-\d{2}-\d{2}$/.test(b.eventDate || '') ? b.eventDate : null;
  if (b.guests !== undefined) f.guests = Number(b.guests) > 0 ? Math.round(Number(b.guests)) : null;
  if (b.featured !== undefined) f.featured = Boolean(b.featured);
  return f;
}

const STORY_SELECT = 'SELECT s.*, u.full_name AS author_name FROM stories s LEFT JOIN users u ON u.id = s.author_id';

router.get(
  '/stories',
  ah(async (req, res) => {
    const { rows } = await db.query(`${STORY_SELECT} ORDER BY s.status = 'draft' DESC, COALESCE(s.published_at, s.updated_at) DESC`);
    res.json(rows.map(storyOut));
  }),
);

router.post(
  '/stories',
  ah(async (req, res) => {
    const f = storyFields(req.body || {}, false);
    const base = slugify(req.body.slug || f.title);
    const taken = (await db.query(`SELECT slug FROM stories WHERE slug = $1 OR slug LIKE $1 || '-%'`, [base])).rows.map((r) => r.slug);
    let slug = base;
    for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
    const cols = Object.keys(f);
    const { rows } = await db.query(
      `INSERT INTO stories (${cols.join(', ')}, slug, author_id) VALUES (${cols.map((c, i) => `$${i + 1}${c === 'gallery' ? '::jsonb' : ''}`).join(', ')}, $${cols.length + 1}, $${cols.length + 2}) RETURNING id`,
      [...cols.map((c) => f[c]), slug, req.user.id],
    );
    res.status(201).json(storyOut((await db.query(`${STORY_SELECT} WHERE s.id = $1`, [rows[0].id])).rows[0]));
  }),
);

router.patch(
  '/stories/:id',
  ah(async (req, res) => {
    const f = storyFields(req.body || {}, true);
    if (req.body?.status !== undefined) {
      if (!['draft', 'published'].includes(req.body.status)) throw httpError(400, 'Status is draft or published');
      f.status = req.body.status;
    }
    const cols = Object.keys(f);
    if (!cols.length) throw httpError(400, 'Nothing to change');
    const current = (await db.query('SELECT status, cover_url FROM stories WHERE id = $1', [req.params.id])).rows[0];
    if (!current) throw httpError(404, 'Story not found');
    const cover = f.cover_url !== undefined ? f.cover_url : current.cover_url;
    if ((f.status || current.status) === 'published' && !cover) throw httpError(400, 'Add a cover photo before publishing (the journal shows one for every story)');
    const { rowCount } = await db.query(
      `UPDATE stories SET ${cols.map((c, i) => `${c} = $${i + 2}${c === 'gallery' ? '::jsonb' : ''}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
      [req.params.id, ...cols.map((c) => f[c])],
    );
    if (!rowCount) throw httpError(404, 'Story not found');
    // First publication date (kept when a story is unpublished and published again). A separate statement: inside the
    // UPDATE above, "status" would still be the old value.
    await db.query(`UPDATE stories SET published_at = NOW() WHERE id = $1 AND status = 'published' AND published_at IS NULL`, [req.params.id]);
    res.json(storyOut((await db.query(`${STORY_SELECT} WHERE s.id = $1`, [req.params.id])).rows[0]));
  }),
);

router.delete(
  '/stories/:id',
  ah(async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM stories WHERE id = $1', [req.params.id]);
    if (!rowCount) throw httpError(404, 'Story not found');
    res.json({ ok: true });
  }),
);

module.exports = router;

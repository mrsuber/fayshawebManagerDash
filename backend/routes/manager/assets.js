/**
 * FAY OS → Assets: what the property owns, how it is cared for, and the money set aside to replace it.
 *
 *   GET    /assets                         register with lifecycle figures (services/assets.js)
 *   POST   /assets ; PATCH /assets/:id     create / edit
 *   GET    /assets/:id                     one asset with its schedule, history and reserve ledger
 *   POST   /assets/:id/log                 { kind: repair|inspection|note|status, date, cost, notes, status? }
 *   POST   /assets/:id/replace             { date, cost, notes }  replaced: spends the reserve, restarts its life
 *   GET    /assets/tasks?days=60           schedule (overdue first) for assets and areas
 *   POST   /assets/tasks ; PATCH /assets/tasks/:id
 *   POST   /assets/tasks/:id/done          { date, cost, by, notes }  logs it and moves the next due date
 *   GET    /assets/budget                  replacement value, reserve, monthly contribution, 12-month forecast
 */
const express = require('express');
const { db, ah, httpError, isoTime } = require('./lib');
const { ASSET_SQL, toAsset, nextDueSql } = require('../../services/assets');

const router = express.Router();
const CATEGORIES = ['hvac', 'electrical', 'plumbing', 'kitchen', 'laundry', 'pool', 'gym', 'spa', 'furniture', 'electronics', 'vehicle', 'building', 'outdoor', 'security', 'other'];
const KINDS = ['service', 'inspection', 'deep_clean', 'repaint', 'calibration', 'replace', 'other'];
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const money = (v) => (v === '' || v === null || v === undefined ? null : Math.max(0, Number(v) || 0));

function assetFields(b, partial) {
  const f = {};
  const text = (k, col, max = 150) => {
    if (b[k] !== undefined) f[col] = String(b[k] || '').trim().slice(0, max) || null;
  };
  if (!partial || b.code !== undefined) {
    if (!String(b.code || '').trim()) throw httpError(400, 'Give the asset a code (e.g. AC-E401-01)');
    f.code = String(b.code).trim().toUpperCase().slice(0, 40);
  }
  if (!partial || b.name !== undefined) {
    if (!String(b.name || '').trim()) throw httpError(400, 'Give the asset a name');
    f.name = String(b.name).trim().slice(0, 160);
  }
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) throw httpError(400, `Category must be one of ${CATEGORIES.join(', ')}`);
    f.category = b.category;
  }
  if (b.criticality !== undefined) {
    if (!['critical', 'high', 'normal', 'low'].includes(b.criticality)) throw httpError(400, 'Criticality is critical, high, normal or low');
    f.criticality = b.criticality;
  }
  if (b.status !== undefined) {
    if (!['in_service', 'needs_attention', 'out_of_service', 'retired'].includes(b.status)) throw httpError(400, 'Unknown status');
    f.status = b.status;
  }
  if (b.apartmentId !== undefined) f.apartment_id = b.apartmentId ? Number(b.apartmentId) : null;
  for (const [k, col] of [['location', 'location'], ['brand', 'brand'], ['model', 'model'], ['serial', 'serial'], ['supplier', 'supplier'], ['supplierContact', 'supplier_contact']]) text(k, col);
  if (b.notes !== undefined) f.notes = String(b.notes || '').slice(0, 4000) || null;
  if (b.photo !== undefined) f.photo_url = b.photo || null;
  for (const [k, col] of [['purchaseDate', 'purchase_date'], ['warrantyUntil', 'warranty_until']]) if (b[k] !== undefined) f[col] = isDay(b[k]) ? b[k] : null;
  for (const [k, col] of [['purchaseCost', 'purchase_cost'], ['replacementCost', 'replacement_cost'], ['reserveOverride', 'reserve_override']]) if (b[k] !== undefined) f[col] = money(b[k]);
  if (b.currency !== undefined) f.currency = /^[A-Z]{3}$/.test(b.currency || '') ? b.currency : 'XAF';
  for (const [k, col, max] of [['expectedLifeMonths', 'expected_life_months', 1200], ['leadTimeDays', 'lead_time_days', 730], ['sparesMin', 'spares_min', 100], ['sparesOnHand', 'spares_on_hand', 1000]]) {
    if (b[k] === undefined) continue;
    const n = b[k] === '' || b[k] === null ? null : parseInt(b[k], 10);
    if (n !== null && (Number.isNaN(n) || n < 0 || n > max)) throw httpError(400, `${k} must be between 0 and ${max}`);
    f[col] = col === 'expected_life_months' ? (n || null) : n || 0;
  }
  return f;
}

const one = async (id) => {
  const row = (await db.query(`SELECT * FROM (${ASSET_SQL}) x WHERE id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Asset not found');
  return toAsset(row);
};

router.get(
  '/assets',
  ah(async (req, res) => {
    const { rows } = await db.query(`SELECT * FROM (${ASSET_SQL}) x ORDER BY status = 'retired', criticality = 'critical' DESC, criticality = 'high' DESC, order_by NULLS LAST, code`);
    res.json(rows.map(toAsset));
  }),
);

router.post(
  '/assets',
  ah(async (req, res) => {
    const f = assetFields(req.body || {}, false);
    const cols = Object.keys(f);
    const { rows } = await db.query(`INSERT INTO assets (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, cols.map((c) => f[c]));
    await db.query(`INSERT INTO asset_logs (asset_id, kind, notes, user_id, by_name) VALUES ($1, 'note', 'Added to the register', $2, $3)`, [rows[0].id, req.user.id, req.user.fullName]);
    res.status(201).json(await one(rows[0].id));
  }),
);

// Tasks and budget come before /assets/:id so their paths are not read as ids.
const toTask = (t) => ({
  id: t.id, assetId: t.asset_id, assetCode: t.code || null, assetName: t.asset_name || null, area: t.area, title: t.title, kind: t.kind,
  everyN: t.every_n, everyUnit: t.every_unit, lastDone: t.last_done ? isoTime(t.last_done).slice(0, 10) : null, nextDue: isoTime(t.next_due).slice(0, 10),
  team: t.team, vendor: t.vendor, estCost: t.est_cost === null ? null : Number(t.est_cost), instructions: t.instructions, active: t.active,
  overdue: t.overdue, dueInDays: t.due_in,
});
const TASK_SELECT = `SELECT t.*, a.code, a.name AS asset_name, t.next_due < (NOW() AT TIME ZONE '${process.env.PROPERTY_TZ || 'Africa/Douala'}')::date AS overdue,
                            (t.next_due - (NOW() AT TIME ZONE '${process.env.PROPERTY_TZ || 'Africa/Douala'}')::date) AS due_in
                       FROM asset_tasks t LEFT JOIN assets a ON a.id = t.asset_id`;

router.get(
  '/assets/tasks',
  ah(async (req, res) => {
    const days = Math.max(1, Math.min(730, parseInt(req.query.days, 10) || 60));
    const { rows } = await db.query(`${TASK_SELECT} WHERE t.active AND t.next_due <= CURRENT_DATE + $1::int ORDER BY t.next_due, t.id`, [days]);
    res.json(rows.map(toTask));
  }),
);

function taskFields(b, partial) {
  const f = {};
  if (!partial || b.title !== undefined) {
    if (!String(b.title || '').trim()) throw httpError(400, 'What needs doing?');
    f.title = String(b.title).trim().slice(0, 200);
  }
  if (b.assetId !== undefined) f.asset_id = b.assetId ? Number(b.assetId) : null;
  if (b.area !== undefined) f.area = String(b.area || '').slice(0, 150) || null;
  if (b.kind !== undefined) {
    if (!KINDS.includes(b.kind)) throw httpError(400, `Kind must be one of ${KINDS.join(', ')}`);
    f.kind = b.kind;
  }
  if (b.everyN !== undefined) {
    const n = parseInt(b.everyN, 10);
    if (!(n > 0 && n <= 120)) throw httpError(400, 'Repeat every 1 to 120');
    f.every_n = n;
  }
  if (b.everyUnit !== undefined) {
    if (!['day', 'week', 'month', 'year'].includes(b.everyUnit)) throw httpError(400, 'Unit is day, week, month or year');
    f.every_unit = b.everyUnit;
  }
  if (!partial || b.nextDue !== undefined) {
    if (!isDay(b.nextDue)) throw httpError(400, 'When is it next due?');
    f.next_due = b.nextDue;
  }
  for (const [k, col, max] of [['team', 'team', 80], ['vendor', 'vendor', 150], ['instructions', 'instructions', 4000]]) if (b[k] !== undefined) f[col] = String(b[k] || '').slice(0, max) || null;
  if (b.estCost !== undefined) f.est_cost = money(b.estCost);
  if (b.active !== undefined) f.active = Boolean(b.active);
  return f;
}

router.post(
  '/assets/tasks',
  ah(async (req, res) => {
    const f = taskFields(req.body || {}, false);
    if (!f.asset_id && !f.area) throw httpError(400, 'Choose an asset or name the area');
    const cols = Object.keys(f);
    const { rows } = await db.query(`INSERT INTO asset_tasks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, cols.map((c) => f[c]));
    res.status(201).json(toTask((await db.query(`${TASK_SELECT} WHERE t.id = $1`, [rows[0].id])).rows[0]));
  }),
);

router.patch(
  '/assets/tasks/:id',
  ah(async (req, res) => {
    const f = taskFields(req.body || {}, true);
    const cols = Object.keys(f);
    if (!cols.length) throw httpError(400, 'Nothing to change');
    const { rowCount } = await db.query(`UPDATE asset_tasks SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`, [req.params.id, ...cols.map((c) => f[c])]);
    if (!rowCount) throw httpError(404, 'Task not found');
    res.json(toTask((await db.query(`${TASK_SELECT} WHERE t.id = $1`, [req.params.id])).rows[0]));
  }),
);

router.post(
  '/assets/tasks/:id/done',
  ah(async (req, res) => {
    const t = (await db.query('SELECT * FROM asset_tasks WHERE id = $1', [req.params.id])).rows[0];
    if (!t) throw httpError(404, 'Task not found');
    const done = isDay(req.body?.date) ? req.body.date : new Date().toISOString().slice(0, 10);
    await db.query(
      `INSERT INTO asset_logs (asset_id, task_id, kind, done_on, cost, by_name, user_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [t.asset_id, t.id, t.kind === 'inspection' ? 'inspection' : 'service', done, money(req.body?.cost) || 0, req.body?.by || req.user.fullName, req.user.id, `${t.title}${req.body?.notes ? ` — ${String(req.body.notes).slice(0, 2000)}` : ''}`],
    );
    // The next one is counted from when it was actually done.
    await db.query(`UPDATE asset_tasks SET last_done = $1, next_due = ${nextDueSql} WHERE id = $4`, [done, t.every_n, t.every_unit, t.id]);
    if (t.asset_id) await db.query(`UPDATE assets SET status = CASE WHEN status = 'needs_attention' THEN 'in_service' ELSE status END, updated_at = NOW() WHERE id = $1`, [t.asset_id]);
    await require('../../services/notify').resolve(req.app, `asset-task:${t.id}`);
    res.json(toTask((await db.query(`${TASK_SELECT} WHERE t.id = $1`, [t.id])).rows[0]));
  }),
);

router.get(
  '/assets/budget',
  ah(async (req, res) => {
    const { rows } = await db.query(`SELECT * FROM (${ASSET_SQL}) x WHERE status <> 'retired'`);
    const assets = rows.map(toAsset);
    const sum = (f) => assets.reduce((s, a) => s + (Number(f(a)) || 0), 0);
    // Twelve months ahead: replacements falling due (by their replace-by date) and scheduled care costs.
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + i);
      return d.toISOString().slice(0, 7);
    });
    const tasks = (await db.query(`SELECT * FROM asset_tasks WHERE active AND est_cost > 0`)).rows;
    const careByMonth = Object.fromEntries(months.map((m) => [m, 0]));
    const end = new Date(`${months[11]}-28`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    for (const t of tasks) {
      // Walk each recurring task through the year.
      let d = new Date(t.next_due);
      for (let i = 0; i < 400 && d < end; i++) {
        const key = d.toISOString().slice(0, 7);
        if (key in careByMonth) careByMonth[key] += Number(t.est_cost);
        if (t.every_unit === 'day') d.setUTCDate(d.getUTCDate() + t.every_n);
        else if (t.every_unit === 'week') d.setUTCDate(d.getUTCDate() + 7 * t.every_n);
        else if (t.every_unit === 'year') d.setUTCFullYear(d.getUTCFullYear() + t.every_n);
        else d.setUTCMonth(d.getUTCMonth() + t.every_n);
      }
    }
    const forecast = months.map((m) => {
      const replacing = assets.filter((a) => (a.replaceBy || '').slice(0, 7) === m || (m === months[0] && a.replaceBy && a.replaceBy.slice(0, 7) < m));
      return { month: m, replacements: replacing.map((a) => ({ id: a.id, code: a.code, name: a.name, cost: a.replacementCost || 0 })), replacementCost: replacing.reduce((s, a) => s + (a.replacementCost || 0), 0), careCost: Math.round(careByMonth[m]) };
    });
    const spent = (await db.query(`SELECT COALESCE(SUM(cost), 0)::float AS total FROM asset_logs WHERE done_on > CURRENT_DATE - 365`)).rows[0].total;
    res.json({
      assets: assets.length,
      replacementValue: Math.round(sum((a) => a.replacementCost)),
      reserveBalance: Math.round(sum((a) => a.reserveBalance)),
      monthlyReserve: Math.round(sum((a) => a.monthlyReserve)),
      fundedPct: sum((a) => a.replacementCost) ? Math.round((sum((a) => a.reserveBalance) * 100) / sum((a) => a.replacementCost)) : null,
      orderSoon: assets.filter((a) => a.flags.includes('order_soon')).length,
      sparesLow: assets.filter((a) => a.flags.includes('spares_low')).length,
      maintenanceLast12: Math.round(spent),
      forecast,
      byCategory: Object.values(
        assets.reduce((m, a) => {
          m[a.category] = m[a.category] || { category: a.category, count: 0, value: 0, monthly: 0 };
          m[a.category].count += 1;
          m[a.category].value += a.replacementCost || 0;
          m[a.category].monthly += a.monthlyReserve;
          return m;
        }, {}),
      ).sort((x, y) => y.value - x.value),
    });
  }),
);

router.get(
  '/assets/:id',
  ah(async (req, res) => {
    const asset = await one(req.params.id);
    const [tasks, logs, reserve] = await Promise.all([
      db.query(`${TASK_SELECT} WHERE t.asset_id = $1 ORDER BY t.active DESC, t.next_due`, [req.params.id]),
      db.query(`SELECT * FROM asset_logs WHERE asset_id = $1 ORDER BY done_on DESC, id DESC LIMIT 100`, [req.params.id]),
      db.query(`SELECT * FROM asset_reserve WHERE asset_id = $1 ORDER BY month DESC, id DESC LIMIT 60`, [req.params.id]),
    ]);
    res.json({
      ...asset,
      tasks: tasks.rows.map(toTask),
      logs: logs.rows.map((l) => ({ id: l.id, kind: l.kind, date: isoTime(l.done_on).slice(0, 10), cost: Number(l.cost), by: l.by_name, notes: l.notes })),
      reserve: reserve.rows.map((r) => ({ id: r.id, month: isoTime(r.month).slice(0, 7), kind: r.kind, amount: Number(r.amount), note: r.note })),
    });
  }),
);

router.patch(
  '/assets/:id',
  ah(async (req, res) => {
    const f = assetFields(req.body || {}, true);
    const cols = Object.keys(f);
    if (!cols.length) throw httpError(400, 'Nothing to change');
    const before = (await db.query('SELECT status FROM assets WHERE id = $1', [req.params.id])).rows[0];
    if (!before) throw httpError(404, 'Asset not found');
    await db.query(`UPDATE assets SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`, [req.params.id, ...cols.map((c) => f[c])]);
    if (f.status && f.status !== before.status) {
      await db.query(`INSERT INTO asset_logs (asset_id, kind, notes, user_id, by_name) VALUES ($1, 'status', $2, $3, $4)`, [req.params.id, `${before.status.replace('_', ' ')} → ${f.status.replace('_', ' ')}`, req.user.id, req.user.fullName]);
    }
    res.json(await one(req.params.id));
  }),
);

router.post(
  '/assets/:id/log',
  ah(async (req, res) => {
    const kind = req.body?.kind;
    if (!['repair', 'inspection', 'note', 'service'].includes(kind)) throw httpError(400, 'kind is repair, inspection, service or note');
    await one(req.params.id);
    await db.query(
      `INSERT INTO asset_logs (asset_id, kind, done_on, cost, by_name, user_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, kind, isDay(req.body?.date) ? req.body.date : new Date().toISOString().slice(0, 10), money(req.body?.cost) || 0, req.body?.by || req.user.fullName, req.user.id, req.body?.notes ? String(req.body.notes).slice(0, 4000) : null],
    );
    if (req.body?.status) await db.query(`UPDATE assets SET status = $2, updated_at = NOW() WHERE id = $1`, [req.params.id, assetFields({ status: req.body.status }, true).status]);
    res.status(201).json(await one(req.params.id));
  }),
);

router.post(
  '/assets/:id/replace',
  ah(async (req, res) => {
    const a = await one(req.params.id);
    const date = isDay(req.body?.date) ? req.body.date : new Date().toISOString().slice(0, 10);
    const cost = money(req.body?.cost);
    if (!cost) throw httpError(400, 'What did the replacement cost?');
    const spend = Math.min(cost, a.reserveBalance);
    if (spend > 0) await db.query(`INSERT INTO asset_reserve (asset_id, month, kind, amount, note) VALUES ($1, date_trunc('month', $2::date)::date, 'spend', $3, 'Replacement')`, [a.id, date, spend]);
    await db.query(
      `UPDATE assets SET purchase_date = $2, purchase_cost = $3, replacement_cost = $3, status = 'in_service',
              warranty_until = $4, serial = COALESCE($5, serial), updated_at = NOW() WHERE id = $1`,
      [a.id, date, cost, isDay(req.body?.warrantyUntil) ? req.body.warrantyUntil : null, req.body?.serial || null],
    );
    await db.query(
      `INSERT INTO asset_logs (asset_id, kind, done_on, cost, by_name, user_id, notes) VALUES ($1, 'replacement', $2, $3, $4, $5, $6)`,
      [a.id, date, cost, req.user.fullName, req.user.id, `Replaced${spend ? ` · ${Math.round(spend).toLocaleString('en-US')} from the reserve` : ''}${cost > spend ? ` · ${Math.round(cost - spend).toLocaleString('en-US')} not covered by the reserve` : ''}${req.body?.notes ? ` — ${req.body.notes}` : ''}`],
    );
    await require('../../services/notify').resolve(req.app, `asset-order:${a.id}`);
    res.json(await one(a.id));
  }),
);

module.exports = router;

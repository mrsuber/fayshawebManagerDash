/**
 * FAY OS → Lockers & loans, and Visitors & gate.
 *
 * Loans
 *   GET    /loans?status=open|all          loans with their item; GET /loans/items  every item; POST /loans/items, PATCH /loans/items/:id
 *   POST   /loans                          { userId?, guestName?, category, itemId?, hours, reason } (desk loan)
 *   POST   /loans/:id/assign               { itemId? }  pick the item (or the first free one) → ready, guest sees the locker code
 *   POST   /loans/:id/out                  handed over
 *   POST   /loans/:id/return               { condition? }  back, item available again
 *   POST   /loans/:id/extend               { hours }
 *   POST   /loans/:id/decline | /lost
 * Visitors and the gate
 *   GET    /visitors?date=YYYY-MM-DD        passes for the day (default today) and what is pending
 *   POST   /visitors/:id/approve | /decline | /arrive | /leave
 *   POST   /visitors/verify                 { code | token } → the pass, for the gate
 *   POST   /gate/open                       { passId?, bookingId?, note }  logs and, when configured, tells the gate controller
 *   GET    /gate/events                     recent openings
 *   GET/PUT /visitors/settings              { autoApprove, directions, mapsUrl, gatePhone }
 */
const express = require('express');
const { db, ah, httpError, isoTime, emit } = require('./lib');
const { staffAlert, resolve } = require('../../services/notify');
const { notifyGuest } = require('../../services/guestPush');
const { toLoan, LOAN_SELECT, toPass, PASS_SELECT, CATEGORY } = require('../guest/operations');

const router = express.Router();
const TZ = process.env.PROPERTY_TZ || 'Africa/Douala';

// ---------------------------------------------------------------- Loan items
const toItem = (i) => ({
  id: i.id, code: i.code, name: i.name, category: i.category, location: i.location, status: i.status,
  defaultHours: i.default_hours, deposit: Number(i.deposit), fee: Number(i.fee), notes: i.notes,
  holder: i.holder || null, dueAt: i.due_at ? isoTime(i.due_at) : null,
});

router.get(
  '/loans/items',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT i.*, l.guest_name AS holder, l.due_at FROM loan_items i
         LEFT JOIN loans l ON l.item_id = i.id AND l.status IN ('ready', 'out')
        ORDER BY i.category, i.code`,
    );
    res.json(rows.map(toItem));
  }),
);

function itemFields(b, partial) {
  const f = {};
  if (!partial || b.code !== undefined) {
    if (!String(b.code || '').trim()) throw httpError(400, 'Give the item a code, e.g. L-12 or GOLF-03');
    f.code = String(b.code).trim().toUpperCase().slice(0, 40);
  }
  if (!partial || b.name !== undefined) {
    if (!String(b.name || '').trim()) throw httpError(400, 'Give the item a name');
    f.name = String(b.name).trim().slice(0, 150);
  }
  if (b.category !== undefined) {
    if (!CATEGORY[b.category]) throw httpError(400, `Category must be one of ${Object.keys(CATEGORY).join(', ')}`);
    f.category = b.category;
  }
  if (b.location !== undefined) f.location = String(b.location || '').slice(0, 150) || null;
  if (b.status !== undefined) {
    if (!['available', 'maintenance', 'retired'].includes(b.status)) throw httpError(400, 'Status is available, maintenance or retired');
    f.status = b.status;
  }
  if (b.defaultHours !== undefined) f.default_hours = Math.max(1, Math.min(24 * 30, parseInt(b.defaultHours, 10) || 24));
  if (b.deposit !== undefined) f.deposit = Math.max(0, Number(b.deposit) || 0);
  if (b.fee !== undefined) f.fee = Math.max(0, Number(b.fee) || 0);
  if (b.notes !== undefined) f.notes = String(b.notes || '').slice(0, 1000) || null;
  return f;
}

router.post(
  '/loans/items',
  ah(async (req, res) => {
    const f = itemFields(req.body || {}, false);
    const cols = Object.keys(f);
    const { rows } = await db.query(`INSERT INTO loan_items (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, cols.map((c) => f[c]));
    res.status(201).json(toItem(rows[0]));
  }),
);

router.patch(
  '/loans/items/:id',
  ah(async (req, res) => {
    const f = itemFields(req.body || {}, true);
    const cols = Object.keys(f);
    if (!cols.length) throw httpError(400, 'Nothing to change');
    if (f.status && f.status !== 'available') {
      const live = await db.query(`SELECT 1 FROM loans WHERE item_id = $1 AND status IN ('ready', 'out')`, [req.params.id]);
      if (live.rows.length) throw httpError(409, 'This item is with a guest — record its return first');
    }
    const { rows } = await db.query(`UPDATE loan_items SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...cols.map((c) => f[c])]);
    if (!rows[0]) throw httpError(404, 'Item not found');
    res.json(toItem(rows[0]));
  }),
);

// ---------------------------------------------------------------- Loans
const loanOut = async (id) => {
  const row = (await db.query(`${LOAN_SELECT} WHERE l.id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Loan not found');
  return { ...toLoan(row), pin: row.pin, guestId: row.user_id, guestName: row.guest_name, handledBy: row.handled_by, outAt: row.out_at ? isoTime(row.out_at) : null, returnedAt: row.returned_at ? isoTime(row.returned_at) : null, conditionNote: row.condition_note };
};
const changed = (req, id) => emit(req, 'loan:updated', { id: Number(id) });

router.get(
  '/loans',
  ah(async (req, res) => {
    const where = req.query.status === 'all' ? '' : `WHERE l.status IN ('requested', 'ready', 'out')`;
    const { rows } = await db.query(`${LOAN_SELECT} ${where} ORDER BY l.status = 'requested' DESC, l.due_at LIMIT 300`);
    res.json(rows.map((r) => ({ ...toLoan(r), pin: r.pin, guestId: r.user_id, guestName: r.guest_name })));
  }),
);

router.post(
  '/loans',
  ah(async (req, res) => {
    const { category, userId, guestName, itemId, reason } = req.body || {};
    if (!CATEGORY[category]) throw httpError(400, 'Choose a category');
    const guest = userId ? (await db.query('SELECT id, full_name FROM users WHERE id = $1', [userId])).rows[0] : null;
    if (!guest && !String(guestName || '').trim()) throw httpError(400, 'Who is borrowing it?');
    const stay = guest ? (await db.query(`SELECT id FROM bookings WHERE user_id = $1 AND status IN ('checked_in', 'confirmed') ORDER BY status = 'checked_in' DESC, check_in_date LIMIT 1`, [guest.id])).rows[0] : null;
    const hours = Math.max(1, Math.min(24 * 14, parseInt(req.body?.hours, 10) || CATEGORY[category].hours));
    const { rows } = await db.query(
      `INSERT INTO loans (user_id, guest_name, booking_id, category, reason, due_at, pin, handled_by)
       VALUES ($1, $2, $3, $4, $5, NOW() + make_interval(hours => $6::int), LPAD((floor(random() * 10000))::int::text, 4, '0'), $7) RETURNING id`,
      [guest?.id || null, guest?.full_name || String(guestName).trim(), stay?.id || null, category, reason || null, hours, req.user.id],
    );
    await db.query(`UPDATE loans SET reference = 'LN-' || LPAD(id::text, 5, '0') WHERE id = $1`, [rows[0].id]);
    if (itemId !== undefined) await assign(req, rows[0].id, itemId);
    changed(req, rows[0].id);
    res.status(201).json(await loanOut(rows[0].id));
  }),
);

/** Gives a requested loan its item (the one chosen, else the first free one of the category). */
async function assign(req, loanId, itemId) {
  const loan = (await db.query('SELECT * FROM loans WHERE id = $1', [loanId])).rows[0];
  if (!loan) throw httpError(404, 'Loan not found');
  if (loan.status !== 'requested') throw httpError(409, `This loan is ${loan.status}`);
  const item = itemId
    ? (await db.query(`SELECT * FROM loan_items WHERE id = $1`, [itemId])).rows[0]
    : (await db.query(`SELECT * FROM loan_items WHERE category = $1 AND status = 'available' ORDER BY code LIMIT 1`, [loan.category])).rows[0];
  if (!item) throw httpError(409, `No ${CATEGORY[loan.category].label.toLowerCase()} is free right now`);
  if (item.status !== 'available') throw httpError(409, `${item.code} is not available`);
  try {
    await db.query(`UPDATE loans SET item_id = $2, status = 'ready', handled_by = $3, updated_at = NOW() WHERE id = $1`, [loanId, item.id, req.user.id]);
  } catch (e) {
    if (e.code === '23505') throw httpError(409, `${item.code} has just been given to someone else`);
    throw e;
  }
  await db.query(`UPDATE loan_items SET status = 'on_loan', updated_at = NOW() WHERE id = $1`, [item.id]);
  await resolve(req.app, `loan-request:${loanId}`);
  if (loan.user_id) {
    notifyGuest(req.app, loan.user_id, {
      title: `${CATEGORY[loan.category].label} ready`,
      body: loan.category === 'locker' ? `Locker ${item.code}${item.location ? ` · ${item.location}` : ''}. Your code: ${loan.pin}.` : `${item.name} is ready for you${item.location ? ` at ${item.location}` : ''}.`,
      event: 'loan:ready',
      data: { screen: 'Loans', loanId },
    });
  }
}

router.post('/loans/:id/assign', ah(async (req, res) => {
  await assign(req, req.params.id, req.body?.itemId || null);
  changed(req, req.params.id);
  res.json(await loanOut(req.params.id));
}));

router.post('/loans/:id/out', ah(async (req, res) => {
  const { rowCount } = await db.query(`UPDATE loans SET status = 'out', out_at = NOW(), handled_by = $2, updated_at = NOW() WHERE id = $1 AND status = 'ready'`, [req.params.id, req.user.id]);
  if (!rowCount) throw httpError(409, 'Assign an item first');
  changed(req, req.params.id);
  res.json(await loanOut(req.params.id));
}));

router.post('/loans/:id/return', ah(async (req, res) => {
  const { rows } = await db.query(
    `UPDATE loans SET status = 'returned', returned_at = NOW(), condition_note = $2, handled_by = $3, updated_at = NOW() WHERE id = $1 AND status IN ('ready', 'out') RETURNING item_id`,
    [req.params.id, req.body?.condition ? String(req.body.condition).slice(0, 500) : null, req.user.id],
  );
  if (!rows.length) throw httpError(409, 'This loan is not out');
  // Damaged items go to maintenance instead of back on the shelf.
  await db.query(`UPDATE loan_items SET status = $2, updated_at = NOW() WHERE id = $1`, [rows[0].item_id, req.body?.damaged ? 'maintenance' : 'available']);
  await resolve(req.app, `loan-overdue:${req.params.id}`);
  changed(req, req.params.id);
  res.json(await loanOut(req.params.id));
}));

router.post('/loans/:id/extend', ah(async (req, res) => {
  const hours = Math.max(1, Math.min(24 * 7, parseInt(req.body?.hours, 10) || 24));
  const { rowCount } = await db.query(`UPDATE loans SET due_at = GREATEST(due_at, NOW()) + make_interval(hours => $2::int), updated_at = NOW() WHERE id = $1 AND status IN ('requested', 'ready', 'out')`, [req.params.id, hours]);
  if (!rowCount) throw httpError(409, 'This loan is closed');
  await resolve(req.app, `loan-overdue:${req.params.id}`);
  changed(req, req.params.id);
  res.json(await loanOut(req.params.id));
}));

for (const [action, status] of [['decline', 'declined'], ['lost', 'lost']]) {
  router.post(`/loans/:id/${action}`, ah(async (req, res) => {
    const { rows } = await db.query(
      `UPDATE loans SET status = $2, updated_at = NOW(), condition_note = COALESCE($3, condition_note) WHERE id = $1 AND status IN (${action === 'decline' ? "'requested'" : "'ready', 'out'"}) RETURNING item_id, user_id, category`,
      [req.params.id, status, req.body?.reason ? String(req.body.reason).slice(0, 500) : null],
    );
    if (!rows.length) throw httpError(409, `This loan cannot be marked ${status}`);
    if (rows[0].item_id && status === 'lost') await db.query(`UPDATE loan_items SET status = 'retired', notes = COALESCE(notes || E'\\n', '') || 'Lost ' || to_char(NOW(), 'YYYY-MM-DD') WHERE id = $1`, [rows[0].item_id]);
    await resolve(req.app, `loan-request:${req.params.id}`);
    await resolve(req.app, `loan-overdue:${req.params.id}`);
    if (status === 'declined' && rows[0].user_id) {
      notifyGuest(req.app, rows[0].user_id, { title: `${CATEGORY[rows[0].category].label} not available`, body: req.body?.reason || 'We are sorry — please ask the concierge for an alternative.', event: 'loan:declined', data: { screen: 'Loans' } });
    }
    changed(req, req.params.id);
    res.json(await loanOut(req.params.id));
  }));
}

// ---------------------------------------------------------------- Visitors
const passOut = async (id) => {
  const row = (await db.query(`${PASS_SELECT.replace('FROM visitor_passes p', ', u.full_name AS host, u.phone AS host_phone FROM visitor_passes p JOIN users u ON u.id = p.user_id')} WHERE p.id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Pass not found');
  return { ...toPass(row), host: row.host, hostId: row.user_id, hostPhone: row.host_phone };
};

router.get(
  '/visitors',
  ah(async (req, res) => {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : (await db.query(`SELECT (NOW() AT TIME ZONE $1)::date::text AS d`, [TZ])).rows[0].d;
    const { rows } = await db.query(
      `SELECT p.id FROM visitor_passes p WHERE p.visit_date = $1 OR (p.status = 'pending' AND p.visit_date >= $1) OR p.status = 'arrived'
        ORDER BY p.status = 'pending' DESC, p.status = 'arrived' DESC, p.arrive_from NULLS LAST, p.id`,
      [day],
    );
    res.json({ date: day, items: await Promise.all(rows.map((r) => passOut(r.id))) });
  }),
);

router.post(
  '/visitors/verify',
  ah(async (req, res) => {
    const raw = String(req.body?.code || req.body?.token || '').trim();
    const token = raw.includes('/visit/') ? raw.split('/visit/').pop() : raw;
    const { rows } = await db.query(
      `SELECT id FROM visitor_passes WHERE (token = $1 OR (code = $1 AND visit_date = (NOW() AT TIME ZONE $2)::date)) ORDER BY id DESC LIMIT 1`,
      [token, TZ],
    );
    if (!rows[0]) throw httpError(404, 'No pass matches this code');
    const pass = await passOut(rows[0].id);
    const today = (await db.query(`SELECT (NOW() AT TIME ZONE $1)::date::text AS d`, [TZ])).rows[0].d;
    res.json({ ...pass, valid: pass.status === 'approved' && pass.date === today, reason: pass.status !== 'approved' ? `This pass is ${pass.status}` : pass.date !== today ? `This pass is for ${pass.date}` : null });
  }),
);

const PASS_MOVES = {
  approve: [['pending'], 'approved', 'decided'],
  decline: [['pending', 'approved'], 'declined', 'decided'],
  arrive: [['approved'], 'arrived', 'arrived'],
  leave: [['arrived'], 'left', 'left'],
};
for (const [action, [from, to, stamp]] of Object.entries(PASS_MOVES)) {
  router.post(`/visitors/:id/${action}`, ah(async (req, res) => {
    const set = stamp === 'decided' ? 'decided_at = NOW(), decided_by = $4' : `${stamp}_at = NOW()`;
    const params = [req.params.id, to, from];
    if (stamp === 'decided') params.push(req.user.id);
    const { rows } = await db.query(
      `UPDATE visitor_passes SET status = $2, ${set} WHERE id = $1 AND status = ANY($3::text[]) RETURNING id, user_id, visitor_name`,
      params,
    );
    if (!rows[0]) throw httpError(409, `This pass cannot be marked ${to}`);
    await resolve(req.app, `visitor-approve:${req.params.id}`);
    const p = rows[0];
    const host = { approve: 'approved — your visitor can come in with the pass', decline: 'declined by the residence team', arrive: 'has arrived at the gate', leave: 'has left' }[action];
    notifyGuest(req.app, p.user_id, { title: `${p.visitor_name} ${action === 'arrive' ? 'is here' : action === 'leave' ? 'has left' : `· pass ${to}`}`, body: `${p.visitor_name} ${host}.`, event: 'visitor:updated', data: { screen: 'Visitors' } });
    emit(req, 'visitor:updated', { id: p.id });
    res.json(await passOut(p.id));
  }));
}

/**
 * Opens the gate: always recorded; when GATE_WEBHOOK_URL is set, the gate controller is told (POST JSON, with
 * GATE_WEBHOOK_SECRET in x-gate-secret) and its answer is recorded. Without a controller, the guard opens it.
 */
router.post(
  '/gate/open',
  ah(async (req, res) => {
    const passId = req.body?.passId ? Number(req.body.passId) : null;
    if (passId) {
      const p = (await db.query(`SELECT status FROM visitor_passes WHERE id = $1`, [passId])).rows[0];
      if (!p) throw httpError(404, 'Pass not found');
      if (!['approved', 'arrived'].includes(p.status)) throw httpError(409, `This pass is ${p.status}`);
    }
    let controllerOk = null;
    let message = 'Recorded. No gate controller is connected: the guard opens the gate.';
    if (process.env.GATE_WEBHOOK_URL) {
      try {
        const r = await fetch(process.env.GATE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-gate-secret': process.env.GATE_WEBHOOK_SECRET || '' },
          body: JSON.stringify({ action: 'open', gate: req.body?.gate || 'main', passId, by: req.user.fullName }),
          signal: AbortSignal.timeout(6000),
        });
        controllerOk = r.ok;
        message = r.ok ? 'The gate is opening.' : `The gate controller refused (${r.status}). Open it manually.`;
      } catch (e) {
        controllerOk = false;
        message = `The gate controller did not answer (${e.message}). Open it manually.`;
      }
    }
    await db.query(
      `INSERT INTO gate_events (gate, action, pass_id, booking_id, by_user, note, controller_ok) VALUES ($1, 'open', $2, $3, $4, $5, $6)`,
      [String(req.body?.gate || 'main').slice(0, 40), passId, req.body?.bookingId || null, req.user.id, req.body?.note ? String(req.body.note).slice(0, 255) : null, controllerOk],
    );
    if (passId) {
      const arrived = await db.query(`UPDATE visitor_passes SET status = 'arrived', arrived_at = NOW() WHERE id = $1 AND status = 'approved' RETURNING user_id, visitor_name`, [passId]);
      if (arrived.rows[0]) notifyGuest(req.app, arrived.rows[0].user_id, { title: `${arrived.rows[0].visitor_name} is here`, body: `${arrived.rows[0].visitor_name} has arrived at the gate.`, event: 'visitor:updated', data: { screen: 'Visitors' } });
      emit(req, 'visitor:updated', { id: passId });
    }
    res.json({ ok: true, controllerOk, message });
  }),
);

router.get(
  '/gate/events',
  ah(async (req, res) => {
    const { rows } = await db.query(
      `SELECT g.*, u.full_name AS by_name, p.visitor_name FROM gate_events g LEFT JOIN users u ON u.id = g.by_user LEFT JOIN visitor_passes p ON p.id = g.pass_id
        ORDER BY g.created_at DESC LIMIT 50`,
    );
    res.json(rows.map((g) => ({ id: g.id, gate: g.gate, action: g.action, visitor: g.visitor_name, by: g.by_name, note: g.note, controllerOk: g.controller_ok, at: isoTime(g.created_at) })));
  }),
);

router.get('/visitors/settings', ah(async (req, res) => res.json((await db.query(`SELECT value FROM app_settings WHERE key = 'visitors'`)).rows[0]?.value || { autoApprove: false })));
router.put(
  '/visitors/settings',
  ah(async (req, res) => {
    const b = req.body || {};
    const value = { autoApprove: Boolean(b.autoApprove), directions: String(b.directions || '').slice(0, 2000), mapsUrl: /^https?:\/\//.test(b.mapsUrl || '') ? b.mapsUrl : '', gatePhone: String(b.gatePhone || '').slice(0, 40) };
    await db.query(`INSERT INTO app_settings (key, value, updated_by) VALUES ('visitors', $1, $2) ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2`, [JSON.stringify(value), req.user.id]);
    res.json(value);
  }),
);

module.exports = router;

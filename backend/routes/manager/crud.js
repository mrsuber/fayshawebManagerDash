/**
 * Generic REST collection for the dashboard's operational lists:
 *   GET    /           → Item[]   (?field=value filters on exact match)
 *   POST   /           → Item
 *   PATCH  /:id        → Item
 *   DELETE /:id        → { ok: true }
 *
 * A spec maps the dashboard's camelCase fields to table columns:
 *   {
 *     table: 'work_orders',
 *     fields: { number: 'number', title: 'title', ... },   // camel → column
 *     types: { total: 'number', date: 'date', raisedAt: 'timestamp' },
 *     required: ['title'],
 *     order: 'created_at DESC',
 *     scope: "task_date >= CURRENT_DATE", // default WHERE when no filters are given
 *     guest: true,                     // has guest_id/guest_name: fill guestName from guestId
 *     prepare(req, data, ctx),         // validate / derive values before INSERT or UPDATE (ctx: { op, id, q })
 *     after(req, item, ctx),           // side effects (timeline, notifications)
 *   }
 */

const express = require('express');
const { db, ah, httpError, isoDate, isoTime, findGuest, tx } = require('./lib');

function toItem(spec, row) {
  const item = { id: row.id };
  for (const [field, col] of Object.entries(spec.fields)) {
    let v = row[col];
    const type = spec.types?.[field];
    if (v !== null && v !== undefined) {
      if (type === 'number') v = Number(v);
      else if (type === 'date') v = isoDate(v);
      else if (type === 'timestamp') v = isoTime(v);
    }
    item[field] = v;
  }
  if (row.created_at !== undefined && !('createdAt' in item)) item.createdAt = isoTime(row.created_at);
  return item;
}

/** Picks known fields from a request body (unknown keys are ignored). */
function pick(spec, body) {
  const data = {};
  for (const field of Object.keys(spec.fields)) {
    if (body[field] !== undefined) data[field] = body[field] === '' && spec.types?.[field] ? null : body[field];
  }
  return data;
}

function crud(spec) {
  const router = express.Router();
  const order = spec.order || 'id DESC';

  const fetchOne = async (q, id) => {
    const { rows } = await q.query(`SELECT * FROM ${spec.table} WHERE id = $1`, [id]);
    if (!rows.length) throw httpError(404, 'Not found');
    return rows[0];
  };

  const fillGuest = async (q, data) => {
    if (!spec.guest || data.guestId === undefined) return;
    if (data.guestId === '' || data.guestId === null) {
      data.guestId = null;
      return;
    }
    const guest = await findGuest(q, data.guestId);
    data.guestId = guest.id;
    if (!data.guestName) data.guestName = guest.name;
  };

  router.get(
    '/',
    ah(async (req, res) => {
      const where = [];
      const params = [];
      for (const [field, value] of Object.entries(req.query)) {
        const col = field === 'id' ? 'id' : spec.fields[field];
        if (!col || value === '') continue;
        params.push(value);
        where.push(`"${col}"::text = $${params.length}`);
      }
      if (spec.scope && !where.length) where.push(spec.scope);
      const { rows } = await db.query(`SELECT * FROM ${spec.table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order}`, params);
      res.json(rows.map((r) => toItem(spec, r)));
    }),
  );

  router.post(
    '/',
    ah(async (req, res) => {
      const item = await tx(async (q) => {
        const data = pick(spec, req.body || {});
        await fillGuest(q, data);
        if (spec.prepare) await spec.prepare(req, data, { op: 'create', q });
        for (const field of spec.required || []) {
          if (data[field] === undefined || data[field] === null || data[field] === '') throw httpError(400, `${field} is required`);
        }
        const fields = Object.keys(data).filter((f) => spec.fields[f]);
        const cols = fields.map((f) => `"${spec.fields[f]}"`);
        const sql = cols.length
          ? `INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`
          : `INSERT INTO ${spec.table} DEFAULT VALUES RETURNING *`;
        const { rows } = await q.query(sql, fields.map((f) => data[f]));
        const created = toItem(spec, rows[0]);
        if (spec.after) await spec.after(req, created, { op: 'create', q });
        return created;
      });
      res.status(201).json(item);
    }),
  );

  router.patch(
    '/:id',
    ah(async (req, res) => {
      const item = await tx(async (q) => {
        const before = toItem(spec, await fetchOne(q, req.params.id));
        const data = pick(spec, req.body || {});
        await fillGuest(q, data);
        if (spec.prepare) await spec.prepare(req, data, { op: 'update', id: req.params.id, before, q });
        const fields = Object.keys(data).filter((f) => spec.fields[f]);
        if (!fields.length) return before;
        const sets = fields.map((f, i) => `"${spec.fields[f]}" = $${i + 1}`);
        const { rows } = await q.query(`UPDATE ${spec.table} SET ${sets.join(', ')} WHERE id = $${fields.length + 1} RETURNING *`, [
          ...fields.map((f) => data[f]),
          req.params.id,
        ]);
        const updated = toItem(spec, rows[0]);
        if (spec.after) await spec.after(req, updated, { op: 'update', before, q });
        return updated;
      });
      res.json(item);
    }),
  );

  router.delete(
    '/:id',
    ah(async (req, res) => {
      const { rowCount } = await db.query(`DELETE FROM ${spec.table} WHERE id = $1`, [req.params.id]);
      if (!rowCount) throw httpError(404, 'Not found');
      res.json({ ok: true });
    }),
  );

  return router;
}

module.exports = { crud, toItem };

/**
 * Plain CRUD collections behind the operational screens (housekeeping, maintenance,
 * transport, dining menu, AI command, reservations extras, settings lists).
 * Paths match RESOURCES in the dashboard's src/manager/api/collections.js.
 */

const express = require('express');
const { notifyGuest } = require('../../services/guestPush');
const { crud } = require('./crud');
const { notify } = require('./lib');

const router = express.Router();

const f = (...names) => Object.fromEntries(names.map((n) => [n, n.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)]));

/** Fills `number` as PREFIX-<id> when the client didn't send one. */
const autoNumber = (table, prefix) => async (req, item, { op, q }) => {
  if (op !== 'create' || item.number) return;
  item.number = `${prefix}${item.id}`;
  await q.query(`UPDATE ${table} SET number = $1 WHERE id = $2`, [item.number, item.id]);
};

// ---- Guest journey ----
router.use('/journey/automations', crud({ table: 'journey_automations', fields: f('icon', 'title', 'detail', 'enabled'), required: ['title'], order: 'id' }));

// ---- Housekeeping ----
router.use(
  '/housekeeping/tasks',
  crud({
    table: 'housekeeping_tasks',
    fields: { ...f('time', 'title', 'location', 'assignee', 'status'), date: 'task_date' },
    types: { date: 'date' },
    required: ['title'],
    scope: 'task_date >= CURRENT_DATE - 1',
    order: 'task_date, time',
  }),
);
router.use('/housekeeping/staff', crud({ table: 'housekeeping_staff', fields: f('name', 'zone', 'shift'), required: ['name'], order: 'id' }));
router.use('/housekeeping/stock', crud({ table: 'linen_stock', fields: f('item', 'level', 'par'), types: { level: 'number', par: 'number' }, required: ['item'], order: 'id' }));
router.use('/housekeeping/guest-notes', crud({ table: 'housekeeping_guest_notes', fields: f('icon', 'residence', 'guest', 'text'), required: ['text'] }));

// ---- Maintenance ----
router.use(
  '/maintenance/work-orders',
  crud({
    table: 'work_orders',
    fields: f('number', 'title', 'location', 'priority', 'technician', 'status', 'createdAt'),
    types: { createdAt: 'timestamp' },
    required: ['title'],
    order: 'created_at DESC',
    async after(req, item, ctx) {
      await autoNumber('work_orders', 'WO-')(req, item, ctx);
      if (ctx.op === 'create') await notify(req, `New work order ${item.number}`, [item.title, item.location].filter(Boolean).join(' · '), { link: '/maintenance' });
    },
  }),
);
router.use('/maintenance/preventive', crud({ table: 'preventive_maintenance', fields: f('date', 'title', 'location', 'duration', 'status'), types: { date: 'date' }, required: ['title', 'date'], order: 'date' }));
router.use('/maintenance/systems', crud({ table: 'maintenance_systems', fields: f('icon', 'name', 'health', 'checkedAt'), types: { health: 'number', checkedAt: 'timestamp' }, required: ['name'], order: 'id' }));
router.use('/maintenance/alerts', crud({ table: 'maintenance_alerts', fields: f('icon', 'severity', 'title', 'detail', 'location', 'status', 'workOrder'), required: ['title'] }));
router.use('/maintenance/technicians', crud({ table: 'technicians', fields: f('name', 'skill', 'status'), required: ['name'], order: 'id' }));

// ---- Residences ----
router.use(
  '/residences/alerts',
  crud({
    table: 'device_alerts',
    fields: f('icon', 'severity', 'residence', 'title', 'raisedAt', 'status'),
    types: { raisedAt: 'timestamp' },
    required: ['title'],
    order: 'raised_at DESC',
    async after(req, item, { op }) {
      if (op === 'create' && item.severity === 'High') await notify(req, `Device alert · ${item.residence || 'Property'}`, item.title, { link: '/residences' });
    },
  }),
);

// ---- Wellness packages ----
router.use(
  '/wellness/packages',
  crud({
    table: 'wellness_packages',
    fields: { ...f('title', 'guestId', 'guestName', 'date', 'start', 'status'), end: 'end' },
    types: { date: 'date' },
    guest: true,
    required: ['title', 'date'],
    order: 'date, start',
  }),
);

// ---- Dining ----
router.use(
  '/dining/orders',
  crud({
    table: 'dining_orders',
    fields: f('number', 'venue', 'items', 'time', 'location', 'status', 'guestId', 'guestName', 'total'),
    types: { total: 'number' },
    guest: true,
    required: ['items'],
    order: 'created_at DESC',
    async after(req, item, ctx) {
      await autoNumber('dining_orders', '#D')(req, item, ctx);
      if (ctx.op === 'update' && item.guestId && ctx.before && item.status !== ctx.before.status) {
        const words = { Preparing: 'is being prepared', Ready: 'is ready and on its way', Delivered: 'has been delivered — enjoy' };
        if (words[item.status]) notifyGuest(req.app, item.guestId, { title: 'Dining', body: `Your order ${words[item.status]}.`, event: 'dining:updated', data: { id: item.id, status: item.status, screen: 'Dining' } });
      }
      // The guest timeline picks orders up from dining_orders; the charge goes on the folio.
      if (ctx.op === 'create' && item.guestId && item.total > 0) {
        await ctx.q.query(
          `INSERT INTO folio_charges (guest_id, booking_id, description, category, amount, source_type, source_id, created_by)
           VALUES ($1, (SELECT id FROM bookings WHERE user_id = $1 AND status = 'checked_in' ORDER BY check_in_date DESC LIMIT 1),
                   $2, 'Dining', $3, 'dining_order', $4, $5)`,
          [item.guestId, `${item.venue || 'Dining'} · ${item.items}`, item.total, item.id, req.user.id],
        );
      }
    },
  }),
);
router.use(
  '/dining/menu',
  crud({ table: 'menu_items', fields: f('name', 'venue', 'price', 'category', 'available', 'popular'), types: { price: 'number' }, required: ['name'], order: 'id' }),
);

// ---- Transportation ----
router.use(
  '/transport/transfers',
  crud({
    table: 'transfers',
    fields: { ...f('date', 'time', 'kind', 'guestId', 'guestName', 'vehicle', 'driver', 'status'), from: 'from_location', to: 'to_location' },
    types: { date: 'date' },
    guest: true,
    required: ['date'],
    order: 'date DESC, time',
    async after(req, item, ctx) {
      if (ctx.op === 'update' && item.guestId && ctx.before && item.status !== ctx.before.status) {
        const words = { Assigned: `is confirmed${item.driver ? ` — ${item.driver} will drive you` : ''}`, 'En Route': 'is on its way', Delayed: 'is running late', Cancelled: 'was cancelled' };
        if (words[item.status]) notifyGuest(req.app, item.guestId, { title: item.kind || 'Your ride', body: `Your ride on ${item.date} at ${item.time || ''} ${words[item.status]}.`, event: 'transfer:updated', data: { id: item.id, status: item.status, screen: 'Transfers' } });
      }
    },
  }),
);
router.use('/transport/fleet', crud({ table: 'fleet_vehicles', fields: f('icon', 'name', 'detail', 'status'), required: ['name'], order: 'id' }));
router.use('/transport/drivers', crud({ table: 'chauffeurs', fields: f('name', 'area', 'status', 'phone'), required: ['name'], order: 'id' }));
router.use(
  '/transport/flights',
  crud({
    table: 'flights',
    fields: f('flight', 'guestId', 'guestName', 'direction', 'airport', 'time', 'status'),
    types: { time: 'timestamp' },
    guest: true,
    required: ['flight'],
    order: 'time',
  }),
);

// ---- Reservations extras ----
router.use(
  '/reservations/packages',
  crud({ table: 'reservation_packages', fields: f('name', 'detail', 'price', 'nights', 'collection'), types: { price: 'number', nights: 'number' }, required: ['name'], order: 'id' }),
);
router.use(
  '/reservations/groups',
  crud({ table: 'group_bookings', fields: f('dates', 'name', 'residences', 'guests', 'status', 'contact'), types: { guests: 'number' }, required: ['name'], order: 'id' }),
);

// ---- AI command ----
router.use(
  '/ai/alerts',
  crud({ table: 'ai_alerts', fields: f('icon', 'severity', 'title', 'detail', 'raisedAt', 'status', 'link'), types: { raisedAt: 'timestamp' }, required: ['title'], order: 'raised_at DESC' }),
);
router.use('/ai/priorities', crud({ table: 'ai_priorities', fields: f('title', 'level', 'done'), required: ['title'], order: 'done, id' }));

// ---- Settings ----
router.use('/settings/invoices', crud({ table: 'invoices', fields: f('number', 'date', 'amount', 'status'), types: { date: 'date', amount: 'number' }, required: ['number'], order: 'date DESC' }));

module.exports = router;

import api from './client';
import { withMock } from './mock';
import { addTimeline, getDb, mutate, nextId, notify } from '../mocks/db';

/**
 * Simple list resources used across the operational pages. Each maps to a REST collection:
 *   GET  {path}?…filters   → Item[]
 *   POST {path}            → Item
 *   PATCH {path}/:id       → Item
 *   DELETE {path}/:id      → { ok: true }
 * Field shapes are documented in docs/API.md.
 */
export const RESOURCES = {
  automations: '/journey/automations',
  housekeepingTasks: '/housekeeping/tasks',
  housekeepingStaff: '/housekeeping/staff',
  linenStock: '/housekeeping/stock',
  guestNotes: '/housekeeping/guest-notes',
  workOrders: '/maintenance/work-orders',
  preventive: '/maintenance/preventive',
  systems: '/maintenance/systems',
  technicians: '/maintenance/technicians',
  maintenanceAlerts: '/maintenance/alerts',
  deviceAlerts: '/residences/alerts',
  wellnessSchedule: '/wellness/appointments',
  wellnessPackages: '/wellness/packages',
  diningReservations: '/dining/reservations',
  diningOrders: '/dining/orders',
  menuItems: '/dining/menu',
  transfers: '/transport/transfers',
  fleet: '/transport/fleet',
  drivers: '/transport/drivers',
  flights: '/transport/flights',
  experiences: '/experiences',
  experienceBookings: '/experiences/bookings',
  roomTypes: '/reservations/room-types',
  packages: '/reservations/packages',
  groups: '/reservations/groups',
  aiAlerts: '/ai/alerts',
  aiPriorities: '/ai/priorities',
  team: '/settings/team',
  integrations: '/settings/integrations',
  invoices: '/settings/invoices',
};

const path = (name) => {
  if (!RESOURCES[name]) throw new Error(`Unknown resource "${name}"`);
  return RESOURCES[name];
};

/**
 * Backend side effects reproduced by the mock layer (timeline entries, notifications), keyed by resource.
 * fn(db, item, op) with op = 'create' | 'update'.
 */
const EFFECTS = {
  workOrders: (d, item, op) => op === 'create' && notify(d, `New work order ${item.number}`, `${item.title} · ${item.location}`),
  transfers: (d, item, op) => op === 'create' && addTimeline(d, item.guestId, `Transfer booked – ${item.route}`, 'Transportation'),
  diningReservations: (d, item, op) => op === 'create' && addTimeline(d, item.guestId, `Table booked – ${item.venue} ${item.time}`, 'Dining'),
  wellnessSchedule: (d, item, op) => op === 'create' && addTimeline(d, item.guestId, `Booked – ${item.treatment}`, 'Wellness'),
  experienceBookings: (d, item, op) => op === 'create' && addTimeline(d, item.guestId, `Booked – ${item.experience}`, 'Experience'),
  diningOrders: (d, item, op) => op === 'create' && addTimeline(d, item.guestId, `Order placed – ${item.items}`, 'Dining'),
};

const matches = (item, params) => Object.entries(params || {}).every(([k, v]) => v === undefined || v === '' || String(item[k]) === String(v));

/** GET {path} — mock filters by exact field match on any params given. */
export const list = (name, params) => withMock(() => api.get(path(name), { params }), () => (getDb()[name] || []).filter((item) => matches(item, params)));

/** POST {path} → created item (newest first in lists). */
export const create = (name, data) =>
  withMock(
    () => api.post(path(name), data),
    () =>
      mutate((d) => {
        d[name] = d[name] || [];
        const item = { id: nextId(d[name]), createdAt: new Date().toISOString(), ...data };
        if (item.guestId) {
          const g = d.guests.find((x) => x.id === Number(item.guestId));
          if (g) Object.assign(item, { guestId: g.id, guestName: item.guestName || g.name });
        }
        d[name].unshift(item);
        EFFECTS[name]?.(d, item, 'create');
        return item;
      }),
  );

/** PATCH {path}/:id → updated item. */
export const update = (name, id, changes) =>
  withMock(
    () => api.patch(`${path(name)}/${encodeURIComponent(id)}`, changes),
    () =>
      mutate((d) => {
        const item = (d[name] || []).find((x) => String(x.id) === String(id));
        if (!item) throw new Error('Not found');
        Object.assign(item, changes);
        EFFECTS[name]?.(d, item, 'update');
        return item;
      }),
  );

/** DELETE {path}/:id */
export const remove = (name, id) =>
  withMock(
    () => api.delete(`${path(name)}/${encodeURIComponent(id)}`),
    () =>
      mutate((d) => {
        d[name] = (d[name] || []).filter((x) => String(x.id) !== String(id));
        return { ok: true };
      }),
  );

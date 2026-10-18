import api from './client';
import { withMock } from './mock';
import { getDb, mutate, nextId, notify } from '../mocks/db';

const overlaps = (r, from, to) => (!from || r.checkOut > from) && (!to || r.checkIn < to);

/** GET /reservations?from=YYYY-MM-DD&to=YYYY-MM-DD&status= → Reservation[] (stays overlapping the range) */
export const list = (params = {}) =>
  withMock(
    () => api.get('/reservations', { params }),
    () => getDb().reservations.filter((r) => overlaps(r, params.from, params.to) && (!params.status || r.status === params.status)),
  );

/** GET /reservations/today → { arrivals: Movement[], departures: Movement[] } */
export const today = () => withMock(() => api.get('/reservations/today'), () => getDb().todayMovements);

/** PATCH /reservations/today/:kind/:id { status } — kind = arrivals | departures (front-desk check-in / check-out). */
export const updateMovement = (kind, id, status) =>
  withMock(
    () => api.patch(`/reservations/today/${kind}/${id}`, { status }),
    () => mutate((d) => Object.assign(d.todayMovements[kind].find((m) => m.id === id), { status })),
  );

/**
 * POST /reservations { guestName, guestId?, residence, collection, checkIn, checkOut, guests, source, packageId?, totalAmount }
 * → Reservation. The backend must reject (409) a stay that overlaps another one in the same residence.
 */
export const create = (data) =>
  withMock(
    () => api.post('/reservations', data),
    () =>
      mutate((d) => {
        const clash = d.reservations.find((r) => r.residence === data.residence && r.status !== 'Cancelled' && overlaps(r, data.checkIn, data.checkOut));
        if (clash) throw new Error(`${data.residence} is already booked ${clash.checkIn} → ${clash.checkOut} (${clash.guestName})`);
        const id = nextId(d.reservations);
        const r = { id, number: `FYH${7800 + id - 5000}`, status: 'Confirmed', currency: 'usd', bookedAt: new Date().toISOString(), ...data };
        d.reservations.push(r);
        notify(d, 'New reservation', `${r.guestName} · ${r.residence} · ${r.checkIn}`);
        return r;
      }),
  );

/** PATCH /reservations/:id { status } → Reservation (status Cancelled frees the dates). */
export const update = (id, changes) =>
  withMock(
    () => api.patch(`/reservations/${id}`, changes),
    () =>
      mutate((d) => {
        const r = d.reservations.find((x) => x.id === id);
        Object.assign(r, changes, changes.status === 'Cancelled' ? { cancelledAt: new Date().toISOString() } : {});
        return r;
      }),
  );

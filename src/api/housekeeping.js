import api from './client';
import { withMock } from './mock';
import { getDb, mutate } from '../mocks/db';

/** GET /housekeeping/rooms → HousekeepingRoom[] */
export const rooms = () => withMock(() => api.get('/housekeeping/rooms'), () => getDb().housekeepingRooms);

/** PATCH /housekeeping/rooms/:id { status } (also broadcast as `housekeeping:updated`). */
export const setStatus = (id, status) =>
  withMock(
    () => api.patch(`/housekeeping/rooms/${id}`, { status }),
    () => mutate((d) => Object.assign(d.housekeepingRooms.find((r) => r.id === id), { status })),
  );

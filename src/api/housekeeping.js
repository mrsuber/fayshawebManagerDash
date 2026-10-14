import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /housekeeping/rooms → HousekeepingRoom[] */
export const rooms = () => withMock(() => api.get('/housekeeping/rooms'), mock.housekeepingRooms);

/** PATCH /housekeeping/rooms/:id { status } (also broadcast as `housekeeping:updated`). */
export const setStatus = (id, status) => withMock(() => api.patch(`/housekeeping/rooms/${id}`, { status }), { id, status });

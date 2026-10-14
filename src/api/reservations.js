import api from './client';
import { withMock } from './mock';
import { getDb } from '../mocks/db';

/** GET /reservations?from=YYYY-MM-DD&to=YYYY-MM-DD → Reservation[] (stays overlapping the range). */
export const list = (params) => withMock(() => api.get('/reservations', { params }), () => getDb().reservations);

/** GET /reservations/today → { arrivals: Movement[], departures: Movement[] } */
export const today = () => withMock(() => api.get('/reservations/today'), () => getDb().todayMovements);

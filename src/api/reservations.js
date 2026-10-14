import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /reservations?from=YYYY-MM-DD&to=YYYY-MM-DD → Reservation[] (stays overlapping the range). */
export const list = (params) => withMock(() => api.get('/reservations', { params }), mock.reservations);

/** GET /reservations/today → { arrivals: Movement[], departures: Movement[] } */
export const today = () => withMock(() => api.get('/reservations/today'), mock.todayMovements);

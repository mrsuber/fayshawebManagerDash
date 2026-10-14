import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /dining/tables → DiningTable[] */
export const tables = () => withMock(() => api.get('/dining/tables'), mock.diningTables);

/** PATCH /dining/tables/:id { status } */
export const setTableStatus = (id, status) => withMock(() => api.patch(`/dining/tables/${encodeURIComponent(id)}`, { status }), { id, status });

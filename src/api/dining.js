import api from './client';
import { withMock } from './mock';
import { getDb, mutate } from '../mocks/db';

/** GET /dining/tables → DiningTable[] */
export const tables = () => withMock(() => api.get('/dining/tables'), () => getDb().diningTables);

/** PATCH /dining/tables/:id { status } */
export const setTableStatus = (id, status) =>
  withMock(
    () => api.patch(`/dining/tables/${encodeURIComponent(id)}`, { status }),
    () => mutate((d) => Object.assign(d.diningTables.find((t) => t.id === id), { status })),
  );

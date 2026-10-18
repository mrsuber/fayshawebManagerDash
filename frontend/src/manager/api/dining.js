import api from './client';
import { withMock } from './mock';
import { getDb, mutate } from '../mocks/db';

/** GET /dining/tables → DiningTable[] */
export const tables = () => withMock(() => api.get('/dining/tables'), () => getDb().diningTables);

/** PATCH /dining/tables/:id { status, guestName? } */
export const setTable = (id, changes) =>
  withMock(
    () => api.patch(`/dining/tables/${encodeURIComponent(id)}`, changes),
    () => mutate((d) => Object.assign(d.diningTables.find((t) => t.id === id), changes)),
  );

/** @deprecated use setTable */
export const setTableStatus = (id, status) => setTable(id, { status });

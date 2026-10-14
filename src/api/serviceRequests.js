import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /service-requests?department= → ServiceRequest[] */
export const list = (params) => withMock(() => api.get('/service-requests', { params }), mock.serviceRequests);

/** PATCH /service-requests/:id { status } → ServiceRequest (also broadcast as `service-request:updated`). */
export const update = (id, changes) =>
  withMock(() => api.patch(`/service-requests/${id}`, changes), () => ({ ...mock.serviceRequests.find((r) => r.id === id), ...changes }));

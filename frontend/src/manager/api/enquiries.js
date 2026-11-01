import api from './client';
import { withMock } from './mock';

const empty = { items: [], counts: {} };

/** GET /enquiries?status=&q= → { items, counts } */
export const list = (params = {}) => withMock(() => api.get('/enquiries', { params }), empty);
/** GET /enquiries/:id → Enquiry with thread */
export const get = (id) => withMock(() => api.get(`/enquiries/${id}`), null);
/** PATCH /enquiries/:id { status?, assignedTo? } */
export const update = (id, changes) => withMock(() => api.patch(`/enquiries/${id}`, changes), null);
/** POST /enquiries/:id/notes { body } */
export const note = (id, body) => withMock(() => api.post(`/enquiries/${id}/notes`, { body }), null);
/** POST /enquiries/:id/reply { body } — emails the enquirer */
export const reply = (id, body) => withMock(() => api.post(`/enquiries/${id}/reply`, { body }), null);

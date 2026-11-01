import api from './client';
import { withMock } from './mock';

export const list = (params = {}) => withMock(() => api.get('/events', { params }), { items: [], counts: {}, pipeline: [] });
export const get = (id) => withMock(() => api.get(`/events/${id}`), null);
export const create = (data) => withMock(() => api.post('/events', data), null);
export const update = (id, changes) => withMock(() => api.patch(`/events/${id}`, changes), null);
export const note = (id, body) => withMock(() => api.post(`/events/${id}/notes`, { body }), null);
export const reply = (id, body) => withMock(() => api.post(`/events/${id}/reply`, { body }), null);
export const createQuote = (id, data) => withMock(() => api.post(`/events/${id}/quotes`, data), null);
export const updateQuote = (id, qid, data) => withMock(() => api.patch(`/events/${id}/quotes/${qid}`, data), null);
export const sendQuote = (id, qid) => withMock(() => api.post(`/events/${id}/quotes/${qid}/send`), null);
export const deposit = (id, data) => withMock(() => api.post(`/events/${id}/deposit`, data), null);
export const story = (id) => withMock(() => api.post(`/events/${id}/story`), null);

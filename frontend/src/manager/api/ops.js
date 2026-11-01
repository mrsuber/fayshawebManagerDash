import api from './client';
import { withMock } from './mock';

const get = (path, params, fallback) => withMock(() => api.get(path, { params }), fallback);
const post = (path, body) => withMock(() => api.post(path, body), null);

// Lockers and loans
export const loans = (status) => get('/loans', { status }, []);
export const loanItems = () => get('/loans/items', undefined, []);
export const createItem = (data) => post('/loans/items', data);
export const updateItem = (id, data) => withMock(() => api.patch(`/loans/items/${id}`, data), null);
export const createLoan = (data) => post('/loans', data);
export const loanAction = (id, action, body = {}) => post(`/loans/${id}/${action}`, body);

// Visitors and the gate
export const visitors = (date) => get('/visitors', { date }, { date, items: [] });
export const visitorAction = (id, action) => post(`/visitors/${id}/${action}`);
export const verifyPass = (code) => post('/visitors/verify', { code });
export const openGate = (body) => post('/gate/open', body);
export const gateEvents = () => get('/gate/events', undefined, []);
export const visitorSettings = () => get('/visitors/settings', undefined, { autoApprove: false });
export const saveVisitorSettings = (data) => withMock(() => api.put('/visitors/settings', data), data);

// Quality
export const qualitySummary = (days) => get('/quality/summary', { days }, { overall: {}, people: [], departments: [], inspections: {}, cleaners: [] });
export const ratings = (params) => get('/quality/ratings', params, []);
export const updateRating = (id, data) => withMock(() => api.patch(`/quality/ratings/${id}`, data), null);
export const inspections = (days) => get('/housekeeping/inspections', { days }, []);
export const checklist = () => get('/housekeeping/checklist', undefined, []);
export const saveChecklist = (items) => withMock(() => api.put('/housekeeping/checklist', { items }), items);
export const inspect = (roomId, data) => post(`/housekeeping/rooms/${roomId}/inspect`, data);

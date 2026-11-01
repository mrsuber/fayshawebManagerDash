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

// Assets: register, care schedule, replacement reserve
export const assets = () => get('/assets', undefined, []);
export const asset = (id) => get(`/assets/${id}`, undefined, null);
export const createAsset = (data) => post('/assets', data);
export const updateAsset = (id, data) => withMock(() => api.patch(`/assets/${id}`, data), null);
export const logAsset = (id, data) => post(`/assets/${id}/log`, data);
export const replaceAsset = (id, data) => post(`/assets/${id}/replace`, data);
export const assetTasks = (days) => get('/assets/tasks', { days }, []);
export const createAssetTask = (data) => post('/assets/tasks', data);
export const updateAssetTask = (id, data) => withMock(() => api.patch(`/assets/tasks/${id}`, data), null);
export const assetTaskDone = (id, data) => post(`/assets/tasks/${id}/done`, data);
export const assetBudget = () => get('/assets/budget', undefined, null);

// Wellness catalogue
export const wellnessCatalog = () => get('/wellness/catalog', undefined, []);
export const createWellness = (data) => post('/wellness/catalog', data);
export const updateWellness = (id, data) => withMock(() => api.patch(`/wellness/catalog/${id}`, data), null);
export const deleteWellness = (id) => withMock(() => api.delete(`/wellness/catalog/${id}`), { deleted: true });

import axios from 'axios';
import { API_URL } from '../site/api';

/**
 * Faysha HQ API client. `hq` talks to /api/admin (routes/admin), `api` to the rest of /api.
 * Both send the signed-in user's JWT (stored by src/contexts/AuthContext.jsx) and turn error
 * responses into Error(message).
 */
const withAuth = (instance) => {
  instance.interceptors.request.use((req) => {
    const token = localStorage.getItem('authToken');
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
  });
  instance.interceptors.response.use(
    (res) => res.data,
    (err) => {
      const data = err.response?.data;
      const e = new Error(data?.message || data?.error || err.message);
      e.status = err.response?.status;
      return Promise.reject(e);
    },
  );
  return instance;
};

export const hq = withAuth(axios.create({ baseURL: `${API_URL}/admin`, timeout: 20000 }));
export const api = withAuth(axios.create({ baseURL: API_URL, timeout: 20000 }));

const qs = (params = {}) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${new URLSearchParams(p).toString()}` : '';
};

export const hqApi = {
  me: () => hq.get('/me'),
  overview: (property) => hq.get(`/overview${qs({ property })}`),
  revenue: (params) => hq.get(`/revenue${qs(params)}`),
  payments: (params) => hq.get(`/payments${qs(params)}`),
  markPaid: (id, reference) => hq.post(`/payments/${id}/mark-paid`, { reference }),
  confirmBooking: (bookingId) => api.post(`/bookings/${bookingId}/confirm`, {}),
  approvals: (status) => hq.get(`/approvals${qs({ status })}`),
  raiseApproval: (body) => hq.post('/approvals', body),
  decide: (id, decision, note) => hq.post(`/approvals/${id}/decide`, { decision, note }),
  staff: () => hq.get('/staff'),
  invite: (body) => hq.post('/staff', body),
  updateStaff: (id, body) => hq.patch(`/staff/${id}`, body),
  resetPassword: (id) => hq.post(`/staff/${id}/reset-password`),
  viewAs: (id) => hq.post(`/staff/${id}/view-as`),
  departments: () => hq.get('/departments'),
  addDepartment: (body) => hq.post('/departments', body),
  roles: () => hq.get('/roles'),
  createRole: (body) => hq.post('/roles', body),
  updateRole: (id, body) => hq.patch(`/roles/${id}`, body),
  deleteRole: (id) => hq.delete(`/roles/${id}`),
  audit: (params) => hq.get(`/audit${qs(params)}`),
  signIns: () => hq.get('/audit/sign-ins'),
  properties: () => hq.get('/properties'),
  addProperty: (body) => hq.post('/properties', body),
  updateProperty: (id, body) => hq.patch(`/properties/${id}`, body),
};

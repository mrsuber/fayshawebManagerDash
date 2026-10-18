import apiClient from './api';

/** The signed-in guest's stay and services: /api/guest (backend/routes/guest). */
const guest = {
  overview: () => apiClient.get('/guest/overview'),
  stays: () => apiClient.get('/guest/stays'),
  stay: (id) => apiClient.get(`/guest/stays/${id}`),
  folio: (stayId) => apiClient.get('/guest/folio', { params: stayId ? { stay: stayId } : {} }),

  requests: () => apiClient.get('/guest/requests'),
  createRequest: (body) => apiClient.post('/guest/requests', body),
  cancelRequest: (id) => apiClient.post(`/guest/requests/${id}/cancel`),

  menu: () => apiClient.get('/guest/dining/menu'),
  orders: () => apiClient.get('/guest/dining/orders'),
  placeOrder: (body) => apiClient.post('/guest/dining/orders', body),
  reservations: () => apiClient.get('/guest/dining/reservations'),
  reserveTable: (body) => apiClient.post('/guest/dining/reservations', body),
  cancelReservation: (id) => apiClient.post(`/guest/dining/reservations/${id}/cancel`),

  experiences: () => apiClient.get('/guest/experiences'),
  experienceBookings: () => apiClient.get('/guest/experiences/bookings'),
  bookExperience: (id, body) => apiClient.post(`/guest/experiences/${id}/book`, body),

  transfers: () => apiClient.get('/guest/transfers'),
  requestTransfer: (body) => apiClient.post('/guest/transfers', body),

  home: () => apiClient.get('/guest/home'),
  setClimate: (targetTemp) => apiClient.patch('/guest/home/climate', { targetTemp }),
  setScene: (scene) => apiClient.post('/guest/home/scene', { scene }),
  setDevice: (key, on) => apiClient.patch(`/guest/home/devices/${key}`, { on }),
  setPrivacy: (doNotDisturb) => apiClient.patch('/guest/home/privacy', { doNotDisturb }),

  rewards: () => apiClient.get('/guest/rewards'),
  tour: () => apiClient.get('/guest/tour'),
};

export default guest;

import api from './client';
import { withMock } from './mock';
import { getDb } from '../mocks/db';

/** GET /residences → Residence[] */
export const list = () => withMock(() => api.get('/residences'), () => getDb().residences);

/** PATCH /residences/:id/devices/:deviceId { on } */
export const setDevice = (id, deviceId, on) => withMock(() => api.patch(`/residences/${id}/devices/${encodeURIComponent(deviceId)}`, { on }), { ok: true });

/** PATCH /residences/:id/climate { targetTemp } */
export const setClimate = (id, targetTemp) => withMock(() => api.patch(`/residences/${id}/climate`, { targetTemp }), { ok: true });

/** POST /residences/:id/scene { scene } */
export const setScene = (id, scene) => withMock(() => api.post(`/residences/${id}/scene`, { scene }), { ok: true });

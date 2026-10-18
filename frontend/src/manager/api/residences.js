import api from './client';
import { withMock } from './mock';
import { getDb, mutate } from '../mocks/db';

const patch = (id, fn) => mutate((d) => fn(d.residences.find((r) => r.id === id)) || { ok: true });

/** GET /residences → Residence[] */
export const list = () => withMock(() => api.get('/residences'), () => getDb().residences);

/** PATCH /residences/:id/devices/:deviceId { on } */
export const setDevice = (id, deviceId, on) =>
  withMock(
    () => api.patch(`/residences/${id}/devices/${encodeURIComponent(deviceId)}`, { on }),
    () =>
      patch(id, (r) => {
        r.devicesOff = { ...(r.devicesOff || {}), [deviceId]: !on };
      }),
  );

/** PATCH /residences/:id/climate { targetTemp } */
export const setClimate = (id, targetTemp) => withMock(() => api.patch(`/residences/${id}/climate`, { targetTemp }), () => patch(id, (r) => void (r.targetTemp = targetTemp)));

/** POST /residences/:id/scene { scene } */
export const setScene = (id, scene) => withMock(() => api.post(`/residences/${id}/scene`, { scene }), () => patch(id, (r) => void (r.scene = scene)));

/** PATCH /residences/:id/security { [key]: state } — front door / garage lock, privacy mode. */
export const setSecurity = (id, changes) =>
  withMock(
    () => api.patch(`/residences/${id}/security`, changes),
    () =>
      patch(id, (r) => {
        r.security = { ...(r.security || {}), ...changes };
      }),
  );

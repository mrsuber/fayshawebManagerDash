import api from './client';
import { withMock } from './mock';
import { getDb, mutate } from '../mocks/db';

/** GET /notifications → Notification[] (newest first) */
export const list = () => withMock(() => api.get('/notifications'), () => getDb().notifications);

/** PATCH /notifications/read-all */
export const markAllRead = () =>
  withMock(
    () => api.patch('/notifications/read-all'),
    () => mutate((d) => d.notifications.forEach((n) => (n.read = true)) || { ok: true }),
  );

/** POST /notifications/device-token { token, platform } — stores the FCM token so firebase-admin can push to this browser. */
export const registerDevice = (token) => withMock(() => api.post('/notifications/device-token', { token, platform: 'web' }), { ok: true });

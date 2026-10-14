import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /notifications → Notification[] (newest first) */
export const list = () => withMock(() => api.get('/notifications'), mock.notifications);

/** PATCH /notifications/read-all */
export const markAllRead = () => withMock(() => api.patch('/notifications/read-all'), { ok: true });

/** POST /notifications/device-token { token, platform } — stores the FCM token so firebase-admin can push to this browser. */
export const registerDevice = (token) => withMock(() => api.post('/notifications/device-token', { token, platform: 'web' }), { ok: true });

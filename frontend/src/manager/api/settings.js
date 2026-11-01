import api from './client';
import { withMock } from './mock';
import { getDb, mutate, notify } from '../mocks/db';

/** GET /settings/property → Property */
export const getProperty = () => withMock(() => api.get('/settings/property'), () => getDb().property);

/** PUT /settings/property Property → Property */
export const saveProperty = (property) => withMock(() => api.put('/settings/property', property), () => mutate((d) => (d.property = property)));

/** GET /settings/preferences → { ai, notifications, billing } */
export const getPreferences = () => withMock(() => api.get('/settings/preferences'), () => getDb().preferences);

/** PATCH /settings/preferences { ai?, notifications?, billing? } (deep-merged) → preferences */
export const savePreferences = (changes) =>
  withMock(
    () => api.patch('/settings/preferences', changes),
    () =>
      mutate((d) => {
        Object.entries(changes).forEach(([k, v]) => (d.preferences[k] = { ...d.preferences[k], ...v }));
        return d.preferences;
      }),
  );

/** POST /notifications/test → { ok } — sends a test push/email to the signed-in user. */
export const sendTestNotification = () =>
  withMock(
    () => api.post('/notifications/test'),
    () => mutate((d) => notify(d, 'Test notification', 'Your notification settings work 🎉') || { ok: true }),
  );

/** GET /settings/currencies → { base, accepted, rates, updatedAt } (rates: base units for 1 unit) */
export const getCurrencies = () => withMock(() => api.get('/settings/currencies'), { base: 'XAF', accepted: ['XAF'], rates: { XAF: 1, EUR: 655.957 } });
/** PUT /settings/currencies { accepted, rates } */
export const saveCurrencies = (data) => withMock(() => api.put('/settings/currencies', data), data);

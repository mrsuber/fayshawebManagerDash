import api from './client';
import { withMock } from './mock';
import { getDb, mutate } from '../mocks/db';

/** GET /settings/property → Property */
export const getProperty = () => withMock(() => api.get('/settings/property'), () => getDb().property);

/** PUT /settings/property Property → Property */
export const saveProperty = (property) => withMock(() => api.put('/settings/property', property), () => mutate((d) => (d.property = property)));

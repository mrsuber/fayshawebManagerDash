import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /settings/property → Property */
export const getProperty = () => withMock(() => api.get('/settings/property'), mock.property);

/** PUT /settings/property Property → Property */
export const saveProperty = (property) => withMock(() => api.put('/settings/property', property), () => property);

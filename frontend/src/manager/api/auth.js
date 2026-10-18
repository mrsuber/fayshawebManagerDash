import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /auth/me → { user }. Sign-in itself happens on the site's /login page. */
export const me = () => withMock(() => api.get('/auth/me'), { user: mock.user });

import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** POST /auth/login → { token, user }. Backend checks the bcrypt hash and signs a JWT. */
export const login = (email, password) => withMock(() => api.post('/auth/login', { email, password }), { token: 'mock-token', user: { ...mock.user, email } });

/** POST /auth/firebase → { token, user }. Backend verifies the Firebase ID token with firebase-admin and issues its own JWT. */
export const loginWithFirebase = (idToken) => withMock(() => api.post('/auth/firebase', { idToken }), { token: 'mock-token', user: mock.user });

/** GET /auth/me → { user }. Used to restore a session from a stored JWT. */
export const me = () => withMock(() => api.get('/auth/me'), { user: mock.user });

import axios from 'axios';
import { API_URL } from '../config';
import { getToken } from './session';

export const API_BASE_URL = API_URL;

/**
 * The one HTTP client for the app. Resolves with the response body; rejects with
 * { message, error, status, code } whatever shape the server used ({ message } or { error }).
 */
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

let onUnauthorized = null;
/** AuthContext registers a handler so an expired session signs the guest out everywhere. */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const body = data && typeof data === 'object' ? data : {};
      const message = body.message || body.error || (status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed');
      const authFailure = status === 401 && !String(error.config?.url || '').includes('/auth/login');
      if (authFailure && onUnauthorized) onUnauthorized();
      return Promise.reject({ ...body, message, error: message, status, code: body.code });
    }
    const offline = { message: 'No connection. Please check your internet and try again.', status: 0, offline: true };
    return Promise.reject({ ...offline, error: offline.message });
  },
);

/** The message to show for a rejected request. */
export const errorMessage = (e, fallback = 'Something went wrong. Please try again.') => e?.message || e?.error || fallback;

export default apiClient;

import axios from 'axios';
import config from '../config';

const TOKEN_KEY = 'fayos.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Shared axios instance: JSON, JWT bearer auth, normalized errors. */
const api = axios.create({
  baseURL: config.apiUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((req) => {
  const token = getToken();
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

let onUnauthorized = () => {};
/** AuthContext registers a handler so an expired JWT logs the user out. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) onUnauthorized();
    // Express handlers are expected to respond with { message } (or { error }) on failure.
    const data = err.response?.data;
    err.message = data?.message || data?.error || err.message;
    return Promise.reject(err);
  },
);

export default api;

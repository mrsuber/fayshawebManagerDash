/**
 * Runtime configuration for the manager dashboard (REACT_APP_* variables, inlined at build time).
 *
 * The dashboard talks to the FayshaaWeb API under /api/manager, using the same base URL as the
 * rest of the site: REACT_APP_API_URL, else /api in production and http://localhost:5001/api locally.
 */
const env = process.env;

const siteApi = (
  env.REACT_APP_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/api' : 'http://localhost:5001/api')
).replace(/\/$/, '');

const apiOrigin = /^https?:\/\//.test(siteApi) ? siteApi.replace(/\/api$/, '') : undefined;

const config = {
  /** Base URL of the manager API, e.g. https://fayshaa.com/api/manager */
  apiUrl: `${siteApi}/manager`,
  /** Socket.io server: the API origin (same origin in production). */
  socketUrl: env.REACT_APP_SOCKET_URL || apiOrigin,
  /**
   * Sample data instead of the API, for working on the UI without a backend.
   * Development only: set REACT_APP_USE_MOCKS=true. Production builds always use the API.
   */
  useMocks: env.NODE_ENV !== 'production' && env.REACT_APP_USE_MOCKS === 'true',
  stripePublishableKey: env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '',
  /** Fallback currency until Settings → Property loads (the backend default is XAF). */
  currency: (env.REACT_APP_CURRENCY || 'xaf').toLowerCase(),
  firebaseVapidKey: env.REACT_APP_FIREBASE_VAPID_KEY || '',
};

export default config;

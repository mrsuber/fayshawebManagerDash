/**
 * Runtime configuration, read from REACT_APP_* environment variables (see .env.example).
 * CRA inlines these at build time, so changing them requires a rebuild.
 */
const env = process.env;

const apiUrl = (env.REACT_APP_API_URL || '').replace(/\/$/, '');

const config = {
  /** Base URL of the Express API, e.g. http://localhost:5000/api. Empty = same origin (/api via the CRA dev proxy). */
  apiUrl: apiUrl || '/api',
  /** Socket.io server. Defaults to the API origin. */
  socketUrl: env.REACT_APP_SOCKET_URL || (apiUrl ? apiUrl.replace(/\/api$/, '') : undefined),
  /**
   * Serve sample data instead of calling the backend. Defaults to on when no API URL is configured,
   * so the dashboard runs standalone; set REACT_APP_USE_MOCKS=false to force live calls.
   */
  useMocks: env.REACT_APP_USE_MOCKS ? env.REACT_APP_USE_MOCKS === 'true' : !apiUrl,
  stripePublishableKey: env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '',
  currency: env.REACT_APP_CURRENCY || 'usd',
  firebase: {
    apiKey: env.REACT_APP_FIREBASE_API_KEY,
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.REACT_APP_FIREBASE_APP_ID,
  },
  firebaseVapidKey: env.REACT_APP_FIREBASE_VAPID_KEY || '',
};

config.firebaseEnabled = Boolean(config.firebase.apiKey && config.firebase.projectId);

export default config;

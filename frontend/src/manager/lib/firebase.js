import config from '../config';

// Reuses the site's Firebase app (src/firebase/config.js), loaded on demand so it stays out of
// the dashboard's first paint.
let appPromise = null;
function firebaseApp() {
  if (config.useMocks) return Promise.resolve(null);
  if (!appPromise) appPromise = import('../../firebase/config').then((m) => m.app).catch(() => null);
  return appPromise;
}

/**
 * Requests notification permission and returns this browser's FCM token (null when unsupported/denied).
 * Uses public/firebase-messaging-sw.js and REACT_APP_FIREBASE_VAPID_KEY.
 */
export async function getPushToken() {
  const app = await firebaseApp();
  if (!app || !config.firebaseVapidKey || typeof Notification === 'undefined') return null;
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  return getToken(getMessaging(app), { vapidKey: config.firebaseVapidKey, serviceWorkerRegistration: registration });
}

/** Foreground push messages (background ones are shown by the service worker). Resolves an unsubscribe function. */
export async function onForegroundPush(handler) {
  const app = await firebaseApp();
  if (!app) return () => {};
  const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return () => {};
  return onMessage(getMessaging(app), handler);
}

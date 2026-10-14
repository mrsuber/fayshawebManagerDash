import config from '../config';

// Firebase is loaded on demand so it stays out of the main bundle when REACT_APP_FIREBASE_* isn't set.
let appPromise = null;
function firebaseApp() {
  if (!config.firebaseEnabled) return Promise.resolve(null);
  if (!appPromise) appPromise = import('firebase/app').then(({ initializeApp }) => initializeApp(config.firebase));
  return appPromise;
}

/** Google popup sign-in. Resolves the Firebase ID token for the backend to verify with firebase-admin. */
export async function firebaseSignInWithGoogle() {
  const app = await firebaseApp();
  if (!app) throw new Error('Firebase is not configured (REACT_APP_FIREBASE_* variables).');
  const { GoogleAuthProvider, getAuth, signInWithPopup } = await import('firebase/auth');
  const cred = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
  return cred.user.getIdToken();
}

export async function firebaseSignOut() {
  const app = await firebaseApp();
  if (!app) return;
  const { getAuth, signOut } = await import('firebase/auth');
  await signOut(getAuth(app)).catch(() => {});
}

/**
 * Requests notification permission and returns this browser's FCM token (null when unsupported/denied).
 * Requires public/firebase-messaging-sw.js and REACT_APP_FIREBASE_VAPID_KEY.
 */
export async function getPushToken() {
  const app = await firebaseApp();
  if (!app || !config.firebaseVapidKey || typeof Notification === 'undefined') return null;
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${new URLSearchParams(config.firebase)}`);
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

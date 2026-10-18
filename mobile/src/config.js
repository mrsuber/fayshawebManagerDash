import Constants from 'expo-constants';

// Values come from app.json → expo.extra, so a build can point at another server without code changes.
const extra = Constants.expoConfig?.extra || {};

export const API_URL = (extra.apiUrl || 'https://fayshaa.com/api').replace(/\/$/, '');

/** The server origin (no /api), for sockets and uploaded files. */
export const SERVER_URL = API_URL.replace(/\/api$/, '');

export const STRIPE_PUBLISHABLE_KEY = extra.stripePublishableKey || '';

export const APP = {
  name: 'Faysha',
  tagline: 'One Destination, Endless Serenity',
  version: Constants.expoConfig?.version || '2.0.0',
  website: 'https://fayshaa.com',
  supportEmail: 'support@fayshaa.com',
};

/** Absolute URL for a file path returned by the API ("/uploads/…"). */
export const fileUrl = (path) => (!path ? null : /^https?:\/\//.test(path) ? path : `${SERVER_URL}${path.startsWith('/') ? '' : '/'}${path}`);

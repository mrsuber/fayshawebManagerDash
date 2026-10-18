// Firebase Configuration for FayshaaWeb
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging } from 'firebase/messaging';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQDLH0RUmVReCqCbAA35spGp3G8RPhmWw",
  authDomain: "fayshaa-5cac6.firebaseapp.com",
  projectId: "fayshaa-5cac6",
  storageBucket: "fayshaa-5cac6.firebasestorage.app",
  messagingSenderId: "4772941120",
  appId: "1:4772941120:web:b956e610dc8fc8813f3ea5",
  measurementId: "G-FS8WBNH9VH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (optional)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Initialize Firebase Cloud Messaging
let messaging = null;
if (typeof window !== 'undefined' && 'Notification' in window) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error('Firebase messaging initialization error:', error);
  }
}

export { app, analytics, messaging };

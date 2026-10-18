// Firebase Cloud Messaging Service Worker
// This file handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBQDLH0RUmVReCqCbAA35spGp3G8RPhmWw",
  authDomain: "fayshaa-5cac6.firebaseapp.com",
  projectId: "fayshaa-5cac6",
  storageBucket: "fayshaa-5cac6.firebasestorage.app",
  messagingSenderId: "4772941120",
  appId: "1:4772941120:web:b956e610dc8fc8813f3ea5",
  measurementId: "G-FS8WBNH9VH"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.tag || 'default',
    requireInteraction: false,
    data: {
      url: payload.data?.url || '/',
      ...payload.data
    },
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : []
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open with this URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle push events (for more control)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);
});

/* Firebase Cloud Messaging service worker: shows push notifications sent by firebase-admin while the tab is in the background.
   The Firebase web config is passed in the registration URL by src/lib/firebase.js (getPushToken). */
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;
firebase.initializeApp(Object.fromEntries(params.entries()));

firebase.messaging().onBackgroundMessage((payload) => {
  const { title = 'FAY OS', body = '' } = payload.notification || {};
  self.registration.showNotification(title, { body, icon: '/logo192.png', data: payload.data });
});

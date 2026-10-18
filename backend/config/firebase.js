// Firebase Admin SDK Configuration
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;
let messaging = null;

/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = () => {
  try {
    // Check if already initialized
    if (firebaseApp) {
      console.log('Firebase Admin SDK already initialized');
      return { app: firebaseApp, messaging };
    }

    // Get service account path from environment variable
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, 'firebase-service-account.json');

    // Check if service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        `Firebase service account file not found at: ${serviceAccountPath}\n` +
        'Please download the service account JSON from Firebase Console and place it in the config directory.'
      );
    }

    // Load service account
    const serviceAccount = require(serviceAccountPath);

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    // Get messaging instance
    messaging = admin.messaging();

    console.log(`✓ Firebase Admin SDK initialized for project: ${serviceAccount.project_id}`);

    return { app: firebaseApp, messaging };
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    throw error;
  }
};

/**
 * Get Firebase Admin instance
 * @returns {admin.app.App} Firebase Admin app instance
 */
const getFirebaseApp = () => {
  if (!firebaseApp) {
    const { app } = initializeFirebase();
    return app;
  }
  return firebaseApp;
};

/**
 * Get Firebase Cloud Messaging instance
 * @returns {admin.messaging.Messaging} Firebase Messaging instance
 */
const getMessaging = () => {
  if (!messaging) {
    const { messaging: msg } = initializeFirebase();
    return msg;
  }
  return messaging;
};

module.exports = {
  admin,
  initializeFirebase,
  getFirebaseApp,
  getMessaging
};

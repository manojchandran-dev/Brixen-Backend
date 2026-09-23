const admin = require('firebase-admin');
const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = require('./index');

const configured = Boolean(FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY);

// Only initialize when credentials are present, so the app still boots (and
// the rest of the API still works) before FIREBASE_* env vars are set.
const messaging = configured
  ? admin
      .initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY,
        }),
      })
      .messaging()
  : {
      sendEachForMulticast() {
        throw new Error(
          'Firebase is not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY'
        );
      },
    };

module.exports = messaging;

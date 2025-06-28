import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Simple health check function
export const healthCheck = functions.https.onRequest((request, response) => {
  response.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Example function for future use
export const processMovement = functions.firestore
  .document('movements/{movementId}')
  .onCreate(async (snap, context) => {
    const movement = snap.data();
    
    console.log('New movement processed:', {
      id: context.params.movementId,
      type: movement.type,
      itemId: movement.itemId,
      timestamp: movement.timestamp
    });

    // Add any movement processing logic here
    return null;
  });
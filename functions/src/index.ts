import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

admin.initializeApp();
const db = admin.firestore();

// Initialize SendGrid with API key from environment
const sendgridKey = functions.config().sendgrid.key;
sgMail.setApiKey(sendgridKey);

interface NotificationData {
  type: 'REORDER_ALERT';
  categoryId: string;
  categoryName: string;
  currentQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  timestamp: FirebaseFirestore.Timestamp;
  status: 'pending' | 'sent' | 'error';
}

export const processKanbanNotifications = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data() as NotificationData;
    
    if (notification.type !== 'REORDER_ALERT' || notification.status !== 'pending') {
      return null;
    }

    try {
      const msg = {
        to: functions.config().notifications.email,
        from: functions.config().notifications.from,
        subject: `Low Stock Alert: ${notification.categoryName}`,
        html: `
          <h2>Low Stock Alert</h2>
          <p>The following item needs attention:</p>
          <ul>
            <li><strong>Category:</strong> ${notification.categoryName}</li>
            <li><strong>Current Quantity:</strong> ${notification.currentQuantity}</li>
            <li><strong>Reorder Point:</strong> ${notification.reorderPoint}</li>
            <li><strong>Recommended Order Quantity:</strong> ${notification.reorderQuantity}</li>
          </ul>
          <p>Please process this reorder request as soon as possible.</p>
        `,
      };

      await sgMail.send(msg);
      
      // Update notification status
      await snap.ref.update({
        status: 'sent',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return null;
    } catch (error) {
      console.error('Error sending notification:', error);
      
      // Update notification with error status
      await snap.ref.update({
        status: 'error',
        error: error.message,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      throw error;
    }
  });
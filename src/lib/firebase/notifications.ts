import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface KanbanNotification {
  category: string;
  currentQuantity: number;
  minQuantity: number;
  reorderPoint: number;
  maxQuantity: number;
  reorderQuantity: number;
}

export async function sendKanbanNotification(data: KanbanNotification) {
  try {
    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      type: 'KANBAN_ALERT',
      ...data,
      timestamp: serverTimestamp(),
      status: 'pending'
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}
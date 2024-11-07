import { collection, query, where, getDocs, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';

export async function getDashboardStats() {
  try {
    // Get total items count using server-side counting
    const itemsCol = collection(db, 'items');
    const itemsSnapshot = await getCountFromServer(itemsCol);
    const totalItems = itemsSnapshot.data().count;

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // Get today's goods in count
    const goodsInQuery = query(
      collection(db, 'movements'),
      where('type', '==', 'IN'),
      where('timestamp', '>=', todayTimestamp)
    );
    const goodsInSnapshot = await getCountFromServer(goodsInQuery);
    const goodsInToday = goodsInSnapshot.data().count;

    // Get today's picks count
    const picksQuery = query(
      collection(db, 'movements'),
      where('type', '==', 'OUT'),
      where('timestamp', '>=', todayTimestamp)
    );
    const picksSnapshot = await getCountFromServer(picksQuery);
    const picksToday = picksSnapshot.data().count;

    return {
      totalItems,
      goodsInToday,
      picksToday
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return default values instead of throwing
    return {
      totalItems: 0,
      goodsInToday: 0,
      picksToday: 0
    };
  }
}
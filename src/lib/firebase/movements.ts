import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCached, setCache, invalidateCache } from './cache';
import type { Movement } from '@/types/warehouse';

const COLLECTION = 'movements';
const CACHE_KEY = 'movements';
const RECENT_MOVEMENTS_LIMIT = 20;

export async function addMovement(movement: Omit<Movement, 'id' | 'timestamp'>) {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...movement,
      timestamp: serverTimestamp(),
    });
    invalidateCache(CACHE_KEY);
    return docRef.id;
  } catch (error) {
    console.error('Error adding movement:', error);
    throw error;
  }
}

export async function getMovements() {
  try {
    const cached = getCached<Movement>(CACHE_KEY);
    if (cached) return cached;

    const q = query(
      collection(db, COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(RECENT_MOVEMENTS_LIMIT)
    );
    const querySnapshot = await getDocs(q);
    const movements = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Movement[];

    setCache(CACHE_KEY, movements);
    return movements;
  } catch (error) {
    console.error('Error getting movements:', error);
    throw error;
  }
}
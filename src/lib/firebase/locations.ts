import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  arrayUnion as firestoreArrayUnion,
  arrayRemove as firestoreArrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCached, setCache, invalidateCache } from './cache';
import { LEVEL_MAX_WEIGHTS } from '../warehouse-logic';
import type { Location } from '@/types/warehouse';

const COLLECTION = 'locations';
const CACHE_KEY = 'locations';

export async function getAvailableLocations(requiredWeight: number) {
  try {
    // Try to filter from cache first
    const cached = getCached<Location>(CACHE_KEY);
    if (cached) {
      return cached.filter(loc => 
        loc.available && 
        loc.verified && 
        (loc.level === '0' || loc.currentWeight + requiredWeight <= loc.maxWeight)
      );
    }

    const q = query(
      collection(db, COLLECTION),
      where('available', '==', true),
      where('verified', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const locations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Location[];

    setCache(CACHE_KEY, locations);
    return locations.filter(loc => 
      loc.level === '0' || loc.currentWeight + requiredWeight <= loc.maxWeight
    );
  } catch (error) {
    console.error('Error getting available locations:', error);
    throw error;
  }
}

export async function addLocation(location: Omit<Location, 'id'>) {
  const maxWeight = location.level === '0' ? Infinity : LEVEL_MAX_WEIGHTS[location.level as keyof typeof LEVEL_MAX_WEIGHTS];
  
  const locationWithDefaults = {
    ...location,
    maxWeight,
    currentWeight: 0,
    available: true,
    verified: true,
    isGroundFull: false,
    stackedItems: [],
  };

  const docRef = await addDoc(collection(db, COLLECTION), locationWithDefaults);
  invalidateCache(CACHE_KEY);
  return docRef.id;
}

export async function updateLocation(id: string, data: Partial<Location>) {
  try {
    const locationRef = doc(db, COLLECTION, id);
    await updateDoc(locationRef, {
      ...data,
      available: data.currentWeight ? data.currentWeight === 0 : true,
      lastUpdated: new Date().toISOString()
    });
    invalidateCache(CACHE_KEY);
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

export async function getLocations() {
  try {
    const cached = getCached<Location>(CACHE_KEY);
    if (cached) return cached;

    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const locations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Ensure ground level locations have proper defaults
      ...(doc.data().level === '0' && {
        maxWeight: Infinity,
        stackedItems: doc.data().stackedItems || [],
        isGroundFull: doc.data().isGroundFull || false
      })
    })) as Location[];

    setCache(CACHE_KEY, locations);
    return locations;
  } catch (error) {
    console.error('Error getting locations:', error);
    throw error;
  }
}

export async function getLocationByCode(code: string) {
  try {
    // Try to find in cache first
    const cached = getCached<Location>(CACHE_KEY);
    if (cached) {
      const location = cached.find(loc => loc.code === code);
      if (location) {
        // Ensure ground level locations have proper defaults
        if (location.level === '0') {
          return {
            ...location,
            maxWeight: Infinity,
            stackedItems: location.stackedItems || [],
            isGroundFull: location.isGroundFull || false
          };
        }
        return location;
      }
    }

    const q = query(
      collection(db, COLLECTION),
      where('code', '==', code)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    const doc = querySnapshot.docs[0];
    const location = {
      id: doc.id,
      ...doc.data(),
      // Ensure ground level locations have proper defaults
      ...(doc.data().level === '0' && {
        maxWeight: Infinity,
        stackedItems: doc.data().stackedItems || [],
        isGroundFull: doc.data().isGroundFull || false
      })
    } as Location;

    return location;
  } catch (error) {
    console.error('Error getting location by code:', error);
    throw error;
  }
}

export async function addItemToGroundLocation(locationId: string, itemId: string) {
  try {
    const locationRef = doc(db, COLLECTION, locationId);
    await updateDoc(locationRef, {
      stackedItems: firestoreArrayUnion(itemId),
      lastUpdated: new Date().toISOString()
    });
    invalidateCache(CACHE_KEY);
  } catch (error) {
    console.error('Error adding item to ground location:', error);
    throw error;
  }
}

export async function removeItemFromGroundLocation(locationId: string, itemId: string) {
  try {
    const locationRef = doc(db, COLLECTION, locationId);
    await updateDoc(locationRef, {
      stackedItems: firestoreArrayRemove(itemId),
      lastUpdated: new Date().toISOString()
    });
    invalidateCache(CACHE_KEY);
  } catch (error) {
    console.error('Error removing item from ground location:', error);
    throw error;
  }
}
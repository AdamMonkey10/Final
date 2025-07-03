import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCached, setCache, invalidateCache } from './cache';
import type { Item } from '@/types/warehouse';

const COLLECTION = 'items';

interface CreateItemData {
  itemCode: string;
  systemCode: string;
  description: string;
  weight?: number;
  category: string;
  status: 'pending' | 'placed' | 'removed';
  metadata?: {
    coilNumber?: string;
    coilLength?: string;
    quantity?: number;
    location?: string;
    lotNumber?: string;
  };
}

export async function addItem(data: CreateItemData): Promise<string> {
  try {
    // Validate required fields
    if (!data.itemCode?.trim() || !data.systemCode?.trim() || !data.category?.trim()) {
      throw new Error('Missing required fields');
    }

    // Validate weight if provided
    if (data.weight !== undefined) {
      if (isNaN(data.weight) || data.weight <= 0) {
        throw new Error('Invalid weight value');
      }
    }

    // Create the item document with all required fields
    const itemData = {
      itemCode: data.itemCode.trim(),
      systemCode: data.systemCode.trim(),
      description: data.description?.trim() || '',
      weight: data.weight || 0,
      category: data.category.trim(),
      status: data.status,
      locationVerified: false,
      metadata: data.metadata || null,
      lastUpdated: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), itemData);
    invalidateCache('items');
    return docRef.id;
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
}

export async function updateItem(id: string, data: Partial<Item>) {
  try {
    if (!id?.trim()) {
      throw new Error('Item ID is required');
    }

    // Validate weight if provided
    if (data.weight !== undefined) {
      if (isNaN(data.weight) || data.weight < 0) {
        throw new Error('Invalid weight value');
      }
    }

    // Validate status if provided
    if (data.status) {
      const validStatuses = ['pending', 'placed', 'removed'];
      if (!validStatuses.includes(data.status)) {
        throw new Error('Invalid status');
      }
    }

    const updateData = {
      ...data,
      lastUpdated: serverTimestamp(),
    };

    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, updateData);
    invalidateCache('items');
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
}

export async function deleteItem(id: string) {
  try {
    if (!id?.trim()) {
      throw new Error('Item ID is required');
    }

    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
    invalidateCache('items');
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
}

export async function getItems() {
  try {
    const cached = getCached<Item>('items');
    if (cached) return cached;

    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];

    setCache('items', items);
    return items;
  } catch (error) {
    console.error('Error getting items:', error);
    throw error;
  }
}

export async function getItemBySystemCode(systemCode: string): Promise<Item | null> {
  try {
    if (!systemCode?.trim()) {
      throw new Error('System code is required');
    }

    console.log('Searching for item with systemCode:', systemCode.trim());

    const q = query(
      collection(db, COLLECTION),
      where('systemCode', '==', systemCode.trim())
    );
    const querySnapshot = await getDocs(q);
    
    console.log('Query results:', querySnapshot.docs.length, 'documents found');
    
    if (querySnapshot.empty) {
      console.log('No item found with systemCode:', systemCode.trim());
      return null;
    }

    const doc = querySnapshot.docs[0];
    const item = {
      id: doc.id,
      ...doc.data(),
    } as Item;
    
    console.log('Found item:', item);
    return item;
  } catch (error) {
    console.error('Error getting item by system code:', error);
    throw error;
  }
}

export async function getItemsByLocation(location: string) {
  try {
    if (!location?.trim()) {
      throw new Error('Location is required');
    }

    console.log('Searching for items at location:', location.trim());

    const q = query(
      collection(db, COLLECTION),
      where('location', '==', location.trim()),
      where('status', '==', 'placed')
    );
    const querySnapshot = await getDocs(q);
    
    console.log('Found', querySnapshot.docs.length, 'items at location:', location.trim());
    
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];
    
    console.log('Items at location:', items);
    return items;
  } catch (error) {
    console.error('Error getting items by location:', error);
    throw error;
  }
}

export async function getItemsByStatus(status: string) {
  try {
    if (!status?.trim()) {
      throw new Error('Status is required');
    }

    const validStatuses = ['pending', 'placed', 'removed'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];
  } catch (error) {
    console.error('Error getting items by status:', error);
    throw error;
  }
}
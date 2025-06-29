import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'operators';

export interface Operator {
  id: string;
  name: string;
  email?: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

const DEFAULT_OPERATORS = [
  { id: 'john-smith', name: 'John Smith', email: 'john.smith@dakin-flathers.com' },
  { id: 'sarah-jones', name: 'Sarah Jones', email: 'sarah.jones@dakin-flathers.com' },
  { id: 'mike-wilson', name: 'Mike Wilson', email: 'mike.wilson@dakin-flathers.com' },
  { id: 'emma-brown', name: 'Emma Brown', email: 'emma.brown@dakin-flathers.com' },
  { id: 'david-taylor', name: 'David Taylor', email: 'david.taylor@dakin-flathers.com' },
];

// Flag to track if operators have been manually managed
const OPERATORS_INITIALIZED_FLAG = 'operators_initialized';

export async function initializeOperators() {
  try {
    const operatorsRef = collection(db, COLLECTION);
    
    // Check if we have any operators (active or inactive)
    const allOperatorsSnapshot = await getDocs(operatorsRef);
    
    // Check if initialization flag exists
    const flagDoc = doc(db, 'system_flags', OPERATORS_INITIALIZED_FLAG);
    const flagSnapshot = await getDocs(query(collection(db, 'system_flags'), where('__name__', '==', OPERATORS_INITIALIZED_FLAG)));
    
    // Only initialize if no operators exist AND no flag exists (first time setup)
    if (allOperatorsSnapshot.empty && flagSnapshot.empty) {
      console.log('First time setup - initializing default operators');
      
      const batch = writeBatch(db);
      
      // Add default operators
      DEFAULT_OPERATORS.forEach(operator => {
        const docRef = doc(operatorsRef, operator.id);
        batch.set(docRef, {
          name: operator.name,
          email: operator.email,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // Set the initialization flag
      batch.set(flagDoc, {
        initialized: true,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      console.log('Default operators initialized');
    } else {
      console.log('Operators already exist or have been manually managed - skipping initialization');
    }
  } catch (error) {
    console.error('Error initializing operators:', error);
  }
}

export async function getOperators(): Promise<Operator[]> {
  try {
    const operatorsRef = collection(db, COLLECTION);
    const q = query(operatorsRef, where('active', '==', true));
    const snapshot = await getDocs(q);

    // If no active operators, don't auto-initialize anymore
    if (snapshot.empty) {
      console.log('No active operators found');
      return [];
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Operator[];
  } catch (error) {
    console.error('Error fetching operators:', error);
    return [];
  }
}

export async function addOperator(name: string, email?: string): Promise<string> {
  try {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const operatorRef = doc(db, COLLECTION, id);
    
    await setDoc(operatorRef, {
      name,
      email: email || '',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return id;
  } catch (error) {
    console.error('Error adding operator:', error);
    throw error;
  }
}

export async function updateOperator(id: string, data: Partial<Operator>): Promise<void> {
  try {
    const operatorRef = doc(db, COLLECTION, id);
    await setDoc(operatorRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating operator:', error);
    throw error;
  }
}

export async function deactivateOperator(id: string): Promise<void> {
  try {
    const operatorRef = doc(db, COLLECTION, id);
    await setDoc(operatorRef, {
      active: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error deactivating operator:', error);
    throw error;
  }
}

export async function deleteOperatorPermanently(id: string): Promise<void> {
  try {
    const operatorRef = doc(db, COLLECTION, id);
    await deleteDoc(operatorRef);
    console.log(`Operator ${id} permanently deleted`);
  } catch (error) {
    console.error('Error permanently deleting operator:', error);
    throw error;
  }
}

// Function to reset operators (for testing purposes)
export async function resetOperators(): Promise<void> {
  try {
    // Delete all operators
    const operatorsRef = collection(db, COLLECTION);
    const snapshot = await getDocs(operatorsRef);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete the initialization flag
    const flagDoc = doc(db, 'system_flags', OPERATORS_INITIALIZED_FLAG);
    batch.delete(flagDoc);

    await batch.commit();
    console.log('All operators and flags reset');
  } catch (error) {
    console.error('Error resetting operators:', error);
    throw error;
  }
}
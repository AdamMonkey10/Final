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

export async function initializeOperators() {
  try {
    const operatorsRef = collection(db, COLLECTION);
    const q = query(operatorsRef, where('active', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const batch = writeBatch(db);
      
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

      await batch.commit();
      console.log('Default operators initialized');
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

    if (snapshot.empty) {
      await initializeOperators();
      return DEFAULT_OPERATORS.map(op => ({ ...op, active: true }));
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Operator[];
  } catch (error) {
    console.error('Error fetching operators:', error);
    return DEFAULT_OPERATORS.map(op => ({ ...op, active: true }));
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
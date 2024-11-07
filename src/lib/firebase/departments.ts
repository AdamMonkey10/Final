import { collection, getDocs, query, where, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULT_DEPARTMENTS = [
  { id: 'Milling', name: 'Milling' },
  { id: 'Grinding', name: 'Grinding' },
  { id: 'Maintenance', name: 'Maintenance' },
  { id: 'Bandknife', name: 'Bandknife' },
  { id: 'Welding', name: 'Welding' },
];

export async function initializeDepartments() {
  const departmentsRef = collection(db, 'departments');
  const q = query(departmentsRef, where('active', '==', true));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    const batch = writeBatch(db);
    
    DEFAULT_DEPARTMENTS.forEach(dept => {
      const docRef = doc(departmentsRef, dept.id);
      batch.set(docRef, {
        name: dept.name,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
}

export async function getDepartments() {
  try {
    const departmentsRef = collection(db, 'departments');
    const q = query(departmentsRef, where('active', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      await initializeDepartments();
      return DEFAULT_DEPARTMENTS;
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));
  } catch (error) {
    console.error('Error fetching departments:', error);
    return DEFAULT_DEPARTMENTS;
  }
}

export async function addDepartment(id: string, name: string) {
  try {
    const departmentsRef = collection(db, 'departments');
    const docRef = doc(departmentsRef, id);
    await setDoc(docRef, {
      name,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error('Error adding department:', error);
    throw error;
  }
}

export async function updateDepartment(id: string, name: string) {
  try {
    const docRef = doc(db, 'departments', id);
    await setDoc(docRef, {
      name,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
}

export async function deactivateDepartment(id: string) {
  try {
    const docRef = doc(db, 'departments', id);
    await setDoc(docRef, {
      active: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error deactivating department:', error);
    throw error;
  }
}
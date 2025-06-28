import { 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const COLLECTION = 'users';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  lastLogin?: Date;
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  console.log('🔐 Attempting login for:', email);
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    console.log('✅ Authentication successful:', {
      uid: firebaseUser.uid,
      email: firebaseUser.email
    });

    // Try to update user data in Firestore (non-blocking)
    try {
      const userRef = doc(db, COLLECTION, firebaseUser.uid);
      await setDoc(userRef, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (firestoreError) {
      console.warn('Could not update Firestore user data:', firestoreError);
      // Don't fail login for Firestore errors
    }

    const user: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || undefined,
      lastLogin: new Date()
    };

    return user;
  } catch (error: any) {
    console.error('❌ Login failed:', error);
    
    // Provide user-friendly error messages
    switch (error.code) {
      case 'auth/user-not-found':
        throw new Error('No account found with this email address.');
      case 'auth/wrong-password':
        throw new Error('Incorrect password.');
      case 'auth/invalid-email':
        throw new Error('Invalid email address.');
      case 'auth/user-disabled':
        throw new Error('This account has been disabled.');
      case 'auth/too-many-requests':
        throw new Error('Too many failed login attempts. Please try again later.');
      case 'auth/network-request-failed':
        throw new Error('Network error. Please check your internet connection.');
      case 'auth/invalid-credential':
        throw new Error('Invalid email or password.');
      default:
        throw new Error(`Login failed: ${error.message}`);
    }
  }
}

export async function verifySetupUser(username: string, password: string, currentUser: User | null): Promise<boolean> {
  console.log('🔧 Checking setup access for:', currentUser?.email);
  
  // Team2 fallback credentials
  if (username === 'Team2' && password === 'Team2') {
    console.log('✅ Team2 credentials accepted');
    return true;
  }

  // Check if current user is admin
  if (currentUser) {
    // Admin emails and UIDs
    const adminEmails = [
      'Carl.Jukes@dakin-flathers.com',
      'carl.jukes@dakin-flathers.com'
    ];
    
    const adminUIDs = [
      'GRkjeVQpVvVgu9EwMAJIwPzZ03M2' // Your actual UID
    ];
    
    if (adminEmails.includes(currentUser.email.toLowerCase()) || adminUIDs.includes(currentUser.uid)) {
      console.log('✅ Admin access granted for:', currentUser.email);
      return true;
    }
  }

  console.log('❌ Setup access denied');
  return false;
}

export async function createUser(email: string, password: string): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const user: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || undefined,
      lastLogin: new Date()
    };

    // Save to Firestore
    const userRef = doc(db, COLLECTION, firebaseUser.uid);
    await setDoc(userRef, {
      email: firebaseUser.email,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });

    return user;
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function addUser(email: string, password: string): Promise<void> {
  try {
    await createUser(email, password);
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

export async function deleteUser(email: string): Promise<void> {
  try {
    // Note: This only removes from Firestore, not Firebase Auth
    // In production, you'd need Firebase Admin SDK to delete auth users
    const userRef = doc(db, COLLECTION, email);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const users = querySnapshot.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email || doc.id,
      displayName: doc.data().displayName,
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[];

    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
}

export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export function getCurrentUser(): User | null {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || undefined,
    lastLogin: new Date()
  };
}
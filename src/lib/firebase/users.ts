import { 
  signInWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const COLLECTION = 'users';
const SETUP_COLLECTION = 'setup_users';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  lastLogin?: Date;
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Update last login in Firestore
    try {
      const userRef = doc(db, COLLECTION, firebaseUser.uid);
      await setDoc(userRef, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (firestoreError) {
      console.warn('Could not update user data in Firestore:', firestoreError);
      // Continue with login even if Firestore update fails
    }

    const user: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || undefined,
      lastLogin: new Date()
    };

    return user;
  } catch (error: any) {
    console.error('Error verifying user:', error);
    
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
      default:
        throw new Error('Login failed. Please check your credentials and try again.');
    }
  }
}

export async function verifySetupUser(username: string, password: string, currentUser: User | null): Promise<boolean> {
  try {
    console.log('Verifying setup user:', { username, currentUser: currentUser?.email });
    
    // Check if it's the Team2 setup user
    if (username === 'Team2' && password === 'Team2') {
      console.log('Team2 credentials verified');
      return true;
    }

    // Check if current user has setup access
    if (currentUser) {
      console.log('Checking admin access for user:', currentUser.email);
      
      // Admin users (you can customize this logic)
      const adminEmails = [
        'Carl.Jukes@dakin-flathers.com',
        'carl.jukes@dakin-flathers.com' // Add lowercase version just in case
      ];
      
      if (adminEmails.includes(currentUser.email.toLowerCase())) {
        console.log('Admin email verified:', currentUser.email);
        return true;
      }
    }

    // Check setup users collection
    try {
      console.log('Checking setup_users collection for:', username);
      const userRef = doc(db, SETUP_COLLECTION, username);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log('Setup user not found in collection:', username);
        return false;
      }

      const userData = userDoc.data();
      console.log('Setup user data found:', { username, hasPassword: !!userData.password });
      
      if (userData.password === password) {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp()
        });
        console.log('Setup user verified successfully');
        return true;
      }
    } catch (firestoreError) {
      console.warn('Error checking setup_users collection:', firestoreError);
    }

    console.log('Setup verification failed, falling back to Team2 check');
    return false;
  } catch (error) {
    console.error('Error verifying setup user:', error);
    
    // Fallback to Team2 credentials
    if (username === 'Team2' && password === 'Team2') {
      console.log('Fallback to Team2 credentials successful');
      return true;
    }
    
    return false;
  }
}

export async function addUser(email: string, password: string): Promise<void> {
  try {
    // Note: This would typically be done through Firebase Admin SDK on the server
    // For now, we'll just add to our users collection
    const userRef = doc(db, COLLECTION, email);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      throw new Error('User already exists');
    }

    await setDoc(userRef, {
      email,
      createdAt: serverTimestamp(),
      lastLogin: null
    });
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

export async function deleteUser(email: string): Promise<void> {
  try {
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
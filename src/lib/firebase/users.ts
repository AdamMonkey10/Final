import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
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

let currentUser: User | null = null;

export function getCurrentUser(): User | null {
  return currentUser;
}

export function setCurrentUser(user: User | null): void {
  currentUser = user;
}

// Listen for auth state changes
onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
  if (firebaseUser) {
    const user: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || undefined,
      lastLogin: new Date()
    };
    setCurrentUser(user);
  } else {
    setCurrentUser(null);
  }
});

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

    setCurrentUser(user);
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

export async function verifySetupUser(username: string, password: string): Promise<boolean> {
  try {
    // Check if it's the Team2 setup user
    if (username === 'Team2' && password === 'Team2') {
      return true;
    }

    // Check if current user has setup access
    if (currentUser) {
      // Admin users (you can customize this logic)
      const adminEmails = ['Carl.Jukes@dakin-flathers.com'];
      if (adminEmails.includes(currentUser.email)) {
        return true;
      }
    }

    // Check setup users collection
    const userRef = doc(db, SETUP_COLLECTION, username);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();
    if (userData.password === password) {
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error verifying setup user:', error);
    
    // Fallback to Team2 credentials
    if (username === 'Team2' && password === 'Team2') {
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
    setCurrentUser(null);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}
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
  console.log('🔐 Starting user verification:', { email, passwordLength: password.length });
  
  try {
    console.log('🚀 Attempting Firebase authentication');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    console.log('✅ Firebase authentication successful:', {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      emailVerified: firebaseUser.emailVerified
    });

    // Update last login in Firestore
    try {
      console.log('💾 Updating user data in Firestore');
      const userRef = doc(db, COLLECTION, firebaseUser.uid);
      await setDoc(userRef, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log('✅ Firestore user data updated successfully');
    } catch (firestoreError) {
      console.warn('⚠️ Could not update user data in Firestore:', firestoreError);
      // Continue with login even if Firestore update fails
    }

    const user: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || undefined,
      lastLogin: new Date()
    };

    console.log('✅ User verification complete:', user);
    return user;
  } catch (error: any) {
    console.error('❌ User verification failed:', {
      error: error.message,
      code: error.code,
      fullError: error
    });
    
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
  console.log('🔧 Verifying setup user:', { 
    username, 
    hasPassword: !!password,
    currentUser: currentUser?.email 
  });
  
  try {
    // Check if it's the Team2 setup user
    if (username === 'Team2' && password === 'Team2') {
      console.log('✅ Team2 credentials verified');
      return true;
    }

    // Check if current user has setup access
    if (currentUser) {
      console.log('👤 Checking admin access for user:', currentUser.email);
      
      // Admin users (you can customize this logic)
      const adminEmails = [
        'Carl.Jukes@dakin-flathers.com',
        'carl.jukes@dakin-flathers.com' // Add lowercase version just in case
      ];
      
      if (adminEmails.includes(currentUser.email.toLowerCase())) {
        console.log('✅ Admin email verified:', currentUser.email);
        return true;
      } else {
        console.log('❌ Email not in admin list:', currentUser.email);
      }
    }

    // Check setup users collection
    try {
      console.log('📚 Checking setup_users collection for:', username);
      const userRef = doc(db, SETUP_COLLECTION, username);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log('❌ Setup user not found in collection:', username);
        return false;
      }

      const userData = userDoc.data();
      console.log('📄 Setup user data found:', { 
        username, 
        hasPassword: !!userData.password,
        passwordMatch: userData.password === password
      });
      
      if (userData.password === password) {
        console.log('✅ Setup user password verified');
        await updateDoc(userRef, {
          lastLogin: serverTimestamp()
        });
        console.log('💾 Setup user last login updated');
        return true;
      } else {
        console.log('❌ Setup user password mismatch');
      }
    } catch (firestoreError) {
      console.warn('⚠️ Error checking setup_users collection:', firestoreError);
    }

    console.log('❌ Setup verification failed, no valid credentials found');
    return false;
  } catch (error) {
    console.error('❌ Error verifying setup user:', error);
    
    // Fallback to Team2 credentials
    if (username === 'Team2' && password === 'Team2') {
      console.log('✅ Fallback to Team2 credentials successful');
      return true;
    }
    
    return false;
  }
}

export async function addUser(email: string, password: string): Promise<void> {
  console.log('👤 Adding user:', { email });
  
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
    
    console.log('✅ User added successfully:', email);
  } catch (error) {
    console.error('❌ Error adding user:', error);
    throw error;
  }
}

export async function deleteUser(email: string): Promise<void> {
  console.log('🗑️ Deleting user:', { email });
  
  try {
    const userRef = doc(db, COLLECTION, email);
    await deleteDoc(userRef);
    console.log('✅ User deleted successfully:', email);
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  console.log('📋 Fetching users list');
  
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const users = querySnapshot.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email || doc.id,
      displayName: doc.data().displayName,
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[];

    console.log('✅ Users fetched successfully:', { count: users.length });
    return users;
  } catch (error) {
    console.error('❌ Error getting users:', error);
    return [];
  }
}

export async function logout(): Promise<void> {
  console.log('🚪 Logging out user');
  
  try {
    await signOut(auth);
    console.log('✅ User logged out successfully');
  } catch (error) {
    console.error('❌ Error signing out:', error);
    throw error;
  }
}

export function getCurrentUser(): User | null {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    console.log('❌ No current user found');
    return null;
  }
  
  const user = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || undefined,
    lastLogin: new Date()
  };
  
  console.log('👤 Current user:', user);
  return user;
}
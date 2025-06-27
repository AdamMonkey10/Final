import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'users';
const SETUP_COLLECTION = 'setup_users';

export interface User {
  username: string;
  password: string;
  lastLogin?: Date;
}

let currentUser: User | null = null;

// Default users for immediate access
const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123' },
  { username: 'warehouse', password: 'warehouse123' },
  { username: 'operator', password: 'operator123' }
];

export function getCurrentUser(): User | null {
  if (!currentUser) {
    const storedUser = localStorage.getItem('wareflow_user');
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
    }
  }
  return currentUser;
}

export function setCurrentUser(user: User | null): void {
  currentUser = user;
  if (user) {
    localStorage.setItem('wareflow_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('wareflow_user');
  }
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  try {
    // Check default users first
    const defaultUser = DEFAULT_USERS.find(u => 
      u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    
    if (defaultUser) {
      const user = {
        username: defaultUser.username,
        password: defaultUser.password,
        lastLogin: new Date()
      };
      setCurrentUser(user);
      return user;
    }

    // Check Firebase users
    const userRef = doc(db, COLLECTION, username);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const userData = userDoc.data() as User;
    if (userData.password === password) {
      // Update last login
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });

      const user = {
        username,
        password: userData.password,
        lastLogin: new Date()
      };

      setCurrentUser(user);
      return user;
    }

    return null;
  } catch (error) {
    console.error('Error verifying user:', error);
    
    // Fallback to default users if Firebase fails
    const defaultUser = DEFAULT_USERS.find(u => 
      u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    
    if (defaultUser) {
      const user = {
        username: defaultUser.username,
        password: defaultUser.password,
        lastLogin: new Date()
      };
      setCurrentUser(user);
      return user;
    }
    
    throw error;
  }
}

export async function verifySetupUser(username: string, password: string): Promise<boolean> {
  try {
    // Check if it's the default setup user
    if (username === 'Team2' && password === 'Team2') {
      return true;
    }

    // Check admin user
    if (username === 'admin' && password === 'admin123') {
      return true;
    }

    const userRef = doc(db, SETUP_COLLECTION, username);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data() as User;
    if (userData.password === password) {
      // Update last login
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error verifying setup user:', error);
    
    // Fallback to default credentials
    if (username === 'Team2' && password === 'Team2') {
      return true;
    }
    if (username === 'admin' && password === 'admin123') {
      return true;
    }
    
    return false;
  }
}

export async function addUser(username: string, password: string): Promise<void> {
  try {
    const userRef = doc(db, COLLECTION, username);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      throw new Error('Username already exists');
    }

    await setDoc(userRef, {
      username,
      password,
      createdAt: serverTimestamp(),
      lastLogin: null
    });
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

export async function deleteUser(username: string): Promise<void> {
  try {
    const userRef = doc(db, COLLECTION, username);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const firebaseUsers = querySnapshot.docs.map(doc => ({
      ...doc.data(),
      username: doc.id
    })) as User[];

    // Combine with default users
    const allUsers = [
      ...DEFAULT_USERS.map(user => ({ ...user, lastLogin: undefined })),
      ...firebaseUsers
    ];

    return allUsers;
  } catch (error) {
    console.error('Error getting users:', error);
    // Return default users if Firebase fails
    return DEFAULT_USERS.map(user => ({ ...user, lastLogin: undefined }));
  }
}

export function logout(): void {
  setCurrentUser(null);
}
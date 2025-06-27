import { initializeApp } from 'firebase/app';
import { initializeFirestore, CACHE_SIZE_UNLIMITED, enableIndexedDbPersistence, PersistenceSettings } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCp-1-XTYp0DIOhpmuFp7H7T_rAWOn1Fso",
  authDomain: "warehouse-fe109.firebaseapp.com",
  projectId: "warehouse-fe109",
  storageBucket: "warehouse-fe109.firebasestorage.app",
  messagingSenderId: "697627361154",
  appId: "1:697627361154:web:8662b7502569865539599b",
  measurementId: "G-8DV56PNG14"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings optimized for offline support
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true,
});

// Initialize Functions
const functions = getFunctions(app);

// Enable offline persistence with enhanced error handling
if (typeof window !== 'undefined') {
  const persistenceSettings: PersistenceSettings = {
    synchronizeTabs: true
  };

  enableIndexedDbPersistence(db, persistenceSettings).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firebase persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firebase persistence not supported in this browser');
    }
  });
}

// Initialize Analytics only in browser environment
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { db, analytics, functions };
export default app;
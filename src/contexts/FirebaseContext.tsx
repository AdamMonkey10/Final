import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { toast } from 'sonner';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  lastLogin?: Date;
}

interface FirebaseContextType {
  loading: boolean;
  isInitialized: boolean;
  isOnline: boolean;
  error: Error | null;
  user: User | null;
  authLoading: boolean;
  reconnect: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType>({
  loading: true,
  isInitialized: false,
  isOnline: true,
  error: null,
  user: null,
  authLoading: true,
  reconnect: async () => {},
});

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState<Error | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Monitor authentication state
  useEffect(() => {
    console.log('🔥 Setting up Firebase auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      console.log('🔐 Auth state changed:', firebaseUser ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified
      } : 'No user');

      if (firebaseUser) {
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          lastLogin: new Date()
        };
        setUser(userData);
      } else {
        setUser(null);
      }
      
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setError(null);
      toast.success('Back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Working offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Firebase connection
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        setLoading(true);
        console.log('🚀 Testing Firebase connection');
        
        // Simple connection test
        await getDocs(collection(db, 'test'));
        
        console.log('✅ Firebase connection successful');
        setIsInitialized(true);
        setError(null);
      } catch (err: any) {
        console.error('❌ Firebase connection failed:', err);
        setError(err);
        
        // Don't show error toast for offline scenarios
        if (err.code !== 'unavailable') {
          toast.error('Firebase connection failed');
        }
      } finally {
        setLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  // Function to manually attempt reconnection
  const reconnect = async () => {
    try {
      setLoading(true);
      await getDocs(collection(db, 'test'));
      setIsOnline(true);
      setError(null);
      toast.success('Successfully reconnected');
    } catch (err: any) {
      setError(err);
      toast.error('Reconnection failed');
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while initializing
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {authLoading ? 'Checking authentication...' : 'Connecting to Firebase...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider 
      value={{ 
        loading, 
        isInitialized, 
        isOnline, 
        error, 
        user,
        authLoading,
        reconnect 
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
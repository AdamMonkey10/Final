import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { enableNetwork } from 'firebase/firestore';
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
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Monitor authentication state with enhanced logging
  useEffect(() => {
    console.log('🔥 Firebase Context - Setting up auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      console.log('🔐 Auth state changed:', {
        firebaseUser: firebaseUser ? {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          emailVerified: firebaseUser.emailVerified
        } : null,
        timestamp: new Date().toISOString()
      });

      if (firebaseUser) {
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          lastLogin: new Date()
        };
        console.log('✅ Setting user data:', userData);
        setUser(userData);
      } else {
        console.log('❌ No user, clearing user data');
        setUser(null);
      }
      
      console.log('🔄 Setting authLoading to false');
      setAuthLoading(false);
    }, (error) => {
      console.error('❌ Auth state change error:', error);
      setAuthLoading(false);
    });

    return () => {
      console.log('🧹 Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    console.log('🌐 Setting up online/offline listeners');
    
    const handleOnline = () => {
      console.log('✅ Connection restored');
      setIsOnline(true);
      toast.success('Back online');
    };

    const handleOffline = () => {
      console.log('❌ Connection lost');
      setIsOnline(false);
      toast.warning('Working offline', {
        description: 'Changes will sync when connection is restored'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      console.log('🧹 Cleaning up online/offline listeners');
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Firebase and set up connection monitoring
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeFirebase = async () => {
      console.log('🚀 Initializing Firebase connection');
      
      try {
        setLoading(true);
        
        // Set up a real-time listener for connection state
        console.log('📡 Setting up connection test listener');
        unsubscribe = onSnapshot(
          collection(db, '__connectionTest__'),
          () => {
            console.log('✅ Connection test successful');
            setIsOnline(true);
            setError(null);
          },
          (error) => {
            console.error('❌ Connection test failed:', error);
            if (error.code === 'unavailable') {
              setIsOnline(false);
              toast.warning('Connection lost', {
                description: 'Working offline. Changes will sync when connection is restored.'
              });
            }
          }
        );

        // Test initial connection
        console.log('🧪 Testing initial connection');
        await getDocs(collection(db, 'test_connection'));
        console.log('✅ Initial connection test successful');
        
        setIsInitialized(true);
        setError(null);

      } catch (err) {
        console.error('❌ Firebase initialization failed:', err);
        const error = err instanceof Error ? err : new Error('Failed to initialize Firebase');
        setError(error);
        
        if (err.code === 'unavailable') {
          console.log('📴 Setting offline mode');
          setIsOnline(false);
          toast.warning('Working offline', {
            description: 'Changes will sync when connection is restored'
          });
        }
      } finally {
        console.log('🏁 Firebase initialization complete, setting loading to false');
        setLoading(false);
      }
    };

    initializeFirebase();

    return () => {
      console.log('🧹 Cleaning up Firebase initialization');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Function to manually attempt reconnection
  const reconnect = async () => {
    console.log('🔄 Manual reconnection attempt');
    try {
      setLoading(true);
      await enableNetwork(db);
      await getDocs(collection(db, 'test_connection'));
      setIsOnline(true);
      setError(null);
      console.log('✅ Reconnection successful');
      toast.success('Successfully reconnected');
    } catch (err) {
      console.error('❌ Reconnection failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to reconnect'));
      toast.error('Reconnection failed', {
        description: 'Please check your internet connection'
      });
    } finally {
      setLoading(false);
    }
  };

  // Log current state periodically for debugging
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('📊 Firebase Context State:', {
        loading,
        isInitialized,
        isOnline,
        error: error?.message,
        user: user ? { uid: user.uid, email: user.email } : null,
        authLoading,
        timestamp: new Date().toISOString()
      });
    }, 10000); // Log every 10 seconds

    return () => clearInterval(interval);
  }, [loading, isInitialized, isOnline, error, user, authLoading]);

  // Show loading screen while both Firebase and auth are initializing
  if (loading || authLoading) {
    console.log('⏳ Showing loading screen:', { loading, authLoading });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isOnline ? 'Initializing...' : 'Working offline...'}
          </p>
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <div>Firebase: {loading ? 'Loading' : 'Ready'}</div>
            <div>Auth: {authLoading ? 'Loading' : 'Ready'}</div>
            <div>Online: {isOnline ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isOnline) {
    console.log('🔌 Showing offline error screen');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">Working Offline</p>
          <p className="text-sm text-muted-foreground">
            Changes will sync when connection is restored
          </p>
          <button
            onClick={reconnect}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Reconnecting
          </button>
          <div className="text-xs text-muted-foreground">
            Error: {error.message}
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ Firebase Context ready, rendering children');

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
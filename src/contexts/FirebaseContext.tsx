import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { toast } from 'sonner';

interface FirebaseContextType {
  loading: boolean;
  isInitialized: boolean;
  isOnline: boolean;
  error: Error | null;
  reconnect: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType>({
  loading: true,
  isInitialized: false,
  isOnline: true,
  error: null,
  reconnect: async () => {},
});

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Working offline', {
        description: 'Changes will sync when connection is restored'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Firebase and set up connection monitoring
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeFirebase = async () => {
      try {
        setLoading(true);
        
        // Set up a real-time listener for connection state
        unsubscribe = onSnapshot(
          collection(db, '__connectionTest__'),
          () => {
            setIsOnline(true);
            setError(null);
          },
          (error) => {
            if (error.code === 'unavailable') {
              setIsOnline(false);
              toast.warning('Connection lost', {
                description: 'Working offline. Changes will sync when connection is restored.'
              });
            }
          }
        );

        // Test initial connection
        await getDocs(collection(db, 'test_connection'));
        setIsInitialized(true);
        setError(null);

      } catch (err) {
        console.error('Error initializing Firebase:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize Firebase'));
        
        if (err.code === 'unavailable') {
          setIsOnline(false);
          toast.warning('Working offline', {
            description: 'Changes will sync when connection is restored'
          });
        }
      } finally {
        setLoading(false);
      }
    };

    initializeFirebase();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Function to manually attempt reconnection
  const reconnect = async () => {
    try {
      setLoading(true);
      await enableNetwork(db);
      await getDocs(collection(db, 'test_connection'));
      setIsOnline(true);
      setError(null);
      toast.success('Successfully reconnected');
    } catch (err) {
      console.error('Reconnection failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to reconnect'));
      toast.error('Reconnection failed', {
        description: 'Please check your internet connection'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isOnline ? 'Initializing...' : 'Working offline...'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !isOnline) {
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
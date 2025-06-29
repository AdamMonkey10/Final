import { createContext, useContext, useState, useEffect } from 'react';
import { getOperators, initializeOperators } from '@/lib/firebase/operators';
import { useFirebase } from './FirebaseContext';
import type { Operator } from '@/lib/firebase/operators';

interface OperatorContextType {
  operators: Operator[];
  selectedOperator: Operator | null;
  setSelectedOperator: (operator: Operator | null) => void;
  loading: boolean;
  refreshOperators: () => Promise<void>;
}

const OperatorContext = createContext<OperatorContextType>({
  operators: [],
  selectedOperator: null,
  setSelectedOperator: () => {},
  loading: true,
  refreshOperators: async () => {},
});

export function OperatorProvider({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useFirebase();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOperators = async () => {
    if (!user || authLoading) return;
    
    try {
      setLoading(true);
      await initializeOperators();
      const fetchedOperators = await getOperators();
      setOperators(fetchedOperators);
      
      // If selected operator no longer exists, clear selection
      if (selectedOperator && !fetchedOperators.find(op => op.id === selectedOperator.id)) {
        setSelectedOperator(null);
      }
      
      // Auto-select first operator if none selected and operators exist
      if (!selectedOperator && fetchedOperators.length > 0) {
        setSelectedOperator(fetchedOperators[0]);
      }
    } catch (error) {
      console.error('Error loading operators:', error);
      // Clear operators on error
      setOperators([]);
      setSelectedOperator(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      refreshOperators();
    }
  }, [user, authLoading]);

  // Set up periodic refresh to catch external changes
  useEffect(() => {
    if (!user || authLoading) return;

    const interval = setInterval(() => {
      refreshOperators();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user, authLoading]);

  return (
    <OperatorContext.Provider 
      value={{ 
        operators, 
        selectedOperator, 
        setSelectedOperator, 
        loading,
        refreshOperators
      }}
    >
      {children}
    </OperatorContext.Provider>
  );
}

export function useOperator() {
  const context = useContext(OperatorContext);
  if (context === undefined) {
    throw new Error('useOperator must be used within an OperatorProvider');
  }
  return context;
}
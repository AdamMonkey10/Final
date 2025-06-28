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
      
      // Auto-select first operator if none selected
      if (!selectedOperator && fetchedOperators.length > 0) {
        setSelectedOperator(fetchedOperators[0]);
      }
    } catch (error) {
      console.error('Error loading operators:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      refreshOperators();
    }
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
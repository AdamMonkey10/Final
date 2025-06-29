import { createContext, useContext, useState, useEffect } from 'react';

interface InstructionsContextType {
  showInstructions: boolean;
  toggleInstructions: () => void;
}

const InstructionsContext = createContext<InstructionsContextType>({
  showInstructions: true,
  toggleInstructions: () => {},
});

export function InstructionsProvider({ children }: { children: React.ReactNode }) {
  const [showInstructions, setShowInstructions] = useState(() => {
    const saved = localStorage.getItem('wareflow-show-instructions');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleInstructions = () => {
    const newValue = !showInstructions;
    setShowInstructions(newValue);
    localStorage.setItem('wareflow-show-instructions', JSON.stringify(newValue));
  };

  useEffect(() => {
    localStorage.setItem('wareflow-show-instructions', JSON.stringify(showInstructions));
  }, [showInstructions]);

  return (
    <InstructionsContext.Provider value={{ showInstructions, toggleInstructions }}>
      {children}
    </InstructionsContext.Provider>
  );
}

export function useInstructions() {
  const context = useContext(InstructionsContext);
  if (context === undefined) {
    throw new Error('useInstructions must be used within an InstructionsProvider');
  }
  return context;
}
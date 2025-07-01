import { createContext, useContext } from 'react';

interface InstructionsContextType {
  showInstructions: boolean;
  toggleInstructions: () => void;
}

const InstructionsContext = createContext<InstructionsContextType>({
  showInstructions: false,
  toggleInstructions: () => {},
});

export function InstructionsProvider({ children }: { children: React.ReactNode }) {
  // Always return false for showInstructions
  const showInstructions = false;
  const toggleInstructions = () => {
    // Do nothing - instructions are disabled
  };

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
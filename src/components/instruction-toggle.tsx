import { Button } from '@/components/ui/button';
import { HelpCircle, Eye, EyeOff } from 'lucide-react';
import { useInstructions } from '@/contexts/InstructionsContext';

export function InstructionToggle() {
  const { showInstructions, toggleInstructions } = useInstructions();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleInstructions}
      className="flex items-center gap-2"
    >
      <HelpCircle className="h-4 w-4" />
      {showInstructions ? (
        <>
          <EyeOff className="h-4 w-4" />
          Hide Help
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          Show Help
        </>
      )}
    </Button>
  );
}
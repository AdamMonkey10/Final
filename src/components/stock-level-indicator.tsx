import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface StockLevelIndicatorProps {
  rules: {
    currentQuantity: number;
    minQuantity: number;
    maxQuantity: number;
    reorderPoint: number;
  };
  showToast?: boolean;
}

export function StockLevelIndicator({ rules, showToast }: StockLevelIndicatorProps) {
  const percentage = (rules.currentQuantity / rules.maxQuantity) * 100;
  
  useEffect(() => {
    if (showToast) {
      if (rules.currentQuantity <= rules.minQuantity) {
        toast.error('Critical Stock Level', {
          description: `Current stock (${rules.currentQuantity}) is below minimum (${rules.minQuantity})`,
        });
      } else if (rules.currentQuantity <= rules.reorderPoint) {
        toast.warning('Reorder Point Reached', {
          description: `Current stock (${rules.currentQuantity}) has reached reorder point (${rules.reorderPoint})`,
        });
      }
    }
  }, [rules.currentQuantity, rules.minQuantity, rules.reorderPoint, showToast]);

  const getStatusColor = () => {
    if (rules.currentQuantity <= rules.minQuantity) return 'bg-destructive';
    if (rules.currentQuantity <= rules.reorderPoint) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (rules.currentQuantity <= rules.minQuantity) return 'Low Stock';
    if (rules.currentQuantity <= rules.reorderPoint) return 'Reorder Soon';
    return 'In Stock';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>Current Stock Level</span>
        <Badge 
          variant="outline" 
          className={cn(
            'font-medium',
            rules.currentQuantity <= rules.minQuantity ? 'bg-red-100 text-red-800' :
            rules.currentQuantity <= rules.reorderPoint ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          )}
        >
          {getStatusText()}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Progress 
          value={percentage} 
          className="flex-1"
          indicatorColor={getStatusColor()}
        />
        <span className="text-sm font-medium min-w-[80px] text-right">
          {rules.currentQuantity} / {rules.maxQuantity}
        </span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Min: {rules.minQuantity}</span>
        <span>Reorder at: {rules.reorderPoint}</span>
      </div>
    </div>
  );
}
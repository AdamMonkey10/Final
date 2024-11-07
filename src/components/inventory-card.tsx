import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListPlus } from 'lucide-react';
import type { Item } from '@/types/warehouse';

interface InventoryCardProps {
  item: Item;
  onAddToList: (item: Item) => void;
}

export function InventoryCard({ item, onAddToList }: InventoryCardProps) {
  const getCategoryBadge = (category: string) => {
    const styles = {
      raw: 'bg-blue-100 text-blue-800',
      finished: 'bg-green-100 text-green-800',
      packaging: 'bg-yellow-100 text-yellow-800',
      spare: 'bg-purple-100 text-purple-800',
    }[category] || 'bg-gray-100 text-gray-800';

    const labels = {
      raw: 'Raw Materials',
      finished: 'Finished Goods',
      packaging: 'Packaging',
      spare: 'Spare Parts',
    }[category] || category;

    return (
      <Badge variant="outline" className={styles}>
        {labels}
      </Badge>
    );
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          <div>
            <h4 className="font-semibold">{item.itemCode}</h4>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Category:</span>
              <div className="mt-1">{getCategoryBadge(item.category)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Location:</span>
              <div className="mt-1">{item.location || '—'}</div>
            </div>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Weight:</span>
            <div className="mt-1 font-medium">{item.weight}kg</div>
          </div>

          <Button
            variant="outline"
            onClick={() => onAddToList(item)}
            className="w-full flex items-center justify-center gap-2"
          >
            <ListPlus className="h-4 w-4" />
            Add to List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Location } from '@/types/warehouse';

interface LocationSelectorProps {
  locations: Location[];
  onLocationSelect: (location: Location) => void;
}

export function LocationSelector({ locations, onLocationSelect }: LocationSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
      {locations.map((location) => (
        <Card 
          key={location.code}
          className={cn(
            "cursor-pointer hover:border-primary transition-colors",
            location.currentWeight >= location.maxWeight && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => {
            if (location.currentWeight < location.maxWeight) {
              onLocationSelect(location);
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">{location.code}</div>
                <div className="text-sm text-muted-foreground">
                  Row {location.row}, Bay {location.bay}, Level {location.level}
                </div>
              </div>
              <Badge variant="outline" className={
                location.currentWeight >= location.maxWeight
                  ? 'bg-red-100 text-red-800'
                  : location.currentWeight > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }>
                {location.currentWeight >= location.maxWeight
                  ? 'Full'
                  : location.currentWeight > 0
                  ? 'In Use'
                  : 'Empty'}
              </Badge>
            </div>
            <div className="mt-4">
              <div className="text-sm text-muted-foreground">Weight Capacity:</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ 
                      width: `${Math.min(100, (location.currentWeight / location.maxWeight) * 100)}%` 
                    }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {location.currentWeight}/{location.maxWeight}kg
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
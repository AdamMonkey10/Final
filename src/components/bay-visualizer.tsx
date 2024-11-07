import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Location } from '@/types/warehouse';

interface BayVisualizerProps {
  location: Location;
  onConfirm: () => void;
  mode: 'place' | 'pick' | 'view';
}

export function BayVisualizer({ location, onConfirm, mode }: BayVisualizerProps) {
  const [flash, setFlash] = useState(true);

  // Parse location code (format: A01-2-3)
  const [rowBay, level, position] = location.code.split('-');

  // Flash effect
  useEffect(() => {
    const interval = setInterval(() => {
      setFlash(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 text-lg">
          <MapPin className="h-5 w-5" />
          Bay {rowBay}
        </Badge>
      </div>

      {/* Compact 5x3 grid */}
      <div className="grid grid-cols-3 gap-2 max-w-[320px] mx-auto">
        {[4, 3, 2, 1, 0].map((l) => (
          Array.from({ length: 3 }, (_, p) => p + 1).map((p) => {
            const isTarget = l.toString() === level && p.toString() === position;
            return (
              <div
                key={`${l}-${p}`}
                className={cn(
                  "h-16 flex items-center justify-center rounded-lg text-lg font-bold border-2 transition-all duration-200",
                  isTarget
                    ? cn(
                        "border-primary",
                        flash
                          ? "bg-primary text-primary-foreground scale-110"
                          : "bg-primary/10 text-primary"
                      )
                    : "bg-muted/50 text-muted-foreground border-transparent"
                )}
              >
                {l}-{p}
              </div>
            );
          })
        ))}
      </div>

      <div className="text-center">
        <div className="text-3xl font-bold text-primary mb-4 animate-pulse">
          {location.code}
        </div>
      </div>

      {mode !== 'view' && (
        <Button 
          onClick={onConfirm}
          className="w-full h-16 text-lg"
        >
          <QrCode className="h-6 w-6 mr-3" />
          {mode === 'place' ? 'Scan to Place' : 'Scan to Pick'}
        </Button>
      )}
    </div>
  );
}
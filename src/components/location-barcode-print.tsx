import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Ruler } from 'lucide-react';
import { getLocationHeight, RACK_TYPES } from '@/lib/warehouse-logic';
import { generateLocationZPL, type LocationLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
import { toast } from 'sonner';
import type { Location } from '@/types/warehouse';

interface LocationBarcodePrintProps {
  location: Location;
}

export function LocationBarcodePrint({ location }: LocationBarcodePrintProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const height = getLocationHeight(location);
      const rackTypeName = RACK_TYPES[location.rackType as keyof typeof RACK_TYPES]?.name || location.rackType || 'Standard';

      const labelData: LocationLabelData = {
        code: location.code,
        row: location.row,
        bay: location.bay,
        level: location.level,
        height,
        maxWeight: location.maxWeight,
        currentWeight: location.currentWeight,
        rackType: rackTypeName,
      };

      const zpl = generateLocationZPL(labelData);
      await sendZPL(zpl);
      
      toast.success('Location label sent to printer successfully');
    } catch (error) {
      console.error('Print error:', error);
      toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPrinting(false);
    }
  };

  const height = getLocationHeight(location);
  const rackTypeName = RACK_TYPES[location.rackType as keyof typeof RACK_TYPES]?.name || location.rackType || 'Standard';

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Preview section */}
      <div className="w-full max-w-md p-4 border rounded-lg bg-white">
        <div className="text-center space-y-2">
          <div className="text-lg font-bold">{location.code}</div>
          <div className="text-sm text-muted-foreground">
            Row {location.row} • Bay {location.bay} • Level {location.level === '0' ? 'Ground' : location.level}
          </div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Ruler className="h-3 w-3" />
            Height: {height}m
          </div>
          <div className="text-sm text-muted-foreground">
            {location.level === '0' 
              ? 'Ground Level - No Weight Limit' 
              : `Max Weight: ${location.maxWeight}kg`
            }
          </div>
          {location.currentWeight > 0 && (
            <div className="text-sm text-muted-foreground">
              Current Weight: {location.currentWeight}kg
            </div>
          )}
          <div className="text-xs text-muted-foreground px-2 py-1 bg-blue-50 rounded">
            {rackTypeName} Rack
          </div>
        </div>
      </div>

      <Button 
        onClick={handlePrint} 
        className="w-full"
        disabled={printing}
      >
        <Printer className="h-4 w-4 mr-2" />
        {printing ? 'Printing...' : 'Print Location Barcode'}
      </Button>
      
      <div className="text-xs text-center text-muted-foreground">
        ZPL label will be sent directly to the configured Zebra printer
      </div>
    </div>
  );
}
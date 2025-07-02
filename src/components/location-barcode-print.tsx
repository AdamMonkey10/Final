import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Ruler } from 'lucide-react';
import { getLocationHeight, RACK_TYPES } from '@/lib/warehouse-logic';
import { generateLocationZPL, type LocationLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
import { toast } from 'sonner';
import { Barcode } from '@/components/barcode';
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
      {/* Preview section - matching item barcode format exactly */}
      <div className="w-full max-w-md p-4 border rounded-lg bg-white">
        <div className="text-center space-y-4">
          {/* Location code as header - BLACK TEXT */}
          <div className="text-lg font-bold text-black">{location.code}</div>
          
          {/* Location details - BLACK TEXT */}
          <div className="text-sm text-black">
            Row {location.row} • Bay {location.bay} • Level {location.level === '0' ? 'Ground' : location.level}
          </div>
          
          {/* Main location code - large and prominent like item systemCode - BLACK TEXT */}
          <div className="text-3xl font-bold text-black">{location.code}</div>
          
          {/* Additional details - BLACK TEXT */}
          <div className="text-sm text-black">
            <div className="flex items-center justify-center gap-1 mb-2">
              <Ruler className="h-3 w-3 text-black" />
              <span className="text-black">Height: {height}m</span>
            </div>
            <div className="text-black">
              {location.level === '0' 
                ? 'Ground Level - No Weight Limit' 
                : `Max Weight: ${location.maxWeight}kg`
              }
            </div>
            {location.currentWeight > 0 && (
              <div className="text-black">
                Current Weight: {location.currentWeight}kg
              </div>
            )}
          </div>
          
          {/* Barcode Preview - matching item barcode style exactly */}
          <div className="py-4">
            <Barcode 
              value={location.code} 
              width={2} 
              height={60}
              className="mx-auto"
            />
          </div>
          
          {/* Footer info - BLACK TEXT */}
          <div className="text-xs text-black">
            <div className="text-black">Date: {new Date().toLocaleDateString()}</div>
            <div className="px-2 py-1 bg-blue-50 rounded mt-2 text-black">
              {rackTypeName} Rack
            </div>
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
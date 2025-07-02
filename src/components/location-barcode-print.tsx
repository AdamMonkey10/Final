import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
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

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Preview section - simplified to show only location code once */}
      <div className="w-full max-w-md p-4 border rounded-lg bg-white">
        <div className="text-center space-y-4">
          {/* Main location code - large and prominent - BLACK TEXT */}
          <div className="text-3xl font-bold text-black">{location.code}</div>
          
          {/* Barcode Preview */}
          <div className="py-4">
            <Barcode 
              value={location.code} 
              width={2} 
              height={60}
              className="mx-auto"
            />
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
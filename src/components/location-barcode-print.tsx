import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, QrCode } from 'lucide-react';
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
    <div className="flex flex-col items-center space-y-6">
      {/* Simplified Preview - Only Code and Barcode */}
      <div className="w-full max-w-md p-8 border-2 border-gray-300 rounded-lg bg-white shadow-sm">
        <div className="text-center space-y-6">
          {/* Location Code - Extra Large and Prominent */}
          <div className="text-6xl font-black text-black">
            {location.code}
          </div>
          
          {/* Linear Barcode - Large and prominent */}
          <div className="py-6 bg-white border rounded">
            <Barcode 
              value={location.code} 
              width={3} 
              height={80}
              className="mx-auto"
            />
          </div>
          
          {/* QR Code - Small reference */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <QrCode className="h-4 w-4" />
            <span>QR: {location.code}</span>
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
      
      <div className="text-xs text-center text-muted-foreground max-w-md">
        <p className="mb-2">
          <strong>Simplified Label:</strong>
        </p>
        <ul className="text-left space-y-1">
          <li>• <strong>Large location code:</strong> {location.code}</li>
          <li>• Linear barcode for scanning</li>
          <li>• QR code for mobile devices</li>
          <li>• Clean, minimal design</li>
          <li>• 103x103mm ZPL format</li>
        </ul>
      </div>
    </div>
  );
}
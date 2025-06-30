import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Ruler, QrCode } from 'lucide-react';
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
    <div className="flex flex-col items-center space-y-6">
      {/* Preview section with barcode */}
      <div className="w-full max-w-md p-6 border-2 border-gray-300 rounded-lg bg-white shadow-sm">
        <div className="text-center space-y-4">
          {/* Header */}
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">
            WAREHOUSE LOCATION
          </div>
          
          {/* Row and Bay */}
          <div className="text-sm text-gray-700">
            Row {location.row} • Bay {location.bay}
          </div>
          
          {/* Location Code - Extra Large and Prominent */}
          <div className="text-4xl font-black text-black border-2 border-black p-4 rounded-lg bg-yellow-100">
            {location.code}
          </div>
          
          {/* Level and Height */}
          <div className="text-lg font-semibold text-gray-800">
            {location.level === '0' ? 'Ground Level' : `Level ${location.level}`} • Height: {height}m
          </div>
          
          {/* Weight Info */}
          <div className="text-sm text-gray-600">
            {location.level === '0' 
              ? 'No Weight Limit' 
              : `Max Weight: ${location.maxWeight}kg`
            }
          </div>
          
          {location.currentWeight > 0 && (
            <div className="text-sm text-gray-600">
              Current Weight: {location.currentWeight}kg
            </div>
          )}
          
          {/* Barcode - Larger and more prominent */}
          <div className="py-4 bg-white border rounded">
            <Barcode 
              value={location.code} 
              width={2.5} 
              height={50}
              className="mx-auto"
            />
          </div>
          
          {/* QR Code representation */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <QrCode className="h-4 w-4" />
            <span>QR: LOC,{location.code}</span>
          </div>
          
          {/* Rack Type */}
          <div className="text-xs text-gray-500 px-2 py-1 bg-blue-50 rounded">
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
      
      <div className="text-xs text-center text-muted-foreground max-w-md">
        <p className="mb-2">
          <strong>Label Features:</strong>
        </p>
        <ul className="text-left space-y-1">
          <li>• <strong>Large location code:</strong> {location.code}</li>
          <li>• Linear barcode for scanning</li>
          <li>• QR code for mobile devices</li>
          <li>• 103x103mm ZPL format</li>
          <li>• Optimized for Zebra printers</li>
        </ul>
      </div>
    </div>
  );
}
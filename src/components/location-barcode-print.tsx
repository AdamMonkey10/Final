import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { getLocationHeight, RACK_TYPES } from '@/lib/warehouse-logic';
import { generateLocationZPL, type LocationLabelData } from '@/lib/zpl-generator';
import { generateLocationHtml } from '@/lib/html-label-generator';
import { sendZPL, getPrinterSettings } from '@/lib/printer-service';
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
      // Get printer settings to determine print method
      const printerSettings = await getPrinterSettings();
      
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

      if (printerSettings.useWindowsPrint) {
        // Generate HTML and open in new window for printing
        const html = generateLocationHtml(labelData);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          toast.success('Location label opened in new window for printing');
        } else {
          toast.error('Failed to open print window. Please check popup blocker settings.');
        }
      } else {
        // Generate ZPL and send directly to printer
        const zpl = generateLocationZPL(labelData);
        await sendZPL(zpl);
        toast.success('Location label sent to printer successfully');
      }
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* ACTUAL 103x103mm SQUARE Label Preview */}
      <div className="relative">
        <div className="text-xs font-medium text-blue-600 mb-2 text-center">📄 103x103mm SQUARE LABEL PREVIEW</div>
        
        {/* PERFECT SQUARE: 320px × 320px (aspect-square enforced) */}
        <div className="w-80 aspect-square border-4 border-blue-300 rounded-lg bg-white shadow-xl flex flex-col p-6 relative overflow-hidden">
          
          {/* MASSIVE Location Code - BLACK and HUGE */}
          <div className="flex-1 flex items-center justify-center">
            <div 
              className="text-center leading-none"
              style={{ 
                fontSize: '4rem', 
                fontWeight: '900', 
                color: '#000000',
                lineHeight: '0.9'
              }}
            >
              {location.code}
            </div>
          </div>
          
          {/* Barcode in middle area */}
          <div className="flex-shrink-0 py-4">
            <Barcode 
              value={location.code} 
              width={2} 
              height={40}
              fontSize={10}
              fontColor="#000000"
              className="mx-auto"
            />
          </div>
          
          {/* Location details at bottom - also black and bold */}
          <div 
            className="flex-shrink-0 text-center"
            style={{ 
              fontSize: '1rem', 
              fontWeight: '700', 
              color: '#000000'
            }}
          >
            Row {location.row} • Bay {location.bay} • Level {location.level === '0' ? 'Ground' : location.level}
          </div>
          
          {/* Square corner indicators */}
          <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-blue-500"></div>
          <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-blue-500"></div>
          <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-blue-500"></div>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-blue-500"></div>
        </div>
        
        <div className="text-xs text-center text-gray-500 mt-2">
          ⬜ Actual size: 103mm × 103mm SQUARE label
        </div>
      </div>

      <Button 
        onClick={handlePrint} 
        className="w-full h-12 text-lg"
        disabled={printing}
      >
        <Printer className="h-4 w-4 mr-2" />
        {printing ? 'Printing...' : 'Print Location Barcode'}
      </Button>
      
      <div className="text-xs text-center text-muted-foreground">
        Label will be printed using your configured print method
      </div>
    </div>
  );
}
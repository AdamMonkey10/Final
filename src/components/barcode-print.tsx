import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { getItemBySystemCode } from '@/lib/firebase/items';
import { generateItemZPL, type ItemLabelData } from '@/lib/zpl-generator';
import { generateItemHtml } from '@/lib/html-label-generator';
import { sendZPL, getPrinterSettings } from '@/lib/printer-service';
import { toast } from 'sonner';
import { Barcode } from '@/components/barcode';
import type { Item } from '@/types/warehouse';

interface BarcodePrintProps {
  value: string; // systemCode
}

export function BarcodePrint({ value }: BarcodePrintProps) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const loadItem = async () => {
      try {
        const fetchedItem = await getItemBySystemCode(value);
        setItem(fetchedItem);
      } catch (error) {
        console.error('Error loading item:', error);
        toast.error('Failed to load item details');
      } finally {
        setLoading(false);
      }
    };

    if (value) {
      loadItem();
    }
  }, [value]);

  const handlePrint = async () => {
    if (!item) {
      toast.error('No item data available');
      return;
    }

    setPrinting(true);
    try {
      // Get printer settings to determine print method
      const printerSettings = await getPrinterSettings();
      
      const labelData: ItemLabelData = {
        systemCode: item.systemCode,
        itemCode: item.itemCode,
        description: item.description,
        weight: item.weight,
        quantity: item.metadata?.quantity || 1,
        lotNumber: item.metadata?.lotNumber || '',
        location: item.location || '',
        operator: 'System',
        date: new Date().toLocaleDateString(),
      };

      if (printerSettings.useWindowsPrint) {
        // Generate HTML and open in new window for printing
        const html = generateItemHtml(labelData);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          toast.success('Label opened in new window for printing');
        } else {
          toast.error('Failed to open print window. Please check popup blocker settings.');
        }
      } else {
        // Generate ZPL and send directly to printer
        const zpl = generateItemZPL(labelData);
        await sendZPL(zpl);
        toast.success('Label sent to printer successfully');
      }
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Item not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Item Details Summary */}
      <div className="w-full p-4 border rounded-lg bg-muted">
        <div className="text-center space-y-2">
          <div className="text-lg font-bold">{item.itemCode}</div>
          <div className="text-sm text-muted-foreground">
            Weight: {item.weight}kg | Qty: {item.metadata?.quantity || 1}
          </div>
          {item.metadata?.lotNumber && (
            <div className="text-sm text-muted-foreground">
              LOT: {item.metadata.lotNumber}
            </div>
          )}
          {item.location && (
            <div className="text-sm text-muted-foreground">
              Location: {item.location}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            System Code: {item.systemCode}
          </div>
        </div>
      </div>

      {/* ACTUAL 103x103mm SQUARE Label Preview */}
      <div className="relative">
        <div className="text-xs font-medium text-blue-600 mb-2 text-center">📄 103x103mm SQUARE LABEL PREVIEW</div>
        
        {/* PERFECT SQUARE: 320px × 320px (aspect-square enforced) */}
        <div className="w-80 aspect-square border-4 border-blue-300 rounded-lg bg-white shadow-xl flex flex-col p-6 relative overflow-hidden">
          
          {/* Part Number (A*****) - Large and prominent */}
          <div className="flex-shrink-0 text-center mb-2">
            <div 
              className="leading-none"
              style={{ 
                fontSize: '2.5rem', 
                fontWeight: '900', 
                color: '#000000',
                lineHeight: '0.9'
              }}
            >
              {item.itemCode}
            </div>
          </div>
          
          {/* Description - Medium size */}
          <div className="flex-1 flex items-center justify-center">
            <div 
              className="text-center leading-none break-words"
              style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: '#000000',
                lineHeight: '0.9'
              }}
            >
              {item.description}
            </div>
          </div>
          
          {/* Barcode in middle area */}
          <div className="flex-shrink-0 py-4">
            <Barcode 
              value={item.systemCode} 
              width={2} 
              height={40}
              fontSize={10}
              fontColor="#000000"
              className="mx-auto"
            />
          </div>
          
          {/* Bottom info - Weight, Quantity, LOT */}
          <div className="flex-shrink-0 space-y-1">
            <div 
              className="text-center"
              style={{ 
                fontSize: '1rem', 
                fontWeight: '700', 
                color: '#000000'
              }}
            >
              Weight: {item.weight}kg | Qty: {item.metadata?.quantity || 1}
            </div>
            {item.metadata?.lotNumber && (
              <div 
                className="text-center"
                style={{ 
                  fontSize: '1rem', 
                  fontWeight: '700', 
                  color: '#000000'
                }}
              >
                LOT: {item.metadata.lotNumber}
              </div>
            )}
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
        {printing ? 'Printing...' : 'Print Barcode'}
      </Button>
      
      <div className="text-xs text-center text-muted-foreground">
        Label will be printed using your configured print method
      </div>
    </div>
  );
}
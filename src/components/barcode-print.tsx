import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { getItemBySystemCode } from '@/lib/firebase/items';
import { generateItemZPL, type ItemLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
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
      const labelData: ItemLabelData = {
        systemCode: item.systemCode,
        itemCode: item.itemCode,
        description: item.description,
        weight: item.weight,
        location: item.location || '',
        operator: 'System', // You might want to get this from context
        date: new Date().toLocaleDateString(),
      };

      const zpl = generateItemZPL(labelData);
      await sendZPL(zpl);
      
      toast.success('Label sent to printer successfully');
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
            Weight: {item.weight}kg
          </div>
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

      {/* 103x103mm SQUARE Label Preview */}
      <div className="relative">
        <div className="text-xs font-medium text-blue-600 mb-2 text-center">📄 103x103mm LABEL PREVIEW</div>
        
        {/* Perfect 103x103mm square (using aspect-square and fixed width) */}
        <div className="w-80 h-80 border-4 border-blue-300 rounded-lg bg-white shadow-xl flex flex-col justify-center items-center p-4 relative overflow-hidden">
          
          {/* HUGE Description Text - Taking up most of the top area */}
          <div className="flex-1 flex items-center justify-center w-full">
            <div className="text-center">
              <div className="text-4xl font-black text-black leading-tight break-words max-w-full">
                {item.description}
              </div>
            </div>
          </div>
          
          {/* Barcode in middle */}
          <div className="flex-shrink-0 py-2">
            <Barcode 
              value={item.systemCode} 
              width={2} 
              height={50}
              fontSize={12}
              fontColor="#000000"
              className="mx-auto"
            />
          </div>
          
          {/* Weight at bottom */}
          <div className="flex-shrink-0 text-xl font-black text-black text-center">
            Weight: {item.weight}kg
          </div>
          
          {/* Corner indicators to show it's a square */}
          <div className="absolute top-1 left-1 w-3 h-3 border-l-2 border-t-2 border-blue-500"></div>
          <div className="absolute top-1 right-1 w-3 h-3 border-r-2 border-t-2 border-blue-500"></div>
          <div className="absolute bottom-1 left-1 w-3 h-3 border-l-2 border-b-2 border-blue-500"></div>
          <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-blue-500"></div>
        </div>
        
        <div className="text-xs text-center text-gray-500 mt-2">
          Actual size: 103mm × 103mm square label
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
        ZPL label will be sent directly to the configured Zebra printer
      </div>
    </div>
  );
}
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

      {/* EXACT Label Preview - Matching ZPL output */}
      <div className="w-full max-w-md p-6 border-2 border-blue-200 rounded-lg bg-white shadow-lg">
        <div className="text-center space-y-6">
          <div className="text-xs font-medium text-blue-600 mb-4">📄 LABEL PREVIEW</div>
          
          {/* MASSIVE description display - exactly matching ZPL ^A0N,60,60 */}
          <div className="text-5xl font-black text-black leading-none px-2 py-4 border-2 border-dashed border-gray-300 rounded">
            {item.description}
          </div>
          
          {/* Barcode Preview */}
          <div className="py-6 border-2 border-dashed border-gray-300 rounded">
            <Barcode 
              value={item.systemCode} 
              width={3} 
              height={80}
              fontSize={20}
              fontColor="#000000"
              className="mx-auto"
            />
          </div>
          
          {/* Weight - matching ZPL ^A0N,48,48 */}
          <div className="text-2xl font-black text-black border-2 border-dashed border-gray-300 rounded py-2">
            Weight: {item.weight}kg
          </div>
          
          <div className="text-xs text-gray-500 mt-4">
            This preview shows exactly how the label will print
          </div>
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
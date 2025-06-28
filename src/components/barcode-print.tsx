import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { getItemBySystemCode } from '@/lib/firebase/items';
import { generateItemZPL, type ItemLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
import { toast } from 'sonner';
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

    loadItem();
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
        location: item.location,
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
    return <div>Loading item details...</div>;
  }

  if (!item) {
    return <div>Item not found</div>;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Preview section */}
      <div className="w-full max-w-md p-4 border rounded-lg bg-white">
        <div className="text-center space-y-2">
          <div className="text-lg font-bold">{item.systemCode}</div>
          <div className="text-sm text-muted-foreground">
            Reference: {item.itemCode}
          </div>
          <div className="text-sm text-muted-foreground">
            {item.description}
          </div>
          <div className="text-sm text-muted-foreground">
            Weight: {item.weight}kg
          </div>
          {item.location && (
            <div className="text-sm text-muted-foreground">
              Location: {item.location}
            </div>
          )}
        </div>
      </div>

      <Button 
        onClick={handlePrint} 
        className="w-full"
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
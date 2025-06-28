import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { getItemBySystemCode } from '@/lib/firebase/items';
import type { Item } from '@/types/warehouse';

interface BarcodePrintProps {
  value: string; // systemCode
}

export function BarcodePrint({ value }: BarcodePrintProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItem = async () => {
      try {
        const fetchedItem = await getItemBySystemCode(value);
        setItem(fetchedItem);
      } catch (error) {
        console.error('Error loading item:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItem();
  }, [value]);

  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10,
      });
    }
  }, [value]);

  const handlePrint = () => {
    // Create a temporary iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Generate barcode SVG
    const svg = document.createElement('svg');
    JsBarcode(svg, value, {
      format: 'CODE128',
      width: 2,
      height: 100,
      displayValue: true,
      fontSize: 16,
      margin: 10,
    });

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              margin: 0; 
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              max-width: 400px;
              margin: 0 auto;
              text-align: center;
            }
            .barcode svg {
              max-width: 100%;
              height: auto;
            }
            .code {
              font-size: 24px;
              font-weight: bold;
              margin: 20px 0;
            }
            .details {
              margin: 20px 0;
              font-size: 16px;
              line-height: 1.5;
            }
            .location {
              margin-top: 20px;
              padding: 15px;
              border: 2px solid #0369a1;
              border-radius: 8px;
              background: #f0f9ff;
              color: #0369a1;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="barcode">
              ${svg.outerHTML}
            </div>
            <div class="code">${value}</div>
            <div class="details">
              <p><strong>Reference:</strong> ${item?.itemCode || 'N/A'}</p>
              <p><strong>Weight:</strong> ${item?.weight || 0}kg</p>
            </div>
            ${item?.location ? `
              <div class="location">
                Location: ${item.location}
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `;

    // Write content to iframe and print
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(content);
      doc.close();

      // Wait for content to load then print
      iframe.onload = () => {
        iframe.contentWindow?.print();
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
    }
  };

  if (loading) {
    return <div>Loading item details...</div>;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <svg ref={barcodeRef} className="w-full max-w-md" />
      <div className="text-center">
        <div className="text-lg font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">
          Reference: {item?.itemCode || 'N/A'}
        </div>
        <div className="text-sm text-muted-foreground">
          Weight: {item?.weight || 0}kg
        </div>
        {item?.location && (
          <div className="text-sm text-muted-foreground">
            Location: {item.location}
          </div>
        )}
      </div>
      <Button onClick={handlePrint} className="w-full">
        <Printer className="h-4 w-4 mr-2" />
        Print Barcode
      </Button>
    </div>
  );
}
import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface BarcodePrintProps {
  value: string;
  itemCode: string;
  weight: number;
  location: string;
}

export function BarcodePrint({ value, itemCode, weight, location }: BarcodePrintProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

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
              <p><strong>Reference:</strong> ${itemCode}</p>
              <p><strong>Weight:</strong> ${weight}kg</p>
            </div>
            <div class="location">
              Location: ${location}
            </div>
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

  return (
    <div className="flex flex-col items-center space-y-4">
      <svg ref={barcodeRef} className="w-full max-w-md" />
      <div className="text-center">
        <div className="text-lg font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">
          Reference: {itemCode}
        </div>
        <div className="text-sm text-muted-foreground">
          Weight: {weight}kg
        </div>
        <div className="text-sm text-muted-foreground">
          Location: {location}
        </div>
      </div>
      <Button onClick={handlePrint} className="w-full">
        <Printer className="h-4 w-4 mr-2" />
        Print Barcode
      </Button>
    </div>
  );
}
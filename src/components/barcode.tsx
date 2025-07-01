import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  format?: string;
  className?: string;
}

export function Barcode({
  value,
  width = 2,
  height = 100,
  format = 'CODE128',
  className,
}: BarcodeProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format,
          width,
          height,
          displayValue: true,
          fontSize: 16,
          margin: 10,
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
        // Fallback: show the value as text if barcode generation fails
        if (barcodeRef.current) {
          barcodeRef.current.innerHTML = `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="black">${value}</text>`;
        }
      }
    }
  }, [value, width, height, format]);

  if (!value) {
    return <div className={className}>No barcode value provided</div>;
  }

  return <svg ref={barcodeRef} className={className} />;
}
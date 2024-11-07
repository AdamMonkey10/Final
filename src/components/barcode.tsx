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
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, value, {
        format,
        width,
        height,
        displayValue: true,
        fontSize: 16,
        margin: 10,
      });
    }
  }, [value, width, height, format]);

  return <svg ref={barcodeRef} className={className} />;
}
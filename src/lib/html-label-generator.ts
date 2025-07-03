export interface ItemLabelData {
  systemCode: string;
  itemCode: string;
  description: string;
  weight: number;
  quantity: number;
  lotNumber: string;
  location?: string;
  operator: string;
  date: string;
}

export interface LocationLabelData {
  code: string;
  row: string;
  bay: string;
  level: string;
  height: number;
  maxWeight: number;
  currentWeight: number;
  rackType: string;
}

/**
 * Generate HTML for item labels (103x103mm)
 * Optimized for printing on standard printers with proper barcode rendering
 */
export function generateItemHtml(data: ItemLabelData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Item Label - ${data.itemCode}</title>
  <style>
    @page {
      size: 103mm 103mm;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 6mm;
      font-family: Arial, sans-serif;
      width: 103mm;
      height: 103mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
      color: black;
      position: relative;
    }
    
    /* Square corner indicators */
    .corner {
      position: absolute;
      width: 4mm;
      height: 4mm;
      border: 2px solid #3b82f6;
    }
    .corner.top-left { top: 2mm; left: 2mm; border-right: none; border-bottom: none; }
    .corner.top-right { top: 2mm; right: 2mm; border-left: none; border-bottom: none; }
    .corner.bottom-left { bottom: 2mm; left: 2mm; border-right: none; border-top: none; }
    .corner.bottom-right { bottom: 2mm; right: 2mm; border-left: none; border-top: none; }
    
    .part-number {
      font-size: 20pt;
      font-weight: 900;
      text-align: center;
      line-height: 0.9;
      margin-bottom: 2mm;
      color: #000000;
    }
    
    .description {
      font-size: 12pt;
      font-weight: 700;
      text-align: center;
      line-height: 0.9;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      word-wrap: break-word;
      overflow-wrap: break-word;
      color: #000000;
      padding: 0 2mm;
    }
    
    .barcode-section {
      text-align: center;
      margin: 3mm 0;
    }
    
    .barcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 2mm 0;
    }
    
    .barcode-text {
      font-size: 8pt;
      font-weight: bold;
      margin-top: 1mm;
      color: #000000;
    }
    
    .bottom-info {
      font-size: 8pt;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      color: #000000;
    }
    
    .info-line {
      margin: 1mm 0;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>
<body>
  <!-- Corner indicators -->
  <div class="corner top-left"></div>
  <div class="corner top-right"></div>
  <div class="corner bottom-left"></div>
  <div class="corner bottom-right"></div>

  <div class="part-number">${data.itemCode}</div>
  
  <div class="description">${data.description}</div>
  
  <div class="barcode-section">
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>
    <div class="barcode-text">${data.systemCode}</div>
  </div>
  
  <div class="bottom-info">
    <div class="info-line">Weight: ${data.weight}kg | Qty: ${data.quantity}</div>
    <div class="info-line">LOT: ${data.lotNumber}</div>
  </div>

  <script>
    window.onload = function() {
      // Generate barcode using JsBarcode
      try {
        JsBarcode("#barcode", "${data.systemCode}", {
          format: "CODE128",
          width: 2,
          height: 40,
          displayValue: false,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000"
        });
      } catch (error) {
        console.error('Barcode generation failed:', error);
        // Fallback: show text if barcode fails
        document.getElementById('barcode').innerHTML = '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="black">${data.systemCode}</text>';
      }
      
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 1000);
    };
  </script>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML for location labels (103x103mm)
 */
export function generateLocationHtml(data: LocationLabelData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Location Label - ${data.code}</title>
  <style>
    @page {
      size: 103mm 103mm;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 6mm;
      font-family: Arial, sans-serif;
      width: 103mm;
      height: 103mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
      color: black;
      position: relative;
    }
    
    /* Square corner indicators */
    .corner {
      position: absolute;
      width: 4mm;
      height: 4mm;
      border: 2px solid #3b82f6;
    }
    .corner.top-left { top: 2mm; left: 2mm; border-right: none; border-bottom: none; }
    .corner.top-right { top: 2mm; right: 2mm; border-left: none; border-bottom: none; }
    .corner.bottom-left { bottom: 2mm; left: 2mm; border-right: none; border-top: none; }
    .corner.bottom-right { bottom: 2mm; right: 2mm; border-left: none; border-top: none; }
    
    .location-code {
      font-size: 32pt;
      font-weight: 900;
      text-align: center;
      line-height: 0.9;
      margin-bottom: 4mm;
      color: #000000;
    }
    
    .barcode-section {
      text-align: center;
      margin: 4mm 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .barcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 2mm 0;
    }
    
    .barcode-text {
      font-size: 8pt;
      font-weight: bold;
      margin-top: 1mm;
      color: #000000;
    }
    
    .location-details {
      font-size: 10pt;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      color: #000000;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>
<body>
  <!-- Corner indicators -->
  <div class="corner top-left"></div>
  <div class="corner top-right"></div>
  <div class="corner bottom-left"></div>
  <div class="corner bottom-right"></div>

  <div class="location-code">${data.code}</div>
  
  <div class="barcode-section">
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>
    <div class="barcode-text">${data.code}</div>
  </div>
  
  <div class="location-details">
    Row ${data.row} • Bay ${data.bay} • Level ${data.level === '0' ? 'Ground' : data.level}
  </div>

  <script>
    window.onload = function() {
      // Generate barcode using JsBarcode
      try {
        JsBarcode("#barcode", "${data.code}", {
          format: "CODE128",
          width: 2,
          height: 40,
          displayValue: false,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000"
        });
      } catch (error) {
        console.error('Barcode generation failed:', error);
        // Fallback: show text if barcode fails
        document.getElementById('barcode').innerHTML = '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="black">${data.code}</text>';
      }
      
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 1000);
    };
  </script>
</body>
</html>
  `.trim();
}

/**
 * Generate bulk HTML for multiple location labels
 * Each label will be on a separate page
 */
export function generateBulkLocationHtml(locations: LocationLabelData[]): string {
  const labelPages = locations.map((location, index) => `
<div class="label-page" ${index > 0 ? 'style="page-break-before: always;"' : ''}>
  <!-- Corner indicators -->
  <div class="corner top-left"></div>
  <div class="corner top-right"></div>
  <div class="corner bottom-left"></div>
  <div class="corner bottom-right"></div>

  <div class="location-code">${location.code}</div>
  
  <div class="barcode-section">
    <div class="barcode-container">
      <svg id="barcode-${index}"></svg>
    </div>
    <div class="barcode-text">${location.code}</div>
  </div>
  
  <div class="location-details">
    Row ${location.row} • Bay ${location.bay} • Level ${location.level === '0' ? 'Ground' : location.level}
  </div>
</div>
  `).join('\n');

  const barcodeScripts = locations.map((location, index) => `
    try {
      JsBarcode("#barcode-${index}", "${location.code}", {
        format: "CODE128",
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000"
      });
    } catch (error) {
      console.error('Barcode generation failed for ${location.code}:', error);
      document.getElementById('barcode-${index}').innerHTML = '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="black">${location.code}</text>';
    }
  `).join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bulk Location Labels</title>
  <style>
    @page {
      size: 103mm 103mm;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background: white;
      color: black;
    }
    
    .label-page {
      width: 103mm;
      height: 103mm;
      padding: 6mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    
    /* Square corner indicators */
    .corner {
      position: absolute;
      width: 4mm;
      height: 4mm;
      border: 2px solid #3b82f6;
    }
    .corner.top-left { top: 2mm; left: 2mm; border-right: none; border-bottom: none; }
    .corner.top-right { top: 2mm; right: 2mm; border-left: none; border-bottom: none; }
    .corner.bottom-left { bottom: 2mm; left: 2mm; border-right: none; border-top: none; }
    .corner.bottom-right { bottom: 2mm; right: 2mm; border-left: none; border-top: none; }
    
    .location-code {
      font-size: 32pt;
      font-weight: 900;
      text-align: center;
      line-height: 0.9;
      margin-bottom: 4mm;
      color: #000000;
    }
    
    .barcode-section {
      text-align: center;
      margin: 4mm 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .barcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 2mm 0;
    }
    
    .barcode-text {
      font-size: 8pt;
      font-weight: bold;
      margin-top: 1mm;
      color: #000000;
    }
    
    .location-details {
      font-size: 10pt;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      color: #000000;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>
<body>
  ${labelPages}

  <script>
    window.onload = function() {
      // Generate all barcodes
      ${barcodeScripts}
      
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 1000);
    };
  </script>
</body>
</html>
  `.trim();
}
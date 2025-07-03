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
 * Optimized for printing on standard printers
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
      padding: 8mm;
      font-family: Arial, sans-serif;
      width: 103mm;
      height: 103mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
      color: black;
    }
    
    .part-number {
      font-size: 24pt;
      font-weight: 900;
      text-align: center;
      line-height: 0.9;
      margin-bottom: 4mm;
    }
    
    .description {
      font-size: 14pt;
      font-weight: 700;
      text-align: center;
      line-height: 0.9;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .barcode-section {
      text-align: center;
      margin: 4mm 0;
    }
    
    .barcode {
      font-family: 'Libre Barcode 128', monospace;
      font-size: 32pt;
      letter-spacing: 0;
      margin: 2mm 0;
    }
    
    .barcode-text {
      font-size: 8pt;
      font-weight: bold;
      margin-top: 1mm;
    }
    
    .bottom-info {
      font-size: 10pt;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
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
  <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
</head>
<body>
  <div class="part-number">${data.itemCode}</div>
  
  <div class="description">${data.description}</div>
  
  <div class="barcode-section">
    <div class="barcode">${data.systemCode}</div>
    <div class="barcode-text">${data.systemCode}</div>
  </div>
  
  <div class="bottom-info">
    <div class="info-line">Weight: ${data.weight}kg | Qty: ${data.quantity}</div>
    <div class="info-line">LOT: ${data.lotNumber}</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 500);
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
      padding: 8mm;
      font-family: Arial, sans-serif;
      width: 103mm;
      height: 103mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
      color: black;
    }
    
    .location-code {
      font-size: 36pt;
      font-weight: 900;
      text-align: center;
      line-height: 0.9;
      margin-bottom: 6mm;
    }
    
    .barcode-section {
      text-align: center;
      margin: 6mm 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .barcode {
      font-family: 'Libre Barcode 128', monospace;
      font-size: 32pt;
      letter-spacing: 0;
      margin: 2mm 0;
    }
    
    .barcode-text {
      font-size: 8pt;
      font-weight: bold;
      margin-top: 1mm;
    }
    
    .location-details {
      font-size: 12pt;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
</head>
<body>
  <div class="location-code">${data.code}</div>
  
  <div class="barcode-section">
    <div class="barcode">${data.code}</div>
    <div class="barcode-text">${data.code}</div>
  </div>
  
  <div class="location-details">
    Row ${data.row} • Bay ${data.bay} • Level ${data.level === '0' ? 'Ground' : data.level}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 500);
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
  <div class="location-code">${location.code}</div>
  
  <div class="barcode-section">
    <div class="barcode">${location.code}</div>
    <div class="barcode-text">${location.code}</div>
  </div>
  
  <div class="location-details">
    Row ${location.row} • Bay ${location.bay} • Level ${location.level === '0' ? 'Ground' : location.level}
  </div>
</div>
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
      padding: 8mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .location-code {
      font-size: 36pt;
      font-weight: 900;
      text-align: center;
      line-height: 0.9;
      margin-bottom: 6mm;
    }
    
    .barcode-section {
      text-align: center;
      margin: 6mm 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .barcode {
      font-family: 'Libre Barcode 128', monospace;
      font-size: 32pt;
      letter-spacing: 0;
      margin: 2mm 0;
    }
    
    .barcode-text {
      font-size: 8pt;
      font-weight: bold;
      margin-top: 1mm;
    }
    
    .location-details {
      font-size: 12pt;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
</head>
<body>
  ${labelPages}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 500);
    };
  </script>
</body>
</html>
  `.trim();
}
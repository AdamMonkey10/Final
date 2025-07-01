import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface PrinterSettings {
  ip: string;
  port: number;
}

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  ip: '10.0.1.90',
  port: 9100
};

/**
 * Send ZPL data directly to the printer using HTTPS
 */
export async function sendZPL(zpl: string, settings?: PrinterSettings): Promise<boolean> {
  const printerSettings = settings || await getPrinterSettings();
  
  try {
    const ip = printerSettings.ip;
    console.log('Sending to printer IP:', ip);
    console.log('ZPL length:', zpl.length, 'characters');
    
    const url = `https://${ip}/print`;
    console.log('Printer URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: zpl,
    });

    if (response.ok) {
      console.log('Print job sent successfully');
      return true;
    } else {
      console.error(`Print failed with status: ${response.status}`);
      throw new Error(`Print failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Print error:', error);
    throw new Error(`Print error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get printer settings from Firebase
 */
export async function getPrinterSettings(): Promise<PrinterSettings> {
  try {
    const docRef = doc(db, 'settings', 'printer');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ip: data.ip || DEFAULT_PRINTER_SETTINGS.ip,
        port: data.port || DEFAULT_PRINTER_SETTINGS.port,
      };
    } else {
      // Return default settings if document doesn't exist
      return DEFAULT_PRINTER_SETTINGS;
    }
  } catch (error) {
    console.error('Error getting printer settings:', error);
    return DEFAULT_PRINTER_SETTINGS;
  }
}

/**
 * Save printer settings to Firebase
 */
export async function savePrinterSettings(settings: PrinterSettings): Promise<void> {
  try {
    const docRef = doc(db, 'settings', 'printer');
    await setDoc(docRef, {
      ip: settings.ip,
      port: settings.port,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log('Printer settings saved successfully');
  } catch (error) {
    console.error('Error saving printer settings:', error);
    throw new Error(`Failed to save printer settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test printer connection using direct HTTPS call
 */
export async function testPrinterConnection(settings?: PrinterSettings): Promise<boolean> {
  const printerSettings = settings || await getPrinterSettings();
  
  try {
    // Send a simple test ZPL command
    const testZPL = `
^XA
^FO50,50^A0N,50,50^FDTest Print^FS
^FO50,120^A0N,30,30^FD${new Date().toLocaleString()}^FS
^XZ
`;
    
    return await sendZPL(testZPL, printerSettings);
  } catch (error) {
    console.error('Printer connection test failed:', error);
    return false;
  }
}
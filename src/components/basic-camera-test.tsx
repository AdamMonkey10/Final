import { useState, useEffect } from 'react';
import QrScanner from 'react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, AlertCircle, CheckCircle, RotateCcw, Zap, Target } from 'lucide-react';

export default function BasicCameraTest() {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraInfo, setCameraInfo] = useState<any>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Test camera permissions with explicit constraints
    testCameraAccess();
  }, [facingMode]);

  const testCameraAccess = async () => {
    setHasPermission(null);
    setError('');
    
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // Ultra-high resolution constraints optimized for barcode scanning
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 30 },
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous'
        },
        audio: false // Explicitly set to false
      };

      console.log('Testing camera with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setHasPermission(true);
      
      // Get camera info
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        setCameraInfo(settings);
        console.log('Camera settings:', settings);
      }
      
      // Stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      
    } catch (err: any) {
      console.error('Camera test failed:', err);
      setHasPermission(false);
      setError(`Camera test failed: ${err.message}`);
    }
  };

  const handleScan = (data: any) => {
    console.log('Basic scanner result:', data);
    if (data?.text) {
      setResult(data.text);
      setError('');
      setScanCount(prev => prev + 1);
      setIsScanning(true);
      
      // Reset scanning indicator after a moment
      setTimeout(() => setIsScanning(false), 1000);
    }
  };

  const handleError = (err: any) => {
    console.error('Basic scanner error:', err);
    setError(`Scanner error: ${err?.message || err}`);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setError('');
    setResult('');
    setScanCount(0);
  };

  const clearResults = () => {
    setResult('');
    setError('');
    setScanCount(0);
  };

  if (hasPermission === null) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Enhanced Barcode Scanner Test</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Testing high-resolution camera access...</p>
        </div>
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Enhanced Barcode Scanner Test</h2>
        <div className="text-center py-8 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={testCameraAccess} variant="outline" size="sm">
              Retry Camera Test
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Enhanced Barcode Scanner Test</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <Camera className="h-3 w-3 mr-1" />
              {facingMode === 'environment' ? 'Back Camera (Recommended)' : 'Front Camera'}
            </Badge>
            {scanCount > 0 && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                <Target className="h-3 w-3 mr-1" />
                {scanCount} successful scans
              </Badge>
            )}
          </div>
          <Button onClick={toggleCamera} variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Switch Camera
          </Button>
        </div>

        {cameraInfo && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">📹 Camera Configuration:</h4>
            <div className="text-sm text-blue-800 grid grid-cols-2 gap-2">
              <div>Resolution: {cameraInfo.width}x{cameraInfo.height}</div>
              <div>Frame Rate: {cameraInfo.frameRate || 'Auto'}fps</div>
              <div>Facing: {cameraInfo.facingMode || 'Unknown'}</div>
              <div>Focus: {cameraInfo.focusMode || 'Auto'}</div>
            </div>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden bg-black relative">
          <QrScanner
            onDecode={handleScan}
            onError={handleError}
            constraints={{ 
              video: {
                facingMode: facingMode,
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 60, min: 30 },
                focusMode: 'continuous',
                exposureMode: 'continuous',
                whiteBalanceMode: 'continuous'
              },
              audio: false
            }}
            containerStyle={{ 
              width: '100%', 
              height: '600px' // Increased height for better scanning
            }}
            videoStyle={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }}
          />
          
          {/* Ultra-enhanced barcode scanning overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Large corner brackets */}
            <div className="absolute top-4 left-4 w-20 h-20 border-l-4 border-t-4 border-white rounded-tl-lg opacity-90 shadow-lg"></div>
            <div className="absolute top-4 right-4 w-20 h-20 border-r-4 border-t-4 border-white rounded-tr-lg opacity-90 shadow-lg"></div>
            <div className="absolute bottom-4 left-4 w-20 h-20 border-l-4 border-b-4 border-white rounded-bl-lg opacity-90 shadow-lg"></div>
            <div className="absolute bottom-4 right-4 w-20 h-20 border-r-4 border-b-4 border-white rounded-br-lg opacity-90 shadow-lg"></div>
            
            {/* Primary barcode scanning area - EXTRA LARGE */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-56 border-4 border-red-500 rounded-xl bg-red-500 bg-opacity-15 shadow-2xl">
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                <span className="text-white text-lg font-bold bg-red-500 bg-opacity-90 px-4 py-2 rounded-full shadow-lg">
                  📱 BARCODE SCANNING ZONE
                </span>
              </div>
              {/* Multiple animated scanning lines for better detection */}
              <div className="absolute inset-x-4 top-1/3 h-1 bg-red-400 opacity-90 animate-pulse shadow-lg"></div>
              <div className="absolute inset-x-4 top-1/2 h-1 bg-red-300 opacity-80 animate-pulse shadow-lg" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute inset-x-4 top-2/3 h-1 bg-red-400 opacity-90 animate-pulse shadow-lg" style={{ animationDelay: '1s' }}></div>
              
              {/* Crosshair for precise positioning */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white opacity-60"></div>
                <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white opacity-60"></div>
              </div>
            </div>
            
            {/* QR code area */}
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-40 h-40 border-3 border-yellow-400 border-dashed rounded-xl bg-yellow-400 bg-opacity-15 shadow-lg">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <span className="text-yellow-400 text-sm font-bold bg-black bg-opacity-70 px-3 py-1 rounded-full">
                  QR CODES
                </span>
              </div>
            </div>

            {/* Scanning status indicator */}
            {isScanning && (
              <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
                <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-4 py-2 rounded-full shadow-lg animate-pulse">
                  <Zap className="h-4 w-4" />
                  <span className="font-bold">BARCODE DETECTED!</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-bold text-green-800 text-lg">✅ Scan Successful!</span>
            </div>
            <div className="bg-white p-3 rounded border">
              <p className="text-sm text-gray-600 mb-1">Scanned Data:</p>
              <p className="text-lg font-mono text-green-700 break-all">{result}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-800">Error:</span>
            </div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={clearResults} variant="outline" className="flex-1">
            Clear Results
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">
            Refresh Page
          </Button>
        </div>

        <div className="space-y-3">
          <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg shadow-sm">
            <div className="text-center">
              <p className="text-lg font-bold text-red-800 mb-2">
                🎯 BARCODE SCANNING INSTRUCTIONS
              </p>
              <p className="text-sm text-red-700 font-medium">
                Position barcode HORIZONTALLY in the large RED zone above
              </p>
              <p className="text-xs text-red-600 mt-2">
                ✓ Hold steady for 2-3 seconds ✓ Ensure good lighting ✓ Keep barcode flat and clean
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
              <p className="text-sm text-yellow-800 text-center font-medium">
                📱 QR CODES<br />
                <span className="text-xs">Yellow square area</span>
              </p>
            </div>
            <div className="p-3 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-700 text-center font-medium">
                📊 SCAN COUNT<br />
                <span className="text-xs">{scanCount} successful scans</span>
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-sm text-blue-800 text-center">
              💡 <strong>Pro Tips:</strong> Use back camera • Clean camera lens • Avoid shadows • Keep device steady • Try different angles if not detecting
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
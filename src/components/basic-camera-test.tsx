import { useState, useEffect } from 'react';
import QrScanner from 'react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';

export default function BasicCameraTest() {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraInfo, setCameraInfo] = useState<any>(null);

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

      // High-resolution constraints optimized for barcode scanning
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30 },
          focusMode: 'continuous'
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
  };

  const clearResults = () => {
    setResult('');
    setError('');
  };

  if (hasPermission === null) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Basic Camera Test</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Testing camera access...</p>
        </div>
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Basic Camera Test</h2>
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
      <h2 className="text-xl font-bold mb-4">Basic Camera Test - High Resolution Barcode Scanning</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <Camera className="h-3 w-3 mr-1" />
            {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
          </Badge>
          <Button onClick={toggleCamera} variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Switch Camera
          </Button>
        </div>

        {cameraInfo && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Camera Info:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <div>Resolution: {cameraInfo.width}x{cameraInfo.height}</div>
              <div>Facing Mode: {cameraInfo.facingMode || 'unknown'}</div>
              <div>Frame Rate: {cameraInfo.frameRate || 'unknown'}</div>
              <div>Focus Mode: {cameraInfo.focusMode || 'unknown'}</div>
              <div>Aspect Ratio: {cameraInfo.aspectRatio || 'unknown'}</div>
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
                frameRate: { ideal: 30 },
                focusMode: 'continuous'
              },
              audio: false
            }}
            containerStyle={{ 
              width: '100%', 
              height: '500px' // Increased height
            }}
            videoStyle={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }}
          />
          
          {/* Enhanced barcode scanning overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Large corner brackets */}
            <div className="absolute top-4 left-4 w-16 h-16 border-l-4 border-t-4 border-white rounded-tl-lg opacity-80"></div>
            <div className="absolute top-4 right-4 w-16 h-16 border-r-4 border-t-4 border-white rounded-tr-lg opacity-80"></div>
            <div className="absolute bottom-4 left-4 w-16 h-16 border-l-4 border-b-4 border-white rounded-bl-lg opacity-80"></div>
            <div className="absolute bottom-4 right-4 w-16 h-16 border-r-4 border-b-4 border-white rounded-br-lg opacity-80"></div>
            
            {/* Primary barcode scanning area - much larger */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-48 border-4 border-red-500 rounded-lg bg-red-500 bg-opacity-10">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-sm font-bold bg-red-500 bg-opacity-80 px-3 py-1 rounded">
                  BARCODE SCANNING AREA
                </span>
              </div>
              {/* Animated scanning line */}
              <div className="absolute inset-x-2 top-1/2 h-1 bg-red-400 opacity-90 animate-pulse shadow-lg"></div>
            </div>
            
            {/* QR code area */}
            <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-32 h-32 border-3 border-yellow-400 border-dashed rounded-lg bg-yellow-400 bg-opacity-10">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-yellow-400 text-xs font-bold bg-black bg-opacity-60 px-2 py-1 rounded">
                  QR CODES
                </span>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Scan Result:</span>
            </div>
            <p className="text-sm text-green-700 break-all font-mono">{result}</p>
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

        <div className="space-y-2">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 text-center font-bold">
              📱 BARCODES: Position horizontally in the large RED scanning area
            </p>
            <p className="text-xs text-red-600 text-center mt-1">
              Hold steady for 2-3 seconds • Ensure good lighting • Keep barcode flat
            </p>
          </div>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 text-center font-medium">
              📱 QR CODES: Position in the yellow square at the top
            </p>
          </div>
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700 text-center">
              💡 Pro Tips: Use back camera • Avoid shadows • Keep device steady • Clean camera lens
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
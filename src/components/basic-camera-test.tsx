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

      // Optimized constraints for barcode scanning
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
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
      <h2 className="text-xl font-bold mb-4">Basic Camera Test - Optimized for Barcode Scanning</h2>
      
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
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                focusMode: 'continuous'
              },
              audio: false
            }}
            containerStyle={{ 
              width: '100%', 
              height: '400px' 
            }}
            videoStyle={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }}
          />
          
          {/* Barcode scanning overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Horizontal scanning line for barcodes */}
            <div className="absolute inset-x-8 top-1/2 h-1 bg-red-500 opacity-75 animate-pulse shadow-lg"></div>
            
            {/* Barcode scanning area */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-white border-dashed rounded-lg">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                  Barcode Area
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
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700 text-center font-medium">
              📱 For Barcodes: Hold horizontally in the red scanning line
            </p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              💡 Tip: Use back camera, ensure good lighting, hold steady for 1-2 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
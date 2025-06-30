import { useState, useEffect, useRef, useCallback } from 'react';
import QrScanner from 'react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraScannerProps {
  onResult: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
  isActive?: boolean;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function CameraScanner({ 
  onResult, 
  onError, 
  className,
  isActive = true 
}: CameraScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const lastScanTimeRef = useRef<number>(0);
  const initAttemptRef = useRef<number>(0);

  // Create debounced version of onResult callback
  const debouncedOnResult = useCallback(
    debounce((data: string) => {
      console.log('📱 Scanner: Debounced result callback triggered with:', data);
      onResult(data);
      setIsScanning(false);
    }, 300), // Reduced debounce for faster response
    [onResult]
  );

  useEffect(() => {
    if (isActive) {
      console.log('📱 Scanner: Component activated, requesting camera permission');
      initializeCamera();
    } else {
      console.log('📱 Scanner: Component deactivated');
      setHasPermission(null);
      setError(null);
      setCameraReady(false);
    }
  }, [isActive, facingMode]);

  const initializeCamera = async () => {
    setIsInitializing(true);
    setCameraReady(false);
    initAttemptRef.current += 1;
    const currentAttempt = initAttemptRef.current;
    
    try {
      setError(null);
      setHasPermission(null);
      
      // Wait a bit to ensure previous streams are cleaned up
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if this attempt is still current
      if (currentAttempt !== initAttemptRef.current) {
        console.log('📱 Scanner: Initialization cancelled (newer attempt started)');
        return;
      }
      
      await requestCameraPermission();
    } catch (err) {
      console.error('📱 Scanner: Initialization failed:', err);
      if (currentAttempt === initAttemptRef.current) {
        setError('Failed to initialize camera');
        setHasPermission(false);
      }
    } finally {
      if (currentAttempt === initAttemptRef.current) {
        setIsInitializing(false);
      }
    }
  };

  const requestCameraPermission = async () => {
    console.log('📱 Scanner: Requesting camera permission with facingMode:', facingMode);
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }
    
    // Ultra-high resolution constraints specifically optimized for barcode scanning
    const constraintSets = [
      // 4K resolution for maximum barcode detail
      { 
        video: { 
          facingMode: { exact: facingMode },
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
          frameRate: { ideal: 60, min: 30 },
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous',
          zoom: 1.0
        },
        audio: false
      },
      // Ultra-high resolution alternative
      { 
        video: { 
          facingMode: { exact: facingMode },
          width: { ideal: 2560, min: 1920 },
          height: { ideal: 1440, min: 1080 },
          frameRate: { ideal: 60, min: 30 },
          focusMode: 'continuous',
          exposureMode: 'continuous'
        },
        audio: false
      },
      // High resolution with focus optimization
      { 
        video: { 
          facingMode: { exact: facingMode },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 30 },
          focusMode: 'continuous'
        },
        audio: false
      },
      // Standard high resolution
      { 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      },
      // Medium resolution fallback
      { 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      },
      // Basic resolution
      { 
        video: {
          width: { ideal: 1024, min: 640 },
          height: { ideal: 768, min: 480 }
        },
        audio: false
      },
      // Last resort
      { 
        video: true,
        audio: false
      }
    ];

    for (let i = 0; i < constraintSets.length; i++) {
      const constraints = constraintSets[i];
      console.log(`📱 Scanner: Trying constraint set ${i + 1}:`, constraints);
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('✅ Scanner: Camera permission granted with constraint set', i + 1);
        console.log('📱 Scanner: Stream details:', {
          active: stream.active,
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length
        });
        
        // Log video track settings
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          console.log('📱 Scanner: Video track settings:', settings);
        }
        
        setHasPermission(true);
        setError(null);
        setCameraReady(true);
        
        // Stop the stream immediately as QrScanner will handle it
        stream.getTracks().forEach(track => {
          console.log('📱 Scanner: Stopping track:', track.kind, track.label);
          track.stop();
        });
        
        return; // Success, exit the loop
        
      } catch (err: any) {
        console.error(`❌ Scanner: Constraint set ${i + 1} failed:`, {
          error: err,
          name: err?.name,
          message: err?.message,
          code: err?.code,
          constraint: err?.constraint
        });
        
        // If this is the last constraint set, handle the error
        if (i === constraintSets.length - 1) {
          setHasPermission(false);
          setCameraReady(false);
          
          let errorMessage = 'Camera access failed. Please check your camera permissions.';
          
          switch (err.name) {
            case 'NotAllowedError':
              errorMessage = 'Camera permission denied. Please allow camera access in your browser settings and refresh the page.';
              break;
            case 'NotFoundError':
              errorMessage = 'No camera found on this device.';
              break;
            case 'NotReadableError':
              errorMessage = 'Camera is already in use by another application. Please close other camera apps and try again.';
              break;
            case 'OverconstrainedError':
              errorMessage = 'Camera constraints not supported. Try switching camera or refreshing the page.';
              break;
            case 'SecurityError':
              errorMessage = 'Camera access blocked by security policy. Please check your browser settings.';
              break;
            case 'AbortError':
              errorMessage = 'Camera access was aborted. Please try again.';
              break;
            case 'TypeError':
              errorMessage = 'Invalid camera constraints. Please refresh the page and try again.';
              break;
            default:
              errorMessage = `Camera error: ${err.message || 'Unknown error'}`;
          }
          
          setError(errorMessage);
          onError?.(errorMessage);
        }
      }
    }
  };

  const handleScan = (result: any) => {
    console.log('📱 Scanner: Raw scan result received:', {
      result,
      type: typeof result,
      text: result?.text,
      data: result?.data
    });

    if (result?.text) {
      const scannedText = result.text.trim();
      const now = Date.now();
      
      console.log('📱 Scanner: Processing scanned text:', scannedText);
      console.log('📱 Scanner: Last scan:', lastScan, 'Time since last:', now - lastScanTimeRef.current);
      
      // Prevent duplicate scans within 1 second (reduced from 2 seconds)
      if (scannedText === lastScan && now - lastScanTimeRef.current < 1000) {
        console.log('📱 Scanner: Duplicate scan ignored (within 1 second)');
        return;
      }

      // Update scan tracking
      setLastScan(scannedText);
      lastScanTimeRef.current = now;
      setScanCount(prev => prev + 1);
      setIsScanning(true);
      
      console.log('📱 Scanner: Calling debounced result callback');
      // Call debounced onResult to prevent rapid state updates
      debouncedOnResult(scannedText);
    } else {
      console.log('📱 Scanner: No text found in scan result');
    }
  };

  const handleError = (error: any) => {
    console.error('❌ Scanner: QR Scanner error:', {
      error,
      name: error?.name,
      message: error?.message,
      code: error?.code,
      type: typeof error,
      stack: error?.stack
    });
    
    let errorMessage = 'Scanner error occurred. Please try again.';
    
    if (error?.message) {
      errorMessage = `Scanner error: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage = `Scanner error: ${error}`;
    }
    
    setError(errorMessage);
    onError?.(errorMessage);
  };

  const toggleCamera = () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    console.log('📱 Scanner: Switching camera from', facingMode, 'to', newFacingMode);
    
    setFacingMode(newFacingMode);
    setError(null);
    setLastScan(null);
    setCameraReady(false);
    setScanCount(0);
    lastScanTimeRef.current = 0;
  };

  const retryPermission = () => {
    console.log('📱 Scanner: Retrying camera permission');
    setError(null);
    setHasPermission(null);
    setLastScan(null);
    setCameraReady(false);
    setScanCount(0);
    lastScanTimeRef.current = 0;
    initializeCamera();
  };

  const refreshPage = () => {
    window.location.reload();
  };

  if (!isActive) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-muted rounded-lg", className)}>
        <div className="text-center">
          <CameraOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Camera scanner inactive</p>
        </div>
      </div>
    );
  }

  if (hasPermission === null || isInitializing) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-muted rounded-lg", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">
            {isInitializing ? 'Initializing high-resolution camera...' : 'Requesting camera permission...'}
          </p>
        </div>
      </div>
    );
  }

  if (hasPermission === false || error) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg", className)}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={retryPermission} variant="outline" size="sm" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry Camera
            </Button>
            <Button onClick={refreshPage} variant="outline" size="sm" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Troubleshooting:</strong><br />
              • Allow camera permissions in browser settings<br />
              • Close other camera apps<br />
              • Try refreshing the page<br />
              • Check if camera is working in other apps
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!cameraReady) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-sm text-yellow-700">Camera is starting up...</p>
        </div>
      </div>
    );
  }

  console.log('📱 Scanner: Rendering QR scanner with facingMode:', facingMode);

  return (
    <div className={cn("relative", className)}>
      <div className="relative bg-black rounded-lg overflow-hidden">
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
        
        {/* Ultra-enhanced scanning overlay optimized for barcodes */}
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
          
          {/* Secondary QR code area */}
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-40 h-40 border-3 border-yellow-400 border-dashed rounded-xl bg-yellow-400 bg-opacity-15 shadow-lg">
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <span className="text-yellow-400 text-sm font-bold bg-black bg-opacity-70 px-3 py-1 rounded-full">
                QR CODES
              </span>
            </div>
          </div>
          
          {/* Additional scanning guides */}
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 w-72 h-24 border-2 border-blue-400 border-dashed rounded-lg bg-blue-400 bg-opacity-10">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-blue-400 text-sm font-bold bg-black bg-opacity-60 px-3 py-1 rounded">
                ALTERNATIVE SCAN AREA
              </span>
            </div>
          </div>

          {/* Scanning status indicator */}
          {isScanning && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-4 py-2 rounded-full shadow-lg animate-pulse">
                <Zap className="h-4 w-4" />
                <span className="font-bold">SCANNING...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <Camera className="h-3 w-3 mr-1" />
            {facingMode === 'environment' ? 'Back Camera (Recommended)' : 'Front Camera'}
          </Badge>
          {scanCount > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              <Zap className="h-3 w-3 mr-1" />
              {scanCount} scans
            </Badge>
          )}
          {lastScan && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Last: {lastScan.substring(0, 12)}...
            </Badge>
          )}
        </div>
        
        <Button
          onClick={toggleCamera}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Switch Camera
        </Button>
      </div>

      {/* Ultra-enhanced instructions for barcode scanning */}
      <div className="mt-4 space-y-3">
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
          <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-sm text-blue-700 text-center font-medium">
              🔄 ALTERNATIVE<br />
              <span className="text-xs">Blue dashed area</span>
            </p>
          </div>
        </div>
        
        <div className="p-3 bg-green-50 border border-green-300 rounded-lg">
          <p className="text-sm text-green-800 text-center">
            💡 <strong>Pro Tips:</strong> Use back camera • Clean camera lens • Avoid shadows • Keep device steady • Try different angles if not detecting
          </p>
        </div>
      </div>

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
          <div>Permission: {hasPermission ? 'Granted' : 'Denied'}</div>
          <div>Facing: {facingMode}</div>
          <div>Camera Ready: {cameraReady ? 'Yes' : 'No'}</div>
          <div>Scan Count: {scanCount}</div>
          <div>Last scan: {lastScan || 'None'}</div>
          <div>Error: {error || 'None'}</div>
          <div>Initializing: {isInitializing ? 'Yes' : 'No'}</div>
          <div>Is Scanning: {isScanning ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
}
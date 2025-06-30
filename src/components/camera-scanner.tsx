import { useState, useEffect, useRef, useCallback } from 'react';
import QrScanner from 'react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
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
  const lastScanTimeRef = useRef<number>(0);
  const initAttemptRef = useRef<number>(0);

  // Create debounced version of onResult callback
  const debouncedOnResult = useCallback(
    debounce((data: string) => {
      console.log('📱 Scanner: Debounced result callback triggered with:', data);
      onResult(data);
    }, 500), // 500ms debounce delay
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
    }
  }, [isActive, facingMode]);

  const initializeCamera = async () => {
    setIsInitializing(true);
    initAttemptRef.current += 1;
    const currentAttempt = initAttemptRef.current;
    
    try {
      setError(null);
      setHasPermission(null);
      
      // Wait a bit to ensure previous streams are cleaned up
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
    
    // Progressive fallback strategy for mobile devices
    const constraintSets = [
      // Try with specific facing mode and ideal resolution
      { 
        video: { 
          facingMode: { exact: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      },
      // Try with preferred facing mode
      { 
        video: { 
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      },
      // Try with just facing mode
      { 
        video: { 
          facingMode: facingMode
        } 
      },
      // Try with any camera
      { 
        video: true 
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
      const scannedText = result.text;
      const now = Date.now();
      
      console.log('📱 Scanner: Processing scanned text:', scannedText);
      console.log('📱 Scanner: Last scan:', lastScan, 'Time since last:', now - lastScanTimeRef.current);
      
      // Prevent duplicate scans within 2 seconds
      if (scannedText === lastScan && now - lastScanTimeRef.current < 2000) {
        console.log('📱 Scanner: Duplicate scan ignored (within 2 seconds)');
        return;
      }

      // Update last scan tracking
      setLastScan(scannedText);
      lastScanTimeRef.current = now;
      
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
    lastScanTimeRef.current = 0;
  };

  const retryPermission = () => {
    console.log('📱 Scanner: Retrying camera permission');
    setError(null);
    setHasPermission(null);
    setLastScan(null);
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
            {isInitializing ? 'Initializing camera...' : 'Requesting camera permission...'}
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

  console.log('📱 Scanner: Rendering QR scanner with facingMode:', facingMode);

  return (
    <div className={cn("relative", className)}>
      <div className="relative bg-black rounded-lg overflow-hidden">
        <QrScanner
          onDecode={handleScan}
          onError={handleError}
          constraints={{
            facingMode,
            aspectRatio: 1
          }}
          containerStyle={{
            width: '100%',
            height: '300px'
          }}
          videoStyle={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        
        {/* Scanning overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner brackets */}
          <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-white"></div>
          <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-white"></div>
          <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-white"></div>
          <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-white"></div>
          
          {/* Scanning line animation */}
          <div className="absolute inset-x-4 top-1/2 h-0.5 bg-white opacity-75 animate-pulse"></div>
          
          {/* Center target */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white border-dashed rounded-lg"></div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <Camera className="h-3 w-3 mr-1" />
            {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
          </Badge>
          {lastScan && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Last: {lastScan.substring(0, 10)}...
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
          Flip Camera
        </Button>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700 text-center">
          Position the barcode or QR code within the frame to scan
        </p>
      </div>

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
          <div>Permission: {hasPermission ? 'Granted' : 'Denied'}</div>
          <div>Facing: {facingMode}</div>
          <div>Last scan: {lastScan || 'None'}</div>
          <div>Error: {error || 'None'}</div>
          <div>Initializing: {isInitializing ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
}
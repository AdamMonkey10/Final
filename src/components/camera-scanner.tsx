import { useState, useEffect, useRef, useCallback } from 'react';
import QrScanner from 'react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
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
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const scannerRef = useRef<HTMLDivElement>(null);
  const lastScanTimeRef = useRef<number>(0);

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
      requestCameraPermission();
    } else {
      console.log('📱 Scanner: Component deactivated');
    }
  }, [isActive]);

  const requestCameraPermission = async () => {
    console.log('📱 Scanner: Requesting camera permission with facingMode:', facingMode);
    try {
      const constraints = { 
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      };
      
      console.log('📱 Scanner: Using constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Scanner: Camera permission granted');
      console.log('📱 Scanner: Stream details:', {
        active: stream.active,
        tracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length
      });
      
      setHasPermission(true);
      setError(null);
      
      // Stop the stream immediately as QrScanner will handle it
      stream.getTracks().forEach(track => {
        console.log('📱 Scanner: Stopping track:', track.kind, track.label);
        track.stop();
      });
    } catch (err: any) {
      console.error('❌ Scanner: Camera permission error:', {
        error: err,
        name: err?.name,
        message: err?.message,
        code: err?.code,
        constraint: err?.constraint
      });
      
      setHasPermission(false);
      
      let errorMessage = 'Camera access failed. Please check your camera and try again.';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not supported. Trying with basic settings.';
        // Try again with basic constraints
        setTimeout(() => {
          console.log('📱 Scanner: Retrying with basic constraints');
          requestBasicCameraPermission();
        }, 1000);
        return;
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera access blocked by security policy.';
      }
      
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const requestBasicCameraPermission = async () => {
    try {
      console.log('📱 Scanner: Trying basic camera constraints');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      console.log('✅ Scanner: Basic camera permission granted');
      setHasPermission(true);
      setError(null);
      
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      console.error('❌ Scanner: Basic camera permission also failed:', err);
      setError('Camera access failed completely. Please check your device settings.');
      onError?.('Camera access failed completely. Please check your device settings.');
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
      
      // Brief visual feedback
      setIsScanning(false);
      setTimeout(() => setIsScanning(true), 200);
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
    requestCameraPermission();
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

  if (hasPermission === null) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-muted rounded-lg", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Requesting camera permission...</p>
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
          <Button onClick={retryPermission} variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
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
        </div>
      )}
    </div>
  );
}
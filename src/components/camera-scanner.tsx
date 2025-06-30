import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, RefreshCw, Zap } from 'lucide-react';
// Simple utility function to combine class names
const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface CameraScannerProps {
  onResult: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
  isActive?: boolean;
}

// Simple debounce utility
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

export default function CameraScanner({ 
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initAttemptRef = useRef<number>(0);

  // Create debounced version of onResult callback
  const debouncedOnResult = useCallback(
    debounce((data: string) => {
      console.log('📱 Scanner: Debounced result callback triggered with:', data);
      onResult(data);
      setIsScanning(false);
    }, 500),
    [onResult]
  );

  // QR Scanner instance
  const qrScannerRef = useRef<any>(null);

  useEffect(() => {
    if (isActive) {
      console.log('📱 Scanner: Component activated');
      initializeCamera();
    } else {
      console.log('📱 Scanner: Component deactivated');
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [isActive, facingMode]);

  const cleanup = () => {
    // Stop QR scanner first
    if (qrScannerRef.current) {
      console.log('📱 Scanner: Stopping QR scanner');
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    
    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
      scanningIntervalRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('📱 Scanner: Stopping track:', track.kind);
        track.stop();
      });
      setStream(null);
    }
    
    setHasPermission(null);
    setError(null);
    setCameraReady(false);
    setIsScanning(false);
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    setCameraReady(false);
    initAttemptRef.current += 1;
    const currentAttempt = initAttemptRef.current;
    
    try {
      setError(null);
      setHasPermission(null);
      
      // Clean up any existing stream
      cleanup();
      
      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (currentAttempt !== initAttemptRef.current) {
        console.log('📱 Scanner: Initialization cancelled');
        return;
      }
      
      await requestCameraPermission();
      
      if (currentAttempt === initAttemptRef.current) {
        startScanning();
      }
    } catch (err) {
      console.error('📱 Scanner: Initialization failed:', err);
      if (currentAttempt === initAttemptRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to initialize camera');
        setHasPermission(false);
      }
    } finally {
      if (currentAttempt === initAttemptRef.current) {
        setIsInitializing(false);
      }
    }
  };

  const requestCameraPermission = async () => {
    console.log('📱 Scanner: Requesting camera permission');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }
    
    // Simplified constraints that work better across devices
    const constraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30 }
      },
      audio: false
    };

    console.log('📱 Scanner: Requesting stream with constraints:', constraints);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Scanner: Camera permission granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setStream(mediaStream);
      setHasPermission(true);
      setError(null);
      setCameraReady(true);
      
    } catch (err: any) {
      console.error('❌ Scanner: Camera permission failed:', err);
      
      let errorMessage = 'Camera access failed';
      
      switch (err.name) {
        case 'NotAllowedError':
          errorMessage = 'Camera permission denied. Please allow camera access and refresh.';
          break;
        case 'NotFoundError':
          errorMessage = 'No camera found on this device.';
          break;
        case 'NotReadableError':
          errorMessage = 'Camera is in use by another application.';
          break;
        case 'OverconstrainedError':
          errorMessage = 'Camera constraints not supported.';
          break;
        default:
          errorMessage = `Camera error: ${err.message || 'Unknown error'}`;
      }
      
      setError(errorMessage);
      setHasPermission(false);
      onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const startScanning = async () => {
    console.log('📱 Scanner: Starting QR/Barcode scanning');
    
    if (!videoRef.current) {
      console.error('📱 Scanner: Video ref not available');
      return;
    }

    try {
      // Import and initialize QR scanner
      const QrScanner = (await import('https://cdnjs.cloudflare.com/ajax/libs/qr-scanner/1.4.2/qr-scanner.min.js')).default;
      
      console.log('📱 Scanner: QR Scanner loaded, initializing...');
      
      // Create QR scanner instance
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result: any) => {
          console.log('📱 Scanner: QR Code detected:', result);
          handleScanResult(result.data || result);
        },
        {
          onDecodeError: (error: any) => {
            // Don't log decode errors as they're normal when no code is visible
            setIsScanning(false);
          },
          highlightScanRegion: false,
          highlightCodeOutline: false,
          preferredCamera: facingMode,
          maxScansPerSecond: 5
        }
      );

      // Start scanning
      await qrScannerRef.current.start();
      console.log('✅ Scanner: QR scanner started successfully');
      setIsScanning(true);
      
    } catch (error) {
      console.error('📱 Scanner: Failed to initialize QR scanner:', error);
      
      // Fallback to BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        console.log('📱 Scanner: Falling back to BarcodeDetector');
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: [
            'aztec', 'code_128', 'code_39', 'code_93', 'codabar', 'data_matrix',
            'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e'
          ]
        });
        
        scanningIntervalRef.current = setInterval(async () => {
          await scanWithBarcodeDetector(barcodeDetector);
        }, 200);
      } else {
        setError('No barcode scanning support available in this browser. Please try Chrome or Edge.');
      }
    }
  };

  const scanWithBarcodeDetector = async (detector: any) => {
    if (!videoRef.current || videoRef.current.readyState !== 4) return;
    
    try {
      const barcodes = await detector.detect(videoRef.current);
      
      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        console.log('📱 Scanner: Barcode detected:', barcode);
        handleScanResult(barcode.rawValue);
        setIsScanning(true);
      } else {
        setIsScanning(false);
      }
    } catch (error) {
      // Silently continue - detection errors are common
      setIsScanning(false);
    }
  };

  const scanWithCanvas = () => {
    // This is a placeholder - without a proper QR/barcode detection library,
    // we can't actually detect codes from canvas data
    setIsScanning(false);
  };

  const handleScanResult = (result: string) => {
    if (!result || typeof result !== 'string') return;
    
    const scannedText = result.trim();
    const now = Date.now();
    
    console.log('📱 Scanner: Processing scanned text:', scannedText);
    
    // Prevent duplicate scans within 2 seconds
    if (scannedText === lastScan && now - lastScanTimeRef.current < 2000) {
      console.log('📱 Scanner: Duplicate scan ignored');
      return;
    }

    // Update scan tracking
    setLastScan(scannedText);
    lastScanTimeRef.current = now;
    setScanCount(prev => prev + 1);
    setIsScanning(true);
    
    console.log('📱 Scanner: Calling result callback');
    debouncedOnResult(scannedText);
  };

  const toggleCamera = () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    console.log('📱 Scanner: Switching camera to', newFacingMode);
    setFacingMode(newFacingMode);
  };

  const retryPermission = () => {
    console.log('📱 Scanner: Retrying camera permission');
    setError(null);
    setLastScan(null);
    setScanCount(0);
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
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-96 object-cover"
          onLoadedMetadata={() => {
            console.log('📱 Scanner: Video loaded');
            setCameraReady(true);
            // Start scanning once video is ready
            setTimeout(startScanning, 500);
          }}
        />
        
        {/* Hidden canvas for image processing */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Scanning overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner brackets */}
          <div className="absolute top-4 left-4 w-16 h-16 border-l-4 border-t-4 border-white rounded-tl-lg opacity-80"></div>
          <div className="absolute top-4 right-4 w-16 h-16 border-r-4 border-t-4 border-white rounded-tr-lg opacity-80"></div>
          <div className="absolute bottom-4 left-4 w-16 h-16 border-l-4 border-b-4 border-white rounded-bl-lg opacity-80"></div>
          <div className="absolute bottom-4 right-4 w-16 h-16 border-r-4 border-b-4 border-white rounded-br-lg opacity-80"></div>
          
          {/* Main scanning area */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-48 border-2 border-red-500 rounded-lg bg-red-500 bg-opacity-10">
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
              <span className="text-white text-sm font-bold bg-red-500 bg-opacity-90 px-3 py-1 rounded-full">
                Scan Code Here
              </span>
            </div>
            
            {/* Scanning line animation */}
            <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-400 animate-pulse"></div>
            
            {/* Center crosshair */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6">
              <div className="absolute top-1/2 left-0 w-full h-px bg-white opacity-60"></div>
              <div className="absolute left-1/2 top-0 w-px h-full bg-white opacity-60"></div>
            </div>
          </div>
          
          {/* Scanning status */}
          {isScanning && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-3 py-1 rounded-full animate-pulse">
                <Zap className="h-4 w-4" />
                <span className="font-bold">Scanning...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <Camera className="h-3 w-3 mr-1" />
            {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
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
          Switch Camera
        </Button>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 text-center">
          <strong>📱 Position your QR code or barcode within the red frame</strong><br />
          Hold steady for best results • Ensure good lighting • Keep code flat and clean
        </p>
        
        {/* Browser compatibility note */}
        <div className="mt-2 text-xs text-blue-600 text-center">
          {qrScannerRef.current ? (
            <span className="text-green-600">✅ QR Scanner active and ready</span>
          ) : 'BarcodeDetector' in window ? (
            <span className="text-orange-600">⚠️ Using fallback barcode detection</span>
          ) : (
            <span className="text-red-600">❌ Limited scanning support - please use Chrome or Edge</span>
          )}
        </div>
      </div>
    </div>
  );
}
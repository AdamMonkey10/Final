import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initAttemptRef = useRef<number>(0);
  const barcodeDetectorRef = useRef<any>(null);

  // Create debounced version of onResult callback
  const debouncedOnResult = useCallback(
    debounce((data: string) => {
      console.log('📱 Scanner: Debounced result callback triggered with:', data);
      onResult(data);
      setIsScanning(false);
    }, 500),
    [onResult]
  );

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
    console.log('📱 Scanner: Starting barcode scanning');
    
    if (!videoRef.current) {
      console.error('📱 Scanner: Video ref not available');
      return;
    }

    try {
      // Check if BarcodeDetector is available (Chrome/Edge)
      if ('BarcodeDetector' in window) {
        console.log('📱 Scanner: Using BarcodeDetector API');
        
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: [
            'aztec', 'code_128', 'code_39', 'code_93', 'codabar', 'data_matrix',
            'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e'
          ]
        });
        
        scanningIntervalRef.current = setInterval(async () => {
          await scanWithBarcodeDetector();
        }, 300);
        
        console.log('✅ Scanner: BarcodeDetector scanning started');
      } else {
        console.log('📱 Scanner: BarcodeDetector not available, showing manual input option');
        setShowManualInput(true);
      }
      
    } catch (error) {
      console.error('📱 Scanner: Failed to initialize barcode scanning:', error);
      setShowManualInput(true);
    }
  };

  const scanWithBarcodeDetector = async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4 || !barcodeDetectorRef.current) {
      return;
    }
    
    try {
      const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
      
      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        console.log('📱 Scanner: Barcode detected:', barcode);
        handleScanResult(barcode.rawValue);
        setIsScanning(true);
        
        // Brief pause after successful scan
        setTimeout(() => setIsScanning(false), 1000);
      } else {
        setIsScanning(false);
      }
    } catch (error) {
      // Silently continue - detection errors are common
      setIsScanning(false);
    }
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScanResult(manualInput.trim());
      setManualInput('');
    }
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
    setShowManualInput(false);
    initializeCamera();
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
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          
          {/* Manual input fallback */}
          <div className="space-y-3">
            <p className="text-xs text-gray-600">Or enter barcode manually:</p>
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter barcode/QR code"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <Button type="submit" size="sm" className="w-full">
                Submit Code
              </Button>
            </form>
          </div>
          
          <div className="space-y-2">
            <Button onClick={retryPermission} variant="outline" size="sm" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry Camera
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

      {/* Manual input option */}
      {showManualInput && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 mb-3">
            <strong>Manual Entry Available</strong><br />
            Camera scanning may not be fully supported in this browser.
          </p>
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter barcode or QR code manually"
              className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm"
            />
            <Button type="submit" size="sm" className="w-full">
              Submit Code
            </Button>
          </form>
        </div>
      )}

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
          {barcodeDetectorRef.current ? (
            <span className="text-green-600">✅ Barcode detection active and ready</span>
          ) : showManualInput ? (
            <span className="text-orange-600">⚠️ Manual input mode - camera scanning limited</span>
          ) : (
            <span className="text-blue-600">🔄 Initializing scanner...</span>
          )}
        </div>
      </div>
    </div>
  );
}
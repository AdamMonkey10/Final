import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, RefreshCw, Zap, Keyboard } from 'lucide-react';
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
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    console.log('📱 Scanner: Cleaning up resources');
    
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
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
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
      videoRef.current.oncanplay = null;
      videoRef.current.onplay = null;
      videoRef.current.onerror = null;
    }
    
    barcodeDetectorRef.current = null;
    setCameraReady(false);
    setIsScanning(false);
    setVideoLoaded(false);
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    setError(null);
    setHasPermission(null);
    setVideoLoaded(false);
    
    // Set a timeout to prevent infinite loading
    initTimeoutRef.current = setTimeout(() => {
      console.log('📱 Scanner: Initialization timeout - falling back to manual input');
      setIsInitializing(false);
      setShowManualInput(true);
      setError('Camera initialization timed out. Please use manual input or refresh the page.');
    }, 10000); // 10 second timeout
    
    try {
      console.log('📱 Scanner: Starting camera initialization');
      
      // Clean up any existing resources
      cleanup();
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await requestCameraPermission();
      
    } catch (err) {
      console.error('📱 Scanner: Initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize camera');
      setHasPermission(false);
      setShowManualInput(true);
      onError?.(err instanceof Error ? err.message : 'Failed to initialize camera');
    } finally {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      setIsInitializing(false);
    }
  };

  const requestCameraPermission = async () => {
    console.log('📱 Scanner: Requesting camera permission');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }
    
    // Try multiple constraint configurations
    const constraintOptions = [
      // First try: Ideal settings
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: false
      },
      // Second try: Basic settings
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      },
      // Third try: Minimal settings
      {
        video: {
          facingMode: facingMode
        },
        audio: false
      },
      // Last resort: Any video
      {
        video: true,
        audio: false
      }
    ];

    let mediaStream: MediaStream | null = null;
    let lastError: Error | null = null;

    for (const constraints of constraintOptions) {
      try {
        console.log('📱 Scanner: Trying constraints:', constraints);
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Scanner: Camera permission granted with constraints');
        break;
      } catch (err: any) {
        console.warn('📱 Scanner: Constraints failed:', err);
        lastError = err;
        continue;
      }
    }

    if (!mediaStream) {
      throw lastError || new Error('Failed to get camera stream');
    }
    
    console.log('📱 Scanner: Stream active:', mediaStream.active);
    console.log('📱 Scanner: Video tracks:', mediaStream.getVideoTracks().length);
    
    setStream(mediaStream);
    setHasPermission(true);
    setError(null);
    
    // Set up video element
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      
      // Add event listeners with better error handling
      videoRef.current.onloadedmetadata = () => {
        console.log('📱 Scanner: Video metadata loaded');
        console.log('📱 Scanner: Video dimensions:', {
          videoWidth: videoRef.current?.videoWidth,
          videoHeight: videoRef.current?.videoHeight
        });
        setVideoLoaded(true);
      };
      
      videoRef.current.oncanplay = () => {
        console.log('📱 Scanner: Video can play');
        setCameraReady(true);
        // Start scanning after video is ready
        setTimeout(() => {
          startScanning();
        }, 500);
      };

      videoRef.current.onplay = () => {
        console.log('📱 Scanner: Video is playing');
      };
      
      videoRef.current.onerror = (e) => {
        console.error('📱 Scanner: Video error:', e);
        setError('Video playback failed');
        setShowManualInput(true);
      };
      
      // Start playing the video with multiple attempts
      let playAttempts = 0;
      const tryPlay = async () => {
        if (!videoRef.current || playAttempts >= 3) {
          if (playAttempts >= 3) {
            console.error('📱 Scanner: Failed to play video after 3 attempts');
            setShowManualInput(true);
          }
          return;
        }
        
        try {
          playAttempts++;
          console.log(`📱 Scanner: Play attempt ${playAttempts}`);
          await videoRef.current.play();
          console.log('📱 Scanner: Video playing successfully');
        } catch (playError) {
          console.warn(`📱 Scanner: Video play attempt ${playAttempts} failed:`, playError);
          if (playAttempts < 3) {
            // Try again after a delay
            setTimeout(tryPlay, 1000);
          } else {
            console.error('📱 Scanner: All play attempts failed');
            setShowManualInput(true);
          }
        }
      };
      
      // Start the first play attempt
      tryPlay();
    }
  };

  const startScanning = async () => {
    console.log('📱 Scanner: Starting barcode scanning');
    
    if (!videoRef.current || !cameraReady || !videoLoaded) {
      console.log('📱 Scanner: Video not ready for scanning', {
        videoRef: !!videoRef.current,
        cameraReady,
        videoLoaded
      });
      return;
    }

    try {
      // Check if BarcodeDetector is available (Chrome/Edge)
      if ('BarcodeDetector' in window) {
        console.log('📱 Scanner: Using BarcodeDetector API');
        
        try {
          barcodeDetectorRef.current = new (window as any).BarcodeDetector({
            formats: [
              'code_128', 'code_39', 'code_93', 'codabar', 
              'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e',
              'qr_code', 'data_matrix', 'pdf417', 'aztec'
            ]
          });
          
          // Start scanning interval
          scanningIntervalRef.current = setInterval(async () => {
            await scanWithBarcodeDetector();
          }, 300); // Scan every 300ms
          
          console.log('✅ Scanner: BarcodeDetector scanning started');
        } catch (detectorError) {
          console.error('📱 Scanner: BarcodeDetector creation failed:', detectorError);
          setShowManualInput(true);
        }
      } else {
        console.log('📱 Scanner: BarcodeDetector not available, showing manual input');
        setShowManualInput(true);
      }
      
    } catch (error) {
      console.error('📱 Scanner: Failed to initialize barcode scanning:', error);
      setShowManualInput(true);
    }
  };

  const scanWithBarcodeDetector = async () => {
    if (!videoRef.current || 
        videoRef.current.readyState !== 4 || 
        !barcodeDetectorRef.current ||
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0) {
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
        setTimeout(() => setIsScanning(false), 1500);
      } else {
        setIsScanning(false);
      }
    } catch (error) {
      // Silently continue - detection errors are common when no barcode is visible
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
          <p className="text-xs text-muted-foreground mt-2">
            This may take a few seconds. Manual input will be available if camera fails.
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
            <p className="text-xs text-gray-600">Enter barcode manually:</p>
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <Input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter barcode/QR code"
                className="text-sm"
                autoFocus
              />
              <Button type="submit" size="sm" className="w-full">
                <Keyboard className="h-4 w-4 mr-2" />
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
          style={{ 
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' 
          }}
        />
        
        {/* Loading overlay while camera is starting */}
        {(!cameraReady || !videoLoaded) && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-sm">
                {!videoLoaded ? 'Loading video...' : 'Starting camera...'}
              </p>
            </div>
          </div>
        )}
        
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
                <span className="font-bold">Code Detected!</span>
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
            <Input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter barcode or QR code manually"
              className="border-yellow-300"
            />
            <Button type="submit" size="sm" className="w-full">
              <Keyboard className="h-4 w-4 mr-2" />
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
          disabled={!cameraReady}
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
          ) : cameraReady && videoLoaded ? (
            <span className="text-blue-600">🔄 Initializing scanner...</span>
          ) : (
            <span className="text-gray-600">📹 Camera starting...</span>
          )}
        </div>
      </div>
    </div>
  );
}
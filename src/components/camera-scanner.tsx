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
  const [videoPlaying, setVideoPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

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
      retryCountRef.current = 0;
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
        console.log('📱 Scanner: Stopping track:', track.kind, track.label);
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
      videoRef.current.onloadstart = null;
      videoRef.current.onplaying = null;
    }
    
    barcodeDetectorRef.current = null;
    setCameraReady(false);
    setIsScanning(false);
    setVideoLoaded(false);
    setVideoPlaying(false);
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    setError(null);
    setHasPermission(null);
    setVideoLoaded(false);
    setVideoPlaying(false);
    setCameraReady(false);
    
    // Clean up any existing resources first
    cleanup();
    
    // Set a timeout to prevent infinite loading
    initTimeoutRef.current = setTimeout(() => {
      console.log('📱 Scanner: Initialization timeout - falling back to manual input');
      setIsInitializing(false);
      setShowManualInput(true);
      setError('Camera initialization timed out. Using manual input mode.');
      onError?.('Camera initialization timed out');
    }, 8000); // 8 second timeout
    
    try {
      console.log('📱 Scanner: Starting camera initialization, attempt:', retryCountRef.current + 1);
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await requestCameraPermission();
      
    } catch (err) {
      console.error('📱 Scanner: Initialization failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize camera';
      setError(errorMessage);
      setHasPermission(false);
      setShowManualInput(true);
      onError?.(errorMessage);
      
      // Auto-retry once if it's the first attempt
      if (retryCountRef.current === 0) {
        retryCountRef.current++;
        console.log('📱 Scanner: Auto-retrying initialization...');
        setTimeout(() => {
          if (isActive) {
            initializeCamera();
          }
        }, 2000);
      }
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
    
    // Try multiple constraint configurations in order of preference
    const constraintOptions = [
      // First try: Specific facing mode with good quality
      {
        video: {
          facingMode: { exact: facingMode },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      // Second try: Preferred facing mode
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      },
      // Third try: Any camera with facing mode preference
      {
        video: {
          facingMode: facingMode
        },
        audio: false
      },
      // Fourth try: Any video device
      {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      },
      // Last resort: Basic video
      {
        video: true,
        audio: false
      }
    ];

    let mediaStream: MediaStream | null = null;
    let lastError: Error | null = null;

    for (let i = 0; i < constraintOptions.length; i++) {
      const constraints = constraintOptions[i];
      try {
        console.log(`📱 Scanner: Trying constraints ${i + 1}/${constraintOptions.length}:`, constraints);
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Scanner: Camera permission granted');
        break;
      } catch (err: any) {
        console.warn(`📱 Scanner: Constraints ${i + 1} failed:`, err.name, err.message);
        lastError = err;
        
        // If exact facing mode fails, continue with other options
        if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
          continue;
        }
        
        // For permission errors, don't try other constraints
        if (err.name === 'NotAllowedError') {
          break;
        }
      }
    }

    if (!mediaStream) {
      const errorMessage = lastError?.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access and try again.'
        : lastError?.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : lastError?.name === 'NotReadableError'
        ? 'Camera is already in use by another application.'
        : `Camera access failed: ${lastError?.message || 'Unknown error'}`;
      
      throw new Error(errorMessage);
    }
    
    console.log('📱 Scanner: Stream details:', {
      active: mediaStream.active,
      videoTracks: mediaStream.getVideoTracks().length,
      audioTracks: mediaStream.getAudioTracks().length
    });
    
    // Verify the stream has video tracks
    const videoTracks = mediaStream.getVideoTracks();
    if (videoTracks.length === 0) {
      mediaStream.getTracks().forEach(track => track.stop());
      throw new Error('No video track available in the media stream');
    }
    
    console.log('📱 Scanner: Video track settings:', videoTracks[0].getSettings());
    
    setStream(mediaStream);
    setHasPermission(true);
    setError(null);
    
    // Set up video element with comprehensive event handling
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Clear any existing event listeners
      video.onloadstart = null;
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onplay = null;
      video.onplaying = null;
      video.onerror = null;
      
      // Set up new event listeners
      video.onloadstart = () => {
        console.log('📱 Scanner: Video load started');
      };
      
      video.onloadedmetadata = () => {
        console.log('📱 Scanner: Video metadata loaded');
        console.log('📱 Scanner: Video dimensions:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          duration: video.duration
        });
        setVideoLoaded(true);
      };
      
      video.oncanplay = () => {
        console.log('📱 Scanner: Video can play');
        // Don't set camera ready here, wait for actual playing
      };

      video.onplay = () => {
        console.log('📱 Scanner: Video play event fired');
      };
      
      video.onplaying = () => {
        console.log('📱 Scanner: Video is actually playing');
        setVideoPlaying(true);
        setCameraReady(true);
        
        // Start scanning after a short delay to ensure video is stable
        setTimeout(() => {
          if (videoRef.current && !videoRef.current.paused) {
            startScanning();
          }
        }, 1000);
      };
      
      video.onerror = (e) => {
        console.error('📱 Scanner: Video error:', e);
        const target = e.target as HTMLVideoElement;
        const error = target.error;
        console.error('📱 Scanner: Video error details:', {
          code: error?.code,
          message: error?.message,
          MEDIA_ERR_ABORTED: error?.MEDIA_ERR_ABORTED,
          MEDIA_ERR_NETWORK: error?.MEDIA_ERR_NETWORK,
          MEDIA_ERR_DECODE: error?.MEDIA_ERR_DECODE,
          MEDIA_ERR_SRC_NOT_SUPPORTED: error?.MEDIA_ERR_SRC_NOT_SUPPORTED
        });
        setError('Video playback failed');
        setShowManualInput(true);
      };
      
      // Set the stream
      video.srcObject = mediaStream;
      
      // Force video properties
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      
      // Start playing with retry logic
      let playAttempts = 0;
      const maxPlayAttempts = 5;
      
      const tryPlay = async () => {
        if (!video || playAttempts >= maxPlayAttempts) {
          if (playAttempts >= maxPlayAttempts) {
            console.error('📱 Scanner: Failed to play video after maximum attempts');
            setError('Failed to start video playback');
            setShowManualInput(true);
          }
          return;
        }
        
        try {
          playAttempts++;
          console.log(`📱 Scanner: Play attempt ${playAttempts}/${maxPlayAttempts}`);
          
          // Ensure video is ready
          if (video.readyState < 2) {
            console.log('📱 Scanner: Video not ready, waiting...');
            setTimeout(tryPlay, 500);
            return;
          }
          
          await video.play();
          console.log('📱 Scanner: Video play() succeeded');
          
        } catch (playError: any) {
          console.warn(`📱 Scanner: Play attempt ${playAttempts} failed:`, playError.name, playError.message);
          
          if (playAttempts < maxPlayAttempts) {
            // Wait longer between retries
            const delay = Math.min(1000 * playAttempts, 3000);
            setTimeout(tryPlay, delay);
          } else {
            console.error('📱 Scanner: All play attempts failed');
            setError('Unable to start video playback');
            setShowManualInput(true);
          }
        }
      };
      
      // Start the first play attempt after a brief delay
      setTimeout(tryPlay, 100);
    }
  };

  const startScanning = async () => {
    console.log('📱 Scanner: Starting barcode scanning');
    
    if (!videoRef.current || !cameraReady || !videoLoaded || !videoPlaying) {
      console.log('📱 Scanner: Video not ready for scanning', {
        videoRef: !!videoRef.current,
        cameraReady,
        videoLoaded,
        videoPlaying,
        paused: videoRef.current?.paused,
        readyState: videoRef.current?.readyState
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
          }, 250); // Scan every 250ms for better responsiveness
          
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
        videoRef.current.paused ||
        !barcodeDetectorRef.current ||
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0) {
      return;
    }
    
    try {
      const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
      
      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        console.log('📱 Scanner: Barcode detected:', {
          format: barcode.format,
          rawValue: barcode.rawValue,
          boundingBox: barcode.boundingBox
        });
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
    console.log('📱 Scanner: Manual retry requested');
    setError(null);
    setLastScan(null);
    setScanCount(0);
    setShowManualInput(false);
    retryCountRef.current = 0;
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
          {retryCountRef.current > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              Retry attempt {retryCountRef.current}
            </p>
          )}
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
        {(!cameraReady || !videoLoaded || !videoPlaying) && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-sm">
                {!videoLoaded ? 'Loading video feed...' : 
                 !videoPlaying ? 'Starting video playback...' : 
                 'Initializing scanner...'}
              </p>
              <p className="text-xs opacity-75 mt-1">
                Camera: {facingMode === 'environment' ? 'Back' : 'Front'}
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
        
        <div className="flex gap-2">
          <Button
            onClick={toggleCamera}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={!hasPermission || isInitializing}
          >
            <RotateCcw className="h-4 w-4" />
            Switch
          </Button>
          <Button
            onClick={retryPermission}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={isInitializing}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 text-center">
          <strong>📱 Position your QR code or barcode within the red frame</strong><br />
          Hold steady for best results • Ensure good lighting • Keep code flat and clean
        </p>
        
        {/* Status indicator */}
        <div className="mt-2 text-xs text-center">
          {barcodeDetectorRef.current && cameraReady && videoPlaying ? (
            <span className="text-green-600">✅ Scanner active and ready</span>
          ) : showManualInput ? (
            <span className="text-orange-600">⚠️ Manual input mode - camera scanning limited</span>
          ) : cameraReady && videoLoaded ? (
            <span className="text-blue-600">🔄 Starting scanner...</span>
          ) : videoLoaded ? (
            <span className="text-blue-600">📹 Starting video...</span>
          ) : (
            <span className="text-gray-600">📹 Loading camera...</span>
          )}
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, RefreshCw, Zap, Smartphone, Monitor } from 'lucide-react';
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Enhanced diagnostic states
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [streamInfo, setStreamInfo] = useState<{ tracks: number; active: boolean; constraints: any }>({ tracks: 0, active: false, constraints: null });
  const [deviceInfo, setDeviceInfo] = useState<{ isMobile: boolean; userAgent: string; platform: string }>({
    isMobile: false,
    userAgent: '',
    platform: ''
  });
  const [retryCount, setRetryCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initAttemptRef = useRef<number>(0);
  const barcodeDetectorRef = useRef<any>(null);

  // Detect device info on mount
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const platform = navigator.platform || 'Unknown';
    
    setDeviceInfo({
      isMobile,
      userAgent,
      platform
    });
    
    console.log('📱 Device Info:', { isMobile, userAgent, platform });
  }, []);

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
        console.log('📱 Scanner: Stopping track:', track.kind, track.label);
        track.stop();
      });
      setStream(null);
      setStreamInfo({ tracks: 0, active: false, constraints: null });
    }
    
    setHasPermission(null);
    setError(null);
    setCameraReady(false);
    setIsScanning(false);
    setPlaybackStatus('idle');
    setVideoDimensions({ width: 0, height: 0 });
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    setCameraReady(false);
    setPlaybackStatus('loading');
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
        await initializeBarcodeDetector();
        startScanning();
      }
    } catch (err) {
      console.error('📱 Scanner: Initialization failed:', err);
      if (currentAttempt === initAttemptRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to initialize camera');
        setHasPermission(false);
        setPlaybackStatus('error');
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
    
    // Enhanced constraints for mobile devices
    const baseConstraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1920, min: 320 },
        height: { ideal: 1080, min: 240 },
        frameRate: { ideal: 30, min: 15 }
      },
      audio: false
    };

    // Mobile-specific constraints
    const mobileConstraints = {
      video: {
        facingMode: { exact: facingMode },
        width: { ideal: 1280, min: 320 },
        height: { ideal: 720, min: 240 },
        frameRate: { ideal: 24, min: 10 }
      },
      audio: false
    };

    const constraints = deviceInfo.isMobile ? mobileConstraints : baseConstraints;

    console.log('📱 Scanner: Requesting stream with constraints:', constraints);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Scanner: Camera permission granted');
      console.log('📱 Scanner: Stream tracks:', mediaStream.getTracks().map(track => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        settings: track.getSettings()
      })));
      
      // Update stream info
      setStreamInfo({
        tracks: mediaStream.getTracks().length,
        active: mediaStream.active,
        constraints: constraints
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Add event listeners for better debugging
        videoRef.current.onloadstart = () => {
          console.log('📱 Scanner: Video load started');
          setPlaybackStatus('loading');
        };
        
        videoRef.current.onloadedmetadata = () => {
          console.log('📱 Scanner: Video metadata loaded');
          handleVideoLoadedMetadata();
        };
        
        videoRef.current.oncanplay = () => {
          console.log('📱 Scanner: Video can play');
        };
        
        videoRef.current.onplay = () => {
          console.log('📱 Scanner: Video playing');
          setPlaybackStatus('playing');
        };
        
        videoRef.current.onerror = (e) => {
          console.error('📱 Scanner: Video error:', e);
          setPlaybackStatus('error');
        };
        
        try {
          await videoRef.current.play();
          console.log('📱 Scanner: Video play() successful');
        } catch (playError) {
          console.error('❌ Scanner: Video play failed:', playError);
          setPlaybackStatus('error');
          
          // Try alternative approach for mobile
          if (deviceInfo.isMobile) {
            console.log('📱 Scanner: Trying mobile fallback...');
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            videoRef.current.autoplay = true;
            
            setTimeout(async () => {
              try {
                await videoRef.current?.play();
                console.log('📱 Scanner: Mobile fallback successful');
                setPlaybackStatus('playing');
              } catch (fallbackError) {
                console.error('❌ Scanner: Mobile fallback failed:', fallbackError);
                throw new Error(`Video playback failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
              }
            }, 100);
          } else {
            throw new Error(`Video playback failed: ${playError instanceof Error ? playError.message : 'Unknown error'}`);
          }
        }
      }
      
      setStream(mediaStream);
      setHasPermission(true);
      setError(null);
      
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
          errorMessage = 'Camera constraints not supported. Trying fallback...';
          
          // Try with relaxed constraints
          if (retryCount < 2) {
            setRetryCount(prev => prev + 1);
            console.log('📱 Scanner: Trying with relaxed constraints...');
            
            const fallbackConstraints = {
              video: {
                facingMode: facingMode
              },
              audio: false
            };
            
            try {
              const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
              console.log('✅ Scanner: Fallback constraints worked');
              
              setStreamInfo({
                tracks: fallbackStream.getTracks().length,
                active: fallbackStream.active,
                constraints: fallbackConstraints
              });
              
              if (videoRef.current) {
                videoRef.current.srcObject = fallbackStream;
                await videoRef.current.play();
              }
              
              setStream(fallbackStream);
              setHasPermission(true);
              setError(null);
              return;
            } catch (fallbackErr) {
              console.error('❌ Scanner: Fallback also failed:', fallbackErr);
              errorMessage = 'Camera constraints not supported on this device.';
            }
          }
          break;
        default:
          errorMessage = `Camera error: ${err.message || 'Unknown error'}`;
      }
      
      setError(errorMessage);
      setHasPermission(false);
      setPlaybackStatus('error');
      onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const initializeBarcodeDetector = async () => {
    try {
      // Try to use native BarcodeDetector first (Chrome/Edge)
      if ('BarcodeDetector' in window) {
        console.log('📱 Scanner: Using native BarcodeDetector');
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: [
            'aztec', 'code_128', 'code_39', 'code_93', 'codabar', 'data_matrix',
            'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e'
          ]
        });
      } else {
        console.log('📱 Scanner: BarcodeDetector not available, using fallback');
        barcodeDetectorRef.current = null;
      }
    } catch (error) {
      console.error('📱 Scanner: Failed to initialize BarcodeDetector:', error);
      barcodeDetectorRef.current = null;
    }
  };

  const startScanning = async () => {
    console.log('📱 Scanner: Starting barcode scanning');
    
    if (!videoRef.current || !canvasRef.current) {
      console.error('📱 Scanner: Video or canvas ref not available');
      return;
    }

    scanningIntervalRef.current = setInterval(async () => {
      await scanFrame();
    }, 100); // Scan every 100ms
  };

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) {
      return;
    }
    
    try {
      if (barcodeDetectorRef.current) {
        // Use native BarcodeDetector
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
        
        if (barcodes.length > 0) {
          const barcode = barcodes[0];
          console.log('📱 Scanner: Barcode detected:', barcode);
          handleScanResult(barcode.rawValue);
        }
      } else {
        // Fallback: draw to canvas and indicate scanning
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;
        
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Visual feedback for scanning attempt
        setIsScanning(true);
        setTimeout(() => setIsScanning(false), 200);
      }
    } catch (error) {
      // Silently continue - detection errors are common
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

  // Handle video metadata loaded
  const handleVideoLoadedMetadata = () => {
    console.log('📱 Scanner: Video metadata loaded');
    if (videoRef.current) {
      const dimensions = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      };
      setVideoDimensions(dimensions);
      setCameraReady(dimensions.width > 0 && dimensions.height > 0);
      console.log('📱 Scanner: Video dimensions:', dimensions);
      
      if (dimensions.width === 0 || dimensions.height === 0) {
        console.warn('📱 Scanner: Video dimensions are 0x0 - this indicates a problem');
        setError('Video stream has invalid dimensions (0x0)');
        setPlaybackStatus('error');
      }
    }
  };

  const toggleCamera = () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    console.log('📱 Scanner: Switching camera to', newFacingMode);
    setFacingMode(newFacingMode);
    setRetryCount(0); // Reset retry count when switching cameras
  };

  const retryPermission = () => {
    console.log('📱 Scanner: Retrying camera permission');
    setError(null);
    setLastScan(null);
    setScanCount(0);
    setRetryCount(0);
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
          {deviceInfo.isMobile && (
            <p className="text-xs text-blue-600 mt-2">
              📱 Mobile device detected
            </p>
          )}
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
          {retryCount > 0 && (
            <p className="text-xs text-red-600 mt-2">
              Retry attempt: {retryCount}
            </p>
          )}
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
          
          {/* Video dimensions warning */}
          {videoDimensions.width === 0 || videoDimensions.height === 0 ? (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 bg-opacity-90 text-white px-4 py-2 rounded-lg">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <div className="font-bold">Camera Issue</div>
                <div className="text-sm">Video dimensions: {videoDimensions.width}x{videoDimensions.height}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <Camera className="h-3 w-3 mr-1" />
            {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
          </Badge>
          {deviceInfo.isMobile && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              <Smartphone className="h-3 w-3 mr-1" />
              Mobile
            </Badge>
          )}
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
          {'BarcodeDetector' in window ? (
            <span className="text-green-600">✅ Enhanced scanning available (Chrome/Edge)</span>
          ) : (
            <span className="text-orange-600">⚠️ Basic scanning mode (consider using Chrome for better detection)</span>
          )}
        </div>
      </div>

      {/* Enhanced diagnostic info - Always visible for debugging */}
      <div className="mt-2 p-3 bg-gray-100 rounded text-xs border">
        <div className="font-medium mb-2 text-gray-800 flex items-center gap-2">
          📊 Camera Diagnostics
          {deviceInfo.isMobile && <Smartphone className="h-3 w-3" />}
        </div>
        <div className="grid grid-cols-2 gap-2 text-gray-700">
          <div>Permission: <span className="font-mono">{hasPermission ? 'Granted' : 'Denied'}</span></div>
          <div>Facing: <span className="font-mono">{facingMode}</span></div>
          <div>Camera Ready: <span className="font-mono">{cameraReady ? 'Yes' : 'No'}</span></div>
          <div>Playback: <span className="font-mono">{playbackStatus}</span></div>
          <div>Video Size: <span className={cn("font-mono", (videoDimensions.width === 0 || videoDimensions.height === 0) && "text-red-600 font-bold")}>
            {videoDimensions.width}x{videoDimensions.height}
          </span></div>
          <div>Stream: <span className="font-mono">{streamInfo.tracks} tracks, {streamInfo.active ? 'active' : 'inactive'}</span></div>
          <div>Scan Count: <span className="font-mono">{scanCount}</span></div>
          <div>BarcodeDetector: <span className="font-mono">{'BarcodeDetector' in window ? 'Available' : 'Not Available'}</span></div>
          <div>Device: <span className="font-mono">{deviceInfo.isMobile ? 'Mobile' : 'Desktop'}</span></div>
          <div>Retry Count: <span className="font-mono">{retryCount}</span></div>
        </div>
        {streamInfo.constraints && (
          <div className="mt-2 pt-2 border-t border-gray-300">
            <div className="text-xs">
              <div>Constraints: <span className="font-mono text-blue-700">{JSON.stringify(streamInfo.constraints.video, null, 0)}</span></div>
            </div>
          </div>
        )}
        {lastScan && (
          <div className="mt-2 pt-2 border-t border-gray-300">
            <div>Last scan: <span className="font-mono text-green-700">{lastScan}</span></div>
          </div>
        )}
        {error && (
          <div className="mt-2 pt-2 border-t border-gray-300">
            <div>Error: <span className="font-mono text-red-700">{error}</span></div>
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-gray-300 text-xs">
          <div>User Agent: <span className="font-mono text-gray-600">{deviceInfo.userAgent.substring(0, 50)}...</span></div>
          <div>Platform: <span className="font-mono text-gray-600">{deviceInfo.platform}</span></div>
        </div>
      </div>
    </div>
  );
}
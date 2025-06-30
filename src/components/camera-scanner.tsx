import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, RefreshCw, Zap, Smartphone, Monitor, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraScannerProps {
  onResult: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
  isActive?: boolean;
  autoComplete?: boolean;
}

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
  isActive = true,
  autoComplete = true
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
  const [scanSuccess, setScanSuccess] = useState(false);
  
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'recovering'>('idle');
  const [streamInfo, setStreamInfo] = useState<{ tracks: number; active: boolean; constraints: any }>({ tracks: 0, active: false, constraints: null });
  const [deviceInfo, setDeviceInfo] = useState<{ isMobile: boolean; userAgent: string; platform: string }>({
    isMobile: false,
    userAgent: '',
    platform: ''
  });
  const [retryCount, setRetryCount] = useState(0);
  const [videoLoadAttempts, setVideoLoadAttempts] = useState(0);
  const [dimensionCheckCount, setDimensionCheckCount] = useState(0);
  const [continuousMonitoring, setContinuousMonitoring] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [streamReinitCount, setStreamReinitCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dimensionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initAttemptRef = useRef<number>(0);
  const barcodeDetectorRef = useRef<any>(null);
  const lastValidDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const zeroDimensionCountRef = useRef<number>(0);
  const lastRecoveryAttemptRef = useRef<number>(0);

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

  // Unified callback that works for both modes
  const handleScanResult = useCallback((data: string) => {
    console.log('🔥 SCAN RESULT RECEIVED:', data);
    
    // Always call the parent callback to populate the input field
    onResult(data);
    
    // Update local state
    setIsScanning(false);
    
    // Show visual feedback
    setScanSuccess(true);
    setTimeout(() => {
      setScanSuccess(false);
    }, 2000);
    
    // In autoComplete mode, also stop scanning
    if (autoComplete) {
      if (scanningIntervalRef.current) {
        clearInterval(scanningIntervalRef.current);
        scanningIntervalRef.current = null;
      }
    }
  }, [onResult, autoComplete]);

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
    
    if (dimensionCheckIntervalRef.current) {
      clearInterval(dimensionCheckIntervalRef.current);
      dimensionCheckIntervalRef.current = null;
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
    setScanSuccess(false);
    setPlaybackStatus('idle');
    setVideoDimensions({ width: 0, height: 0 });
    setVideoLoadAttempts(0);
    setDimensionCheckCount(0);
    setContinuousMonitoring(false);
    setRecoveryAttempts(0);
    setStreamReinitCount(0);
    lastValidDimensionsRef.current = { width: 0, height: 0 };
    zeroDimensionCountRef.current = 0;
    lastRecoveryAttemptRef.current = 0;
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    setCameraReady(false);
    setScanSuccess(false);
    setPlaybackStatus('loading');
    initAttemptRef.current += 1;
    const currentAttempt = initAttemptRef.current;
    
    try {
      setError(null);
      setHasPermission(null);
      
      cleanup();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (currentAttempt !== initAttemptRef.current) {
        console.log('📱 Scanner: Initialization cancelled');
        return;
      }
      
      await requestCameraPermission();
      
      if (currentAttempt === initAttemptRef.current) {
        await initializeBarcodeDetector();
        startContinuousMonitoring();
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

  const startContinuousMonitoring = () => {
    console.log('📱 Scanner: Starting continuous camera monitoring...');
    setContinuousMonitoring(true);
    zeroDimensionCountRef.current = 0;
    
    dimensionCheckIntervalRef.current = setInterval(() => {
      checkVideoReadinessAndPlay();
    }, 200);
  };

  const checkVideoReadinessAndPlay = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const currentWidth = video.videoWidth;
    const currentHeight = video.videoHeight;
    
    setDimensionCheckCount(prev => prev + 1);
    setVideoDimensions({ width: currentWidth, height: currentHeight });
    
    const hasValidDimensions = currentWidth > 0 && currentHeight > 0;
    
    if (hasValidDimensions) {
      zeroDimensionCountRef.current = 0;
      lastValidDimensionsRef.current = { width: currentWidth, height: currentHeight };
      
      if (!cameraReady) {
        console.log('✅ Scanner: Valid video dimensions detected! Camera now ready.');
        setCameraReady(true);
        setPlaybackStatus('playing');
        setRecoveryAttempts(0);
        
        if (!scanningIntervalRef.current && !scanSuccess) {
          startScanning();
        }
      }
      
      if (video.paused) {
        video.play().catch(err => {
          console.warn('📱 Scanner: Play attempt failed:', err);
        });
      }
    } else {
      zeroDimensionCountRef.current++;
      
      if (cameraReady) {
        console.warn('⚠️ Scanner: Camera dimensions lost! Attempting recovery...');
        setCameraReady(false);
        setPlaybackStatus('recovering');
        
        if (scanningIntervalRef.current) {
          clearInterval(scanningIntervalRef.current);
          scanningIntervalRef.current = null;
        }
      }
      
      const now = Date.now();
      const timeSinceLastRecovery = now - lastRecoveryAttemptRef.current;
      
      if (zeroDimensionCountRef.current > 25 && timeSinceLastRecovery > 5000) {
        console.log('🔄 Scanner: Triggering aggressive stream recovery');
        lastRecoveryAttemptRef.current = now;
        attemptStreamReinitialize();
      } else {
        attemptCameraRecovery();
      }
    }
  };

  const attemptStreamReinitialize = async () => {
    console.log('🔄 Scanner: Attempting complete stream reinitialization...');
    setStreamReinitCount(prev => prev + 1);
    setPlaybackStatus('recovering');
    
    try {
      if (stream) {
        stream.getTracks().forEach(track => {
          console.log('🔄 Scanner: Force stopping track:', track.kind);
          track.stop();
        });
        setStream(null);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await requestCameraPermission();
      
      console.log('✅ Scanner: Stream reinitialization completed');
      zeroDimensionCountRef.current = 0;
      
    } catch (error) {
      console.error('❌ Scanner: Stream reinitialization failed:', error);
      setError('Stream reinitialization failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setPlaybackStatus('error');
    }
  };

  const attemptCameraRecovery = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    setRecoveryAttempts(prev => prev + 1);
    
    try {
      if (video.paused) {
        video.play().catch(err => {
          console.warn('📱 Scanner: Recovery play failed:', err);
        });
      }
      
      if (deviceInfo.isMobile) {
        if (video.readyState >= 2) {
          video.currentTime = video.currentTime + 0.001;
        }
        
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        
        if (videoLoadAttempts < 3) {
          setVideoLoadAttempts(prev => prev + 1);
          video.load();
        }
      }
      
      if (recoveryAttempts % 10 === 0 && stream) {
        console.log('📱 Scanner: Attempting srcObject refresh...');
        const currentSrc = video.srcObject;
        video.srcObject = null;
        setTimeout(() => {
          video.srcObject = currentSrc;
          video.play().catch(console.warn);
        }, 100);
      }
      
    } catch (error) {
      console.error('📱 Scanner: Error during camera recovery:', error);
    }
  };

  const requestCameraPermission = async () => {
    console.log('📱 Scanner: Requesting camera permission with 720x1280 resolution');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }
    
    // Optimized constraint sets with 720x1280 as primary target
    const constraintSets = [
      // First try: Exact 720x1280 resolution for optimal scanning
      {
        video: {
          facingMode: { exact: facingMode },
          width: { exact: 720 },
          height: { exact: 1280 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      // Second try: 720x1280 without exact constraints
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 720 },
          height: { ideal: 1280 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      // Third try: Standard HD resolution
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      // Fourth try: Medium quality
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 24, min: 10 }
        },
        audio: false
      },
      // Fifth try: Basic constraints
      {
        video: {
          facingMode: facingMode,
          width: { min: 320 },
          height: { min: 240 }
        },
        audio: false
      },
      // Sixth try: Just facing mode
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
    let usedConstraints = null;
    
    for (let i = 0; i < constraintSets.length; i++) {
      const constraints = constraintSets[i];
      console.log(`📱 Scanner: Trying constraint set ${i + 1}:`, constraints);
      
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        usedConstraints = constraints;
        console.log(`✅ Scanner: Success with constraint set ${i + 1}`);
        
        // Log the actual resolution we got
        if (mediaStream) {
          const videoTrack = mediaStream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            console.log(`📱 Scanner: Actual resolution: ${settings.width}x${settings.height}`);
          }
        }
        break;
      } catch (err: any) {
        console.warn(`❌ Scanner: Constraint set ${i + 1} failed:`, err.name, err.message);
        
        if (i === constraintSets.length - 1) {
          throw err;
        }
      }
    }

    if (!mediaStream) {
      throw new Error('Failed to get camera stream with any constraints');
    }
    
    console.log('✅ Scanner: Camera permission granted with optimized resolution');
    
    setStreamInfo({
      tracks: mediaStream.getTracks().length,
      active: mediaStream.active,
      constraints: usedConstraints
    });
    
    if (videoRef.current) {
      const video = videoRef.current;
      
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.autoplay = true;
      video.controls = false;
      
      video.srcObject = null;
      video.srcObject = mediaStream;
      
      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('📱 Scanner: Initial play failed:', err);
            
            if (deviceInfo.isMobile) {
              console.log('📱 Scanner: Trying mobile fallback strategies...');
              
              video.muted = true;
              video.autoplay = true;
              
              setTimeout(() => {
                video.play().catch(err2 => {
                  console.warn('📱 Scanner: Mobile fallback 1 failed:', err2);
                  
                  video.load();
                  setTimeout(() => {
                    video.play().catch(err3 => {
                      console.error('📱 Scanner: All mobile fallbacks failed:', err3);
                    });
                  }, 300);
                });
              }, 100);
            }
          });
        }
      } catch (playError) {
        console.error('📱 Scanner: Play attempt failed:', playError);
      }
    }
    
    setStream(mediaStream);
    setHasPermission(true);
    setError(null);
  };

  const initializeBarcodeDetector = async () => {
    try {
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

    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
    }

    scanningIntervalRef.current = setInterval(async () => {
      await scanFrame();
    }, 100);
  };

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) {
      return;
    }
    
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0 || scanSuccess) {
      return;
    }
    
    try {
      if (barcodeDetectorRef.current) {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
        
        if (barcodes.length > 0) {
          const barcode = barcodes[0];
          console.log('🔥 BARCODE DETECTED:', barcode.rawValue);
          processDetectedBarcode(barcode.rawValue);
        }
      } else {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        setIsScanning(true);
        setTimeout(() => setIsScanning(false), 200);
      }
    } catch (error) {
      // Continue scanning
    }
  };

  const processDetectedBarcode = (result: string) => {
    if (!result || typeof result !== 'string') return;
    
    const scannedText = result.trim();
    const now = Date.now();
    
    console.log('🔥 PROCESSING DETECTED BARCODE:', scannedText);
    
    // Prevent duplicate scans within 1 second
    const duplicateThreshold = 1000;
    if (scannedText === lastScan && now - lastScanTimeRef.current < duplicateThreshold) {
      console.log('📱 Scanner: Duplicate scan ignored');
      return;
    }

    setLastScan(scannedText);
    lastScanTimeRef.current = now;
    setScanCount(prev => prev + 1);
    setIsScanning(true);
    
    console.log('🔥 CALLING RESULT HANDLER:', scannedText);
    handleScanResult(scannedText);
  };

  const toggleCamera = () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    console.log('📱 Scanner: Switching camera to', newFacingMode);
    setFacingMode(newFacingMode);
    setRetryCount(0);
    setVideoLoadAttempts(0);
    setDimensionCheckCount(0);
    setRecoveryAttempts(0);
    setStreamReinitCount(0);
    setScanSuccess(false);
    lastValidDimensionsRef.current = { width: 0, height: 0 };
    zeroDimensionCountRef.current = 0;
  };

  const retryPermission = () => {
    console.log('📱 Scanner: Retrying camera permission');
    setError(null);
    setLastScan(null);
    setScanCount(0);
    setScanSuccess(false);
    setRetryCount(prev => prev + 1);
    setVideoLoadAttempts(0);
    setDimensionCheckCount(0);
    setRecoveryAttempts(0);
    setStreamReinitCount(0);
    lastValidDimensionsRef.current = { width: 0, height: 0 };
    zeroDimensionCountRef.current = 0;
    initializeCamera();
  };

  const forceStreamReinit = () => {
    console.log('📱 Scanner: Manual stream reinitialization triggered');
    setScanSuccess(false);
    attemptStreamReinitialize();
  };

  const refreshPage = () => {
    window.location.reload();
  };

  const restartScanning = () => {
    console.log('📱 Scanner: Restarting scanning after success');
    setScanSuccess(false);
    setLastScan(null);
    setScanCount(0);
    
    if (cameraReady && !scanningIntervalRef.current) {
      startScanning();
    }
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
            {isInitializing ? 'Initializing camera with 720x1280 resolution...' : 'Requesting camera permission...'}
          </p>
          {deviceInfo.isMobile && (
            <p className="text-xs text-blue-600 mt-2">
              📱 Mobile device detected - using enhanced compatibility mode
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
              Retry Camera (Attempt {retryCount + 1})
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
          style={{
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
          }}
        />
        
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-4 w-16 h-16 border-l-4 border-t-4 border-white rounded-tl-lg opacity-80"></div>
          <div className="absolute top-4 right-4 w-16 h-16 border-r-4 border-t-4 border-white rounded-tr-lg opacity-80"></div>
          <div className="absolute bottom-4 left-4 w-16 h-16 border-l-4 border-b-4 border-white rounded-bl-lg opacity-80"></div>
          <div className="absolute bottom-4 right-4 w-16 h-16 border-r-4 border-b-4 border-white rounded-br-lg opacity-80"></div>
          
          <div className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-48 border-2 rounded-lg",
            scanSuccess ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500",
            "bg-opacity-10"
          )}>
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
              <span className={cn(
                "text-white text-sm font-bold px-3 py-1 rounded-full",
                scanSuccess ? "bg-green-500 bg-opacity-90" : "bg-red-500 bg-opacity-90"
              )}>
                {scanSuccess ? "✅ Code Captured!" : "Scan Code Here"}
              </span>
            </div>
            
            {!scanSuccess && (
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-400 animate-pulse"></div>
            )}
            
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6">
              {scanSuccess ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <>
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white opacity-60"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white opacity-60"></div>
                </>
              )}
            </div>
          </div>
          
          {isScanning && !scanSuccess && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-3 py-1 rounded-full animate-pulse">
                <Zap className="h-4 w-4" />
                <span className="font-bold">Scanning...</span>
              </div>
            </div>
          )}
          
          {scanSuccess && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-3 py-1 rounded-full">
                <CheckCircle className="h-4 w-4" />
                <span className="font-bold">Code Captured!</span>
              </div>
            </div>
          )}
          
          {lastScan && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-blue-500 bg-opacity-90 text-white px-3 py-1 rounded-full text-sm">
                <span className="font-bold">Last: {lastScan}</span>
              </div>
            </div>
          )}
          
          {videoDimensions.width === 0 || videoDimensions.height === 0 ? (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 bg-opacity-90 text-white px-4 py-2 rounded-lg">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <div className="font-bold">Camera Recovery Mode</div>
                <div className="text-sm">Video dimensions: {videoDimensions.width}x{videoDimensions.height}</div>
                <div className="text-xs mt-1">Target: 720x1280 for optimal scanning</div>
                <div className="text-xs">Recovery attempts: {recoveryAttempts}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 flex-wrap">
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
          {videoDimensions.width > 0 && videoDimensions.height > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              📐 {videoDimensions.width}x{videoDimensions.height}
            </Badge>
          )}
          {scanSuccess && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Captured
            </Badge>
          )}
          {scanCount > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              <Zap className="h-3 w-3 mr-1" />
              {scanCount} scans
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          {scanSuccess && (
            <Button
              onClick={restartScanning}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-green-600 border-green-300 hover:bg-green-50"
            >
              <RefreshCw className="h-4 w-4" />
              Scan Again
            </Button>
          )}
          
          {(videoDimensions.width === 0 || videoDimensions.height === 0) && (
            <Button
              onClick={forceStreamReinit}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <Wifi className="h-4 w-4" />
              Force Reinit
            </Button>
          )}
          
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
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 text-center">
          <strong>📱 Camera scanner will populate the input field when a code is detected</strong><br />
          {autoComplete ? 
            "Code will be captured automatically and populate the input field" :
            "Code will be captured and populate the input field for manual processing"
          }
        </p>
        
        <div className="mt-2 text-xs text-blue-600 text-center">
          {'BarcodeDetector' in window ? (
            <span className="text-green-600">✅ Enhanced scanning available (Chrome/Edge)</span>
          ) : (
            <span className="text-orange-600">⚠️ Basic scanning mode (consider using Chrome for better detection)</span>
          )}
        </div>
        
        {videoDimensions.width > 0 && videoDimensions.height > 0 && (
          <div className="mt-2 text-xs text-center">
            <span className={videoDimensions.width === 720 && videoDimensions.height === 1280 ? 
              "text-green-600 font-bold" : "text-blue-600"}>
              Current resolution: {videoDimensions.width}x{videoDimensions.height}
              {videoDimensions.width === 720 && videoDimensions.height === 1280 && " ✅ Optimal!"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
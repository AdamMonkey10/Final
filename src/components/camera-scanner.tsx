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
  autoComplete?: boolean; // New prop to control auto-completion
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
  isActive = true,
  autoComplete = true // Default to auto-complete behavior
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
  
  // Enhanced diagnostic states
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
      
      if (autoComplete) {
        // Show success state briefly
        setTimeout(() => {
          setScanSuccess(false);
        }, 2000);
      }
    }, 300), // Reduced debounce time for faster response
    [onResult, autoComplete]
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
    
    if (dimensionCheckIntervalRef.current) {
      clearInterval(dimensionCheckIntervalRef.current);
      dimensionCheckIntervalRef.current = null;
    }
    
    // Remove video event listeners
    if (videoRef.current) {
      videoRef.current.removeEventListener('loadeddata', handleVideoLoadedData);
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

  const handleVideoLoadedData = () => {
    console.log('📱 Scanner: Video loadeddata event fired - stream is ready');
    const video = videoRef.current;
    if (!video) return;

    const currentWidth = video.videoWidth;
    const currentHeight = video.videoHeight;
    
    console.log('📱 Scanner: Video dimensions from loadeddata:', currentWidth, 'x', currentHeight);
    
    if (currentWidth > 0 && currentHeight > 0) {
      setVideoDimensions({ width: currentWidth, height: currentHeight });
      lastValidDimensionsRef.current = { width: currentWidth, height: currentHeight };
      
      setCameraReady(true);
      setPlaybackStatus('playing');
      setRecoveryAttempts(0);
      
      console.log('✅ Scanner: Camera ready from loadeddata event - starting scanning');
      
      // Start scanning immediately since video is confirmed ready
      if (!scanningIntervalRef.current && !scanSuccess) {
        startScanning();
      }
      
      // Start monitoring for any future issues
      startContinuousMonitoring();
    }
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
      
      // Clean up any existing stream
      cleanup();
      
      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (currentAttempt !== initAttemptRef.current) {
        console.log('📱 Scanner: Initialization cancelled');
        return;
      }
      
      await requestCameraPermission();
      
      if (currentAttempt === initAttemptRef.current) {
        await initializeBarcodeDetector();
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
    
    // Start continuous dimension checking for monitoring only
    dimensionCheckIntervalRef.current = setInterval(() => {
      checkVideoReadinessAndPlay();
    }, 200); // Check every 200ms
  };

  const checkVideoReadinessAndPlay = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const currentWidth = video.videoWidth;
    const currentHeight = video.videoHeight;
    
    setDimensionCheckCount(prev => prev + 1);
    setVideoDimensions({ width: currentWidth, height: currentHeight });
    
    // Check if dimensions are valid
    const hasValidDimensions = currentWidth > 0 && currentHeight > 0;
    
    if (hasValidDimensions) {
      // Reset zero dimension counter
      zeroDimensionCountRef.current = 0;
      
      // Update last valid dimensions
      lastValidDimensionsRef.current = { width: currentWidth, height: currentHeight };
      
      // Ensure video is playing
      if (video.paused) {
        video.play().catch(err => {
          console.warn('📱 Scanner: Play attempt failed:', err);
        });
      }
    } else {
      // Dimensions are 0x0 - increment counter
      zeroDimensionCountRef.current++;
      
      // Dimensions are 0x0 - camera needs recovery
      if (cameraReady) {
        console.warn('⚠️ Scanner: Camera dimensions lost! Attempting recovery...');
        setCameraReady(false);
        setPlaybackStatus('recovering');
        
        // Stop scanning while recovering
        if (scanningIntervalRef.current) {
          clearInterval(scanningIntervalRef.current);
          scanningIntervalRef.current = null;
        }
      }
      
      // Trigger aggressive recovery if we've had 0x0 for too long
      const now = Date.now();
      const timeSinceLastRecovery = now - lastRecoveryAttemptRef.current;
      
      // Attempt recovery every 5 seconds if dimensions stay at 0x0
      if (zeroDimensionCountRef.current > 25 && timeSinceLastRecovery > 5000) { // 25 checks * 200ms = 5 seconds
        console.log('🔄 Scanner: Triggering aggressive stream recovery after', zeroDimensionCountRef.current, 'zero dimension checks');
        lastRecoveryAttemptRef.current = now;
        attemptStreamReinitialize();
      } else {
        // Regular recovery attempts
        attemptCameraRecovery();
      }
    }
  };

  const attemptStreamReinitialize = async () => {
    console.log('🔄 Scanner: Attempting complete stream reinitialization...');
    setStreamReinitCount(prev => prev + 1);
    setPlaybackStatus('recovering');
    
    try {
      // Stop current stream completely
      if (stream) {
        stream.getTracks().forEach(track => {
          console.log('🔄 Scanner: Force stopping track:', track.kind);
          track.stop();
        });
        setStream(null);
      }
      
      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Request new stream with fresh constraints
      await requestCameraPermission();
      
      console.log('✅ Scanner: Stream reinitialization completed');
      zeroDimensionCountRef.current = 0; // Reset counter after reinit
      
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
    
    console.log(`📱 Scanner: Attempting camera recovery #${recoveryAttempts + 1}...`);
    
    try {
      // Strategy 1: Try to play the video
      if (video.paused) {
        video.play().catch(err => {
          console.warn('📱 Scanner: Recovery play failed:', err);
        });
      }
      
      // Strategy 2: For mobile devices, try additional recovery methods
      if (deviceInfo.isMobile) {
        // Force a currentTime update to trigger frame rendering
        if (video.readyState >= 2) {
          video.currentTime = video.currentTime + 0.001;
        }
        
        // Ensure mobile-specific attributes are set
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        
        // Try to reload the video element
        if (videoLoadAttempts < 3) {
          setVideoLoadAttempts(prev => prev + 1);
          video.load();
        }
      }
      
      // Strategy 3: Force video refresh by toggling srcObject
      if (recoveryAttempts % 10 === 0 && stream) { // Every 10th attempt
        console.log('📱 Scanner: Attempting srcObject refresh...');
        const currentSrc = video.srcObject;
        video.srcObject = null;
        setTimeout(() => {
          video.srcObject = currentSrc;
          video.play().catch(console.warn);
        }, 100);
      }
      
      // Strategy 4: Force video element recreation
      if (recoveryAttempts % 20 === 0) { // Every 20th attempt
        console.log('📱 Scanner: Attempting video element refresh...');
        if (video.parentNode) {
          const newVideo = video.cloneNode(true) as HTMLVideoElement;
          newVideo.srcObject = stream;
          newVideo.setAttribute('playsinline', 'true');
          newVideo.setAttribute('webkit-playsinline', 'true');
          newVideo.muted = true;
          newVideo.autoplay = true;
          
          video.parentNode.replaceChild(newVideo, video);
          (videoRef as any).current = newVideo;
          
          newVideo.play().catch(console.warn);
        }
      }
      
    } catch (error) {
      console.error('📱 Scanner: Error during camera recovery:', error);
    }
  };

  const requestCameraPermission = async () => {
    console.log('📱 Scanner: Requesting camera permission');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }
    
    // Progressive constraint fallback for mobile devices - CORRECTED RESOLUTION
    const constraintSets = [
      // First try: High quality with exact facing mode - CORRECTED: 720 wide x 1280 high
      {
        video: {
          facingMode: { exact: facingMode },
          width: { ideal: 720, min: 480 },
          height: { ideal: 1280, min: 640 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      // Second try: Medium quality with preferred facing mode - CORRECTED: 720 wide x 1280 high
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 720, min: 320 },
          height: { ideal: 1280, min: 480 },
          frameRate: { ideal: 24, min: 10 }
        },
        audio: false
      },
      // Third try: Basic constraints
      {
        video: {
          facingMode: facingMode,
          width: { min: 320 },
          height: { min: 240 }
        },
        audio: false
      },
      // Last resort: Just facing mode
      {
        video: {
          facingMode: facingMode
        },
        audio: false
      },
      // Absolute fallback: Any video
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
        break;
      } catch (err: any) {
        console.warn(`❌ Scanner: Constraint set ${i + 1} failed:`, err.name, err.message);
        
        if (i === constraintSets.length - 1) {
          // All constraint sets failed
          throw err;
        }
      }
    }

    if (!mediaStream) {
      throw new Error('Failed to get camera stream with any constraints');
    }
    
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
      constraints: usedConstraints
    });
    
    if (videoRef.current) {
      // Set up video element for mobile compatibility
      const video = videoRef.current;
      
      // Essential mobile video attributes
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.autoplay = true;
      video.controls = false;
      
      // Clear any existing source
      video.srcObject = null;
      
      // Add loadeddata event listener BEFORE setting srcObject
      video.addEventListener('loadeddata', handleVideoLoadedData);
      
      // Set the new stream
      video.srcObject = mediaStream;
      
      // Initial play attempt with multiple strategies
      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('📱 Scanner: Initial play failed:', err);
            
            // Mobile fallback strategies
            if (deviceInfo.isMobile) {
              console.log('📱 Scanner: Trying mobile fallback strategies...');
              
              // Strategy 1: Force muted autoplay
              video.muted = true;
              video.autoplay = true;
              
              setTimeout(() => {
                video.play().catch(err2 => {
                  console.warn('📱 Scanner: Mobile fallback 1 failed:', err2);
                  
                  // Strategy 2: Load and play
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

    // Clear any existing scanning interval
    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
    }

    scanningIntervalRef.current = setInterval(async () => {
      await scanFrame();
    }, 100); // Faster scanning for better responsiveness
  };

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) {
      return;
    }
    
    // Skip scanning if video dimensions are still 0x0 or if already successful
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0 || scanSuccess) {
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
    
    // Prevent duplicate scans within 1 second for auto-complete mode
    const duplicateThreshold = autoComplete ? 1000 : 2000;
    if (scannedText === lastScan && now - lastScanTimeRef.current < duplicateThreshold) {
      console.log('📱 Scanner: Duplicate scan ignored');
      return;
    }

    // Update scan tracking
    setLastScan(scannedText);
    lastScanTimeRef.current = now;
    setScanCount(prev => prev + 1);
    setIsScanning(true);
    
    // IMMEDIATE FEEDBACK FOR AUTO-COMPLETE MODE
    if (autoComplete) {
      // Immediately stop scanning and show success
      setScanSuccess(true);
      if (scanningIntervalRef.current) {
        clearInterval(scanningIntervalRef.current);
        scanningIntervalRef.current = null;
      }
      console.log('📱 Scanner: Auto-complete mode - immediate success feedback');
    }
    
    console.log('📱 Scanner: Calling result callback');
    debouncedOnResult(scannedText);
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
    
    // Restart scanning if camera is ready
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
            {isInitializing ? 'Initializing camera...' : 'Requesting camera permission...'}
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
                {scanSuccess ? "✅ Scan Complete!" : "Scan Code Here"}
              </span>
            </div>
            
            {/* Scanning line animation */}
            {!scanSuccess && (
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-400 animate-pulse"></div>
            )}
            
            {/* Center crosshair or checkmark */}
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
          
          {/* Scanning status */}
          {isScanning && !scanSuccess && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-3 py-1 rounded-full animate-pulse">
                <Zap className="h-4 w-4" />
                <span className="font-bold">Scanning...</span>
              </div>
            </div>
          )}
          
          {/* Success status */}
          {scanSuccess && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-3 py-1 rounded-full">
                <CheckCircle className="h-4 w-4" />
                <span className="font-bold">Scan Successful!</span>
              </div>
            </div>
          )}
          
          {/* Video dimensions warning */}
          {videoDimensions.width === 0 || videoDimensions.height === 0 ? (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 bg-opacity-90 text-white px-4 py-2 rounded-lg">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <div className="font-bold">Camera Recovery Mode</div>
                <div className="text-sm">Video dimensions: {videoDimensions.width}x{videoDimensions.height}</div>
                <div className="text-xs mt-1">Continuous checks: {dimensionCheckCount}</div>
                <div className="text-xs">Zero count: {zeroDimensionCountRef.current}</div>
                <div className="text-xs">Recovery attempts: {recoveryAttempts}</div>
                <div className="text-xs">Stream reinits: {streamReinitCount}</div>
                {deviceInfo.isMobile && (
                  <div className="text-xs mt-1">Mobile recovery active...</div>
                )}
                {lastValidDimensionsRef.current.width > 0 && (
                  <div className="text-xs mt-1">
                    Last valid: {lastValidDimensionsRef.current.width}x{lastValidDimensionsRef.current.height}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Controls */}
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
          {continuousMonitoring && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              <Monitor className="h-3 w-3 mr-1" />
              Monitoring
            </Badge>
          )}
          {playbackStatus === 'recovering' && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
              <Wifi className="h-3 w-3 mr-1" />
              Recovering
            </Badge>
          )}
          {scanSuccess && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Success
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
        
        <div className="flex gap-2">
          {/* Restart scanning button when successful */}
          {scanSuccess && autoComplete && (
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
          
          {/* Force stream reinit button when dimensions are 0x0 */}
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

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 text-center">
          <strong>📱 Position your QR code or barcode within the red frame</strong><br />
          {autoComplete ? 
            "Scan will complete automatically when detected • Hold steady for best results" :
            "Hold steady for best results • Ensure good lighting • Keep code flat and clean"
          }
        </p>
        
        {/* Browser compatibility note */}
        <div className="mt-2 text-xs text-blue-600 text-center">
          {'BarcodeDetector' in window ? (
            <span className="text-green-600">✅ Enhanced scanning available (Chrome/Edge)</span>
          ) : (
            <span className="text-orange-600">⚠️ Basic scanning mode (consider using Chrome for better detection)</span>
          )}
        </div>
        
        {continuousMonitoring && (
          <div className="mt-2 text-xs text-green-600 text-center">
            🔄 Continuous camera monitoring active (Check #{dimensionCheckCount})
          </div>
        )}
        
        {scanSuccess && autoComplete && (
          <div className="mt-2 text-xs text-green-600 text-center">
            ✅ Scan completed successfully! Click "Scan Again" to scan another code.
          </div>
        )}
        
        {zeroDimensionCountRef.current > 25 && (
          <div className="mt-2 text-xs text-orange-600 text-center">
            ⚠️ Extended 0x0 dimensions detected - automatic recovery will trigger soon
          </div>
        )}
      </div>

      {/* Enhanced diagnostic info - Always visible for debugging */}
      <div className="mt-2 p-3 bg-gray-100 rounded text-xs border">
        <div className="font-medium mb-2 text-gray-800 flex items-center gap-2">
          📊 Camera Diagnostics
          {deviceInfo.isMobile && <Smartphone className="h-3 w-3" />}
          {continuousMonitoring && <Monitor className="h-3 w-3 text-green-600" />}
          {playbackStatus === 'recovering' && <Wifi className="h-3 w-3 text-orange-600" />}
          {scanSuccess && <CheckCircle className="h-3 w-3 text-green-600" />}
        </div>
        <div className="grid grid-cols-2 gap-2 text-gray-700">
          <div>Permission: <span className="font-mono">{hasPermission ? 'Granted' : 'Denied'}</span></div>
          <div>Facing: <span className="font-mono">{facingMode}</span></div>
          <div>Camera Ready: <span className="font-mono">{cameraReady ? 'Yes' : 'No'}</span></div>
          <div>Playback: <span className={cn("font-mono", playbackStatus === 'recovering' && "text-orange-600 font-bold")}>{playbackStatus}</span></div>
          <div>Video Size: <span className={cn("font-mono", (videoDimensions.width === 0 || videoDimensions.height === 0) && "text-red-600 font-bold")}>
            {videoDimensions.width}x{videoDimensions.height}
          </span></div>
          <div>Stream: <span className="font-mono">{streamInfo.tracks} tracks, {streamInfo.active ? 'active' : 'inactive'}</span></div>
          <div>Scan Count: <span className="font-mono">{scanCount}</span></div>
          <div>Scan Success: <span className={cn("font-mono", scanSuccess && "text-green-600 font-bold")}>{scanSuccess ? 'YES' : 'NO'}</span></div>
          <div>Auto Complete: <span className="font-mono">{autoComplete ? 'ON' : 'OFF'}</span></div>
          <div>BarcodeDetector: <span className="font-mono">{'BarcodeDetector' in window ? 'Available' : 'Not Available'}</span></div>
          <div>Device: <span className="font-mono">{deviceInfo.isMobile ? 'Mobile' : 'Desktop'}</span></div>
          <div>Retry Count: <span className="font-mono">{retryCount}</span></div>
          <div>Load Attempts: <span className="font-mono">{videoLoadAttempts}</span></div>
          <div>Ready State: <span className="font-mono">{videoRef.current?.readyState || 'N/A'}</span></div>
          <div>Monitoring: <span className={cn("font-mono", continuousMonitoring && "text-green-600 font-bold")}>
            {continuousMonitoring ? 'ACTIVE' : 'STOPPED'}
          </span></div>
          <div>Dimension Checks: <span className={cn("font-mono", continuousMonitoring && "text-blue-600 font-bold")}>
            {dimensionCheckCount} {continuousMonitoring ? '(continuous)' : '(stopped)'}
          </span></div>
          <div>Last Valid: <span className="font-mono text-green-700">
            {lastValidDimensionsRef.current.width}x{lastValidDimensionsRef.current.height}
          </span></div>
          <div>Zero Count: <span className={cn("font-mono", zeroDimensionCountRef.current > 25 && "text-red-600 font-bold")}>
            {zeroDimensionCountRef.current}
          </span></div>
          <div>Recovery Attempts: <span className="font-mono text-orange-700">{recoveryAttempts}</span></div>
          <div>Stream Reinits: <span className="font-mono text-purple-700">{streamReinitCount}</span></div>
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
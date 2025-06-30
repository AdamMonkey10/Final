import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, RefreshCw, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraScannerProps {
  onResult: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
  isActive?: boolean;
  autoComplete?: boolean;
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
  const [scanSuccess, setScanSuccess] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [retryCount, setRetryCount] = useState(0);
  const [streamReinitCount, setStreamReinitCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dimensionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeDetectorRef = useRef<any>(null);

  const handleScanResult = useCallback((data: string) => {
    onResult(data);
    setScanSuccess(true);
    setTimeout(() => setScanSuccess(false), 2000);
    
    if (autoComplete && scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
      scanningIntervalRef.current = null;
    }
  }, [onResult, autoComplete]);

  useEffect(() => {
    if (isActive) {
      initializeCamera();
    } else {
      cleanup();
    }
    return cleanup;
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
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    setHasPermission(null);
    setError(null);
    setCameraReady(false);
    setScanSuccess(false);
    setVideoDimensions({ width: 0, height: 0 });
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    setCameraReady(false);
    setScanSuccess(false);
    
    try {
      setError(null);
      setHasPermission(null);
      
      cleanup();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await requestCameraPermission();
      await initializeBarcodeDetector();
      startContinuousMonitoring();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize camera');
      setHasPermission(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const startContinuousMonitoring = () => {
    dimensionCheckIntervalRef.current = setInterval(() => {
      checkVideoReadiness();
    }, 200);
  };

  const checkVideoReadiness = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const currentWidth = video.videoWidth;
    const currentHeight = video.videoHeight;
    
    setVideoDimensions({ width: currentWidth, height: currentHeight });
    
    const hasValidDimensions = currentWidth > 0 && currentHeight > 0;
    
    if (hasValidDimensions && !cameraReady) {
      setCameraReady(true);
      if (!scanningIntervalRef.current && !scanSuccess) {
        startScanning();
      }
    } else if (!hasValidDimensions && cameraReady) {
      setCameraReady(false);
      if (scanningIntervalRef.current) {
        clearInterval(scanningIntervalRef.current);
        scanningIntervalRef.current = null;
      }
    }
  };

  const requestCameraPermission = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }
    
    const constraintSets = [
      {
        video: {
          facingMode: { exact: facingMode },
          width: { exact: 720 },
          height: { exact: 1280 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 720 },
          height: { ideal: 1280 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      },
      {
        video: {
          facingMode: facingMode
        },
        audio: false
      },
      {
        video: true,
        audio: false
      }
    ];

    let mediaStream: MediaStream | null = null;
    
    for (let i = 0; i < constraintSets.length; i++) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraintSets[i]);
        break;
      } catch (err: any) {
        if (i === constraintSets.length - 1) {
          throw err;
        }
      }
    }

    if (!mediaStream) {
      throw new Error('Failed to get camera stream');
    }
    
    if (videoRef.current) {
      const video = videoRef.current;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.autoplay = true;
      video.controls = false;
      video.srcObject = mediaStream;
      
      try {
        await video.play();
      } catch (playError) {
        // Fallback for mobile
        setTimeout(() => {
          video.play().catch(() => {});
        }, 100);
      }
    }
    
    setStream(mediaStream);
    setHasPermission(true);
    setError(null);
  };

  const initializeBarcodeDetector = async () => {
    try {
      if ('BarcodeDetector' in window) {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: [
            'aztec', 'code_128', 'code_39', 'code_93', 'codabar', 'data_matrix',
            'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e'
          ]
        });
      }
    } catch (error) {
      barcodeDetectorRef.current = null;
    }
  };

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) return;

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
          processDetectedBarcode(barcode.rawValue);
        }
      }
    } catch (error) {
      // Continue scanning
    }
  };

  const processDetectedBarcode = (result: string) => {
    if (!result || typeof result !== 'string') return;
    
    const scannedText = result.trim();
    const now = Date.now();
    
    // Prevent duplicate scans within 1 second
    if (scannedText === lastScan && now - lastScanTimeRef.current < 1000) {
      return;
    }

    setLastScan(scannedText);
    lastScanTimeRef.current = now;
    
    handleScanResult(scannedText);
  };

  const toggleCamera = () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    setRetryCount(0);
    setScanSuccess(false);
  };

  const retryPermission = () => {
    setError(null);
    setLastScan(null);
    setScanSuccess(false);
    setRetryCount(prev => prev + 1);
    initializeCamera();
  };

  const forceStreamReinit = async () => {
    setStreamReinitCount(prev => prev + 1);
    
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await requestCameraPermission();
    } catch (error) {
      setError('Stream reinitialization failed');
    }
  };

  const restartScanning = () => {
    setScanSuccess(false);
    setLastScan(null);
    
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
            Initializing camera...
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
          className="w-full h-64 object-cover"
          style={{
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
          }}
        />
        
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner brackets */}
          <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-white rounded-tl-lg opacity-80"></div>
          <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-white rounded-tr-lg opacity-80"></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-white rounded-bl-lg opacity-80"></div>
          <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-white rounded-br-lg opacity-80"></div>
          
          {/* Scanning area */}
          <div className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 rounded-lg",
            scanSuccess ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500",
            "bg-opacity-10"
          )}>
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <span className={cn(
                "text-white text-xs font-bold px-2 py-1 rounded-full",
                scanSuccess ? "bg-green-500 bg-opacity-90" : "bg-red-500 bg-opacity-90"
              )}>
                {scanSuccess ? "✅ Captured!" : "Scan Here"}
              </span>
            </div>
            
            {!scanSuccess && (
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-400 animate-pulse"></div>
            )}
            
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4">
              {scanSuccess ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <>
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white opacity-60"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white opacity-60"></div>
                </>
              )}
            </div>
          </div>
          
          {scanSuccess && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-green-500 bg-opacity-90 text-white px-3 py-1 rounded-full">
                <CheckCircle className="h-4 w-4" />
                <span className="font-bold text-sm">Code Captured!</span>
              </div>
            </div>
          )}
          
          {/* Recovery mode indicator */}
          {videoDimensions.width === 0 || videoDimensions.height === 0 ? (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 bg-opacity-90 text-white px-3 py-2 rounded-lg">
              <div className="text-center">
                <AlertCircle className="h-6 w-6 mx-auto mb-1" />
                <div className="font-bold text-sm">Camera Recovery</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
          </span>
          {videoDimensions.width > 0 && videoDimensions.height > 0 && (
            <span className="text-xs text-muted-foreground">
              {videoDimensions.width}x{videoDimensions.height}
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {scanSuccess && (
            <Button
              onClick={restartScanning}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Scan Again
            </Button>
          )}
          
          {(videoDimensions.width === 0 || videoDimensions.height === 0) && (
            <Button
              onClick={forceStreamReinit}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Wifi className="h-3 w-3 mr-1" />
              Force Reinit
            </Button>
          )}
          
          <Button
            onClick={toggleCamera}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Switch
          </Button>
        </div>
      </div>

      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800 text-center">
          <strong>Position barcode within the frame</strong><br />
          Camera will automatically populate the input field when a code is detected
        </p>
      </div>
    </div>
  );
}
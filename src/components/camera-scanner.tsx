import { useState, useEffect, useRef, useCallback } from 'react';
import QrScanner from 'react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, RotateCcw, AlertCircle, CheckCircle, Wifi, WifiOff, Settings, RefreshCw } from 'lucide-react';
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
  const [isHttps, setIsHttps] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<{
    hasCamera: boolean;
    cameraCount: number;
    userAgent: string;
    isLocalhost: boolean;
    supportedConstraints: string[];
    isSecureContext: boolean;
  }>({
    hasCamera: false,
    cameraCount: 0,
    userAgent: '',
    isLocalhost: false,
    supportedConstraints: [],
    isSecureContext: false
  });
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
    // Check environment more thoroughly
    const isSecure = window.location.protocol === 'https:';
    const isLocal = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.endsWith('.local');
    const isSecureContext = window.isSecureContext;
    
    setIsHttps(isSecure);
    
    console.log('🔒 Security Context:', {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      isSecure,
      isLocal,
      isSecureContext,
      href: window.location.href
    });

    // Get supported constraints
    const supportedConstraints = navigator.mediaDevices?.getSupportedConstraints ? 
      Object.keys(navigator.mediaDevices.getSupportedConstraints()) : [];

    // Get device info
    setDeviceInfo({
      hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      cameraCount: 0,
      userAgent: navigator.userAgent,
      isLocalhost: isLocal,
      supportedConstraints,
      isSecureContext
    });

    // Try to enumerate devices to get camera count
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log('📱 Scanner: Found video devices:', videoDevices.length);
          setDeviceInfo(prev => ({
            ...prev,
            cameraCount: videoDevices.length
          }));
        })
        .catch(err => {
          console.warn('Could not enumerate devices:', err);
        });
    }

    if (isActive) {
      console.log('📱 Scanner: Component activated, requesting camera permission');
      requestCameraPermission();
    } else {
      console.log('📱 Scanner: Component deactivated');
    }
  }, [isActive, retryCount]);

  const requestCameraPermission = async () => {
    console.log('📱 Scanner: Requesting camera permission with facingMode:', facingMode);
    
    // Check if we have the necessary APIs
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'Camera API not supported in this browser. Please use a modern browser.';
      console.error('❌ Scanner:', errorMsg);
      setError(errorMsg);
      setHasPermission(false);
      onError?.(errorMsg);
      return;
    }

    // Check security context more thoroughly
    const isLocal = deviceInfo.isLocalhost;
    const isSecureContext = deviceInfo.isSecureContext;
    
    if (!isSecureContext && !isLocal) {
      const errorMsg = 'Camera access requires HTTPS or localhost. Please use a secure connection.';
      console.error('❌ Scanner:', errorMsg);
      setError(errorMsg);
      setHasPermission(false);
      onError?.(errorMsg);
      return;
    }

    try {
      setError(null);
      
      // Try different constraint strategies
      const constraintStrategies = [
        // Strategy 1: Ideal constraints with facingMode
        {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 }
          }
        },
        // Strategy 2: Basic constraints with facingMode
        {
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        },
        // Strategy 3: Just facingMode
        {
          video: {
            facingMode: facingMode
          }
        },
        // Strategy 4: Basic video only
        {
          video: true
        }
      ];

      let stream: MediaStream | null = null;
      let lastError: any = null;

      for (let i = 0; i < constraintStrategies.length; i++) {
        const constraints = constraintStrategies[i];
        console.log(`📱 Scanner: Trying strategy ${i + 1}:`, constraints);
        
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log(`✅ Scanner: Strategy ${i + 1} successful`);
          break;
        } catch (err) {
          console.warn(`❌ Scanner: Strategy ${i + 1} failed:`, err);
          lastError = err;
          
          // If it's a constraint error, try the next strategy
          if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
            continue;
          }
          
          // For other errors, break early
          if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
            break;
          }
        }
      }

      if (!stream) {
        throw lastError || new Error('All camera access strategies failed');
      }
      
      console.log('✅ Scanner: Camera permission granted');
      console.log('📱 Scanner: Stream details:', {
        active: stream.active,
        tracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        settings: stream.getVideoTracks()[0]?.getSettings()
      });
      
      setHasPermission(true);
      setError(null);
      setRetryCount(0);
      
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
      let helpText = '';
      
      switch (err.name) {
        case 'NotAllowedError':
          errorMessage = 'Camera permission denied';
          helpText = 'Please allow camera access in your browser and refresh the page. Look for a camera icon in your address bar.';
          break;
        case 'NotFoundError':
          errorMessage = 'No camera found';
          helpText = 'Please connect a camera to your device and try again.';
          break;
        case 'NotReadableError':
          errorMessage = 'Camera is busy';
          helpText = 'Another application is using the camera. Please close other camera apps and try again.';
          break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          errorMessage = 'Camera constraints not supported';
          helpText = 'Your camera doesn\'t support the requested settings. Try switching cameras.';
          break;
        case 'SecurityError':
          errorMessage = 'Camera access blocked';
          helpText = 'Camera access is blocked by your browser security settings.';
          break;
        case 'AbortError':
          errorMessage = 'Camera access aborted';
          helpText = 'Camera access was cancelled. Please try again.';
          break;
        case 'TypeError':
          errorMessage = 'Invalid camera settings';
          helpText = 'There was an issue with camera configuration. Try refreshing the page.';
          break;
        default:
          if (err.message?.includes('https')) {
            errorMessage = 'Secure connection required';
            helpText = 'Camera access requires HTTPS. Please access the site securely.';
          } else if (err.message?.includes('permission')) {
            errorMessage = 'Camera permission required';
            helpText = 'Please allow camera access and refresh the page.';
          }
          break;
      }
      
      setError(`${errorMessage}. ${helpText}`);
      onError?.(`${errorMessage}. ${helpText}`);
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
      if (error.message.includes('getUserMedia')) {
        errorMessage = 'Camera access error. Please check permissions and try again.';
      } else if (error.message.includes('https')) {
        errorMessage = 'Camera requires HTTPS. Please use a secure connection.';
      } else {
        errorMessage = `Scanner error: ${error.message}`;
      }
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
    
    // Re-request permission with new facing mode
    setTimeout(() => {
      requestCameraPermission();
    }, 100);
  };

  const retryPermission = () => {
    console.log('📱 Scanner: Retrying camera permission');
    setError(null);
    setHasPermission(null);
    setLastScan(null);
    lastScanTimeRef.current = 0;
    setRetryCount(prev => prev + 1);
  };

  const openCameraSettings = () => {
    // Guide user to camera settings
    const userAgent = navigator.userAgent.toLowerCase();
    let settingsUrl = '';
    
    if (userAgent.includes('chrome')) {
      settingsUrl = 'chrome://settings/content/camera';
    } else if (userAgent.includes('firefox')) {
      settingsUrl = 'about:preferences#privacy';
    } else if (userAgent.includes('safari')) {
      // Safari doesn't have direct URL, show instructions
      alert('To enable camera access in Safari:\n1. Go to Safari > Preferences\n2. Click Privacy tab\n3. Click Camera\n4. Allow this website');
      return;
    }
    
    if (settingsUrl) {
      window.open(settingsUrl, '_blank');
    }
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

  // Show HTTPS warning if not on secure connection and not localhost
  if (!deviceInfo.isSecureContext && !deviceInfo.isLocalhost) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg", className)}>
        <div className="text-center">
          <WifiOff className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-sm text-red-700 mb-4 font-medium">HTTPS Required</p>
          <p className="text-xs text-red-600 mb-4">
            Camera access requires a secure connection. Please access this site via HTTPS.
          </p>
          <div className="text-xs text-red-500 space-y-1 mb-4">
            <p>Current: {window.location.protocol}//{window.location.host}</p>
            <p>Required: https://{window.location.host}</p>
            <p>Secure Context: {deviceInfo.isSecureContext ? 'Yes' : 'No'}</p>
          </div>
          <Button onClick={refreshPage} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // Show device compatibility info
  if (!deviceInfo.hasCamera) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg", className)}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <p className="text-sm text-yellow-700 mb-4 font-medium">Camera API Not Supported</p>
          <p className="text-xs text-yellow-600 mb-4">
            Your browser doesn't support camera access. Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
          <div className="text-xs text-yellow-500">
            <p>Browser: {deviceInfo.userAgent.split(' ')[0]}</p>
            <p>Supported constraints: {deviceInfo.supportedConstraints.length}</p>
          </div>
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
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            <p>Protocol: {window.location.protocol}</p>
            <p>Cameras: {deviceInfo.cameraCount}</p>
            <p>Environment: {deviceInfo.isLocalhost ? 'Localhost' : 'Remote'}</p>
            <p>Secure: {deviceInfo.isSecureContext ? 'Yes' : 'No'}</p>
            {retryCount > 0 && <p>Retry: {retryCount}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (hasPermission === false || error) {
    return (
      <div className={cn("flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg", className)}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-sm text-red-700 mb-4 font-medium">Camera Access Failed</p>
          <p className="text-xs text-red-600 mb-4 max-w-md">{error}</p>
          
          <div className="space-y-2 mb-4">
            <Button onClick={retryPermission} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry Camera Access
            </Button>
            {deviceInfo.cameraCount > 1 && (
              <Button onClick={toggleCamera} variant="outline" size="sm">
                <Camera className="h-4 w-4 mr-2" />
                Try {facingMode === 'environment' ? 'Front' : 'Back'} Camera
              </Button>
            )}
            <Button onClick={refreshPage} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
            <Button onClick={openCameraSettings} variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Camera Settings
            </Button>
          </div>

          <div className="text-xs text-red-500 space-y-1 bg-red-100 p-2 rounded">
            <p><strong>Troubleshooting:</strong></p>
            <p>• Check browser permissions (camera icon in address bar)</p>
            <p>• Close other apps using the camera</p>
            <p>• Try refreshing the page</p>
            <p>• Ensure camera is connected and working</p>
            <p>• Make sure you're on HTTPS: {window.location.href}</p>
          </div>

          <div className="text-xs text-gray-500 space-y-1 mt-2">
            <p>Protocol: {window.location.protocol}</p>
            <p>Cameras: {deviceInfo.cameraCount}</p>
            <p>Facing: {facingMode}</p>
            <p>Localhost: {deviceInfo.isLocalhost ? 'Yes' : 'No'}</p>
            <p>Secure Context: {deviceInfo.isSecureContext ? 'Yes' : 'No'}</p>
            <p>Retries: {retryCount}</p>
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <Wifi className="h-3 w-3 mr-1" />
            {deviceInfo.isSecureContext ? 'Secure' : deviceInfo.isLocalhost ? 'Local' : 'Insecure'}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
            <Camera className="h-3 w-3 mr-1" />
            {facingMode === 'environment' ? 'Back' : 'Front'}
          </Badge>
          {deviceInfo.cameraCount > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              {deviceInfo.cameraCount} Camera{deviceInfo.cameraCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {lastScan && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Last: {lastScan.substring(0, 8)}...
            </Badge>
          )}
        </div>
        
        {deviceInfo.cameraCount > 1 && (
          <Button
            onClick={toggleCamera}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Switch
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700 text-center">
          Position the barcode or QR code within the frame to scan
        </p>
        {deviceInfo.isLocalhost && (
          <p className="text-xs text-blue-600 text-center mt-1">
            Development mode - camera access allowed on localhost
          </p>
        )}
        {deviceInfo.isSecureContext && !deviceInfo.isLocalhost && (
          <p className="text-xs text-green-600 text-center mt-1">
            ✓ Secure HTTPS connection - camera access enabled
          </p>
        )}
      </div>

      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
          <div>Permission: {hasPermission ? 'Granted' : 'Denied'}</div>
          <div>Protocol: {window.location.protocol}</div>
          <div>Localhost: {deviceInfo.isLocalhost ? 'Yes' : 'No'}</div>
          <div>Secure Context: {deviceInfo.isSecureContext ? 'Yes' : 'No'}</div>
          <div>Facing: {facingMode}</div>
          <div>Cameras: {deviceInfo.cameraCount}</div>
          <div>Constraints: {deviceInfo.supportedConstraints.length}</div>
          <div>Last scan: {lastScan || 'None'}</div>
          <div>Error: {error || 'None'}</div>
          <div>Retries: {retryCount}</div>
        </div>
      )}
    </div>
  );
}
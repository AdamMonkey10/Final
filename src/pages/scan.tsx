import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { QrCode, RefreshCw, Package, MapPin, Camera, Keyboard, Search, CheckCircle, AlertCircle, ArrowRight, Home, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getItemBySystemCode, updateItem } from '@/lib/firebase/items';
import { getLocations, updateLocation } from '@/lib/firebase/locations';
import { addMovement } from '@/lib/firebase/movements';
import { LocationSelector } from '@/components/location-selector';
import { BayVisualizer } from '@/components/bay-visualizer';
import { CameraScanner } from '@/components/camera-scanner';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { findOptimalLocation } from '@/lib/warehouse-logic';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { Badge } from '@/components/ui/badge';
import type { Item } from '@/types/warehouse';
import type { Location } from '@/types/warehouse';

export default function ScanPage() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  const { showInstructions } = useInstructions();
  const [loading, setLoading] = useState(false);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not-found'>('idle');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [processingComplete, setProcessingComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState<'scan' | 'location' | 'confirm' | 'complete'>('scan');
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !authLoading && showLocationDialog) {
      loadLocations();
    }
  }, [user, authLoading, showLocationDialog]);

  const loadLocations = async () => {
    try {
      const locations = await getLocations();
      setAvailableLocations(locations);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('❌ Failed to load locations');
    }
  };

  const getOperatorName = () => {
    return selectedOperator?.name || user?.email || 'System';
  };

  const handleScanResult = async (scannedCode: string) => {
    console.log('🔥 SCAN RESULT RECEIVED IN SCAN PAGE:', scannedCode);
    
    if (!selectedOperator) {
      toast.error('⚠️ Please select an operator before scanning');
      return;
    }

    if (!scannedCode.trim()) {
      toast.error('❌ Invalid barcode scanned');
      return;
    }

    // Immediately show that we received the scan
    toast.success(`📱 Barcode scanned: ${scannedCode}`, {
      duration: 2000
    });

    // Set the scanned code and process it
    setLastScannedCode(scannedCode.trim());
    setManualInput(scannedCode.trim());
    
    // Process immediately
    await processScannedCode(scannedCode.trim());
  };

  const processScannedCode = async (scannedCode: string) => {
    console.log('🔥 PROCESSING SCANNED CODE:', scannedCode);
    
    setSearchStatus('searching');
    setLoading(true);
    setProcessingComplete(false);
    setCurrentStep('scan');

    // Show immediate feedback
    const searchToast = toast.loading(`🔍 Searching for: ${scannedCode}`, {
      duration: Infinity
    });

    try {
      console.log('🔍 Searching for item with system code:', scannedCode);
      
      // Add a small delay to show the searching state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const item = await getItemBySystemCode(scannedCode);
      
      // Dismiss search toast
      toast.dismiss(searchToast);
      
      if (!item) {
        console.log('❌ Item not found');
        setSearchStatus('not-found');
        toast.error(`❌ Item not found: ${scannedCode}`, {
          description: 'Please check the barcode and try again',
          duration: 5000
        });
        return;
      }

      console.log('✅ Item found:', item);
      setSearchStatus('found');
      setScannedItem(item);

      // Show success toast
      toast.success(`✅ Found: ${item.itemCode}`, {
        description: `${item.description} (${item.weight}kg) - Status: ${item.status}`,
        duration: 4000
      });

      // Close scan dialog
      setShowScanDialog(false);

      // Process based on item status
      if (item.status === 'pending') {
        console.log('📦 Item is pending - need to place it');
        setCurrentStep('location');
        
        toast.info('📦 Item needs placement', {
          description: 'Select a location to place this item',
          duration: 3000
        });
        
        await loadLocations();
        setShowLocationDialog(true);
        
      } else if (item.status === 'placed') {
        console.log('📍 Item is placed - can be picked');
        setCurrentStep('confirm');
        
        toast.info('📍 Item ready for picking', {
          description: `Currently at location ${item.location}`,
          duration: 3000
        });
        
        const locations = await getLocations();
        const currentLocation = locations.find(loc => loc.code === item.location);
        
        if (currentLocation) {
          setSelectedLocation(currentLocation);
          setShowVisualDialog(true);
        } else {
          toast.error('❌ Location not found');
          setSearchStatus('not-found');
        }
      } else {
        console.log('⚠️ Item already removed');
        toast.warning('⚠️ Item already removed', {
          description: 'This item is no longer in the warehouse',
          duration: 4000
        });
        
        // Auto-return to dashboard for removed items
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
      
    } catch (error) {
      console.error('❌ Error processing scan:', error);
      toast.dismiss(searchToast);
      setSearchStatus('not-found');
      toast.error('❌ Failed to process scan', {
        description: 'Please try again or contact support',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualInput.trim()) {
      toast.error('⚠️ Please enter a barcode');
      return;
    }

    await processScannedCode(manualInput.trim());
  };

  const handleLocationSelect = async (location: Location) => {
    if (!scannedItem) return;
    
    // Check weight capacity
    const newWeight = location.currentWeight + scannedItem.weight;
    if (location.level !== '0' && newWeight > location.maxWeight) {
      toast.error('❌ Weight capacity exceeded', {
        description: `${newWeight}kg would exceed ${location.maxWeight}kg limit`,
        duration: 5000
      });
      return;
    }

    console.log('📍 Location selected:', location.code);
    setSelectedLocation(location);
    setShowLocationDialog(false);
    setCurrentStep('confirm');
    
    toast.success(`✅ Location selected: ${location.code}`, {
      description: 'Confirm placement in the next step',
      duration: 3000
    });
    
    setShowVisualDialog(true);
  };

  const handlePlaceItem = async () => {
    if (!scannedItem || !selectedLocation) return;

    setLoading(true);
    setCurrentStep('complete');
    
    const placementToast = toast.loading(`📦 Placing ${scannedItem.itemCode} at ${selectedLocation.code}...`, {
      duration: Infinity
    });

    try {
      // Update location weight
      await updateLocation(selectedLocation.id, {
        currentWeight: selectedLocation.currentWeight + scannedItem.weight
      });

      // Update item status and location
      await updateItem(scannedItem.id, {
        status: 'placed',
        location: selectedLocation.code,
        locationVerified: true
      });

      // Record movement
      await addMovement({
        itemId: scannedItem.id,
        type: 'IN',
        weight: scannedItem.weight,
        operator: getOperatorName(),
        reference: scannedItem.itemCode,
        notes: `Placed at ${selectedLocation.code}`
      });

      // Dismiss loading toast
      toast.dismiss(placementToast);

      // Show success
      toast.success(`🎉 Item placed successfully!`, {
        description: `${scannedItem.itemCode} is now at ${selectedLocation.code}`,
        duration: 5000
      });
      
      setProcessingComplete(true);
      setShowVisualDialog(false);
      
      // Return to dashboard after delay
      setTimeout(() => {
        navigate('/');
      }, 3000);
      
    } catch (error) {
      console.error('Error placing item:', error);
      toast.dismiss(placementToast);
      toast.error('❌ Failed to place item', {
        description: 'Please try again or contact support',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePickItem = async () => {
    if (!scannedItem || !selectedLocation) return;

    setLoading(true);
    setCurrentStep('complete');
    
    const pickingToast = toast.loading(`📤 Picking ${scannedItem.itemCode} from ${selectedLocation.code}...`, {
      duration: Infinity
    });

    try {
      // Update location weight
      await updateLocation(selectedLocation.id, {
        currentWeight: Math.max(0, selectedLocation.currentWeight - scannedItem.weight)
      });

      // Update item status
      await updateItem(scannedItem.id, {
        status: 'removed',
        location: null,
        locationVerified: false
      });

      // Record movement
      await addMovement({
        itemId: scannedItem.id,
        type: 'OUT',
        weight: scannedItem.weight,
        operator: getOperatorName(),
        reference: scannedItem.itemCode,
        notes: `Picked from ${selectedLocation.code}`
      });

      // Dismiss loading toast
      toast.dismiss(pickingToast);

      // Show success
      toast.success(`🎉 Item picked successfully!`, {
        description: `${scannedItem.itemCode} removed from ${selectedLocation.code}`,
        duration: 5000
      });
      
      setProcessingComplete(true);
      setShowVisualDialog(false);
      
      // Return to dashboard after delay
      setTimeout(() => {
        navigate('/');
      }, 3000);
      
    } catch (error) {
      console.error('Error picking item:', error);
      toast.dismiss(pickingToast);
      toast.error('❌ Failed to pick item', {
        description: 'Please try again or contact support',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setScannedItem(null);
    setSelectedLocation(null);
    setShowLocationDialog(false);
    setShowVisualDialog(false);
    setShowScanDialog(false);
    setManualInput('');
    setSearchStatus('idle');
    setLastScannedCode('');
    setProcessingComplete(false);
    setCurrentStep('scan');
  };

  const getItemStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      placed: 'bg-green-100 text-green-800',
      removed: 'bg-gray-100 text-gray-800',
    }[status] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getSearchStatusIcon = () => {
    switch (searchStatus) {
      case 'searching':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'found':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not-found':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <QrCode className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStepIndicator = () => {
    const steps = [
      { key: 'scan', label: 'Scan', icon: QrCode },
      { key: 'location', label: 'Location', icon: MapPin },
      { key: 'confirm', label: 'Confirm', icon: CheckCircle },
      { key: 'complete', label: 'Complete', icon: Home }
    ];

    return (
      <div className="flex items-center justify-center space-x-2 mb-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.key;
          const isCompleted = steps.findIndex(s => s.key === currentStep) > index;
          
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                isActive ? 'border-blue-500 bg-blue-500 text-white' :
                isCompleted ? 'border-green-500 bg-green-500 text-white' :
                'border-gray-300 bg-gray-100 text-gray-400'
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const instructionSteps = [
    {
      title: "Select Operator",
      description: "Ensure an operator is selected from the top-right corner before scanning any items.",
      type: "warning" as const
    },
    {
      title: "Scan Item",
      description: "Click 'Start Scanning' and scan or enter a barcode. The system will immediately process it.",
      type: "info" as const
    },
    {
      title: "Follow Workflow",
      description: "For pending items, select a location. For placed items, confirm picking. You'll return to dashboard when complete.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Scanner</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/')} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={resetState} variant="outline" disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      {(scannedItem || currentStep !== 'scan') && getStepIndicator()}

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Warehouse Scanner"
          description="Scan barcodes to place or pick items. The system will automatically process scans and guide you through the workflow."
          steps={instructionSteps}
          onClose={() => {}}
          className="mb-6"
        />
      )}

      {!selectedOperator && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Action Required
              </Badge>
              <span className="text-sm">Please select an operator from the top-right corner before scanning items.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Status Card */}
      {(lastScannedCode || searchStatus !== 'idle') && (
        <Card className={`border-2 ${
          searchStatus === 'found' ? 'border-green-200 bg-green-50' :
          searchStatus === 'not-found' ? 'border-red-200 bg-red-50' :
          searchStatus === 'searching' ? 'border-blue-200 bg-blue-50' :
          'border-gray-200'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {getSearchStatusIcon()}
              <div className="flex-1">
                <div className="font-medium">
                  {searchStatus === 'searching' && `Searching: ${lastScannedCode}`}
                  {searchStatus === 'found' && scannedItem && `Found: ${scannedItem.itemCode}`}
                  {searchStatus === 'not-found' && `Not found: ${lastScannedCode}`}
                  {searchStatus === 'idle' && lastScannedCode && `Last: ${lastScannedCode}`}
                </div>
                {scannedItem && (
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{scannedItem.description} • {scannedItem.weight}kg</span>
                    {getItemStatusBadge(scannedItem.status)}
                  </div>
                )}
                {processingComplete && (
                  <div className="flex items-center gap-2 text-green-600 mt-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Complete! Returning to dashboard...</span>
                  </div>
                )}
              </div>
              {scannedItem && currentStep !== 'complete' && (
                <div className="text-sm text-muted-foreground">
                  {currentStep === 'scan' && 'Item found'}
                  {currentStep === 'location' && 'Select location'}
                  {currentStep === 'confirm' && 'Confirm action'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan Item Barcode
          </CardTitle>
          <CardDescription>
            Scan or enter a barcode to process items. The system will automatically handle the workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Ready to Scan</p>
            <p className="text-sm text-muted-foreground mb-6">
              Click below to start scanning barcodes
            </p>
            <Button 
              onClick={() => setShowScanDialog(true)}
              size="lg"
              className="w-full max-w-md"
              disabled={!selectedOperator || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <QrCode className="h-5 w-5 mr-2" />
                  Start Scanning
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan Input Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Scan Item Barcode</DialogTitle>
          </DialogHeader>
          
          <Tabs value={scanMode} onValueChange={(value: any) => setScanMode(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Camera Scan
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Manual Entry
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="camera" className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-800">
                  <strong>📱 Camera Scanner Active</strong><br />
                  Point your camera at a barcode. When detected, it will automatically process.
                </div>
              </div>
              
              <CameraScanner
                onResult={handleScanResult}
                onError={(error) => {
                  console.error('Camera error:', error);
                  toast.error(`❌ Camera error: ${error}`);
                }}
                isActive={scanMode === 'camera' && showScanDialog}
                autoComplete={true}
                className="w-full"
              />
              
              {selectedOperator && (
                <div className="text-xs text-center text-muted-foreground">
                  Operator: {selectedOperator.name}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4">
              <form onSubmit={handleManualScan} className="space-y-4">
                <div className="relative">
                  <QrCode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={manualInputRef}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Enter barcode..."
                    className="pl-9"
                    autoComplete="off"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !selectedOperator || !manualInput.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Process Barcode'
                  )}
                </Button>
                {selectedOperator && (
                  <div className="text-xs text-center text-muted-foreground">
                    Operator: {selectedOperator.name}
                  </div>
                )}
              </form>
              
              {/* Camera scan in manual mode */}
              <div className="border-t pt-4">
                <div className="text-sm text-muted-foreground mb-2 text-center">Or scan with camera:</div>
                <CameraScanner
                  onResult={handleScanResult}
                  onError={(error) => toast.error(`❌ Camera error: ${error}`)}
                  isActive={scanMode === 'manual' && showScanDialog}
                  autoComplete={false}
                  className="w-full"
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Location Selection Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Select Location for {scannedItem?.itemCode}
            </DialogTitle>
          </DialogHeader>
          {scannedItem && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{scannedItem.itemCode}</h3>
                  <p className="text-sm text-muted-foreground">{scannedItem.description}</p>
                  <p className="text-sm">Weight: {scannedItem.weight}kg</p>
                  <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
                </div>
                {getItemStatusBadge(scannedItem.status)}
              </div>
            </div>
          )}
          <LocationSelector
            locations={availableLocations}
            onLocationSelect={handleLocationSelect}
          />
        </DialogContent>
      </Dialog>

      {/* Visual Confirmation Dialog */}
      <Dialog open={showVisualDialog} onOpenChange={setShowVisualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {scannedItem?.status === 'pending' ? 'Confirm Placement' : 'Confirm Picking'}
            </DialogTitle>
          </DialogHeader>
          {selectedLocation && scannedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{scannedItem.itemCode}</h3>
                <p className="text-sm text-muted-foreground">{scannedItem.description}</p>
                <p className="text-sm">Weight: {scannedItem.weight}kg</p>
                <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
                {getItemStatusBadge(scannedItem.status)}
              </div>
              
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-800">
                  <Home className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    After completing this action, you'll return to the dashboard
                  </span>
                </div>
              </div>
              
              <BayVisualizer
                location={selectedLocation}
                onConfirm={scannedItem.status === 'pending' ? handlePlaceItem : handlePickItem}
                mode={scannedItem.status === 'pending' ? 'place' : 'pick'}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
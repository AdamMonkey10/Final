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
import { QrCode, RefreshCw, Package, MapPin, Camera, Keyboard, Search, CheckCircle, AlertCircle, ArrowRight, Home } from 'lucide-react';
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
    console.log('🔥 SCAN RESULT RECEIVED:', scannedCode);
    
    if (!selectedOperator) {
      toast.error('⚠️ Please select an operator before scanning');
      return;
    }

    if (!scannedCode.trim()) {
      toast.error('❌ Invalid barcode scanned');
      return;
    }

    // Immediately process the scanned code
    setLastScannedCode(scannedCode.trim());
    setManualInput(scannedCode.trim());
    
    // Process the code immediately regardless of scan mode
    await processScannedCode(scannedCode.trim());
  };

  const processScannedCode = async (scannedCode: string) => {
    console.log('🔥 PROCESSING SCANNED CODE:', scannedCode);
    
    setSearchStatus('searching');
    setLoading(true);
    setProcessingComplete(false);

    try {
      console.log('🔍 Searching for item with system code:', scannedCode);
      const item = await getItemBySystemCode(scannedCode);
      
      if (!item) {
        console.log('❌ Item not found');
        setSearchStatus('not-found');
        toast.error(`❌ Item not found: ${scannedCode}`, {
          duration: 5000
        });
        return;
      }

      console.log('✅ Item found:', item);
      setSearchStatus('found');
      setScannedItem(item);

      toast.success(`✅ Found: ${item.itemCode}`, {
        description: `${item.description} (${item.weight}kg)`,
        duration: 3000
      });

      // Close scan dialog immediately
      setShowScanDialog(false);

      // Process based on item status
      if (item.status === 'pending') {
        console.log('📦 Item is pending - showing location selection');
        await loadLocations();
        setShowLocationDialog(true);
        
      } else if (item.status === 'placed') {
        console.log('📍 Item is placed - showing pick confirmation');
        const locations = await getLocations();
        const currentLocation = locations.find(loc => loc.code === item.location);
        
        if (currentLocation) {
          setSelectedLocation(currentLocation);
          setShowVisualDialog(true);
        } else {
          toast.error('❌ Location not found');
        }
      } else {
        toast.warning('⚠️ Item already removed');
        // Return to dashboard for removed items
        setTimeout(() => navigate('/'), 2000);
      }
      
    } catch (error) {
      console.error('❌ Error processing scan:', error);
      setSearchStatus('not-found');
      toast.error('❌ Failed to process scan');
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
      toast.error('❌ Weight capacity exceeded');
      return;
    }

    setSelectedLocation(location);
    setShowLocationDialog(false);
    setShowVisualDialog(true);
  };

  const handlePlaceItem = async () => {
    if (!scannedItem || !selectedLocation) return;

    setLoading(true);
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

      toast.success(`🎉 Item placed at ${selectedLocation.code}!`);
      setProcessingComplete(true);
      
      // Return to dashboard
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (error) {
      console.error('Error placing item:', error);
      toast.error('❌ Failed to place item');
    } finally {
      setLoading(false);
    }
  };

  const handlePickItem = async () => {
    if (!scannedItem || !selectedLocation) return;

    setLoading(true);
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

      toast.success(`🎉 Item picked from ${selectedLocation.code}!`);
      setProcessingComplete(true);
      
      // Return to dashboard
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (error) {
      console.error('Error picking item:', error);
      toast.error('❌ Failed to pick item');
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
        return <Search className="h-4 w-4 animate-spin text-blue-500" />;
      case 'found':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not-found':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <QrCode className="h-4 w-4 text-muted-foreground" />;
    }
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
                  <div className="text-sm text-muted-foreground mt-1">
                    {scannedItem.description} • {scannedItem.weight}kg • {getItemStatusBadge(scannedItem.status)}
                  </div>
                )}
                {processingComplete && (
                  <div className="flex items-center gap-2 text-green-600 mt-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Complete! Returning to dashboard...</span>
                  </div>
                )}
              </div>
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
              <QrCode className="h-5 w-5 mr-2" />
              {loading ? 'Processing...' : 'Start Scanning'}
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
              <CameraScanner
                onResult={handleScanResult}
                onError={(error) => toast.error(`❌ Camera error: ${error}`)}
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
                  {loading ? 'Processing...' : 'Process Barcode'}
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
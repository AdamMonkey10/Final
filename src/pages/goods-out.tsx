import { useState, useRef } from 'react';
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
import { QrCode, RefreshCw, Home, Loader2, CheckCircle, AlertCircle, Search, MapPin, Package, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'sonner';
import { getLocationByCode, updateLocation } from '@/lib/firebase/locations';
import { getItemsByLocation, updateItem } from '@/lib/firebase/items';
import { addMovement } from '@/lib/firebase/movements';
import { CameraScanner } from '@/components/camera-scanner';
import { BayVisualizer } from '@/components/bay-visualizer';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { Badge } from '@/components/ui/badge';
import type { Item, Location } from '@/types/warehouse';

export default function GoodsOutPage() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  const { showInstructions } = useInstructions();
  
  const [loading, setLoading] = useState(false);
  const [showLocationScanDialog, setShowLocationScanDialog] = useState(false);
  const [showItemScanDialog, setShowItemScanDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [manualItemInput, setManualItemInput] = useState('');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not-found'>('idle');
  const [scannedLocation, setScannedLocation] = useState<Location | null>(null);
  const [locationItems, setLocationItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [currentStep, setCurrentStep] = useState<'location' | 'item' | 'confirm' | 'complete'>('location');
  const manualLocationInputRef = useRef<HTMLInputElement>(null);
  const manualItemInputRef = useRef<HTMLInputElement>(null);

  const getOperatorName = () => {
    return selectedOperator?.name || user?.email || 'System';
  };

  const handleLocationScanResult = async (scannedCode: string) => {
    console.log('Location scan result:', scannedCode);
    
    if (!selectedOperator) {
      toast.error('Please select an operator before scanning');
      return;
    }

    if (!scannedCode.trim()) {
      toast.error('Invalid location barcode scanned');
      return;
    }

    setManualLocationInput(scannedCode.trim());
    await processLocationCode(scannedCode.trim());
  };

  const processLocationCode = async (locationCode: string) => {
    setSearchStatus('searching');
    setLoading(true);

    try {
      const location = await getLocationByCode(locationCode);
      
      if (!location) {
        setSearchStatus('not-found');
        toast.error(`Location not found: ${locationCode}`);
        return;
      }

      // Check if location has items
      const items = await getItemsByLocation(locationCode);
      
      if (items.length === 0) {
        setSearchStatus('not-found');
        toast.error(`No items found at location: ${locationCode}`);
        return;
      }

      setSearchStatus('found');
      setScannedLocation(location);
      setLocationItems(items);
      setCurrentStep('item');
      
      toast.success(`Found location: ${locationCode} with ${items.length} item(s)`);
      
      // Close location dialog and show item dialog
      setShowLocationScanDialog(false);
      setShowItemScanDialog(true);
      
    } catch (error) {
      console.error('Error processing location:', error);
      setSearchStatus('not-found');
      toast.error('Failed to process location');
    } finally {
      setLoading(false);
    }
  };

  const handleItemScanResult = async (scannedCode: string) => {
    console.log('Item scan result:', scannedCode);
    
    if (!scannedCode.trim()) {
      toast.error('Invalid item barcode scanned');
      return;
    }

    setManualItemInput(scannedCode.trim());
    await processItemCode(scannedCode.trim());
  };

  const processItemCode = async (itemCode: string) => {
    if (!scannedLocation || !locationItems.length) {
      toast.error('Please scan location first');
      return;
    }

    // Find the item in the location's items
    const item = locationItems.find(item => item.systemCode === itemCode);
    
    if (!item) {
      toast.error(`Item ${itemCode} not found at location ${scannedLocation.code}`);
      return;
    }

    setSelectedItem(item);
    setCurrentStep('confirm');
    
    toast.success(`Found item: ${item.itemCode}`);
    
    // Close item dialog and show confirmation
    setShowItemScanDialog(false);
    setShowConfirmDialog(true);
  };

  const handleManualLocationScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualLocationInput.trim()) {
      toast.error('Please enter a location code');
      return;
    }

    await processLocationCode(manualLocationInput.trim());
  };

  const handleManualItemScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualItemInput.trim()) {
      toast.error('Please enter an item code');
      return;
    }

    await processItemCode(manualItemInput.trim());
  };

  const handleConfirmPickup = async () => {
    if (!selectedItem || !scannedLocation) return;

    setLoading(true);
    setCurrentStep('complete');
    
    const pickingToast = toast.loading(`📤 Picking ${selectedItem.itemCode} from ${scannedLocation.code}...`, {
      duration: Infinity
    });

    try {
      // Update location weight
      await updateLocation(scannedLocation.id, {
        currentWeight: Math.max(0, scannedLocation.currentWeight - selectedItem.weight)
      });

      // Update item status
      await updateItem(selectedItem.id, {
        status: 'removed',
        location: null,
        locationVerified: false
      });

      // Record movement
      await addMovement({
        itemId: selectedItem.id,
        type: 'OUT',
        weight: selectedItem.weight,
        operator: getOperatorName(),
        reference: selectedItem.itemCode,
        notes: `Picked from ${scannedLocation.code} via goods-out process`
      });

      toast.dismiss(pickingToast);
      toast.success(`🎉 Item picked successfully!`, {
        description: `${selectedItem.itemCode} removed from ${scannedLocation.code}`,
        duration: 5000
      });
      
      setShowConfirmDialog(false);
      
      // Auto-complete after delay
      setTimeout(() => {
        handleComplete();
      }, 3000);
      
    } catch (error) {
      console.error('Error picking item:', error);
      toast.dismiss(pickingToast);
      toast.error('❌ Failed to pick item', {
        description: 'Please try again or contact support',
        duration: 5000
      });
      setCurrentStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setShowLocationScanDialog(false);
    setShowItemScanDialog(false);
    setShowConfirmDialog(false);
    setScannedLocation(null);
    setLocationItems([]);
    setSelectedItem(null);
    setCurrentStep('location');
    setManualLocationInput('');
    setManualItemInput('');
    setSearchStatus('idle');
    
    toast.success('Goods-out process completed!', {
      description: 'Ready to process another pickup',
      duration: 3000
    });
  };

  const resetState = () => {
    setScannedLocation(null);
    setLocationItems([]);
    setSelectedItem(null);
    setCurrentStep('location');
    setManualLocationInput('');
    setManualItemInput('');
    setSearchStatus('idle');
    setShowLocationScanDialog(false);
    setShowItemScanDialog(false);
    setShowConfirmDialog(false);
  };

  const getStepIndicator = () => {
    const steps = [
      { key: 'location', label: 'Scan Location', icon: MapPin },
      { key: 'item', label: 'Scan Item', icon: Package },
      { key: 'confirm', label: 'Confirm Pickup', icon: ArrowUpFromLine },
      { key: 'complete', label: 'Complete', icon: CheckCircle }
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
                isActive ? 'border-orange-500 bg-orange-500 text-white' :
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

  const getSearchStatusIcon = () => {
    switch (searchStatus) {
      case 'searching':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'found':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not-found':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const instructionSteps = [
    {
      title: "Select Operator",
      description: "Ensure an operator is selected before starting the goods-out process.",
      type: "warning" as const
    },
    {
      title: "Scan Location",
      description: "First, scan the location barcode where you want to pick items from.",
      type: "info" as const
    },
    {
      title: "Scan Item",
      description: "Then scan the specific item barcode you want to remove from that location.",
      type: "info" as const
    },
    {
      title: "Confirm Pickup",
      description: "Review the details and confirm the pickup to remove the item from stock.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Goods Out</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/scan')} variant="outline" size="sm" className="hidden md:flex">
            <QrCode className="h-4 w-4 mr-2" />
            Scan Items
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" size="sm">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={resetState} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      {getStepIndicator()}

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Goods Out Process"
          description="Remove items from warehouse locations. Scan the location first, then scan the specific item to pick."
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
              <span className="text-sm">Please select an operator from the top-right corner before starting goods-out.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Status Card */}
      {(scannedLocation || selectedItem || searchStatus !== 'idle') && (
        <Card className={`border-2 ${
          currentStep === 'complete' ? 'border-green-200 bg-green-50' :
          searchStatus === 'found' ? 'border-blue-200 bg-blue-50' :
          searchStatus === 'not-found' ? 'border-red-200 bg-red-50' :
          'border-gray-200'
        }`}>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {scannedLocation && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium">Location: {scannedLocation.code}</div>
                    <div className="text-sm text-muted-foreground">
                      {locationItems.length} item(s) available for pickup
                    </div>
                  </div>
                </div>
              )}
              
              {selectedItem && (
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">Item: {selectedItem.itemCode}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.description} ({selectedItem.weight}kg)
                    </div>
                  </div>
                </div>
              )}
              
              {currentStep === 'complete' && (
                <div className="flex items-center gap-3 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <div className="font-medium">Pickup completed successfully!</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Action Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <ArrowUpFromLine className="h-5 w-5" />
            {currentStep === 'location' && 'Scan Location'}
            {currentStep === 'item' && 'Scan Item'}
            {currentStep === 'confirm' && 'Confirm Pickup'}
            {currentStep === 'complete' && 'Pickup Complete'}
          </CardTitle>
          <CardDescription>
            {currentStep === 'location' && 'Scan the location barcode where you want to pick items from'}
            {currentStep === 'item' && 'Scan the specific item barcode you want to remove'}
            {currentStep === 'confirm' && 'Review and confirm the pickup details'}
            {currentStep === 'complete' && 'Item successfully removed from stock'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            {currentStep === 'location' && (
              <>
                <MapPin className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Ready to Scan Location</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Scan or enter the location barcode first
                </p>
                <Button 
                  onClick={() => setShowLocationScanDialog(true)}
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
                      <MapPin className="h-5 w-5 mr-2" />
                      Scan Location
                    </>
                  )}
                </Button>
              </>
            )}
            
            {currentStep === 'item' && (
              <>
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Ready to Scan Item</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Scan the item you want to pick from {scannedLocation?.code}
                </p>
                <Button 
                  onClick={() => setShowItemScanDialog(true)}
                  size="lg"
                  className="w-full max-w-md"
                  disabled={loading}
                >
                  <Package className="h-5 w-5 mr-2" />
                  Scan Item
                </Button>
              </>
            )}
            
            {currentStep === 'complete' && (
              <>
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium text-green-800 mb-2">
                  Pickup Completed!
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Item successfully removed from warehouse
                </p>
                <Button 
                  onClick={handleComplete}
                  size="lg"
                  className="w-full max-w-md"
                >
                  Process Another Pickup
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Scan Dialog */}
      <Dialog open={showLocationScanDialog} onOpenChange={setShowLocationScanDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Scan Location Barcode</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Manual Input Section */}
            <form onSubmit={handleManualLocationScan} className="space-y-4">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={manualLocationInputRef}
                  value={manualLocationInput}
                  onChange={(e) => setManualLocationInput(e.target.value)}
                  placeholder="Enter location code or scan with camera..."
                  className="pl-9 text-lg h-12"
                  autoComplete="off"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg" disabled={loading || !selectedOperator || !manualLocationInput.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Location'
                )}
              </Button>
            </form>
            
            {/* Camera Scanner Section */}
            <div className="border-t pt-6">
              <div className="text-sm text-muted-foreground mb-4 text-center">
                Or use camera to scan:
              </div>
              <CameraScanner
                onResult={handleLocationScanResult}
                onError={(error) => toast.error(`Camera error: ${error}`)}
                isActive={showLocationScanDialog}
                autoComplete={false}
                className="w-full"
              />
            </div>
            
            {selectedOperator && (
              <div className="text-xs text-center text-muted-foreground border-t pt-4">
                Operator: {selectedOperator.name}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Scan Dialog */}
      <Dialog open={showItemScanDialog} onOpenChange={setShowItemScanDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Scan Item Barcode</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Location Info */}
            {scannedLocation && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <MapPin className="h-5 w-5" />
                  <span className="font-medium">Location: {scannedLocation.code}</span>
                </div>
                <div className="text-sm text-blue-700">
                  {locationItems.length} item(s) available for pickup
                </div>
              </div>
            )}
            
            {/* Manual Input Section */}
            <form onSubmit={handleManualItemScan} className="space-y-4">
              <div className="relative">
                <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={manualItemInputRef}
                  value={manualItemInput}
                  onChange={(e) => setManualItemInput(e.target.value)}
                  placeholder="Enter item barcode or scan with camera..."
                  className="pl-9 text-lg h-12"
                  autoComplete="off"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg" disabled={loading || !manualItemInput.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Item'
                )}
              </Button>
            </form>
            
            {/* Camera Scanner Section */}
            <div className="border-t pt-6">
              <div className="text-sm text-muted-foreground mb-4 text-center">
                Or use camera to scan:
              </div>
              <CameraScanner
                onResult={handleItemScanResult}
                onError={(error) => toast.error(`Camera error: ${error}`)}
                isActive={showItemScanDialog}
                autoComplete={false}
                className="w-full"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Item Pickup</DialogTitle>
          </DialogHeader>
          
          {selectedItem && scannedLocation && (
            <div className="space-y-4">
              {/* Item Details */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{selectedItem.itemCode}</h3>
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                <p className="text-sm">Weight: {selectedItem.weight}kg</p>
                <p className="text-xs text-muted-foreground">System Code: {selectedItem.systemCode}</p>
                <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
              </div>
              
              {/* Location Visualizer */}
              <BayVisualizer
                location={scannedLocation}
                onConfirm={handleConfirmPickup}
                mode="pick"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
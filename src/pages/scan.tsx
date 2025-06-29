import { useState, useEffect } from 'react';
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
import { QrCode, RefreshCcw, Package, MapPin, Camera, Keyboard } from 'lucide-react';
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
      toast.error('Failed to load locations');
    }
  };

  const getOperatorName = () => {
    return selectedOperator?.name || user?.email || 'System';
  };

  const handleScanResult = async (scannedCode: string) => {
    if (!selectedOperator) {
      toast.error('Please select an operator before scanning');
      return;
    }

    if (!scannedCode.trim()) {
      toast.error('Invalid barcode scanned');
      return;
    }

    setLoading(true);
    try {
      const item = await getItemBySystemCode(scannedCode.trim());
      
      if (!item) {
        toast.error('Item not found');
        return;
      }

      setScannedItem(item);

      if (item.status === 'pending') {
        // Item needs to be placed
        toast.success(`Item found: ${item.itemCode}. Select a location to place it.`);
        setShowScanDialog(false);
        setShowLocationDialog(true);
      } else if (item.status === 'placed') {
        // Item can be picked
        toast.success(`Item found: ${item.itemCode} at ${item.location}. Confirm to pick.`);
        setShowScanDialog(false);
        
        // Find the current location for visualization
        const locations = await getLocations();
        const currentLocation = locations.find(loc => loc.code === item.location);
        if (currentLocation) {
          setSelectedLocation(currentLocation);
          setShowVisualDialog(true);
        } else {
          toast.error('Current location not found');
        }
      } else {
        toast.error('Item has already been removed');
      }
    } catch (error) {
      console.error('Error scanning item:', error);
      toast.error('Failed to scan item');
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('scanInput') as HTMLInputElement;
    const scannedCode = input.value.trim();
    form.reset();

    await handleScanResult(scannedCode);
  };

  const handleLocationSelect = async (location: Location) => {
    if (!scannedItem) return;
    
    // Check if location can accept the item weight
    const newWeight = location.currentWeight + scannedItem.weight;
    if (location.level !== '0' && newWeight > location.maxWeight) {
      toast.error('Location weight capacity exceeded');
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

      toast.success(`Item placed at ${selectedLocation.code}`);
      resetState();
    } catch (error) {
      console.error('Error placing item:', error);
      toast.error('Failed to place item');
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

      toast.success(`Item picked from ${selectedLocation.code}`);
      resetState();
    } catch (error) {
      console.error('Error picking item:', error);
      toast.error('Failed to pick item');
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

  const instructionSteps = [
    {
      title: "Select Operator",
      description: "Ensure an operator is selected from the top-right corner before scanning any items.",
      type: "warning" as const
    },
    {
      title: "Choose Scan Method",
      description: "Use camera scanning for quick barcode capture or manual entry for typing codes directly.",
      type: "info" as const
    },
    {
      title: "Scan Item Barcode",
      description: "Point your camera at the barcode or enter the system-generated code to identify the item.",
      type: "info" as const
    },
    {
      title: "Pending Items - Place",
      description: "For pending items, select a suitable location and confirm placement by scanning the location barcode.",
      type: "info" as const
    },
    {
      title: "Placed Items - Pick",
      description: "For placed items, the system will show their current location and allow you to pick them.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Scanner</h1>
        <Button onClick={resetState} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Warehouse Scanner Guide"
          description="Scan item barcodes to place pending items in locations or pick placed items from storage. Choose between camera scanning or manual entry."
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan Item Barcode
          </CardTitle>
          <CardDescription>
            Scan an item to place it in a location or pick it from storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Ready to Scan</p>
            <p className="text-sm text-muted-foreground mb-6">
              Scan an item barcode to begin placement or picking
            </p>
            <Button 
              onClick={() => setShowScanDialog(true)}
              size="lg"
              className="w-full max-w-md"
              disabled={!selectedOperator}
            >
              <QrCode className="h-5 w-5 mr-2" />
              Start Scanning
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
                onError={(error) => toast.error(error)}
                isActive={scanMode === 'camera' && showScanDialog}
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
                    name="scanInput"
                    placeholder="Enter barcode manually..."
                    className="pl-9"
                    autoComplete="off"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !selectedOperator}>
                  {loading ? 'Scanning...' : 'Scan Item'}
                </Button>
                {selectedOperator && (
                  <div className="text-xs text-center text-muted-foreground">
                    Operator: {selectedOperator.name}
                  </div>
                )}
              </form>
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
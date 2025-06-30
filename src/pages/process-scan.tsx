import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QrCode, MapPin, Home, ArrowLeft, CheckCircle, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getLocations, updateLocation } from '@/lib/firebase/locations';
import { updateItem } from '@/lib/firebase/items';
import { addMovement } from '@/lib/firebase/movements';
import { LocationSelector } from '@/components/location-selector';
import { BayVisualizer } from '@/components/bay-visualizer';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { Badge } from '@/components/ui/badge';
import type { Item, Location } from '@/types/warehouse';

export default function ProcessScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useFirebase();
  const { selectedOperator } = useOperator();
  const { showInstructions } = useInstructions();
  
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'location' | 'confirm' | 'complete'>('location');

  useEffect(() => {
    // Get the scanned item from navigation state
    const item = location.state?.scannedItem as Item;
    
    if (!item) {
      toast.error('No item data found');
      navigate('/scan');
      return;
    }

    setScannedItem(item);

    // Determine the workflow based on item status
    if (item.status === 'pending') {
      setCurrentStep('location');
      loadLocations();
      setShowLocationDialog(true);
    } else if (item.status === 'placed') {
      setCurrentStep('confirm');
      loadCurrentLocation(item.location!);
    }
  }, [location.state, navigate]);

  const loadLocations = async () => {
    try {
      const locations = await getLocations();
      setAvailableLocations(locations);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const loadCurrentLocation = async (locationCode: string) => {
    try {
      const locations = await getLocations();
      const currentLocation = locations.find(loc => loc.code === locationCode);
      
      if (currentLocation) {
        setSelectedLocation(currentLocation);
        setShowVisualDialog(true);
      } else {
        toast.error('Current location not found');
        navigate('/scan');
      }
    } catch (error) {
      console.error('Error loading current location:', error);
      toast.error('Failed to load location details');
    }
  };

  const getOperatorName = () => {
    return selectedOperator?.name || user?.email || 'System';
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

    setSelectedLocation(location);
    setShowLocationDialog(false);
    setCurrentStep('confirm');
    setShowVisualDialog(true);
    
    toast.success(`✅ Location selected: ${location.code}`, {
      description: 'Confirm placement in the next step',
      duration: 3000
    });
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

      toast.dismiss(placementToast);
      toast.success(`🎉 Item placed successfully!`, {
        description: `${scannedItem.itemCode} is now at ${selectedLocation.code}`,
        duration: 5000
      });
      
      setShowVisualDialog(false);
      
      // Navigate back to dashboard after delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
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

      toast.dismiss(pickingToast);
      toast.success(`🎉 Item picked successfully!`, {
        description: `${scannedItem.itemCode} removed from ${selectedLocation.code}`,
        duration: 5000
      });
      
      setShowVisualDialog(false);
      
      // Navigate back to dashboard after delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
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

  const getStepIndicator = () => {
    const steps = [
      { key: 'location', label: 'Location', icon: MapPin },
      { key: 'confirm', label: 'Confirm', icon: CheckCircle },
      { key: 'complete', label: 'Complete', icon: Home }
    ];

    // For placed items, skip location step
    const relevantSteps = scannedItem?.status === 'placed' 
      ? steps.filter(s => s.key !== 'location')
      : steps;

    return (
      <div className="flex items-center justify-center space-x-2 mb-6">
        {relevantSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.key;
          const isCompleted = relevantSteps.findIndex(s => s.key === currentStep) > index;
          
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                isActive ? 'border-blue-500 bg-blue-500 text-white' :
                isCompleted ? 'border-green-500 bg-green-500 text-white' :
                'border-gray-300 bg-gray-100 text-gray-400'
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              {index < relevantSteps.length - 1 && (
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
      title: "Item Processing",
      description: "Process the scanned item based on its current status - place pending items or pick placed items.",
      type: "info" as const
    },
    {
      title: "Location Selection",
      description: "For pending items, select an appropriate location considering weight capacity and accessibility.",
      type: "info" as const
    },
    {
      title: "Confirmation",
      description: "Confirm the action using the bay visualizer. The system will update all records automatically.",
      type: "success" as const
    }
  ];

  if (!scannedItem) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading item details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Process Item</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/scan')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Scan
          </Button>
          <Button onClick={() => navigate('/')} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      {getStepIndicator()}

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Item Processing"
          description="Complete the workflow for your scanned item. Follow the steps to place or pick items from warehouse locations."
          steps={instructionSteps}
          onClose={() => {}}
          className="mb-6"
        />
      )}

      {/* Item Details Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Scanned Item Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">{scannedItem.itemCode}</h3>
              <p className="text-sm text-muted-foreground">{scannedItem.description}</p>
              <p className="text-sm">Weight: {scannedItem.weight}kg</p>
              <p className="text-xs text-muted-foreground">System Code: {scannedItem.systemCode}</p>
              <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
              {scannedItem.location && (
                <p className="text-sm font-medium text-blue-600">Current Location: {scannedItem.location}</p>
              )}
            </div>
            <div className="text-right">
              {getItemStatusBadge(scannedItem.status)}
              <div className="mt-2 text-sm text-muted-foreground">
                {scannedItem.status === 'pending' && 'Ready to place'}
                {scannedItem.status === 'placed' && 'Ready to pick'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      {currentStep === 'complete' && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-green-800">
              <CheckCircle className="h-6 w-6" />
              <div>
                <div className="font-medium">
                  {scannedItem.status === 'pending' ? 'Item Placed Successfully!' : 'Item Picked Successfully!'}
                </div>
                <div className="text-sm">Returning to dashboard...</div>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Selection Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Select Location for {scannedItem.itemCode}
            </DialogTitle>
          </DialogHeader>
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
              {scannedItem.status === 'pending' ? 'Confirm Placement' : 'Confirm Picking'}
            </DialogTitle>
          </DialogHeader>
          {selectedLocation && (
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
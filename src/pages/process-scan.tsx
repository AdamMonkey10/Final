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
import { getLocations, updateLocation, getLocationByCode } from '@/lib/firebase/locations';
import { updateItem } from '@/lib/firebase/items';
import { addMovement } from '@/lib/firebase/movements';
import { BayVisualizer } from '@/components/bay-visualizer';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { Badge } from '@/components/ui/badge';
import type { Item, Location } from '@/types/warehouse';

export default function ProcessScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useFirebase();
  const { selectedOperator } = useOperator();
  
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'confirm' | 'complete'>('confirm');

  useEffect(() => {
    // Get the scanned item from navigation state
    const item = location.state?.scannedItem as Item;
    
    if (!item) {
      toast.error('No item data found');
      navigate('/scan');
      return;
    }

    setScannedItem(item);

    // Since we only handle placed items, load the current location
    if (item.status === 'placed' && item.location) {
      loadCurrentLocation(item.location);
    } else {
      toast.error('Item is not available for pickup');
      navigate('/scan');
    }
  }, [location.state, navigate]);

  const loadCurrentLocation = async (locationCode: string) => {
    try {
      const locationData = await getLocationByCode(locationCode);
      
      if (locationData) {
        setCurrentLocation(locationData);
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

  const handlePickItem = async () => {
    if (!scannedItem || !currentLocation) return;

    setLoading(true);
    setCurrentStep('complete');
    
    const pickingToast = toast.loading(`📤 Picking ${scannedItem.itemCode} from ${currentLocation.code}...`, {
      duration: Infinity
    });

    try {
      // Update location weight
      await updateLocation(currentLocation.id, {
        currentWeight: Math.max(0, currentLocation.currentWeight - scannedItem.weight)
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
        notes: `Picked from ${currentLocation.code}`
      });

      toast.dismiss(pickingToast);
      toast.success(`🎉 Item picked successfully!`, {
        description: `${scannedItem.itemCode} removed from ${currentLocation.code}`,
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
      { key: 'confirm', label: 'Confirm Pickup', icon: CheckCircle },
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
        <h1 className="text-3xl font-bold">Pick Item</h1>
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

      {/* Item Details Card */}
      <Card className="border-2 border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Item to Pick
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
              <p className="text-sm font-medium text-orange-600">Current Location: {scannedItem.location}</p>
            </div>
            <div className="text-right">
              {getItemStatusBadge(scannedItem.status)}
              <div className="mt-2 text-sm text-muted-foreground">
                Ready to pick
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
                <div className="font-medium">Item Picked Successfully!</div>
                <div className="text-sm">Returning to dashboard...</div>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual Confirmation Dialog */}
      <Dialog open={showVisualDialog} onOpenChange={setShowVisualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Item Pickup</DialogTitle>
          </DialogHeader>
          {currentLocation && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{scannedItem.itemCode}</h3>
                <p className="text-sm text-muted-foreground">{scannedItem.description}</p>
                <p className="text-sm">Weight: {scannedItem.weight}kg</p>
                <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
                {getItemStatusBadge(scannedItem.status)}
              </div>
              
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 text-orange-800">
                  <Home className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    After pickup, you'll return to the dashboard
                  </span>
                </div>
              </div>
              
              <BayVisualizer
                location={currentLocation}
                onConfirm={handlePickItem}
                mode="pick"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
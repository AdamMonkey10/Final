import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addItem } from '@/lib/firebase/items';
import { getLocations, updateLocation } from '@/lib/firebase/locations';
import { addMovement } from '@/lib/firebase/movements';
import { ProductSelector } from '@/components/product-selector';
import { LocationSelector } from '@/components/location-selector';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { generateItemZPL, type ItemLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
import { Barcode } from '@/components/barcode';
import { BayVisualizer } from '@/components/bay-visualizer';
import { CameraScanner } from '@/components/camera-scanner';
import { findOptimalLocation, getSuitableLocations } from '@/lib/warehouse-logic';
import { PackagePlus, Printer, CheckCircle, Package, QrCode, Home, MapPin, Scan, RefreshCw, ArrowLeft, X, Star } from 'lucide-react';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { useNavigate } from 'react-router-dom';
import type { Location } from '@/types/warehouse';

export default function GoodsInPage() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  const { showInstructions } = useInstructions();
  
  const [formData, setFormData] = useState({
    itemCode: '',
    description: '',
    weight: '',
    quantity: '1'
  });
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showLocationGraphicDialog, setShowLocationGraphicDialog] = useState(false);
  const [showScanLocationDialog, setShowScanLocationDialog] = useState(false);
  const [createdItem, setCreatedItem] = useState<{
    id: string;
    systemCode: string;
    itemCode: string;
    description: string;
    weight: number;
  } | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<Location | null>(null);
  const [suitableLocations, setSuitableLocations] = useState<Location[]>([]);
  const [printing, setPrinting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'label' | 'location' | 'graphic' | 'scan' | 'complete'>('form');

  useEffect(() => {
    if (user && !authLoading) {
      loadLocations();
    }
  }, [user, authLoading]);

  const loadLocations = async () => {
    try {
      const fetchedLocations = await getLocations();
      setLocations(fetchedLocations);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const generateSystemCode = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SYS${timestamp}${random}`;
  };

  const getOperatorName = () => {
    return selectedOperator?.name || user?.email || 'System';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOperator) {
      toast.error('Please select an operator before creating items');
      return;
    }

    if (!formData.itemCode || !formData.description || !formData.weight) {
      toast.error('Please fill in Product/SKU, description, and weight');
      return;
    }

    const weight = parseFloat(formData.weight);
    if (isNaN(weight) || weight <= 0) {
      toast.error('Please enter a valid weight greater than 0');
      return;
    }

    setLoading(true);
    setCurrentStep('label');

    try {
      const systemCode = generateSystemCode();

      // Store created item details
      setCreatedItem({
        id: '', // Will be set after placement
        systemCode,
        itemCode: formData.itemCode,
        description: formData.description,
        weight
      });

      toast.success('Item created!', {
        description: `System code: ${systemCode}`,
        duration: 3000
      });

      // Show label generation dialog first
      setShowLabelDialog(true);

    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to create item');
      setCurrentStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!createdItem) return;

    setPrinting(true);
    
    try {
      const labelData: ItemLabelData = {
        systemCode: createdItem.systemCode,
        itemCode: createdItem.itemCode,
        description: createdItem.description,
        weight: createdItem.weight,
        location: '', // No location yet
        operator: getOperatorName(),
        date: new Date().toLocaleDateString(),
      };

      const zpl = generateItemZPL(labelData);
      await sendZPL(zpl);
      
      toast.success('Label printed successfully!');
      
    } catch (error) {
      console.error('Print error:', error);
      toast.warning(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPrinting(false);
    }
  };

  const handleContinueToLocation = async () => {
    if (!createdItem) return;

    setCurrentStep('location');
    
    try {
      // Find optimal location and all suitable locations
      const optimalLocation = findOptimalLocation(locations, createdItem.weight, false);
      const allSuitableLocations = getSuitableLocations(locations, createdItem.weight);
      
      if (allSuitableLocations.length === 0) {
        toast.error('No suitable locations found for this weight');
        return;
      }

      setSuggestedLocation(optimalLocation);
      setSuitableLocations(allSuitableLocations);

      const weightInfo = createdItem.weight > 1000 ? ' (Heavy item - ground level only)' : '';
      
      toast.success('Locations found!', {
        description: `${allSuitableLocations.length} suitable locations available${weightInfo}`,
        duration: 3000
      });

      // Close label dialog and show location selection
      setShowLabelDialog(false);
      setShowLocationDialog(true);

    } catch (error) {
      console.error('Error finding locations:', error);
      toast.error('Failed to find suitable locations');
    }
  };

  const handleUseRecommended = () => {
    if (!suggestedLocation) return;
    
    toast.success(`Using recommended location: ${suggestedLocation.code}`);
    setCurrentStep('graphic');
    setShowLocationDialog(false);
    setShowLocationGraphicDialog(true);
  };

  const handleLocationSelect = (location: Location) => {
    if (!createdItem) return;
    
    // Check if location can accept the item weight
    if (location.level !== '0') {
      const newWeight = location.currentWeight + createdItem.weight;
      if (newWeight > location.maxWeight) {
        toast.error('❌ Location weight capacity exceeded', {
          description: `${newWeight}kg would exceed ${location.maxWeight}kg limit`,
          duration: 5000
        });
        return;
      }
    }

    toast.success(`Location ${location.code} selected`);
    setSuggestedLocation(location);
    setCurrentStep('graphic');
    setShowLocationDialog(false);
    setShowLocationGraphicDialog(true);
  };

  const handleScanToPlace = () => {
    if (!suggestedLocation) return;
    
    setCurrentStep('scan');
    setShowLocationGraphicDialog(false);
    setShowScanLocationDialog(true);
  };

  const handleLocationScan = async (scannedCode: string) => {
    if (!suggestedLocation || !createdItem) {
      return;
    }
    
    // Verify the scanned location matches the selected location
    if (scannedCode !== suggestedLocation.code) {
      toast.error(`Wrong location scanned. Expected: ${suggestedLocation.code}, Got: ${scannedCode}`);
      return;
    }
    
    setLoading(true);
    setCurrentStep('complete');
    
    try {
      // Create the item with placed status
      const itemId = await addItem({
        itemCode: createdItem.itemCode,
        systemCode: createdItem.systemCode,
        description: createdItem.description,
        weight: createdItem.weight,
        category: 'general',
        status: 'placed',
        metadata: {}
      });

      // Update location weight
      await updateLocation(suggestedLocation.id, {
        currentWeight: suggestedLocation.currentWeight + createdItem.weight
      });

      // Record movement
      await addMovement({
        itemId: itemId,
        type: 'IN',
        weight: createdItem.weight,
        operator: getOperatorName(),
        reference: createdItem.itemCode,
        notes: `Placed at ${suggestedLocation.code} via goods-in process`
      });

      // Update created item with ID
      setCreatedItem(prev => prev ? { ...prev, id: itemId } : null);

      toast.success('🎉 Item placed in stock successfully!', {
        description: `${createdItem.itemCode} is now at ${suggestedLocation.code}`,
        duration: 5000
      });
      
      setShowScanLocationDialog(false);
      
      // Auto-complete after delay
      setTimeout(() => {
        handleComplete();
      }, 3000);
      
    } catch (error) {
      console.error('Error placing item:', error);
      toast.error('❌ Failed to place item in stock');
      setCurrentStep('scan');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    // Reset everything
    setCreatedItem(null);
    setSuggestedLocation(null);
    setSuitableLocations([]);
    setCurrentStep('form');
    
    // Reset form
    setFormData({
      itemCode: '',
      description: '',
      weight: '',
      quantity: '1'
    });
    
    toast.success('Ready for next item!', {
      description: 'Goods-in process completed',
      duration: 3000
    });
  };

  const handleBackToLocationSelection = () => {
    setShowScanLocationDialog(false);
    setCurrentStep('location');
    setShowLocationDialog(true);
  };

  const handleBackToLocationGraphic = () => {
    setShowScanLocationDialog(false);
    setCurrentStep('graphic');
    setShowLocationGraphicDialog(true);
  };

  const getStepIndicator = () => {
    const steps = [
      { key: 'form', label: 'Item Details', icon: Package },
      { key: 'label', label: 'Generate Label', icon: Printer },
      { key: 'location', label: 'Choose Location', icon: MapPin },
      { key: 'graphic', label: 'Location View', icon: Star },
      { key: 'scan', label: 'Scan to Place', icon: Scan },
      { key: 'complete', label: 'In Stock', icon: CheckCircle }
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
      title: "Create Item",
      description: "Enter item details including Product/SKU, description, and weight.",
      type: "info" as const
    },
    {
      title: "Generate Label",
      description: "Print the item barcode label first, then proceed to location selection.",
      type: "info" as const
    },
    {
      title: "Choose Location",
      description: "Select from recommended or other suitable locations based on weight capacity.",
      type: "info" as const
    },
    {
      title: "View Location",
      description: "See the location graphic and confirm your choice before scanning.",
      type: "info" as const
    },
    {
      title: "Scan to Place",
      description: "Scan the location barcode to confirm placement and put the item into stock.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Goods In</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/scan')} variant="outline" size="sm" className="hidden md:flex">
            <QrCode className="h-4 w-4 mr-2" />
            Scan Items
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" size="sm">
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
          title="Goods In Process"
          description="Create items, generate labels, choose locations, and place items into stock with guided workflow."
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
              <span className="text-sm">Please select an operator from the top-right corner before creating items.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <PackagePlus className="h-5 w-5" />
            Create New Item
          </CardTitle>
          <CardDescription>
            Enter details for items entering the warehouse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <ProductSelector
                  value={formData.itemCode}
                  onChange={(value) => setFormData({ ...formData, itemCode: value })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-base">Description *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Item description"
                  required
                  disabled={loading}
                  className="h-14 text-base"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight" className="text-base">Weight (kg) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="0.00"
                    required
                    disabled={loading}
                    className="h-14 text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Items &gt;1000kg automatically go to ground level
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-base">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="1"
                    disabled={loading}
                    className="h-14 text-base"
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-16 text-lg"
              disabled={loading || !selectedOperator}
            >
              {loading ? 'Creating Item...' : 'Create Item'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Label Generation Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Generate Item Label
            </DialogTitle>
          </DialogHeader>
          
          {createdItem && (
            <div className="space-y-6">
              {/* Item Details */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="space-y-2 text-sm">
                  <div><strong>Product/SKU:</strong> {createdItem.itemCode}</div>
                  <div><strong>Description:</strong> {createdItem.description}</div>
                  <div><strong>Weight:</strong> {createdItem.weight}kg</div>
                  <div><strong>System Code:</strong> {createdItem.systemCode}</div>
                  <div><strong>Operator:</strong> {getOperatorName()}</div>
                </div>
              </div>

              {/* Label Preview */}
              <div className="border rounded-lg p-6 bg-white">
                <div className="text-center space-y-4">
                  <div className="text-lg font-bold">{createdItem.itemCode}</div>
                  <div className="text-sm text-muted-foreground">{createdItem.description}</div>
                  <div className="text-3xl font-bold text-primary">{createdItem.systemCode}</div>
                  <div className="text-sm">Weight: {createdItem.weight}kg</div>
                  
                  {/* Barcode Preview */}
                  <div className="py-4">
                    <Barcode 
                      value={createdItem.systemCode} 
                      width={2} 
                      height={60}
                      className="mx-auto"
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <div>Date: {new Date().toLocaleDateString()}</div>
                    <div>Operator: {getOperatorName()}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handlePrintLabel}
                  className="h-14 text-base"
                  disabled={printing}
                >
                  <Printer className="h-5 w-5 mr-2" />
                  {printing ? 'Printing...' : 'Print Label'}
                </Button>
                <Button 
                  onClick={handleContinueToLocation}
                  variant="outline"
                  className="h-14 text-base"
                >
                  Continue to Location Selection
                </Button>
              </div>

              <div className="text-xs text-center text-muted-foreground">
                <p>Print the label first, then proceed to select a location for the item.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Selection Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Choose Location for {createdItem?.itemCode}
            </DialogTitle>
          </DialogHeader>
          {createdItem && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{createdItem.itemCode}</h3>
                    <p className="text-sm text-muted-foreground">{createdItem.description}</p>
                    <p className="text-sm">Weight: {createdItem.weight}kg</p>
                    <p className="text-xs text-muted-foreground">System Code: {createdItem.systemCode}</p>
                  </div>
                  <div className="text-right">
                    {createdItem.weight > 1000 && (
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        Heavy Item - Ground Level Only
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {suggestedLocation && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors" onClick={handleUseRecommended}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="flex items-center gap-2 text-blue-800 mb-1">
                          <MapPin className="h-4 w-4" />
                          <span className="font-medium">Recommended: {suggestedLocation.code}</span>
                        </div>
                        <div className="text-sm text-blue-700">
                          Row {suggestedLocation.row}, Bay {suggestedLocation.bay}, Level {suggestedLocation.level === '0' ? 'Ground' : suggestedLocation.level}
                        </div>
                        <div className="text-xs text-blue-600">
                          Current: {suggestedLocation.currentWeight}kg / Max: {suggestedLocation.maxWeight === Infinity ? 'Unlimited' : `${suggestedLocation.maxWeight}kg`}
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseRecommended();
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Use Recommended
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  {suitableLocations.length} Suitable Locations
                </h3>
                <Button onClick={loadLocations} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <LocationSelector
                locations={suitableLocations}
                onLocationSelect={handleLocationSelect}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Graphic Dialog */}
      <Dialog open={showLocationGraphicDialog} onOpenChange={setShowLocationGraphicDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Location: {suggestedLocation?.code}
            </DialogTitle>
          </DialogHeader>
          
          {suggestedLocation && createdItem && (
            <div className="space-y-4">
              {/* Item Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="space-y-2 text-sm">
                  <div><strong>Item:</strong> {createdItem.itemCode}</div>
                  <div><strong>Weight:</strong> {createdItem.weight}kg</div>
                  <div><strong>Location:</strong> {suggestedLocation.code}</div>
                  <div><strong>Operator:</strong> {getOperatorName()}</div>
                </div>
              </div>

              {/* Bay Visualizer */}
              <BayVisualizer
                location={suggestedLocation}
                onConfirm={handleScanToPlace}
                mode="place"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Scan Location Dialog */}
      <Dialog open={showScanLocationDialog} onOpenChange={(open) => {
        if (!open) {
          handleBackToLocationGraphic();
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Scan Location to Place Item
              </DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToLocationGraphic}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToLocationGraphic}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {suggestedLocation && createdItem && (
            <div className="space-y-6">
              {/* Location Instructions */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <MapPin className="h-5 w-5" />
                  <span className="font-medium">Scan Location: {suggestedLocation.code}</span>
                </div>
                <div className="text-sm text-green-700">
                  Row {suggestedLocation.row}, Bay {suggestedLocation.bay}, Level {suggestedLocation.level === '0' ? 'Ground' : suggestedLocation.level}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Scan the location barcode to confirm placement
                </div>
              </div>

              {/* Camera Scanner */}
              <CameraScanner
                onResult={handleLocationScan}
                onError={(error) => toast.error(`Scanner error: ${error}`)}
                isActive={showScanLocationDialog}
                autoComplete={true}
                className="w-full"
              />

              <div className="text-xs text-center text-muted-foreground">
                <p>Scan the location barcode to place the item into stock.</p>
                <p>Expected location: <strong>{suggestedLocation.code}</strong></p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      {currentStep === 'complete' && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Item Placed Successfully!
              </DialogTitle>
            </DialogHeader>
            
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-green-800 mb-2">
                Item Successfully Added to Stock!
              </h3>
              {createdItem && suggestedLocation && (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>{createdItem.itemCode}</strong> is now at <strong>{suggestedLocation.code}</strong></p>
                  <p>Weight: {createdItem.weight}kg</p>
                  <p>Operator: {getOperatorName()}</p>
                </div>
              )}
              <div className="mt-6 text-sm text-muted-foreground">
                Preparing for next item...
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
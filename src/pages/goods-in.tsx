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
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { generateItemZPL, type ItemLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
import { Barcode } from '@/components/barcode';
import { BayVisualizer } from '@/components/bay-visualizer';
import { CameraScanner } from '@/components/camera-scanner';
import { findOptimalLocation } from '@/lib/warehouse-logic';
import { PackagePlus, Printer, CheckCircle, Package, QrCode, Home, MapPin, Scan } from 'lucide-react';
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
  const [showScanLocationDialog, setShowScanLocationDialog] = useState(false);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [createdItem, setCreatedItem] = useState<{
    id: string;
    systemCode: string;
    itemCode: string;
    description: string;
    weight: number;
  } | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<Location | null>(null);
  const [printing, setPrinting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'scan' | 'label' | 'complete'>('form');

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
    setCurrentStep('scan');

    try {
      const systemCode = generateSystemCode();

      // Find optimal location based on weight
      const optimalLocation = findOptimalLocation(locations, weight, false);
      
      if (!optimalLocation) {
        toast.error('No suitable location found for this weight');
        setLoading(false);
        setCurrentStep('form');
        return;
      }

      // Store created item details for later use
      setCreatedItem({
        id: '', // Will be set after location scanning
        systemCode,
        itemCode: formData.itemCode,
        description: formData.description,
        weight
      });

      setSuggestedLocation(optimalLocation);

      toast.success('Item details ready!', {
        description: `System code: ${systemCode}. Suggested location: ${optimalLocation.code}`,
        duration: 3000
      });

      // Show location scanning dialog
      setShowScanLocationDialog(true);

    } catch (error) {
      console.error('Error preparing item:', error);
      toast.error('Failed to prepare item');
      setCurrentStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationScan = async (scannedCode: string) => {
    if (!suggestedLocation || !createdItem) {
      return;
    }
    
    // Verify the scanned location matches the suggested location
    if (scannedCode !== suggestedLocation.code) {
      toast.error(`Wrong location scanned. Expected: ${suggestedLocation.code}, Got: ${scannedCode}`);
      return;
    }
    
    setLoading(true);
    setCurrentStep('label');
    
    try {
      // Create the item with placed status immediately
      const itemId = await addItem({
        itemCode: createdItem.itemCode,
        systemCode: createdItem.systemCode,
        description: createdItem.description,
        weight: createdItem.weight,
        category: 'general',
        status: 'placed', // Directly placed, no pending
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
      setShowLabelDialog(true);
      
    } catch (error) {
      console.error('Error placing item:', error);
      toast.error('❌ Failed to place item in stock');
      setCurrentStep('scan');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!createdItem || !suggestedLocation) return;

    setPrinting(true);
    
    try {
      const labelData: ItemLabelData = {
        systemCode: createdItem.systemCode,
        itemCode: createdItem.itemCode,
        description: createdItem.description,
        weight: createdItem.weight,
        location: suggestedLocation.code,
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
      // Complete the process regardless of print result
      handleComplete();
    }
  };

  const handleSkipLabel = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setCurrentStep('complete');
    
    // Auto-reset after delay
    setTimeout(() => {
      setShowLabelDialog(false);
      setCreatedItem(null);
      setSuggestedLocation(null);
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
    }, 2000);
  };

  const getStepIndicator = () => {
    const steps = [
      { key: 'form', label: 'Item Details', icon: Package },
      { key: 'scan', label: 'Scan Location', icon: Scan },
      { key: 'label', label: 'Print Label', icon: Printer },
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
      title: "Select Operator",
      description: "Ensure an operator is selected before creating items. This tracks who processed the goods-in.",
      type: "warning" as const
    },
    {
      title: "Item Details",
      description: "Enter the Product/SKU, description, and weight. The system will automatically suggest the best location.",
      type: "info" as const
    },
    {
      title: "Scan Location",
      description: "Scan the suggested location barcode to confirm placement and immediately put the item into stock.",
      type: "info" as const
    },
    {
      title: "Print Label",
      description: "Optionally print a barcode label for the item. The item is already in stock at this point.",
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
          description="Create new items and the system will suggest optimal locations. Items go directly into stock after scanning the suggested location."
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

      {/* Suggested Location Display */}
      {suggestedLocation && currentStep === 'scan' && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-blue-500" />
              <div>
                <div className="font-medium text-blue-900">
                  Suggested Location: {suggestedLocation.code}
                </div>
                <div className="text-sm text-blue-700">
                  Row {suggestedLocation.row}, Bay {suggestedLocation.bay}, Level {suggestedLocation.level === '0' ? 'Ground' : suggestedLocation.level}
                </div>
                <div className="text-xs text-blue-600">
                  Current weight: {suggestedLocation.currentWeight}kg / Max: {suggestedLocation.maxWeight === Infinity ? 'Unlimited' : `${suggestedLocation.maxWeight}kg`}
                </div>
              </div>
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
            Enter details for items entering the warehouse - the system will suggest optimal locations
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
                  <p className="text-xs text-muted-foreground">Used for optimal location selection</p>
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
              {loading ? 'Finding Location...' : 'Create Item & Find Location'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Scan Location Dialog */}
      <Dialog open={showScanLocationDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Scan Suggested Location
            </DialogTitle>
          </DialogHeader>
          
          {suggestedLocation && createdItem && (
            <div className="space-y-6">
              {/* Item Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{createdItem.itemCode}</h3>
                    <p className="text-sm text-muted-foreground">{createdItem.description}</p>
                    <p className="text-sm">Weight: {createdItem.weight}kg</p>
                    <p className="text-xs text-muted-foreground">System Code: {createdItem.systemCode}</p>
                    <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
                  </div>
                </div>
              </div>

              {/* Location Instructions */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <MapPin className="h-5 w-5" />
                  <span className="font-medium">Scan Suggested Location</span>
                </div>
                <div className="text-sm text-blue-700">
                  Please scan the barcode for location: <strong>{suggestedLocation.code}</strong>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Row {suggestedLocation.row}, Bay {suggestedLocation.bay}, Level {suggestedLocation.level === '0' ? 'Ground' : suggestedLocation.level}
                </div>
                <div className="text-xs text-blue-600">
                  Item will be placed directly into stock after scanning
                </div>
              </div>

              {/* Bay Visualizer */}
              <BayVisualizer
                location={suggestedLocation}
                onConfirm={() => {}} // Not used in this context
                mode="place"
              />

              {/* Camera Scanner */}
              <CameraScanner
                onResult={handleLocationScan}
                onError={(error) => toast.error(`Scanner error: ${error}`)}
                isActive={showScanLocationDialog}
                autoComplete={true}
                className="w-full"
              />

              <div className="text-xs text-center text-muted-foreground">
                <p>Scan the location barcode to place the item directly into stock.</p>
                <p>Expected location: <strong>{suggestedLocation.code}</strong></p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Label Printing Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Item In Stock - Print Label?
            </DialogTitle>
          </DialogHeader>
          
          {createdItem && suggestedLocation && (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-3">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Item Successfully Placed in Stock!</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div><strong>Product/SKU:</strong> {createdItem.itemCode}</div>
                  <div><strong>Description:</strong> {createdItem.description}</div>
                  <div><strong>Weight:</strong> {createdItem.weight}kg</div>
                  <div><strong>Location:</strong> {suggestedLocation.code}</div>
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
                  <div className="text-sm">Location: {suggestedLocation.code}</div>
                  
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

              {/* Print Actions */}
              <div className="flex flex-col md:flex-row gap-3">
                <Button 
                  onClick={handlePrintLabel}
                  className="flex-1 h-14 text-base"
                  disabled={printing}
                >
                  <Printer className="h-5 w-5 mr-2" />
                  {printing ? 'Printing...' : 'Print Label & Continue'}
                </Button>
                <Button 
                  onClick={handleSkipLabel}
                  variant="outline"
                  className="h-14 text-base"
                  disabled={printing}
                >
                  Skip Label
                </Button>
              </div>

              <div className="text-xs text-center text-muted-foreground">
                <p>The item is already in stock. Printing is optional.</p>
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
                Process Complete!
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
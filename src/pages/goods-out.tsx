import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QrCode, RefreshCw, Home, Loader2, CheckCircle, AlertCircle, Search, MapPin, Package, ArrowUpFromLine, Keyboard, Filter, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { getLocationByCode, updateLocation } from '@/lib/firebase/locations';
import { getItemsByStatus, updateItem } from '@/lib/firebase/items';
import { addMovement } from '@/lib/firebase/movements';
import { CameraScanner } from '@/components/camera-scanner';
import { BayVisualizer } from '@/components/bay-visualizer';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { Badge } from '@/components/ui/badge';
import type { Item, Location } from '@/types/warehouse';

export default function GoodsOutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  
  // Items list state
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'systemCode' | 'itemCode' | 'description' | 'location'>('itemCode');
  const [loadingItems, setLoadingItems] = useState(true);
  
  // Process state
  const [loading, setLoading] = useState(false);
  const [showItemScanDialog, setShowItemScanDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [manualItemInput, setManualItemInput] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [currentStep, setCurrentStep] = useState<'select' | 'location' | 'scan' | 'complete'>('select');
  const manualItemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !authLoading) {
      loadItems();
    }
  }, [user, authLoading]);

  useEffect(() => {
    filterItems();
  }, [search, filterType, items]);

  // Check if we have pre-selected item from inventory
  useEffect(() => {
    const state = location.state as {
      preSelectedItem?: Item;
      preSelectedLocation?: Location;
      skipLocationScan?: boolean;
    };

    if (state?.preSelectedItem && state?.preSelectedLocation && state?.skipLocationScan) {
      // Skip to scan step with pre-selected item
      setSelectedItem(state.preSelectedItem);
      setSelectedLocation(state.preSelectedLocation);
      setCurrentStep('scan');
      setShowItemScanDialog(true);
      
      toast.success(`Ready to scan ${state.preSelectedItem.itemCode} at ${state.preSelectedLocation.code}`);
    }
  }, [location.state]);

  const loadItems = async () => {
    if (!user || authLoading) return;
    
    try {
      setLoadingItems(true);
      // Only fetch items with status 'placed'
      const fetchedItems = await getItemsByStatus('placed');
      setItems(fetchedItems);
      setFilteredItems(fetchedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoadingItems(false);
    }
  };

  const filterItems = () => {
    if (!search.trim()) {
      setFilteredItems(items);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = items.filter(item => {
      switch (filterType) {
        case 'systemCode':
          return item.systemCode.toLowerCase().includes(searchLower);
        case 'itemCode':
          return item.itemCode.toLowerCase().includes(searchLower);
        case 'description':
          return item.description.toLowerCase().includes(searchLower);
        case 'location':
          return (item.location || '').toLowerCase().includes(searchLower);
        default:
          return false;
      }
    });

    setFilteredItems(filtered);
  };

  const getOperatorName = () => {
    return selectedOperator?.name || user?.email || 'System';
  };

  const handleItemSelect = async (item: Item) => {
    if (!selectedOperator) {
      toast.error('Please select an operator before picking items');
      return;
    }

    if (!item.location) {
      toast.error('Item has no location assigned');
      return;
    }

    setSelectedItem(item);
    setCurrentStep('location');
    
    try {
      const locationData = await getLocationByCode(item.location);
      
      if (!locationData) {
        toast.error('Location not found');
        return;
      }

      setSelectedLocation(locationData);
      setShowLocationDialog(true);
      
      toast.success(`Selected ${item.itemCode} at ${locationData.code}`);
    } catch (error) {
      console.error('Error loading location:', error);
      toast.error('Failed to load location details');
    }
  };

  const handleProceedToScan = () => {
    setCurrentStep('scan');
    setShowLocationDialog(false);
    setShowItemScanDialog(true);
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
    if (!selectedItem || !selectedLocation) {
      toast.error('Please select an item first');
      return;
    }

    // Validate the scanned code matches the selected item's system code
    if (itemCode !== selectedItem.systemCode) {
      toast.error(`Scanned code doesn't match selected item. Expected: ${selectedItem.systemCode}`);
      return;
    }

    setCurrentStep('complete');
    setShowItemScanDialog(false);
    setShowConfirmDialog(true);
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
    if (!selectedItem || !selectedLocation) return;

    setLoading(true);
    
    const pickingToast = toast.loading(`📤 Picking ${selectedItem.itemCode} from ${selectedLocation.code}...`, {
      duration: Infinity
    });

    try {
      // Update location weight
      await updateLocation(selectedLocation.id, {
        currentWeight: Math.max(0, selectedLocation.currentWeight - selectedItem.weight)
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
        notes: `Picked from ${selectedLocation.code} via goods-out process`
      });

      toast.dismiss(pickingToast);
      toast.success(`🎉 Item picked successfully!`, {
        description: `${selectedItem.itemCode} removed from ${selectedLocation.code}`,
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
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setSelectedItem(null);
    setSelectedLocation(null);
    setCurrentStep('select');
    setManualItemInput('');
    setShowLocationDialog(false);
    setShowItemScanDialog(false);
    setShowConfirmDialog(false);
    
    // Reload items to reflect the removed item
    loadItems();
    
    toast.success('Goods-out process completed!', {
      description: 'Ready to process another pickup',
      duration: 3000
    });
  };

  const resetState = () => {
    setSelectedItem(null);
    setSelectedLocation(null);
    setCurrentStep('select');
    setManualItemInput('');
    setSearch('');
    setShowLocationDialog(false);
    setShowItemScanDialog(false);
    setShowConfirmDialog(false);
    loadItems();
  };

  const getStepIndicator = () => {
    const steps = [
      { key: 'select', label: 'Select Item', icon: Package },
      { key: 'location', label: 'View Location', icon: MapPin },
      { key: 'scan', label: 'Scan Item', icon: QrCode },
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

  const getCategoryBadge = (category: string) => {
    const styles = {
      raw: 'bg-blue-100 text-blue-800',
      finished: 'bg-green-100 text-green-800',
      packaging: 'bg-yellow-100 text-yellow-800',
      spare: 'bg-purple-100 text-purple-800',
    }[category] || 'bg-gray-100 text-gray-800';

    const labels = {
      raw: 'Raw Materials',
      finished: 'Finished Goods',
      packaging: 'Packaging',
      spare: 'Spare Parts',
    }[category] || category;

    return (
      <Badge variant="outline" className={styles}>
        {labels}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Goods Out</h1>
        <div className="flex gap-2">
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
      {(selectedItem || selectedLocation) && (
        <Card className={`border-2 ${
          currentStep === 'complete' ? 'border-green-200 bg-green-50' :
          'border-orange-200 bg-orange-50'
        }`}>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {selectedItem && (
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-orange-500" />
                  <div>
                    <div className="font-medium">Selected: {selectedItem.itemCode}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.description} ({selectedItem.weight}kg)
                    </div>
                  </div>
                </div>
              )}
              
              {selectedLocation && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium">Location: {selectedLocation.code}</div>
                    <div className="text-sm text-muted-foreground">
                      Row {selectedLocation.row}, Bay {selectedLocation.bay}, Level {selectedLocation.level === '0' ? 'Ground' : selectedLocation.level}
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

      {/* Main Content */}
      {currentStep === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Package className="h-5 w-5" />
              Select Item to Pick
            </CardTitle>
            <CardDescription>
              Choose an item from the warehouse inventory to pick
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="itemCode">Product/SKU</SelectItem>
                  <SelectItem value="systemCode">System Code</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingItems ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                Loading inventory...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {items.length === 0 ? (
                  <div>
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No items in warehouse</p>
                    <p className="text-sm">Add items through Goods In to get started.</p>
                  </div>
                ) : (
                  <div>
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No items match your search</p>
                    <p className="text-sm">Try adjusting your search terms or filter.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product/SKU</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow 
                        key={item.id}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                          !selectedOperator ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        onClick={() => selectedOperator && handleItemSelect(item)}
                      >
                        <TableCell className="font-medium">{item.itemCode}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{getCategoryBadge(item.category)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            <MapPin className="h-3 w-3 mr-1" />
                            {item.location}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.weight}kg</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemSelect(item);
                            }}
                            disabled={!selectedOperator}
                            className="flex items-center gap-2"
                          >
                            <ArrowUpFromLine className="h-4 w-4" />
                            Pick Item
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location Display Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Location</DialogTitle>
          </DialogHeader>
          
          {selectedItem && selectedLocation && (
            <div className="space-y-4">
              {/* Item Details */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{selectedItem.itemCode}</h3>
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                <p className="text-sm">Weight: {selectedItem.weight}kg</p>
                {selectedItem.metadata?.quantity && (
                  <p className="text-sm">Quantity: {selectedItem.metadata.quantity}</p>
                )}
                {selectedItem.metadata?.lotNumber && (
                  <p className="text-sm">LOT: {selectedItem.metadata.lotNumber}</p>
                )}
                <p className="text-xs text-muted-foreground">System Code: {selectedItem.systemCode}</p>
              </div>
              
              {/* Location Visualizer */}
              <BayVisualizer
                location={selectedLocation}
                onConfirm={handleProceedToScan}
                mode="view"
              />
              
              {/* Manual Proceed Button */}
              <Button 
                onClick={handleProceedToScan}
                className="w-full h-12 text-lg"
              >
                <ArrowRight className="h-5 w-5 mr-2" />
                Proceed to Scan Item
              </Button>
              
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-800">
                  <QrCode className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Next: Scan the item barcode to confirm pickup
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Item Scan Dialog */}
      <Dialog open={showItemScanDialog} onOpenChange={setShowItemScanDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Scan Item to Confirm Pickup</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Item Info */}
            {selectedItem && selectedLocation && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800 mb-2">
                  <Package className="h-5 w-5" />
                  <span className="font-medium">Picking: {selectedItem.itemCode}</span>
                </div>
                <div className="text-sm text-orange-700">
                  From location: {selectedLocation.code}
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  Scan system code: {selectedItem.systemCode}
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
                  'Confirm Pickup'
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
          
          {selectedItem && selectedLocation && (
            <div className="space-y-4">
              {/* Item Details */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{selectedItem.itemCode}</h3>
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                <p className="text-sm">Weight: {selectedItem.weight}kg</p>
                {selectedItem.metadata?.quantity && (
                  <p className="text-sm">Quantity: {selectedItem.metadata.quantity}</p>
                )}
                {selectedItem.metadata?.lotNumber && (
                  <p className="text-sm">LOT: {selectedItem.metadata.lotNumber}</p>
                )}
                <p className="text-xs text-muted-foreground">System Code: {selectedItem.systemCode}</p>
                <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
              </div>
              
              {/* Location Details */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <MapPin className="h-5 w-5" />
                  <span className="font-medium">Removing from: {selectedLocation.code}</span>
                </div>
                <div className="text-sm text-blue-700">
                  Row {selectedLocation.row}, Bay {selectedLocation.bay}, Level {selectedLocation.level === '0' ? 'Ground' : selectedLocation.level}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleConfirmPickup}
                  className="flex-1 h-12 text-base"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm Pickup'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setCurrentStep('scan');
                    setShowItemScanDialog(true);
                  }}
                  disabled={loading}
                  className="h-12 text-base"
                >
                  Back
                </Button>
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
                Item Picked Successfully!
              </DialogTitle>
            </DialogHeader>
            
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-green-800 mb-2">
                Pickup Completed!
              </h3>
              {selectedItem && selectedLocation && (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>{selectedItem.itemCode}</strong> removed from <strong>{selectedLocation.code}</strong></p>
                  <p>Weight: {selectedItem.weight}kg</p>
                  {selectedItem.metadata?.quantity && <p>Quantity: {selectedItem.metadata.quantity}</p>}
                  {selectedItem.metadata?.lotNumber && <p>LOT: {selectedItem.metadata.lotNumber}</p>}
                  <p>Operator: {getOperatorName()}</p>
                </div>
              )}
              <div className="mt-6 text-sm text-muted-foreground">
                Preparing for next pickup...
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
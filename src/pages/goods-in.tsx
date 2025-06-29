import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addItem, updateItem, getItemBySystemCode, getItemsByStatus } from '@/lib/firebase/items';
import { addMovement } from '@/lib/firebase/movements';
import { getCategories, updateCategoryQuantity, subscribeToCategory } from '@/lib/firebase/categories';
import { getLocations, updateLocation, getLocationByCode, getAvailableLocations } from '@/lib/firebase/locations';
import { generateItemCode } from '@/lib/utils';
import { Barcode as BarcodeIcon, Printer, ArrowDownToLine, ArrowUpFromLine, QrCode, MapPin, Package, CheckCircle, AlertTriangle, RefreshCcw, Search, Filter, Trash2 } from 'lucide-react';
import { Barcode } from '@/components/barcode';
import { StockLevelIndicator } from '@/components/stock-level-indicator';
import { LocationSelector } from '@/components/location-selector';
import { BayVisualizer } from '@/components/bay-visualizer';
import { ProductSelector } from '@/components/product-selector';
import { findOptimalLocation } from '@/lib/warehouse-logic';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import type { Category } from '@/lib/firebase/categories';
import type { Item, Location } from '@/types/warehouse';
import type { Product } from '@/lib/firebase/products';

interface FormData {
  productSku: string;
  description: string;
  weight: string;
  category: string;
  quantity: string;
  coilNumber: string;
  coilLength: string;
}

type ProcessStep = 'form' | 'barcode' | 'suggested-location' | 'scan-location' | 'scan-item' | 'complete';

export default function GoodsIn() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  const [formData, setFormData] = useState<FormData>({
    productSku: '',
    description: '',
    weight: '',
    category: '',
    quantity: '',
    coilNumber: '',
    coilLength: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [activeTab, setActiveTab] = useState('in');
  const [processStep, setProcessStep] = useState<ProcessStep>('form');
  
  // Location and scanning state
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<Location | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanMode, setScanMode] = useState<'location' | 'item'>('location');
  const [pendingItem, setPendingItem] = useState<Item | null>(null);

  // Goods Out state
  const [warehouseItems, setWarehouseItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'productSku' | 'description' | 'location' | 'category'>('productSku');

  useEffect(() => {
    if (user && !authLoading) {
      loadCategories();
      loadLocations();
      if (activeTab === 'out') {
        loadWarehouseItems();
      }
    }
  }, [user, authLoading, activeTab]);

  useEffect(() => {
    if (formData.category) {
      const category = categories.find(c => c.id === formData.category);
      if (category?.id) {
        const unsubscribe = subscribeToCategory(category.id, (updatedCategory) => {
          if (updatedCategory) {
            setSelectedCategory(updatedCategory);
          }
        });
        return () => unsubscribe();
      }
    } else {
      setSelectedCategory(null);
    }
  }, [formData.category, categories]);

  useEffect(() => {
    filterItems();
  }, [search, filterType, warehouseItems]);

  const loadCategories = async () => {
    if (!user || authLoading) return;
    
    try {
      const fetchedCategories = await getCategories();
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const loadLocations = async () => {
    if (!user || authLoading) return;
    
    try {
      const locations = await getLocations();
      setAvailableLocations(locations);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const loadWarehouseItems = async () => {
    if (!user || authLoading) return;
    
    try {
      setItemsLoading(true);
      const items = await getItemsByStatus('placed');
      setWarehouseItems(items);
      setFilteredItems(items);
    } catch (error) {
      console.error('Error loading warehouse items:', error);
      toast.error('Failed to load warehouse items');
    } finally {
      setItemsLoading(false);
    }
  };

  const filterItems = () => {
    if (!search.trim()) {
      setFilteredItems(warehouseItems);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = warehouseItems.filter(item => {
      switch (filterType) {
        case 'productSku':
          return item.itemCode.toLowerCase().includes(searchLower);
        case 'description':
          return item.description.toLowerCase().includes(searchLower);
        case 'category':
          return item.category.toLowerCase().includes(searchLower);
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

  const findSuggestedLocation = async (weight: number, isGroundLevel: boolean = false) => {
    try {
      const availableLocations = await getAvailableLocations(weight);
      const optimal = findOptimalLocation(availableLocations, weight, isGroundLevel);
      return optimal;
    } catch (error) {
      console.error('Error finding suggested location:', error);
      return null;
    }
  };

  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      productSku: product.sku,
      description: product.description,
      weight: product.weight?.toString() || '',
      category: product.category,
      coilNumber: product.metadata?.coilNumber || '',
      coilLength: product.metadata?.coilLength || ''
    }));
  };

  const handleGoodsIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOperator) {
      toast.error('Please select an operator before proceeding');
      return;
    }

    setLoading(true);

    try {
      if (!selectedCategory) {
        throw new Error('Please select a category');
      }

      const systemCode = generateItemCode(formData.category, Date.now());
      setGeneratedCode(systemCode);

      // Handle Kanban-managed items (goodsIn = true)
      if (selectedCategory.kanbanRules?.goodsIn) {
        const quantity = parseInt(formData.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error('Please enter a valid quantity');
        }

        await updateCategoryQuantity(selectedCategory.id, quantity);

        await addMovement({
          itemId: systemCode,
          type: 'IN',
          weight: 0,
          operator: getOperatorName(),
          reference: formData.productSku,
          notes: `Added ${quantity} units of ${selectedCategory.name}`,
          quantity
        });

        toast.success(`Added ${quantity} units to inventory`);
        setProcessStep('complete');
      } 
      // Handle Raw Materials and other items that need physical placement
      else {
        const weight = parseFloat(formData.weight);
        
        if (isNaN(weight) || weight <= 0) {
          throw new Error('Please enter a valid weight');
        }

        let description = formData.description;
        let metadata = {};

        // Special handling for Raw Materials
        if (selectedCategory.prefix === 'RAW') {
          const coilNumber = parseInt(formData.coilNumber);
          const coilLength = parseFloat(formData.coilLength);

          if (isNaN(coilNumber) || coilNumber <= 0) {
            throw new Error('Please enter a valid number of coils');
          }
          if (isNaN(coilLength) || coilLength <= 0) {
            throw new Error('Please enter a valid coil length');
          }

          description = `Coil: ${coilNumber}, Length: ${coilLength}ft`;
          metadata = {
            coilNumber: coilNumber.toString(),
            coilLength: coilLength.toString(),
          };
        } else {
          if (!formData.description.trim()) {
            throw new Error('Please enter a description');
          }
        }

        const itemData = {
          itemCode: formData.productSku,
          systemCode,
          description,
          weight,
          category: formData.category,
          status: 'pending' as const,
          metadata,
        };

        const itemId = await addItem(itemData);

        // Store the pending item for scanning process
        setPendingItem({
          id: itemId,
          ...itemData,
          locationVerified: false,
          lastUpdated: new Date() as any
        });

        await addMovement({
          itemId,
          type: 'IN',
          weight,
          operator: getOperatorName(),
          reference: formData.productSku,
          notes: `Goods in: ${description} - awaiting placement`
        });

        // Find suggested location
        const isGroundLevel = selectedCategory.prefix === 'RAW';
        const suggested = await findSuggestedLocation(weight, isGroundLevel);
        
        if (suggested) {
          setSuggestedLocation(suggested);
          toast.success('Item created - suggested location found');
          setProcessStep('suggested-location');
        } else {
          toast.warning('Item created - no optimal location found, manual selection required');
          setProcessStep('barcode');
        }
      }
    } catch (error) {
      console.error('Error processing goods in:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process goods in');
      setGeneratedCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleGoodsOut = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOperator) {
      toast.error('Please select an operator before proceeding');
      return;
    }

    setLoading(true);

    try {
      if (!selectedCategory) {
        throw new Error('Please select a category');
      }

      if (!selectedCategory.kanbanRules?.goodsIn) {
        throw new Error('This category does not support goods out');
      }

      const quantity = parseInt(formData.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('Please enter a valid quantity');
      }

      if (quantity > selectedCategory.kanbanRules.currentQuantity) {
        throw new Error('Not enough stock available');
      }

      await updateCategoryQuantity(selectedCategory.id, -quantity);

      await addMovement({
        itemId: formData.productSku,
        type: 'OUT',
        weight: 0,
        operator: getOperatorName(),
        reference: formData.productSku,
        notes: `Removed ${quantity} units of ${selectedCategory.name}`,
        quantity
      });

      toast.success(`Removed ${quantity} units from inventory`);
      resetForm();
    } catch (error) {
      console.error('Error processing goods out:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process goods out');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (item: Item) => {
    if (!selectedOperator) {
      toast.error('Please select an operator before proceeding');
      return;
    }

    try {
      // Update location weight
      if (item.location) {
        const location = await getLocationByCode(item.location);
        if (location) {
          await updateLocation(location.id, {
            currentWeight: Math.max(0, location.currentWeight - item.weight)
          });
        }
      }

      // Update item status
      await updateItem(item.id, {
        status: 'removed',
        location: null,
        locationVerified: false
      });

      // Record movement
      await addMovement({
        itemId: item.id,
        type: 'OUT',
        weight: item.weight,
        operator: getOperatorName(),
        reference: item.itemCode,
        notes: `Removed from ${item.location || 'warehouse'}`
      });

      toast.success(`Item ${item.itemCode} removed successfully`);
      loadWarehouseItems(); // Refresh the list
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = document.createElement('svg');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
    script.onload = () => {
      // @ts-ignore
      window.JsBarcode(svg, generatedCode, {
        format: 'CODE128',
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10,
      });

      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Barcode - ${generatedCode}</title>
            <style>
              body { 
                margin: 20px;
                font-family: Arial, sans-serif;
              }
              .container {
                max-width: 400px;
                margin: 0 auto;
                text-align: center;
              }
              .barcode svg {
                max-width: 100%;
              }
              .code {
                font-size: 24px;
                font-weight: bold;
                margin: 20px 0;
              }
              .details {
                margin: 20px 0;
                font-size: 16px;
                line-height: 1.5;
              }
              .operator {
                margin-top: 15px;
                padding: 10px;
                background: #f3f4f6;
                border-radius: 6px;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="barcode">
                ${svg.outerHTML}
              </div>
              <div class="code">${generatedCode}</div>
              <div class="details">
                <p><strong>Product/SKU:</strong> ${formData.productSku}</p>
                ${selectedCategory?.prefix === 'RAW' ? `
                  <p><strong>Coils:</strong> ${formData.coilNumber}</p>
                  <p><strong>Length:</strong> ${formData.coilLength}ft</p>
                  <p><strong>Weight:</strong> ${formData.weight}kg</p>
                ` : `
                  <p><strong>Description:</strong> ${formData.description}</p>
                  <p><strong>Weight:</strong> ${formData.weight}kg</p>
                `}
              </div>
              <div class="operator">
                <strong>Processed by:</strong> ${getOperatorName()}
              </div>
            </div>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(content);
      printWindow.document.close();
    };
    printWindow.document.head.appendChild(script);
  };

  const handleAcceptSuggestedLocation = () => {
    if (suggestedLocation) {
      setSelectedLocation(suggestedLocation);
      setShowVisualDialog(true);
    }
  };

  const handleRejectSuggestedLocation = () => {
    setSuggestedLocation(null);
    setProcessStep('barcode');
  };

  const handleStartPlacement = () => {
    setScanMode('location');
    setShowScanDialog(true);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('scanInput') as HTMLInputElement;
    const scannedCode = input.value.trim();
    form.reset();

    if (!scannedCode) {
      toast.error('Please enter a code');
      return;
    }

    setLoading(true);
    try {
      if (scanMode === 'location') {
        // Scan location first
        const location = await getLocationByCode(scannedCode);
        if (!location) {
          toast.error('Location not found');
          return;
        }

        // Check if location can accept the item
        if (pendingItem && location.level !== '0') {
          const newWeight = location.currentWeight + pendingItem.weight;
          if (newWeight > location.maxWeight) {
            toast.error('Location weight capacity exceeded');
            return;
          }
        }

        setSelectedLocation(location);
        setShowScanDialog(false);
        setShowVisualDialog(true);
      } else {
        // Scan item barcode to confirm
        if (scannedCode !== generatedCode) {
          toast.error('Invalid item barcode scanned');
          return;
        }

        // Complete the placement
        await completeItemPlacement();
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      toast.error('Failed to process scan');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (location: Location) => {
    if (!pendingItem) return;
    
    // Check weight capacity
    if (location.level !== '0') {
      const newWeight = location.currentWeight + pendingItem.weight;
      if (newWeight > location.maxWeight) {
        toast.error('Location weight capacity exceeded');
        return;
      }
    }

    setSelectedLocation(location);
    setShowLocationDialog(false);
    setShowVisualDialog(true);
  };

  const handleLocationConfirm = () => {
    setShowVisualDialog(false);
    setScanMode('item');
    setShowScanDialog(true);
  };

  const completeItemPlacement = async () => {
    if (!pendingItem || !selectedLocation) return;

    setLoading(true);
    try {
      // Update location weight
      await updateLocation(selectedLocation.id, {
        currentWeight: selectedLocation.currentWeight + pendingItem.weight
      });

      // Update item status and location
      await updateItem(pendingItem.id, {
        status: 'placed',
        location: selectedLocation.code,
        locationVerified: true
      });

      // Record final movement
      await addMovement({
        itemId: pendingItem.id,
        type: 'IN',
        weight: pendingItem.weight,
        operator: getOperatorName(),
        reference: pendingItem.itemCode,
        notes: `Placed at ${selectedLocation.code}`
      });

      toast.success(`Item successfully placed at ${selectedLocation.code}`);
      setProcessStep('complete');
      setShowScanDialog(false);
    } catch (error) {
      console.error('Error completing placement:', error);
      toast.error('Failed to complete placement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      productSku: '',
      description: '',
      weight: '',
      category: '',
      quantity: '',
      coilNumber: '',
      coilLength: '',
    });
    setGeneratedCode('');
    setSelectedCategory(null);
    setProcessStep('form');
    setPendingItem(null);
    setSelectedLocation(null);
    setSuggestedLocation(null);
    setShowLocationDialog(false);
    setShowVisualDialog(false);
    setShowScanDialog(false);
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
        <h1 className="text-3xl font-bold">Stock Management</h1>
        <Button variant="outline" onClick={() => navigate('/scan')}>
          Go to Scanner
        </Button>
      </div>

      {!selectedOperator && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Action Required
              </Badge>
              <span className="text-sm">Please select an operator from the top-right corner before processing transactions.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="in" className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Goods In
          </TabsTrigger>
          <TabsTrigger value="out" className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Goods Out
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in">
          {processStep === 'form' && (
            <Card>
              <CardHeader>
                <CardTitle>Receive Items</CardTitle>
                <CardDescription>
                  Enter the details of the items being received
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGoodsIn} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <ProductSelector
                        value={formData.productSku}
                        onChange={(value) => setFormData({ ...formData, productSku: value })}
                        onProductSelect={handleProductSelect}
                        category={formData.category}
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Please select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedCategory?.kanbanRules?.goodsIn ? (
                      <div className="col-span-2 space-y-2">
                        {selectedCategory.kanbanRules && (
                          <StockLevelIndicator rules={selectedCategory.kanbanRules} />
                        )}
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          max={selectedCategory.kanbanRules.maxQuantity - selectedCategory.kanbanRules.currentQuantity}
                          placeholder="Enter quantity"
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({ ...formData, quantity: e.target.value })
                          }
                          required
                        />
                        <div className="text-sm text-muted-foreground">
                          Available space: {selectedCategory.kanbanRules.maxQuantity - selectedCategory.kanbanRules.currentQuantity} units
                        </div>
                      </div>
                    ) : selectedCategory?.prefix === 'RAW' ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="coilNumber">Number of Coils</Label>
                          <Input
                            id="coilNumber"
                            type="number"
                            min="1"
                            placeholder="Enter number of coils"
                            value={formData.coilNumber}
                            onChange={(e) =>
                              setFormData({ ...formData, coilNumber: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coilLength">Length (ft)</Label>
                          <Input
                            id="coilLength"
                            type="number"
                            step="0.1"
                            placeholder="Enter length in feet"
                            value={formData.coilLength}
                            onChange={(e) =>
                              setFormData({ ...formData, coilLength: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="weight">Weight (kg)</Label>
                          <Input
                            id="weight"
                            type="number"
                            step="0.01"
                            placeholder="Enter weight"
                            value={formData.weight}
                            onChange={(e) =>
                              setFormData({ ...formData, weight: e.target.value })
                            }
                            required
                          />
                        </div>
                      </>
                    ) : selectedCategory && (
                      <>
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            placeholder="Enter item description"
                            value={formData.description}
                            onChange={(e) =>
                              setFormData({ ...formData, description: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="weight">Weight (kg)</Label>
                          <Input
                            id="weight"
                            type="number"
                            step="0.01"
                            placeholder="Enter weight"
                            value={formData.weight}
                            onChange={(e) =>
                              setFormData({ ...formData, weight: e.target.value })
                            }
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !selectedOperator}
                  >
                    {loading ? 'Processing...' : 'Process Goods In'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {processStep === 'suggested-location' && suggestedLocation && (
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-100">
                  <CheckCircle className="h-5 w-5" />
                  Optimal Location Found
                </CardTitle>
                <CardDescription className="text-blue-700 dark:text-blue-300">
                  The system has identified the best location for this item based on weight and accessibility
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {pendingItem && (
                    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{pendingItem.itemCode}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{pendingItem.description}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">Weight: {pendingItem.weight}kg</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Operator: {getOperatorName()}</p>
                    </div>
                  )}
                  
                  <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Recommended Location
                    </h4>
                    <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">{suggestedLocation.code}</div>
                    <div className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                      Row {suggestedLocation.row} • Bay {suggestedLocation.bay} • Level {suggestedLocation.level === '0' ? 'Ground' : suggestedLocation.level}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      Current: {suggestedLocation.currentWeight}kg / Max: {suggestedLocation.maxWeight === Infinity ? 'Unlimited' : `${suggestedLocation.maxWeight}kg`}
                    </div>
                  </div>

                  <BayVisualizer
                    location={suggestedLocation}
                    onConfirm={handleAcceptSuggestedLocation}
                    mode="view"
                  />

                  <div className="flex gap-3">
                    <Button onClick={handleAcceptSuggestedLocation} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Use This Location
                    </Button>
                    <Button onClick={handleRejectSuggestedLocation} variant="outline" className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Choose Different
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {processStep === 'barcode' && (
            <Card className="bg-primary/5 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarcodeIcon className="h-5 w-5" />
                  Item Barcode Generated
                </CardTitle>
                <CardDescription>
                  Print this barcode and attach it to the item, then scan to place in location
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-y-4">
                  <Barcode value={generatedCode} className="w-full max-w-md" />
                  <div className="text-center">
                    <div className="text-lg font-bold">{generatedCode}</div>
                    <div className="text-sm text-muted-foreground">
                      Product/SKU: {formData.productSku}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Weight: {formData.weight}kg
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Processed by: {getOperatorName()}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button onClick={handlePrint} variant="outline" className="flex-1">
                      <Printer className="h-4 w-4 mr-2" />
                      Print Barcode
                    </Button>
                    <Button onClick={handleStartPlacement} className="flex-1">
                      <MapPin className="h-4 w-4 mr-2" />
                      Start Placement
                    </Button>
                  </div>
                  <Button onClick={() => setShowLocationDialog(true)} variant="outline" className="w-full">
                    <Package className="h-4 w-4 mr-2" />
                    Browse Locations
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {processStep === 'complete' && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Package className="h-5 w-5" />
                  Process Complete
                </CardTitle>
                <CardDescription>
                  {selectedCategory?.kanbanRules?.goodsIn 
                    ? 'Inventory has been updated successfully'
                    : `Item has been placed at ${selectedLocation?.code}`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-800">✓ Success</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCategory?.kanbanRules?.goodsIn 
                        ? `Added ${formData.quantity} units to ${selectedCategory.name}`
                        : `${formData.productSku} placed successfully`
                      }
                    </div>
                  </div>
                  <Button onClick={resetForm} className="w-full">
                    Process Next Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="out">
          <div className="space-y-6">
            {/* Kanban Goods Out */}
            <Card>
              <CardHeader>
                <CardTitle>Process Goods Out (Kanban)</CardTitle>
                <CardDescription>
                  Remove items from managed inventory
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGoodsOut} className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Please select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter(category => category.kanbanRules?.goodsIn)
                            .map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedCategory?.kanbanRules?.goodsIn && (
                      <>
                        <div className="space-y-2">
                          <StockLevelIndicator rules={selectedCategory.kanbanRules} />
                        </div>

                        <div className="space-y-2">
                          <ProductSelector
                            value={formData.productSku}
                            onChange={(value) => setFormData({ ...formData, productSku: value })}
                            category={formData.category}
                            placeholder="Select Product/SKU for reference"
                            disabled={loading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="quantity">Quantity</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            max={selectedCategory.kanbanRules.currentQuantity}
                            placeholder="Enter quantity"
                            value={formData.quantity}
                            onChange={(e) =>
                              setFormData({ ...formData, quantity: e.target.value })
                            }
                            required
                          />
                          <div className="text-sm text-muted-foreground">
                            Available: {selectedCategory.kanbanRules.currentQuantity} units
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !selectedCategory?.kanbanRules?.goodsIn || !selectedOperator}
                  >
                    {loading ? 'Processing...' : 'Process Goods Out'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Physical Items List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Physical Items in Warehouse</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1">
                      {warehouseItems.length} items
                    </Badge>
                    <Button onClick={loadWarehouseItems} variant="outline" size="sm" disabled={itemsLoading}>
                      <RefreshCcw className={`h-4 w-4 mr-2 ${itemsLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Remove individual items from warehouse locations
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
                      <SelectItem value="productSku">Product/SKU</SelectItem>
                      <SelectItem value="description">Description</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {itemsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    Loading warehouse items...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {warehouseItems.length === 0 ? (
                      <div>
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No items in warehouse</p>
                        <p className="text-sm">Process some goods in to see items here.</p>
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
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.itemCode}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{getCategoryBadge(item.category)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {item.location}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.weight}kg</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveItem(item)}
                                disabled={!selectedOperator}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
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
          </div>
        </TabsContent>
      </Tabs>

      {/* Location Selection Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Select Location for {pendingItem?.itemCode}
            </DialogTitle>
          </DialogHeader>
          {pendingItem && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{pendingItem.itemCode}</h3>
                  <p className="text-sm text-muted-foreground">{pendingItem.description}</p>
                  <p className="text-sm">Weight: {pendingItem.weight}kg</p>
                  <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
                </div>
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
            <DialogTitle>Confirm Location</DialogTitle>
          </DialogHeader>
          {selectedLocation && pendingItem && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{pendingItem.itemCode}</h3>
                <p className="text-sm text-muted-foreground">{pendingItem.description}</p>
                <p className="text-sm">Weight: {pendingItem.weight}kg</p>
                <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
              </div>
              
              <BayVisualizer
                location={selectedLocation}
                onConfirm={handleLocationConfirm}
                mode="place"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Scan Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {scanMode === 'location' ? 'Scan Location' : 'Scan Item Barcode'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleScan} className="space-y-4">
            <div className="relative">
              <QrCode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                name="scanInput"
                placeholder={scanMode === 'location' ? 'Scan location barcode...' : 'Scan item barcode...'}
                className="pl-9"
                autoComplete="off"
                autoFocus
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : scanMode === 'location' ? 'Scan Location' : 'Confirm Item'}
            </Button>
            {scanMode === 'location' && (
              <div className="text-xs text-center text-muted-foreground">
                Step 1: Scan the location where you want to place the item
              </div>
            )}
            {scanMode === 'item' && (
              <div className="text-xs text-center text-muted-foreground">
                Step 2: Scan the item barcode to confirm placement at {selectedLocation?.code}
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
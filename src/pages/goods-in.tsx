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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addItem, updateItem } from '@/lib/firebase/items';
import { getLocations, updateLocation } from '@/lib/firebase/locations';
import { addMovement } from '@/lib/firebase/movements';
import { saveProduct } from '@/lib/firebase/products';
import { ProductSelector } from '@/components/product-selector';
import { LocationSelector } from '@/components/location-selector';
import { WarehouseLayout } from '@/components/warehouse-layout';
import { generateItemZPL, type ItemLabelData } from '@/lib/zpl-generator';
import { generateItemHtml } from '@/lib/html-label-generator';
import { sendZPL, getPrinterSettings } from '@/lib/printer-service';
import { Barcode } from '@/components/barcode';
import { BayVisualizer } from '@/components/bay-visualizer';
import { findOptimalLocation, getSuitableLocations } from '@/lib/warehouse-logic';
import { PackagePlus, Printer, CheckCircle, Package, QrCode, Home, MapPin, RefreshCw, ArrowLeft, X, Star, List, Grid3X3, Upload, FileText, Download, Hash } from 'lucide-react';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { useNavigate } from 'react-router-dom';
import type { Location } from '@/types/warehouse';
import type { Product } from '@/lib/firebase/products';

export default function GoodsInPage() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  
  const [formData, setFormData] = useState({
    itemCode: '',
    description: '',
    weight: '',
    quantity: '1',
    lotNumber: ''
  });
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showLocationGraphicDialog, setShowLocationGraphicDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCsvImportDialog, setShowCsvImportDialog] = useState(false);
  const [createdItem, setCreatedItem] = useState<{
    id: string;
    systemCode: string;
    itemCode: string;
    description: string;
    weight: number;
    quantity: number;
    lotNumber: string;
  } | null>(null);
  const [suggestedLocation, setSuggestedLocation] = useState<Location | null>(null);
  const [suitableLocations, setSuitableLocations] = useState<Location[]>([]);
  const [printing, setPrinting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'label' | 'location' | 'graphic' | 'confirm' | 'complete'>('form');
  const [locationViewMode, setLocationViewMode] = useState<'list' | 'graphic'>('list');
  
  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<{ sku: string; description: string }>>([]);

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

  // Handle product selection to auto-populate description
  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      itemCode: product.sku,
      description: product.description // Auto-populate description from selected product
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOperator) {
      toast.error('Please select an operator before creating items');
      return;
    }

    if (!formData.itemCode || !formData.description || !formData.weight || !formData.quantity || !formData.lotNumber) {
      toast.error('Please fill in all required fields: Part Number, Description, Weight, Quantity, and LOT Number');
      return;
    }

    const weight = parseFloat(formData.weight);
    const quantity = parseInt(formData.quantity);
    
    if (isNaN(weight) || weight <= 0) {
      toast.error('Please enter a valid weight greater than 0');
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity greater than 0');
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
        weight,
        quantity,
        lotNumber: formData.lotNumber
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
      // Get printer settings to determine print method
      const printerSettings = await getPrinterSettings();
      
      const labelData: ItemLabelData = {
        systemCode: createdItem.systemCode,
        itemCode: createdItem.itemCode,
        description: createdItem.description,
        weight: createdItem.weight,
        quantity: createdItem.quantity,
        lotNumber: createdItem.lotNumber,
        location: '', // No location yet
        operator: getOperatorName(),
        date: new Date().toLocaleDateString(),
      };

      if (printerSettings.useWindowsPrint) {
        // Generate HTML and open in new window for printing
        const html = generateItemHtml(labelData);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          toast.success('Label opened in new window for printing');
        } else {
          toast.error('Failed to open print window. Please check popup blocker settings.');
        }
      } else {
        // Generate ZPL and send directly to printer
        const zpl = generateItemZPL(labelData);
        await sendZPL(zpl);
        toast.success('Label printed successfully!');
      }
      
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

  const handleConfirmPlacement = () => {
    if (!suggestedLocation) return;
    
    setCurrentStep('confirm');
    setShowLocationGraphicDialog(false);
    setShowConfirmDialog(true);
  };

  const handleFinalConfirm = async () => {
    if (!suggestedLocation || !createdItem) return;

    setLoading(true);
    setCurrentStep('complete');
    
    try {
      // Create the item with placed status and metadata including lot number
      const itemId = await addItem({
        itemCode: createdItem.itemCode,
        systemCode: createdItem.systemCode,
        description: createdItem.description,
        weight: createdItem.weight,
        category: 'general',
        status: 'placed',
        metadata: {
          quantity: createdItem.quantity,
          lotNumber: createdItem.lotNumber
        }
      });

      // Update item with location
      await updateItem(itemId, {
        location: suggestedLocation.code,
        locationVerified: true
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
        notes: `Placed at ${suggestedLocation.code} via goods-in process. LOT: ${createdItem.lotNumber}, Qty: ${createdItem.quantity}`
      });

      // Update created item with ID
      setCreatedItem(prev => prev ? { ...prev, id: itemId } : null);

      toast.success('🎉 Item placed in stock successfully!', {
        description: `${createdItem.itemCode} is now at ${suggestedLocation.code}`,
        duration: 5000
      });
      
      setShowConfirmDialog(false);
      
      // Auto-complete after delay
      setTimeout(() => {
        handleComplete();
      }, 3000);
      
    } catch (error) {
      console.error('Error placing item:', error);
      toast.error('❌ Failed to place item in stock');
      setCurrentStep('confirm');
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
    setLocationViewMode('list');
    
    // Reset form
    setFormData({
      itemCode: '',
      description: '',
      weight: '',
      quantity: '1',
      lotNumber: ''
    });
    
    toast.success('Ready for next item!', {
      description: 'Goods-in process completed',
      duration: 3000
    });
  };

  const handleBackToLocationSelection = () => {
    setShowConfirmDialog(false);
    setCurrentStep('location');
    setShowLocationDialog(true);
  };

  const handleBackToLocationGraphic = () => {
    setShowConfirmDialog(false);
    setCurrentStep('graphic');
    setShowLocationGraphicDialog(true);
  };

  // CSV Import Functions
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      previewCsvFile(file);
    }
  };

  const previewCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const lines = content.split('\n').filter(line => line.trim());
        const preview = lines.slice(1, 6).map(line => { // Skip header, show first 5 rows
          const [sku, description] = line.split(',').map(item => item.trim().replace(/"/g, ''));
          return { sku: sku || '', description: description || '' };
        }).filter(item => item.sku && item.description);
        setCsvPreview(preview);
      }
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setCsvImporting(true);
    
    const importPromise = new Promise<{ successful: number; failed: number }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          if (!content) {
            reject(new Error('Failed to read file content'));
            return;
          }

          const lines = content.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            reject(new Error('CSV file must have at least a header and one data row'));
            return;
          }

          let successfulImports = 0;
          let failedImports = 0;

          // Skip header row (index 0)
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
              // Parse CSV line (handle quoted values)
              const [sku, description] = line.split(',').map(item => 
                item.trim().replace(/^"(.*)"$/, '$1') // Remove surrounding quotes
              );

              if (sku && description) {
                await saveProduct({
                  sku: sku.trim(),
                  description: description.trim(),
                  category: 'general',
                  metadata: {}
                });
                successfulImports++;
              } else {
                failedImports++;
              }
            } catch (error) {
              console.error(`Error importing line ${i + 1}:`, error);
              failedImports++;
            }
          }

          resolve({ successful: successfulImports, failed: failedImports });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(csvFile);
    });

    toast.promise(importPromise, {
      loading: 'Importing products from CSV...',
      success: (result) => {
        setCsvFile(null);
        setCsvPreview([]);
        setShowCsvImportDialog(false);
        // Reset file input
        const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        return `Import completed! ${result.successful} products imported successfully${result.failed > 0 ? `, ${result.failed} failed` : ''}`;
      },
      error: (error) => `Import failed: ${error.message}`,
    });

    setCsvImporting(false);
  };

  const downloadCsvTemplate = () => {
    const csvContent = 'sku,description\n"EXAMPLE-001","Example Product Description"\n"EXAMPLE-002","Another Product Description"';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('CSV template downloaded');
  };

  const getStepIndicator = () => {
    const steps = [
      { key: 'form', label: 'Item Details', icon: Package },
      { key: 'label', label: 'Generate Label', icon: Printer },
      { key: 'location', label: 'Choose Location', icon: MapPin },
      { key: 'graphic', label: 'Location View', icon: Star },
      { key: 'confirm', label: 'Confirm Placement', icon: CheckCircle },
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

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Item</TabsTrigger>
          <TabsTrigger value="import">Import Products</TabsTrigger>
        </TabsList>
        
        <TabsContent value="single" className="space-y-6">
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
                      onProductSelect={handleProductSelect}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-base">Description *</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Item description (auto-filled from product selection)"
                      required
                      disabled={loading}
                      className="h-14 text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      This field will auto-populate when you select a product above
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        Items >1000kg automatically go to ground level
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity" className="text-base">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="1"
                        required
                        disabled={loading}
                        className="h-14 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lotNumber" className="flex items-center gap-2 text-base">
                        <Hash className="h-4 w-4" />
                        LOT Number *
                      </Label>
                      <Input
                        id="lotNumber"
                        value={formData.lotNumber}
                        onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                        placeholder="Enter LOT number"
                        required
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
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Upload className="h-5 w-5" />
                Import Products from CSV
              </CardTitle>
              <CardDescription>
                Upload a CSV file to import multiple products at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• First row must be headers: <code>sku,description</code></li>
                  <li>• Each subsequent row should contain: SKU code, Product description</li>
                  <li>• Values can be quoted if they contain commas</li>
                  <li>• Example: <code>"PROD-001","High Quality Steel Pipe"</code></li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={downloadCsvTemplate}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
                <Button
                  onClick={() => setShowCsvImportDialog(true)}
                  className="flex items-center gap-2"
                  disabled={!selectedOperator}
                >
                  <FileText className="h-4 w-4" />
                  Import CSV
                </Button>
              </div>

              {!selectedOperator && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Please select an operator before importing products.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CSV Import Dialog */}
      <Dialog open={showCsvImportDialog} onOpenChange={setShowCsvImportDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Products from CSV
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csvFileInput">Select CSV File</Label>
                <Input
                  id="csvFileInput"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="h-12"
                />
              </div>

              {csvPreview.length > 0 && (
                <div className="space-y-2">
                  <Label>Preview (first 5 rows)</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 py-2 text-sm font-medium">
                      SKU | Description
                    </div>
                    {csvPreview.map((item, index) => (
                      <div key={index} className="px-3 py-2 text-sm border-t">
                        {item.sku} | {item.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCsvImport}
                disabled={!csvFile || csvImporting}
                className="flex-1"
              >
                {csvImporting ? 'Importing...' : 'Import Products'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCsvImportDialog(false);
                  setCsvFile(null);
                  setCsvPreview([]);
                }}
                disabled={csvImporting}
              >
                Cancel
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>This will create product records that can be selected when creating items.</p>
              <p>Products will be saved with category "general" and can be edited later if needed.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Part Number:</strong> {createdItem.itemCode}</div>
                  <div><strong>Weight:</strong> {createdItem.weight}kg</div>
                  <div><strong>Quantity:</strong> {createdItem.quantity}</div>
                  <div><strong>LOT Number:</strong> {createdItem.lotNumber}</div>
                  <div className="col-span-2"><strong>Description:</strong> {createdItem.description}</div>
                  <div className="col-span-2"><strong>System Code:</strong> {createdItem.systemCode}</div>
                  <div className="col-span-2"><strong>Operator:</strong> {getOperatorName()}</div>
                </div>
              </div>

              {/* FIXED SQUARE LABEL PREVIEW */}
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-blue-600 mb-2">📄 103x103mm SQUARE LABEL PREVIEW</div>
                </div>
                
                {/* PERFECT SQUARE: 400px × 400px with aspect-square enforced */}
                <div className="mx-auto w-96 aspect-square border-4 border-blue-300 rounded-lg bg-white shadow-xl flex flex-col p-6 relative overflow-hidden">
                  
                  {/* Part Number (A*****) - Large and prominent */}
                  <div className="flex-shrink-0 text-center mb-2">
                    <div 
                      className="leading-none"
                      style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: '900', 
                        color: '#000000',
                        lineHeight: '0.9'
                      }}
                    >
                      {createdItem.itemCode}
                    </div>
                  </div>
                  
                  {/* Description - Medium size */}
                  <div className="flex-1 flex items-center justify-center">
                    <div 
                      className="text-center leading-none break-words"
                      style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: '700', 
                        color: '#000000',
                        lineHeight: '0.9'
                      }}
                    >
                      {createdItem.description}
                    </div>
                  </div>
                  
                  {/* Barcode in middle area */}
                  <div className="flex-shrink-0 py-4">
                    <Barcode 
                      value={createdItem.systemCode} 
                      width={2} 
                      height={40}
                      fontSize={10}
                      fontColor="#000000"
                      className="mx-auto"
                    />
                  </div>
                  
                  {/* Bottom info - Weight, Quantity, LOT */}
                  <div className="flex-shrink-0 space-y-1">
                    <div 
                      className="text-center"
                      style={{ 
                        fontSize: '1rem', 
                        fontWeight: '700', 
                        color: '#000000'
                      }}
                    >
                      Weight: {createdItem.weight}kg | Qty: {createdItem.quantity}
                    </div>
                    <div 
                      className="text-center"
                      style={{ 
                        fontSize: '1rem', 
                        fontWeight: '700', 
                        color: '#000000'
                      }}
                    >
                      LOT: {createdItem.lotNumber}
                    </div>
                  </div>
                  
                  {/* Square corner indicators */}
                  <div className="absolute top-3 left-3 w-6 h-6 border-l-4 border-t-4 border-blue-500"></div>
                  <div className="absolute top-3 right-3 w-6 h-6 border-r-4 border-t-4 border-blue-500"></div>
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-l-4 border-b-4 border-blue-500"></div>
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-r-4 border-b-4 border-blue-500"></div>
                </div>
                
                <div className="text-xs text-center text-gray-500">
                  ⬜ Actual size: 103mm × 103mm SQUARE label
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
                    <p className="text-sm">Weight: {createdItem.weight}kg | Qty: {createdItem.quantity} | LOT: {createdItem.lotNumber}</p>
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
                <div className="flex items-center gap-2">
                  <Button onClick={loadLocations} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>

              <Tabs value={locationViewMode} onValueChange={(value: 'list' | 'graphic') => setLocationViewMode(value)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list" className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    List View
                  </TabsTrigger>
                  <TabsTrigger value="graphic" className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    Graphic View
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="list" className="mt-4">
                  <LocationSelector
                    locations={suitableLocations}
                    onLocationSelect={handleLocationSelect}
                  />
                </TabsContent>
                
                <TabsContent value="graphic" className="mt-4">
                  <WarehouseLayout
                    locations={suitableLocations}
                    onLocationSelect={handleLocationSelect}
                    suggestedLocation={suggestedLocation}
                    itemWeight={createdItem.weight}
                  />
                </TabsContent>
              </Tabs>
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
                  <div><strong>Quantity:</strong> {createdItem.quantity}</div>
                  <div><strong>LOT:</strong> {createdItem.lotNumber}</div>
                  <div><strong>Location:</strong> {suggestedLocation.code}</div>
                  <div><strong>Operator:</strong> {getOperatorName()}</div>
                </div>
              </div>

              {/* Bay Visualizer */}
              <BayVisualizer
                location={suggestedLocation}
                onConfirm={handleConfirmPlacement}
                mode="place"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Final Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Item Placement</DialogTitle>
          </DialogHeader>
          
          {createdItem && suggestedLocation && (
            <div className="space-y-4">
              {/* Item Details */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{createdItem?.itemCode}</h3>
                <p className="text-sm text-muted-foreground">{createdItem?.description}</p>
                <p className="text-sm">Weight: {createdItem?.weight}kg | Qty: {createdItem?.quantity} | LOT: {createdItem?.lotNumber}</p>
                <p className="text-xs text-muted-foreground">System Code: {createdItem?.systemCode}</p>
                <p className="text-xs text-muted-foreground">Operator: {getOperatorName()}</p>
              </div>
              
              {/* Location Details */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <MapPin className="h-5 w-5" />
                  <span className="font-medium">Placing at: {suggestedLocation.code}</span>
                </div>
                <div className="text-sm text-blue-700">
                  Row {suggestedLocation.row}, Bay {suggestedLocation.bay}, Level {suggestedLocation.level === '0' ? 'Ground' : suggestedLocation.level}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleFinalConfirm}
                  className="flex-1 h-12 text-base"
                  disabled={loading}
                >
                  {loading ? 'Placing Item...' : 'Confirm Placement'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleBackToLocationGraphic}
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
                  <p>Weight: {createdItem.weight}kg | Qty: {createdItem.quantity}</p>
                  <p>LOT: {createdItem.lotNumber}</p>
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
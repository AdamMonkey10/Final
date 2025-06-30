import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addItem } from '@/lib/firebase/items';
import { getCategories } from '@/lib/firebase/categories';
import { getDepartments } from '@/lib/firebase/departments';
import { ProductSelector } from '@/components/product-selector';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { generateItemZPL, type ItemLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
import { Barcode } from '@/components/barcode';
import { PackagePlus, Printer, CheckCircle, Package, QrCode, Home, ArrowLeft } from 'lucide-react';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { useNavigate } from 'react-router-dom';
import type { Category } from '@/lib/firebase/categories';

interface Department {
  id: string;
  name: string;
}

export default function GoodsInPage() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  const { showInstructions } = useInstructions();
  
  const [formData, setFormData] = useState({
    itemCode: '',
    description: '',
    weight: '',
    category: '',
    department: '',
    coilNumber: '',
    coilLength: '',
    quantity: '1'
  });
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [createdItem, setCreatedItem] = useState<{
    id: string;
    systemCode: string;
    itemCode: string;
    description: string;
    weight: number;
  } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'label' | 'complete'>('form');

  useEffect(() => {
    if (user && !authLoading) {
      loadCategories();
      loadDepartments();
    }
  }, [user, authLoading]);

  const loadCategories = async () => {
    try {
      const fetchedCategories = await getCategories();
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const loadDepartments = async () => {
    try {
      const fetchedDepartments = await getDepartments();
      setDepartments(fetchedDepartments);
    } catch (error) {
      console.error('Error loading departments:', error);
      toast.error('Failed to load departments');
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

    if (!formData.itemCode || !formData.description || !formData.weight || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setCurrentStep('label');

    try {
      const systemCode = generateSystemCode();
      const weight = parseFloat(formData.weight);

      // Prepare metadata for raw materials
      const metadata: any = {};
      const selectedCategory = categories.find(c => c.id === formData.category);
      
      if (selectedCategory?.prefix === 'RAW') {
        if (formData.coilNumber && formData.coilLength) {
          metadata.coilNumber = formData.coilNumber;
          metadata.coilLength = formData.coilLength;
        }
      }

      if (formData.quantity && parseInt(formData.quantity) > 1) {
        metadata.quantity = parseInt(formData.quantity);
      }

      // Create the item
      const itemId = await addItem({
        itemCode: formData.itemCode,
        systemCode,
        description: formData.description,
        weight,
        category: formData.category,
        status: 'pending',
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      });

      // Store created item details for label printing
      setCreatedItem({
        id: itemId,
        systemCode,
        itemCode: formData.itemCode,
        description: formData.description,
        weight
      });

      toast.success('Item created successfully!', {
        description: `System code: ${systemCode}`,
        duration: 5000
      });

      // Show label dialog
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
        operator: getOperatorName(),
        date: new Date().toLocaleDateString(),
      };

      const zpl = generateItemZPL(labelData);
      await sendZPL(zpl);
      
      toast.success('Label sent to printer successfully!');
      setCurrentStep('complete');
      
      // Auto-close dialog after successful print
      setTimeout(() => {
        handleComplete();
      }, 2000);
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPrinting(false);
    }
  };

  const handleSkipLabel = () => {
    setCurrentStep('complete');
    setTimeout(() => {
      handleComplete();
    }, 1500);
  };

  const handleComplete = () => {
    setShowLabelDialog(false);
    setCreatedItem(null);
    setCurrentStep('form');
    
    // Reset form
    setFormData({
      itemCode: '',
      description: '',
      weight: '',
      category: '',
      department: '',
      coilNumber: '',
      coilLength: '',
      quantity: '1'
    });
    
    toast.success('Goods-in process completed!', {
      description: 'Item is ready for placement in warehouse',
      duration: 3000
    });
  };

  const selectedCategory = categories.find(c => c.id === formData.category);
  const isRawMaterial = selectedCategory?.prefix === 'RAW';

  const getStepIndicator = () => {
    const steps = [
      { key: 'form', label: 'Item Details', icon: Package },
      { key: 'label', label: 'Print Label', icon: Printer },
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
      description: "Enter the Product/SKU, description, weight, and category. Raw materials have additional coil fields.",
      type: "info" as const
    },
    {
      title: "Print Label",
      description: "After creating the item, print a barcode label for easy identification and scanning.",
      type: "info" as const
    },
    {
      title: "Ready for Placement",
      description: "The item is now ready to be scanned and placed in a warehouse location.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Goods In</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/scan')} variant="outline">
            <QrCode className="h-4 w-4 mr-2" />
            Scan Items
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
          title="Goods In Process"
          description="Create new items entering the warehouse. Fill in details, print labels, and prepare items for placement."
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
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Create New Item
          </CardTitle>
          <CardDescription>
            Enter details for items entering the warehouse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <ProductSelector
                  value={formData.itemCode}
                  onChange={(value) => setFormData({ ...formData, itemCode: value })}
                  category={formData.category}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Item description"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="0.00"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="1"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Raw Materials specific fields */}
            {isRawMaterial && (
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-medium mb-3 text-blue-900">Raw Material Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="coilNumber">Number of Coils</Label>
                    <Input
                      id="coilNumber"
                      type="number"
                      min="1"
                      value={formData.coilNumber}
                      onChange={(e) => setFormData({ ...formData, coilNumber: e.target.value })}
                      placeholder="Enter number of coils"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coilLength">Coil Length (ft)</Label>
                    <Input
                      id="coilLength"
                      type="number"
                      step="0.1"
                      value={formData.coilLength}
                      onChange={(e) => setFormData({ ...formData, coilLength: e.target.value })}
                      placeholder="Enter coil length"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-lg"
              disabled={loading || !selectedOperator}
            >
              {loading ? 'Creating Item...' : 'Create Item & Print Label'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Label Printing Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {currentStep === 'label' ? 'Print Item Label' : 'Item Created Successfully!'}
            </DialogTitle>
          </DialogHeader>
          
          {createdItem && (
            <div className="space-y-6">
              {/* Item Summary */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-3">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Item Created Successfully!</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div><strong>Product/SKU:</strong> {createdItem.itemCode}</div>
                  <div><strong>Description:</strong> {createdItem.description}</div>
                  <div><strong>Weight:</strong> {createdItem.weight}kg</div>
                  <div><strong>System Code:</strong> {createdItem.systemCode}</div>
                  <div><strong>Operator:</strong> {getOperatorName()}</div>
                </div>
              </div>

              {currentStep === 'label' && (
                <>
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

                  {/* Print Actions */}
                  <div className="flex gap-3">
                    <Button 
                      onClick={handlePrintLabel}
                      className="flex-1 h-12"
                      disabled={printing}
                    >
                      <Printer className="h-5 w-5 mr-2" />
                      {printing ? 'Printing...' : 'Print Label'}
                    </Button>
                    <Button 
                      onClick={handleSkipLabel}
                      variant="outline"
                      className="h-12"
                      disabled={printing}
                    >
                      Skip Label
                    </Button>
                  </div>

                  <div className="text-xs text-center text-muted-foreground">
                    <p>The label will be sent directly to your configured Zebra printer.</p>
                    <p>You can also print labels later from the inventory or scan pages.</p>
                  </div>
                </>
              )}

              {currentStep === 'complete' && (
                <div className="text-center py-6">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium text-green-800 mb-2">
                    Goods-In Complete!
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Item is ready for placement in warehouse
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => navigate('/scan')} variant="outline">
                      <QrCode className="h-4 w-4 mr-2" />
                      Scan & Place Item
                    </Button>
                    <Button onClick={handleComplete}>
                      Create Another Item
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
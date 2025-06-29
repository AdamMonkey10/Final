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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addLocation, getLocations, deleteLocation } from '@/lib/firebase/locations';
import { getCategories, addCategory, deleteCategory, updateCategory } from '@/lib/firebase/categories';
import { getUsers, addUser, deleteUser } from '@/lib/firebase/users';
import { getOperators, addOperator, deactivateOperator } from '@/lib/firebase/operators';
import { getPrinterSettings, savePrinterSettings, testPrinterConnection, type PrinterSettings } from '@/lib/printer-service';
import { CategoryDialog } from '@/components/category-dialog';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { Settings, Trash2, Plus, Users, Download, UserCheck, Layers, Printer, TestTube, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Location } from '@/types/warehouse';
import type { Category } from '@/lib/firebase/categories';
import type { User } from '@/lib/firebase/users';
import type { Operator } from '@/lib/firebase/operators';

// Extended warehouse structure constants
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const LOCATIONS_PER_BAY = 3;
const MAX_LEVELS = 10; // Maximum possible levels

export default function Setup() {
  const { user, authLoading } = useFirebase();
  const { showInstructions } = useInstructions();
  const [selectedRow, setSelectedRow] = useState('');
  const [bayStart, setBayStart] = useState('');
  const [bayEnd, setBayEnd] = useState('');
  const [maxLevel, setMaxLevel] = useState(4); // How many levels high to go (0-4 = 5 levels total)
  const [generatedLocations, setGeneratedLocations] = useState<Array<{
    code: string;
    row: string;
    bay: string;
    level: string;
    location: string;
    maxWeight: number;
  }>>([]);
  const [existingLocations, setExistingLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showOperatorDialog, setShowOperatorDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [newOperator, setNewOperator] = useState({ name: '', email: '' });
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Printer settings state
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    ip: '10.0.1.90',
    port: 9100
  });
  const [printerLoading, setPrinterLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Generate levels array based on maxLevel
  const getLevelsArray = () => {
    const levels = [];
    for (let i = 0; i <= maxLevel; i++) {
      levels.push(i);
    }
    return levels;
  };

  useEffect(() => {
    if (user && !authLoading) {
      loadCategories();
      loadUsers();
      loadOperators();
      loadPrinterSettings();
      fetchExistingLocations();
    }
  }, [user, authLoading]);

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

  const loadUsers = async () => {
    if (!user || authLoading) return;
    
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadOperators = async () => {
    if (!user || authLoading) return;
    
    try {
      const fetchedOperators = await getOperators();
      setOperators(fetchedOperators);
    } catch (error) {
      console.error('Error loading operators:', error);
      toast.error('Failed to load operators');
    }
  };

  const loadPrinterSettings = async () => {
    try {
      const settings = await getPrinterSettings();
      setPrinterSettings(settings);
    } catch (error) {
      console.error('Error loading printer settings:', error);
      toast.error('Failed to load printer settings');
    }
  };

  const generateLocations = () => {
    if (!selectedRow || !bayStart || !bayEnd) {
      toast.error('Please fill in all fields');
      return;
    }

    const startBay = parseInt(bayStart);
    const endBay = parseInt(bayEnd);

    if (startBay > endBay) {
      toast.error('Start bay must be less than or equal to end bay');
      return;
    }

    const levels = getLevelsArray();
    const locations = [];
    
    for (let bay = startBay; bay <= endBay; bay++) {
      for (let position = 1; position <= LOCATIONS_PER_BAY; position++) {
        for (const level of levels) {
          const bayFormatted = bay.toString().padStart(2, '0');
          const code = `${selectedRow}${bayFormatted}-${level}-${position}`;
          
          locations.push({
            code,
            row: selectedRow,
            bay: bayFormatted,
            level: level.toString(),
            location: position.toString(),
            maxWeight: level === 0 ? Infinity : 1000, // Ground level unlimited, others 1000kg
            currentWeight: 0,
            available: true,
            verified: true
          });
        }
      }
    }

    setGeneratedLocations(locations);
  };

  const saveLocations = async () => {
    try {
      const savedLocations = [];
      for (const location of generatedLocations) {
        const locationId = await addLocation(location);
        savedLocations.push({ id: locationId, ...location });
      }
      toast.success(`${savedLocations.length} locations saved successfully`);
      setGeneratedLocations([]);
      fetchExistingLocations();
    } catch (error) {
      console.error('Error saving locations:', error);
      toast.error('Failed to save locations');
    }
  };

  const fetchExistingLocations = async () => {
    if (!user || authLoading) return;
    
    try {
      setLoadingLocations(true);
      const locations = await getLocations();
      setExistingLocations(locations);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Error fetching existing locations');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    if (location.currentWeight > 0) {
      toast.error('Cannot delete location with items. Please remove items first.');
      return;
    }
    setLocationToDelete(location);
  };

  const confirmDeleteLocation = async () => {
    if (!locationToDelete) return;

    try {
      await deleteLocation(locationToDelete.id);
      toast.success(`Location ${locationToDelete.code} deleted successfully`);
      setLocationToDelete(null);
      fetchExistingLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Failed to delete location');
    }
  };

  const getWeightStatusColor = (currentWeight: number, maxWeight: number) => {
    if (currentWeight === 0) return 'bg-green-100 text-green-800';
    if (maxWeight === Infinity) return 'bg-blue-100 text-blue-800'; // Ground level
    if (currentWeight >= maxWeight * 0.9) return 'bg-red-100 text-red-800';
    if (currentWeight >= maxWeight * 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getWeightStatusText = (currentWeight: number, maxWeight: number) => {
    if (currentWeight === 0) return 'Empty';
    if (maxWeight === Infinity) return 'In Use'; // Ground level
    if (currentWeight >= maxWeight * 0.9) return 'Full';
    if (currentWeight >= maxWeight * 0.7) return 'Heavy';
    return 'In Use';
  };

  const handleSaveCategory = async (data: any) => {
    try {
      if (selectedCategory) {
        await updateCategory(selectedCategory.id, data);
      } else {
        await addCategory(data);
      }
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      throw error;
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    try {
      await deleteCategory(category.id);
      toast.success('Category deleted');
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleAddUser = async () => {
    try {
      if (!newUser.username || !newUser.password) {
        toast.error('Username and password are required');
        return;
      }
      await addUser(newUser.username, newUser.password);
      toast.success('User added successfully');
      setNewUser({ username: '', password: '' });
      setShowUserDialog(false);
      loadUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    }
  };

  const handleDeleteUser = async (email: string) => {
    try {
      await deleteUser(email);
      toast.success('User deleted');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleAddOperator = async () => {
    try {
      if (!newOperator.name) {
        toast.error('Operator name is required');
        return;
      }
      await addOperator(newOperator.name, newOperator.email);
      toast.success('Operator added successfully');
      setNewOperator({ name: '', email: '' });
      setShowOperatorDialog(false);
      loadOperators();
    } catch (error) {
      console.error('Error adding operator:', error);
      toast.error('Failed to add operator');
    }
  };

  const handleDeactivateOperator = async (operatorId: string) => {
    try {
      await deactivateOperator(operatorId);
      toast.success('Operator deactivated');
      loadOperators();
    } catch (error) {
      console.error('Error deactivating operator:', error);
      toast.error('Failed to deactivate operator');
    }
  };

  const handleSavePrinterSettings = async () => {
    setPrinterLoading(true);
    try {
      await savePrinterSettings(printerSettings);
      toast.success('Printer settings saved successfully');
    } catch (error) {
      console.error('Error saving printer settings:', error);
      toast.error('Failed to save printer settings');
    } finally {
      setPrinterLoading(false);
    }
  };

  const handleTestPrinter = async () => {
    setTestingConnection(true);
    try {
      const success = await testPrinterConnection(printerSettings);
      if (success) {
        toast.success('Printer connection test successful! Check your printer for a test label.');
      } else {
        toast.error('Printer connection test failed. Please check your settings and network connection.');
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      toast.error('Printer test failed. Please check your settings.');
    } finally {
      setTestingConnection(false);
    }
  };

  const downloadInventoryData = () => {
    try {
      const items = categories.map(cat => ({
        name: cat.name,
        prefix: cat.prefix,
        description: cat.description,
        currentQuantity: cat.kanbanRules?.currentQuantity || 0,
        minQuantity: cat.kanbanRules?.minQuantity || 0,
        maxQuantity: cat.kanbanRules?.maxQuantity || 0,
        reorderPoint: cat.kanbanRules?.reorderPoint || 0,
        fixedLocations: cat.kanbanRules?.fixedLocations?.join(', ') || ''
      }));

      const csvContent = [
        ['Name', 'Prefix', 'Description', 'Current Qty', 'Min Qty', 'Max Qty', 'Reorder Point', 'Fixed Locations'],
        ...items.map(item => Object.values(item))
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading data:', error);
      toast.error('Failed to download data');
    }
  };

  const setupInstructions = [
    {
      title: "Location Generation",
      description: "Generate warehouse locations by selecting row, bay range, and number of levels. Each bay creates 3 positions per level.",
      type: "info" as const
    },
    {
      title: "Category Management",
      description: "Create and manage item categories with optional Kanban rules for quantity-based stock management.",
      type: "info" as const
    },
    {
      title: "Operator Management",
      description: "Add warehouse operators who will be performing transactions. Operators are required for all warehouse operations.",
      type: "warning" as const
    },
    {
      title: "Printer Configuration",
      description: "Configure your Zebra printer settings for direct ZPL label printing. Test the connection before use.",
      type: "tip" as const
    },
    {
      title: "Data Management",
      description: "Export inventory data and manage user accounts. Keep your warehouse data organized and accessible.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Setup</h1>
        <Badge variant="outline" className="px-3 py-1">
          {existingLocations.length} locations
        </Badge>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Warehouse Setup Guide"
          description="Configure your warehouse system including locations, categories, operators, and printer settings. Complete setup before starting warehouse operations."
          steps={setupInstructions}
          onClose={() => {}}
          className="mb-6"
        />
      )}

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="printer">Printer Settings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <div className="space-y-6">
            {/* Generate Locations Card */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Locations</CardTitle>
                <CardDescription>
                  Generate warehouse locations. Each bay has {LOCATIONS_PER_BAY} locations across multiple levels.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Row</Label>
                    <Select value={selectedRow} onValueChange={setSelectedRow}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select row" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROWS.map((row) => (
                          <SelectItem key={row} value={row}>
                            Row {row}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Levels High (How many levels?)</Label>
                    <Select value={maxLevel.toString()} onValueChange={(value) => setMaxLevel(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select max level" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: MAX_LEVELS }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i === 0 ? 'Ground only (Level 0)' : `${i + 1} levels high (0-${i})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Bay</Label>
                    <Input
                      type="number"
                      min="1"
                      value={bayStart}
                      onChange={(e) => setBayStart(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Bay</Label>
                    <Input
                      type="number"
                      min="1"
                      value={bayEnd}
                      onChange={(e) => setBayEnd(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="mb-4 p-4 border rounded-lg">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Configuration Summary
                  </h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• This will create locations from ground level (0) up to level {maxLevel}</p>
                    <p>• Total levels: {maxLevel + 1} (0-{maxLevel})</p>
                    <p>• Each bay will have {LOCATIONS_PER_BAY} positions per level</p>
                    <p>• Ground level (0) has unlimited weight capacity</p>
                    <p>• Upper levels (1-{maxLevel}) have 1000kg weight limit each</p>
                  </div>
                </div>

                <Button onClick={generateLocations} className="w-full">
                  Generate Locations
                </Button>

                {generatedLocations.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">Generated Locations</h3>
                    <div className="border rounded-md max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Row</TableHead>
                            <TableHead>Bay</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Max Weight</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {generatedLocations.slice(0, 20).map((location) => (
                            <TableRow key={location.code}>
                              <TableCell className="font-medium">
                                {location.code}
                              </TableCell>
                              <TableCell>{location.row}</TableCell>
                              <TableCell>{location.bay}</TableCell>
                              <TableCell>{location.level === '0' ? 'Ground' : location.level}</TableCell>
                              <TableCell>{location.maxWeight === Infinity ? 'Unlimited' : `${location.maxWeight}kg`}</TableCell>
                            </TableRow>
                          ))}
                          {generatedLocations.length > 20 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
                                ... and {generatedLocations.length - 20} more locations
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        <strong>Summary:</strong> {generatedLocations.length} locations will be created across {maxLevel + 1} levels (0-{maxLevel}).
                      </p>
                    </div>
                    <Button
                      onClick={saveLocations}
                      className="w-full mt-4"
                      variant="default"
                    >
                      Save All Locations
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Existing Locations Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Existing Locations</span>
                  <Button onClick={fetchExistingLocations} variant="outline" disabled={loadingLocations}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loadingLocations ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </CardTitle>
                <CardDescription>
                  Manage existing warehouse locations
                  {loadingLocations && <span className="text-blue-600"> • Loading...</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLocations && existingLocations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    Loading locations...
                  </div>
                ) : existingLocations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No locations found</p>
                    <p className="text-sm">Generate locations above to get started.</p>
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Row</TableHead>
                          <TableHead>Bay</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Weight Status</TableHead>
                          <TableHead>Max Weight</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {existingLocations.map((location) => (
                          <TableRow key={location.id}>
                            <TableCell className="font-medium">{location.code}</TableCell>
                            <TableCell>{location.row}</TableCell>
                            <TableCell>{location.bay}</TableCell>
                            <TableCell>{location.level === '0' ? 'Ground' : location.level}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={getWeightStatusColor(location.currentWeight, location.maxWeight)}
                              >
                                {getWeightStatusText(location.currentWeight, location.maxWeight)}
                                {location.currentWeight > 0 && ` (${location.currentWeight}kg)`}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {location.level === '0' ? 'Unlimited' : `${location.maxWeight}kg`}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteLocation(location)}
                                className={cn(
                                  location.currentWeight > 0 
                                    ? "text-gray-400 cursor-not-allowed" 
                                    : "text-red-500 hover:text-red-600 hover:bg-red-50"
                                )}
                                disabled={location.currentWeight > 0}
                                title={location.currentWeight > 0 ? "Cannot delete location with items" : "Delete location"}
                              >
                                <Trash2 className="h-4 w-4" />
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

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Item Categories</span>
                <Button onClick={() => {
                  setSelectedCategory(undefined);
                  setShowCategoryDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </CardTitle>
              <CardDescription>
                Manage product categories and Kanban rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Rules</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">
                          {category.name}
                          {category.isDefault && (
                            <Badge variant="secondary" className="ml-2">
                              Default
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{category.description}</TableCell>
                        <TableCell>
                          {category.kanbanRules ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>Current: {category.kanbanRules.currentQuantity}</span>
                                <Badge variant={
                                  category.kanbanRules.currentQuantity <= category.kanbanRules.minQuantity ? 'destructive' :
                                  category.kanbanRules.currentQuantity <= category.kanbanRules.reorderPoint ? 'warning' :
                                  'success'
                                }>
                                  {category.kanbanRules.currentQuantity <= category.kanbanRules.minQuantity ? 'Low Stock' :
                                   category.kanbanRules.currentQuantity <= category.kanbanRules.reorderPoint ? 'Reorder Soon' :
                                   'In Stock'}
                                </Badge>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all",
                                    category.kanbanRules.currentQuantity <= category.kanbanRules.minQuantity ? 
                                      "bg-destructive" :
                                    category.kanbanRules.currentQuantity <= category.kanbanRules.reorderPoint ?
                                      "bg-yellow-500" :
                                      "bg-green-500"
                                  )}
                                  style={{ 
                                    width: `${Math.min(100, (category.kanbanRules.currentQuantity / category.kanbanRules.maxQuantity) * 100)}%` 
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="bg-muted">
                              No Stock Control
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {category.isDefault ? (
                            <Badge variant="outline" className="bg-muted">
                              No Rules Required
                            </Badge>
                          ) : category.kanbanRules ? (
                            <div className="space-y-1 text-sm">
                              <div>Min: {category.kanbanRules.minQuantity}</div>
                              <div>Max: {category.kanbanRules.maxQuantity}</div>
                              <div>Reorder at: {category.kanbanRules.reorderPoint}</div>
                              <div>Location: {category.kanbanRules.fixedLocations?.join(', ') || '—'}</div>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {!category.isDefault && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedCategory(category);
                                  setShowCategoryDialog(true);
                                }}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteCategory(category)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operators">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Warehouse Operators</span>
                <Button onClick={() => setShowOperatorDialog(true)}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Add Operator
                </Button>
              </CardTitle>
              <CardDescription>
                Manage warehouse operators who perform transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operators.map((operator) => (
                      <TableRow key={operator.id}>
                        <TableCell className="font-medium">
                          {operator.name}
                        </TableCell>
                        <TableCell>{operator.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={operator.active ? 'success' : 'secondary'}>
                            {operator.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {operator.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivateOperator(operator.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="printer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Zebra Printer Settings
              </CardTitle>
              <CardDescription>
                Configure your Zebra printer for ZPL label printing (103x103mm labels)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="printerIp">Printer IP Address</Label>
                    <Input
                      id="printerIp"
                      value={printerSettings.ip}
                      onChange={(e) => setPrinterSettings(prev => ({ ...prev, ip: e.target.value }))}
                      placeholder="10.0.1.90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="printerPort">Port</Label>
                    <Input
                      id="printerPort"
                      type="number"
                      value={printerSettings.port}
                      onChange={(e) => setPrinterSettings(prev => ({ ...prev, port: parseInt(e.target.value) || 9100 }))}
                      placeholder="9100"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSavePrinterSettings}
                    disabled={printerLoading}
                    className="flex-1"
                  >
                    {printerLoading ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <Button 
                    onClick={handleTestPrinter}
                    disabled={testingConnection}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <TestTube className="h-4 w-4" />
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Printer Setup Instructions:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Ensure your Zebra printer is connected to the network</li>
                    <li>• Configure the printer for 103x103mm labels</li>
                    <li>• Set the printer to accept HTTP POST requests on the specified port</li>
                    <li>• Test the connection using the "Test Connection" button</li>
                    <li>• Labels will be printed directly via ZPL commands</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>User Management</span>
                <Button onClick={() => setShowUserDialog(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </CardTitle>
              <CardDescription>
                Manage warehouse staff accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.uid}>
                        <TableCell className="font-medium">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.email)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export and manage warehouse data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  onClick={downloadInventoryData}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Inventory Data (CSV)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      {showCategoryDialog && (
        <CategoryDialog
          open={showCategoryDialog}
          onOpenChange={setShowCategoryDialog}
          onSave={handleSaveCategory}
          editData={selectedCategory}
        />
      )}

      {/* Add User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                type="email"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <Button onClick={handleAddUser} className="w-full">
              Add User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Operator Dialog */}
      <Dialog open={showOperatorDialog} onOpenChange={setShowOperatorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Operator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="operatorName">Name *</Label>
              <Input
                id="operatorName"
                value={newOperator.name}
                onChange={(e) => setNewOperator({ ...newOperator, name: e.target.value })}
                placeholder="Enter operator name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operatorEmail">Email (optional)</Label>
              <Input
                id="operatorEmail"
                type="email"
                value={newOperator.email}
                onChange={(e) => setNewOperator({ ...newOperator, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <Button onClick={handleAddOperator} className="w-full">
              Add Operator
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Location Confirmation Dialog */}
      <AlertDialog open={!!locationToDelete} onOpenChange={() => setLocationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete location <strong>{locationToDelete?.code}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteLocation} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
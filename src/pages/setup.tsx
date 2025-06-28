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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addLocation, getLocations } from '@/lib/firebase/locations';
import { getCategories, addCategory, deleteCategory, updateCategory } from '@/lib/firebase/categories';
import { getUsers, addUser, deleteUser } from '@/lib/firebase/users';
import { getOperators, addOperator, deactivateOperator } from '@/lib/firebase/operators';
import { getPrinterSettings, savePrinterSettings, testPrinterConnection, type PrinterSettings } from '@/lib/printer-service';
import { generateBulkLocationZPL } from '@/lib/zpl-generator';
import { LEVEL_MAX_WEIGHTS, RACK_TYPES, STANDARD_RACK_HEIGHTS } from '@/lib/warehouse-logic';
import { CategoryDialog } from '@/components/category-dialog';
import { Settings, Trash2, Plus, Users, Download, UserCheck, Ruler, Layers, Printer, TestTube } from 'lucide-react';
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
  const [selectedRow, setSelectedRow] = useState('');
  const [bayStart, setBayStart] = useState('');
  const [bayEnd, setBayEnd] = useState('');
  const [maxLevel, setMaxLevel] = useState(4); // How many levels high to go (0-4 = 5 levels total)
  const [selectedRackType, setSelectedRackType] = useState('standard');
  const [customHeights, setCustomHeights] = useState<Record<string, number>>({
    '0': 0,
    '1': 2.5,
    '2': 5.0,
    '3': 7.5,
    '4': 10.0,
  });
  const [generatedLocations, setGeneratedLocations] = useState<Array<{
    code: string;
    row: string;
    bay: string;
    level: string;
    location: string;
    maxWeight: number;
    height: number;
    rackType: string;
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
  const [weightLimits, setWeightLimits] = useState({
    '0': LEVEL_MAX_WEIGHTS['0'],
    '1': LEVEL_MAX_WEIGHTS['1'],
    '2': LEVEL_MAX_WEIGHTS['2'],
    '3': LEVEL_MAX_WEIGHTS['3'],
    '4': LEVEL_MAX_WEIGHTS['4'],
  });

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
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Update custom heights when rack type changes
    if (selectedRackType !== 'custom') {
      const rackConfig = RACK_TYPES[selectedRackType as keyof typeof RACK_TYPES];
      if (rackConfig) {
        setCustomHeights(rackConfig.levelHeights);
      }
    }
  }, [selectedRackType]);

  // Update heights when max level changes
  useEffect(() => {
    if (selectedRackType !== 'custom') {
      const rackConfig = RACK_TYPES[selectedRackType as keyof typeof RACK_TYPES];
      if (rackConfig) {
        const newHeights: Record<string, number> = {};
        for (let i = 0; i <= maxLevel; i++) {
          const levelKey = i.toString();
          newHeights[levelKey] = rackConfig.levelHeights[levelKey] || (i * 2.5);
        }
        setCustomHeights(newHeights);
      }
    }
  }, [maxLevel, selectedRackType]);

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

  const handleWeightChange = (level: string, value: string) => {
    const weight = parseInt(value);
    if (!isNaN(weight) && weight > 0) {
      setWeightLimits(prev => ({
        ...prev,
        [level]: weight
      }));
    }
  };

  const handleHeightChange = (level: string, value: string) => {
    const height = parseFloat(value);
    if (!isNaN(height) && height >= 0) {
      setCustomHeights(prev => ({
        ...prev,
        [level]: height
      }));
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
          const height = customHeights[level.toString()] || 0;
          
          locations.push({
            code,
            row: selectedRow,
            bay: bayFormatted,
            level: level.toString(),
            location: position.toString(),
            maxWeight: weightLimits[level.toString()] || (level === 0 ? Infinity : 1000),
            currentWeight: 0,
            available: true,
            verified: true,
            height,
            rackType: selectedRackType
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
    try {
      const locations = await getLocations();
      setExistingLocations(locations);
      toast.success(`Found ${locations.length} existing locations`);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Error fetching existing locations');
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Setup</h1>
        <Button onClick={fetchExistingLocations}>
          Refresh Locations
        </Button>
      </div>

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="weights">Weight Settings</TabsTrigger>
          <TabsTrigger value="heights">Height Settings</TabsTrigger>
          <TabsTrigger value="printer">Printer Settings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle>Generate Locations</CardTitle>
              <CardDescription>
                Generate warehouse locations with configurable rack heights and levels. Each bay has {LOCATIONS_PER_BAY} locations.
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
                  <Label>Rack Type</Label>
                  <Select value={selectedRackType} onValueChange={setSelectedRackType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rack type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RACK_TYPES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col">
                            <span>{config.name}</span>
                            <span className="text-xs text-muted-foreground">{config.description}</span>
                          </div>
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

              {/* Rack Levels Configuration */}
              <div className="mb-4 p-4 border rounded-lg">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Rack Levels Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Maximum Level (How many levels high?)</Label>
                    <Select value={maxLevel.toString()} onValueChange={(value) => setMaxLevel(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select max level" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: MAX_LEVELS }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            Level {i} (Ground only)
                            {i > 0 && ` - ${i + 1} levels total (0-${i})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {maxLevel + 1} levels total (0-{maxLevel})
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  This will create locations from ground level (0) up to level {maxLevel}
                </div>
              </div>

              {/* Height Configuration */}
              <div className="mb-4 p-4 border rounded-lg">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Height Configuration ({RACK_TYPES[selectedRackType as keyof typeof RACK_TYPES]?.name})
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(maxLevel + 1, 6)}, 1fr)` }}>
                  {getLevelsArray().map((level) => (
                    <div key={level} className="space-y-2">
                      <Label className="text-sm">
                        Level {level}
                        {level === 0 && ' (Ground)'}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={customHeights[level.toString()] || 0}
                          onChange={(e) => handleHeightChange(level.toString(), e.target.value)}
                          disabled={selectedRackType !== 'custom'}
                          className="text-sm"
                        />
                        <span className="text-xs text-muted-foreground">m</span>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedRackType !== 'custom' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Heights are preset for {RACK_TYPES[selectedRackType as keyof typeof RACK_TYPES]?.name}. Select "Custom Rack" to modify.
                  </p>
                )}
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
                          <TableHead>Height</TableHead>
                          <TableHead>Max Weight</TableHead>
                          <TableHead>Rack Type</TableHead>
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
                            <TableCell>{location.height}m</TableCell>
                            <TableCell>{location.maxWeight === Infinity ? 'Unlimited' : `${location.maxWeight}kg`}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {RACK_TYPES[location.rackType as keyof typeof RACK_TYPES]?.name || location.rackType}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {generatedLocations.length > 20 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              ... and {generatedLocations.length - 20} more locations
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Summary:</strong> {generatedLocations.length} locations will be created across {maxLevel + 1} levels (0-{maxLevel}) with {RACK_TYPES[selectedRackType as keyof typeof RACK_TYPES]?.name} configuration.
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

        <TabsContent value="weights">
          <Card>
            <CardHeader>
              <CardTitle>Level Weight Settings</CardTitle>
              <CardDescription>
                Configure maximum weight limits for each level (applies to levels 0-{maxLevel})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {getLevelsArray().map((level) => (
                  <div key={level} className="flex items-center gap-4">
                    <Label className="w-32">
                      Level {level}
                      {level === 0 && ' (Ground)'}:
                    </Label>
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={weightLimits[level.toString()] || (level === 0 ? 'Infinity' : 1000)}
                        onChange={(e) => handleWeightChange(level.toString(), e.target.value)}
                        min="0"
                        step="100"
                        disabled={level === 0}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8">
                      {level === 0 ? '∞' : 'kg'}
                    </span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground mt-4">
                  Note: Changes will apply to newly generated locations only. Ground level has unlimited weight capacity.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heights">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Rack Height Configurations
              </CardTitle>
              <CardDescription>
                Predefined height configurations for different rack types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(RACK_TYPES).map(([key, config]) => (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{config.name}</h3>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                      <Badge variant="outline">
                        Max: {config.maxHeight}m
                      </Badge>
                    </div>
                    <div className="grid grid-cols-5 gap-4">
                      {Object.entries(config.levelHeights).map(([level, height]) => (
                        <div key={level} className="text-center">
                          <div className="text-sm font-medium">Level {level}</div>
                          <div className="text-lg">{height}m</div>
                          {level === '0' && (
                            <div className="text-xs text-muted-foreground">Ground</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Usage Notes:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Heights are used for location identification and safety calculations</li>
                  <li>• Ground level (Level 0) always has 0m height</li>
                  <li>• Custom rack type allows manual height configuration</li>
                  <li>• Heights are stored with each location for future reference</li>
                  <li>• Configure max levels in the Locations tab to control rack height</li>
                </ul>
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

                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Network Requirements:</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Printer must be accessible from this device's network</li>
                    <li>• Default port 9100 is standard for Zebra printers</li>
                    <li>• Ensure firewall allows HTTP requests to the printer</li>
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
    </div>
  );
}
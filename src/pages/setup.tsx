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
import { LEVEL_MAX_WEIGHTS } from '@/lib/warehouse-logic';
import { CategoryDialog } from '@/components/category-dialog';
import { Settings, Trash2, Plus, Users, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Location } from '@/types/warehouse';
import type { Category } from '@/lib/firebase/categories';
import type { User } from '@/lib/firebase/users';

// Extended warehouse structure constants
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const LOCATIONS_PER_BAY = 3;
const LEVELS = [0, 1, 2, 3, 4]; // Ground level (0) and 4 levels above

export default function Setup() {
  const { user, authLoading } = useFirebase();
  const [selectedRow, setSelectedRow] = useState('');
  const [bayStart, setBayStart] = useState('');
  const [bayEnd, setBayEnd] = useState('');
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
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [weightLimits, setWeightLimits] = useState({
    '0': LEVEL_MAX_WEIGHTS['0'],
    '1': LEVEL_MAX_WEIGHTS['1'],
    '2': LEVEL_MAX_WEIGHTS['2'],
    '3': LEVEL_MAX_WEIGHTS['3'],
    '4': LEVEL_MAX_WEIGHTS['4'],
  });

  useEffect(() => {
    if (user && !authLoading) {
      loadCategories();
      loadUsers();
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

  const handleWeightChange = (level: string, value: string) => {
    const weight = parseInt(value);
    if (!isNaN(weight) && weight > 0) {
      setWeightLimits(prev => ({
        ...prev,
        [level]: weight
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

    const locations = [];
    for (let bay = startBay; bay <= endBay; bay++) {
      for (let position = 1; position <= LOCATIONS_PER_BAY; position++) {
        for (const level of LEVELS) {
          const bayFormatted = bay.toString().padStart(2, '0');
          const code = `${selectedRow}${bayFormatted}-${level}-${position}`;
          locations.push({
            code,
            row: selectedRow,
            bay: bayFormatted,
            level: level.toString(),
            location: position.toString(),
            maxWeight: weightLimits[level.toString()],
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

  const handleDeleteUser = async (username: string) => {
    try {
      await deleteUser(username);
      toast.success('User deleted');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
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
          <TabsTrigger value="weights">Weight Settings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle>Generate Locations</CardTitle>
              <CardDescription>
                Generate warehouse locations based on row and bay range. Each bay has {LOCATIONS_PER_BAY} locations and {LEVELS.length} levels (0-4).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
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
              <Button onClick={generateLocations} className="w-full">
                Generate Locations
              </Button>

              {generatedLocations.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Generated Locations</h3>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Row</TableHead>
                          <TableHead>Bay</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Max Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedLocations.map((location) => (
                          <TableRow key={location.code}>
                            <TableCell className="font-medium">
                              {location.code}
                            </TableCell>
                            <TableCell>{location.row}</TableCell>
                            <TableCell>{location.bay}</TableCell>
                            <TableCell>{location.level === '0' ? 'Ground' : location.level}</TableCell>
                            <TableCell>{location.location}</TableCell>
                            <TableCell>{location.maxWeight}kg</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

        <TabsContent value="weights">
          <Card>
            <CardHeader>
              <CardTitle>Level Weight Settings</CardTitle>
              <CardDescription>
                Configure maximum weight limits for each level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {LEVELS.map((level) => (
                  <div key={level} className="flex items-center gap-4">
                    <Label className="w-32">
                      Level {level}
                      {level === 0 && ' (Ground)'}:
                    </Label>
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={weightLimits[level.toString()]}
                        onChange={(e) => handleWeightChange(level.toString(), e.target.value)}
                        min="0"
                        step="100"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8">kg</span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground mt-4">
                  Note: Changes will apply to newly generated locations only
                </p>
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
                      <TableHead>Username</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.username}>
                        <TableCell className="font-medium">
                          {user.username}
                        </TableCell>
                        <TableCell>
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.username)}
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="Enter username"
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
    </div>
  );
}
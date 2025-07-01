import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getItemsByStatus } from '@/lib/firebase/items';
import { getLocationByCode } from '@/lib/firebase/locations';
import { Search, Filter, Package, RefreshCcw, ArrowUpFromLine, MapPin } from 'lucide-react';
import { BayVisualizer } from '@/components/bay-visualizer';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import type { Item, Location } from '@/types/warehouse';

export default function Inventory() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'systemCode' | 'description' | 'category' | 'location'>('systemCode');
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      loadItems();
    }
  }, [user, authLoading]);

  useEffect(() => {
    filterItems();
  }, [search, filterType, items]);

  const loadItems = async () => {
    if (!user || authLoading) return;
    
    try {
      setLoading(true);
      // Only fetch items with status 'placed'
      const fetchedItems = await getItemsByStatus('placed');
      setItems(fetchedItems);
      setFilteredItems(fetchedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
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

  const handleItemClick = async (item: Item) => {
    if (!selectedOperator) {
      toast.error('Please select an operator before picking items');
      return;
    }

    if (!item.location) {
      toast.error('Item has no location assigned');
      return;
    }

    setSelectedItem(item);
    setLoadingLocation(true);
    
    try {
      const location = await getLocationByCode(item.location);
      
      if (!location) {
        toast.error('Location not found');
        return;
      }

      setSelectedLocation(location);
      setShowLocationDialog(true);
      
      toast.success(`Ready to pick ${item.itemCode} from ${location.code}`);
    } catch (error) {
      console.error('Error loading location:', error);
      toast.error('Failed to load location details');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleConfirmPick = () => {
    if (!selectedItem || !selectedLocation) return;

    // Navigate to goods-out with the item and location data
    navigate('/goods-out', {
      state: {
        preSelectedItem: selectedItem,
        preSelectedLocation: selectedLocation,
        skipLocationScan: true
      }
    });
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
        <h1 className="text-3xl font-bold">Warehouse Inventory</h1>
        <Button onClick={loadItems} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {!selectedOperator && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Action Required
              </Badge>
              <span className="text-sm">Please select an operator from the top-right corner to enable item picking.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Current Stock
          </CardTitle>
          <CardDescription>
            Items currently stored in warehouse locations. Click on any item to start the pickup process.
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
                <SelectItem value="systemCode">System Code</SelectItem>
                <SelectItem value="description">Description</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="location">Location</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading inventory...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No items found matching your search.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System Code</TableHead>
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
                      onClick={() => selectedOperator && handleItemClick(item)}
                    >
                      <TableCell className="font-medium font-mono text-sm">{item.systemCode}</TableCell>
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
                            handleItemClick(item);
                          }}
                          disabled={!selectedOperator || loadingLocation}
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

      {/* Location Confirmation Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
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
                <p className="text-xs text-muted-foreground">System Code: {selectedItem.systemCode}</p>
                <p className="text-xs text-muted-foreground">Operator: {selectedOperator?.name}</p>
              </div>
              
              {/* Location Visualizer */}
              <BayVisualizer
                location={selectedLocation}
                onConfirm={handleConfirmPick}
                mode="pick"
              />
              
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-800">
                  <ArrowUpFromLine className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    This will take you to the goods-out process to scan and remove this item
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
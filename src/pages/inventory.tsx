import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getItemsByStatus } from '@/lib/firebase/items';
import { Search, Filter, Package, RefreshCcw } from 'lucide-react';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Item } from '@/types/warehouse';

export default function Inventory() {
  const { user, authLoading } = useFirebase();
  const { showInstructions } = useInstructions();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'systemCode' | 'description' | 'category' | 'location'>('systemCode');

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

  const instructionSteps = [
    {
      title: "Search and Filter",
      description: "Use the search bar to find specific items by system code, description, category, or location.",
      type: "info" as const
    },
    {
      title: "Filter Options",
      description: "Change the filter type to search by different item attributes like Product/SKU, description, category, or location.",
      type: "tip" as const
    },
    {
      title: "Item Information",
      description: "View detailed information including system codes, Product/SKU, descriptions, categories, locations, and weights.",
      type: "info" as const
    },
    {
      title: "Real-time Updates",
      description: "The inventory automatically updates when items are moved, placed, or removed from the warehouse.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Inventory</h1>
        <Button onClick={loadItems} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Inventory Management"
          description="View and search all items currently stored in warehouse locations. Track item details and locations in real-time."
          steps={instructionSteps}
          onClose={() => {}}
          className="mb-6"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Current Stock
          </CardTitle>
          <CardDescription>
            Items currently stored in warehouse locations
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium font-mono text-sm">{item.systemCode}</TableCell>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{getCategoryBadge(item.category)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {item.location}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.weight}kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
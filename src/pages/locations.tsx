import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getLocations } from '@/lib/firebase/locations';
import { getItemsByLocation } from '@/lib/firebase/items';
import { Grid2X2, Search, Filter, QrCode, RefreshCcw } from 'lucide-react';
import { BarcodePrint } from '@/components/barcode-print';
import { BayVisualizer } from '@/components/bay-visualizer';
import type { Location } from '@/types/warehouse';
import type { Item } from '@/types/warehouse';

interface LocationWithItem extends Location {
  storedItem?: Item;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationWithItem[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'code' | 'row' | 'bay' | 'level'>('code');
  const [selectedLocation, setSelectedLocation] = useState<LocationWithItem | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showVisualDialog, setShowVisualDialog] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    filterLocations();
  }, [search, filterType, locations]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const fetchedLocations = await getLocations();
      
      // Fetch items for each location
      const locationsWithItems = await Promise.all(
        fetchedLocations.map(async (location) => {
          if (location.currentWeight > 0) {
            const items = await getItemsByLocation(location.code);
            return {
              ...location,
              storedItem: items[0] // Assume one item per location for now
            };
          }
          return location;
        })
      );

      setLocations(locationsWithItems);
      setFilteredLocations(locationsWithItems);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const filterLocations = () => {
    if (!search.trim()) {
      setFilteredLocations(locations);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = locations.filter(location => {
      switch (filterType) {
        case 'code':
          return location.code.toLowerCase().includes(searchLower);
        case 'row':
          return location.row.toLowerCase().includes(searchLower);
        case 'bay':
          return location.bay.toLowerCase().includes(searchLower);
        case 'level':
          return location.level.toLowerCase().includes(searchLower);
        default:
          return false;
      }
    });

    setFilteredLocations(filtered);
  };

  const getWeightStatusColor = (currentWeight: number, maxWeight: number) => {
    if (currentWeight === 0) return 'bg-green-100 text-green-800';
    if (currentWeight >= maxWeight * 0.9) return 'bg-red-100 text-red-800';
    if (currentWeight >= maxWeight * 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getWeightStatusText = (currentWeight: number, maxWeight: number) => {
    if (currentWeight === 0) return 'Empty';
    if (currentWeight >= maxWeight * 0.9) return 'Full';
    if (currentWeight >= maxWeight * 0.7) return 'Heavy';
    return 'In Use';
  };

  const handleLocationSelect = (location: LocationWithItem) => {
    setSelectedLocation(location);
    setShowVisualDialog(true);
  };

  const handleLocationConfirm = () => {
    if (selectedLocation) {
      toast.success(`Location ${selectedLocation.code} selected`);
      setShowVisualDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Locations</h1>
        <Button onClick={loadLocations} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid2X2 className="h-5 w-5" />
            Location List
          </CardTitle>
          <CardDescription>
            View and manage storage locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
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
                <SelectItem value="code">Location Code</SelectItem>
                <SelectItem value="row">Row</SelectItem>
                <SelectItem value="bay">Bay</SelectItem>
                <SelectItem value="level">Level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading locations...
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No locations found matching your search.
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
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((location) => (
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
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLocationSelect(location)}
                        >
                          View Location
                        </Button>
                        {location.storedItem && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLocation(location);
                              setShowBarcodeDialog(true);
                            }}
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            Item Barcode
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barcode Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Barcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLocation?.storedItem && (
              <BarcodePrint
                value={selectedLocation.storedItem.systemCode}
                itemCode={selectedLocation.storedItem.itemCode}
                weight={selectedLocation.storedItem.weight}
                location={selectedLocation.code}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Visual Dialog */}
      <Dialog open={showVisualDialog} onOpenChange={setShowVisualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Location Details</DialogTitle>
          </DialogHeader>
          {selectedLocation && (
            <BayVisualizer
              location={selectedLocation}
              onConfirm={handleLocationConfirm}
              mode="view"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
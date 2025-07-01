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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { subscribeToLocations } from '@/lib/firebase/locations';
import { getItemsByLocation } from '@/lib/firebase/items';
import { generateBulkLocationZPL, type LocationLabelData } from '@/lib/zpl-generator';
import { sendZPL } from '@/lib/printer-service';
import { Grid2X2, Search, Filter, QrCode, RefreshCcw, Printer, PrinterIcon, Ruler, List, Grid3X3, Package } from 'lucide-react';
import { BarcodePrint } from '@/components/barcode-print';
import { BayVisualizer } from '@/components/bay-visualizer';
import { LocationBarcodePrint } from '@/components/location-barcode-print';
import { WarehouseLayout } from '@/components/warehouse-layout';
import { getLocationHeight, RACK_TYPES } from '@/lib/warehouse-logic';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Location } from '@/types/warehouse';
import type { Item } from '@/types/warehouse';

interface LocationWithItems extends Location {
  items?: Item[];
}

export default function LocationsPage() {
  const { user, authLoading } = useFirebase();
  const [locations, setLocations] = useState<LocationWithItems[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'code' | 'row' | 'bay' | 'level' | 'rackType'>('code');
  const [selectedLocation, setSelectedLocation] = useState<LocationWithItems | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showLocationBarcodeDialog, setShowLocationBarcodeDialog] = useState(false);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [showBulkPrintDialog, setShowBulkPrintDialog] = useState(false);
  const [selectedLocationsForPrint, setSelectedLocationsForPrint] = useState<Location[]>([]);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'graphic'>('list');
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user && !authLoading) {
      // Set up real-time subscription to locations
      const unsubscribe = subscribeToLocations(async (fetchedLocations) => {
        try {
          // Load items for all locations that have weight
          const locationsWithItems = await Promise.all(
            fetchedLocations.map(async (location) => {
              if (location.currentWeight > 0) {
                try {
                  const items = await getItemsByLocation(location.code);
                  return {
                    ...location,
                    items: items
                  };
                } catch (error) {
                  console.error(`Error loading items for location ${location.code}:`, error);
                  return {
                    ...location,
                    items: []
                  };
                }
              }
              return {
                ...location,
                items: []
              };
            })
          );

          setLocations(locationsWithItems);
          setLoading(false);
        } catch (error) {
          console.error('Error processing locations:', error);
          setLocations(fetchedLocations.map(loc => ({ ...loc, items: [] })));
          setLoading(false);
        }
      });

      return () => unsubscribe();
    }
  }, [user, authLoading]);

  useEffect(() => {
    filterLocations();
  }, [search, filterType, locations]);

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
        case 'rackType':
          return (location.rackType || 'standard').toLowerCase().includes(searchLower);
        default:
          return false;
      }
    });

    setFilteredLocations(filtered);
  };

  const loadItemsForLocation = async (location: LocationWithItems) => {
    if (location.currentWeight === 0) {
      toast.info('No items at this location');
      return;
    }

    setLoadingItems(prev => ({ ...prev, [location.id]: true }));
    
    try {
      const items = await getItemsByLocation(location.code);
      
      if (items.length === 0) {
        toast.warning(`No items found at location ${location.code}`);
        return;
      }

      // Update the location with loaded items
      setLocations(prev => prev.map(loc => 
        loc.id === location.id ? { ...loc, items } : loc
      ));

      toast.success(`Found ${items.length} item(s) at ${location.code}`);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Failed to load items for this location');
    } finally {
      setLoadingItems(prev => ({ ...prev, [location.id]: false }));
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

  const handleLocationSelect = (location: LocationWithItems) => {
    setSelectedLocation(location);
    setShowVisualDialog(true);
  };

  const handleLocationConfirm = () => {
    if (selectedLocation) {
      toast.success(`Location ${selectedLocation.code} selected`);
      setShowVisualDialog(false);
    }
  };

  const handleShowItemBarcode = async (location: LocationWithItems) => {
    // If items are already loaded, show them
    if (location.items && location.items.length > 0) {
      if (location.items.length === 1) {
        setSelectedItem(location.items[0]);
        setShowBarcodeDialog(true);
      } else {
        // Multiple items - show selection dialog or first item
        setSelectedItem(location.items[0]);
        setShowBarcodeDialog(true);
        toast.info(`Showing barcode for first item. Location has ${location.items.length} items.`);
      }
      return;
    }

    // Load items if not already loaded
    await loadItemsForLocation(location);
    
    // After loading, check if we have items
    const updatedLocation = locations.find(loc => loc.id === location.id);
    if (updatedLocation?.items && updatedLocation.items.length > 0) {
      setSelectedItem(updatedLocation.items[0]);
      setShowBarcodeDialog(true);
    }
  };

  const handlePrintAllLocations = () => {
    setSelectedLocationsForPrint(locations);
    setShowBulkPrintDialog(true);
  };

  const handlePrintFilteredLocations = () => {
    setSelectedLocationsForPrint(filteredLocations);
    setShowBulkPrintDialog(true);
  };

  const handleBulkPrint = async () => {
    if (selectedLocationsForPrint.length === 0) {
      toast.error('No locations selected for printing');
      return;
    }

    setBulkPrinting(true);
    try {
      // Convert locations to label data
      const labelData: LocationLabelData[] = selectedLocationsForPrint.map(location => ({
        code: location.code,
        row: location.row,
        bay: location.bay,
        level: location.level,
        height: getLocationHeight(location),
        maxWeight: location.maxWeight,
        currentWeight: location.currentWeight,
        rackType: RACK_TYPES[location.rackType as keyof typeof RACK_TYPES]?.name || location.rackType || 'Standard',
      }));

      // Generate bulk ZPL
      const zpl = generateBulkLocationZPL(labelData);
      
      // Send to printer
      await sendZPL(zpl);
      
      toast.success(`Successfully sent ${selectedLocationsForPrint.length} location labels to printer`);
      setShowBulkPrintDialog(false);
    } catch (error) {
      console.error('Bulk print error:', error);
      toast.error(`Bulk print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBulkPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Locations</h1>
        <div className="flex gap-2">
          <Button onClick={handlePrintAllLocations} variant="outline">
            <PrinterIcon className="h-4 w-4 mr-2" />
            Print All Barcodes
          </Button>
          <Badge variant="outline" className="px-3 py-1">
            {locations.length} locations
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid2X2 className="h-5 w-5" />
            Location Management
          </CardTitle>
          <CardDescription>
            View and manage storage locations with height and rack type information. Print ZPL barcodes directly to your Zebra printer.
            {loading && <span className="text-blue-600"> • Updating...</span>}
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
                <SelectItem value="rackType">Rack Type</SelectItem>
              </SelectContent>
            </Select>
            {filteredLocations.length !== locations.length && (
              <Button onClick={handlePrintFilteredLocations} variant="outline">
                <PrinterIcon className="h-4 w-4 mr-2" />
                Print Filtered ({filteredLocations.length})
              </Button>
            )}
          </div>

          <Tabs value={viewMode} onValueChange={(value: 'list' | 'graphic') => setViewMode(value)}>
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

            <TabsContent value="list" className="mt-6">
              {loading && locations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  Loading locations...
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {locations.length === 0 ? (
                    <div>
                      <Grid2X2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No locations found</p>
                      <p className="text-sm">Create locations in the Setup page to get started.</p>
                    </div>
                  ) : (
                    <div>
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No locations match your search</p>
                      <p className="text-sm">Try adjusting your search terms or filter.</p>
                    </div>
                  )}
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
                        <TableHead>Height</TableHead>
                        <TableHead>Rack Type</TableHead>
                        <TableHead>Weight Status</TableHead>
                        <TableHead>Max Weight</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                            <div className="flex items-center gap-1">
                              <Ruler className="h-3 w-3 text-muted-foreground" />
                              {getLocationHeight(location)}m
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {RACK_TYPES[location.rackType as keyof typeof RACK_TYPES]?.name || location.rackType || 'Standard'}
                            </Badge>
                          </TableCell>
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
                          <TableCell>
                            {location.currentWeight > 0 ? (
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3 text-blue-500" />
                                <span className="text-sm">
                                  {location.items ? location.items.length : '?'} item(s)
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Empty</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLocationSelect(location)}
                            >
                              View Location
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLocation(location);
                                setShowLocationBarcodeDialog(true);
                              }}
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              Location Barcode
                            </Button>
                            {location.currentWeight > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowItemBarcode(location)}
                                disabled={loadingItems[location.id]}
                              >
                                <QrCode className="h-4 w-4 mr-2" />
                                {loadingItems[location.id] ? 'Loading...' : 'Item Barcode'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="graphic" className="mt-6">
              {loading && locations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  Loading warehouse layout...
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {locations.length === 0 ? (
                    <div>
                      <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No locations to display</p>
                      <p className="text-sm">Create locations in the Setup page to see the warehouse layout.</p>
                    </div>
                  ) : (
                    <div>
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No locations match your search</p>
                      <p className="text-sm">Try adjusting your search terms or filter to see locations in the graphic view.</p>
                    </div>
                  )}
                </div>
              ) : (
                <WarehouseLayout
                  locations={filteredLocations}
                  onLocationSelect={handleLocationSelect}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Item Barcode Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Barcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedItem && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-medium">{selectedItem.itemCode}</h3>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                  <p className="text-sm">Weight: {selectedItem.weight}kg</p>
                  <p className="text-xs text-muted-foreground">System Code: {selectedItem.systemCode}</p>
                </div>
                <BarcodePrint value={selectedItem.systemCode} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Barcode Dialog */}
      <Dialog open={showLocationBarcodeDialog} onOpenChange={setShowLocationBarcodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Location Barcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLocation && (
              <LocationBarcodePrint location={selectedLocation} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Print Confirmation Dialog */}
      <Dialog open={showBulkPrintDialog} onOpenChange={setShowBulkPrintDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print Location Barcodes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              You are about to print <strong>{selectedLocationsForPrint.length}</strong> location barcodes.
              This will send ZPL commands directly to your configured Zebra printer.
            </p>
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Print Details:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Labels will be printed on 103x103mm labels</li>
                <li>• Each label will be on a separate page</li>
                <li>• ZPL commands will be sent directly to the printer</li>
                <li>• Ensure your printer is ready and has sufficient labels</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleBulkPrint} 
                className="flex-1"
                disabled={bulkPrinting}
              >
                <Printer className="h-4 w-4 mr-2" />
                {bulkPrinting ? 'Printing...' : 'Print All Barcodes'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowBulkPrintDialog(false)}
                disabled={bulkPrinting}
              >
                Cancel
              </Button>
            </div>
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Height</div>
                  <div className="font-medium">{getLocationHeight(selectedLocation)}m</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Rack Type</div>
                  <div className="font-medium">
                    {RACK_TYPES[selectedLocation.rackType as keyof typeof RACK_TYPES]?.name || selectedLocation.rackType || 'Standard'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Items</div>
                  <div className="font-medium">
                    {selectedLocation.items ? selectedLocation.items.length : 0} item(s)
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Weight</div>
                  <div className="font-medium">
                    {selectedLocation.currentWeight}kg / {selectedLocation.maxWeight === Infinity ? 'Unlimited' : `${selectedLocation.maxWeight}kg`}
                  </div>
                </div>
              </div>
              
              {selectedLocation.items && selectedLocation.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Items at this location:</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedLocation.items.map((item) => (
                      <div key={item.id} className="p-2 bg-muted rounded text-sm">
                        <div className="font-medium">{item.itemCode}</div>
                        <div className="text-muted-foreground">{item.description}</div>
                        <div className="text-xs">Weight: {item.weight}kg</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <BayVisualizer
                location={selectedLocation}
                onConfirm={handleLocationConfirm}
                mode="view"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
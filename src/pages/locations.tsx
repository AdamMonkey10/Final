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
import { subscribeToLocations } from '@/lib/firebase/locations';
import { getItemsByLocation } from '@/lib/firebase/items';
import { Grid2X2, Search, Filter, QrCode, RefreshCcw, Printer, PrinterIcon } from 'lucide-react';
import { BarcodePrint } from '@/components/barcode-print';
import { BayVisualizer } from '@/components/bay-visualizer';
import { LocationBarcodePrint } from '@/components/location-barcode-print';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Location } from '@/types/warehouse';
import type { Item } from '@/types/warehouse';

interface LocationWithItem extends Location {
  storedItem?: Item;
}

export default function LocationsPage() {
  const { user, authLoading } = useFirebase();
  const [locations, setLocations] = useState<LocationWithItem[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'code' | 'row' | 'bay' | 'level'>('code');
  const [selectedLocation, setSelectedLocation] = useState<LocationWithItem | null>(null);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showLocationBarcodeDialog, setShowLocationBarcodeDialog] = useState(false);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [showBulkPrintDialog, setShowBulkPrintDialog] = useState(false);
  const [selectedLocationsForPrint, setSelectedLocationsForPrint] = useState<Location[]>([]);

  useEffect(() => {
    if (user && !authLoading) {
      // Set up real-time subscription to locations
      const unsubscribe = subscribeToLocations(async (fetchedLocations) => {
        try {
          // Fetch items for each location that has weight
          const locationsWithItems = await Promise.all(
            fetchedLocations.map(async (location) => {
              if (location.currentWeight > 0) {
                try {
                  const items = await getItemsByLocation(location.code);
                  return {
                    ...location,
                    storedItem: items[0] // Assume one item per location for now
                  };
                } catch (error) {
                  console.error(`Error loading items for location ${location.code}:`, error);
                  return location;
                }
              }
              return location;
            })
          );

          setLocations(locationsWithItems);
          setLoading(false);
        } catch (error) {
          console.error('Error processing locations:', error);
          setLocations(fetchedLocations);
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
        default:
          return false;
      }
    });

    setFilteredLocations(filtered);
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

  const handlePrintAllLocations = () => {
    setSelectedLocationsForPrint(locations);
    setShowBulkPrintDialog(true);
  };

  const handlePrintFilteredLocations = () => {
    setSelectedLocationsForPrint(filteredLocations);
    setShowBulkPrintDialog(true);
  };

  const handleBulkPrint = () => {
    if (selectedLocationsForPrint.length === 0) {
      toast.error('No locations selected for printing');
      return;
    }

    // Create a new window for bulk printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Failed to open print window');
      return;
    }

    // Generate content for all location barcodes
    const barcodePromises = selectedLocationsForPrint.map(location => {
      return new Promise<string>((resolve) => {
        const svg = document.createElement('svg');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
        script.onload = () => {
          // @ts-ignore
          window.JsBarcode(svg, location.code, {
            format: 'CODE128',
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 14,
            margin: 8,
          });
          resolve(svg.outerHTML);
        };
        document.head.appendChild(script);
      });
    });

    Promise.all(barcodePromises).then(barcodes => {
      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Location Barcodes - ${selectedLocationsForPrint.length} locations</title>
            <style>
              body { 
                margin: 0; 
                padding: 20px;
                font-family: system-ui, -apple-system, sans-serif;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                max-width: 1200px;
                margin: 0 auto;
              }
              .location-card {
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                background: white;
                break-inside: avoid;
              }
              .barcode svg {
                max-width: 100%;
                height: auto;
              }
              .code {
                font-size: 18px;
                font-weight: bold;
                margin: 10px 0;
              }
              .details {
                font-size: 12px;
                color: #6b7280;
                line-height: 1.4;
              }
              .weight-info {
                margin-top: 8px;
                padding: 6px;
                background: #f3f4f6;
                border-radius: 4px;
                font-size: 11px;
              }
              @media print {
                body { margin: 0; padding: 10px; }
                .grid { gap: 15px; }
                .location-card { 
                  border: 1px solid #000;
                  margin-bottom: 15px;
                }
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${selectedLocationsForPrint.map((location, index) => `
                <div class="location-card">
                  <div class="barcode">
                    ${barcodes[index]}
                  </div>
                  <div class="code">${location.code}</div>
                  <div class="details">
                    Row ${location.row} • Bay ${location.bay} • Level ${location.level === '0' ? 'Ground' : location.level}
                  </div>
                  <div class="weight-info">
                    ${location.level === '0' ? 'Ground Level' : `Max: ${location.maxWeight}kg`}
                    ${location.currentWeight > 0 ? ` • Current: ${location.currentWeight}kg` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 1000);
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(content);
      printWindow.document.close();
    });

    setShowBulkPrintDialog(false);
    toast.success(`Printing ${selectedLocationsForPrint.length} location barcodes`);
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
            Location List
          </CardTitle>
          <CardDescription>
            View and manage storage locations. Print barcodes for scanning workflow.
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
              </SelectContent>
            </Select>
            {filteredLocations.length !== locations.length && (
              <Button onClick={handlePrintFilteredLocations} variant="outline">
                <PrinterIcon className="h-4 w-4 mr-2" />
                Print Filtered ({filteredLocations.length})
              </Button>
            )}
          </div>

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
                    <TableHead>Weight Status</TableHead>
                    <TableHead>Max Weight</TableHead>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLocation(location);
                            setShowLocationBarcodeDialog(true);
                          }}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Print Barcode
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

      {/* Item Barcode Dialog */}
      <Dialog open={showBarcodeDialog} onOpenChange={setShowBarcodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Barcode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLocation?.storedItem && (
              <BarcodePrint value={selectedLocation.storedItem.systemCode} />
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
              This will open a new window with all barcodes formatted for printing.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleBulkPrint} className="flex-1">
                <Printer className="h-4 w-4 mr-2" />
                Print All Barcodes
              </Button>
              <Button variant="outline" onClick={() => setShowBulkPrintDialog(false)}>
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
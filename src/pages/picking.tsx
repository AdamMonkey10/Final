import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { QrCode, RefreshCcw, Package, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { getItems, updateItem } from '@/lib/firebase/items';
import { getLocationByCode, updateLocation, getLocations } from '@/lib/firebase/locations';
import { subscribeToActions, updateAction, deleteAction } from '@/lib/firebase/actions';
import { DepartmentDialog } from '@/components/department-dialog';
import { ActionCard } from '@/components/action-card';
import { InventoryCard } from '@/components/inventory-card';
import { LocationSelector } from '@/components/location-selector';
import { BayVisualizer } from '@/components/bay-visualizer';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Item } from '@/types/warehouse';
import type { WarehouseAction } from '@/lib/firebase/actions';
import type { Location } from '@/types/warehouse';

export default function PickingPage() {
  const { user, authLoading } = useFirebase();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [actionList, setActionList] = useState<WarehouseAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<WarehouseAction | null>(null);
  const [suggestedLocations, setSuggestedLocations] = useState<Record<string, string>>({});
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (user && !authLoading) {
      loadItems();
      const unsubscribe = subscribeToActions(async (actions) => {
        setActionList(actions);
        for (const action of actions) {
          if (action.actionType === 'in' && !suggestedLocations[action.id]) {
            setSuggestedLocations(prev => ({
              ...prev,
              [action.id]: action.location || ''
            }));
          }
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (showLocationDialog) {
      loadLocations();
    }
  }, [showLocationDialog]);

  const loadItems = async () => {
    if (!user || authLoading) return;
    
    try {
      const fetchedItems = await getItems();
      const placedItems = fetchedItems.filter(item => item.status === 'placed');
      setItems(placedItems);
      setFilteredItems(placedItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load items');
    }
  };

  const loadLocations = async () => {
    try {
      const locations = await getLocations();
      setAvailableLocations(locations);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('scanInput') as HTMLInputElement;
    const scannedCode = input.value.trim();
    form.reset();

    if (!selectedAction || !selectedLocation) {
      toast.error('No action or location selected');
      return;
    }

    try {
      if (scannedCode !== selectedAction.systemCode) {
        toast.error('Invalid item scanned');
        return;
      }

      await updateLocation(selectedLocation.id, {
        currentWeight: selectedAction.actionType === 'in' 
          ? (selectedLocation.currentWeight || 0) + selectedAction.weight
          : Math.max(0, (selectedLocation.currentWeight || 0) - selectedAction.weight)
      });

      await updateItem(selectedAction.itemId, {
        status: selectedAction.actionType === 'out' ? 'removed' : 'placed',
        location: selectedAction.actionType === 'out' ? null : selectedLocation.code,
        locationVerified: true
      });

      await updateAction(selectedAction.id, {
        status: 'completed',
        location: selectedLocation.code
      });

      toast.success(`Item ${selectedAction.actionType === 'in' ? 'placed' : 'picked'} successfully`);
      setShowScanDialog(false);
      setShowVisualDialog(false);
      setSelectedAction(null);
      setSelectedLocation(null);

    } catch (error) {
      console.error('Error processing scan:', error);
      toast.error('Failed to process scan');
    }
  };

  const handleLocationSelect = async (location: Location) => {
    if (!selectedAction) return;
    setSelectedLocation(location);
    setShowLocationDialog(false);
    setShowVisualDialog(true);
  };

  const handleLocationConfirm = () => {
    setShowVisualDialog(false);
    setShowScanDialog(true);
  };

  const handleActionSelect = async (action: WarehouseAction) => {
    setSelectedAction(action);
    if (action.location) {
      // For existing location, show the bay visualizer directly
      const location = await getLocationByCode(action.location);
      if (location) {
        setSelectedLocation(location);
        setShowVisualDialog(true);
      } else {
        toast.error('Location not found');
      }
    } else {
      // For new location selection
      setShowLocationDialog(true);
    }
  };

  const handleAddToActionList = (item: Item) => {
    setSelectedItem(item);
    setShowDepartmentDialog(true);
  };

  const handleDeleteAction = async (action: WarehouseAction) => {
    try {
      await deleteAction(action.id);
      toast.success('Action removed');
    } catch (error) {
      console.error('Error deleting action:', error);
      toast.error('Failed to remove action');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Warehouse Actions</h1>
        <Button onClick={() => setLoading(true)} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="actions">
        <TabsList className="w-full">
          <TabsTrigger value="actions" className="flex-1 flex items-center justify-center gap-2">
            <Truck className="h-4 w-4" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="search" className="flex-1 flex items-center justify-center gap-2">
            <Package className="h-4 w-4" />
            Add Items
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Current Actions
              </CardTitle>
              <CardDescription>
                Pending actions for goods in and picking ({actionList.length} items)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionList.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No pending actions. Add items from the search tab or process incoming goods.
                </div>
              ) : (
                <div className="space-y-4">
                  {actionList.map((action) => (
                    <ActionCard 
                      key={action.id} 
                      action={action}
                      suggestedLocations={suggestedLocations}
                      onActionSelect={handleActionSelect}
                      onShowLocations={() => {
                        setSelectedAction(action);
                        setShowLocationDialog(true);
                      }}
                      onDeleteAction={handleDeleteAction}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Add Items to Pick List
              </CardTitle>
              <CardDescription>
                Search and add items for picking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No items found matching your search.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {filteredItems.map((item) => (
                    <InventoryCard 
                      key={item.id} 
                      item={item}
                      onAddToList={handleAddToActionList}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Location Selection Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAction?.actionType === 'in' ? 'Select Location' : 'Pick Location'}
            </DialogTitle>
          </DialogHeader>
          <LocationSelector
            locations={availableLocations}
            onLocationSelect={handleLocationSelect}
          />
        </DialogContent>
      </Dialog>

      {/* Visual Confirmation Dialog */}
      <Dialog open={showVisualDialog} onOpenChange={setShowVisualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Location</DialogTitle>
          </DialogHeader>
          {selectedLocation && (
            <BayVisualizer
              location={selectedLocation}
              onConfirm={handleLocationConfirm}
              mode={selectedAction?.actionType === 'in' ? 'place' : 'pick'}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Scan Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Scan Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleScan} className="space-y-4">
            <div className="relative">
              <QrCode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                name="scanInput"
                placeholder="Scan item barcode..."
                className="pl-9"
                autoComplete="off"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Verify Item
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Department Dialog */}
      {showDepartmentDialog && selectedItem && (
        <DepartmentDialog
          open={showDepartmentDialog}
          onOpenChange={setShowDepartmentDialog}
          item={selectedItem}
          onComplete={() => {
            setSelectedItem(null);
            loadItems();
          }}
        />
      )}
    </div>
  );
}
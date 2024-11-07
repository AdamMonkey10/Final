import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Warehouse, Clock, ArrowDownToLine, ArrowUpFromLine, QrCode, MapPin } from 'lucide-react';
import { getItems } from '@/lib/firebase/items';
import { getLocations, getLocationByCode } from '@/lib/firebase/locations';
import { getPendingActions } from '@/lib/firebase/actions';
import { getMovements } from '@/lib/firebase/movements';
import { ThemeToggle } from '@/components/theme-toggle';
import { FullscreenToggle } from '@/components/fullscreen-toggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BayVisualizer } from '@/components/bay-visualizer';
import { startOfHour, startOfDay, startOfWeek, isWithinInterval, subHours, subDays, subWeeks } from 'date-fns';
import type { Item, Location, Movement } from '@/types/warehouse';
import type { WarehouseAction } from '@/lib/firebase/actions';

interface LocationStats {
  total: number;
  empty: number;
  occupied: number;
  occupancyRate: number;
}

interface MovementMetrics {
  hourly: {
    in: number;
    out: number;
  };
  daily: {
    in: number;
    out: number;
  };
  weekly: {
    in: number;
    out: number;
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStats>({
    total: 0,
    empty: 0,
    occupied: 0,
    occupancyRate: 0
  });
  const [pendingActions, setPendingActions] = useState<WarehouseAction[]>([]);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [movementMetrics, setMovementMetrics] = useState<MovementMetrics>({
    hourly: { in: 0, out: 0 },
    daily: { in: 0, out: 0 },
    weekly: { in: 0, out: 0 }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedItems, fetchedLocations, fetchedActions, fetchedMovements] = await Promise.all([
          getItems(),
          getLocations(),
          getPendingActions(),
          getMovements()
        ]);

        setItems(fetchedItems);
        setPendingActions(fetchedActions);

        // Calculate location statistics
        const stats = fetchedLocations.reduce((acc, location) => {
          acc.total++;
          if (location.currentWeight === 0) {
            acc.empty++;
          } else {
            acc.occupied++;
          }
          return acc;
        }, { total: 0, empty: 0, occupied: 0 });

        setLocationStats({
          ...stats,
          occupancyRate: (stats.occupied / stats.total) * 100
        });

        // Calculate movement metrics
        const now = new Date();
        const hourAgo = subHours(now, 1);
        const dayAgo = subDays(now, 1);
        const weekAgo = subWeeks(now, 1);

        const metrics = fetchedMovements.reduce((acc, movement) => {
          const timestamp = movement.timestamp.toDate();
          const isIn = movement.type === 'IN';

          // Hourly metrics
          if (isWithinInterval(timestamp, { start: hourAgo, end: now })) {
            if (isIn) acc.hourly.in++;
            else acc.hourly.out++;
          }

          // Daily metrics
          if (isWithinInterval(timestamp, { start: dayAgo, end: now })) {
            if (isIn) acc.daily.in++;
            else acc.daily.out++;
          }

          // Weekly metrics
          if (isWithinInterval(timestamp, { start: weekAgo, end: now })) {
            if (isIn) acc.weekly.in++;
            else acc.weekly.out++;
          }

          return acc;
        }, {
          hourly: { in: 0, out: 0 },
          daily: { in: 0, out: 0 },
          weekly: { in: 0, out: 0 }
        });

        setMovementMetrics(metrics);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('scanInput') as HTMLInputElement;
    const scannedCode = input.value.trim();
    form.reset();

    // Find item by system code
    const item = items.find(i => i.systemCode === scannedCode);
    
    if (item?.location) {
      const location = await getLocationByCode(item.location);
      if (location) {
        setSelectedLocation(location);
        setShowScanDialog(false);
        setShowLocationDialog(true);
      } else {
        toast.error('Location not found');
      }
    } else {
      toast.error('Item location not found');
    }
  };

  // Get counts
  const placedItems = items.filter(item => item.status === 'placed').length;
  const pendingTasks = pendingActions.length;
  const incomingItems = pendingActions.filter(a => a.actionType === 'in').length;
  const pickingTasks = pendingActions.filter(a => a.actionType === 'out').length;

  // Group picking tasks by department
  const departmentTasks = pendingActions
    .filter(a => a.actionType === 'out')
    .reduce((acc, action) => {
      const dept = action.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="relative space-y-6 min-h-[calc(100vh-4rem)]">
      {/* Background Logo */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] dark:opacity-[0.02] -z-10">
        <svg className="w-full max-w-7xl" viewBox="0 0 128.7 58.3" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path d="m26.7 15.5v-6.4c0-.7-.4-1.1-1.2-1.3h6.3c2 0 3.7.2 5.2.6 1.4.4 2.5.9 3.2 1.6s1.1 1.5 1.1 2.4c-.1.8-.4 1.5-1.2 2.1-.7.7-1.8 1.2-3.2 1.6s-3.2.6-5.4.6h-6v-.1c.8 0 1.2-.5 1.2-1.1zm84.2 11.8c0-.6.3-1 .9-1.4s1.3-.6 2.2-.8 2-.3 3.1-.3 2.3.1 3.5.3v1.6c-.5-.3-1.2-.5-1.8-.7-.7-.2-1.4-.2-2.1-.2s-1.4.1-2 .3c-.5.2-.9.4-1 .7 0 .1-.1.2-.1.3 0 .4.3.8.9 1 .6.3 1.4.5 2.4.8l2 .6c.8.2 1.5.5 2.1.9s.9.9.9 1.4c-.1.6-.4 1.1-1 1.5s-1.4.8-2.4 1-2.2.4-3.4.4-2.6-.1-4-.4l-.7-1.8c.8.4 1.6.7 2.5.9s1.8.3 2.6.3c1 0 1.8-.2 2.6-.4s1.2-.6 1.2-1.1c0-.7-.8-1.2-2.4-1.6l-2.8-.8c-.5-.2-1-.3-1.5-.6-.5-.2-.9-.5-1.2-.8s-.5-.7-.5-1.1z" />
        </svg>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <FullscreenToggle />
            <ThemeToggle />
          </div>
        </div>

        <Button 
          size="lg" 
          className="w-full h-16 text-lg flex items-center justify-center gap-2"
          onClick={() => setShowScanDialog(true)}
        >
          <MapPin className="h-6 w-6" />
          Find Item Location
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/inventory" className="transition-transform hover:scale-[1.02]">
          <Card className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{placedItems}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Items in warehouse
              </div>
              <div className="h-1 w-full bg-muted mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all" 
                  style={{ width: `${Math.min(100, (placedItems / 1000) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/locations" className="transition-transform hover:scale-[1.02]">
          <Card className="hover:bg-blue-500/5 dark:hover:bg-blue-500/10 transition-colors border-2 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Location Status</CardTitle>
              <Warehouse className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {Math.round(locationStats.occupancyRate)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {locationStats.occupied} Used / {locationStats.empty} Empty
              </div>
              <div className="h-1 w-full bg-muted mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all" 
                  style={{ width: `${locationStats.occupancyRate}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/picking" className="transition-transform hover:scale-[1.02]">
          <Card className="hover:bg-yellow-500/5 dark:hover:bg-yellow-500/10 transition-colors border-2 border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {pendingTasks}
              </div>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">{pickingTasks}</span> picks
                  {incomingItems > 0 && (
                    <> / <span className="font-medium">{incomingItems}</span> placements</>
                  )}
                </div>
                {Object.entries(departmentTasks).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {Object.entries(departmentTasks).map(([dept, count]) => (
                      <div key={dept} className="flex justify-between">
                        <span>{dept}:</span>
                        <span className="font-medium">{count} items</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="h-1 w-full bg-muted mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all" 
                  style={{ 
                    width: `${Math.min(100, (pendingTasks / 50) * 100)}%` 
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </Link>

        <div className="md:col-span-2 lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Movement Analysis</CardTitle>
              <div className="flex gap-2">
                <ArrowDownToLine className="h-4 w-4 text-blue-500" />
                <ArrowUpFromLine className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Last Hour</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-2">
                      <div className="text-2xl font-bold text-blue-500">{movementMetrics.hourly.in}</div>
                      <div className="text-xs text-muted-foreground">Placed</div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-2xl font-bold text-orange-500">{movementMetrics.hourly.out}</div>
                      <div className="text-xs text-muted-foreground">Picked</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Last 24 Hours</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-2">
                      <div className="text-2xl font-bold text-blue-500">{movementMetrics.daily.in}</div>
                      <div className="text-xs text-muted-foreground">Placed</div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-2xl font-bold text-orange-500">{movementMetrics.daily.out}</div>
                      <div className="text-xs text-muted-foreground">Picked</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Last 7 Days</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-2">
                      <div className="text-2xl font-bold text-blue-500">{movementMetrics.weekly.in}</div>
                      <div className="text-xs text-muted-foreground">Placed</div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-2xl font-bold text-orange-500">{movementMetrics.weekly.out}</div>
                      <div className="text-xs text-muted-foreground">Picked</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scan Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Find Item Location</DialogTitle>
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
              Find Location
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Location</DialogTitle>
          </DialogHeader>
          {selectedLocation && (
            <BayVisualizer
              location={selectedLocation}
              onConfirm={() => setShowLocationDialog(false)}
              mode="view"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
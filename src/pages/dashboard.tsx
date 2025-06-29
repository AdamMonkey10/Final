import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Warehouse, QrCode, MapPin, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getItems, getItemsByStatus } from '@/lib/firebase/items';
import { getLocations, getLocationByCode } from '@/lib/firebase/locations';
import { getMovements } from '@/lib/firebase/movements';
import { ThemeToggle } from '@/components/theme-toggle';
import { FullscreenToggle } from '@/components/fullscreen-toggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BayVisualizer } from '@/components/bay-visualizer';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { startOfHour, startOfDay, startOfWeek, isWithinInterval, subHours, subDays, subWeeks } from 'date-fns';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Item, Location, Movement } from '@/types/warehouse';

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
  const { user } = useFirebase();
  const { showInstructions } = useInstructions();
  const [items, setItems] = useState<Item[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStats>({
    total: 0,
    empty: 0,
    occupied: 0,
    occupancyRate: 0
  });
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
      if (!user) return;
      
      try {
        const [fetchedItems, fetchedLocations, fetchedMovements] = await Promise.all([
          getItemsByStatus('placed'),
          getLocations(),
          getMovements()
        ]);

        setItems(fetchedItems);

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
          occupancyRate: stats.total > 0 ? (stats.occupied / stats.total) * 100 : 0
        });

        const now = new Date();
        const hourAgo = subHours(now, 1);
        const dayAgo = subDays(now, 1);
        const weekAgo = subWeeks(now, 1);

        const metrics = fetchedMovements.reduce((acc, movement) => {
          const timestamp = movement.timestamp.toDate();
          const isIn = movement.type === 'IN';

          if (isWithinInterval(timestamp, { start: hourAgo, end: now })) {
            if (isIn) acc.hourly.in++;
            else acc.hourly.out++;
          }

          if (isWithinInterval(timestamp, { start: dayAgo, end: now })) {
            if (isIn) acc.daily.in++;
            else acc.daily.out++;
          }

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
  }, [user]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('scanInput') as HTMLInputElement;
    const scannedCode = input.value.trim();
    form.reset();

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

  const placedItems = items.length;

  const instructionSteps = [
    {
      title: "Quick Item Search",
      description: "Use 'Find Item Location' to quickly locate any item in the warehouse by scanning its barcode.",
      type: "info" as const
    },
    {
      title: "Scan Items",
      description: "Click 'Scan Items' to access the full scanning interface for placing and picking items.",
      type: "info" as const
    },
    {
      title: "Monitor Activity",
      description: "The Recent Activity card shows warehouse movements for the last hour, day, and week.",
      type: "tip" as const
    },
    {
      title: "Location Status",
      description: "The Location Status card shows how many warehouse locations are currently in use.",
      type: "tip" as const
    },
    {
      title: "Navigation",
      description: "Click on any card to navigate to that section for more detailed operations.",
      type: "success" as const
    }
  ];

  return (
    <div className="relative space-y-6 min-h-[calc(100vh-4rem)]">
      {/* Background Logo */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] dark:opacity-[0.02] -z-10">
        <svg className="w-full max-w-7xl" viewBox="0 0 128.7 58.3" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path d="m26.7 15.5v-6.4c0-.7-.4-1.1-1.2-1.3h6.3c2 0 3.7.2 5.2.6 1.4.4 2.5.9 3.2 1.6s1.1 1.5 1.1 2.4c-.1.8-.4 1.5-1.2 2.1-.7.7-1.8 1.2-3.2 1.6s-3.2.6-5.4.6h-6v-.1c.8 0 1.2-.5 1.2-1.1zm84.2 11.8c0-.6.3-1 .9-1.4s1.3-.6 2.2-.8 2-.3 3.1-.3 2.3.1 3.5.3v1.6c-.5-.3-1.2-.5-1.8-.7-.7-.2-1.4-.2-2.1-.2s-1.4.1-2 .3c-.5.2-.9.4-1 .7 0 .1-.1.2-.1.3 0 .4.3.8.9 1 .6.3 1.4.5 2.4.8l2 .6c.8.2 1.5.5 2.1.9s.9.9.9 1.4c-.1.6-.4 1.1-1 1.5s-1.4.8-2.4 1-2.2.4-3.4.4-2.6-.1-4-.4l-.7-1.8c.8.4 1.6.7 2.5.9s1.8.3 2.6.3c1 0 1.8-.2 2.6-.4s1.2-.6 1.2-1.1c0-.7-.8-1.2-2.4-1.6l-2.8-.8c-.5-.2-1-.3-1.5-.6-.5-.2-.9-.5-1.2-.8s-.5-.7-.5-1.1z" />
        </svg>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Dashboard Overview"
          description="Your central hub for warehouse operations. Get quick access to key functions and monitor warehouse activity."
          steps={instructionSteps}
          onClose={() => {}}
          className="mb-6"
        />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <FullscreenToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Button 
            size="lg" 
            className="h-16 text-lg flex items-center justify-center gap-2"
            onClick={() => setShowScanDialog(true)}
          >
            <MapPin className="h-6 w-6" />
            Find Item Location
          </Button>
          
          <Button 
            size="lg" 
            variant="outline"
            className="h-16 text-lg flex items-center justify-center gap-2"
            onClick={() => navigate('/scan')}
          >
            <QrCode className="h-6 w-6" />
            Scan Items
          </Button>
        </div>
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

        <div className="md:col-span-2 lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <div className="flex gap-2">
                <ArrowDownToLine className="h-4 w-4 text-blue-500" />
                <ArrowUpFromLine className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Hour</span>
                  <div className="flex gap-2">
                    <span className="text-sm font-medium text-blue-500">{movementMetrics.hourly.in} in</span>
                    <span className="text-sm font-medium text-orange-500">{movementMetrics.hourly.out} out</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Today</span>
                  <div className="flex gap-2">
                    <span className="text-sm font-medium text-blue-500">{movementMetrics.daily.in} in</span>
                    <span className="text-sm font-medium text-orange-500">{movementMetrics.daily.out} out</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">This Week</span>
                  <div className="flex gap-2">
                    <span className="text-sm font-medium text-blue-500">{movementMetrics.weekly.in} in</span>
                    <span className="text-sm font-medium text-orange-500">{movementMetrics.weekly.out} out</span>
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
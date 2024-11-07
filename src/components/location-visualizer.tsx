import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { getLocations } from '@/lib/firebase/locations';
import type { Location } from '@/types/warehouse';

interface LocationVisualizerProps {
  suggestedLocation: string;
  onLocationConfirm: () => void;
}

interface BayGroup {
  id: string;
  row: string;
  bay: string;
  locations: Location[];
  levelWeights: Record<string, { current: number; max: number }>;
}

export function LocationVisualizer({ suggestedLocation, onLocationConfirm }: LocationVisualizerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [bays, setBays] = useState<BayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const fetchedLocations = await getLocations();
      setLocations(fetchedLocations);
      
      // Group locations by bay
      const bayGroups = fetchedLocations.reduce((groups: Record<string, BayGroup>, loc) => {
        const bayId = `${loc.row}${loc.bay}`;
        if (!groups[bayId]) {
          groups[bayId] = {
            id: bayId,
            row: loc.row,
            bay: loc.bay,
            locations: [],
            levelWeights: {},
          };
        }
        groups[bayId].locations.push(loc);

        // Track weights by level
        if (!groups[bayId].levelWeights[loc.level]) {
          groups[bayId].levelWeights[loc.level] = { current: 0, max: loc.maxWeight };
        }
        groups[bayId].levelWeights[loc.level].current += loc.currentWeight;

        return groups;
      }, {});

      setBays(Object.values(bayGroups).sort((a, b) => {
        const rowCompare = a.row.localeCompare(b.row);
        if (rowCompare !== 0) return rowCompare;
        return a.bay.localeCompare(b.bay);
      }));
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeightStatusColor = (currentWeight: number, maxWeight: number) => {
    const ratio = currentWeight / maxWeight;
    if (ratio === 0) return 'bg-green-100 text-green-800';
    if (ratio >= 0.9) return 'bg-red-100 text-red-800';
    if (ratio >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const renderBayGrid = (bay: BayGroup) => {
    // Sort locations by level (descending) and then by location number
    const sortedLocations = [...bay.locations].sort((a, b) => {
      const levelDiff = parseInt(b.level) - parseInt(a.level);
      if (levelDiff !== 0) return levelDiff;
      return parseInt(a.location) - parseInt(b.location);
    });

    // Group locations by level
    const locationsByLevel = sortedLocations.reduce((acc, loc) => {
      if (!acc[loc.level]) acc[loc.level] = [];
      acc[loc.level].push(loc);
      return acc;
    }, {} as Record<string, Location[]>);

    // Sort levels in descending order (4 to 0)
    const sortedLevels = Object.keys(locationsByLevel).sort((a, b) => Number(b) - Number(a));

    return (
      <div key={bay.id} className="p-4 border rounded-lg">
        <div className="mb-2">
          <h3 className="font-semibold">
            Row {bay.row} - Bay {bay.bay}
          </h3>
        </div>
        <div className="space-y-4">
          {sortedLevels.map(level => (
            <div key={level} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>Level {level}</span>
                <span>
                  {bay.levelWeights[level].current}/{bay.levelWeights[level].max}kg
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {locationsByLevel[level].map((location) => {
                  const isTarget = location.code === suggestedLocation;
                  return (
                    <div
                      key={location.code}
                      className={`p-2 border rounded text-sm ${
                        isTarget ? 'ring-2 ring-primary' : ''
                      } ${getWeightStatusColor(location.currentWeight, location.maxWeight)}`}
                    >
                      <div className="font-medium flex items-center justify-between">
                        {location.code}
                        {isTarget && <MapPin className="h-4 w-4" />}
                      </div>
                      <div className="text-xs">
                        {location.currentWeight}/{location.maxWeight}kg
                      </div>
                      {isTarget && (
                        <Button 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={onLocationConfirm}
                        >
                          Place Here
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading warehouse layout...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Suggested Location</h3>
        <Badge variant="outline" className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          {suggestedLocation}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-2">
        {bays.map(bay => renderBayGrid(bay))}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Location } from '@/types/warehouse';

interface WarehouseLayoutProps {
  locations: Location[];
  onLocationSelect: (location: Location) => void;
  suggestedLocation?: Location | null;
  itemWeight?: number;
}

export function WarehouseLayout({ 
  locations, 
  onLocationSelect, 
  suggestedLocation,
  itemWeight = 0
}: WarehouseLayoutProps) {
  // Group locations by row and bay
  const locationGroups = locations.reduce((groups, location) => {
    const key = `${location.row}${location.bay}`;
    if (!groups[key]) {
      groups[key] = {
        row: location.row,
        bay: location.bay,
        locations: []
      };
    }
    groups[key].locations.push(location);
    return groups;
  }, {} as Record<string, { row: string; bay: string; locations: Location[] }>);

  // Sort groups by row then bay
  const sortedGroups = Object.values(locationGroups).sort((a, b) => {
    const rowCompare = a.row.localeCompare(b.row);
    if (rowCompare !== 0) return rowCompare;
    return parseInt(a.bay) - parseInt(b.bay);
  });

  const getLocationColor = (location: Location) => {
    const isSuggested = suggestedLocation?.code === location.code;
    const canAccept = location.level === '0' || (location.currentWeight + itemWeight <= location.maxWeight);
    
    if (isSuggested) {
      return 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600';
    }
    
    if (!canAccept) {
      return 'bg-red-100 text-red-800 border-red-300 cursor-not-allowed opacity-50';
    }
    
    if (location.currentWeight === 0) {
      return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200';
    }
    
    const ratio = location.currentWeight / location.maxWeight;
    if (location.maxWeight === Infinity) {
      return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
    }
    
    if (ratio >= 0.8) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200';
    }
    
    return 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200';
  };

  const getLocationStatus = (location: Location) => {
    const isSuggested = suggestedLocation?.code === location.code;
    const canAccept = location.level === '0' || (location.currentWeight + itemWeight <= location.maxWeight);
    
    if (isSuggested) return 'Recommended';
    if (!canAccept) return 'Full';
    if (location.currentWeight === 0) return 'Empty';
    if (location.maxWeight === Infinity) return 'In Use';
    
    const ratio = location.currentWeight / location.maxWeight;
    if (ratio >= 0.8) return 'Nearly Full';
    return 'Available';
  };

  const handleLocationClick = (location: Location) => {
    const canAccept = location.level === '0' || (location.currentWeight + itemWeight <= location.maxWeight);
    if (canAccept) {
      onLocationSelect(location);
    }
  };

  const renderBayGroup = (group: { row: string; bay: string; locations: Location[] }) => {
    // Sort locations by level (descending) and position
    const sortedLocations = [...group.locations].sort((a, b) => {
      const levelDiff = parseInt(b.level) - parseInt(a.level);
      if (levelDiff !== 0) return levelDiff;
      return parseInt(a.location) - parseInt(b.location);
    });

    // Group by level
    const locationsByLevel = sortedLocations.reduce((acc, loc) => {
      if (!acc[loc.level]) acc[loc.level] = [];
      acc[loc.level].push(loc);
      return acc;
    }, {} as Record<string, Location[]>);

    // Get levels in descending order
    const levels = Object.keys(locationsByLevel).sort((a, b) => parseInt(b) - parseInt(a));

    return (
      <Card key={`${group.row}${group.bay}`} className="p-4">
        <div className="text-center mb-3">
          <h3 className="font-semibold text-lg">
            Row {group.row} - Bay {group.bay}
          </h3>
        </div>
        
        <div className="space-y-3">
          {levels.map(level => (
            <div key={level} className="space-y-2">
              <div className="text-sm font-medium text-center">
                Level {level === '0' ? 'Ground' : level}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {locationsByLevel[level].map((location) => {
                  const isSuggested = suggestedLocation?.code === location.code;
                  const canAccept = location.level === '0' || (location.currentWeight + itemWeight <= location.maxWeight);
                  
                  return (
                    <div
                      key={location.code}
                      className={cn(
                        "p-3 border-2 rounded-lg text-center cursor-pointer transition-all duration-200 relative",
                        getLocationColor(location),
                        isSuggested && "ring-2 ring-blue-400 ring-offset-2"
                      )}
                      onClick={() => handleLocationClick(location)}
                      title={`${location.code} - ${getLocationStatus(location)}`}
                    >
                      {isSuggested && (
                        <Star className="absolute -top-2 -right-2 h-4 w-4 text-blue-600 bg-white rounded-full p-0.5" />
                      )}
                      
                      <div className="font-bold text-sm mb-1">
                        {location.code}
                      </div>
                      
                      <div className="text-xs">
                        {location.currentWeight}kg
                        {location.maxWeight !== Infinity && (
                          <span>/{location.maxWeight}kg</span>
                        )}
                      </div>
                      
                      <div className="text-xs mt-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs px-1 py-0",
                            isSuggested ? "bg-white text-blue-600" : ""
                          )}
                        >
                          {getLocationStatus(location)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold mb-2">Warehouse Layout</h3>
        <div className="flex justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Recommended</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Empty</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Nearly Full</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Full</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
        {sortedGroups.map(group => renderBayGroup(group))}
      </div>
      
      {suggestedLocation && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <div className="flex items-center justify-center gap-2 text-blue-800">
            <Star className="h-4 w-4" />
            <span className="text-sm font-medium">
              Recommended location: {suggestedLocation.code}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
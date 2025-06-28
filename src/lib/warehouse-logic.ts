import type { Location } from '@/types/warehouse';

// Weight limits per level (in kg)
export const LEVEL_MAX_WEIGHTS = {
  '0': Infinity, // Ground level - no weight limit for stacking
  '1': 1500,     // First level
  '2': 1000,     // Second level
  '3': 750,      // Third level
  '4': 500,      // Fourth level
};

// Standard rack heights per level (in meters)
export const STANDARD_RACK_HEIGHTS = {
  '0': 0,        // Ground level
  '1': 2.5,      // First level - 2.5m
  '2': 5.0,      // Second level - 5.0m
  '3': 7.5,      // Third level - 7.5m
  '4': 10.0,     // Fourth level - 10.0m
};

// Rack type configurations
export const RACK_TYPES = {
  'standard': {
    name: 'Standard Rack',
    description: 'Standard warehouse racking system',
    maxHeight: 12.0,
    levelHeights: STANDARD_RACK_HEIGHTS
  },
  'heavy-duty': {
    name: 'Heavy Duty Rack',
    description: 'Heavy duty racking for large items',
    maxHeight: 15.0,
    levelHeights: {
      '0': 0,
      '1': 3.0,
      '2': 6.0,
      '3': 9.0,
      '4': 12.0,
    }
  },
  'cantilever': {
    name: 'Cantilever Rack',
    description: 'Cantilever racking for long items',
    maxHeight: 8.0,
    levelHeights: {
      '0': 0,
      '1': 2.0,
      '2': 4.0,
      '3': 6.0,
      '4': 8.0,
    }
  },
  'custom': {
    name: 'Custom Rack',
    description: 'Custom height configuration',
    maxHeight: 20.0,
    levelHeights: STANDARD_RACK_HEIGHTS
  }
};

export function getLevelId(location: Location): string {
  return `${location.row}${location.bay}-${location.level}`;
}

export function getLevelWeight(locations: Location[]): number {
  return locations.reduce((total, loc) => total + (loc.currentWeight || 0), 0);
}

export function canAcceptWeight(location: Location, weight: number, levelLocations: Location[], isGroundLevel: boolean): boolean {
  // Check if location is available and verified
  if (!location.available || !location.verified) {
    return false;
  }

  // Only allow ground level items in level 0 and vice versa
  if ((location.level === '0') !== isGroundLevel) {
    return false;
  }

  // Ground level (Level 0) can accept items if not marked as full
  if (location.level === '0') {
    return !location.isGroundFull;
  }

  // Calculate current level weight including the new weight
  const currentLevelWeight = getLevelWeight(levelLocations);
  const newLevelWeight = currentLevelWeight + weight;

  // Check level weight limit
  const levelMaxWeight = LEVEL_MAX_WEIGHTS[location.level as keyof typeof LEVEL_MAX_WEIGHTS];
  if (newLevelWeight > levelMaxWeight) {
    return false;
  }

  return true;
}

// Calculate distance score (lower is better)
function calculateDistanceScore(row: string, bay: string): number {
  const rowScore = (row.charCodeAt(0) - 'A'.charCodeAt(0)) * 100;
  const bayScore = parseInt(bay) - 1;
  return rowScore + bayScore;
}

// Calculate weight suitability score (lower is better)
function calculateWeightScore(weight: number, level: string, levelLocations: Location[]): number {
  const levelNum = parseInt(level);
  const levelMaxWeight = LEVEL_MAX_WEIGHTS[level as keyof typeof LEVEL_MAX_WEIGHTS];
  
  // Calculate current level weight
  const currentLevelWeight = getLevelWeight(levelLocations);
  const newLevelWeight = currentLevelWeight + weight;

  // Heavy penalty for exceeding level weight limits
  if (newLevelWeight > levelMaxWeight) {
    return Number.MAX_SAFE_INTEGER;
  }

  // For ground level, no weight scoring needed
  if (level === '0') {
    return 0;
  }

  // Penalize putting heavy items on higher levels
  const heightPenalty = weight * levelNum * 2;
  
  // Penalize inefficient use of weight capacity
  const capacityScore = Math.abs(levelMaxWeight - newLevelWeight);
  
  // Additional penalty for nearly full levels
  const levelUtilization = newLevelWeight / levelMaxWeight;
  const levelPenalty = levelUtilization * 1000;

  return heightPenalty + capacityScore + levelPenalty;
}

export function findOptimalLocation(locations: Location[], weight: number, isGroundLevel: boolean = false): Location | null {
  // Filter for available and verified locations first
  const availableLocations = locations.filter(loc => loc.available && loc.verified);
  
  if (availableLocations.length === 0) {
    return null;
  }

  // Filter locations based on ground level requirement
  const filteredLocations = availableLocations.filter(loc => 
    (loc.level === '0') === isGroundLevel
  );

  if (filteredLocations.length === 0) {
    return null;
  }

  // Group locations by level
  const levelGroups = filteredLocations.reduce((groups, loc) => {
    const levelKey = `${loc.row}${loc.bay}-${loc.level}`;
    if (!groups[levelKey]) {
      groups[levelKey] = [];
    }
    groups[levelKey].push(loc);
    return groups;
  }, {} as Record<string, Location[]>);

  // Filter locations that can accept the weight based on level capacity
  const validLocations = filteredLocations.filter(location => {
    const levelKey = `${location.row}${location.bay}-${location.level}`;
    const levelLocations = levelGroups[levelKey];
    return canAcceptWeight(location, weight, levelLocations, isGroundLevel);
  });

  if (validLocations.length === 0) {
    return null;
  }

  // For ground level, prioritize locations with fewer stacked items
  if (isGroundLevel) {
    return validLocations.sort((a, b) => {
      const aStacked = a.stackedItems?.length || 0;
      const bStacked = b.stackedItems?.length || 0;
      if (aStacked !== bStacked) {
        return aStacked - bStacked;
      }
      return calculateDistanceScore(a.row, a.bay) - calculateDistanceScore(b.row, b.bay);
    })[0];
  }

  // Score each location based on multiple factors
  const scoredLocations = validLocations.map(location => {
    const levelKey = `${location.row}${location.bay}-${location.level}`;
    const levelLocations = levelGroups[levelKey];
    const distanceScore = calculateDistanceScore(location.row, location.bay);
    const weightScore = calculateWeightScore(weight, location.level, levelLocations);
    
    return {
      location,
      score: distanceScore + weightScore
    };
  }).filter(scored => scored.score !== Number.MAX_SAFE_INTEGER);

  if (scoredLocations.length === 0) {
    return null;
  }

  // Sort by score (lower is better) and return the best location
  scoredLocations.sort((a, b) => a.score - b.score);
  return scoredLocations[0].location;
}

export function getLocationHeight(location: Location): number {
  if (location.height !== undefined) {
    return location.height;
  }

  // Fallback to rack type heights
  if (location.rackType && RACK_TYPES[location.rackType as keyof typeof RACK_TYPES]) {
    const rackConfig = RACK_TYPES[location.rackType as keyof typeof RACK_TYPES];
    return rackConfig.levelHeights[location.level as keyof typeof rackConfig.levelHeights] || 0;
  }

  // Default to standard heights
  return STANDARD_RACK_HEIGHTS[location.level as keyof typeof STANDARD_RACK_HEIGHTS] || 0;
}

export function validateLocationHeight(height: number, level: string, rackType: string = 'standard'): boolean {
  if (height < 0) return false;
  
  const rackConfig = RACK_TYPES[rackType as keyof typeof RACK_TYPES];
  if (!rackConfig) return false;
  
  return height <= rackConfig.maxHeight;
}
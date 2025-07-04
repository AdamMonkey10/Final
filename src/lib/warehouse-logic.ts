import type { Location } from '@/types/warehouse';

// Weight limits per level (in kg) - now configurable
export const LEVEL_MAX_WEIGHTS = {
  '0': Infinity, // Ground level - no weight limit for stacking
  '1': 1500,     // First level
  '2': 1000,     // Second level
  '3': 750,      // Third level
  '4': 500,      // Fourth level
  '5': 400,      // Fifth level
  '6': 300,      // Sixth level
  '7': 250,      // Seventh level
  '8': 200,      // Eighth level
  '9': 150,      // Ninth level
};

// Standard rack heights per level (in meters)
export const STANDARD_RACK_HEIGHTS = {
  '0': 0,        // Ground level
  '1': 2.5,      // First level - 2.5m
  '2': 5.0,      // Second level - 5.0m
  '3': 7.5,      // Third level - 7.5m
  '4': 10.0,     // Fourth level - 10.0m
  '5': 12.5,     // Fifth level - 12.5m
  '6': 15.0,     // Sixth level - 15.0m
  '7': 17.5,     // Seventh level - 17.5m
  '8': 20.0,     // Eighth level - 20.0m
  '9': 22.5,     // Ninth level - 22.5m
};

// Rack type configurations
export const RACK_TYPES = {
  'standard': {
    name: 'Standard Rack',
    description: 'Standard warehouse racking system',
    maxHeight: 12.0,
    levelHeights: STANDARD_RACK_HEIGHTS,
    levelWeights: LEVEL_MAX_WEIGHTS
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
      '5': 15.0,
    },
    levelWeights: {
      '0': Infinity,
      '1': 2000,
      '2': 1500,
      '3': 1000,
      '4': 750,
      '5': 500,
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
    },
    levelWeights: {
      '0': Infinity,
      '1': 800,
      '2': 600,
      '3': 400,
      '4': 300,
    }
  },
  'custom': {
    name: 'Custom Rack',
    description: 'Custom height and weight configuration',
    maxHeight: 25.0,
    levelHeights: STANDARD_RACK_HEIGHTS,
    levelWeights: LEVEL_MAX_WEIGHTS
  }
};

export function getLevelId(location: Location): string {
  return `${location.row}${location.bay}-${location.level}`;
}

export function getLevelWeight(locations: Location[]): number {
  return locations.reduce((total, loc) => total + (loc.currentWeight || 0), 0);
}

export function getLevelMaxWeight(level: string, rackType: string = 'standard'): number {
  const rackConfig = RACK_TYPES[rackType as keyof typeof RACK_TYPES];
  if (rackConfig && rackConfig.levelWeights[level as keyof typeof rackConfig.levelWeights] !== undefined) {
    return rackConfig.levelWeights[level as keyof typeof rackConfig.levelWeights];
  }
  return LEVEL_MAX_WEIGHTS[level as keyof typeof LEVEL_MAX_WEIGHTS] || 500;
}

// Simplified function - only checks availability and verification
export function canAcceptWeight(location: Location, weight: number): boolean {
  // Check if location is available and verified
  if (!location.available || !location.verified) {
    return false;
  }

  // Ground level (Level 0) can accept any weight if not marked as full
  if (location.level === '0') {
    return !location.isGroundFull;
  }

  // All other levels can accept any weight - no restrictions
  return true;
}

// Calculate distance score (lower is better) - Updated for new bay/row system
function calculateDistanceScore(row: string, bay: string): number {
  // Row score: Row 1 (bays A-E) gets lower score than Row 2 (bays F-J)
  const rowScore = (parseInt(row) - 1) * 1000; // Row 1 = 0, Row 2 = 1000
  
  // Bay score: A=0, B=1, C=2, etc.
  const bayScore = bay.charCodeAt(0) - 'A'.charCodeAt(0);
  
  return rowScore + bayScore;
}

// Simplified weight scoring - only considers height penalty for heavy items
function calculateWeightScore(weight: number, level: string): number {
  const levelNum = parseInt(level);
  
  // For ground level, no weight scoring needed
  if (level === '0') {
    return 0;
  }

  // Only penalize putting heavy items on higher levels (suggestion, not restriction)
  const heightPenalty = weight * levelNum * 2;
  
  return heightPenalty;
}

export function findOptimalLocation(locations: Location[], weight: number): Location | null {
  // Add defensive checks and warnings
  if (!locations || !Array.isArray(locations)) {
    console.warn('findOptimalLocation: locations is not an array:', locations);
    return null;
  }

  if (locations.length === 0) {
    console.warn('findOptimalLocation: no locations provided');
    return null;
  }

  // Filter for available and verified locations first
  const availableLocations = locations.filter(loc => loc.available && loc.verified);
  
  if (availableLocations.length === 0) {
    console.warn('findOptimalLocation: no available locations found');
    return null;
  }

  // Filter locations that can accept the weight (no weight restrictions, just availability)
  const validLocations = availableLocations.filter(location => {
    return canAcceptWeight(location, weight);
  });

  if (validLocations.length === 0) {
    console.warn('findOptimalLocation: no valid locations found');
    return null;
  }

  // For ground level locations, prioritize those with fewer stacked items
  const groundLocations = validLocations.filter(loc => loc.level === '0');
  const rackLocations = validLocations.filter(loc => loc.level !== '0');

  // If we have ground locations, prefer them for heavy items
  if (groundLocations.length > 0 && weight > 1000) {
    return groundLocations.sort((a, b) => {
      const aStacked = a.stackedItems?.length || 0;
      const bStacked = b.stackedItems?.length || 0;
      if (aStacked !== bStacked) {
        return aStacked - bStacked;
      }
      return calculateDistanceScore(a.row, a.bay) - calculateDistanceScore(b.row, b.bay);
    })[0];
  }

  // Score all valid locations based on distance and weight suitability
  const scoredLocations = validLocations.map(location => {
    const distanceScore = calculateDistanceScore(location.row, location.bay);
    const weightScore = calculateWeightScore(weight, location.level);
    
    return {
      location,
      score: distanceScore + weightScore
    };
  });

  // Sort by score (lower is better) and return the best location
  scoredLocations.sort((a, b) => a.score - b.score);
  return scoredLocations[0].location;
}

// Get all suitable locations for an item weight (for choice)
export function getSuitableLocations(locations: Location[], weight: number): Location[] {
  // Add defensive checks and warnings
  if (!locations || !Array.isArray(locations)) {
    console.warn('getSuitableLocations: locations is not an array:', locations);
    return [];
  }

  // Filter for available and verified locations first
  const availableLocations = locations.filter(loc => loc.available && loc.verified);
  
  if (availableLocations.length === 0) {
    console.warn('getSuitableLocations: no available locations found');
    return [];
  }

  // Filter locations that can accept the weight (no weight restrictions, just availability)
  const validLocations = availableLocations.filter(location => {
    return canAcceptWeight(location, weight);
  });

  if (validLocations.length === 0) {
    console.warn('getSuitableLocations: no valid locations found');
    return [];
  }

  // Sort by suitability (optimal locations first)
  return validLocations.sort((a, b) => {
    const distanceScoreA = calculateDistanceScore(a.row, a.bay);
    const distanceScoreB = calculateDistanceScore(b.row, b.bay);
    const weightScoreA = calculateWeightScore(weight, a.level);
    const weightScoreB = calculateWeightScore(weight, b.level);
    
    return (distanceScoreA + weightScoreA) - (distanceScoreB + weightScoreB);
  });
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
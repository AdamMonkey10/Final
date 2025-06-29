import { Timestamp } from 'firebase/firestore';

export interface Item {
  id: string;
  itemCode: string; // This is now the Product/SKU
  systemCode: string;
  description: string;
  weight: number;
  location?: string;
  category: string;
  status: 'pending' | 'placed' | 'removed';
  locationVerified: boolean;
  lastUpdated: Timestamp;
  metadata?: {
    coilNumber?: string;
    coilLength?: string;
    isGroundLevel?: boolean;
    stackPosition?: number;
  };
  department?: string;
}

export interface Movement {
  id: string;
  itemId: string;
  type: 'IN' | 'OUT';
  weight: number;
  timestamp: Timestamp;
  operator: string;
  reference: string; // This is now the Product/SKU
  notes?: string;
  quantity?: number;
}

export interface Location {
  id: string;
  code: string;
  row: string;
  bay: string;
  level: string;
  location: string;
  maxWeight: number;
  currentWeight: number;
  available: boolean;
  verified: boolean;
  isGroundFull?: boolean;
  stackedItems?: string[];
  height?: number; // Height in meters for the rack/location
  rackType?: string; // Type of rack (e.g., 'standard', 'heavy-duty', 'cantilever')
}
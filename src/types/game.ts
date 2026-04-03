export type EconomyType = 'mining' | 'tech' | 'agricultural' | 'military' | 'blackmarket' | 'industrial' | 'research' | 'frontier' | 'trading';

export type GoodType = 'food' | 'minerals' | 'electronics' | 'fuel' | 'medicine' | 'weapons' | 'luxury' | 'machinery' | 'rare_metals' | 'contraband';

export type ShipClass = 'scout' | 'trader' | 'gunship' | 'freighter';

export type GameScreen = 'planet' | 'galaxy_map' | 'travel' | 'combat';

export interface Good {
  type: GoodType;
  name: string;
  basePrice: number;
  weight: number;
  isIllegal?: boolean;
  icon: string;
}

export interface MarketListing {
  good: GoodType;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  demand: 'surplus' | 'normal' | 'shortage' | 'critical';
}

export interface Planet {
  id: string;
  name: string;
  economy: EconomyType;
  x: number;
  y: number;
  market: MarketListing[];
  description: string;
  faction: string;
  dangerLevel: number;
  color: string;
  icon: string;
  produces: GoodType[];
  consumes: GoodType[];
}

export interface ShipTemplate {
  class: ShipClass;
  name: string;
  description: string;
  price: number;
  cargoCapacity: number;
  speed: number;
  maxShields: number;
  maxHull: number;
  weaponPower: number;
  icon: string;
}

export interface ShipUpgrades {
  cargo: number;
  engine: number;
  shields: number;
  weapons: number;
}

export interface CargoItem {
  good: GoodType;
  quantity: number;
  avgPurchasePrice: number;
}

export interface PlayerShip {
  class: ShipClass;
  cargoCapacity: number;
  speed: number;
  shields: number;
  maxShields: number;
  hull: number;
  maxHull: number;
  weaponPower: number;
  upgrades: ShipUpgrades;
  cargo: CargoItem[];
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  targetPlanetId: string;
  targetPlanetName: string;
  reward: number;
  cargoType?: GoodType;
  cargoAmount?: number;
  isDelivery: boolean;
  isActive: boolean;
  isComplete: boolean;
}

export interface CombatEnemy {
  name: string;
  hull: number;
  maxHull: number;
  weaponPower: number;
  shields: number;
  maxShields: number;
  creditReward: number;
  cargoReward?: { good: GoodType; quantity: number };
  isEscapable: boolean;
  accuracy: number;
  evasion: number;
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  timestamp: number;
}

export interface PlayerState {
  credits: number;
  currentPlanetId: string;
  ship: PlayerShip;
  visitedPlanets: string[];
  missions: Mission[];
  reputation: number;
  totalProfit: number;
  tripsCompleted: number;
}

export interface GameState {
  player: PlayerState;
  planets: Planet[];
  screen: GameScreen;
  travelDestinationId?: string;
  travelProgress: number;
  travelDuration: number;
  combat?: CombatEnemy;
  combatLog: string[];
  notifications: GameNotification[];
  gameDay: number;
  marketLastRefresh: number;
  initialized: boolean;
}

export type EconomyType = 'mining' | 'tech' | 'agricultural' | 'military' | 'blackmarket' | 'industrial' | 'research' | 'frontier' | 'trading';

export type GoodEncounterType = 'salvage' | 'patrol_assist' | 'trader_tip' | 'abandoned_cache' | 'anomaly' | 'derelict';

export interface GoodEncounter {
  type: GoodEncounterType;
  title: string;
  description: string;
  creditBonus?: number;
  shieldRestore?: number;
  reputationBonus?: number;
  cargoReward?: { good: GoodType; quantity: number };
}

export type SpaceportLocationType =
  | 'cantina' | 'black_market' | 'hangar' | 'storage'
  | 'info_broker' | 'supply_depot' | 'workshop' | 'medbay'
  | 'lounge' | 'armory';

export interface SpaceportLocation {
  id: string;       // unique, e.g. "nova_gate_cantina"
  name: string;
  icon: string;
  description: string;
  type: SpaceportLocationType;
}

export interface LocationResult {
  locationId: string;
  flavor: string;           // narrative blurb shown in UI
  creditBonus?: number;
  cargoReward?: { good: GoodType; quantity: number };
  reputationBonus?: number;
  hullRepair?: number;
  missionId?: string;       // if a mission was spawned
}

export type GoodType = 'food' | 'minerals' | 'electronics' | 'fuel' | 'medicine' | 'weapons' | 'luxury' | 'machinery' | 'rare_metals' | 'contraband';

export type ShipClass = 'scout' | 'trader' | 'gunship' | 'freighter';

export type GameScreen = 'planet' | 'galaxy_map' | 'travel' | 'combat';

export type MissionType = 'delivery' | 'courier' | 'bounty' | 'survey' | 'smuggle' | 'emergency';

export interface SolarSystem {
  id: string;
  name: string;
  color: string;
  centerX: number;
  centerY: number;
  planetIds: string[];
  description: string;
}

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
  systemId: string;
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
  isSpaceport?: boolean;
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
  type: MissionType;
  title: string;
  description: string;
  targetPlanetId: string;
  targetPlanetName: string;
  targetSystemName?: string;
  reward: number;
  bonusReward?: number;
  cargoType?: GoodType;
  cargoAmount?: number;
  expiresOnDay: number;
  reputationRequired: number;
  isActive: boolean;
  isComplete: boolean;
  isFailed: boolean;
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
  isBountyTarget?: boolean;
  bountyMissionId?: string;
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
  exploredLocations: Record<string, number>; // locationId -> gameDay last explored
}

export interface GameState {
  player: PlayerState;
  planets: Planet[];
  systems: SolarSystem[];
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
  pendingGoodEncounter?: GoodEncounter;
  lastLocationResult?: LocationResult;
}

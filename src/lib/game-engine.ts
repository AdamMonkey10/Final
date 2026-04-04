import type {
  Planet, PlayerState, MarketListing, GoodType, CombatEnemy,
  Mission, MissionType, GameNotification, PlayerShip, ShipUpgrades, SolarSystem,
} from '@/types/game';
import { GOODS, PLANET_TEMPLATES, SOLAR_SYSTEMS, SHIP_TEMPLATES, UPGRADE_COSTS } from '@/data/game-data';

// ── Market ────────────────────────────────────────────────────────────────────

const ECONOMY_FACTORS: Record<string, Record<GoodType, number>> = {
  mining:      { minerals: 0.45, rare_metals: 0.55, fuel: 0.70, food: 1.60, electronics: 1.40, medicine: 1.50, weapons: 1.20, machinery: 1.15, luxury: 1.70, contraband: 1.30 },
  tech:        { electronics: 0.45, machinery: 0.60, rare_metals: 1.20, minerals: 1.35, food: 1.45, fuel: 1.20, medicine: 0.90, weapons: 1.10, luxury: 1.25, contraband: 1.20 },
  agricultural:{ food: 0.40, medicine: 0.55, minerals: 1.50, electronics: 1.45, machinery: 1.40, fuel: 1.30, weapons: 1.60, luxury: 1.35, rare_metals: 1.55, contraband: 1.50 },
  military:    { weapons: 0.50, machinery: 0.80, food: 1.30, fuel: 1.25, electronics: 1.15, minerals: 1.20, medicine: 1.35, luxury: 1.55, rare_metals: 1.40, contraband: 1.10 },
  blackmarket: { contraband: 0.45, weapons: 0.65, luxury: 0.80, rare_metals: 0.90, electronics: 0.95, food: 1.25, minerals: 1.30, medicine: 1.20, fuel: 1.15, machinery: 1.20 },
  industrial:  { machinery: 0.50, fuel: 0.65, minerals: 0.80, food: 1.40, electronics: 1.25, medicine: 1.35, weapons: 1.15, rare_metals: 1.30, luxury: 1.50, contraband: 1.25 },
  research:    { medicine: 0.60, electronics: 0.80, rare_metals: 0.85, food: 1.30, minerals: 1.25, machinery: 1.15, fuel: 1.20, weapons: 1.40, luxury: 1.30, contraband: 1.35 },
  frontier:    { food: 1.80, medicine: 1.90, electronics: 1.75, weapons: 1.65, fuel: 1.70, machinery: 1.80, minerals: 0.70, rare_metals: 0.75, luxury: 2.00, contraband: 1.50 },
  trading:     { food: 0.95, minerals: 0.95, electronics: 0.95, fuel: 0.95, medicine: 0.95, weapons: 1.10, luxury: 0.70, machinery: 0.95, rare_metals: 1.05, contraband: 1.15 },
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateMarket(planet: Omit<Planet, 'market'>, gameDay: number): MarketListing[] {
  const factors = ECONOMY_FACTORS[planet.economy] ?? ECONOMY_FACTORS.trading;
  return (Object.keys(GOODS) as GoodType[]).map((goodType, idx) => {
    const good = GOODS[goodType];
    const factor = factors[goodType] ?? 1.0;
    const seed = planet.id.charCodeAt(0) + idx * 17 + gameDay * 3;
    const variance = 0.85 + seededRandom(seed) * 0.3;
    const marketPrice = Math.round(good.basePrice * factor * variance);
    const buyPrice = Math.round(marketPrice * 1.08);
    const sellPrice = Math.round(marketPrice * 0.92);

    const demandSeed = seededRandom(seed + 100);
    let demand: MarketListing['demand'] = 'normal';
    if (planet.produces.includes(goodType)) demand = demandSeed > 0.7 ? 'surplus' : 'normal';
    else if (planet.consumes.includes(goodType)) demand = demandSeed > 0.6 ? 'critical' : 'shortage';

    const quantity = planet.produces.includes(goodType)
      ? Math.round(15 + seededRandom(seed + 300) * 30)
      : Math.round(5 + seededRandom(seed + 200) * 20);

    return { good: goodType, buyPrice, sellPrice, quantity, demand };
  });
}

export function initializePlanets(gameDay: number): Planet[] {
  return PLANET_TEMPLATES.map(t => ({ ...t, market: generateMarket(t, gameDay) }));
}

export function getSolarSystems(): SolarSystem[] {
  return SOLAR_SYSTEMS;
}

// ── Travel ────────────────────────────────────────────────────────────────────

export function getTravelDistance(a: Planet, b: Planet): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getTravelDuration(distance: number, shipSpeed: number): number {
  const baseDuration = 1500 + (distance / 1000) * 5000;
  return Math.round(baseDuration * (10 / shipSpeed));
}

export function isSameSystem(a: Planet, b: Planet): boolean {
  return a.systemId === b.systemId;
}

// ── Encounters ────────────────────────────────────────────────────────────────

const PIRATE_NAMES = [
  'Marauder Scum', 'Void Raider', 'Space Pirate', 'Rogue Corsair',
  'Outlaw Gunship', 'Bandit Frigate', 'Crimson Raider', 'Shadow Pirate',
];

export function rollEncounter(distance: number, player: PlayerState, isCrossSystem: boolean): CombatEnemy | null {
  const baseChance = isCrossSystem ? 0.30 : 0.15;
  const distanceFactor = Math.min(distance / 500, 0.2);
  if (Math.random() > baseChance + distanceFactor) return null;

  const tier = Math.min(Math.floor(player.tripsCompleted / 5), 3);
  const name = PIRATE_NAMES[Math.floor(Math.random() * PIRATE_NAMES.length)];
  const scaledHull = 30 + tier * 20 + Math.floor(Math.random() * 20);
  const scaledWeapons = 8 + tier * 5 + Math.floor(Math.random() * 8);

  return {
    name, hull: scaledHull, maxHull: scaledHull, weaponPower: scaledWeapons,
    shields: tier * 10, maxShields: tier * 10,
    creditReward: 150 + tier * 100 + Math.floor(Math.random() * 200),
    isEscapable: Math.random() > 0.3,
    accuracy: 0.5 + tier * 0.08, evasion: 0.1 + tier * 0.05,
  };
}

export function generateBountyEnemy(reward: number): CombatEnemy {
  const power = Math.round(reward / 100);
  return {
    name: 'Bounty Target',
    hull: 60 + power, maxHull: 60 + power,
    weaponPower: 15 + Math.floor(power / 3),
    shields: 20, maxShields: 20,
    creditReward: reward,
    isEscapable: false,
    accuracy: 0.65, evasion: 0.2,
    isBountyTarget: true,
  };
}

// ── Combat ────────────────────────────────────────────────────────────────────

export interface CombatResult {
  playerDamage: number; enemyDamage: number;
  playerShieldDamage: number; enemyShieldDamage: number;
  log: string[];
}

export function resolveCombatRound(player: PlayerShip, enemy: CombatEnemy): CombatResult {
  const log: string[] = [];
  let playerDamage = 0, enemyDamage = 0, playerShieldDamage = 0, enemyShieldDamage = 0;

  if (Math.random() > enemy.evasion) {
    const raw = player.weaponPower + Math.floor(Math.random() * 10) - 5;
    if (enemy.shields > 0) {
      enemyShieldDamage = Math.min(raw, enemy.shields);
      enemyDamage = Math.max(0, raw - enemy.shields);
      log.push(`Hit for ${raw} (${enemyShieldDamage} shield, ${enemyDamage} hull)`);
    } else {
      enemyDamage = raw;
      log.push(`Strike for ${raw} hull damage!`);
    }
  } else { log.push('Your shot misses!'); }

  if (Math.random() < enemy.accuracy) {
    const raw = enemy.weaponPower + Math.floor(Math.random() * 8) - 4;
    if (player.shields > 0) {
      playerShieldDamage = Math.min(raw, player.shields);
      playerDamage = Math.max(0, raw - player.shields);
      log.push(`Enemy hits ${raw} (${playerShieldDamage} shield, ${playerDamage} hull)`);
    } else {
      playerDamage = raw;
      log.push(`Enemy strikes hull for ${raw}!`);
    }
  } else { log.push('Enemy shot misses!'); }

  return { playerDamage, enemyDamage, playerShieldDamage, enemyShieldDamage, log };
}

// ── Missions ──────────────────────────────────────────────────────────────────

const MISSION_CONFIG: Record<MissionType, {
  titles: string[];
  icon: string;
  baseReward: number;
  rewardVariance: number;
  repRequired: number;
  expiryDays: number;
}> = {
  delivery: {
    titles: ['Supply Contract', 'Trade Delivery', 'Cargo Run', 'Transport Job', 'Freight Order'],
    icon: '📦', baseReward: 300, rewardVariance: 400, repRequired: 0, expiryDays: 8,
  },
  courier: {
    titles: ['Priority Courier', 'Express Dispatch', 'Urgent Package', 'Rush Delivery', 'Time-Critical Cargo'],
    icon: '⚡', baseReward: 500, rewardVariance: 600, repRequired: 0, expiryDays: 4,
  },
  bounty: {
    titles: ['Pirate Bounty', 'Wanted: Dead or Alive', 'Eliminate Threat', 'Bounty Contract', 'Hunt the Raider'],
    icon: '🎯', baseReward: 700, rewardVariance: 800, repRequired: 5, expiryDays: 10,
  },
  survey: {
    titles: ['Market Survey', 'Trade Intelligence', 'Exploration Report', 'Sector Scan', 'Scout Mission'],
    icon: '🔭', baseReward: 200, rewardVariance: 200, repRequired: 0, expiryDays: 6,
  },
  smuggle: {
    titles: ['Discreet Delivery', 'Off-the-Books Run', 'Shadow Contract', 'Black Ops Cargo', 'Under the Radar'],
    icon: '🤫', baseReward: 900, rewardVariance: 1200, repRequired: 10, expiryDays: 5,
  },
  emergency: {
    titles: ['Medical Emergency', 'Critical Shortage', 'Crisis Supply Run', 'SOS Response', 'Disaster Relief'],
    icon: '🚨', baseReward: 1000, rewardVariance: 1500, repRequired: 0, expiryDays: 3,
  },
};

const DELIVERY_GOODS: GoodType[] = ['food', 'medicine', 'electronics', 'minerals', 'machinery', 'fuel'];
const SMUGGLE_GOODS: GoodType[] = ['contraband', 'weapons'];

export function generateMissions(
  currentPlanetId: string,
  planets: Planet[],
  systems: SolarSystem[],
  gameDay: number,
  playerRep: number,
): Mission[] {
  const otherPlanets = planets.filter(p => p.id !== currentPlanetId);
  const currentSystem = systems.find(s => s.planetIds.includes(currentPlanetId));
  const missions: Mission[] = [];

  const missionTypes: MissionType[] = ['delivery', 'courier', 'survey', 'emergency', 'bounty', 'smuggle'];
  const count = 3 + Math.floor(Math.random() * 2); // 3-4 missions per planet

  const usedTypes = new Set<MissionType>();

  for (let i = 0; i < count; i++) {
    // Pick a mission type we haven't used yet
    const available = missionTypes.filter(t => {
      if (usedTypes.has(t)) return false;
      const cfg = MISSION_CONFIG[t];
      if (cfg.repRequired > playerRep) return false;
      return true;
    });
    if (available.length === 0) break;
    const type = available[Math.floor(Math.random() * available.length)];
    usedTypes.add(type);

    const cfg = MISSION_CONFIG[type];
    const reward = cfg.baseReward + Math.floor(Math.random() * cfg.rewardVariance);
    const title = cfg.titles[Math.floor(Math.random() * cfg.titles.length)];

    // Prefer cross-system targets for higher-value missions
    const crossSystem = otherPlanets.filter(p => {
      const sys = systems.find(s => s.planetIds.includes(p.id));
      return sys && sys.id !== currentSystem?.id;
    });
    const inSystem = otherPlanets.filter(p => currentSystem?.planetIds.includes(p.id));

    let targetPool = otherPlanets;
    if (type === 'smuggle') {
      targetPool = otherPlanets.filter(p => p.economy === 'blackmarket' || p.dangerLevel >= 2);
      if (targetPool.length === 0) targetPool = otherPlanets;
    } else if (type === 'emergency') {
      targetPool = otherPlanets.filter(p => p.economy === 'frontier' || p.dangerLevel >= 1);
      if (targetPool.length === 0) targetPool = crossSystem.length ? crossSystem : otherPlanets;
    } else if (['bounty', 'courier'].includes(type) && crossSystem.length > 0) {
      targetPool = crossSystem;
    } else if (type === 'survey' && inSystem.length > 0) {
      targetPool = inSystem;
    }

    const target = targetPool[Math.floor(Math.random() * targetPool.length)];
    const targetSystem = systems.find(s => s.planetIds.includes(target.id));

    let description = '';
    let cargoType: GoodType | undefined;
    let cargoAmount: number | undefined;
    let bonusReward: number | undefined;

    switch (type) {
      case 'delivery': {
        cargoType = DELIVERY_GOODS[Math.floor(Math.random() * DELIVERY_GOODS.length)];
        cargoAmount = 3 + Math.floor(Math.random() * 8);
        description = `Deliver ${cargoAmount}x ${GOODS[cargoType].name} to ${target.name}. Standard contract.`;
        break;
      }
      case 'courier': {
        cargoType = DELIVERY_GOODS[Math.floor(Math.random() * DELIVERY_GOODS.length)];
        cargoAmount = 1 + Math.floor(Math.random() * 3);
        bonusReward = Math.floor(reward * 0.4);
        description = `Urgent: rush ${cargoAmount}x ${GOODS[cargoType].name} to ${target.name} within ${cfg.expiryDays} days. Speed bonus: +${bonusReward}cr.`;
        break;
      }
      case 'bounty': {
        description = `A dangerous pirate was last spotted near ${target.name}. Eliminate the threat and collect the ${reward}cr bounty.`;
        break;
      }
      case 'survey': {
        description = `Visit ${target.name} and gather market intelligence. Return data worth ${reward}cr to the Merchant Guild.`;
        break;
      }
      case 'smuggle': {
        cargoType = SMUGGLE_GOODS[Math.floor(Math.random() * SMUGGLE_GOODS.length)];
        cargoAmount = 2 + Math.floor(Math.random() * 4);
        description = `⚠ ILLEGAL: Smuggle ${cargoAmount}x ${GOODS[cargoType].name} to ${target.name}. No questions asked. High risk, ${reward}cr reward.`;
        break;
      }
      case 'emergency': {
        cargoType = ['food', 'medicine', 'fuel'][Math.floor(Math.random() * 3)] as GoodType;
        cargoAmount = 5 + Math.floor(Math.random() * 10);
        description = `🚨 EMERGENCY: ${target.name} faces critical ${GOODS[cargoType].name} shortage. Deliver ${cargoAmount} units ASAP for ${reward}cr.`;
        break;
      }
    }

    missions.push({
      id: `m_${gameDay}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      description,
      targetPlanetId: target.id,
      targetPlanetName: target.name,
      targetSystemName: targetSystem?.name,
      reward,
      bonusReward,
      cargoType,
      cargoAmount,
      expiresOnDay: gameDay + cfg.expiryDays,
      reputationRequired: cfg.repRequired,
      isActive: false,
      isComplete: false,
      isFailed: false,
    });
  }

  return missions;
}

// ── Ship helpers ──────────────────────────────────────────────────────────────

export function getShipEffectiveStats(ship: PlayerShip) {
  const u: ShipUpgrades = ship.upgrades;
  return {
    cargoCapacity: ship.cargoCapacity + u.cargo * 8,
    speed: ship.speed + u.engine * 2,
    maxShields: ship.maxShields + u.shields * 15,
    weaponPower: ship.weaponPower + u.weapons * 10,
  };
}

export function getCargoUsed(ship: PlayerShip): number {
  return ship.cargo.reduce((sum, item) => sum + item.quantity * (GOODS[item.good]?.weight ?? 1), 0);
}

export function getUpgradeCost(component: keyof ShipUpgrades, currentLevel: number): number | null {
  const costs = UPGRADE_COSTS[component];
  if (!costs || currentLevel >= costs.length) return null;
  return costs[currentLevel];
}

// ── New game ──────────────────────────────────────────────────────────────────

export function createNewGame(): { player: PlayerState; planets: Planet[]; systems: SolarSystem[] } {
  const startTemplate = SHIP_TEMPLATES.scout;
  const gameDay = 1;
  const planets = initializePlanets(gameDay);
  const systems = getSolarSystems();

  const player: PlayerState = {
    credits: 1000,
    currentPlanetId: 'new_terra',
    ship: {
      class: 'scout',
      cargoCapacity: startTemplate.cargoCapacity,
      speed: startTemplate.speed,
      shields: startTemplate.maxShields,
      maxShields: startTemplate.maxShields,
      hull: startTemplate.maxHull,
      maxHull: startTemplate.maxHull,
      weaponPower: startTemplate.weaponPower,
      upgrades: { cargo: 0, engine: 0, shields: 0, weapons: 0 },
      cargo: [],
    },
    visitedPlanets: ['new_terra'],
    missions: generateMissions('new_terra', planets, systems, gameDay, 0),
    reputation: 0,
    totalProfit: 0,
    tripsCompleted: 0,
  };

  return { player, planets, systems };
}

export function makeNotification(message: string, type: GameNotification['type'] = 'info'): GameNotification {
  return { id: `n_${Date.now()}_${Math.random()}`, message, type, timestamp: Date.now() };
}

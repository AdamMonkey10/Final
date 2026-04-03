import type {
  Planet, PlayerState, MarketListing, GoodType, CombatEnemy,
  Mission, GameNotification, PlayerShip, ShipUpgrades,
} from '@/types/game';
import { GOODS, PLANET_TEMPLATES, SHIP_TEMPLATES, UPGRADE_COSTS } from '@/data/game-data';

// ── Market Price Engine ──────────────────────────────────────────────────────

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
  const factors = ECONOMY_FACTORS[planet.economy] || ECONOMY_FACTORS.trading;
  const listings: MarketListing[] = [];

  (Object.keys(GOODS) as GoodType[]).forEach((goodType, idx) => {
    const good = GOODS[goodType];
    const factor = factors[goodType] ?? 1.0;
    const seed = planet.id.charCodeAt(0) + idx * 17 + gameDay * 3;
    const variance = 0.85 + seededRandom(seed) * 0.3;
    const marketPrice = Math.round(good.basePrice * factor * variance);

    const spread = 0.08;
    const buyPrice = Math.round(marketPrice * (1 + spread));
    const sellPrice = Math.round(marketPrice * (1 - spread));

    const demandSeed = seededRandom(seed + 100);
    let demand: MarketListing['demand'] = 'normal';
    if (planet.produces.includes(goodType)) demand = demandSeed > 0.7 ? 'surplus' : 'normal';
    else if (planet.consumes.includes(goodType)) demand = demandSeed > 0.6 ? 'critical' : 'shortage';

    let quantity = Math.round(5 + seededRandom(seed + 200) * 20);
    if (planet.produces.includes(goodType)) quantity = Math.round(15 + seededRandom(seed + 300) * 30);

    listings.push({ good: goodType, buyPrice, sellPrice, quantity, demand });
  });

  return listings;
}

export function initializePlanets(gameDay: number): Planet[] {
  return PLANET_TEMPLATES.map(template => ({
    ...template,
    market: generateMarket(template, gameDay),
  }));
}

// ── Travel ───────────────────────────────────────────────────────────────────

export function getTravelDistance(a: Planet, b: Planet): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getTravelDuration(distance: number, shipSpeed: number): number {
  // Returns milliseconds, 1-8 seconds of travel time
  const baseDuration = 1500 + (distance / 1000) * 5000;
  const speedFactor = 10 / shipSpeed;
  return Math.round(baseDuration * speedFactor);
}

// ── Random Encounters ─────────────────────────────────────────────────────────

const PIRATE_NAMES = [
  'Marauder Scum', 'Void Raider', 'Space Pirate', 'Rogue Corsair',
  'Outlaw Gunship', 'Bandit Frigate', 'Crimson Raider', 'Shadow Pirate',
];

export function rollEncounter(distance: number, player: PlayerState): CombatEnemy | null {
  const baseChance = 0.20;
  const distanceFactor = Math.min(distance / 500, 0.25);
  const chance = baseChance + distanceFactor;

  if (Math.random() > chance) return null;

  const tier = Math.min(Math.floor(player.tripsCompleted / 5), 3);
  const name = PIRATE_NAMES[Math.floor(Math.random() * PIRATE_NAMES.length)];
  const scaledHull = 30 + tier * 20 + Math.floor(Math.random() * 20);
  const scaledWeapons = 8 + tier * 5 + Math.floor(Math.random() * 8);
  const creditReward = 150 + tier * 100 + Math.floor(Math.random() * 200);

  return {
    name,
    hull: scaledHull,
    maxHull: scaledHull,
    weaponPower: scaledWeapons,
    shields: tier * 10,
    maxShields: tier * 10,
    creditReward,
    isEscapable: Math.random() > 0.3,
    accuracy: 0.5 + tier * 0.08,
    evasion: 0.1 + tier * 0.05,
  };
}

// ── Combat ───────────────────────────────────────────────────────────────────

export interface CombatResult {
  playerDamage: number;
  enemyDamage: number;
  playerShieldDamage: number;
  enemyShieldDamage: number;
  playerHit: boolean;
  enemyHit: boolean;
  log: string[];
}

export function resolveCombatRound(
  player: PlayerShip,
  enemy: CombatEnemy,
): CombatResult {
  const log: string[] = [];
  let playerDamage = 0;
  let enemyDamage = 0;
  let playerShieldDamage = 0;
  let enemyShieldDamage = 0;

  // Player attacks enemy
  const playerHit = Math.random() > enemy.evasion;
  if (playerHit) {
    const raw = player.weaponPower + Math.floor(Math.random() * 10) - 5;
    if (enemy.shields > 0) {
      enemyShieldDamage = Math.min(raw, enemy.shields);
      enemyDamage = Math.max(0, raw - enemy.shields);
      log.push(`Your weapons hit for ${raw} damage (${enemyShieldDamage} to shields, ${enemyDamage} to hull)`);
    } else {
      enemyDamage = raw;
      log.push(`Your weapons strike for ${raw} hull damage!`);
    }
  } else {
    log.push('Your shot misses!');
  }

  // Enemy attacks player
  const enemyHit = Math.random() < enemy.accuracy;
  if (enemyHit) {
    const raw = enemy.weaponPower + Math.floor(Math.random() * 8) - 4;
    if (player.shields > 0) {
      playerShieldDamage = Math.min(raw, player.shields);
      playerDamage = Math.max(0, raw - player.shields);
      log.push(`Enemy hits for ${raw} damage (${playerShieldDamage} to shields, ${playerDamage} to hull)`);
    } else {
      playerDamage = raw;
      log.push(`Enemy strikes your hull for ${raw} damage!`);
    }
  } else {
    log.push('Enemy shot misses you!');
  }

  return { playerDamage, enemyDamage, playerShieldDamage, enemyShieldDamage, playerHit, enemyHit, log };
}

// ── Missions ─────────────────────────────────────────────────────────────────

const MISSION_TITLES = [
  'Urgent Supply Run', 'Delivery Contract', 'Emergency Medicine',
  'Arms Shipment', 'Rescue Package', 'Trade Favor',
];

export function generateMissions(currentPlanetId: string, planets: Planet[]): Mission[] {
  const otherPlanets = planets.filter(p => p.id !== currentPlanetId);
  const count = 2 + Math.floor(Math.random() * 2);
  const missions: Mission[] = [];

  for (let i = 0; i < count; i++) {
    const target = otherPlanets[Math.floor(Math.random() * otherPlanets.length)];
    const isDelivery = Math.random() > 0.4;
    const reward = 300 + Math.floor(Math.random() * 700);
    const title = MISSION_TITLES[Math.floor(Math.random() * MISSION_TITLES.length)];
    const cargoTypes: GoodType[] = ['food', 'medicine', 'electronics', 'minerals', 'machinery'];
    const cargoType = cargoTypes[Math.floor(Math.random() * cargoTypes.length)];
    const cargoAmount = 3 + Math.floor(Math.random() * 8);

    missions.push({
      id: `m_${Date.now()}_${i}`,
      title,
      description: isDelivery
        ? `Deliver ${cargoAmount} units of ${GOODS[cargoType].name} to ${target.name}. Reward: ${reward}cr`
        : `Reach ${target.name} and report back. Exploration bonus: ${reward}cr`,
      targetPlanetId: target.id,
      targetPlanetName: target.name,
      reward,
      isDelivery,
      cargoType: isDelivery ? cargoType : undefined,
      cargoAmount: isDelivery ? cargoAmount : undefined,
      isActive: false,
      isComplete: false,
    });
  }

  return missions;
}

// ── Ship Stats Helper ─────────────────────────────────────────────────────────

export function getShipEffectiveStats(ship: PlayerShip): {
  cargoCapacity: number;
  speed: number;
  maxShields: number;
  weaponPower: number;
} {
  const upgrades: ShipUpgrades = ship.upgrades;
  return {
    cargoCapacity: ship.cargoCapacity + upgrades.cargo * 8,
    speed: ship.speed + upgrades.engine * 2,
    maxShields: ship.maxShields + upgrades.shields * 15,
    weaponPower: ship.weaponPower + upgrades.weapons * 10,
  };
}

export function getCargoUsed(ship: PlayerShip): number {
  return ship.cargo.reduce((sum, item) => {
    return sum + item.quantity * (GOODS[item.good]?.weight ?? 1);
  }, 0);
}

export function getUpgradeCost(component: keyof ShipUpgrades, currentLevel: number): number | null {
  const costs = UPGRADE_COSTS[component];
  if (!costs || currentLevel >= costs.length) return null;
  return costs[currentLevel];
}

// ── New Game ──────────────────────────────────────────────────────────────────

export function createNewGame(): { player: PlayerState; planets: Planet[] } {
  const startTemplate = SHIP_TEMPLATES.scout;
  const gameDay = 1;
  const planets = initializePlanets(gameDay);

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
    missions: [],
    reputation: 0,
    totalProfit: 0,
    tripsCompleted: 0,
  };

  return { player, planets };
}

// ── Notification helpers ──────────────────────────────────────────────────────

export function makeNotification(
  message: string,
  type: GameNotification['type'] = 'info',
): GameNotification {
  return { id: `n_${Date.now()}_${Math.random()}`, message, type, timestamp: Date.now() };
}

import type {
  Planet, PlayerState, MarketListing, GoodType, CombatEnemy,
  Mission, MissionType, GameNotification, PlayerShip, ShipUpgrades, SolarSystem,
  GoodEncounter, SpaceportLocationType, LocationResult, MarketEvent,
} from '@/types/game';
import { GOODS, PLANET_TEMPLATES, SOLAR_SYSTEMS, SHIP_TEMPLATES, UPGRADE_COSTS, MARKET_EVENT_TEMPLATES } from '@/data/game-data';

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

// ── Market events ─────────────────────────────────────────────────────────────

export function generateMarketEvents(planetId: string, economy: string, gameDay: number): MarketEvent[] {
  const seed = planetId.charCodeAt(0) * 13 + gameDay * 7;
  if (seededRandom(seed) > 0.28) return []; // ~28% chance of an event

  // Filter templates relevant to this economy
  const relevant = MARKET_EVENT_TEMPLATES.filter(t => {
    if (t.type === 'blackmarket_special' && economy !== 'blackmarket' && economy !== 'frontier') return false;
    if (t.type === 'festival' && economy === 'mining') return false;
    return true;
  });

  const idx = Math.floor(seededRandom(seed + 50) * relevant.length);
  const template = relevant[idx];
  const duration = 2 + Math.floor(seededRandom(seed + 80) * 3); // 2-4 days

  return [{
    id: `ev_${planetId}_${gameDay}`,
    ...template,
    expiresOnDay: gameDay + duration,
  }];
}

// ── Market prices ─────────────────────────────────────────────────────────────

export function generateMarket(
  planet: Omit<Planet, 'market' | 'activeEvents'>,
  gameDay: number,
  events: MarketEvent[] = [],
): MarketListing[] {

  const factors = ECONOMY_FACTORS[planet.economy] ?? ECONOMY_FACTORS.trading;

  return (Object.keys(GOODS) as GoodType[]).map((goodType, idx) => {
    const good = GOODS[goodType];
    const factor = factors[goodType] ?? 1.0;

    // Price variance uses good volatility: high volatility = wider swing
    const swing = 0.15 + good.volatility * 0.5;
    const seed     = planet.id.charCodeAt(0) + idx * 17 + gameDay * 3;
    const prevSeed = planet.id.charCodeAt(0) + idx * 17 + (gameDay - 1) * 3;
    const variance     = 0.85 + seededRandom(seed)     * swing;
    const prevVariance = 0.85 + seededRandom(prevSeed) * swing;

    // Apply active event multipliers
    const eventMult = events
      .filter(e => e.affectedGoods.includes(goodType))
      .reduce((m, e) => m * e.priceMultiplier, 1.0);

    const marketPrice     = Math.round(good.basePrice * factor * variance * eventMult);
    const prevMarketPrice = Math.round(good.basePrice * factor * prevVariance);

    const buyPrice  = Math.round(marketPrice * 1.08);
    const sellPrice = Math.round(marketPrice * 0.92);

    // Trend vs previous day (>5% change = arrow)
    const ratio = marketPrice / prevMarketPrice;
    const trend: MarketListing['trend'] = ratio > 1.05 ? 'up' : ratio < 0.95 ? 'down' : 'stable';

    // Demand
    const demandSeed = seededRandom(seed + 100);
    let demand: MarketListing['demand'] = 'normal';
    if (planet.produces.includes(goodType)) demand = demandSeed > 0.7 ? 'surplus' : 'normal';
    else if (planet.consumes.includes(goodType)) demand = demandSeed > 0.6 ? 'critical' : 'shortage';
    // Events can force critical demand
    if (events.some(e => ['shortage', 'disruption'].includes(e.type) && e.affectedGoods.includes(goodType))) {
      demand = 'critical';
    }

    const quantity = planet.produces.includes(goodType)
      ? Math.round(15 + seededRandom(seed + 300) * 30)
      : Math.round(5 + seededRandom(seed + 200) * 20);

    return { good: goodType, buyPrice, sellPrice, quantity, demand, trend };
  });
}

export function initializePlanets(gameDay: number): Planet[] {
  return PLANET_TEMPLATES.map(t => {
    const activeEvents = generateMarketEvents(t.id, t.economy, gameDay);
    return { ...t, activeEvents, market: generateMarket(t, gameDay, activeEvents) };
  });
}

// ── Fuel cost ─────────────────────────────────────────────────────────────────

export function getTravelFuelCost(distance: number, engineLevel: number): number {
  const base = Math.max(15, Math.floor(distance * 0.35));
  const discount = engineLevel * 0.12; // 12% off per engine upgrade (max 36%)
  return Math.round(base * (1 - discount));
}

// ── Reputation price modifier ─────────────────────────────────────────────────

/** Returns buy price multiplier: 1.0 at rep 0, 0.92 at rep 30+ */
export function getRepPriceMultiplier(reputation: number): number {
  return Math.max(0.92, 1.0 - Math.min(reputation, 30) / 375);
}

/** Returns sell price multiplier: 1.0 at rep 0, 1.08 at rep 30+ */
export function getRepSellMultiplier(reputation: number): number {
  return Math.min(1.08, 1.0 + Math.min(reputation, 30) / 375);
}

// ── Best sell hint ────────────────────────────────────────────────────────────

export function getBestSellHint(
  good: GoodType,
  currentPlanetId: string,
  planets: Planet[],
  visitedIds: string[],
): { planetName: string; sellPrice: number } | null {
  let best: { planetName: string; sellPrice: number } | null = null;
  for (const p of planets) {
    if (p.id === currentPlanetId) continue;
    if (!visitedIds.includes(p.id)) continue;
    const listing = p.market.find(m => m.good === good);
    if (listing && (!best || listing.sellPrice > best.sellPrice)) {
      best = { planetName: p.name, sellPrice: listing.sellPrice };
    }
  }
  return best;
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

// ── Good Encounters ───────────────────────────────────────────────────────────

const GOOD_ENCOUNTER_POOL: Array<() => GoodEncounter> = [
  () => ({
    type: 'salvage',
    title: 'Floating Salvage Detected',
    description: 'Your sensors pick up a drifting cargo pod. You haul it aboard and find supplies worth selling.',
    creditBonus: 200 + Math.floor(Math.random() * 300),
  }),
  () => ({
    type: 'patrol_assist',
    title: 'Federation Escort',
    description: 'A Federation patrol vessel hails you and offers assistance. They top up your shields free of charge.',
    shieldRestore: 999, // will be capped to max
  }),
  () => ({
    type: 'trader_tip',
    title: 'Friendly Trader Signal',
    description: 'A passing merchant ship shares profitable market intelligence. You pocket their referral bonus.',
    creditBonus: 150 + Math.floor(Math.random() * 200),
    reputationBonus: 1,
  }),
  () => ({
    type: 'abandoned_cache',
    title: 'Abandoned Supply Cache',
    description: 'You locate an unregistered supply depot. The previous owner is nowhere to be found.',
    creditBonus: 350 + Math.floor(Math.random() * 500),
  }),
  () => ({
    type: 'anomaly',
    title: 'Spatial Anomaly',
    description: 'A rare gravitational anomaly bends spacetime in your favour, shaving time off your route. The discovery earns a Guild commendation.',
    reputationBonus: 3,
    creditBonus: 100,
  }),
  () => ({
    type: 'derelict',
    title: 'Derelict Ship Found',
    description: 'A drifting hulk yields salvageable cargo. You strip what you can carry.',
    cargoReward: {
      good: (['minerals', 'electronics', 'machinery', 'fuel'] as GoodType[])[Math.floor(Math.random() * 4)],
      quantity: 1 + Math.floor(Math.random() * 3),
    },
  }),
];

export function rollGoodEncounter(isCrossSystem: boolean): GoodEncounter | null {
  // 22% intra-system, 30% cross-system
  const chance = isCrossSystem ? 0.30 : 0.22;
  if (Math.random() > chance) return null;
  const factory = GOOD_ENCOUNTER_POOL[Math.floor(Math.random() * GOOD_ENCOUNTER_POOL.length)];
  return factory();
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
    exploredLocations: {},
  };

  return { player, planets, systems };
}

export function makeNotification(message: string, type: GameNotification['type'] = 'info'): GameNotification {
  return { id: `n_${Date.now()}_${Math.random()}`, message, type, timestamp: Date.now() };
}

// ── Location exploration ──────────────────────────────────────────────────────

type OutcomeWeighted =
  | { kind: 'credits'; amount: number; flavor: string }
  | { kind: 'cargo'; good: GoodType; quantity: number; flavor: string }
  | { kind: 'rep'; amount: number; flavor: string }
  | { kind: 'repair'; hp: number; flavor: string }
  | { kind: 'mission'; flavor: string }
  | { kind: 'nothing'; flavor: string };

function pickWeighted<T>(options: Array<[T, number]>): T {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of options) { r -= w; if (r <= 0) return v; }
  return options[options.length - 1][0];
}

const LOCATION_OUTCOMES: Record<SpaceportLocationType, () => OutcomeWeighted> = {
  cantina: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'mission', flavor: 'A hooded figure slides a data chip across the bar. "I heard you take jobs." A new contract is waiting.' }, 40],
    [{ kind: 'credits', amount: 100 + Math.floor(Math.random() * 150), flavor: 'You win a round of cards with some off-duty dockworkers.' }, 35],
    [{ kind: 'rep', amount: 2, flavor: 'You buy a round for the bar. Word gets around — you\'re good people.' }, 15],
    [{ kind: 'nothing', flavor: 'Quiet tonight. The bartender just shrugs. Nothing doing.' }, 10],
  ]),
  black_market: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'cargo', good: 'contraband', quantity: 1 + Math.floor(Math.random() * 2), flavor: 'A vendor palms you a parcel. "On the house — spread the word."' }, 35],
    [{ kind: 'cargo', good: 'weapons', quantity: 1, flavor: 'Someone left in a hurry. Their merchandise is your gain.' }, 30],
    [{ kind: 'mission', flavor: 'A hooded contact needs an off-the-books delivery. The pay is very good.' }, 25],
    [{ kind: 'nothing', flavor: 'Everyone clams up when you approach. Not your day.' }, 10],
  ]),
  hangar: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'cargo', good: 'fuel', quantity: 2 + Math.floor(Math.random() * 2), flavor: 'Leftover fuel canisters from a cancelled job. Help yourself.' }, 35],
    [{ kind: 'cargo', good: 'machinery', quantity: 1, flavor: 'A mechanic gives you a working part they were about to bin.' }, 30],
    [{ kind: 'repair', hp: 15 + Math.floor(Math.random() * 15), flavor: 'A friendly mechanic spots your dents and patches them up during their break.' }, 25],
    [{ kind: 'nothing', flavor: 'The hangar is locked down for maintenance. Nothing to find.' }, 10],
  ]),
  storage: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'cargo', good: (['minerals', 'food', 'electronics', 'fuel', 'machinery'] as GoodType[])[Math.floor(Math.random() * 5)], quantity: 1 + Math.floor(Math.random() * 3), flavor: 'An unlabelled crate with no manifest. You load it up.' }, 50],
    [{ kind: 'credits', amount: 150 + Math.floor(Math.random() * 200), flavor: 'A forgotten lockbox behind some crates. Finders keepers.' }, 35],
    [{ kind: 'nothing', flavor: 'Just dust and empty shelves in here.' }, 15],
  ]),
  info_broker: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'credits', amount: 250 + Math.floor(Math.random() * 350), flavor: 'Hot market intel puts you ahead of the competition. You pocket the edge.' }, 45],
    [{ kind: 'rep', amount: 3, flavor: 'The broker introduces you to a Guild contact. Your reputation gets a boost.' }, 35],
    [{ kind: 'mission', flavor: 'The broker has a well-paying data collection job — right up your alley.' }, 15],
    [{ kind: 'nothing', flavor: 'All the broker\'s leads are stale today. Waste of time.' }, 5],
  ]),
  supply_depot: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'cargo', good: 'food', quantity: 2 + Math.floor(Math.random() * 3), flavor: 'Surplus rations past their "sell by" date but still perfectly good.' }, 35],
    [{ kind: 'cargo', good: 'medicine', quantity: 1 + Math.floor(Math.random() * 2), flavor: 'Overstocked medical supplies. The quartermaster waves you through.' }, 35],
    [{ kind: 'credits', amount: 100 + Math.floor(Math.random() * 100), flavor: 'You trade a favour for a store credit voucher.' }, 20],
    [{ kind: 'nothing', flavor: 'Inventory day. Everything is locked and counted.' }, 10],
  ]),
  workshop: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'repair', hp: 20 + Math.floor(Math.random() * 20), flavor: 'An apprentice needs practice hours. Your hull panels are now as good as new.' }, 40],
    [{ kind: 'cargo', good: 'machinery', quantity: 1, flavor: 'A half-built machine someone abandoned. The parts are useful.' }, 35],
    [{ kind: 'credits', amount: 100 + Math.floor(Math.random() * 150), flavor: 'You help weld a tricky joint. The lead engineer tips you for your trouble.' }, 15],
    [{ kind: 'nothing', flavor: 'The workshop is full but nobody wants to chat.' }, 10],
  ]),
  medbay: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'cargo', good: 'medicine', quantity: 2 + Math.floor(Math.random() * 2), flavor: 'The medic has more supplies than patients today. Take some.' }, 40],
    [{ kind: 'repair', hp: 15 + Math.floor(Math.random() * 10), flavor: 'The doctor patches your minor hull breach, muttering about "biomechanical empathy".' }, 35],
    [{ kind: 'mission', flavor: 'The doctor needs an urgent supply run — critical medicine to a remote colony.' }, 15],
    [{ kind: 'nothing', flavor: 'Busy with patients. Come back another day.' }, 10],
  ]),
  lounge: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'rep', amount: 3, flavor: 'You network with three Guild captains over dinner. Word travels fast in these circles.' }, 40],
    [{ kind: 'credits', amount: 200 + Math.floor(Math.random() * 300), flavor: 'A merchant tips you for a route recommendation.' }, 30],
    [{ kind: 'mission', flavor: 'A Guild broker pulls you aside with a lucrative courier job.' }, 20],
    [{ kind: 'nothing', flavor: 'Everyone\'s too busy talking about the markets to notice you.' }, 10],
  ]),
  armory: () => pickWeighted<OutcomeWeighted>([
    [{ kind: 'cargo', good: 'weapons', quantity: 1 + Math.floor(Math.random() * 2), flavor: 'Decommissioned stock getting sold off cheap. You grab what you can carry.' }, 40],
    [{ kind: 'mission', flavor: 'A sergeant is looking for a reliable pilot for a bounty contract.' }, 35],
    [{ kind: 'credits', amount: 150 + Math.floor(Math.random() * 200), flavor: 'You sell a tip about recent pirate activity. The quartermaster pays well for intel.' }, 15],
    [{ kind: 'nothing', flavor: 'Audit day. Everything is locked down tight.' }, 10],
  ]),
};

export function exploreLocation(
  locationId: string,
  locationType: SpaceportLocationType,
  currentPlanetId: string,
  planets: Planet[],
  systems: SolarSystem[],
  gameDay: number,
  playerRep: number,
): { result: LocationResult; mission?: Mission } {
  const outcome = LOCATION_OUTCOMES[locationType]();

  const result: LocationResult = {
    locationId,
    flavor: outcome.flavor,
    creditBonus:       outcome.kind === 'credits' ? outcome.amount  : undefined,
    cargoReward:       outcome.kind === 'cargo'   ? { good: outcome.good, quantity: outcome.quantity } : undefined,
    reputationBonus:   outcome.kind === 'rep'     ? outcome.amount  : undefined,
    hullRepair:        outcome.kind === 'repair'  ? outcome.hp      : undefined,
  };

  let mission: Mission | undefined;
  if (outcome.kind === 'mission') {
    // Generate a single mission appropriate to this location type
    const missionType: MissionType =
      locationType === 'armory'       ? 'bounty'   :
      locationType === 'black_market' ? 'smuggle'  :
      locationType === 'medbay'       ? 'emergency':
      locationType === 'cantina'      ? (Math.random() > 0.5 ? 'delivery' : 'courier') :
      locationType === 'lounge'       ? 'courier'  :
      locationType === 'info_broker'  ? 'survey'   :
      'delivery';

    const generated = generateMissions(currentPlanetId, planets, systems, gameDay, playerRep)
      .filter(m => m.type === missionType);
    mission = generated[0] ?? generateMissions(currentPlanetId, planets, systems, gameDay, playerRep)[0];
    if (mission) result.missionId = mission.id;
  }

  return { result, mission };
}

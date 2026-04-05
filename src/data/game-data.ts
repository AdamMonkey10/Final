import type { Good, GoodType, ShipTemplate, Planet, SolarSystem, SpaceportLocation, MarketEvent } from '@/types/game';

export const GOODS: Record<GoodType, Good> = {
  //                                                                   volatility  category
  food:       { type: 'food',       name: 'Food Rations',   basePrice: 30,  weight: 1, volatility: 0.20, category: 'legal',   icon: '🌾' },
  minerals:   { type: 'minerals',   name: 'Raw Minerals',   basePrice: 80,  weight: 2, volatility: 0.15, category: 'legal',   icon: '⛏️' },
  electronics:{ type: 'electronics',name: 'Electronics',    basePrice: 200, weight: 1, volatility: 0.25, category: 'legal',   icon: '💻' },
  fuel:       { type: 'fuel',       name: 'Fuel Cells',     basePrice: 50,  weight: 2, volatility: 0.30, category: 'legal',   icon: '⚡' },
  medicine:   { type: 'medicine',   name: 'Medicine',       basePrice: 150, weight: 1, volatility: 0.20, category: 'legal',   icon: '💊' },
  weapons:    { type: 'weapons',    name: 'Weapons',        basePrice: 400, weight: 2, volatility: 0.35, category: 'legal',   icon: '🔫' },
  luxury:     { type: 'luxury',     name: 'Luxury Goods',   basePrice: 500, weight: 1, volatility: 0.40, category: 'luxury',  icon: '💎' },
  machinery:  { type: 'machinery',  name: 'Machinery',      basePrice: 300, weight: 3, volatility: 0.15, category: 'legal',   icon: '⚙️' },
  rare_metals:{ type: 'rare_metals',name: 'Rare Metals',    basePrice: 600, weight: 2, volatility: 0.45, category: 'rare',    icon: '🏅' },
  contraband: { type: 'contraband', name: 'Contraband',     basePrice: 900, weight: 1, volatility: 0.50, category: 'illegal', isIllegal: true, icon: '☠️' },
};

// ── Market Event Templates ─────────────────────────────────────────────────────

type EventTemplate = Omit<MarketEvent, 'id' | 'expiresOnDay'>;

export const MARKET_EVENT_TEMPLATES: EventTemplate[] = [
  {
    type: 'shortage',
    title: 'Supply Shortage',
    description: 'Production disruption drives prices sharply higher.',
    affectedGoods: ['food', 'medicine'],
    priceMultiplier: 1.60,
    icon: '📉',
    badgeClass: 'border-red-800/60 bg-red-950/40 text-red-300',
  },
  {
    type: 'shortage',
    title: 'Fuel Crisis',
    description: 'Refinery strike leaves fuel cells critically scarce.',
    affectedGoods: ['fuel'],
    priceMultiplier: 1.80,
    icon: '⛽',
    badgeClass: 'border-orange-800/60 bg-orange-950/40 text-orange-300',
  },
  {
    type: 'boom',
    title: 'Economic Boom',
    description: 'Sector-wide growth raises demand for all goods.',
    affectedGoods: ['electronics', 'machinery', 'luxury'],
    priceMultiplier: 1.30,
    icon: '📈',
    badgeClass: 'border-green-800/60 bg-green-950/40 text-green-300',
  },
  {
    type: 'festival',
    title: 'Grand Festival',
    description: 'Cultural celebrations send luxury demand through the roof.',
    affectedGoods: ['luxury', 'food'],
    priceMultiplier: 1.50,
    icon: '🎉',
    badgeClass: 'border-yellow-800/60 bg-yellow-950/40 text-yellow-300',
  },
  {
    type: 'disruption',
    title: 'Pirate Disruption',
    description: 'Trade lanes blockaded. Essentials growing scarce.',
    affectedGoods: ['fuel', 'food', 'medicine'],
    priceMultiplier: 1.45,
    icon: '💀',
    badgeClass: 'border-red-900/60 bg-red-950/30 text-red-400',
  },
  {
    type: 'blackmarket_special',
    title: 'Black Market Deal',
    description: 'Illegal goods briefly available at knockdown prices.',
    affectedGoods: ['contraband', 'weapons'],
    priceMultiplier: 0.60,
    icon: '🤫',
    badgeClass: 'border-purple-800/60 bg-purple-950/40 text-purple-300',
  },
  {
    type: 'trade_war',
    title: 'Trade War',
    description: 'Diplomatic tensions spike import costs across the board.',
    affectedGoods: ['electronics', 'minerals', 'rare_metals'],
    priceMultiplier: 1.35,
    icon: '⚔️',
    badgeClass: 'border-red-800/40 bg-red-950/20 text-red-300',
  },
  {
    type: 'boom',
    title: 'Mining Surge',
    description: 'New deposits discovered. Metals and minerals flood the market.',
    affectedGoods: ['minerals', 'rare_metals'],
    priceMultiplier: 0.65,
    icon: '⛏️',
    badgeClass: 'border-amber-800/60 bg-amber-950/40 text-amber-300',
  },
];

export const SHIP_TEMPLATES: Record<string, import('@/types/game').ShipTemplate> = {
  scout: {
    class: 'scout', name: 'Scout Dart',
    description: 'Fast and nimble. Small cargo bay but great for exploration and combat.',
    price: 0, cargoCapacity: 15, speed: 8, maxShields: 30, maxHull: 60, weaponPower: 20, icon: '🚀',
  },
  trader: {
    class: 'trader', name: 'Merchant Hauler',
    description: 'Large cargo hold for maximum profit. Slow and weak in combat.',
    price: 8000, cargoCapacity: 50, speed: 4, maxShields: 20, maxHull: 80, weaponPower: 8, icon: '🛸',
  },
  gunship: {
    class: 'gunship', name: 'Gunship Viper',
    description: 'Built for combat. Decent cargo with heavy weapons and shields.',
    price: 15000, cargoCapacity: 25, speed: 6, maxShields: 60, maxHull: 100, weaponPower: 40, icon: '⚔️',
  },
  freighter: {
    class: 'freighter', name: 'Bulk Freighter',
    description: 'Massive cargo capacity. The ultimate trading vessel.',
    price: 25000, cargoCapacity: 100, speed: 3, maxShields: 40, maxHull: 120, weaponPower: 12, icon: '🏭',
  },
};

export const UPGRADE_COSTS: Record<string, number[]> = {
  cargo:   [1500, 3000, 6000],
  engine:  [2000, 4000, 8000],
  shields: [1500, 3000, 6000],
  weapons: [2000, 4000, 8000],
};

export const UPGRADE_LABELS: Record<string, string> = {
  cargo: 'Cargo Bay', engine: 'Engine', shields: 'Shield Generator', weapons: 'Weapons',
};

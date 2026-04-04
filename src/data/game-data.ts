import type { Good, GoodType, ShipTemplate, Planet, SolarSystem } from '@/types/game';

export const GOODS: Record<GoodType, Good> = {
  food:       { type: 'food',       name: 'Food Rations',   basePrice: 30,  weight: 1, icon: '🌾' },
  minerals:   { type: 'minerals',   name: 'Raw Minerals',   basePrice: 80,  weight: 2, icon: '⛏️' },
  electronics:{ type: 'electronics',name: 'Electronics',    basePrice: 200, weight: 1, icon: '💻' },
  fuel:       { type: 'fuel',       name: 'Fuel Cells',     basePrice: 50,  weight: 2, icon: '⚡' },
  medicine:   { type: 'medicine',   name: 'Medicine',       basePrice: 150, weight: 1, icon: '💊' },
  weapons:    { type: 'weapons',    name: 'Weapons',        basePrice: 400, weight: 2, icon: '🔫' },
  luxury:     { type: 'luxury',     name: 'Luxury Goods',   basePrice: 500, weight: 1, icon: '💎' },
  machinery:  { type: 'machinery',  name: 'Machinery',      basePrice: 300, weight: 3, icon: '⚙️' },
  rare_metals:{ type: 'rare_metals',name: 'Rare Metals',    basePrice: 600, weight: 2, icon: '🏅' },
  contraband: { type: 'contraband', name: 'Contraband',     basePrice: 900, weight: 1, isIllegal: true, icon: '☠️' },
};

export const SOLAR_SYSTEMS: SolarSystem[] = [
  {
    id: 'sol',
    name: 'Sol System',
    color: '#fbbf24',
    centerX: 490,
    centerY: 420,
    planetIds: ['new_terra', 'nova_gate', 'capital_reach'],
    description: 'The founding system of the Federation. Safe, prosperous, and well-connected.',
  },
  {
    id: 'iron_belt',
    name: 'Iron Belt',
    color: '#a78bfa',
    centerX: 185,
    centerY: 360,
    planetIds: ['iron_station', 'the_furnace', 'fuel_depot'],
    description: 'A dense cluster of industrial worlds built around asteroid mining.',
  },
  {
    id: 'nexus',
    name: 'Nexus Cluster',
    color: '#38bdf8',
    centerX: 790,
    centerY: 240,
    planetIds: ['nexus_prime', 'eureka_labs', 'trade_nexus'],
    description: 'The galaxy\'s centre of technology and commerce.',
  },
  {
    id: 'outer_rim',
    name: 'Outer Rim',
    color: '#f87171',
    centerX: 840,
    centerY: 650,
    planetIds: ['fort_kestrel', 'crystal_point', 'deep_core'],
    description: 'Lawless and dangerous, but rich in rare materials.',
  },
  {
    id: 'frontier',
    name: 'Frontier',
    color: '#4ade80',
    centerX: 215,
    centerY: 660,
    planetIds: ['green_haven', 'frontier_post', 'void_market'],
    description: 'The edge of explored space. High risk, high reward.',
  },
];

export const PLANET_TEMPLATES: Omit<Planet, 'market'>[] = [
  // ── Sol System ──────────────────────────────────────────────
  {
    id: 'new_terra', name: 'New Terra', economy: 'agricultural', systemId: 'sol',
    x: 490, y: 470,
    description: 'A lush colony world known for its vast farmlands and medical research.',
    faction: 'Federation', dangerLevel: 0, color: '#22c55e', icon: '🌍',
    produces: ['food', 'medicine'], consumes: ['electronics', 'machinery', 'fuel'],
  },
  {
    id: 'nova_gate', name: 'Nova Gate', economy: 'trading', systemId: 'sol',
    x: 400, y: 360,
    description: 'A busy waypoint station connecting the inner and outer systems.',
    faction: 'Federation', dangerLevel: 1, color: '#10b981', icon: '🌟',
    produces: ['luxury', 'food'], consumes: ['minerals', 'weapons', 'contraband'],
  },
  {
    id: 'capital_reach', name: 'Capital Reach', economy: 'trading', systemId: 'sol',
    x: 580, y: 350,
    description: 'The administrative capital of the Federation. Luxury and politics.',
    faction: 'Federation', dangerLevel: 0, color: '#8b5cf6', icon: '🏛️',
    produces: ['luxury', 'medicine'], consumes: ['rare_metals', 'minerals', 'weapons'],
  },
  // ── Iron Belt ────────────────────────────────────────────────
  {
    id: 'iron_station', name: 'Iron Station', economy: 'mining', systemId: 'iron_belt',
    x: 170, y: 240,
    description: 'A rough asteroid colony rich in mineral deposits.',
    faction: 'Independent', dangerLevel: 1, color: '#78716c', icon: '⛏️',
    produces: ['minerals', 'rare_metals', 'fuel'], consumes: ['food', 'electronics', 'medicine'],
  },
  {
    id: 'the_furnace', name: 'The Furnace', economy: 'industrial', systemId: 'iron_belt',
    x: 115, y: 450,
    description: 'A smog-filled industrial world churning out machinery day and night.',
    faction: "Worker's Union", dangerLevel: 1, color: '#f97316', icon: '🏭',
    produces: ['machinery', 'fuel'], consumes: ['minerals', 'food', 'electronics'],
  },
  {
    id: 'fuel_depot', name: 'Fuel Depot Alpha', economy: 'industrial', systemId: 'iron_belt',
    x: 265, y: 360,
    description: "The galaxy's largest fuel refinery. Cheap energy for all.",
    faction: 'Independent', dangerLevel: 0, color: '#eab308', icon: '⚡',
    produces: ['fuel', 'machinery'], consumes: ['minerals', 'food', 'electronics'],
  },
  // ── Nexus Cluster ────────────────────────────────────────────
  {
    id: 'nexus_prime', name: 'Nexus Prime', economy: 'tech', systemId: 'nexus',
    x: 870, y: 160,
    description: "The galaxy's premier technology hub. Innovation drives everything here.",
    faction: 'TechCorp Alliance', dangerLevel: 0, color: '#3b82f6', icon: '💻',
    produces: ['electronics', 'machinery'], consumes: ['rare_metals', 'minerals', 'food'],
  },
  {
    id: 'eureka_labs', name: 'Eureka Labs', economy: 'research', systemId: 'nexus',
    x: 710, y: 220,
    description: 'A research station pushing the boundaries of science.',
    faction: 'Science Guild', dangerLevel: 0, color: '#06b6d4', icon: '🔬',
    produces: ['medicine', 'electronics'], consumes: ['rare_metals', 'food', 'minerals'],
  },
  {
    id: 'trade_nexus', name: 'Trade Nexus', economy: 'trading', systemId: 'nexus',
    x: 800, y: 330,
    description: "The crossroads of the galaxy. Every good passes through here.",
    faction: 'Merchant Guild', dangerLevel: 0, color: '#f59e0b', icon: '🏪',
    produces: ['luxury'], consumes: ['machinery', 'minerals', 'contraband'],
  },
  // ── Outer Rim ────────────────────────────────────────────────
  {
    id: 'fort_kestrel', name: 'Fort Kestrel', economy: 'military', systemId: 'outer_rim',
    x: 820, y: 580,
    description: 'A heavily fortified military outpost at the edge of contested space.',
    faction: 'Imperial Fleet', dangerLevel: 1, color: '#ef4444', icon: '🛡️',
    produces: ['weapons'], consumes: ['food', 'fuel', 'machinery', 'minerals'],
  },
  {
    id: 'crystal_point', name: 'Crystal Point', economy: 'mining', systemId: 'outer_rim',
    x: 930, y: 720,
    description: 'Deep space mining of precious rare metals and crystal formations.',
    faction: 'Independent', dangerLevel: 2, color: '#ec4899', icon: '💎',
    produces: ['rare_metals', 'minerals'], consumes: ['food', 'medicine', 'electronics', 'weapons'],
  },
  {
    id: 'deep_core', name: 'Deep Core', economy: 'mining', systemId: 'outer_rim',
    x: 740, y: 700,
    description: 'Drills deep into planetary cores extracting rare heavy metals.',
    faction: 'Mining Consortium', dangerLevel: 2, color: '#b45309', icon: '🌋',
    produces: ['rare_metals', 'minerals', 'fuel'], consumes: ['food', 'electronics', 'machinery', 'medicine'],
  },
  // ── Frontier ─────────────────────────────────────────────────
  {
    id: 'green_haven', name: 'Green Haven', economy: 'agricultural', systemId: 'frontier',
    x: 200, y: 570,
    description: 'An agricultural paradise specialising in organic goods and pharmaceuticals.',
    faction: 'Federation', dangerLevel: 0, color: '#84cc16', icon: '🌿',
    produces: ['food', 'medicine'], consumes: ['electronics', 'fuel', 'machinery'],
  },
  {
    id: 'frontier_post', name: 'Frontier Post', economy: 'frontier', systemId: 'frontier',
    x: 115, y: 730,
    description: 'A desperate colony at the edge of explored space. They need everything.',
    faction: 'Settlers', dangerLevel: 2, color: '#6b7280', icon: '🪐',
    produces: ['minerals'], consumes: ['food', 'medicine', 'electronics', 'weapons', 'fuel', 'machinery'],
  },
  {
    id: 'void_market', name: 'Void Market', economy: 'blackmarket', systemId: 'frontier',
    x: 320, y: 700,
    description: 'No questions asked. No laws enforced. Bring credits, leave with anything.',
    faction: 'Shadow Syndicate', dangerLevel: 3, color: '#a855f7', icon: '💀',
    produces: ['contraband', 'weapons'], consumes: ['luxury', 'rare_metals', 'electronics'],
  },
];

export const SHIP_TEMPLATES: Record<string, ShipTemplate> = {
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

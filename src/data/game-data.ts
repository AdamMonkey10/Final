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

export const PLANET_TEMPLATES: Omit<Planet, 'market' | 'activeEvents'>[] = [
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
    description: 'A busy waypoint station connecting the inner and outer systems. Full spaceport facilities available.',
    faction: 'Federation', dangerLevel: 1, color: '#10b981', icon: '🌟',
    produces: ['luxury', 'food'], consumes: ['minerals', 'weapons', 'contraband'],
    isSpaceport: true,
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
    description: "The galaxy's largest fuel refinery. Spaceport services available for passing pilots.",
    faction: 'Independent', dangerLevel: 0, color: '#eab308', icon: '⚡',
    produces: ['fuel', 'machinery'], consumes: ['minerals', 'food', 'electronics'],
    isSpaceport: true,
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
    description: "The crossroads of the galaxy. Every good passes through here. Premier spaceport of the Nexus Cluster.",
    faction: 'Merchant Guild', dangerLevel: 0, color: '#f59e0b', icon: '🏪',
    produces: ['luxury'], consumes: ['machinery', 'minerals', 'contraband'],
    isSpaceport: true,
  },
  // ── Outer Rim ────────────────────────────────────────────────
  {
    id: 'fort_kestrel', name: 'Fort Kestrel', economy: 'military', systemId: 'outer_rim',
    x: 820, y: 580,
    description: 'A heavily fortified military outpost at the edge of contested space. Military spaceport with combat repairs.',
    faction: 'Imperial Fleet', dangerLevel: 1, color: '#ef4444', icon: '🛡️',
    produces: ['weapons'], consumes: ['food', 'fuel', 'machinery', 'minerals'],
    isSpaceport: true,
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
    description: 'An agricultural paradise specialising in organic goods and pharmaceuticals. The safest port in the Frontier.',
    faction: 'Federation', dangerLevel: 0, color: '#84cc16', icon: '🌿',
    produces: ['food', 'medicine'], consumes: ['electronics', 'fuel', 'machinery'],
    isSpaceport: true,
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

// ── Spaceport Locations ────────────────────────────────────────────────────────

export const SPACEPORT_LOCATIONS: Record<string, SpaceportLocation[]> = {
  nova_gate: [
    { id: 'nova_gate_cantina',  name: "Drifter's Cantina",   icon: '🍺', type: 'cantina',     description: 'A dimly lit bar where pilots share routes and whisper about contracts. Someone always needs a favour.' },
    { id: 'nova_gate_supply',   name: 'Supply Depot',        icon: '📦', type: 'supply_depot', description: 'Federation-stocked shelves. Sometimes surplus goods go unclaimed.' },
    { id: 'nova_gate_broker',   name: 'Info Broker',         icon: '📡', type: 'info_broker',  description: 'A shady dealer who trades in market secrets and route tips for the right price — or occasionally for free.' },
    { id: 'nova_gate_storage',  name: 'Overflow Storage',    icon: '🏚', type: 'storage',      description: "Unclaimed cargo bays from pilots who never came back. Management looks the other way." },
  ],
  fuel_depot: [
    { id: 'fuel_depot_hangar',  name: 'Repair Hangar',       icon: '🔩', type: 'hangar',       description: 'Grease-covered mechanics fix ships around the clock. Offcuts and spare parts are free if you ask nicely.' },
    { id: 'fuel_depot_workshop',name: 'Parts Workshop',      icon: '⚙️', type: 'workshop',     description: 'Surplus engine components and used machinery pile up here. Builders leave bits behind.' },
    { id: 'fuel_depot_storage', name: 'Fuel Reserve',        icon: '🛢', type: 'storage',      description: 'Overflow fuel drums and uncatalogued parts. Worth a look.' },
    { id: 'fuel_depot_market',  name: 'Black Market Stall',  icon: '🤫', type: 'black_market', description: 'No official signage, but everyone knows. Illegal goods and off-books work for trusted pilots.' },
  ],
  trade_nexus: [
    { id: 'trade_nexus_lounge', name: 'Merchant Lounge',     icon: '🥂', type: 'lounge',       description: 'Guild members network over drinks. Introductions can be worth more than credits.' },
    { id: 'trade_nexus_broker', name: 'Trade Intelligence',  icon: '📊', type: 'info_broker',  description: 'Live price feeds and insider tips. The Guild sells information but sometimes leaks it.' },
    { id: 'trade_nexus_supply', name: 'Guild Warehouse',     icon: '🏬', type: 'supply_depot', description: 'Mislabelled and misrouted crates accumulate here. Finders keepers.' },
    { id: 'trade_nexus_market', name: 'Back-Alley Exchange', icon: '🕵️', type: 'black_market', description: 'The Nexus officially bans contraband. Unofficially, this alley does brisk business.' },
  ],
  fort_kestrel: [
    { id: 'fort_kestrel_armory',name: 'Surplus Armory',      icon: '🔫', type: 'armory',       description: 'Decommissioned weapons and excess ordnance. Soldiers sometimes sell off surplus.' },
    { id: 'fort_kestrel_medbay',name: 'Field Medbay',        icon: '💊', type: 'medbay',       description: 'Military medics patch up civilians on quiet days. Supplies sometimes go spare.' },
    { id: 'fort_kestrel_cantina',name: "Soldiers' Mess",     icon: '🍺', type: 'cantina',      description: 'Off-duty troopers gamble and gossip. Bounty leads surface here regularly.' },
    { id: 'fort_kestrel_hangar',name: 'Salvage Yard',        icon: '🔩', type: 'hangar',       description: 'Wrecked ships stripped for parts. If you know what you want, you can find it.' },
  ],
  green_haven: [
    { id: 'green_haven_supply', name: 'Farm Co-op',          icon: '🌾', type: 'supply_depot', description: 'Colonist-run food co-op. They often have excess stock they are glad to share with friendly pilots.' },
    { id: 'green_haven_medbay', name: 'Clinic',              icon: '💊', type: 'medbay',       description: 'A small but well-stocked frontier clinic. The doctor patches ships as well as people.' },
    { id: 'green_haven_cantina',name: 'Settlers Tavern',     icon: '🍺', type: 'cantina',      description: "Frontier folk share news from the edge. There's always someone with a job needing done." },
    { id: 'green_haven_storage',name: 'Abandoned Homestead', icon: '🏚', type: 'storage',      description: 'A settler who left in a hurry. Their shed is still full of supplies.' },
  ],
};

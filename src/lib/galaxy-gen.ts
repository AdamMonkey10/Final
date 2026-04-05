import type {
  Planet, SolarSystem, GoodType, EconomyType, SpaceportLocation,
  SpaceportLocationType, StarType, GalaxyRegion,
} from '@/types/game';
import { GOODS } from '@/data/game-data';

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────────────────────

function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

// ── Static pools ──────────────────────────────────────────────────────────────

const STAR_COLORS: Record<StarType, string> = {
  yellow:      '#fbbf24',
  red_dwarf:   '#f87171',
  blue_giant:  '#60a5fa',
  binary:      '#f9a8d4',
  neutron:     '#c084fc',
  white_dwarf: '#94a3b8',
};

const STAR_ICONS: Record<StarType, string> = {
  yellow:      '☀️',
  red_dwarf:   '🔴',
  blue_giant:  '💙',
  binary:      '✨',
  neutron:     '⚡',
  white_dwarf: '🌑',
};

const SYSTEM_NAMES: Record<GalaxyRegion, string[]> = {
  core: [
    'Solaris Prime', 'Capital Reach', 'New Olympus', 'Haven Gate', 'Citadel Alpha',
    'Aether Core', 'Terminus Hub', 'Central Nexus',
  ],
  mid_rim: [
    'Kepler Station', 'Vega Crossing', 'Beta Crucis', 'Aurora Belt', 'Sigma Point',
    'Meridian', 'Junction Alpha', 'Trade Wind', 'Waypoint Seven', 'Delta Cygni',
    'Orion Gate', 'Cassini Node', 'Helix Port', 'Polaris Drift',
  ],
  outer_rim: [
    'Fort Exodus', 'Void Station', 'Dark Matter', 'Red Scar', 'Iron Wreck',
    'Bone Yard', 'Far Reach', 'Ultima Post', 'Forsaken Drift', 'Scavenger Base',
  ],
  deep_frontier: [
    'The Abyss', 'Dead Silence', 'Omega Station', 'Ghost Cluster',
    'Event Horizon', 'No Return', 'Ruin Field',
  ],
};

const PLANET_NAMES: Record<EconomyType, string[]> = {
  agricultural: ['Haven', 'Green World', 'Verdant', 'Harvest', 'Eden', 'Pastoral', 'Bloom'],
  mining:       ['Crater', 'Vein', 'Dig Site', 'Shard', 'Quarry', 'The Pit', 'Ore'],
  tech:         ['Circuit', 'Forge', 'Grid', 'Matrix', 'Flux', 'Core', 'Node'],
  industrial:   ['Factory', 'Works', 'Mill', 'Furnace', 'Smelter', 'Plant'],
  military:     ['Bastion', 'Rampart', 'Keep', 'Garrison', 'Citadel', 'Fort'],
  research:     ['Labs', 'Observatory', 'Archives', 'Institute', 'Probe', 'Survey'],
  trading:      ['Exchange', 'Bazaar', 'Market', 'Crossroads', 'Depot', 'Junction'],
  blackmarket:  ['Shadow', 'Underside', 'Vault', 'Contraband', 'Black Hold'],
  frontier:     ['Outpost', 'Waystation', 'Last Stop', 'Edge', 'Fringe'],
};

const PLANET_ICONS: Record<EconomyType, string> = {
  agricultural: '🌿', mining: '⛏️', tech: '💻', industrial: '🏭',
  military: '🛡️', research: '🔬', trading: '🏪', blackmarket: '💀', frontier: '🪐',
};

const PLANET_COLORS: Record<EconomyType, string> = {
  agricultural: '#22c55e', mining: '#78716c', tech: '#3b82f6', industrial: '#f97316',
  military: '#ef4444', research: '#06b6d4', trading: '#f59e0b', blackmarket: '#a855f7',
  frontier: '#6b7280',
};

const FACTIONS: Record<GalaxyRegion, string[]> = {
  core: ['Federation', 'Government', 'Science Guild', 'Trade Consortium'],
  mid_rim: ['Independent', 'Merchant Guild', "Worker's Union", 'TechCorp Alliance', 'Settlers'],
  outer_rim: ['Independent', 'Mining Consortium', 'Imperial Fleet', 'Free Worlds'],
  deep_frontier: ['Outlaws', 'Shadow Syndicate', 'Pirate Collective', 'Scavengers'],
};

const PLANET_DESCRIPTIONS: Record<EconomyType, string[]> = {
  agricultural: [
    'Fertile plains stretch to the horizon. Food and medicine flow from here across the sector.',
    'A quiet colony world where life is slow but crops are plentiful.',
    'Greenhouses cover this moon, supplying nearby systems with organic goods.',
  ],
  mining:  [
    'Drill platforms pierce every rock face. Minerals are cheap and safety is not.',
    'A barren asteroid colony rich in ore. The work is brutal and the pay barely covers it.',
    'Deep-core extraction pulls rare metals from kilometres underground.',
  ],
  tech: [
    'Blinking server towers and research labs packed into every available space.',
    'The premier technology hub in this sector. Innovation is the only currency that matters.',
    'Electronics roll off the assembly lines at all hours — demand never sleeps.',
  ],
  industrial: [
    'Smoke-stained skies and the constant grind of machinery mark this world.',
    'Everything is built here. Nothing is beautiful. Everything works.',
    'Industrial output feeds the sector\'s shipyards and construction projects.',
  ],
  military: [
    'A fortified outpost bristling with weapons emplacements. Trespassers are unwelcome.',
    'The garrison maintains order in the outer systems. They sell surplus to trusted pilots.',
    'Combat ships patrol the system at all times. Trade happens under watchful eyes.',
  ],
  research: [
    'Scientists here chase knowledge no one asked for — sometimes they find something useful.',
    'Sensor arrays and experimental labs dot this moon\'s cratered surface.',
    'A research station studying the local nebula. Well-stocked medical bay.',
  ],
  trading: [
    'A busy waypoint where every trade route intersects. Everything passes through.',
    'The crossroads of the sector. Merchants come and go at all hours.',
    'A free-port with no questions asked and competitive margins.',
  ],
  blackmarket: [
    'No faction controls this rock — which is exactly why business thrives.',
    'Illegal goods flow freely here. The law stopped trying to enforce anything years ago.',
    'The shadow economy is the only economy on this station.',
  ],
  frontier: [
    'A desperate colony at the edge of explored space. They need everything.',
    'The last stop before the void. Rare goods command brutal premiums.',
    'Settlers here survive on grit and whatever ships bring in.',
  ],
};

const SYSTEM_DESCRIPTIONS: Record<StarType, string> = {
  yellow:      'A stable yellow star supporting a diverse planetary system.',
  red_dwarf:   'A dim red star with resource-rich rocky worlds.',
  blue_giant:  'A massive blue star — intense radiation, industrial output.',
  binary:      'Twin stars locked in orbit, producing a chaotic but commerce-rich system.',
  neutron:     'The collapsed remnant of a giant star. Extreme density and danger.',
  white_dwarf: 'A dying white dwarf surrounded by the remnants of its former worlds.',
};

// ── Economy tables ────────────────────────────────────────────────────────────

const ECONOMY_BY_STAR: Record<StarType, EconomyType[]> = {
  yellow:      ['agricultural', 'trading', 'tech', 'research', 'agricultural', 'trading'],
  red_dwarf:   ['mining', 'industrial', 'mining', 'frontier', 'mining'],
  blue_giant:  ['tech', 'industrial', 'military', 'research', 'industrial'],
  binary:      ['trading', 'blackmarket', 'industrial', 'military', 'trading'],
  neutron:     ['mining', 'frontier', 'blackmarket', 'mining'],
  white_dwarf: ['mining', 'frontier', 'mining'],
};

const PLANET_COUNT_BY_STAR: Record<StarType, [number, number]> = {
  yellow:      [3, 5],
  red_dwarf:   [2, 4],
  blue_giant:  [2, 4],
  binary:      [3, 5],
  neutron:     [1, 3],
  white_dwarf: [1, 3],
};

const DANGER_BY_REGION: Record<GalaxyRegion, [number, number]> = {
  core:           [0, 0],
  mid_rim:        [0, 1],
  outer_rim:      [1, 2],
  deep_frontier:  [2, 3],
};

const PRODUCES_CONSUMES: Record<EconomyType, { p: GoodType[]; c: GoodType[] }> = {
  agricultural: { p: ['food', 'medicine'],           c: ['electronics', 'machinery', 'fuel'] },
  mining:       { p: ['minerals', 'rare_metals', 'fuel'], c: ['food', 'electronics', 'medicine'] },
  tech:         { p: ['electronics', 'machinery'],   c: ['rare_metals', 'minerals', 'food'] },
  industrial:   { p: ['machinery', 'fuel'],           c: ['minerals', 'food', 'electronics'] },
  military:     { p: ['weapons'],                     c: ['food', 'fuel', 'machinery', 'minerals'] },
  research:     { p: ['medicine', 'electronics'],    c: ['rare_metals', 'food', 'minerals'] },
  trading:      { p: ['luxury', 'food'],              c: ['minerals', 'weapons', 'contraband'] },
  blackmarket:  { p: ['contraband', 'weapons'],      c: ['luxury', 'rare_metals', 'electronics'] },
  frontier:     { p: ['minerals'],                    c: ['food', 'medicine', 'electronics', 'weapons', 'fuel', 'machinery'] },
};

// ── Spaceport location tables ─────────────────────────────────────────────────

const LOC_TYPES_BY_ECONOMY: Record<EconomyType, SpaceportLocationType[]> = {
  trading:      ['cantina', 'info_broker', 'supply_depot', 'storage'],
  mining:       ['hangar', 'workshop', 'storage', 'cantina'],
  industrial:   ['hangar', 'workshop', 'black_market', 'storage'],
  military:     ['armory', 'medbay', 'cantina', 'hangar'],
  agricultural: ['supply_depot', 'medbay', 'cantina', 'storage'],
  tech:         ['workshop', 'info_broker', 'lounge', 'supply_depot'],
  research:     ['medbay', 'info_broker', 'workshop', 'lounge'],
  blackmarket:  ['black_market', 'armory', 'storage', 'cantina'],
  frontier:     ['cantina', 'storage', 'supply_depot', 'hangar'],
};

type LocTemplate = { names: string[]; descs: string[]; icon: string };
const LOC_TEMPLATES: Record<SpaceportLocationType, LocTemplate> = {
  cantina: {
    icon: '🍺',
    names: ["Drifter's Cantina", 'The Last Drop', "Pilot's Rest", "Void's Edge Bar", 'The Hangar Bar'],
    descs: [
      'A dimly lit bar where pilots share routes and whisper about contracts.',
      'Cheap drinks and cheaper information for those who know how to ask.',
      'Weary traders gather here between runs. Someone always needs a favour.',
      'Dark, loud, and full of opportunity if you know how to listen.',
    ],
  },
  black_market: {
    icon: '🤫',
    names: ['Black Market Stall', 'Back-Alley Exchange', 'Shadow Dealer', 'The Underside', 'Off-Books Booth'],
    descs: [
      'No official signage, but everyone knows. Illegal goods move fast here.',
      'A hooded vendor trades in things the law pretends not to notice.',
      'The shadow economy is the only economy here. No questions asked.',
    ],
  },
  hangar: {
    icon: '🔩',
    names: ['Repair Hangar', 'Salvage Yard', 'Wreck Bay', 'Maintenance Dock', 'Scrap Works'],
    descs: [
      'Grease-covered mechanics fix ships around the clock. Offcuts are free if you ask.',
      'Wrecked ships stripped for parts. If you know what you want, you can find it.',
      'A busy dock humming with repair work. Friendly engineers share scraps.',
    ],
  },
  storage: {
    icon: '🏚',
    names: ['Overflow Storage', 'Abandoned Bay', 'Unclaimed Depot', 'Lost & Found', 'Forgotten Hold'],
    descs: [
      "Unclaimed cargo bays from pilots who never came back. Management looks the other way.",
      'An unlabelled warehouse with no manifest. Everything inside is up for grabs.',
      'Lost shipments pile up here. Nobody checks too carefully.',
    ],
  },
  info_broker: {
    icon: '📡',
    names: ['Info Broker', 'Trade Intelligence', 'Signal Post', 'Data Exchange', 'The Wire'],
    descs: [
      'A shady dealer who trades in market secrets and route tips.',
      'Live price feeds and insider tips. The Guild sells information but sometimes leaks it.',
      'A network hub for those who profit from knowing things before others do.',
    ],
  },
  supply_depot: {
    icon: '📦',
    names: ['Supply Depot', 'Guild Warehouse', 'Farm Co-op', 'Quartermaster', 'Stores'],
    descs: [
      'Federation-stocked shelves. Surplus goods sometimes go unclaimed.',
      'Mislabelled and misrouted crates accumulate here. Finders keepers.',
      'Colonist-run co-op with excess stock they are glad to share with friendly pilots.',
    ],
  },
  workshop: {
    icon: '⚙️',
    names: ['Parts Workshop', "Mechanic's Corner", 'Tech Bench', 'Engine Room', 'Machine Shop'],
    descs: [
      'Surplus engine components and used machinery pile up here.',
      'An apprentice needs practice hours. Your hull panels could benefit.',
      'A half-finished machine someone abandoned. The parts are useful.',
    ],
  },
  medbay: {
    icon: '💊',
    names: ['Field Medbay', 'Clinic', 'Infirmary', 'Medical Post', 'Aid Station'],
    descs: [
      'Military medics patch up civilians on quiet days. Supplies sometimes go spare.',
      'The doctor patches ships as well as people on slow days.',
      'A small but well-stocked frontier clinic run by retired Fleet medics.',
    ],
  },
  lounge: {
    icon: '🥂',
    names: ['Merchant Lounge', 'VIP Suite', 'Guild Parlour', 'Captains Quarters', 'The Executive'],
    descs: [
      'Guild members network over drinks. Introductions can be worth more than credits.',
      'A private lounge for established traders. The right word here opens doors.',
      'Wealthy merchants exchange market intelligence over expensive drinks.',
    ],
  },
  armory: {
    icon: '🔫',
    names: ['Surplus Armory', 'Arms Depot', 'Weapons Cache', 'Ordnance Store', 'The Arsenal'],
    descs: [
      'Decommissioned weapons and excess ordnance. Soldiers sometimes sell off surplus.',
      'Old military stock cleared for civilian sale. Prices are negotiable.',
      'A quartermaster clears inventory before inspection day.',
    ],
  },
};

// ── Placement helpers ─────────────────────────────────────────────────────────

const MAP_W = 1000, MAP_H = 800, CX = 500, CY = 400;
const MIN_SYSTEM_DIST = 135;

function placeSystems(
  rng: () => number,
  count: number,
  minR: number,
  maxR: number,
  existing: Array<{ x: number; y: number }>,
  maxAttempts = 200,
): Array<{ x: number; y: number }> {
  const placed: Array<{ x: number; y: number }> = [];
  let attempts = 0;
  while (placed.length < count && attempts < maxAttempts) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const r = minR + rng() * (maxR - minR);
    const x = Math.round(CX + Math.cos(angle) * r);
    const y = Math.round(CY + Math.sin(angle) * r);
    if (x < 70 || x > 930 || y < 60 || y > 740) continue;
    const all = [...existing, ...placed];
    if (all.some(s => Math.hypot(s.x - x, s.y - y) < MIN_SYSTEM_DIST)) continue;
    placed.push({ x, y });
  }
  return placed;
}

// ── Jump lane builder (k-nearest with connectivity guarantee) ─────────────────

function buildJumpLanes(systems: Array<{ id: string; x: number; y: number }>): Map<string, string[]> {
  const lanes = new Map<string, string[]>(systems.map(s => [s.id, []]));

  // Connect each system to its nearest 2-3 neighbours within 380px
  for (const a of systems) {
    const sorted = systems
      .filter(b => b.id !== a.id)
      .map(b => ({ id: b.id, dist: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter(b => b.dist < 380)
      .sort((p, q) => p.dist - q.dist);

    const k = sorted.length >= 3 ? 3 : sorted.length >= 2 ? 2 : sorted.length;
    for (let i = 0; i < k; i++) {
      const bId = sorted[i].id;
      if (!lanes.get(a.id)!.includes(bId)) lanes.get(a.id)!.push(bId);
      if (!lanes.get(bId)!.includes(a.id)) lanes.get(bId)!.push(a.id);
    }
  }

  // Ensure full connectivity (simple DFS + bridge edges)
  const visited = new Set<string>();
  const dfs = (id: string) => { visited.add(id); lanes.get(id)!.forEach(n => { if (!visited.has(n)) dfs(n); }); };
  dfs(systems[0].id);

  for (const sys of systems) {
    if (!visited.has(sys.id)) {
      // Find nearest already-connected system and bridge
      const connected = [...visited];
      const nearest = connected
        .map(cId => {
          const cs = systems.find(s => s.id === cId)!;
          return { id: cId, dist: Math.hypot(cs.x - sys.x, cs.y - sys.y) };
        })
        .sort((a, b) => a.dist - b.dist)[0];
      lanes.get(sys.id)!.push(nearest.id);
      lanes.get(nearest.id)!.push(sys.id);
      dfs(sys.id);
    }
  }

  return lanes;
}

// ── Spaceport location generator ──────────────────────────────────────────────

function genSpaceportLocations(
  planetId: string,
  economy: EconomyType,
  rng: () => number,
): SpaceportLocation[] {
  const types = LOC_TYPES_BY_ECONOMY[economy] ?? LOC_TYPES_BY_ECONOMY.trading;
  return types.map((locType, idx) => {
    const tpl = LOC_TEMPLATES[locType];
    const ni = Math.floor(rng() * tpl.names.length);
    const di = Math.floor(rng() * tpl.descs.length);
    return {
      id: `${planetId}_loc${idx}`,
      name: tpl.names[ni],
      icon: tpl.icon,
      description: tpl.descs[di],
      type: locType,
    };
  });
}

// ── Main generation ───────────────────────────────────────────────────────────

export function generateGalaxy(seed: number): { systems: SolarSystem[]; planets: Planet[] } {
  const rng = mkRng(seed);

  // ── 1. Define region layout
  const REGION_SPECS: Array<{ region: GalaxyRegion; count: number; minR: number; maxR: number }> = [
    { region: 'core',           count: 3,  minR: 0,   maxR: 120 },
    { region: 'mid_rim',        count: 8,  minR: 120, maxR: 290 },
    { region: 'outer_rim',      count: 5,  minR: 260, maxR: 410 },
    { region: 'deep_frontier',  count: 2,  minR: 390, maxR: 490 },
  ];

  // ── 2. Place system positions
  const allPositions: Array<{ x: number; y: number; region: GalaxyRegion }> = [];
  for (const spec of REGION_SPECS) {
    const placed = placeSystems(rng, spec.count, spec.minR, spec.maxR, allPositions.map(p => ({ x: p.x, y: p.y })));
    placed.forEach(pos => allPositions.push({ ...pos, region: spec.region }));
  }

  // ── 3. Pick star types per region
  const STAR_BY_REGION: Record<GalaxyRegion, StarType[]> = {
    core:          ['yellow', 'yellow', 'binary', 'yellow', 'white_dwarf'],
    mid_rim:       ['yellow', 'red_dwarf', 'blue_giant', 'binary', 'yellow', 'red_dwarf', 'yellow', 'blue_giant'],
    outer_rim:     ['red_dwarf', 'neutron', 'blue_giant', 'red_dwarf', 'white_dwarf'],
    deep_frontier: ['neutron', 'white_dwarf'],
  };
  const starTypePools: Record<GalaxyRegion, StarType[]> = {
    core:          [...STAR_BY_REGION.core],
    mid_rim:       [...STAR_BY_REGION.mid_rim],
    outer_rim:     [...STAR_BY_REGION.outer_rim],
    deep_frontier: [...STAR_BY_REGION.deep_frontier],
  };

  // ── 4. Build system names (no repeats per region)
  const usedNames: Record<GalaxyRegion, Set<string>> = {
    core: new Set(), mid_rim: new Set(), outer_rim: new Set(), deep_frontier: new Set(),
  };
  function pickName(region: GalaxyRegion): string {
    const pool = SYSTEM_NAMES[region];
    const unused = pool.filter(n => !usedNames[region].has(n));
    const chosen = unused.length > 0
      ? unused[Math.floor(rng() * unused.length)]
      : `${pool[Math.floor(rng() * pool.length)]} ${Math.floor(rng() * 9) + 2}`;
    usedNames[region].add(chosen);
    return chosen;
  }

  // ── 5. Generate systems + planets
  const systems: SolarSystem[] = [];
  const planets: Planet[] = [];
  const sysPositions: Array<{ id: string; x: number; y: number }> = [];

  // First system in core = starting system, always yellow, always spaceport
  for (let si = 0; si < allPositions.length; si++) {
    const { x, y, region } = allPositions[si];
    const isStart = si === 0; // first placed = core system closest to center

    const starPool = starTypePools[region];
    const starType: StarType = starPool.length > 0 ? starPool.splice(Math.floor(rng() * starPool.length), 1)[0] : 'yellow';
    const systemId = `sys_${si}`;
    const systemName = pickName(region);
    const color = STAR_COLORS[starType];

    const [minP, maxP] = PLANET_COUNT_BY_STAR[starType];
    const planetCount = minP + Math.floor(rng() * (maxP - minP + 1));
    const econPool = [...ECONOMY_BY_STAR[starType]];
    const [minD, maxD] = DANGER_BY_REGION[region];
    const factionPool = FACTIONS[region];
    const planetIds: string[] = [];

    // Place planets in a ring around system center (small offsets)
    const angleStep = (Math.PI * 2) / planetCount;
    const ringR = 35 + Math.floor(rng() * 20);

    for (let pi = 0; pi < planetCount; pi++) {
      const pId = `${systemId}_p${pi}`;
      const economy = econPool.splice(Math.floor(rng() * econPool.length), 1)[0] as EconomyType;
      const faction = factionPool[Math.floor(rng() * factionPool.length)];
      const danger = minD + Math.round(rng() * (maxD - minD));

      // Named after system + planet-type suffix
      const thematicNames = PLANET_NAMES[economy];
      const thematicName = thematicNames[Math.floor(rng() * thematicNames.length)];
      const planetName = pi === 0
        ? systemName  // first planet shares system name
        : `${systemName} — ${thematicName}`;

      const desc = PLANET_DESCRIPTIONS[economy][Math.floor(rng() * PLANET_DESCRIPTIONS[economy].length)];
      const { p: produces, c: consumes } = PRODUCES_CONSUMES[economy];

      // Polar position around system center
      const angle = angleStep * pi + rng() * 0.4 - 0.2;
      const px = Math.round(x + Math.cos(angle) * ringR);
      const py = Math.round(y + Math.sin(angle) * ringR);

      // Spaceport: first planet of first system in each region, or first in starting system
      const isSpaceport = (isStart && pi === 0)
        || (si === REGION_SPECS[0].count && pi === 0)     // first mid-rim
        || (si === REGION_SPECS[0].count + REGION_SPECS[1].count && pi === 0)   // first outer-rim
        || (si === allPositions.length - 1 && pi === 0);  // deep frontier

      const spaceportLocations = isSpaceport
        ? genSpaceportLocations(pId, economy, rng)
        : undefined;

      planets.push({
        id: pId,
        name: planetName,
        economy,
        systemId,
        x: px,
        y: py,
        market: [],        // filled by initializePlanets
        activeEvents: [],  // filled by initializePlanets
        description: desc,
        faction,
        dangerLevel: danger,
        color: PLANET_COLORS[economy],
        icon: PLANET_ICONS[economy],
        produces,
        consumes,
        isSpaceport,
        spaceportLocations,
      });
      planetIds.push(pId);
    }

    systems.push({
      id: systemId,
      name: systemName,
      color,
      centerX: x,
      centerY: y,
      planetIds,
      description: SYSTEM_DESCRIPTIONS[starType],
      starType,
      region,
      jumpLanes: [],      // filled below
      discovered: isStart || region === 'core', // core systems start discovered
    });
    sysPositions.push({ id: systemId, x, y });
  }

  // ── 6. Build jump lanes
  const laneMap = buildJumpLanes(sysPositions);
  systems.forEach(s => { s.jumpLanes = laneMap.get(s.id) ?? []; });

  return { systems, planets };
}

// ── Market seed helper (stable across IDs) ───────────────────────────────────

export function planetSeed(planetId: string, idx: number, gameDay: number): number {
  return (hashStr(planetId) + idx * 17 + gameDay * 3) & 0x7fffffff;
}

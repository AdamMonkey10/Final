import type { GameState, LocationId } from '../types/game';
import { LOCATIONS } from '../data/locations';

interface MapScreenProps {
  state: GameState;
  onClose: () => void;
  onTravel: (locationId: LocationId) => void;
}

// Node positions in a 500 × 360 viewBox
const NODE_POS: Record<LocationId, { x: number; y: number }> = {
  graveyard: { x: 120, y: 180 },
  bakery:    { x: 230, y:  80 },
  mansion:   { x: 300, y: 185 },
  swamp:     { x: 110, y: 290 },
  library:   { x: 230, y: 290 },
  castle:    { x: 400, y: 230 },
};

const CONNECTIONS: [LocationId, LocationId][] = [
  ['graveyard', 'bakery'],
  ['graveyard', 'mansion'],
  ['graveyard', 'swamp'],
  ['bakery',    'mansion'],
  ['swamp',     'library'],
  ['library',   'castle'],
  ['mansion',   'castle'],
];

// Decorative terrain details per location (drawn in SVG as small shapes)
const TERRAIN: Record<LocationId, { color: string; accent: string; terrain: string }> = {
  graveyard: { color: '#1a0f2e', accent: '#7c3aed', terrain: 'stone'   },
  bakery:    { color: '#1a100a', accent: '#c2410c', terrain: 'fire'    },
  mansion:   { color: '#0f1a1a', accent: '#0891b2', terrain: 'cobweb'  },
  swamp:     { color: '#0a1a0a', accent: '#15803d', terrain: 'water'   },
  library:   { color: '#0a0a1a', accent: '#7c3aed', terrain: 'books'   },
  castle:    { color: '#1a0a0a', accent: '#dc2626', terrain: 'flame'   },
};

const META: Record<LocationId, { emoji: string; label: string }> = {
  graveyard: { emoji: '🪦', label: 'Giggling\nGraveyard' },
  bakery:    { emoji: '🦴', label: 'Bonehead\nBakery'    },
  mansion:   { emoji: '🏚️', label: 'Haunted\nMansion'    },
  swamp:     { emoji: '🌿', label: 'Soggy Socks\nSwamp'  },
  library:   { emoji: '📚', label: 'Screaming\nLibrary'  },
  castle:    { emoji: '🏰', label: 'Castle\nDooooom'     },
};

export default function MapScreen({ state, onClose, onTravel }: MapScreenProps) {
  const current = state.currentLocation;
  const visited = new Set<LocationId>([current]);
  // Mark locations reachable from visited ones as accessible
  const isLocked = (id: LocationId) => {
    const loc = LOCATIONS[id];
    return !!(loc.requiredLevel && state.stats.level < loc.requiredLevel);
  };

  const handleTap = (id: LocationId) => {
    if (id === current || isLocked(id)) return;
    onTravel(id);
    onClose();
  };

  // Build midpoint control for curved paths
  const curve = (a: LocationId, b: LocationId) => {
    const p = NODE_POS[a], q = NODE_POS[b];
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    // Offset mid-point perpendicular to path for a gentle arc
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ox = (-dy / len) * 18;
    const oy = (dx / len) * 18;
    return `M${p.x},${p.y} Q${mx + ox},${my + oy} ${q.x},${q.y}`;
  };

  return (
    <div className="overlay-fullscreen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-spooky-purple shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗺️</span>
          <h2 className="font-pixel text-spooky-orange text-sm md:text-base">World Map</h2>
        </div>
        <button onClick={onClose} className="overlay-close-btn">✕</button>
      </div>

      {/* Map area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-3 overflow-hidden">
        <svg
          viewBox="0 0 500 360"
          className="w-full"
          style={{ maxHeight: '58vh', touchAction: 'manipulation' }}
          aria-label="Spooky Quest world map"
        >
          <defs>
            {/* Night sky gradient */}
            <radialGradient id="sky" cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#1a0a2e"/>
              <stop offset="100%" stopColor="#060410"/>
            </radialGradient>

            {/* Glow for current node */}
            <filter id="orange-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="purple-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="red-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="dim" x="-10%" y="-10%" width="120%" height="120%">
              <feColorMatrix type="saturate" values="0.15"/>
            </filter>

            {/* Path glow filter */}
            <filter id="path-glow">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>

            {/* Locked overlay pattern */}
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#4b5563" strokeWidth="1.5" opacity="0.4"/>
            </pattern>

            {/* Fog of war radial */}
            <radialGradient id="fog" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e1035" stopOpacity="0"/>
              <stop offset="100%" stopColor="#060410" stopOpacity="0.7"/>
            </radialGradient>
          </defs>

          {/* Background */}
          <rect width="500" height="360" fill="url(#sky)" rx="14"/>

          {/* Stars */}
          {[
            [40,30],[80,55],[150,20],[200,45],[320,25],[370,15],[450,40],
            [480,70],[460,130],[30,110],[65,190],[470,280],[490,180],
            [15,270],[25,160],[490,320],[450,340],[380,350],[300,340],
          ].map(([sx, sy], i) => (
            <circle key={i} cx={sx} cy={sy} r={i % 3 === 0 ? 1.5 : 1} fill="white" opacity={0.3 + (i % 4) * 0.15}>
              <animate attributeName="opacity"
                values={`${0.2 + (i%3)*0.2};${0.7 + (i%2)*0.2};${0.2 + (i%3)*0.2}`}
                dur={`${2 + (i % 4)}s`} repeatCount="indefinite"/>
            </circle>
          ))}

          {/* Decorative moon */}
          <circle cx="460" cy="50" r="22" fill="#fef3c7" opacity="0.12"/>
          <circle cx="470" cy="44" r="18" fill="#060410" opacity="0.7"/>

          {/* Ground texture band */}
          <ellipse cx="250" cy="340" rx="260" ry="30" fill="#0d0520" opacity="0.6"/>

          {/* ── Paths ── */}
          {CONNECTIONS.map(([a, b]) => {
            const locked = isLocked(a) || isLocked(b);
            const d = curve(a, b);
            return (
              <g key={`${a}-${b}`}>
                {/* glow layer */}
                {!locked && (
                  <path d={d} fill="none"
                    stroke="#a855f7" strokeWidth="4" opacity="0.25"
                    filter="url(#path-glow)" strokeLinecap="round"/>
                )}
                {/* main path */}
                <path d={d} fill="none"
                  stroke={locked ? '#374151' : '#7c3aed'}
                  strokeWidth={locked ? 1.5 : 2.5}
                  strokeDasharray={locked ? '3 7' : '7 5'}
                  strokeLinecap="round"
                  opacity={locked ? 0.3 : 0.9}>
                  {!locked && (
                    <animate attributeName="stroke-dashoffset"
                      values="0;-48" dur="3s" repeatCount="indefinite"/>
                  )}
                </path>
                {/* footstep dots on path */}
                {!locked && (
                  <path d={d} fill="none"
                    stroke="#c4b5fd" strokeWidth="1" opacity="0.35"
                    strokeDasharray="2 18" strokeLinecap="round">
                    <animate attributeName="stroke-dashoffset"
                      values="0;-20" dur="1.8s" repeatCount="indefinite"/>
                  </path>
                )}
              </g>
            );
          })}

          {/* ── Location Nodes ── */}
          {(Object.keys(NODE_POS) as LocationId[]).map(id => {
            const pos = NODE_POS[id];
            const meta = META[id];
            const terrain = TERRAIN[id];
            const isCurrent = id === current;
            const locked = isLocked(id);
            const lines = meta.label.split('\n');

            return (
              <g key={id} onClick={() => handleTap(id)}
                style={{ cursor: locked || isCurrent ? 'default' : 'pointer' }}>

                {/* Pulse ring for current */}
                {isCurrent && (
                  <>
                    <circle cx={pos.x} cy={pos.y} r="36" fill="none"
                      stroke="#f97316" strokeWidth="1.5" opacity="0">
                      <animate attributeName="r" values="30;46;30" dur="2.4s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx={pos.x} cy={pos.y} r="28" fill="none"
                      stroke="#fb923c" strokeWidth="2" opacity="0.5">
                      <animate attributeName="r" values="26;32;26" dur="1.8s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.8s" repeatCount="indefinite"/>
                    </circle>
                  </>
                )}

                {/* Outer hex ring */}
                <polygon
                  points={hexPoints(pos.x, pos.y, 28)}
                  fill={isCurrent ? '#3b0764' : locked ? '#0f0f1a' : terrain.color}
                  stroke={isCurrent ? '#f97316' : locked ? '#374151' : terrain.accent}
                  strokeWidth={isCurrent ? 2.5 : locked ? 1 : 1.5}
                  filter={isCurrent ? 'url(#orange-glow)' : locked ? undefined : 'url(#purple-glow)'}
                  opacity={locked ? 0.55 : 1}
                />

                {/* Inner hex */}
                <polygon
                  points={hexPoints(pos.x, pos.y, 21)}
                  fill={locked ? '#111827' : isCurrent ? '#4c1d95' : '#1e1035'}
                  opacity={locked ? 0.7 : 1}
                />

                {/* Hatch overlay for locked */}
                {locked && (
                  <polygon points={hexPoints(pos.x, pos.y, 21)}
                    fill="url(#hatch)" opacity="0.5"/>
                )}

                {/* Terrain micro-decoration */}
                {!locked && renderTerrain(pos.x, pos.y, terrain.terrain, terrain.accent)}

                {/* Emoji */}
                <text x={pos.x} y={pos.y + 7}
                  textAnchor="middle" fontSize={locked ? '13' : '17'}
                  opacity={locked ? 0.45 : 1}>
                  {locked ? '🔒' : meta.emoji}
                </text>

                {/* Label lines */}
                {lines.map((line, li) => (
                  <text key={li}
                    x={pos.x} y={pos.y + 40 + li * 13}
                    textAnchor="middle" fontSize="9"
                    fontFamily="Nunito, sans-serif" fontWeight="800"
                    fill={isCurrent ? '#fb923c' : locked ? '#4b5563' : '#ddd6fe'}
                    opacity={locked ? 0.6 : 1}>
                    {line}
                  </text>
                ))}

                {/* YOU HERE marker */}
                {isCurrent && (
                  <>
                    <polygon points={`${pos.x},${pos.y - 34} ${pos.x - 5},${pos.y - 44} ${pos.x + 5},${pos.y - 44}`}
                      fill="#f97316"/>
                    <text x={pos.x} y={pos.y - 47}
                      textAnchor="middle" fontSize="9"
                      fontFamily="Nunito, sans-serif" fontWeight="900"
                      fill="#f97316">
                      YOU
                    </text>
                  </>
                )}

                {/* Lvl badge for locked */}
                {locked && (
                  <text x={pos.x} y={pos.y + 67}
                    textAnchor="middle" fontSize="8"
                    fontFamily="Nunito, sans-serif" fontWeight="700"
                    fill="#dc2626" opacity="0.85">
                    Lvl {LOCATIONS[id].requiredLevel}+ needed
                  </text>
                )}
              </g>
            );
          })}

          {/* Map title watermark */}
          <text x="250" y="352" textAnchor="middle" fontSize="8"
            fontFamily="'Press Start 2P', monospace" fill="#6b21a8" opacity="0.4">
            THE GIGGLING GRAVEYARD
          </text>
        </svg>

        {/* Quick travel grid */}
        <div className="w-full max-w-md shrink-0">
          <p className="font-game text-gray-500 text-xs text-center mb-2">TAP TO FAST-TRAVEL</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(META) as LocationId[]).map(id => {
              const isCurrent = id === current;
              const locked = isLocked(id);
              return (
                <button key={id}
                  onClick={() => handleTap(id)}
                  disabled={isCurrent || locked}
                  className={`
                    flex items-center gap-2 px-3 py-3 rounded-xl border-2 active:scale-95 transition-transform min-h-[52px]
                    ${isCurrent
                      ? 'border-orange-500 bg-purple-950 cursor-default'
                      : locked
                        ? 'border-gray-800 bg-gray-950 opacity-40 cursor-not-allowed'
                        : 'border-spooky-purple bg-spooky-card'}
                  `}>
                  <span className="text-xl shrink-0">{locked ? '🔒' : META[id].emoji}</span>
                  <span className={`font-game text-xs leading-tight text-left ${isCurrent ? 'text-orange-400 font-bold' : 'text-spooky-text'}`}>
                    {META[id].label.replace('\n', ' ')}
                    {isCurrent ? ' ★' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: hexagon points string centred at cx,cy with radius r
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

// Tiny terrain decorations inside node
function renderTerrain(cx: number, cy: number, type: string, accent: string) {
  switch (type) {
    case 'stone':
      return (
        <g opacity="0.35">
          <rect x={cx - 12} y={cy - 6} width="6" height="4" rx="1" fill={accent}/>
          <rect x={cx + 5}  y={cy - 5} width="5" height="3" rx="1" fill={accent}/>
        </g>
      );
    case 'fire':
      return (
        <g opacity="0.4">
          <ellipse cx={cx} cy={cy - 2} rx="3" ry="5" fill="#f97316">
            <animate attributeName="ry" values="5;7;5" dur="0.8s" repeatCount="indefinite"/>
          </ellipse>
        </g>
      );
    case 'cobweb':
      return (
        <g stroke={accent} strokeWidth="0.8" opacity="0.3" fill="none">
          <line x1={cx - 10} y1={cy - 8} x2={cx + 10} y2={cy + 8}/>
          <line x1={cx + 10} y1={cy - 8} x2={cx - 10} y2={cy + 8}/>
          <circle cx={cx} cy={cy} r="8"/>
        </g>
      );
    case 'water':
      return (
        <g opacity="0.35">
          <path d={`M${cx - 10},${cy} Q${cx - 5},${cy - 4} ${cx},${cy} Q${cx + 5},${cy + 4} ${cx + 10},${cy}`}
            fill="none" stroke={accent} strokeWidth="1.5">
            <animateTransform attributeName="transform" type="translate"
              values="0,0;0,-2;0,0" dur="2s" repeatCount="indefinite"/>
          </path>
        </g>
      );
    case 'books':
      return (
        <g opacity="0.4">
          <rect x={cx - 11} y={cy - 4} width="4" height="8" rx="0.5" fill={accent}/>
          <rect x={cx - 6}  y={cy - 6} width="3" height="10" rx="0.5" fill="#818cf8"/>
          <rect x={cx - 2}  y={cy - 3} width="4" height="7"  rx="0.5" fill={accent}/>
        </g>
      );
    case 'flame':
      return (
        <g opacity="0.4">
          <ellipse cx={cx - 6} cy={cy - 2} rx="2" ry="4" fill="#ef4444">
            <animate attributeName="ry" values="4;6;4" dur="0.9s" repeatCount="indefinite"/>
          </ellipse>
          <ellipse cx={cx + 6} cy={cy - 2} rx="2" ry="4" fill="#f97316">
            <animate attributeName="ry" values="4;6;4" dur="1.1s" repeatCount="indefinite"/>
          </ellipse>
        </g>
      );
    default:
      return null;
  }
}

import type { GameState, LocationId } from '../types/game';
import { LOCATIONS } from '../data/locations';

interface MapScreenProps {
  state: GameState;
  onClose: () => void;
  onTravel: (locationId: LocationId) => void;
}

// Map node positions (as % of SVG viewBox 0 0 400 300)
const NODE_POSITIONS: Record<LocationId, { x: number; y: number }> = {
  graveyard: { x: 120, y: 150 },
  bakery:    { x: 220, y:  60 },
  mansion:   { x: 280, y: 150 },
  swamp:     { x: 120, y: 240 },
  library:   { x: 220, y: 240 },
  castle:    { x: 360, y: 195 },
};

// Connections to draw (undirected, list each pair once)
const CONNECTIONS: [LocationId, LocationId][] = [
  ['graveyard', 'bakery'],
  ['graveyard', 'mansion'],
  ['graveyard', 'swamp'],
  ['bakery',    'mansion'],
  ['swamp',     'library'],
  ['library',   'castle'],
  ['mansion',   'castle'],
];

const LOCATION_META: Record<LocationId, { emoji: string; label: string; short: string }> = {
  graveyard: { emoji: '🪦', label: 'Giggling Graveyard', short: 'Graveyard' },
  bakery:    { emoji: '🦴', label: 'Bonehead Bakery',    short: 'Bakery'    },
  mansion:   { emoji: '🏚️', label: 'Haunted Mansion',    short: 'Mansion'   },
  swamp:     { emoji: '🌿', label: 'Soggy Socks Swamp',  short: 'Swamp'     },
  library:   { emoji: '📚', label: 'Screaming Library',  short: 'Library'   },
  castle:    { emoji: '🏰', label: 'Castle Dooooom',     short: 'Castle'    },
};

export default function MapScreen({ state, onClose, onTravel }: MapScreenProps) {
  const current = state.currentLocation;

  const handleNodeTap = (locId: LocationId) => {
    if (locId === current) return; // already here
    const loc = LOCATIONS[locId];
    if (loc.requiredLevel && state.stats.level < loc.requiredLevel) return; // locked
    onTravel(locId);
    onClose();
  };

  const isLocked = (locId: LocationId) => {
    const loc = LOCATIONS[locId];
    return loc.requiredLevel && state.stats.level < loc.requiredLevel;
  };

  return (
    <div className="overlay-fullscreen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-spooky-purple shrink-0">
        <h2 className="font-pixel text-spooky-orange text-base">🗺️ World Map</h2>
        <button onClick={onClose} className="overlay-close-btn">✕</button>
      </div>

      {/* Map SVG */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        <svg
          viewBox="0 0 400 300"
          className="w-full max-w-lg"
          style={{ maxHeight: '55vh' }}
          aria-label="Game world map"
        >
          {/* Background */}
          <rect width="400" height="300" fill="#0d0720" rx="12" />

          {/* Subtle grid texture */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e1035" strokeWidth="0.5"/>
            </pattern>
            {/* Glow filter for current location */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Pulse animation for current node */}
            <filter id="pulse-glow">
              <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <rect width="400" height="300" fill="url(#grid)" rx="12" />

          {/* Connection paths */}
          {CONNECTIONS.map(([a, b]) => {
            const pa = NODE_POSITIONS[a];
            const pb = NODE_POSITIONS[b];
            const locked = isLocked(a) || isLocked(b);
            // Curved midpoint for visual flair
            const mx = (pa.x + pb.x) / 2;
            const my = (pa.y + pb.y) / 2;
            return (
              <line
                key={`${a}-${b}`}
                x1={pa.x} y1={pa.y}
                x2={pb.x} y2={pb.y}
                stroke={locked ? '#374151' : '#6b21a8'}
                strokeWidth={locked ? 1 : 2}
                strokeDasharray={locked ? '4 6' : '6 4'}
                strokeLinecap="round"
                opacity={locked ? 0.4 : 0.8}
              />
            );
          })}

          {/* Location nodes */}
          {(Object.entries(NODE_POSITIONS) as [LocationId, { x: number; y: number }][]).map(([locId, pos]) => {
            const meta = LOCATION_META[locId];
            const isCurrent = locId === current;
            const locked = isLocked(locId);

            return (
              <g
                key={locId}
                onClick={() => handleNodeTap(locId)}
                style={{ cursor: locked || isCurrent ? 'default' : 'pointer' }}
              >
                {/* Outer ring for current location */}
                {isCurrent && (
                  <>
                    <circle cx={pos.x} cy={pos.y} r="28" fill="none" stroke="#f97316" strokeWidth="2" opacity="0.6">
                      <animate attributeName="r" values="26;32;26" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite"/>
                    </circle>
                  </>
                )}

                {/* Node circle */}
                <circle
                  cx={pos.x} cy={pos.y} r="22"
                  fill={isCurrent ? '#4c1d95' : locked ? '#111827' : '#1e1035'}
                  stroke={isCurrent ? '#f97316' : locked ? '#374151' : '#6b21a8'}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                  filter={isCurrent ? 'url(#pulse-glow)' : undefined}
                  opacity={locked ? 0.6 : 1}
                />

                {/* Emoji */}
                <text
                  x={pos.x} y={pos.y + 6}
                  textAnchor="middle"
                  fontSize={locked ? '14' : '18'}
                  opacity={locked ? 0.5 : 1}
                >
                  {locked ? '🔒' : meta.emoji}
                </text>

                {/* Label */}
                <text
                  x={pos.x} y={pos.y + 36}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="Nunito, sans-serif"
                  fontWeight="700"
                  fill={isCurrent ? '#f97316' : locked ? '#4b5563' : '#c4b5fd'}
                >
                  {meta.short}
                </text>

                {/* "YOU" marker */}
                {isCurrent && (
                  <text
                    x={pos.x} y={pos.y - 28}
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="Nunito, sans-serif"
                    fontWeight="800"
                    fill="#f97316"
                  >
                    ▼ YOU
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 text-sm font-game">
          <span className="flex items-center gap-1 text-spooky-orange">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"/> You are here
          </span>
          <span className="flex items-center gap-1 text-purple-400">
            <span className="w-3 h-3 rounded-full bg-purple-800 inline-block"/> Accessible
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <span className="w-3 h-3 rounded-full bg-gray-800 inline-block"/> Locked
          </span>
        </div>

        {/* Location tap list for accessibility + clarity */}
        <div className="w-full max-w-md">
          <p className="font-game text-gray-500 text-xs text-center mb-2">TAP A LOCATION TO TRAVEL THERE</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(LOCATION_META) as [LocationId, typeof LOCATION_META[LocationId]][]).map(([locId, meta]) => {
              const isCurrent = locId === current;
              const locked = isLocked(locId);
              return (
                <button
                  key={locId}
                  onClick={() => handleNodeTap(locId)}
                  disabled={isCurrent || !!locked}
                  className={`
                    flex items-center gap-2 p-3 rounded-xl border-2 active:scale-95 transition-transform min-h-[52px]
                    ${isCurrent
                      ? 'border-spooky-orange bg-purple-950 cursor-default'
                      : locked
                        ? 'border-gray-800 bg-gray-950 opacity-40 cursor-not-allowed'
                        : 'border-spooky-purple bg-spooky-card'}
                  `}
                >
                  <span className="text-2xl">{locked ? '🔒' : meta.emoji}</span>
                  <div className="text-left">
                    <p className={`font-game text-xs font-bold leading-tight ${isCurrent ? 'text-spooky-orange' : 'text-spooky-text'}`}>
                      {meta.short}
                      {isCurrent && ' ★'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

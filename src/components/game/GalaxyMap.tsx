import { useState, useRef, useCallback } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getTravelDistance, getTravelDuration, getShipEffectiveStats, getTravelFuelCost } from '@/lib/game-engine';
import type { Planet, SolarSystem } from '@/types/game';
import { StarField } from './StarField';

const MAP_W = 1000;
const MAP_H = 800;

const STAR_ICONS: Record<string, string> = {
  yellow: '☀️', red_dwarf: '🔴', blue_giant: '💙',
  binary: '✨', neutron: '⚡', white_dwarf: '🌑',
};
const REGION_LABELS: Record<string, string> = {
  core: 'CORE', mid_rim: 'MID-RIM', outer_rim: 'OUTER RIM', deep_frontier: 'FRONTIER',
};

export function GalaxyMap() {
  const { state, travelTo, currentPlanet } = useGame();
  const { player, planets, systems } = state;

  const [selectedSystem, setSelectedSystem] = useState<SolarSystem | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<Planet | null>(null);
  const [scale, setScale] = useState(0.9);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const effective = getShipEffectiveStats(player.ship);
  const currentSystem = systems.find(s => s.planetIds.includes(player.currentPlanetId));

  // When system selected, default-select its first planet
  function selectSystem(sys: SolarSystem) {
    if (!sys.discovered) return;
    setSelectedSystem(prev => prev?.id === sys.id ? null : sys);
    const firstPlanet = planets.find(p => p.id === sys.planetIds[0]);
    setSelectedPlanet(firstPlanet ?? null);
  }

  const distToSelected = selectedPlanet ? getTravelDistance(currentPlanet, selectedPlanet) : 0;
  const etaSec      = selectedPlanet ? Math.round(getTravelDuration(distToSelected, effective.speed) / 1000) : 0;
  const fuelCost    = selectedPlanet ? getTravelFuelCost(distToSelected, player.ship.upgrades.engine) : 0;
  const canAfford   = player.credits >= fuelCost;
  const isSelf      = selectedPlanet?.id === player.currentPlanetId;
  const isCrossSystem = selectedSystem && currentSystem && selectedSystem.id !== currentSystem.id;

  function handleTravel() {
    if (!selectedPlanet || isSelf) return;
    travelTo(selectedPlanet.id);
    setSelectedSystem(null);
    setSelectedPlanet(null);
  }

  // Pan
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-sys]')) return;
    dragging.current = true;
    didDrag.current = false;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onPointerUp = () => { dragging.current = false; };
  const resetView = useCallback(() => { setScale(0.9); setOffset({ x: 0, y: 0 }); }, []);

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-[#050510]">
      <div
        className="relative flex-1 min-h-0 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <StarField count={180} />

        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${scale}) translate(${offset.x / scale}px,${offset.y / scale}px)`,
            transformOrigin: 'center',
          }}
        >
          <defs>
            {systems.filter(s => s.discovered).map(sys => (
              <radialGradient key={sys.id} id={`grad-${sys.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={sys.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={sys.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* Jump lanes — only between discovered systems */}
          {systems.map(sysA =>
            sysA.jumpLanes.map(bId => {
              const sysB = systems.find(s => s.id === bId);
              if (!sysB || sysA.id >= sysB.id) return null;
              const bothDiscovered = sysA.discovered && sysB.discovered;
              const eitherDiscovered = sysA.discovered || sysB.discovered;
              if (!eitherDiscovered) return null;
              return (
                <line key={`${sysA.id}-${bId}`}
                  x1={sysA.centerX} y1={sysA.centerY}
                  x2={sysB.centerX} y2={sysB.centerY}
                  stroke={bothDiscovered ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.08)'}
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                />
              );
            })
          )}

          {/* Travel vector to selected */}
          {selectedPlanet && !isSelf && (
            <line
              x1={currentPlanet.x} y1={currentPlanet.y}
              x2={selectedPlanet.x} y2={selectedPlanet.y}
              stroke="rgba(250,200,50,0.55)" strokeWidth="1.5" strokeDasharray="7 4"
              className="animate-pulse"
            />
          )}

          {/* System nodes */}
          {systems.map(sys => {
            const isCurrent = sys.id === currentSystem?.id;
            const isSelected = selectedSystem?.id === sys.id;
            const planet0 = planets.find(p => p.id === sys.planetIds[0]);
            const hasVisited = sys.planetIds.some(id => player.visitedPlanets.includes(id));
            const isNeighbour = currentSystem?.jumpLanes.includes(sys.id);

            if (!sys.discovered) {
              // Unknown system — show dim "?" if it's a neighbour of a discovered system
              const adjacentToDiscovered = systems.some(
                s => s.discovered && s.jumpLanes.includes(sys.id)
              );
              if (!adjacentToDiscovered) return null;
              return (
                <g key={sys.id} style={{ cursor: 'default' }}>
                  <circle cx={sys.centerX} cy={sys.centerY} r={16}
                    fill="#0f172a" stroke="#334155" strokeWidth="1" />
                  <text x={sys.centerX} y={sys.centerY + 5} textAnchor="middle"
                    fontSize="13" fill="#475569" fontFamily="monospace">?</text>
                  <text x={sys.centerX} y={sys.centerY + 27} textAnchor="middle"
                    fontSize="8" fill="#334155" fontFamily="monospace">UNKNOWN</text>
                </g>
              );
            }

            return (
              <g key={sys.id} data-sys="1"
                style={{ cursor: 'pointer' }}
                onClick={() => !didDrag.current && selectSystem(sys)}
              >
                {/* Glow */}
                <circle cx={sys.centerX} cy={sys.centerY} r={50}
                  fill={`url(#grad-${sys.id})`} />
                {/* Pulse ring for current */}
                {isCurrent && (
                  <circle cx={sys.centerX} cy={sys.centerY} r={24}
                    fill="none" stroke={sys.color} strokeWidth="1.5" opacity="0.4"
                    className="animate-ping" style={{ animationDuration: '3s' }} />
                )}
                {/* Selection ring */}
                {isSelected && (
                  <circle cx={sys.centerX} cy={sys.centerY} r={26}
                    fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.9"
                    className="animate-pulse" />
                )}
                {/* Neighbour hint */}
                {isNeighbour && !isCurrent && !isSelected && (
                  <circle cx={sys.centerX} cy={sys.centerY} r={22}
                    fill="none" stroke={sys.color} strokeWidth="1" opacity="0.3"
                    strokeDasharray="3 4" />
                )}
                {/* Main circle */}
                <circle cx={sys.centerX} cy={sys.centerY} r={18}
                  fill={hasVisited ? sys.color + '30' : '#0f172a'}
                  stroke={isCurrent ? sys.color : isSelected ? '#fbbf24' : sys.color}
                  strokeWidth={isCurrent ? 2 : 1.5}
                  strokeOpacity={isCurrent ? 1 : isSelected ? 0.9 : 0.5}
                />
                {/* Star icon */}
                <text x={sys.centerX} y={sys.centerY + 6} textAnchor="middle"
                  fontSize="14">{STAR_ICONS[sys.starType] ?? '⭐'}</text>
                {/* Spaceport badge */}
                {planet0?.isSpaceport && (
                  <text x={sys.centerX + 14} y={sys.centerY - 10} fontSize="9">⚓</text>
                )}
                {/* System name */}
                <text x={sys.centerX} y={sys.centerY + 33} textAnchor="middle"
                  fontSize="9" fontFamily="monospace" fontWeight="bold"
                  fill={isCurrent ? '#fff' : isSelected ? '#fbbf24' : hasVisited ? sys.color : '#475569'}
                  opacity={isCurrent ? 1 : 0.85}
                >
                  {sys.name.toUpperCase()}
                </text>
                {/* Region label — tiny, below name */}
                <text x={sys.centerX} y={sys.centerY + 44} textAnchor="middle"
                  fontSize="7" fontFamily="monospace"
                  fill={isCurrent ? '#94a3b8' : '#374151'}
                >
                  {REGION_LABELS[sys.region]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {[['＋', () => setScale(s => Math.min(s + 0.25, 3))],
            ['－', () => setScale(s => Math.max(s - 0.25, 0.4))],
            ['⊙', resetView]].map(([label, fn], i) => (
            <button key={i} onClick={fn as () => void}
              className="w-8 h-8 bg-black/60 border border-cyan-800 text-cyan-400 rounded text-base flex items-center justify-center active:bg-cyan-900/30">
              {label as string}
            </button>
          ))}
        </div>

        {/* Current system badge */}
        {currentSystem && (
          <div className="absolute top-3 left-3 text-[10px] font-mono px-2 py-1 rounded border"
            style={{ borderColor: currentSystem.color + '60', color: currentSystem.color, backgroundColor: currentSystem.color + '18' }}>
            📍 {currentSystem.name} · {REGION_LABELS[currentSystem.region]}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-600 space-y-0.5">
          <div>☀️🔴💙✨⚡🌑 = Star types</div>
          <div>? = Undiscovered system</div>
          <div>⚓ = Spaceport</div>
        </div>
      </div>

      {/* Selected system panel */}
      {selectedSystem && (
        <div className="border-t border-cyan-900/60 bg-black/80 shrink-0">
          {/* System header */}
          <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2 border-b border-gray-800/50">
            <span className="text-xl">{STAR_ICONS[selectedSystem.starType]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-sm">{selectedSystem.name}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase"
                  style={{ color: selectedSystem.color, backgroundColor: selectedSystem.color + '20', border: `1px solid ${selectedSystem.color}40` }}>
                  {REGION_LABELS[selectedSystem.region]}
                </span>
              </div>
              <div className="text-gray-500 text-[10px] font-mono mt-0.5">{selectedSystem.description}</div>
            </div>
          </div>

          {/* Planet list */}
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {selectedSystem.planetIds.map(pid => {
              const p = planets.find(pl => pl.id === pid);
              if (!p) return null;
              const isHere = p.id === player.currentPlanetId;
              const isChosen = selectedPlanet?.id === p.id;
              return (
                <button key={pid}
                  onClick={() => setSelectedPlanet(isChosen ? null : p)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border font-mono transition-all ${
                    isHere
                      ? 'border-green-600 bg-green-900/30 text-green-300 cursor-default'
                      : isChosen
                      ? 'border-yellow-500 bg-yellow-900/30 text-yellow-200'
                      : 'border-gray-700 bg-gray-900/50 text-gray-300 active:border-gray-500'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span className="max-w-[90px] truncate">{p.name}</span>
                  {isHere && <span className="text-green-500">◉</span>}
                  {p.isSpaceport && !isHere && <span className="text-yellow-500 text-[9px]">⚓</span>}
                </button>
              );
            })}
          </div>

          {/* Travel bar — shown when planet selected and not current */}
          {selectedPlanet && !isSelf && (
            <div className="px-3 pb-2.5 flex items-center gap-2">
              <div className="flex-1 text-xs font-mono space-y-0.5">
                <div className="text-gray-300">
                  {selectedPlanet.icon} <span className="font-bold">{selectedPlanet.name}</span>
                  <span className="text-gray-500 ml-1.5 capitalize">{selectedPlanet.economy} · {selectedPlanet.faction}</span>
                </div>
                <div className="flex gap-3 text-[10px] flex-wrap">
                  <span className={isCrossSystem ? 'text-orange-400' : 'text-cyan-400'}>
                    {isCrossSystem ? '🌌 Jump' : '🚀 Fly'} ~{etaSec}s
                  </span>
                  <span className={canAfford ? 'text-yellow-400' : 'text-red-400'}>⛽ {fuelCost}cr</span>
                  {selectedPlanet.dangerLevel > 0 && (
                    <span className="text-red-400">⚠ Danger {selectedPlanet.dangerLevel}/3</span>
                  )}
                </div>
              </div>
              <button onClick={handleTravel}
                disabled={!canAfford}
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition-colors shrink-0">
                {!canAfford ? 'No Fuel' : isCrossSystem ? 'JUMP 🌌' : 'FLY 🚀'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

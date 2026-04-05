import { useState, useRef, useCallback } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getTravelDistance, getTravelDuration, getShipEffectiveStats, getTravelFuelCost } from '@/lib/game-engine';
import type { Planet } from '@/types/game';
import { StarField } from './StarField';

const MAP_W = 1000;
const MAP_H = 800;
const SYSTEM_RADIUS = 105;

export function GalaxyMap() {
  const { state, travelTo, currentPlanet } = useGame();
  const { player, planets, systems } = state;
  const [selected, setSelected] = useState<Planet | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const effective = getShipEffectiveStats(player.ship);
  const currentSystem = systems.find(s => s.planetIds.includes(player.currentPlanetId));

  const handleSelect = (planet: Planet) => {
    if (planet.id === player.currentPlanetId) return;
    setSelected(prev => prev?.id === planet.id ? null : planet);
  };

  const handleTravel = () => {
    if (!selected || selected.id === player.currentPlanetId) return;
    travelTo(selected.id);
    setSelected(null);
  };

  const distanceToSelected = selected ? getTravelDistance(currentPlanet, selected) : 0;
  const etaSec    = selected ? Math.round(getTravelDuration(distanceToSelected, effective.speed) / 1000) : 0;
  const fuelCost  = selected ? getTravelFuelCost(distanceToSelected, player.ship.upgrades.engine) : 0;
  const canAffordFuel = player.credits >= fuelCost;
  const selectedSystem = selected ? systems.find(s => s.planetIds.includes(selected.id)) : null;
  const isCrossSystem = selectedSystem && currentSystem && selectedSystem.id !== currentSystem.id;

  // Pan handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-planet]')) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onPointerUp = () => { dragging.current = false; };

  const resetView = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-[#050510]">
      <div
        className="relative flex-1 min-h-0 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <StarField count={160} />

        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: `scale(${scale}) translate(${offset.x / scale}px,${offset.y / scale}px)`, transformOrigin: 'center' }}
        >
          <defs>
            {systems.map(sys => (
              <radialGradient key={sys.id} id={`grad-${sys.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={sys.color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={sys.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* Inter-system jump lanes */}
          {systems.map((sysA, i) =>
            systems.slice(i + 1).map(sysB => {
              const dist = Math.hypot(sysA.centerX - sysB.centerX, sysA.centerY - sysB.centerY);
              if (dist > 520) return null;
              return (
                <line key={`${sysA.id}-${sysB.id}`}
                  x1={sysA.centerX} y1={sysA.centerY}
                  x2={sysB.centerX} y2={sysB.centerY}
                  stroke="rgba(148,163,184,0.08)" strokeWidth="1.5" strokeDasharray="6 10"
                />
              );
            })
          )}

          {/* Solar system bubbles */}
          {systems.map(sys => {
            const isCurrent = sys.id === currentSystem?.id;
            const isTargetSystem = selectedSystem?.id === sys.id;
            return (
              <g key={sys.id}>
                <circle
                  cx={sys.centerX} cy={sys.centerY} r={SYSTEM_RADIUS}
                  fill={`url(#grad-${sys.id})`}
                  stroke={isCurrent ? sys.color : isTargetSystem ? '#fbbf24' : sys.color}
                  strokeWidth={isCurrent ? 1.5 : 0.8}
                  strokeOpacity={isCurrent ? 0.6 : isTargetSystem ? 0.7 : 0.25}
                  strokeDasharray={isCurrent ? 'none' : '5 4'}
                />
                <text
                  x={sys.centerX} y={sys.centerY - SYSTEM_RADIUS + 14}
                  textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="bold"
                  fill={isCurrent ? sys.color : isTargetSystem ? '#fbbf24' : sys.color}
                  opacity={isCurrent ? 1 : 0.55}
                >
                  {sys.name.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Travel line to selected */}
          {selected && (
            <line
              x1={currentPlanet.x} y1={currentPlanet.y}
              x2={selected.x} y2={selected.y}
              stroke="rgba(250,200,50,0.65)" strokeWidth="1.5" strokeDasharray="7 4"
              className="animate-pulse"
            />
          )}

          {/* Planets */}
          {planets.map(planet => {
            const isCurrent = planet.id === player.currentPlanetId;
            const isSelected = selected?.id === planet.id;
            const isVisited = player.visitedPlanets.includes(planet.id);
            const r = isCurrent ? 13 : 9;

            return (
              <g key={planet.id} data-planet="1"
                style={{ cursor: isCurrent ? 'default' : 'pointer' }}
                onClick={() => handleSelect(planet)}
              >
                {isCurrent && (
                  <circle cx={planet.x} cy={planet.y} r={r + 9}
                    fill="none" stroke={planet.color} strokeWidth="1.5" opacity="0.35"
                    className="animate-ping" style={{ animationDuration: '2.5s' }} />
                )}
                {isSelected && (
                  <circle cx={planet.x} cy={planet.y} r={r + 6}
                    fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.8"
                    className="animate-pulse" />
                )}
                <circle cx={planet.x} cy={planet.y} r={r}
                  fill={isVisited || isCurrent ? planet.color : '#1f2937'}
                  stroke={isCurrent ? '#fff' : isSelected ? '#fbbf24' : planet.color}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                  opacity={isVisited || isCurrent ? 1 : 0.45}
                />
                {planet.dangerLevel >= 2 && (
                  <text x={planet.x + r} y={planet.y - r + 3} fontSize="7">⚠</text>
                )}
                <text x={planet.x} y={planet.y + 4} textAnchor="middle" fontSize={isCurrent ? 9 : 7}>{planet.icon}</text>
                <text x={planet.x} y={planet.y + r + 13} textAnchor="middle" fontSize="8.5"
                  fill={isCurrent ? '#fff' : isVisited ? '#94a3b8' : '#374151'} fontFamily="monospace">
                  {planet.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {[['＋', () => setScale(s => Math.min(s + 0.25, 2.5))],
            ['－', () => setScale(s => Math.max(s - 0.25, 0.5))],
            ['⊙', resetView]] .map(([label, fn], i) => (
            <button key={i} onClick={fn as () => void}
              className="w-8 h-8 bg-black/60 border border-cyan-800 text-cyan-400 rounded text-base flex items-center justify-center active:bg-cyan-900/30">
              {label as string}
            </button>
          ))}
        </div>

        {/* Current system badge */}
        {currentSystem && (
          <div className="absolute top-3 left-3 text-[10px] font-mono px-2 py-1 rounded border"
            style={{ borderColor: currentSystem.color + '60', color: currentSystem.color, backgroundColor: currentSystem.color + '15' }}>
            📍 {currentSystem.name}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-gray-600 space-y-0.5">
          <div>⬤ Current planet &nbsp; ○ Unvisited</div>
          <div>- - - Jump lane &nbsp; ⚠ Danger zone</div>
        </div>
      </div>

      {/* Selected planet panel */}
      {selected && (
        <div className="border-t border-cyan-900/60 bg-black/80 p-3 flex items-center gap-3 shrink-0">
          <div className="text-2xl">{selected.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">{selected.name}</span>
              {selectedSystem && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ color: selectedSystem.color, backgroundColor: selectedSystem.color + '20', border: `1px solid ${selectedSystem.color}40` }}>
                  {selectedSystem.name}
                </span>
              )}
            </div>
            <div className="text-gray-400 text-xs capitalize">{selected.economy} · {selected.faction}</div>
            <div className="flex gap-3 mt-1 text-xs font-mono flex-wrap">
              <span className={isCrossSystem ? 'text-orange-400' : 'text-cyan-400'}>
                {isCrossSystem ? '🌌 Jump' : '🚀 Fly'} ~{etaSec}s
              </span>
              <span className={canAffordFuel ? 'text-yellow-400' : 'text-red-400'}>
                ⛽ {fuelCost}cr
              </span>
              {selected.dangerLevel > 0 && <span className="text-red-400">⚠ Danger {selected.dangerLevel}/3</span>}
              {selected.isSpaceport && <span className="text-yellow-400">⚓ Spaceport</span>}
            </div>
          </div>
          <button onClick={handleTravel}
            disabled={!canAffordFuel}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg min-w-[80px] transition-colors">
            {!canAffordFuel ? 'No Fuel' : isCrossSystem ? 'JUMP 🌌' : 'FLY 🚀'}
          </button>
        </div>
      )}
    </div>
  );
}

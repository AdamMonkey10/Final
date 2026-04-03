import { useState, useRef, useCallback } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getTravelDistance, getTravelDuration, getShipEffectiveStats } from '@/lib/game-engine';
import type { Planet } from '@/types/game';
import { StarField } from './StarField';

const MAP_W = 1000;
const MAP_H = 800;

export function GalaxyMap() {
  const { state, travelTo, currentPlanet } = useGame();
  const { player, planets } = state;
  const [selected, setSelected] = useState<Planet | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const effective = getShipEffectiveStats(player.ship);

  const toScreen = useCallback((mx: number, my: number, containerW: number, containerH: number) => {
    return {
      x: (mx / MAP_W) * containerW * scale + offset.x,
      y: (my / MAP_H) * containerH * scale + offset.y,
    };
  }, [scale, offset]);

  const handleSelect = (planet: Planet) => {
    if (planet.id === player.currentPlanetId) return;
    setSelected(prev => prev?.id === planet.id ? null : planet);
  };

  const handleTravel = () => {
    if (!selected || selected.id === player.currentPlanetId) return;
    travelTo(selected.id);
    setSelected(null);
  };

  const distanceToSelected = selected
    ? getTravelDistance(currentPlanet, selected)
    : 0;

  const etaMs = selected
    ? getTravelDuration(distanceToSelected, effective.speed)
    : 0;

  const etaSec = Math.round(etaMs / 1000);

  // Touch/mouse pan
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

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-[#050510]">
      {/* Map area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <StarField count={160} />

        {/* SVG map */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`, transformOrigin: 'center' }}
        >
          {/* Nebula blobs */}
          <ellipse cx="200" cy="300" rx="180" ry="100" fill="rgba(59,130,246,0.04)" />
          <ellipse cx="700" cy="500" rx="200" ry="120" fill="rgba(168,85,247,0.04)" />
          <ellipse cx="500" cy="150" rx="150" ry="80" fill="rgba(34,197,94,0.04)" />

          {/* Trade route lines */}
          {planets.map(p =>
            planets
              .filter(q => q.id > p.id && getTravelDistance(p, q) < 350)
              .map(q => (
                <line
                  key={`${p.id}-${q.id}`}
                  x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke="rgba(100,180,255,0.12)"
                  strokeWidth="1.5"
                  strokeDasharray="4 6"
                />
              ))
          )}

          {/* Selected route highlight */}
          {selected && (
            <line
              x1={currentPlanet.x} y1={currentPlanet.y}
              x2={selected.x} y2={selected.y}
              stroke="rgba(250,200,50,0.7)"
              strokeWidth="2"
              strokeDasharray="8 4"
              className="animate-pulse"
            />
          )}

          {/* Planets */}
          {planets.map(planet => {
            const isCurrent = planet.id === player.currentPlanetId;
            const isSelected = selected?.id === planet.id;
            const isVisited = player.visitedPlanets.includes(planet.id);
            const r = isCurrent ? 14 : 10;

            return (
              <g
                key={planet.id}
                data-planet="1"
                style={{ cursor: isCurrent ? 'default' : 'pointer' }}
                onClick={() => handleSelect(planet)}
              >
                {/* Glow ring for current */}
                {isCurrent && (
                  <circle cx={planet.x} cy={planet.y} r={r + 8}
                    fill="none" stroke={planet.color} strokeWidth="2" opacity="0.4"
                    className="animate-ping" style={{ animationDuration: '2s' }} />
                )}
                {/* Selection ring */}
                {isSelected && (
                  <circle cx={planet.x} cy={planet.y} r={r + 6}
                    fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.8"
                    className="animate-pulse" />
                )}
                {/* Planet circle */}
                <circle
                  cx={planet.x} cy={planet.y} r={r}
                  fill={isVisited || isCurrent ? planet.color : '#374151'}
                  stroke={isCurrent ? '#fff' : isSelected ? '#fbbf24' : planet.color}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                  opacity={isVisited || isCurrent ? 1 : 0.5}
                />
                {/* Danger indicator */}
                {planet.dangerLevel > 0 && (
                  <text x={planet.x + r - 2} y={planet.y - r + 4} fontSize="8" textAnchor="middle">
                    {'⚠'.repeat(Math.min(planet.dangerLevel, 2))}
                  </text>
                )}
                {/* Planet name */}
                <text
                  x={planet.x} y={planet.y + r + 14}
                  textAnchor="middle" fontSize="9"
                  fill={isCurrent ? '#fff' : isVisited ? '#94a3b8' : '#4b5563'}
                  fontFamily="monospace"
                >
                  {planet.name}
                </text>
                {/* Icon */}
                <text x={planet.x} y={planet.y + 4} textAnchor="middle" fontSize={isCurrent ? 10 : 8}>
                  {planet.icon}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button
            className="w-8 h-8 bg-black/60 border border-cyan-800 text-cyan-400 rounded text-lg flex items-center justify-center active:bg-cyan-900/30"
            onClick={() => setScale(s => Math.min(s + 0.2, 2.5))}
          >+</button>
          <button
            className="w-8 h-8 bg-black/60 border border-cyan-800 text-cyan-400 rounded text-lg flex items-center justify-center active:bg-cyan-900/30"
            onClick={() => setScale(s => Math.max(s - 0.2, 0.5))}
          >−</button>
          <button
            className="w-8 h-8 bg-black/60 border border-cyan-800 text-gray-400 rounded text-xs flex items-center justify-center active:bg-cyan-900/30"
            onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          >⊙</button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-gray-500 space-y-0.5">
          <div>⬤ Current location</div>
          <div>○ Unvisited</div>
          <div>⚠ Danger zone</div>
        </div>
      </div>

      {/* Selected planet panel */}
      {selected && (
        <div className="border-t border-cyan-900/60 bg-black/80 p-3 flex items-center gap-3">
          <div className="text-2xl">{selected.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">{selected.name}</div>
            <div className="text-gray-400 text-xs">{selected.economy.toUpperCase()} · {selected.faction}</div>
            <div className="text-gray-500 text-xs mt-0.5">{selected.description}</div>
            <div className="flex gap-3 mt-1 text-xs">
              <span className="text-cyan-400">ETA: ~{etaSec}s</span>
              <span className="text-gray-500">Dist: {Math.round(distanceToSelected)}</span>
              {selected.dangerLevel > 0 && (
                <span className="text-red-400">⚠ Danger {selected.dangerLevel}/3</span>
              )}
            </div>
          </div>
          <button
            onClick={handleTravel}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-sm font-bold rounded-lg min-w-[80px] transition-colors"
          >
            LAUNCH 🚀
          </button>
        </div>
      )}
    </div>
  );
}

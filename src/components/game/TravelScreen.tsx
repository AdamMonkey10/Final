import { useGame } from '@/contexts/GameContext';
import { TravelStarField } from './StarField';
import { SHIP_TEMPLATES } from '@/data/game-data';

export function TravelScreen() {
  const { state } = useGame();
  const { player, travelProgress, travelDestinationId, planets } = state;

  const dest = planets.find(p => p.id === travelDestinationId);
  const current = planets.find(p => p.id === player.currentPlanetId);
  const shipTemplate = SHIP_TEMPLATES[player.ship.class];

  const pct = Math.round(travelProgress * 100);
  const etaLabel = pct >= 99 ? 'Arriving...' : `${pct}%`;

  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-[#020208] overflow-hidden">
      <TravelStarField speed={2 + (player.ship.speed / 5)} />

      <div className="relative z-10 flex flex-col items-center gap-6 px-8 w-full max-w-sm">
        {/* Route info */}
        <div className="flex items-center justify-between w-full text-sm font-mono">
          <div className="text-center">
            <div className="text-2xl">{current?.icon}</div>
            <div className="text-gray-400 text-xs mt-1">{current?.name}</div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 px-4">
            <div className="text-gray-600 text-xs">TRAVELING</div>
            <div className="w-full flex items-center gap-1">
              <div className="flex-1 h-0.5 bg-gray-800 rounded">
                <div
                  className="h-full bg-cyan-500 rounded transition-all"
                  style={{ width: `${travelProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl">{dest?.icon ?? '?'}</div>
            <div className="text-gray-400 text-xs mt-1">{dest?.name ?? '???'}</div>
          </div>
        </div>

        {/* Ship */}
        <div className="text-7xl animate-bounce" style={{ animationDuration: '2s' }}>
          {shipTemplate?.icon ?? '🚀'}
        </div>

        {/* Status */}
        <div className="text-center space-y-1">
          <div className="text-cyan-400 font-bold text-2xl font-mono">{etaLabel}</div>
          <div className="text-gray-500 text-sm">
            {pct < 30 ? 'Clearing orbital space...' :
             pct < 60 ? 'Accelerating through deep space...' :
             pct < 85 ? 'Approaching destination system...' :
             'Entering orbit...'}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="w-full h-3 bg-gray-900 rounded-full border border-gray-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all"
              style={{ width: `${travelProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Ship stats en route */}
        <div className="flex gap-6 text-xs font-mono text-gray-600">
          <span>🛡 {player.ship.hull}/{player.ship.maxHull}</span>
          <span>🚀 Speed {player.ship.speed + player.ship.upgrades.engine * 2}</span>
          <span>📦 {player.ship.cargo.reduce((s, c) => s + c.quantity, 0)} cargo</span>
        </div>

        {/* Warning for dangerous zones */}
        {dest && dest.dangerLevel >= 2 && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            <span>⚠</span>
            <span>Entering dangerous space — pirates likely</span>
          </div>
        )}
      </div>
    </div>
  );
}

import { useGame } from '@/contexts/GameContext';
import { getCargoUsed, getShipEffectiveStats } from '@/lib/game-engine';
import { SHIP_TEMPLATES } from '@/data/game-data';

export function HUD() {
  const { state, currentPlanet } = useGame();
  const { player } = state;
  const effective = getShipEffectiveStats(player.ship);
  const cargoUsed = getCargoUsed(player.ship);
  const shipTemplate = SHIP_TEMPLATES[player.ship.class];
  const hullPct = (player.ship.hull / player.ship.maxHull) * 100;
  const shieldPct = effective.maxShields > 0 ? (player.ship.shields / effective.maxShields) * 100 : 0;

  const hullColor = hullPct > 60 ? '#22c55e' : hullPct > 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur border-b border-cyan-900/50 text-xs font-mono flex-wrap">
      {/* Credits */}
      <div className="flex items-center gap-1 text-yellow-400 font-bold">
        <span>💰</span>
        <span>{player.credits.toLocaleString()}cr</span>
      </div>

      <div className="w-px h-4 bg-cyan-900/60" />

      {/* Location */}
      <div className="flex items-center gap-1 text-cyan-300">
        <span>{currentPlanet?.icon}</span>
        <span className="hidden sm:inline">{currentPlanet?.name}</span>
      </div>

      <div className="w-px h-4 bg-cyan-900/60" />

      {/* Cargo */}
      <div className="flex items-center gap-1 text-blue-300">
        <span>📦</span>
        <span>{cargoUsed}/{effective.cargoCapacity}</span>
      </div>

      <div className="w-px h-4 bg-cyan-900/60" />

      {/* Hull */}
      <div className="flex items-center gap-1">
        <span style={{ color: hullColor }}>🛡</span>
        <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${hullPct}%`, backgroundColor: hullColor }}
          />
        </div>
        <span style={{ color: hullColor }} className="tabular-nums">
          {player.ship.hull}/{player.ship.maxHull}
        </span>
      </div>

      {/* Shields */}
      {effective.maxShields > 0 && (
        <>
          <div className="w-px h-4 bg-cyan-900/60" />
          <div className="flex items-center gap-1 text-cyan-400">
            <span>🔵</span>
            <div className="w-12 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${shieldPct}%` }}
              />
            </div>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-1 text-gray-400">
        <span>{shipTemplate?.icon}</span>
        <span className="hidden sm:inline">{shipTemplate?.name}</span>
        <span className="text-gray-500">Day {state.gameDay}</span>
      </div>
    </div>
  );
}

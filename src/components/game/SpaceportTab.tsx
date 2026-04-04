import { useGame } from '@/contexts/GameContext';
import { SPACEPORT_LOCATIONS } from '@/data/game-data';
import type { SpaceportLocation } from '@/types/game';

function LocationCard({ loc }: { loc: SpaceportLocation }) {
  const { state, dispatch } = useGame();
  const exploredDay = state.player.exploredLocations?.[loc.id];
  const alreadyVisited = exploredDay === state.gameDay;
  const lastResult = state.lastLocationResult?.locationId === loc.id ? state.lastLocationResult : null;

  return (
    <div className={`rounded-xl border p-3 space-y-1.5 ${alreadyVisited ? 'border-gray-800 bg-gray-900/20 opacity-60' : 'border-gray-700 bg-gray-900/50'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{loc.icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white leading-tight">{loc.name}</div>
            <div className="text-xs text-gray-500 leading-snug">{loc.description}</div>
          </div>
        </div>
      </div>

      {/* Last result flavor */}
      {lastResult && (
        <div className="text-xs text-cyan-300 italic bg-cyan-950/30 border border-cyan-900/40 rounded-lg px-2 py-1.5 leading-snug">
          "{lastResult.flavor}"
        </div>
      )}

      {alreadyVisited ? (
        <div className="text-xs text-gray-600 font-mono text-center py-1">
          ✓ Visited today — come back tomorrow
        </div>
      ) : (
        <button
          onClick={() => dispatch({ type: 'EXPLORE_LOCATION', locationId: loc.id })}
          className="w-full py-2 bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Explore
        </button>
      )}
    </div>
  );
}

export function SpaceportTab() {
  const { state, dispatch } = useGame();
  const { player } = state;
  const ship = player.ship;
  const planet = state.planets.find(p => p.id === player.currentPlanetId);
  const locations = planet ? (SPACEPORT_LOCATIONS[planet.id] ?? []) : [];

  const hullDamage = ship.maxHull - ship.hull;
  const repairCost = hullDamage * 3;
  const shieldMissing = ship.maxShields - ship.shields;
  const hullPct = Math.round((ship.hull / ship.maxHull) * 100);
  const shieldPct = ship.maxShields > 0 ? Math.round((ship.shields / ship.maxShields) * 100) : 100;

  return (
    <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto h-full">

      {/* Header */}
      <div className="flex items-center gap-2 text-yellow-400 font-mono text-sm font-bold">
        <span className="text-xl">⚓</span>
        <div>
          <div>Spaceport — {planet?.name}</div>
          <div className="text-xs text-gray-500 font-normal">Services · Exploration · Contracts</div>
        </div>
      </div>

      {/* ── Interior Locations ── */}
      {locations.length > 0 && (
        <div>
          <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">
            Interior Locations
          </div>
          <div className="space-y-2">
            {locations.map(loc => <LocationCard key={loc.id} loc={loc} />)}
          </div>
        </div>
      )}

      {/* ── Services ── */}
      <div>
        <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">
          Dock Services
        </div>

        {/* Ship status bars */}
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 space-y-2 mb-3">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Ship Status</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14">Hull</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${hullPct > 60 ? 'bg-green-500' : hullPct > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${hullPct}%` }} />
            </div>
            <span className="text-xs font-mono text-gray-400 w-18 text-right">{ship.hull}/{ship.maxHull}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14">Shields</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${shieldPct}%` }} />
            </div>
            <span className="text-xs font-mono text-gray-400 w-18 text-right">{ship.shields}/{ship.maxShields}</span>
          </div>
        </div>

        <div className="space-y-2">
          {/* Hull repair */}
          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">🔧 Hull Repair</div>
                <div className="text-xs text-gray-500">
                  {hullDamage > 0 ? `${hullDamage} HP · 3cr/HP (40% off)` : 'Hull at full integrity'}
                </div>
                {hullDamage > 0 && <div className="text-xs text-gray-700 line-through">Normal: {hullDamage * 5}cr</div>}
              </div>
              {hullDamage > 0 && <div className="text-yellow-400 font-bold text-sm">{repairCost}cr</div>}
            </div>
            {hullDamage > 0 && (
              <button
                onClick={() => dispatch({ type: 'REPAIR_HULL' })}
                disabled={player.credits < repairCost}
                className="w-full mt-2 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {player.credits >= repairCost ? 'Repair Hull' : 'Insufficient Credits'}
              </button>
            )}
            {hullDamage === 0 && <div className="mt-1 text-center text-green-500 text-xs font-mono">✓ No repairs needed</div>}
          </div>

          {/* Shield refill */}
          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">🛡 Shield Recharge</div>
                <div className="text-xs text-gray-500">{shieldMissing > 0 ? `+${shieldMissing} shields` : 'Fully charged'}</div>
              </div>
              <div className="text-green-400 font-bold text-sm">FREE</div>
            </div>
            {shieldMissing > 0 && (
              <button
                onClick={() => dispatch({ type: 'REFILL_SHIELDS' } as any)}
                className="w-full mt-2 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Recharge Shields
              </button>
            )}
            {shieldMissing === 0 && <div className="mt-1 text-center text-cyan-500 text-xs font-mono">✓ Shields at maximum</div>}
          </div>

          {/* Log stamp */}
          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">📋 Pilot Log Stamp</div>
                <div className="text-xs text-gray-500">Merchant Guild reputation bonus</div>
              </div>
              <div className="text-purple-400 font-bold text-sm">+2 Rep</div>
            </div>
            <button
              onClick={() => dispatch({ type: 'STAMP_LOG' } as any)}
              className="w-full mt-2 py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Stamp Log (Free)
            </button>
          </div>

          {/* Emergency beacon */}
          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">🛰 Emergency Beacon</div>
                <div className="text-xs text-gray-500">Reduces credit loss on destruction</div>
              </div>
              <div className="text-yellow-400 font-bold text-sm">500cr</div>
            </div>
            <button
              onClick={() => dispatch({ type: 'BUY_INSURANCE' } as any)}
              disabled={player.credits < 500}
              className="w-full mt-2 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-bold rounded-lg transition-colors"
            >
              {player.credits >= 500 ? 'Register Beacon' : 'Insufficient Credits'}
            </button>
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="pt-3 border-t border-gray-800 text-center">
        <div className="text-yellow-400 font-bold text-lg">{player.credits.toLocaleString()} cr</div>
        <div className="text-xs text-gray-600">Available balance</div>
      </div>
    </div>
  );
}

import { useGame } from '@/contexts/GameContext';
import { GOODS } from '@/data/game-data';
import type { Mission } from '@/types/game';

function MissionCard({ mission, onAccept }: { mission: Mission; onAccept: (m: Mission) => void }) {
  const { state } = useGame();
  const target = state.planets.find(p => p.id === mission.targetPlanetId);

  const statusColor = mission.isComplete
    ? 'border-green-800 bg-green-950/20'
    : mission.isActive
    ? 'border-cyan-800 bg-cyan-950/20'
    : 'border-gray-800 bg-gray-900/40';

  return (
    <div className={`px-3 py-3 rounded-xl border ${statusColor} space-y-1.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm font-bold text-white">{mission.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{mission.description}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-yellow-400 font-bold text-sm">+{mission.reward}cr</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs font-mono">
        <span className="text-gray-500">
          🎯 {mission.targetPlanetName} {target?.icon}
        </span>
        {mission.isDelivery && mission.cargoType && (
          <span className="text-blue-400">
            📦 {mission.cargoAmount}x {GOODS[mission.cargoType]?.name}
          </span>
        )}
      </div>

      {!mission.isActive && !mission.isComplete && (
        <button
          onClick={() => onAccept(mission)}
          className="w-full py-2 bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Accept Mission
        </button>
      )}

      {mission.isActive && (
        <div className="flex items-center gap-1.5 text-xs text-cyan-400">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          <span>In progress — fly to {mission.targetPlanetName}</span>
        </div>
      )}

      {mission.isComplete && (
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <span>✓ Completed</span>
        </div>
      )}
    </div>
  );
}

export function MissionsTab() {
  const { state, acceptMission } = useGame();
  const { player } = state;
  const active = player.missions.filter(m => m.isActive && !m.isComplete);
  const available = player.missions.filter(m => !m.isActive && !m.isComplete);
  const completed = player.missions.filter(m => m.isComplete).slice(-3);

  return (
    <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto h-full">
      {/* Active missions */}
      {active.length > 0 && (
        <div>
          <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">
            Active ({active.length})
          </div>
          <div className="space-y-2">
            {active.map(m => (
              <MissionCard key={m.id} mission={m} onAccept={acceptMission} />
            ))}
          </div>
        </div>
      )}

      {/* Available missions */}
      <div>
        <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">
          Available ({available.length})
        </div>
        {available.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-4">
            No missions available. Visit other planets for new contracts.
          </div>
        ) : (
          <div className="space-y-2">
            {available.map(m => (
              <MissionCard key={m.id} mission={m} onAccept={acceptMission} />
            ))}
          </div>
        )}
      </div>

      {/* Recent completions */}
      {completed.length > 0 && (
        <div>
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-2">
            Recently Completed
          </div>
          <div className="space-y-2 opacity-50">
            {completed.map(m => (
              <MissionCard key={m.id} mission={m} onAccept={acceptMission} />
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-auto pt-4 border-t border-gray-800 grid grid-cols-2 gap-3 text-center">
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-2xl font-bold text-yellow-400">{player.totalProfit.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Profit</div>
        </div>
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-2xl font-bold text-cyan-400">{player.tripsCompleted}</div>
          <div className="text-xs text-gray-500 mt-0.5">Trips Made</div>
        </div>
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-2xl font-bold text-purple-400">{player.visitedPlanets.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Planets Visited</div>
        </div>
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-2xl font-bold text-green-400">{player.reputation}</div>
          <div className="text-xs text-gray-500 mt-0.5">Reputation</div>
        </div>
      </div>
    </div>
  );
}

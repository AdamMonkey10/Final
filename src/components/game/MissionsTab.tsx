import { useGame } from '@/contexts/GameContext';
import { GOODS } from '@/data/game-data';
import type { Mission, MissionType } from '@/types/game';

const MISSION_META: Record<MissionType, { icon: string; color: string; label: string }> = {
  delivery: { icon: '📦', color: 'text-blue-400',   label: 'Delivery'   },
  courier:  { icon: '⚡', color: 'text-yellow-400', label: 'Courier'    },
  bounty:   { icon: '🎯', color: 'text-red-400',    label: 'Bounty'     },
  survey:   { icon: '🔭', color: 'text-purple-400', label: 'Survey'     },
  smuggle:  { icon: '🤫', color: 'text-orange-400', label: 'Smuggle'    },
  emergency:{ icon: '🚨', color: 'text-red-300',    label: 'Emergency'  },
};

const BORDER_BY_TYPE: Record<MissionType, string> = {
  delivery:  'border-blue-900/60',
  courier:   'border-yellow-900/60',
  bounty:    'border-red-900/60',
  survey:    'border-purple-900/60',
  smuggle:   'border-orange-900/60',
  emergency: 'border-red-800/80',
};

function MissionCard({ mission, onAccept }: { mission: Mission; onAccept: (m: Mission) => void }) {
  const { state } = useGame();
  const meta = MISSION_META[mission.type];
  const target = state.planets.find(p => p.id === mission.targetPlanetId);
  const daysLeft = mission.expiresOnDay - state.gameDay;

  const borderClass = mission.isComplete
    ? 'border-green-800'
    : mission.isFailed
    ? 'border-gray-700 opacity-50'
    : mission.isActive
    ? 'border-cyan-700'
    : BORDER_BY_TYPE[mission.type];

  const bgClass = mission.isComplete
    ? 'bg-green-950/20'
    : mission.isFailed
    ? 'bg-gray-900/20'
    : mission.isActive
    ? 'bg-cyan-950/20'
    : 'bg-gray-900/40';

  const isExpiringSoon = !mission.isActive && !mission.isComplete && !mission.isFailed && daysLeft <= 2;

  return (
    <div className={`px-3 py-3 rounded-xl border ${borderClass} ${bgClass} space-y-1.5`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-base">{meta.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${meta.color} bg-black/40 border border-current/20`}>
                {meta.label}
              </span>
              {mission.reputationRequired > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-purple-400 bg-purple-950/40 border border-purple-800/40">
                  ⭐ Rep {mission.reputationRequired}+
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-white mt-0.5 leading-tight">{mission.title}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-yellow-400 font-bold text-sm">+{mission.reward.toLocaleString()}cr</div>
          {mission.bonusReward && (
            <div className="text-green-400 text-[10px] font-mono">+{mission.bonusReward.toLocaleString()} bonus</div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="text-xs text-gray-400 leading-snug">{mission.description}</div>

      {/* Details row */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono">
        <span className="text-gray-500">
          🎯 {mission.targetPlanetName} {target?.icon}
          {mission.targetSystemName && (
            <span className="text-gray-600"> · {mission.targetSystemName}</span>
          )}
        </span>
        {(mission.type === 'delivery' || mission.type === 'smuggle') && mission.cargoType && (
          <span className={mission.type === 'smuggle' ? 'text-orange-400' : 'text-blue-400'}>
            📦 {mission.cargoAmount}× {GOODS[mission.cargoType]?.name}
          </span>
        )}
      </div>

      {/* Expiry / status */}
      <div className="flex items-center justify-between gap-2">
        <div>
          {mission.isActive && (
            <div className="flex items-center gap-1.5 text-xs text-cyan-400">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              <span>Active — fly to {mission.targetPlanetName}</span>
            </div>
          )}
          {mission.isComplete && (
            <div className="text-xs text-green-400 font-bold">✓ Completed</div>
          )}
          {mission.isFailed && (
            <div className="text-xs text-gray-500">✗ Failed / Expired</div>
          )}
          {!mission.isActive && !mission.isComplete && !mission.isFailed && (
            <div className={`text-xs font-mono ${isExpiringSoon ? 'text-red-400 font-bold' : 'text-gray-600'}`}>
              {isExpiringSoon ? '⏰' : '🕐'} Expires day {mission.expiresOnDay} ({daysLeft > 0 ? `${daysLeft}d left` : 'today!'})
            </div>
          )}
        </div>

        {!mission.isActive && !mission.isComplete && !mission.isFailed && (
          <button
            onClick={() => onAccept(mission)}
            disabled={state.player.reputation < mission.reputationRequired}
            className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
          >
            {state.player.reputation < mission.reputationRequired ? 'Locked 🔒' : 'Accept'}
          </button>
        )}
      </div>
    </div>
  );
}

export function MissionsTab() {
  const { state, acceptMission } = useGame();
  const { player } = state;
  const active = player.missions.filter(m => m.isActive && !m.isComplete && !m.isFailed);
  const available = player.missions.filter(m => !m.isActive && !m.isComplete && !m.isFailed);
  const completed = player.missions.filter(m => m.isComplete).slice(-5);

  return (
    <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto h-full">
      {/* Day counter + rep */}
      <div className="flex items-center justify-between text-xs font-mono bg-black/30 rounded-lg px-3 py-2 border border-gray-800">
        <span className="text-gray-500">📅 Day {state.gameDay}</span>
        <span className="text-purple-400">⭐ Reputation: <span className="font-bold text-white">{player.reputation}</span></span>
      </div>

      {/* Active missions */}
      {active.length > 0 && (
        <div>
          <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">
            Active ({active.length})
          </div>
          <div className="space-y-2">
            {active.map(m => <MissionCard key={m.id} mission={m} onAccept={acceptMission} />)}
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
            {available.map(m => <MissionCard key={m.id} mission={m} onAccept={acceptMission} />)}
          </div>
        )}
      </div>

      {/* Recently completed */}
      {completed.length > 0 && (
        <div>
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-2">
            Recently Completed
          </div>
          <div className="space-y-2 opacity-50">
            {completed.map(m => <MissionCard key={m.id} mission={m} onAccept={acceptMission} />)}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-auto pt-4 border-t border-gray-800 grid grid-cols-2 gap-3 text-center">
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-xl font-bold text-yellow-400">{player.totalProfit.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Profit</div>
        </div>
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-xl font-bold text-cyan-400">{player.tripsCompleted}</div>
          <div className="text-xs text-gray-500 mt-0.5">Trips Made</div>
        </div>
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-xl font-bold text-purple-400">{player.visitedPlanets.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Planets Visited</div>
        </div>
        <div className="bg-gray-900/60 rounded-xl py-3">
          <div className="text-xl font-bold text-green-400">
            {player.missions.filter(m => m.isComplete).length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Missions Done</div>
        </div>
      </div>
    </div>
  );
}

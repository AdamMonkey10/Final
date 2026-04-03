import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getShipEffectiveStats } from '@/lib/game-engine';
import { SHIP_TEMPLATES } from '@/data/game-data';
import { StarField } from './StarField';

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  return (
    <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function CombatScreen() {
  const { state, attackEnemy, fleeFromEnemy } = useGame();
  const { player, combat, combatLog } = state;
  const [isAttacking, setIsAttacking] = useState(false);

  const effective = getShipEffectiveStats(player.ship);
  const shipTemplate = SHIP_TEMPLATES[player.ship.class];

  if (!combat) return null;

  const playerHullPct = player.ship.maxHull > 0 ? player.ship.hull / player.ship.maxHull : 0;
  const enemyHullPct = combat.maxHull > 0 ? combat.hull / combat.maxHull : 0;
  const hullColor = (pct: number) => pct > 0.6 ? '#22c55e' : pct > 0.3 ? '#f59e0b' : '#ef4444';

  const handleAttack = () => {
    if (isAttacking) return;
    setIsAttacking(true);
    attackEnemy();
    setTimeout(() => setIsAttacking(false), 300);
  };

  return (
    <div className="relative flex flex-col h-full bg-[#0a0205] overflow-hidden">
      <StarField count={80} className="opacity-40" />

      {/* Red alert border effect */}
      <div className="absolute inset-0 border-2 border-red-900/40 pointer-events-none rounded" />

      <div className="relative z-10 flex flex-col h-full p-4 gap-4">
        {/* Header */}
        <div className="text-center">
          <div className="text-red-400 font-bold text-sm font-mono tracking-widest animate-pulse">
            ⚠ COMBAT ALERT ⚠
          </div>
          <div className="text-gray-400 text-xs mt-1">{combat.name} has intercepted you!</div>
        </div>

        {/* Combatant display */}
        <div className="flex items-start justify-between gap-4">
          {/* Player */}
          <div className="flex-1 text-center space-y-2">
            <div className="text-4xl">{shipTemplate?.icon ?? '🚀'}</div>
            <div className="text-xs text-gray-400 font-mono">YOUR SHIP</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-gray-400 px-1">
                <span>Hull</span>
                <span className={playerHullPct < 0.3 ? 'text-red-400' : 'text-white'}>
                  {player.ship.hull}/{player.ship.maxHull}
                </span>
              </div>
              <HpBar current={player.ship.hull} max={player.ship.maxHull} color={hullColor(playerHullPct)} />
              {effective.maxShields > 0 && (
                <>
                  <div className="flex justify-between text-xs font-mono text-gray-400 px-1">
                    <span>Shields</span>
                    <span className="text-cyan-400">{player.ship.shields}/{effective.maxShields}</span>
                  </div>
                  <HpBar current={player.ship.shields} max={effective.maxShields} color="#22d3ee" />
                </>
              )}
            </div>
            <div className="text-xs font-mono text-red-400">⚡ {effective.weaponPower} ATK</div>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center pt-6 gap-2">
            <div className="text-red-500 font-black text-2xl">VS</div>
            <div className="flex flex-col gap-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
            </div>
          </div>

          {/* Enemy */}
          <div className="flex-1 text-center space-y-2">
            <div className="text-4xl">☠️</div>
            <div className="text-xs text-red-400 font-mono">{combat.name.toUpperCase()}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-gray-400 px-1">
                <span>Hull</span>
                <span className={enemyHullPct < 0.3 ? 'text-red-400' : 'text-white'}>
                  {combat.hull}/{combat.maxHull}
                </span>
              </div>
              <HpBar current={combat.hull} max={combat.maxHull} color={hullColor(enemyHullPct)} />
              {combat.maxShields > 0 && (
                <>
                  <div className="flex justify-between text-xs font-mono text-gray-400 px-1">
                    <span>Shields</span>
                    <span className="text-cyan-400">{combat.shields}/{combat.maxShields}</span>
                  </div>
                  <HpBar current={combat.shields} max={combat.maxShields} color="#22d3ee" />
                </>
              )}
            </div>
            <div className="text-xs font-mono text-red-400">⚡ {combat.weaponPower} ATK</div>
          </div>
        </div>

        {/* Combat log */}
        <div className="flex-1 bg-black/60 rounded-xl border border-gray-800 p-3 overflow-y-auto">
          <div className="text-xs font-mono text-gray-500 uppercase mb-2">Combat Log</div>
          <div className="space-y-1">
            {combatLog.slice().reverse().map((line, i) => (
              <div
                key={i}
                className={`text-xs font-mono leading-relaxed ${
                  i === 0 ? 'text-white' :
                  i < 3 ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {line.startsWith('Your') || line.startsWith('You') ? '▶ ' : line.startsWith('⚠') ? '' : '◀ '}{line}
              </div>
            ))}
            {combatLog.length === 0 && (
              <div className="text-gray-600 text-xs">Waiting for action...</div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleAttack}
            disabled={isAttacking}
            className={`py-4 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-black text-lg rounded-2xl transition-all ${
              isAttacking ? 'scale-95 opacity-70' : 'scale-100'
            } shadow-lg shadow-red-900/50`}
          >
            🔫 FIRE!
          </button>
          <button
            onClick={fleeFromEnemy}
            disabled={!combat.isEscapable}
            className={`py-4 font-black text-lg rounded-2xl transition-all shadow-lg ${
              combat.isEscapable
                ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white shadow-gray-900/50'
                : 'bg-gray-900 text-gray-700 cursor-not-allowed'
            }`}
          >
            {combat.isEscapable ? '💨 FLEE' : '🔒 TRAPPED'}
          </button>
        </div>

        {/* Reward preview */}
        <div className="text-center text-xs font-mono text-gray-600">
          Victory reward: <span className="text-yellow-500">{combat.creditReward}cr</span>
          {!combat.isEscapable && <span className="text-red-600 ml-2">· Cannot flee!</span>}
        </div>
      </div>
    </div>
  );
}

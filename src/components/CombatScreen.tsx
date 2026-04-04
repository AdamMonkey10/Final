import React from 'react';
import type { GameState, ItemId } from '../types/game';
import { ITEMS } from '../data/items';

interface CombatScreenProps {
  state: GameState;
  onAttack: () => void;
  onUseItem: (itemId: ItemId) => void;
  onRun: () => void;
  onEndCombat: (victory: boolean) => void;
}

export default function CombatScreen({ state, onAttack, onUseItem, onRun, onEndCombat }: CombatScreenProps) {
  const { combat, stats } = state;
  if (!combat) return null;

  const enemyHpPercent = Math.max(0, Math.min(100, (combat.enemy.hp / combat.enemy.maxHp) * 100));
  const playerHpPercent = Math.max(0, Math.min(100, (combat.playerHp / stats.maxHp) * 100));
  const healItems = state.inventory.filter(i => ITEMS[i.itemId].healAmount != null);
  const isPlayerTurn = combat.phase === 'player_turn';
  const isOver = combat.phase === 'victory' || combat.phase === 'defeat' || combat.phase === 'fled';

  const enemyHpColor = enemyHpPercent > 60 ? 'bg-green-500' : enemyHpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';
  const playerHpColor = playerHpPercent > 60 ? 'bg-green-500' : playerHpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`overlay-fullscreen flex flex-col ${isPlayerTurn ? '' : 'shake'}`}>
      {/* Enemy section */}
      <div className="bg-spooky-darker border-b-2 border-red-900 p-4 flex flex-col items-center gap-3">
        <div className="text-7xl md:text-8xl float-anim">
          {combat.phase === 'victory' ? '💀' : combat.enemy.emoji}
        </div>
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-1">
            <p className="font-pixel text-red-400 text-xs md:text-sm">{combat.enemy.name}</p>
            <p className="font-game text-red-300 text-sm">{Math.max(0, combat.enemy.hp)}/{combat.enemy.maxHp} HP</p>
          </div>
          <div className="h-5 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className={`h-full rounded-full transition-all duration-500 ${enemyHpColor}`}
              style={{ width: `${enemyHpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Player HP (mini bar) */}
      <div className="px-4 py-2 bg-spooky-card flex items-center gap-3">
        <span className="text-lg">❤️</span>
        <div className="flex-1">
          <div className="flex justify-between text-xs font-game text-spooky-text mb-1">
            <span>Your HP</span>
            <span>{combat.playerHp}/{stats.maxHp}</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className={`h-full rounded-full transition-all duration-300 ${playerHpColor}`}
              style={{ width: `${playerHpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Combat log */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {combat.log.map((entry, i) => (
            <p
              key={i}
              className={`font-game text-sm leading-relaxed ${
                i === combat.log.length - 1 ? 'text-spooky-text' : 'text-gray-500'
              }`}
            >
              {entry}
            </p>
          ))}
        </div>
      </div>

      {/* Item strip (scrollable horizontal) */}
      {!isOver && healItems.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-800">
          <p className="font-game text-gray-500 text-xs mb-2">ITEMS (tap to use):</p>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {healItems.map(invItem => {
              const item = ITEMS[invItem.itemId];
              return (
                <button
                  key={invItem.itemId}
                  onClick={() => isPlayerTurn && onUseItem(invItem.itemId)}
                  disabled={!isPlayerTurn}
                  className={`
                    shrink-0 flex flex-col items-center gap-1 p-3 rounded-xl border-2 min-w-[72px] active:scale-95 transition-transform
                    ${isPlayerTurn
                      ? 'border-spooky-green bg-spooky-card'
                      : 'border-gray-700 bg-spooky-darker opacity-50 cursor-not-allowed'}
                  `}
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <span className="font-game text-xs text-green-400">+{item.healAmount}</span>
                  <span className="font-game text-xs text-gray-400">×{invItem.quantity}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="p-4 border-t-2 border-spooky-purple">
        {!isOver ? (
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onAttack}
              disabled={!isPlayerTurn}
              className={`
                combat-btn bg-red-900 border-2 border-red-600 text-red-100
                ${!isPlayerTurn ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
              `}
            >
              <span className="text-3xl">⚔️</span>
              <span className="font-game text-sm font-bold mt-1">Attack!</span>
            </button>

            <button
              onClick={onRun}
              disabled={!isPlayerTurn}
              className={`
                combat-btn bg-blue-900 border-2 border-blue-600 text-blue-100
                ${!isPlayerTurn ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
              `}
            >
              <span className="text-3xl">🏃</span>
              <span className="font-game text-sm font-bold mt-1">Run!</span>
            </button>

            <button
              disabled
              className="combat-btn bg-gray-900 border-2 border-gray-700 text-gray-500 cursor-not-allowed opacity-40"
            >
              <span className="text-3xl">⬆️</span>
              <span className="font-game text-xs mt-1">Use item above</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {combat.phase === 'victory' && (
              <button
                onClick={() => onEndCombat(true)}
                className="w-full game-btn-green py-5 text-xl"
              >
                🏆 Collect Rewards!
              </button>
            )}
            {(combat.phase === 'defeat') && (
              <button
                onClick={() => onEndCombat(false)}
                className="w-full game-btn py-5 text-xl border-2 border-red-600 bg-red-900"
              >
                😵 Wake Up in Graveyard
              </button>
            )}
            {combat.phase === 'fled' && (
              <button
                onClick={() => onEndCombat(false)}
                className="w-full game-btn py-5 text-xl"
              >
                🏃 Keep Running!
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

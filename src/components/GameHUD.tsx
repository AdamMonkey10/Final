import React from 'react';
import type { GameState } from '../types/game';
import { XP_THRESHOLDS } from '../hooks/useGameState';

interface GameHUDProps {
  state: GameState;
  onOpenQuests: () => void;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
}

export default function GameHUD({ state, onOpenQuests, onOpenInventory, onOpenSettings }: GameHUDProps) {
  const { stats, gold, inventory, questStates } = state;
  const activeQuestCount = Object.values(questStates).filter(s => s === 'active').length;
  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const xpNext = XP_THRESHOLDS[stats.level] ?? XP_THRESHOLDS[4];
  const xpPrev = XP_THRESHOLDS[stats.level - 1] ?? 0;
  const xpPercent = stats.level >= 5 ? 100 : Math.max(0, Math.min(100, ((stats.xp - xpPrev) / (xpNext - xpPrev)) * 100));

  const hpColor = hpPercent > 60 ? 'bg-green-500' : hpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="hud-bar bg-spooky-darker border-b-2 border-spooky-purple px-3 py-2 flex items-center gap-3 md:flex-col md:border-b-0 md:border-r-2 md:px-4 md:py-4 md:gap-4 md:w-48 md:min-h-screen md:sticky md:top-0">
      {/* Title (tablet sidebar only) */}
      <div className="hidden md:block text-center mb-2">
        <div className="text-3xl float-anim">🎃</div>
        <p className="font-pixel text-spooky-orange text-xs leading-tight mt-1">SPOOKY</p>
        <p className="font-pixel text-spooky-green text-xs leading-tight">QUEST</p>
      </div>

      {/* Player name */}
      <div className="hidden md:block text-center">
        <p className="font-game text-spooky-text text-sm font-bold truncate">{state.playerName}</p>
      </div>

      {/* HP Bar */}
      <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-none md:w-full">
        <span className="text-lg md:text-xl shrink-0">❤️</span>
        <div className="flex-1 md:w-full">
          <div className="flex justify-between text-xs font-game text-spooky-text mb-1">
            <span className="hidden md:inline">HP</span>
            <span>{stats.hp}/{stats.maxHp}</span>
          </div>
          <div className="h-3 md:h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className={`h-full rounded-full transition-all duration-300 ${hpColor}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Level + XP */}
      <div className="flex items-center gap-2 shrink-0 md:w-full">
        <span className="text-lg md:text-xl">⭐</span>
        <div className="md:flex-1">
          <div className="flex justify-between text-xs font-game text-spooky-text mb-1">
            <span className="hidden md:inline">Lvl</span>
            <span className="font-bold">{stats.level}</span>
            <span className="hidden md:inline text-gray-500">{stats.level < 5 ? `${stats.xp}/${xpNext}xp` : 'MAX'}</span>
          </div>
          {stats.level < 5 && (
            <div className="hidden md:block h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Gold */}
      <div className="flex items-center gap-1 shrink-0 md:w-full md:justify-between">
        <span className="text-lg">💰</span>
        <span className="font-game font-bold text-yellow-400 text-base">{gold}</span>
        <span className="hidden md:inline font-game text-xs text-gray-500">gold</span>
      </div>

      {/* Separator on tablet */}
      <div className="hidden md:block w-full h-px bg-spooky-purple opacity-40 my-2" />

      {/* Action buttons */}
      <div className="flex gap-2 md:flex-col md:w-full md:gap-3 ml-auto md:ml-0">
        <button
          onClick={onOpenInventory}
          className="hud-btn relative"
          aria-label="Inventory"
        >
          🎒
          <span className="ml-1 font-game text-sm md:hidden">{inventory.length}/10</span>
          <span className="hidden md:inline font-game text-xs ml-2">Bag ({inventory.length}/10)</span>
        </button>

        <button
          onClick={onOpenQuests}
          className="hud-btn relative"
          aria-label="Quest Log"
        >
          📜
          {activeQuestCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-spooky-orange text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeQuestCount}
            </span>
          )}
          <span className="hidden md:inline font-game text-xs ml-2">Quests</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="hud-btn"
          aria-label="Settings"
        >
          ⚙️
          <span className="hidden md:inline font-game text-xs ml-2">Settings</span>
        </button>
      </div>
    </div>
  );
}

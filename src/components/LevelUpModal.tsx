import React, { useEffect } from 'react';
import type { GameState } from '../types/game';
import { LEVEL_STATS } from '../hooks/useGameState';

interface LevelUpModalProps {
  state: GameState;
  onClose: () => void;
}

const LEVEL_UP_MESSAGES: Record<number, string> = {
  2: "You're getting spookier! The zombies think you're impressive now!",
  3: "Now we're talking! Even the chandelier spiders are nervous!",
  4: "Castle Dooooom has UNLOCKED! Lord Von Dooooom is absolutely terrified.",
  5: "MAX LEVEL! You are officially the SPOOKIEST KID IN THE GRAVEYARD! 👑",
};

const LEVEL_EMOJIS: Record<number, string> = {
  2: '⭐',
  3: '🌟',
  4: '✨',
  5: '💫',
};

export default function LevelUpModal({ state, onClose }: LevelUpModalProps) {
  const level = state.stats.level;
  const prevLevelStats = LEVEL_STATS[level - 1] ?? LEVEL_STATS[1];
  const newLevelStats = LEVEL_STATS[level];

  useEffect(() => {
    // Auto-close after 6 seconds if user doesn't tap
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="overlay-fullscreen flex flex-col items-center justify-center p-6 gap-6 bg-black bg-opacity-90">
      {/* Celebration */}
      <div className="text-8xl float-anim text-center select-none">
        {LEVEL_EMOJIS[level] ?? '⭐'}
      </div>

      <div className="text-center">
        <p className="font-game text-spooky-green text-sm mb-2">LEVEL UP!</p>
        <h2 className="font-pixel text-spooky-orange text-2xl md:text-4xl mb-4">
          Level {level}!
        </h2>
        <p className="font-game text-spooky-text text-base md:text-lg max-w-xs mx-auto leading-relaxed">
          {LEVEL_UP_MESSAGES[level] ?? 'You got stronger!'}
        </p>
      </div>

      {/* Stat changes */}
      <div className="bg-spooky-card border-2 border-spooky-purple rounded-2xl p-5 w-full max-w-xs">
        <p className="font-game text-gray-500 text-xs text-center mb-4">STAT INCREASES</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl">❤️</p>
            <p className="font-game text-xs text-gray-400 mt-1">Max HP</p>
            <p className="font-game text-green-400 text-sm">
              {prevLevelStats.maxHp} → <span className="font-bold text-base">{newLevelStats.maxHp}</span>
            </p>
          </div>
          <div>
            <p className="text-2xl">⚔️</p>
            <p className="font-game text-xs text-gray-400 mt-1">Attack</p>
            <p className="font-game text-red-400 text-sm">
              {prevLevelStats.attack} → <span className="font-bold text-base">{newLevelStats.attack}</span>
            </p>
          </div>
          <div>
            <p className="text-2xl">🛡️</p>
            <p className="font-game text-xs text-gray-400 mt-1">Defense</p>
            <p className="font-game text-blue-400 text-sm">
              {prevLevelStats.defense} → <span className="font-bold text-base">{newLevelStats.defense}</span>
            </p>
          </div>
        </div>
      </div>

      {level === 4 && (
        <div className="bg-red-950 border-2 border-red-600 rounded-xl p-4 text-center max-w-xs">
          <p className="font-game text-red-300 text-sm">
            🏰 Castle Dooooom is now accessible! Lord Von Dooooom has been notified. He is NOT happy about this.
          </p>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full max-w-xs game-btn-green py-5 text-xl"
      >
        🎉 Let's Go!
      </button>

      <p className="font-game text-gray-600 text-xs">(auto-closes in 6 seconds)</p>
    </div>
  );
}

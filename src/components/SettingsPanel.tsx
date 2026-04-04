import { useState } from 'react';
import type { GameState } from '../types/game';

interface SettingsPanelProps {
  state: GameState;
  onClose: () => void;
  onToggleSound: () => void;
  onManualSave: () => void;
  onRestart: () => void;
  onReplayTutorial: () => void;
}

export default function SettingsPanel({ state, onClose, onToggleSound, onManualSave, onRestart, onReplayTutorial }: SettingsPanelProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const handleSave = () => {
    onManualSave();
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  if (confirmRestart) {
    return (
      <div className="overlay-fullscreen flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-7xl float-anim">👻</div>
        <div className="text-center">
          <h2 className="font-pixel text-spooky-orange text-lg mb-3">Are you SURE?</h2>
          <p className="font-game text-spooky-text text-base max-w-xs mx-auto leading-relaxed">
            Gerald will be very sad. He'll probably forget about it immediately, but in the moment? Very sad.
          </p>
        </div>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={onRestart}
            className="w-full py-5 text-xl game-btn border-2 border-red-600 bg-red-900 text-red-100"
          >
            💀 Yes, restart everything
          </button>
          <button
            onClick={() => setConfirmRestart(false)}
            className="w-full game-btn-green py-5 text-xl"
          >
            👻 No, keep my adventure!
          </button>
        </div>
      </div>
    );
  }

  if (showRules) {
    return (
      <div className="overlay-fullscreen flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-spooky-purple">
          <h2 className="font-pixel text-spooky-orange text-base">📖 How to Play</h2>
          <button onClick={() => setShowRules(false)} className="overlay-close-btn">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {[
            { emoji: '🚶', title: 'Explore', text: 'Tap location cards to travel between areas. Swipe left/right too!' },
            { emoji: '💬', title: 'Talk to NPCs', text: 'Each area has a friendly (ish) character. Talk to them for quests, shops, and trades.' },
            { emoji: '📜', title: 'Quests', text: 'Complete quests to earn XP and gold. Check the 📜 quest button to see what you need!' },
            { emoji: '⚔️', title: 'Combat', text: 'Sometimes enemies attack when you travel! Use Attack, Items, or Run. Turn-based — take your time.' },
            { emoji: '⭐', title: 'Level Up', text: 'Earn XP from fights and quests. Higher levels unlock more of the world!' },
            { emoji: '💰', title: 'Gold', text: 'Buy items from NPC shops. Trade items for other items. Gold is found in battles too.' },
            { emoji: '💾', title: 'Saves', text: 'The game saves automatically after every action. You can also save manually here.' },
            { emoji: '🏰', title: 'Win!', text: 'Reach Castle Dooooom at Level 4 and face Lord Von Dooooom in the final battle!' },
          ].map(rule => (
            <div key={rule.emoji} className="bg-spooky-card border border-spooky-purple rounded-xl p-4 flex gap-4">
              <span className="text-3xl">{rule.emoji}</span>
              <div>
                <p className="font-game font-bold text-spooky-text text-base">{rule.title}</p>
                <p className="font-game text-gray-400 text-sm leading-relaxed">{rule.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4">
          <button onClick={() => setShowRules(false)} className="w-full game-btn-green py-4 text-lg">
            ← Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay-fullscreen flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-spooky-purple">
        <h2 className="font-pixel text-spooky-orange text-base md:text-xl">⚙️ Settings</h2>
        <button onClick={onClose} className="overlay-close-btn">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Player info */}
        <div className="bg-spooky-card border border-spooky-purple rounded-xl p-4">
          <p className="font-game text-gray-500 text-xs mb-1">ADVENTURER</p>
          <p className="font-game text-spooky-text text-lg font-bold">{state.playerName}</p>
          <p className="font-game text-gray-400 text-sm">
            Level {state.stats.level} · {state.gold} 💰 · {state.inventory.length}/10 items
          </p>
        </div>

        {/* Sound toggle */}
        <button
          onClick={onToggleSound}
          className="w-full bg-spooky-card border-2 border-spooky-purple rounded-xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
        >
          <span className="text-3xl">{state.soundEnabled ? '🔊' : '🔇'}</span>
          <div className="text-left flex-1">
            <p className="font-game font-bold text-spooky-text text-base">Sound</p>
            <p className="font-game text-gray-400 text-sm">{state.soundEnabled ? 'On (spooky sounds enabled)' : 'Off (silent mode)'}</p>
          </div>
          <div className={`w-12 h-6 rounded-full transition-colors ${state.soundEnabled ? 'bg-spooky-green' : 'bg-gray-700'}`}>
            <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${state.soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
        </button>

        {/* Replay tutorial */}
        <button
          onClick={() => { onReplayTutorial(); onClose(); }}
          className="w-full bg-spooky-card border-2 border-spooky-purple rounded-xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
        >
          <span className="text-3xl">👻</span>
          <div className="text-left flex-1">
            <p className="font-game font-bold text-spooky-text text-base">Gerald's Tour</p>
            <p className="font-game text-gray-400 text-sm">Replay the intro guide</p>
          </div>
          <span className="text-spooky-purple text-xl">→</span>
        </button>

        {/* How to play */}
        <button
          onClick={() => setShowRules(true)}
          className="w-full bg-spooky-card border-2 border-spooky-purple rounded-xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
        >
          <span className="text-3xl">📖</span>
          <div className="text-left flex-1">
            <p className="font-game font-bold text-spooky-text text-base">How to Play</p>
            <p className="font-game text-gray-400 text-sm">Quick rules reference</p>
          </div>
          <span className="text-spooky-purple text-xl">→</span>
        </button>

        {/* Manual save */}
        <button
          onClick={handleSave}
          className="w-full bg-spooky-card border-2 border-spooky-purple rounded-xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
        >
          <span className="text-3xl">💾</span>
          <div className="text-left flex-1">
            <p className="font-game font-bold text-spooky-text text-base">Manual Save</p>
            <p className={`font-game text-sm ${savedMessage ? 'text-green-400' : 'text-gray-400'}`}>
              {savedMessage ? '✅ Saved!' : 'Auto-saves too, but just in case!'}
            </p>
          </div>
        </button>

        {/* Restart */}
        <button
          onClick={() => setConfirmRestart(true)}
          className="w-full bg-red-950 border-2 border-red-800 rounded-xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
        >
          <span className="text-3xl">🔄</span>
          <div className="text-left flex-1">
            <p className="font-game font-bold text-red-300 text-base">Restart Game</p>
            <p className="font-game text-red-400 text-sm">Deletes ALL progress. Gerald will miss you.</p>
          </div>
        </button>
      </div>

      <div className="p-4 border-t border-gray-800">
        <button onClick={onClose} className="w-full game-btn-green py-4 text-lg">
          ✕ Close Settings
        </button>
      </div>
    </div>
  );
}

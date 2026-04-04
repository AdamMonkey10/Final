import React, { useState } from 'react';
import { loadGame } from '../hooks/useSaveLoad';
import { LOCATIONS } from '../data/locations';

interface StartScreenProps {
  onNewGame: (name: string) => void;
  onContinue: () => void;
}

export default function StartScreen({ onNewGame, onContinue }: StartScreenProps) {
  const [showNameInput, setShowNameInput] = useState(false);
  const [name, setName] = useState('');
  const save = loadGame();

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onNewGame(trimmed);
  };

  if (showNameInput) {
    return (
      <div className="min-h-screen bg-spooky-dark flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center">
          <div className="text-5xl mb-4 float-anim">👻</div>
          <h2 className="font-pixel text-spooky-green text-lg md:text-2xl mb-2 px-game-sm">
            What's your name, adventurer?
          </h2>
          <p className="font-game text-spooky-text text-base opacity-80">
            Gerald needs to know who he's forgetting!
          </p>
        </div>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Your name here..."
            maxLength={20}
            autoFocus
            className="w-full bg-spooky-card border-2 border-spooky-purple text-spooky-text font-game text-xl px-5 py-4 rounded-xl focus:outline-none focus:border-spooky-green placeholder-gray-600"
          />
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="game-btn-green w-full py-5 text-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🎃 Begin the Adventure!
          </button>
          <button
            onClick={() => setShowNameInput(false)}
            className="game-btn w-full py-4 text-base bg-spooky-card border-2 border-gray-700"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-spooky-dark flex flex-col items-center justify-center p-6 gap-8 overflow-hidden">
      {/* Title */}
      <div className="text-center select-none">
        <div className="text-6xl md:text-8xl mb-4 float-anim">🎃</div>
        <h1 className="font-pixel text-spooky-orange text-xl md:text-3xl mb-2 leading-tight flicker px-2">
          SPOOKY QUEST
        </h1>
        <h2 className="font-pixel text-spooky-green text-sm md:text-lg mb-6 px-4">
          The Giggling Graveyard
        </h2>
        <p className="font-game text-spooky-text text-base md:text-lg opacity-70 max-w-xs mx-auto px-4">
          A tale of friendly ghosts, terrible baked goods, and one extremely nervous villain.
        </p>
      </div>

      {/* Buttons */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        {save && (
          <button
            onClick={onContinue}
            className="game-btn-green w-full py-6 text-xl flex flex-col items-center gap-1"
          >
            <span>▶️ Continue Adventure</span>
            <span className="text-sm font-game opacity-80 font-normal">
              Lvl {save.stats.level} · {LOCATIONS[save.currentLocation]?.name}
            </span>
          </button>
        )}
        <button
          onClick={() => setShowNameInput(true)}
          className={`w-full py-6 text-xl game-btn ${save ? 'border-2 border-spooky-purple bg-spooky-card' : 'game-btn-orange'}`}
        >
          {save ? '🔄 New Game' : '🎃 New Game'}
        </button>
      </div>

      {/* Floating ghosts decoration */}
      <div className="flex gap-8 text-4xl select-none opacity-50 mt-4">
        <span className="float-anim" style={{ animationDelay: '0s' }}>👻</span>
        <span className="float-anim" style={{ animationDelay: '0.5s' }}>💀</span>
        <span className="float-anim" style={{ animationDelay: '1s' }}>🕷️</span>
        <span className="float-anim" style={{ animationDelay: '1.5s' }}>🦇</span>
        <span className="float-anim" style={{ animationDelay: '2s' }}>👻</span>
      </div>

      <p className="font-game text-gray-600 text-xs text-center">
        For adventurers aged 7–12 · Touch-friendly · Auto-saves
      </p>
    </div>
  );
}

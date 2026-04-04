import React from 'react';
import type { GameState } from '../types/game';

interface WinScreenProps {
  state: GameState;
  onRestart: () => void;
}

const CREDITS = [
  { role: '👻 Forgetful Ghost', name: 'Gerald' },
  { role: '🧙‍♀️ Dramatic Witch', name: 'Beatrice' },
  { role: '💀 Terrible Baker', name: 'Benny Bones' },
  { role: '🐸 Sock Scientist', name: 'Prof. Squelch' },
  { role: '🤫 Librarian', name: 'Whispering Wendy' },
  { role: '😱 Cowardly Villain', name: 'Lord Von Dooooom' },
  { role: '🎮 Brave Hero', name: '★ YOU ★' },
];

export default function WinScreen({ state, onRestart }: WinScreenProps) {
  const completedQuests = Object.values(state.questStates).filter(s => s === 'complete').length;

  return (
    <div className="min-h-screen bg-spooky-dark flex flex-col items-center p-6 gap-6 overflow-y-auto">
      {/* WIN! */}
      <div className="text-center pt-6">
        <div className="text-7xl mb-4 float-anim">🏆</div>
        <h1 className="font-pixel text-spooky-orange text-xl md:text-3xl mb-2 flicker">YOU WIN!!!</h1>
        <h2 className="font-pixel text-spooky-green text-sm md:text-base">Spooky Quest Complete!</h2>
      </div>

      {/* Ending text */}
      <div className="bg-spooky-card border-2 border-spooky-purple rounded-2xl p-5 max-w-md w-full">
        <p className="font-game text-spooky-text text-base md:text-lg leading-relaxed text-center">
          Lord Von Dooooom has been defeated — and is currently having a WONDERFUL time at his own tea party with all his new friends.
        </p>
        <p className="font-game text-spooky-text text-sm leading-relaxed text-center mt-3 opacity-80">
          Gerald forgot it happened but is very happy anyway. Benny made a victory cake. It ran away again. Professor Squelch took notes. Beatrice performed a 23-act play about the whole adventure. Wendy shushed everyone through it.
        </p>
        <p className="font-game text-spooky-orange text-base text-center mt-4 font-bold">
          The Giggling Graveyard is safe. For now.
        </p>
      </div>

      {/* Stats */}
      <div className="bg-spooky-card border border-spooky-purple rounded-xl p-4 w-full max-w-md">
        <p className="font-game text-gray-500 text-xs text-center mb-3">YOUR ADVENTURE</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-2xl">⭐</p>
            <p className="font-game text-spooky-text text-base font-bold">Level {state.stats.level}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl">💰</p>
            <p className="font-game text-yellow-400 text-base font-bold">{state.gold} gold</p>
          </div>
          <div className="text-center">
            <p className="text-2xl">📜</p>
            <p className="font-game text-spooky-text text-base font-bold">{completedQuests}/5 quests</p>
          </div>
          <div className="text-center">
            <p className="text-2xl">🎒</p>
            <p className="font-game text-spooky-text text-base font-bold">{state.inventory.length} items</p>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="w-full max-w-md">
        <p className="font-pixel text-spooky-green text-xs text-center mb-3">~ CREDITS ~</p>
        <div className="flex flex-col gap-2">
          {CREDITS.map((credit, i) => (
            <div key={i} className="flex justify-between items-center bg-spooky-card rounded-xl px-4 py-3">
              <span className="font-game text-gray-400 text-sm">{credit.role}</span>
              <span className="font-game text-spooky-text text-sm font-bold">{credit.name === '★ YOU ★' ? `★ ${state.playerName} ★` : credit.name}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="font-game text-gray-500 text-xs text-center">
        Built with 🎃 love for brave adventurers everywhere
      </p>

      <button
        onClick={onRestart}
        className="w-full max-w-md game-btn-green py-5 text-xl mb-8"
      >
        🔄 Play Again!
      </button>
    </div>
  );
}

import React from 'react';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { HUD } from '@/components/game/HUD';
import { GalaxyMap } from '@/components/game/GalaxyMap';
import { PlanetView } from '@/components/game/PlanetView';
import { TravelScreen } from '@/components/game/TravelScreen';
import { CombatScreen } from '@/components/game/CombatScreen';
import { GameNotifications } from '@/components/game/GameNotifications';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#060612] text-red-400 gap-4 p-6 text-center">
          <div className="text-5xl">⚠️</div>
          <div className="text-lg font-bold">Something went wrong</div>
          <div className="text-xs text-gray-500 font-mono max-w-xs break-words">{this.state.error.message}</div>
          <button
            onClick={() => { localStorage.removeItem('space_rpg_save'); location.reload(); }}
            className="mt-2 px-6 py-3 bg-cyan-700 text-white rounded-xl font-bold"
          >
            Reset &amp; Restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GameShell() {
  const { state, newGame, dispatch } = useGame();

  return (
    <div className="flex flex-col bg-[#060612] overflow-hidden" style={{ height: '100dvh' }}>
      <HUD />
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <GameNotifications />
        {state.screen === 'planet'     && <PlanetView />}
        {state.screen === 'galaxy_map' && <GalaxyMap />}
        {state.screen === 'travel'     && <TravelScreen />}
        {state.screen === 'combat'     && <CombatScreen />}
      </div>
      {(state.screen === 'planet' || state.screen === 'galaxy_map') && (
        <div className="flex border-t border-gray-800/60 bg-black/80 shrink-0">
          <button
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'planet' })}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-mono transition-colors ${
              state.screen === 'planet' ? 'text-cyan-400 bg-cyan-950/30' : 'text-gray-600'
            }`}
          >
            <span className="text-lg">🪐</span><span>PLANET</span>
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'galaxy_map' })}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-mono transition-colors ${
              state.screen === 'galaxy_map' ? 'text-cyan-400 bg-cyan-950/30' : 'text-gray-600'
            }`}
          >
            <span className="text-lg">🗺</span><span>GALAXY</span>
          </button>
          <button
            onClick={newGame}
            className="px-4 py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-mono text-gray-700 hover:text-red-500 transition-colors"
          >
            <span className="text-lg">🔄</span><span>RESET</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <GameShell />
      </GameProvider>
    </ErrorBoundary>
  );
}

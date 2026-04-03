import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { MarketTab } from './MarketTab';
import { DockTab } from './DockTab';
import { MissionsTab } from './MissionsTab';
import { StarField } from './StarField';

type Tab = 'market' | 'dock' | 'missions';

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'market', label: 'Market', icon: '🏪' },
  { id: 'dock', label: 'Dock', icon: '🔧' },
  { id: 'missions', label: 'Missions', icon: '📋' },
];

const ECONOMY_COLORS: Record<string, string> = {
  mining: 'from-amber-900/40',
  tech: 'from-blue-900/40',
  agricultural: 'from-green-900/40',
  military: 'from-red-900/40',
  blackmarket: 'from-purple-900/40',
  industrial: 'from-orange-900/40',
  research: 'from-cyan-900/40',
  frontier: 'from-gray-900/40',
  trading: 'from-yellow-900/40',
};

const DANGER_LABELS = ['Safe', 'Risky', 'Dangerous', 'Lethal'];

export function PlanetView() {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = useState<Tab>('market');
  const planet = state.planets.find(p => p.id === state.player.currentPlanetId)!;

  const gradientClass = ECONOMY_COLORS[planet.economy] ?? 'from-gray-900/40';

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#060612]">
      {/* Planet header */}
      <div className={`relative px-4 py-3 bg-gradient-to-b ${gradientClass} to-transparent border-b border-gray-800/50 overflow-hidden`}>
        <StarField count={40} className="opacity-30" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="text-4xl">{planet.icon}</div>
          <div className="flex-1">
            <div className="text-white text-xl font-bold leading-tight">{planet.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">{planet.economy}</span>
              <span className="text-gray-600">·</span>
              <span className="text-xs text-gray-500">{planet.faction}</span>
              {planet.dangerLevel > 0 && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-xs text-red-400">⚠ {DANGER_LABELS[planet.dangerLevel]}</span>
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 leading-snug">{planet.description}</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800/60 bg-black/40">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-mono transition-colors ${
              activeTab === tab.id
                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-950/20'
                : 'text-gray-500 hover:text-gray-300 active:text-gray-300'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'market' && <MarketTab />}
        {activeTab === 'dock' && <DockTab />}
        {activeTab === 'missions' && <MissionsTab />}
      </div>

      {/* Galaxy map button */}
      <div className="px-4 py-2 border-t border-gray-800/50 bg-black/60">
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'galaxy_map' })}
          className="w-full py-3 bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-bold rounded-xl transition-colors text-sm"
        >
          🗺 Open Galaxy Map — Travel
        </button>
      </div>
    </div>
  );
}

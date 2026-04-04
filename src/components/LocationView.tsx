import { useRef, useState } from 'react';
import type { GameState, LocationId } from '../types/game';
import { LOCATIONS, LOCATION_CONNECTION_LABELS } from '../data/locations';
import { NPCS } from '../data/npcs';

interface LocationViewProps {
  state: GameState;
  onTravel: (locationId: LocationId) => void;
  onTalkToNpc: () => void;
  onExplore: () => void;
}

export default function LocationView({ state, onTravel, onTalkToNpc, onExplore }: LocationViewProps) {
  const location = LOCATIONS[state.currentLocation];
  const npc = location.npcId ? NPCS[location.npcId] : null;
  const touchStartX = useRef<number | null>(null);
  const [swipeHint, setSwipeHint] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 60) return;

    const connections = location.connections;
    if (diff > 0 && connections.length > 0) {
      onTravel(connections[0]);
    } else if (diff < 0 && connections.length > 1) {
      onTravel(connections[1]);
    } else {
      setSwipeHint(true);
      setTimeout(() => setSwipeHint(false), 2000);
    }
  };

  return (
    <div
      className="flex flex-col gap-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Location Card */}
      <div className="bg-spooky-card border-2 border-spooky-purple rounded-xl p-4 candle-border">
        <div className="text-center mb-3">
          <div className="text-6xl md:text-7xl mb-2 float-anim">{location.emoji}</div>
          <h2 className="font-pixel text-spooky-orange text-base md:text-xl mb-2">{location.name}</h2>
          <p className="font-game text-spooky-text text-sm md:text-base leading-relaxed">
            {location.description}
          </p>
          <p className="font-game text-red-400 text-xs md:text-sm mt-2 opacity-80">
            ⚠️ {location.danger}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-3">
          {/* Talk to NPC */}
          {npc && (
            <button
              onClick={onTalkToNpc}
              className="flex-1 bg-spooky-darker border-2 border-spooky-green rounded-xl p-3 flex items-center gap-2 active:scale-95 transition-transform min-h-[60px]"
            >
              <span className="text-3xl">{npc.emoji}</span>
              <div className="text-left">
                <p className="font-game font-bold text-spooky-green text-sm">{npc.name}</p>
                <p className="font-game text-gray-400 text-xs">Talk · Shop</p>
              </div>
            </button>
          )}

          {/* Explore button */}
          <button
            onClick={onExplore}
            className="flex-1 bg-spooky-darker border-2 border-yellow-700 rounded-xl p-3 flex items-center gap-2 active:scale-95 transition-transform min-h-[60px]"
          >
            <span className="text-3xl">🔍</span>
            <div className="text-left">
              <p className="font-game font-bold text-yellow-400 text-sm">Explore</p>
              <p className="font-game text-gray-400 text-xs">Search area</p>
            </div>
          </button>
        </div>
      </div>

      {/* Exits */}
      <div>
        <p className="font-game text-gray-500 text-xs mb-2 px-1">
          WHERE TO NEXT? {swipeHint && <span className="text-spooky-orange">(swipe or tap)</span>}
        </p>
        <div className="grid gap-3">
          {location.connections.map(connId => {
            const connLocation = LOCATIONS[connId];
            const label = LOCATION_CONNECTION_LABELS[`${state.currentLocation}-${connId}`] || connLocation.name;
            const locked = connLocation.requiredLevel && state.stats.level < connLocation.requiredLevel;
            return (
              <button
                key={connId}
                onClick={() => !locked && onTravel(connId)}
                disabled={!!locked}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all active:scale-95
                  ${locked
                    ? 'border-gray-700 bg-gray-900 opacity-50 cursor-not-allowed'
                    : 'border-spooky-purple bg-spooky-card hover:border-spooky-orange'
                  }
                `}
              >
                <span className="text-3xl">{connLocation.emoji}</span>
                <div className="text-left flex-1">
                  <p className="font-game font-bold text-spooky-text text-base">{label}</p>
                  {locked && (
                    <p className="font-game text-gray-500 text-xs">🔒 Requires Level {connLocation.requiredLevel}</p>
                  )}
                  {!locked && (
                    <p className="font-game text-gray-500 text-xs">{connLocation.danger}</p>
                  )}
                </div>
                {!locked && <span className="text-spooky-purple text-xl">→</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

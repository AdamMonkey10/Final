import React, { useState } from 'react';
import type { GameState, ItemId } from '../types/game';
import { ITEMS } from '../data/items';

interface InventoryProps {
  state: GameState;
  onClose: () => void;
  onUseItem: (itemId: ItemId) => boolean;
}

export default function Inventory({ state, onClose, onUseItem }: InventoryProps) {
  const [message, setMessage] = useState('');
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const handleUse = (itemId: ItemId) => {
    const item = ITEMS[itemId];
    if (item.healAmount) {
      if (state.stats.hp >= state.stats.maxHp) {
        showMsg('❤️ Already at full HP!');
        return;
      }
      const success = onUseItem(itemId);
      if (success) {
        showMsg(`✅ Used ${item.emoji} ${item.name}! Restored ${item.healAmount} HP.`);
        setSelectedItem(null);
      }
    } else {
      showMsg(`${item.emoji} ${item.name} can't be used here.`);
    }
  };

  const categoryColors: Record<string, string> = {
    healing: 'border-green-700 bg-green-950',
    key: 'border-yellow-700 bg-yellow-950',
    weapon: 'border-red-700 bg-red-950',
    curiosity: 'border-purple-700 bg-purple-950',
  };

  const categoryIcons: Record<string, string> = {
    healing: '🧪',
    key: '🗝️',
    weapon: '⚔️',
    curiosity: '🎭',
  };

  // Fill to 10 slots
  const slots = [...state.inventory, ...Array(Math.max(0, 10 - state.inventory.length)).fill(null)];

  return (
    <div className="overlay-fullscreen flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-spooky-purple">
        <div>
          <h2 className="font-pixel text-spooky-orange text-base">🎒 Inventory</h2>
          <p className="font-game text-gray-500 text-xs">{state.inventory.length}/10 slots used</p>
        </div>
        <button onClick={onClose} className="overlay-close-btn">✕</button>
      </div>

      {message && (
        <div className="mx-4 mt-3 bg-spooky-darker border border-spooky-green rounded-xl p-3 text-center font-game text-sm text-spooky-green">
          {message}
        </div>
      )}

      {/* Item detail panel */}
      {selectedItem && (
        <div className="mx-4 mt-3 bg-spooky-card border-2 border-spooky-purple rounded-xl p-4 flex items-start gap-4">
          <span className="text-5xl">{ITEMS[selectedItem].emoji}</span>
          <div className="flex-1">
            <p className="font-game font-bold text-spooky-text text-base">{ITEMS[selectedItem].name}</p>
            <p className="font-game text-gray-400 text-sm leading-relaxed">{ITEMS[selectedItem].description}</p>
            {ITEMS[selectedItem].healAmount && (
              <p className="font-game text-green-400 text-sm mt-1">Restores {ITEMS[selectedItem].healAmount} HP</p>
            )}
            {ITEMS[selectedItem].attackBonus && (
              <p className="font-game text-red-400 text-sm mt-1">+{ITEMS[selectedItem].attackBonus} Attack</p>
            )}
            {ITEMS[selectedItem].defenseBonus && (
              <p className="font-game text-blue-400 text-sm mt-1">+{ITEMS[selectedItem].defenseBonus} Defense</p>
            )}
            <p className="font-game text-gray-500 text-xs mt-1">Value: {ITEMS[selectedItem].value} 💰</p>
          </div>
          <div className="flex flex-col gap-2">
            {ITEMS[selectedItem].healAmount && (
              <button
                onClick={() => handleUse(selectedItem)}
                className="game-btn-green px-3 py-2 text-sm"
              >
                Use
              </button>
            )}
            <button
              onClick={() => setSelectedItem(null)}
              className="game-btn px-3 py-2 text-sm bg-spooky-darker border border-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {slots.map((invItem, i) => {
            if (!invItem) {
              return (
                <div
                  key={`empty-${i}`}
                  className="bg-spooky-darker border-2 border-gray-800 rounded-xl p-4 flex items-center justify-center aspect-square min-h-[80px] opacity-30"
                >
                  <span className="text-3xl text-gray-700">○</span>
                </div>
              );
            }
            const item = ITEMS[(invItem as { itemId: ItemId; quantity: number }).itemId];
            const colorCls = categoryColors[item.category] ?? 'border-gray-700 bg-spooky-card';
            const isSelected = selectedItem === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(isSelected ? null : item.id)}
                className={`
                  border-2 rounded-xl p-3 flex flex-col items-center gap-2 active:scale-95 transition-transform min-h-[80px]
                  ${colorCls} ${isSelected ? 'ring-2 ring-spooky-orange' : ''}
                `}
              >
                <span className="text-4xl">{item.emoji}</span>
                <p className="font-game text-xs text-center text-spooky-text leading-tight">{item.name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs">{categoryIcons[item.category]}</span>
                  <span className="font-game text-xs text-yellow-400">×{(invItem as { quantity: number }).quantity}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex flex-wrap gap-3">
          {Object.entries(categoryIcons).map(([cat, icon]) => (
            <span key={cat} className="font-game text-xs text-gray-500 flex items-center gap-1">
              {icon} {cat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

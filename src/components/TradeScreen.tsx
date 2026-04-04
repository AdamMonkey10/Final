import React, { useState } from 'react';
import type { GameState, NpcId, ItemId } from '../types/game';
import { NPCS } from '../data/npcs';
import { ITEMS } from '../data/items';

interface TradeScreenProps {
  state: GameState;
  npcId: NpcId;
  mode: 'shop' | 'trade';
  onClose: () => void;
  onBuy: (itemId: ItemId, price: number) => boolean;
  onTrade: (give: { itemId: ItemId; quantity: number }, receive: { itemId: ItemId; quantity: number }) => boolean;
}

export default function TradeScreen({ state, npcId, mode, onClose, onBuy, onTrade }: TradeScreenProps) {
  const npc = NPCS[npcId];
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);
  const [message, setMessage] = useState('');
  const [shopStock, setShopStock] = useState<Record<string, number>>(
    Object.fromEntries(npc.shop.map(s => [s.itemId, s.stock]))
  );

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const handleBuy = (itemId: ItemId, price: number) => {
    const item = ITEMS[itemId];
    if (state.gold < price) {
      showMsg(`❌ Not enough gold! Need ${price} 💰`);
      return;
    }
    if (state.inventory.length >= 10 && !state.inventory.find(i => i.itemId === itemId)) {
      showMsg('❌ Inventory is full! (10/10)');
      return;
    }
    const success = onBuy(itemId, price);
    if (success) {
      setShopStock(prev => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] ?? 0) - 1) }));
      showMsg(`✅ Bought ${item.emoji} ${item.name}!`);
    }
  };

  const handleTrade = () => {
    if (!npc.tradeOffer) return;
    const { give, receive } = npc.tradeOffer;
    const playerHas = state.inventory.find(i => i.itemId === give.itemId);
    if (!playerHas || playerHas.quantity < give.quantity) {
      showMsg(`❌ You need ${give.quantity}x ${ITEMS[give.itemId].emoji} ${ITEMS[give.itemId].name}`);
      return;
    }
    const success = onTrade(give, receive);
    if (success) {
      showMsg(`✅ Trade complete! Got ${ITEMS[receive.itemId].emoji} ${ITEMS[receive.itemId].name}!`);
    }
  };

  return (
    <div className="overlay-fullscreen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-spooky-purple">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{npc.emoji}</span>
          <div>
            <h2 className="font-pixel text-spooky-orange text-sm md:text-base">
              {mode === 'shop' ? '🛍️ Shop' : '🔄 Trade'}
            </h2>
            <p className="font-game text-gray-400 text-xs">{npc.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-game text-yellow-400 font-bold text-base">💰 {state.gold}</span>
          <button onClick={onClose} className="overlay-close-btn">✕</button>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className="mx-4 mt-3 bg-spooky-darker border border-spooky-green rounded-xl p-3 text-center font-game text-sm text-spooky-green">
          {message}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'shop' && (
          <div>
            <p className="font-game text-gray-500 text-xs mb-3">TAP AN ITEM TO BUY IT</p>
            <div className="flex flex-col gap-3">
              {npc.shop.map(shopItem => {
                const item = ITEMS[shopItem.itemId];
                const stock = shopStock[shopItem.itemId] ?? shopItem.stock;
                const canAfford = state.gold >= shopItem.price;
                return (
                  <button
                    key={shopItem.itemId}
                    onClick={() => handleBuy(shopItem.itemId, shopItem.price)}
                    disabled={stock <= 0 || !canAfford}
                    className={`
                      w-full flex items-center gap-4 p-4 rounded-xl border-2 active:scale-95 transition-all
                      ${stock <= 0 ? 'border-gray-700 bg-gray-900 opacity-40 cursor-not-allowed' :
                        canAfford ? 'border-spooky-purple bg-spooky-card hover:border-spooky-orange' :
                        'border-red-900 bg-spooky-card opacity-60 cursor-not-allowed'}
                    `}
                  >
                    <span className="text-4xl">{item.emoji}</span>
                    <div className="flex-1 text-left">
                      <p className="font-game font-bold text-spooky-text text-base">{item.name}</p>
                      <p className="font-game text-gray-400 text-xs leading-snug">{item.description}</p>
                      {item.healAmount && <p className="font-game text-green-400 text-xs">Heals {item.healAmount} HP</p>}
                      <p className="font-game text-gray-500 text-xs">Stock: {stock}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-game font-bold text-base ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                        {shopItem.price} 💰
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'trade' && npc.tradeOffer && (
          <div className="flex flex-col gap-4">
            <p className="font-game text-gray-400 text-sm text-center">{npc.tradeOffer.description}</p>

            {/* Two panels */}
            <div className="grid grid-cols-2 gap-3">
              {/* You give */}
              <div className="bg-spooky-card border-2 border-red-800 rounded-xl p-3 text-center">
                <p className="font-game text-red-400 text-xs mb-2">YOU GIVE</p>
                <div className="text-4xl mb-2">{ITEMS[npc.tradeOffer.give.itemId].emoji}</div>
                <p className="font-game text-spooky-text text-sm font-bold">{ITEMS[npc.tradeOffer.give.itemId].name}</p>
                <p className="font-game text-gray-500 text-xs">× {npc.tradeOffer.give.quantity}</p>
                <p className="font-game text-yellow-400 text-xs mt-1">
                  You have: {state.inventory.find(i => i.itemId === npc.tradeOffer!.give.itemId)?.quantity ?? 0}
                </p>
              </div>

              {/* You get */}
              <div className="bg-spooky-card border-2 border-green-800 rounded-xl p-3 text-center">
                <p className="font-game text-green-400 text-xs mb-2">YOU GET</p>
                <div className="text-4xl mb-2">{ITEMS[npc.tradeOffer.receive.itemId].emoji}</div>
                <p className="font-game text-spooky-text text-sm font-bold">{ITEMS[npc.tradeOffer.receive.itemId].name}</p>
                <p className="font-game text-gray-500 text-xs">× {npc.tradeOffer.receive.quantity}</p>
              </div>
            </div>

            {/* Player inventory */}
            <div>
              <p className="font-game text-gray-500 text-xs mb-2">YOUR INVENTORY</p>
              <div className="flex flex-wrap gap-2">
                {state.inventory.map(invItem => {
                  const item = ITEMS[invItem.itemId];
                  return (
                    <div key={invItem.itemId} className="bg-spooky-darker border border-gray-700 rounded-lg p-2 text-center min-w-[60px]">
                      <div className="text-2xl">{item.emoji}</div>
                      <p className="font-game text-xs text-gray-400">×{invItem.quantity}</p>
                    </div>
                  );
                })}
                {state.inventory.length === 0 && (
                  <p className="font-game text-gray-600 text-sm">Nothing in your bag!</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="p-4 border-t border-spooky-purple flex flex-col gap-3">
        {mode === 'trade' && npc.tradeOffer && (
          <button
            onClick={handleTrade}
            className="w-full game-btn-green py-5 text-lg"
          >
            🤝 Complete Trade
          </button>
        )}
        <button
          onClick={onClose}
          className="w-full game-btn py-5 text-lg bg-spooky-card border-2 border-gray-700"
        >
          ← Leave Shop
        </button>
      </div>
    </div>
  );
}

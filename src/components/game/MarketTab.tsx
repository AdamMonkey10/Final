import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getCargoUsed, getShipEffectiveStats } from '@/lib/game-engine';
import { GOODS } from '@/data/game-data';
import type { GoodType, MarketListing } from '@/types/game';

const DEMAND_LABELS: Record<MarketListing['demand'], { label: string; color: string }> = {
  surplus: { label: 'SURPLUS', color: 'text-blue-400' },
  normal: { label: 'NORMAL', color: 'text-gray-400' },
  shortage: { label: 'SHORTAGE', color: 'text-yellow-400' },
  critical: { label: 'CRITICAL', color: 'text-red-400' },
};

export function MarketTab() {
  const { state, buyGood, sellGood, currentPlanet } = useGame();
  const { player } = state;
  const [selected, setSelected] = useState<GoodType | null>(null);
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');

  const effective = getShipEffectiveStats(player.ship);
  const cargoUsed = getCargoUsed(player.ship);
  const cargoFree = effective.cargoCapacity - cargoUsed;

  const selectedListing = currentPlanet.market.find(m => m.good === selected);
  const selectedCargoItem = player.ship.cargo.find(c => c.good === selected);
  const selectedGood = selected ? GOODS[selected] : null;

  function selectGood(good: GoodType, defaultMode: 'buy' | 'sell') {
    setSelected(good);
    setMode(defaultMode);
    setQty(1);
  }

  function maxBuyQty(): number {
    if (!selectedListing || !selectedGood) return 0;
    const affordable = Math.floor(player.credits / selectedListing.buyPrice);
    const fitsInCargo = Math.floor(cargoFree / selectedGood.weight);
    return Math.min(affordable, fitsInCargo, selectedListing.quantity);
  }

  function maxSellQty(): number {
    return selectedCargoItem?.quantity ?? 0;
  }

  const maxQty = mode === 'buy' ? maxBuyQty() : maxSellQty();
  const safeQty = Math.max(1, Math.min(qty, maxQty));

  const estimatedCost = selectedListing ? selectedListing.buyPrice * safeQty : 0;
  const estimatedRevenue = selectedListing ? selectedListing.sellPrice * safeQty : 0;
  const avgPurchase = selectedCargoItem?.avgPurchasePrice ?? 0;
  const profitPerUnit = selectedListing ? selectedListing.sellPrice - avgPurchase : 0;

  function handleConfirm() {
    if (!selected) return;
    if (mode === 'buy') {
      buyGood(selected, safeQty);
    } else {
      sellGood(selected, safeQty);
    }
    setQty(1);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cargo summary bar */}
      <div className="px-3 py-2 bg-blue-950/30 border-b border-cyan-900/40 flex justify-between text-xs font-mono">
        <span className="text-gray-400">Cargo: <span className="text-white">{cargoUsed}/{effective.cargoCapacity}</span></span>
        <span className="text-gray-400">Credits: <span className="text-yellow-400">{player.credits.toLocaleString()}cr</span></span>
        <span className="text-gray-400">Free: <span className="text-cyan-400">{cargoFree} units</span></span>
      </div>

      {/* Two columns: market listing + cargo */}
      <div className="flex-1 overflow-y-auto">
        {/* Cargo holdings */}
        {player.ship.cargo.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <div className="text-xs text-cyan-500 font-mono mb-1 uppercase tracking-wider">Your Cargo</div>
            <div className="flex flex-wrap gap-1.5">
              {player.ship.cargo.map(item => {
                const good = GOODS[item.good];
                const listing = currentPlanet.market.find(m => m.good === item.good);
                const profit = listing ? listing.sellPrice - item.avgPurchasePrice : 0;
                return (
                  <button
                    key={item.good}
                    onClick={() => selectGood(item.good, 'sell')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                      selected === item.good && mode === 'sell'
                        ? 'border-green-400 bg-green-900/40 text-green-300'
                        : 'border-gray-700 bg-gray-900/60 text-gray-300 active:border-gray-500'
                    }`}
                  >
                    <span>{good.icon} {item.quantity}x</span>
                    <span className={`ml-1 ${profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {profit > 0 ? '+' : ''}{profit}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Market listings */}
        <div className="px-3 pt-2">
          <div className="text-xs text-cyan-500 font-mono mb-1 uppercase tracking-wider">{currentPlanet.name} Market</div>
        </div>
        <div className="px-3 pb-2 space-y-1">
          {currentPlanet.market.map(listing => {
            const good = GOODS[listing.good];
            const isSelected = selected === listing.good;
            const cargoItem = player.ship.cargo.find(c => c.good === listing.good);
            const demandInfo = DEMAND_LABELS[listing.demand];
            const cantAfford = listing.buyPrice > player.credits;
            const noSpace = good.weight > cargoFree;

            return (
              <button
                key={listing.good}
                onClick={() => selectGood(listing.good, cargoItem ? 'sell' : 'buy')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all border ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-950/50'
                    : 'border-gray-800 bg-gray-900/40 active:border-gray-600'
                } ${good.isIllegal ? 'border-purple-900/60' : ''}`}
              >
                <span className="text-xl w-7 text-center">{good.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium ${good.isIllegal ? 'text-purple-300' : 'text-white'}`}>
                      {good.name}
                    </span>
                    {good.isIllegal && <span className="text-[10px] text-purple-500 font-bold">ILLEGAL</span>}
                    <span className={`text-[10px] font-bold ml-auto ${demandInfo.color}`}>{demandInfo.label}</span>
                  </div>
                  <div className="flex gap-3 text-xs font-mono mt-0.5">
                    <span className={`${cantAfford || noSpace ? 'text-red-500' : 'text-green-400'}`}>
                      Buy: {listing.buyPrice}cr
                    </span>
                    <span className="text-yellow-400">Sell: {listing.sellPrice}cr</span>
                    <span className="text-gray-500">Qty: {listing.quantity}</span>
                    {cargoItem && (
                      <span className="text-cyan-400">Have: {cargoItem.quantity}</span>
                    )}
                  </div>
                </div>
                <span className="text-gray-600 text-xs">{good.weight}t</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transaction panel */}
      {selected && selectedListing && selectedGood && (
        <div className="border-t border-cyan-900/50 bg-black/70 p-3 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('buy'); setQty(1); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                mode === 'buy'
                  ? 'bg-cyan-700 text-white'
                  : 'bg-gray-900 text-gray-400 border border-gray-700'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => { setMode('sell'); setQty(1); }}
              disabled={!selectedCargoItem}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                mode === 'sell'
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-900 text-gray-400 border border-gray-700 disabled:opacity-30'
              }`}
            >
              SELL
            </button>
          </div>

          {/* Quantity control */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-10 h-10 bg-gray-800 rounded-lg text-white text-xl font-bold active:bg-gray-700 flex items-center justify-center"
            >−</button>
            <div className="flex-1 text-center">
              <input
                type="number"
                value={qty}
                min={1}
                max={maxQty}
                onChange={e => setQty(Math.max(1, Math.min(parseInt(e.target.value) || 1, maxQty)))}
                className="w-full text-center bg-gray-900 text-white border border-gray-700 rounded-lg py-2 text-lg font-mono"
              />
            </div>
            <button
              onClick={() => setQty(q => Math.min(q + 1, maxQty))}
              className="w-10 h-10 bg-gray-800 rounded-lg text-white text-xl font-bold active:bg-gray-700 flex items-center justify-center"
            >+</button>
            <button
              onClick={() => setQty(maxQty)}
              className="px-3 h-10 bg-gray-800 rounded-lg text-gray-400 text-xs font-mono active:bg-gray-700"
            >MAX</button>
          </div>

          {/* Summary */}
          <div className="flex justify-between items-center text-sm font-mono">
            {mode === 'buy' ? (
              <>
                <span className="text-gray-400">Total cost:</span>
                <span className={`font-bold ${estimatedCost > player.credits ? 'text-red-400' : 'text-yellow-300'}`}>
                  {estimatedCost.toLocaleString()}cr
                </span>
              </>
            ) : (
              <>
                <span className="text-gray-400">
                  Revenue: <span className="text-yellow-300">{estimatedRevenue.toLocaleString()}cr</span>
                </span>
                <span className={`font-bold ${profitPerUnit * safeQty >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {profitPerUnit * safeQty >= 0 ? '+' : ''}{(profitPerUnit * safeQty).toLocaleString()} profit
                </span>
              </>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={maxQty === 0}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              mode === 'buy'
                ? 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white'
                : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white'
            }`}
          >
            {mode === 'buy'
              ? `Buy ${safeQty}x ${selectedGood.icon} ${selectedGood.name}`
              : `Sell ${safeQty}x ${selectedGood.icon} ${selectedGood.name}`
            }
          </button>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getCargoUsed, getShipEffectiveStats, getBestSellHint, getRepPriceMultiplier, getRepSellMultiplier } from '@/lib/game-engine';
import { GOODS } from '@/data/game-data';
import type { GoodType, MarketListing } from '@/types/game';

const DEMAND_LABELS: Record<MarketListing['demand'], { label: string; color: string }> = {
  surplus:  { label: 'SURPLUS',  color: 'text-blue-400'   },
  normal:   { label: 'NORMAL',   color: 'text-gray-500'   },
  shortage: { label: 'SHORTAGE', color: 'text-yellow-400' },
  critical: { label: 'CRITICAL', color: 'text-red-400'    },
};

const CATEGORY_COLORS: Record<string, string> = {
  legal:   'text-white',
  rare:    'text-yellow-300',
  luxury:  'text-pink-300',
  illegal: 'text-purple-300',
};

const TREND_ICONS: Record<MarketListing['trend'], string> = {
  up:     '↑',
  down:   '↓',
  stable: '→',
};
const TREND_COLORS: Record<MarketListing['trend'], string> = {
  up:     'text-red-400',   // price up = bad for buyers
  down:   'text-green-400', // price down = good deal
  stable: 'text-gray-600',
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
  const repBuyMult  = getRepPriceMultiplier(player.reputation);
  const repSellMult = getRepSellMultiplier(player.reputation);
  const hasRepBonus = player.reputation >= 5;

  const selectedListing    = currentPlanet.market.find(m => m.good === selected);
  const selectedCargoItem  = player.ship.cargo.find(c => c.good === selected);
  const selectedGood       = selected ? GOODS[selected] : null;

  // Effective prices with rep modifier
  const effectiveBuyPrice  = selectedListing ? Math.round(selectedListing.buyPrice  * repBuyMult)  : 0;
  const effectiveSellPrice = selectedListing ? Math.round(selectedListing.sellPrice * repSellMult) : 0;

  function selectGood(good: GoodType, defaultMode: 'buy' | 'sell') {
    setSelected(good);
    setMode(defaultMode);
    setQty(1);
  }

  function maxBuyQty(): number {
    if (!selectedListing || !selectedGood) return 0;
    const affordable   = Math.floor(player.credits / effectiveBuyPrice);
    const fitsInCargo  = Math.floor(cargoFree / selectedGood.weight);
    return Math.min(affordable, fitsInCargo, selectedListing.quantity);
  }

  function maxSellQty(): number {
    return selectedCargoItem?.quantity ?? 0;
  }

  const maxQty   = mode === 'buy' ? maxBuyQty() : maxSellQty();
  const safeQty  = Math.max(1, Math.min(qty, maxQty));

  const estimatedCost    = effectiveBuyPrice  * safeQty;
  const estimatedRevenue = effectiveSellPrice * safeQty;
  const avgPurchase      = selectedCargoItem?.avgPurchasePrice ?? 0;
  const profitOnSell     = (effectiveSellPrice - avgPurchase) * safeQty;

  // Best sell hint for currently selected buy item
  const bestSell = selected && mode === 'buy'
    ? getBestSellHint(selected, currentPlanet.id, state.planets, player.visitedPlanets)
    : null;

  function handleConfirm() {
    if (!selected) return;
    if (mode === 'buy') buyGood(selected, safeQty);
    else                sellGood(selected, safeQty);
    setQty(1);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cargo + credits bar */}
      <div className="px-3 py-2 bg-blue-950/30 border-b border-cyan-900/40 flex justify-between text-xs font-mono">
        <span className="text-gray-400">Cargo: <span className="text-white">{cargoUsed}/{effective.cargoCapacity}</span></span>
        <span className="text-gray-400">Credits: <span className="text-yellow-400">{player.credits.toLocaleString()}cr</span></span>
        {hasRepBonus && (
          <span className="text-purple-400">⭐ Rep bonus</span>
        )}
      </div>

      {/* Market events banner */}
      {currentPlanet.activeEvents && currentPlanet.activeEvents.length > 0 && (
        <div className="px-3 py-1.5 space-y-1">
          {currentPlanet.activeEvents.map(evt => (
            <div key={evt.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${evt.badgeClass}`}>
              <span>{evt.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="font-bold">{evt.title}</span>
                <span className="text-gray-400 ml-1.5">{evt.description}</span>
              </div>
              <span className="text-gray-500 shrink-0">Day {evt.expiresOnDay}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Cargo holdings */}
        {player.ship.cargo.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <div className="text-xs text-cyan-500 font-mono mb-1 uppercase tracking-wider">Your Cargo</div>
            <div className="flex flex-wrap gap-1.5">
              {player.ship.cargo.map(item => {
                const good    = GOODS[item.good];
                const listing = currentPlanet.market.find(m => m.good === item.good);
                const profit  = listing ? Math.round(listing.sellPrice * repSellMult) - item.avgPurchasePrice : 0;
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
            const good       = GOODS[listing.good];
            const isSelected = selected === listing.good;
            const cargoItem  = player.ship.cargo.find(c => c.good === listing.good);
            const demandInfo = DEMAND_LABELS[listing.demand];
            const dispBuyPrice = Math.round(listing.buyPrice * repBuyMult);
            const cantAfford = dispBuyPrice > player.credits;
            const noSpace    = good.weight > cargoFree;
            const trendIcon  = TREND_ICONS[listing.trend];
            const trendColor = TREND_COLORS[listing.trend];

            return (
              <button
                key={listing.good}
                onClick={() => selectGood(listing.good, cargoItem ? 'sell' : 'buy')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all border ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-950/50'
                    : good.category === 'illegal'
                    ? 'border-purple-900/50 bg-gray-900/40 active:border-purple-700'
                    : good.category === 'rare'
                    ? 'border-yellow-900/40 bg-gray-900/40 active:border-yellow-700'
                    : 'border-gray-800 bg-gray-900/40 active:border-gray-600'
                }`}
              >
                <span className="text-xl w-7 text-center">{good.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`text-sm font-medium ${CATEGORY_COLORS[good.category]}`}>
                      {good.name}
                    </span>
                    {good.category === 'illegal' && (
                      <span className="text-[9px] text-purple-500 font-bold tracking-wide">ILLEGAL</span>
                    )}
                    {good.category === 'rare' && (
                      <span className="text-[9px] text-yellow-600 font-bold tracking-wide">RARE</span>
                    )}
                    {good.category === 'luxury' && (
                      <span className="text-[9px] text-pink-600 font-bold tracking-wide">LUXURY</span>
                    )}
                    <span className={`text-[10px] font-bold ml-auto ${demandInfo.color}`}>{demandInfo.label}</span>
                  </div>
                  <div className="flex gap-2 text-xs font-mono mt-0.5 flex-wrap">
                    <span className={cantAfford || noSpace ? 'text-red-500' : 'text-green-400'}>
                      Buy: {dispBuyPrice}cr
                      <span className={`ml-0.5 text-[10px] ${trendColor}`}>{trendIcon}</span>
                    </span>
                    <span className="text-yellow-400">Sell: {Math.round(listing.sellPrice * repSellMult)}cr</span>
                    <span className="text-gray-500">×{listing.quantity}</span>
                    {cargoItem && <span className="text-cyan-400">Have {cargoItem.quantity}</span>}
                  </div>
                </div>
                <span className="text-gray-600 text-[10px] shrink-0">{good.weight}t</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transaction panel */}
      {selected && selectedListing && selectedGood && (
        <div className="border-t border-cyan-900/50 bg-black/70 p-3 space-y-2.5">
          {/* Buy/Sell tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('buy'); setQty(1); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                mode === 'buy' ? 'bg-cyan-700 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'
              }`}
            >BUY</button>
            <button
              onClick={() => { setMode('sell'); setQty(1); }}
              disabled={!selectedCargoItem}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                mode === 'sell' ? 'bg-green-700 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700 disabled:opacity-30'
              }`}
            >SELL</button>
          </div>

          {/* Best-sell hint (shown when buying) */}
          {mode === 'buy' && bestSell && bestSell.sellPrice > effectiveBuyPrice && (
            <div className="flex items-center gap-1.5 text-xs bg-green-950/40 border border-green-900/40 rounded-lg px-2.5 py-1.5">
              <span>💡</span>
              <span className="text-green-400">
                Best sell: <span className="font-bold">{bestSell.planetName}</span> at {bestSell.sellPrice}cr
                <span className="text-green-500 ml-1">(+{bestSell.sellPrice - effectiveBuyPrice}cr/unit)</span>
              </span>
            </div>
          )}

          {/* Rep discount notice */}
          {hasRepBonus && mode === 'buy' && (
            <div className="text-[10px] text-purple-400 font-mono text-right">
              ⭐ Rep discount applied ({Math.round((1 - repBuyMult) * 100)}% off)
            </div>
          )}

          {/* Quantity control */}
          <div className="flex items-center gap-2">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-10 h-10 bg-gray-800 rounded-lg text-white text-xl font-bold active:bg-gray-700 flex items-center justify-center">−</button>
            <div className="flex-1 text-center">
              <input
                type="number" value={qty} min={1} max={maxQty}
                onChange={e => setQty(Math.max(1, Math.min(parseInt(e.target.value) || 1, maxQty)))}
                className="w-full text-center bg-gray-900 text-white border border-gray-700 rounded-lg py-2 text-lg font-mono"
              />
            </div>
            <button onClick={() => setQty(q => Math.min(q + 1, maxQty))}
              className="w-10 h-10 bg-gray-800 rounded-lg text-white text-xl font-bold active:bg-gray-700 flex items-center justify-center">+</button>
            <button onClick={() => setQty(maxQty)}
              className="px-3 h-10 bg-gray-800 rounded-lg text-gray-400 text-xs font-mono active:bg-gray-700">MAX</button>
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
                <span className={`font-bold ${profitOnSell >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {profitOnSell >= 0 ? '+' : ''}{profitOnSell.toLocaleString()} profit
                </span>
              </>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={maxQty === 0}
            className={`w-full py-3 rounded-xl font-bold text-base transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              mode === 'buy'
                ? 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white'
                : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white'
            }`}
          >
            {mode === 'buy'
              ? `Buy ${safeQty}× ${selectedGood.icon} ${selectedGood.name}`
              : `Sell ${safeQty}× ${selectedGood.icon} ${selectedGood.name}`
            }
          </button>
        </div>
      )}
    </div>
  );
}

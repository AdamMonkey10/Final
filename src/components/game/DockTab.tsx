import { useGame } from '@/contexts/GameContext';
import { getShipEffectiveStats, getUpgradeCost } from '@/lib/game-engine';
import { SHIP_TEMPLATES, UPGRADE_COSTS, UPGRADE_LABELS } from '@/data/game-data';

const UPGRADE_ICONS: Record<string, string> = {
  cargo: '📦',
  engine: '🚀',
  shields: '🛡️',
  weapons: '🔫',
};

const UPGRADE_DESC: Record<string, string> = {
  cargo: '+8 cargo units per level',
  engine: '+2 speed per level',
  shields: '+15 max shields per level',
  weapons: '+10 weapon power per level',
};

type UpgradeKey = 'cargo' | 'engine' | 'shields' | 'weapons';

export function DockTab() {
  const { state, upgradeShip, buyShip, repairHull } = useGame();
  const { player } = state;
  const { ship } = player;
  const effective = getShipEffectiveStats(ship);

  const upgradeKeys: UpgradeKey[] = ['cargo', 'engine', 'shields', 'weapons'];

  return (
    <div className="flex flex-col gap-0 overflow-y-auto h-full">
      {/* Current ship status */}
      <div className="px-4 py-3 bg-blue-950/20 border-b border-cyan-900/40">
        <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">Active Ship</div>
        <div className="flex items-center gap-3">
          <div className="text-3xl">{SHIP_TEMPLATES[ship.class]?.icon}</div>
          <div className="flex-1">
            <div className="text-white font-bold">{SHIP_TEMPLATES[ship.class]?.name}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-xs font-mono text-gray-400">
              <span>Cargo: <span className="text-white">{effective.cargoCapacity}</span></span>
              <span>Speed: <span className="text-white">{effective.speed}</span></span>
              <span>Shields: <span className="text-cyan-300">{ship.shields}/{effective.maxShields}</span></span>
              <span>Weapons: <span className="text-red-400">{effective.weaponPower}</span></span>
              <span>Hull: <span className={ship.hull < ship.maxHull * 0.4 ? 'text-red-400' : 'text-green-400'}>{ship.hull}/{ship.maxHull}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrades */}
      <div className="px-4 py-3 border-b border-cyan-900/40">
        <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">Ship Upgrades</div>
        <div className="space-y-2">
          {upgradeKeys.map(key => {
            const level = ship.upgrades[key];
            const maxLevel = UPGRADE_COSTS[key]?.length ?? 3;
            const cost = getUpgradeCost(key, level);
            const canAfford = cost !== null && player.credits >= cost;
            const isMaxed = level >= maxLevel;

            return (
              <div
                key={key}
                className="flex items-center gap-3 px-3 py-2.5 bg-gray-900/60 rounded-xl border border-gray-800"
              >
                <div className="text-xl w-8 text-center">{UPGRADE_ICONS[key]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{UPGRADE_LABELS[key]}</span>
                    <div className="flex gap-1">
                      {Array.from({ length: maxLevel }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full border ${
                            i < level ? 'bg-cyan-400 border-cyan-400' : 'bg-gray-800 border-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{UPGRADE_DESC[key]}</div>
                </div>
                {isMaxed ? (
                  <span className="text-xs text-cyan-600 font-mono font-bold px-2">MAX</span>
                ) : (
                  <button
                    onClick={() => upgradeShip(key)}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold min-w-[70px] text-center transition-colors ${
                      canAfford
                        ? 'bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 text-white'
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {cost?.toLocaleString()}cr
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hull repair */}
      {ship.hull < ship.maxHull && (() => {
        const repairCost = Math.round((ship.maxHull - ship.hull) * 5);
        const canRepair = player.credits >= repairCost;
        return (
          <div className="px-4 py-3 border-b border-cyan-900/40">
            <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">Repair Bay</div>
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-900/60 rounded-xl border border-gray-800">
              <span className="text-xl">🔧</span>
              <div className="flex-1">
                <div className="text-sm text-white">Repair Hull ({ship.hull}/{ship.maxHull})</div>
                <div className="text-xs text-gray-500">Restore full hull integrity</div>
              </div>
              <button
                onClick={repairHull}
                disabled={!canRepair}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  canRepair
                    ? 'bg-green-700 hover:bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {repairCost}cr
              </button>
            </div>
          </div>
        );
      })()}

      {/* Buy ships */}
      <div className="px-4 py-3">
        <div className="text-xs text-cyan-500 font-mono uppercase tracking-wider mb-2">Shipyard</div>
        <div className="space-y-2">
          {Object.values(SHIP_TEMPLATES).filter(t => t.class !== ship.class).map(template => {
            const canAfford = player.credits >= template.price;
            return (
              <div
                key={template.class}
                className="flex items-start gap-3 px-3 py-3 bg-gray-900/60 rounded-xl border border-gray-800"
              >
                <div className="text-2xl pt-0.5">{template.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{template.name}</span>
                    <span className={`text-sm font-mono font-bold ${canAfford ? 'text-yellow-400' : 'text-gray-600'}`}>
                      {template.price.toLocaleString()}cr
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 mb-1.5">{template.description}</div>
                  <div className="grid grid-cols-4 gap-1 text-xs font-mono text-gray-400">
                    <span>📦 {template.cargoCapacity}</span>
                    <span>🚀 {template.speed}</span>
                    <span>🛡 {template.maxShields}</span>
                    <span>🔫 {template.weaponPower}</span>
                  </div>
                </div>
                <button
                  onClick={() => buyShip(template.class)}
                  disabled={!canAfford}
                  className={`px-3 py-2 rounded-lg text-xs font-bold min-w-[60px] self-center transition-colors ${
                    canAfford
                      ? 'bg-yellow-700 hover:bg-yellow-600 active:bg-yellow-800 text-white'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  BUY
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

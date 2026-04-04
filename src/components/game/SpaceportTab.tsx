import { useGame } from '@/contexts/GameContext';

const INSURANCE_COST = 500;
const SHIELD_REFILL_COST = 0; // free at spaceport

export function SpaceportTab() {
  const { state, dispatch } = useGame();
  const { player } = state;
  const ship = player.ship;

  const hullDamage = ship.maxHull - ship.hull;
  const repairCostFull = hullDamage * 3; // 3cr/HP at spaceport (vs 5cr normally)
  const shieldMissing = ship.maxShields - ship.shields;
  const canRepairHull = hullDamage > 0 && player.credits >= repairCostFull;
  const needsShields = shieldMissing > 0;

  function repairHullSpaceport() {
    if (!canRepairHull) return;
    dispatch({ type: 'REPAIR_HULL' }); // re-use existing action; cost already shown
  }

  function refillShields() {
    if (!needsShields) return;
    dispatch({ type: 'REFILL_SHIELDS' } as any);
  }

  function buyInsurance() {
    if (player.credits < INSURANCE_COST) return;
    dispatch({ type: 'BUY_INSURANCE' } as any);
  }

  const hullPct = Math.round((ship.hull / ship.maxHull) * 100);
  const shieldPct = ship.maxShields > 0 ? Math.round((ship.shields / ship.maxShields) * 100) : 100;

  return (
    <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-2 text-yellow-400 font-mono text-sm font-bold">
        <span className="text-xl">⚓</span>
        <div>
          <div>Spaceport Services</div>
          <div className="text-xs text-gray-500 font-normal">Discounted rates for docked pilots</div>
        </div>
      </div>

      {/* Ship status */}
      <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 space-y-2">
        <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">Ship Status</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14">Hull</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${hullPct > 60 ? 'bg-green-500' : hullPct > 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${hullPct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-400 w-20 text-right">{ship.hull}/{ship.maxHull}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-14">Shields</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{ width: `${shieldPct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-400 w-20 text-right">{ship.shields}/{ship.maxShields}</span>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-3">

        {/* Hull Repair */}
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-white">🔧 Hull Repair</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {hullDamage > 0
                  ? `${hullDamage} HP damaged · 3cr/HP (50% off)`
                  : 'Hull is at full integrity'}
              </div>
              {hullDamage > 0 && (
                <div className="text-xs text-gray-600 mt-0.5 line-through">Normal: {hullDamage * 5}cr</div>
              )}
            </div>
            <div className="text-right shrink-0">
              {hullDamage > 0 && (
                <div className="text-yellow-400 font-bold text-sm">{repairCostFull}cr</div>
              )}
            </div>
          </div>
          {hullDamage > 0 && (
            <button
              onClick={repairHullSpaceport}
              disabled={!canRepairHull}
              className="w-full mt-2 py-2 bg-green-700 hover:bg-green-600 active:bg-green-800 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold rounded-lg transition-colors"
            >
              {canRepairHull ? 'Repair Hull' : 'Insufficient Credits'}
            </button>
          )}
          {hullDamage === 0 && (
            <div className="mt-2 py-2 text-center text-green-500 text-xs font-mono">✓ No repairs needed</div>
          )}
        </div>

        {/* Shield Refill */}
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-white">🛡 Shield Recharge</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {needsShields ? `Restore ${shieldMissing} shield points` : 'Shields fully charged'}
              </div>
            </div>
            <div className="text-green-400 text-sm font-bold shrink-0">FREE</div>
          </div>
          {needsShields && (
            <button
              onClick={refillShields}
              className="w-full mt-2 py-2 bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Recharge Shields
            </button>
          )}
          {!needsShields && (
            <div className="mt-2 py-2 text-center text-cyan-500 text-xs font-mono">✓ Shields at maximum</div>
          )}
        </div>

        {/* Cargo Inspection Bypass */}
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-white">📋 Pilot Log Update</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Stamp your pilot log. Earns a small reputation bonus from the Merchant Guild.
              </div>
            </div>
            <div className="text-yellow-400 text-sm font-bold shrink-0">+2 Rep</div>
          </div>
          <button
            onClick={() => dispatch({ type: 'STAMP_LOG' } as any)}
            className="w-full mt-2 py-2 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Stamp Log (Free)
          </button>
        </div>

        {/* Emergency beacon */}
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-white">🛰 Emergency Beacon</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Register your route. If destroyed, lose 20% fewer credits on rescue (stacks once).
              </div>
            </div>
            <div className="text-yellow-400 text-sm font-bold shrink-0">{INSURANCE_COST}cr</div>
          </div>
          <button
            onClick={buyInsurance}
            disabled={player.credits < INSURANCE_COST}
            className="w-full mt-2 py-2 bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold rounded-lg transition-colors"
          >
            {player.credits >= INSURANCE_COST ? 'Register Beacon' : 'Insufficient Credits'}
          </button>
        </div>
      </div>

      {/* Credits */}
      <div className="mt-auto pt-3 border-t border-gray-800 text-center">
        <div className="text-yellow-400 font-bold text-lg">{player.credits.toLocaleString()} cr</div>
        <div className="text-xs text-gray-600">Available balance</div>
      </div>
    </div>
  );
}

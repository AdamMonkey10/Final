import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { GameState, GoodType, CombatEnemy, Mission, SolarSystem, GoodEncounter } from '@/types/game';
import {
  createNewGame, initializePlanets, generateMarket, generateMissions, getSolarSystems,
  rollEncounter, rollGoodEncounter, resolveCombatRound, getCargoUsed, getShipEffectiveStats,
  getUpgradeCost, getTravelDistance, getTravelDuration, isSameSystem,
  makeNotification, generateBountyEnemy, exploreLocation,
  getTravelFuelCost, getRepPriceMultiplier, getRepSellMultiplier,
  generateMarketEvents,
} from '@/lib/game-engine';
import { GOODS, SHIP_TEMPLATES, UPGRADE_COSTS, SPACEPORT_LOCATIONS } from '@/data/game-data';

const SAVE_KEY = 'space_rpg_save_v2';
const MARKET_REFRESH_DAYS = 3;

// ── Initial state ─────────────────────────────────────────────────────────────

function getInitialState(): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GameState;
      if (parsed.initialized && parsed.systems) return parsed;
    }
  } catch { /* ignore */ }

  const { player, planets, systems } = createNewGame();
  return {
    player, planets, systems,
    screen: 'planet', travelProgress: 0, travelDuration: 3000,
    combat: undefined, combatLog: [],
    notifications: [makeNotification('Welcome, pilot. Good luck out there!', 'info')],
    gameDay: 1, marketLastRefresh: 1, initialized: true,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'NEW_GAME' }
  | { type: 'SET_SCREEN'; screen: GameState['screen'] }
  | { type: 'START_TRAVEL'; destinationId: string; duration: number; fuelCost: number }
  | { type: 'UPDATE_TRAVEL'; progress: number }
  | { type: 'ARRIVE_AT_PLANET'; encounteredEnemy?: CombatEnemy; goodEncounter?: GoodEncounter }
  | { type: 'COMBAT_ATTACK' }
  | { type: 'FLEE_COMBAT' }
  | { type: 'END_COMBAT_WIN' }
  | { type: 'END_COMBAT_LOSS' }
  | { type: 'BUY_GOOD'; good: GoodType; quantity: number }
  | { type: 'SELL_GOOD'; good: GoodType; quantity: number }
  | { type: 'UPGRADE_SHIP'; component: 'cargo' | 'engine' | 'shields' | 'weapons' }
  | { type: 'BUY_SHIP'; shipClass: string }
  | { type: 'REPAIR_HULL' }
  | { type: 'ACCEPT_MISSION'; mission: Mission }
  | { type: 'DISMISS_NOTIFICATION'; id: string }
  | { type: 'REFILL_SHIELDS' }
  | { type: 'STAMP_LOG' }
  | { type: 'BUY_INSURANCE' }
  | { type: 'EXPLORE_LOCATION'; locationId: string };

function notify(state: GameState, message: string, type: GameState['notifications'][0]['type']): GameState {
  return { ...state, notifications: [...state.notifications.slice(-4), makeNotification(message, type)] };
}

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {

    case 'NEW_GAME': {
      const { player, planets, systems } = createNewGame();
      return {
        player, planets, systems,
        screen: 'planet', travelProgress: 0, travelDuration: 3000,
        combat: undefined, combatLog: [],
        notifications: [makeNotification('New game started. Good luck, pilot!', 'info')],
        gameDay: 1, marketLastRefresh: 1, initialized: true,
      };
    }

    case 'SET_SCREEN':
      return { ...state, screen: action.screen };

    case 'START_TRAVEL': {
      const fuelCost = action.fuelCost ?? 0;
      if (state.player.credits < fuelCost) {
        return notify(state, `Not enough credits for fuel (${fuelCost}cr needed).`, 'warning');
      }
      const newState = fuelCost > 0
        ? notify({ ...state, player: { ...state.player, credits: state.player.credits - fuelCost } },
            `Fuel: -${fuelCost}cr`, 'info')
        : state;
      return {
        ...newState, screen: 'travel',
        travelDestinationId: action.destinationId,
        travelProgress: 0, travelDuration: action.duration,
      };
    }

    case 'UPDATE_TRAVEL':
      return { ...state, travelProgress: action.progress };

    case 'ARRIVE_AT_PLANET': {
      const destId = state.travelDestinationId!;
      const destPlanet = state.planets.find(p => p.id === destId)!;
      const newDay = state.gameDay + 1;
      const visited = state.player.visitedPlanets.includes(destId)
        ? state.player.visitedPlanets
        : [...state.player.visitedPlanets, destId];

      // Expire old missions
      const expiredIds = state.player.missions
        .filter(m => !m.isActive && !m.isComplete && !m.isFailed && m.expiresOnDay < newDay)
        .map(m => m.id);

      // Complete active missions at this planet
      let missionReward = 0;
      let repGain = 0;
      const missionMsgs: string[] = [];

      const updatedMissions = state.player.missions
        .filter(m => !expiredIds.includes(m.id))
        .map(m => {
          if (m.isActive && !m.isComplete && m.targetPlanetId === destId) {
            missionReward += m.reward;
            repGain += m.type === 'bounty' ? 10 : m.type === 'smuggle' ? 2 : 5;
            missionMsgs.push(`✓ ${m.title}: +${m.reward}cr`);
            return { ...m, isComplete: true };
          }
          return m;
        });

      // Refresh market?
      let planets = state.planets;
      let marketLastRefresh = state.marketLastRefresh;
      if (newDay - state.marketLastRefresh >= MARKET_REFRESH_DAYS) {
        planets = initializePlanets(newDay);
        marketLastRefresh = newDay;
      }

      // New missions for this planet
      const existingActive = updatedMissions.filter(m => m.isActive && !m.isComplete);
      const newMissions = generateMissions(destId, planets, state.systems, newDay, state.player.reputation);

      // Apply good encounter effects
      const ge = action.goodEncounter;
      let geCredits = ge?.creditBonus ?? 0;
      let geRep = ge?.reputationBonus ?? 0;
      let geShieldRestore = ge?.shieldRestore ?? 0;
      let geCargo = ge?.cargoReward;

      // Add cargo from derelict if there's room
      let shipAfterGE = { ...state.player.ship };
      if (geCargo) {
        const effective = getShipEffectiveStats(shipAfterGE);
        const cargoFree = effective.cargoCapacity - getCargoUsed(shipAfterGE);
        const canTake = Math.min(geCargo.quantity, Math.floor(cargoFree));
        if (canTake > 0) {
          const existing = shipAfterGE.cargo.findIndex(c => c.good === geCargo!.good);
          const newCargo = [...shipAfterGE.cargo];
          if (existing >= 0) {
            newCargo[existing] = { ...newCargo[existing], quantity: newCargo[existing].quantity + canTake };
          } else {
            newCargo.push({ good: geCargo.good, quantity: canTake, avgPurchasePrice: 0 });
          }
          shipAfterGE = { ...shipAfterGE, cargo: newCargo };
        } else {
          geCredits += 100; // compensate with credits if no room
        }
      }
      if (geShieldRestore > 0) {
        shipAfterGE = { ...shipAfterGE, shields: shipAfterGE.maxShields };
      }

      let newState: GameState = {
        ...state,
        screen: action.encounteredEnemy ? 'combat' : 'planet',
        combat: action.encounteredEnemy,
        combatLog: action.encounteredEnemy ? [`⚠ ${action.encounteredEnemy.name} intercepts you!`] : [],
        travelProgress: 0, planets, marketLastRefresh,
        gameDay: newDay,
        player: {
          ...state.player,
          currentPlanetId: destId,
          visitedPlanets: visited,
          tripsCompleted: state.player.tripsCompleted + 1,
          credits: state.player.credits + missionReward + geCredits,
          reputation: state.player.reputation + repGain + geRep,
          ship: shipAfterGE,
          missions: [...existingActive, ...updatedMissions.filter(m => m.isComplete), ...newMissions],
        },
      };

      if (!action.encounteredEnemy) {
        newState = notify(newState, `Arrived at ${destPlanet.name}.`, 'info');
      }
      missionMsgs.forEach(msg => { newState = notify(newState, msg, 'success'); });
      if (ge) {
        const detail = ge.creditBonus ? ` +${ge.creditBonus}cr` : ge.shieldRestore ? ' Shields restored!' : ge.cargoReward ? ` +${ge.cargoReward.quantity} cargo` : '';
        newState = notify(newState, `${ge.title}${detail}`, 'success');
      }
      if (expiredIds.length > 0) {
        newState = notify(newState, `${expiredIds.length} mission(s) expired.`, 'warning');
      }
      return newState;
    }

    case 'COMBAT_ATTACK': {
      if (!state.combat) return state;
      const enemy = state.combat;
      const result = resolveCombatRound(state.player.ship, enemy);

      const newEnemy = {
        ...enemy,
        shields: Math.max(0, enemy.shields - result.enemyShieldDamage),
        hull: Math.max(0, enemy.hull - result.enemyDamage),
      };
      const newShip = {
        ...state.player.ship,
        shields: Math.max(0, state.player.ship.shields - result.playerShieldDamage),
        hull: Math.max(0, state.player.ship.hull - result.playerDamage),
      };

      let newState: GameState = {
        ...state,
        combat: newEnemy,
        combatLog: [...state.combatLog, ...result.log].slice(-8),
        player: { ...state.player, ship: newShip },
      };

      if (newEnemy.hull <= 0) return gameReducer(newState, { type: 'END_COMBAT_WIN' });
      if (newShip.hull <= 0) return gameReducer(newState, { type: 'END_COMBAT_LOSS' });
      return newState;
    }

    case 'FLEE_COMBAT': {
      if (!state.combat?.isEscapable) return state;
      return notify({ ...state, screen: 'planet', combat: undefined, combatLog: [] },
        'You escaped!', 'warning');
    }

    case 'END_COMBAT_WIN': {
      const reward = state.combat?.creditReward ?? 0;
      const name = state.combat?.name ?? 'enemy';
      const isBounty = state.combat?.isBountyTarget;

      // Complete bounty missions if this was a bounty target
      let bonusReward = 0;
      const updatedMissions = state.player.missions.map(m => {
        if (isBounty && m.type === 'bounty' && m.isActive && !m.isComplete && m.targetPlanetId === state.player.currentPlanetId) {
          bonusReward += m.reward;
          return { ...m, isComplete: true };
        }
        return m;
      });

      let newState: GameState = {
        ...state,
        screen: 'planet', combat: undefined, combatLog: [],
        player: {
          ...state.player,
          credits: state.player.credits + reward + bonusReward,
          totalProfit: state.player.totalProfit + reward,
          reputation: state.player.reputation + (isBounty ? 10 : 5),
          missions: updatedMissions,
        },
      };
      newState = notify(newState, `${name} destroyed! +${reward}cr`, 'success');
      if (bonusReward > 0) newState = notify(newState, `Bounty claimed! +${bonusReward}cr`, 'success');
      return newState;
    }

    case 'END_COMBAT_LOSS': {
      const lost = Math.floor(state.player.credits * 0.3);
      return notify({
        ...state,
        screen: 'planet', combat: undefined, combatLog: [],
        player: {
          ...state.player,
          credits: Math.max(50, state.player.credits - lost),
          ship: { ...state.player.ship, hull: Math.round(state.player.ship.maxHull * 0.2), shields: 0 },
        },
      }, `Destroyed! Lost ${lost}cr. Emergency rescue deployed.`, 'danger');
    }

    case 'BUY_GOOD': {
      const { good, quantity } = action;
      const planet = state.planets.find(p => p.id === state.player.currentPlanetId)!;
      const listing = planet.market.find(m => m.good === good)!;
      const goodData = GOODS[good];
      // Apply reputation buy discount
      const repMult = getRepPriceMultiplier(state.player.reputation);
      const discountedPrice = Math.round(listing.buyPrice * repMult);
      const totalCost = discountedPrice * quantity;
      const effective = getShipEffectiveStats(state.player.ship);
      const cargoFree = effective.cargoCapacity - getCargoUsed(state.player.ship);

      if (state.player.credits < totalCost) return state;
      if (goodData.weight * quantity > cargoFree) return state;

      const existingIdx = state.player.ship.cargo.findIndex(c => c.good === good);
      let newCargo = [...state.player.ship.cargo];
      if (existingIdx >= 0) {
        const e = newCargo[existingIdx];
        const totalQty = e.quantity + quantity;
        newCargo[existingIdx] = { ...e, quantity: totalQty, avgPurchasePrice: Math.round((e.avgPurchasePrice * e.quantity + discountedPrice * quantity) / totalQty) };
      } else {
        newCargo.push({ good, quantity, avgPurchasePrice: discountedPrice });
      }

      return {
        ...state,
        planets: state.planets.map(p => p.id !== state.player.currentPlanetId ? p : {
          ...p, market: p.market.map(m => m.good === good ? { ...m, quantity: m.quantity - quantity } : m),
        }),
        player: { ...state.player, credits: state.player.credits - totalCost, ship: { ...state.player.ship, cargo: newCargo } },
      };
    }

    case 'SELL_GOOD': {
      const { good, quantity } = action;
      const planet = state.planets.find(p => p.id === state.player.currentPlanetId)!;
      const listing = planet.market.find(m => m.good === good)!;
      const repSellMult = getRepSellMultiplier(state.player.reputation);
      const boostedSellPrice = Math.round(listing.sellPrice * repSellMult);
      const totalRevenue = boostedSellPrice * quantity;
      const existingIdx = state.player.ship.cargo.findIndex(c => c.good === good);
      if (existingIdx < 0) return state;

      const existing = state.player.ship.cargo[existingIdx];
      const profit = totalRevenue - existing.avgPurchasePrice * quantity;
      let newCargo = [...state.player.ship.cargo];
      if (existing.quantity === quantity) { newCargo.splice(existingIdx, 1); }
      else { newCargo[existingIdx] = { ...existing, quantity: existing.quantity - quantity }; }

      const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
      return notify({
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits + totalRevenue,
          totalProfit: state.player.totalProfit + profit,
          ship: { ...state.player.ship, cargo: newCargo },
        },
      }, `Sold ${quantity}x ${GOODS[good].name} · ${profitStr}cr profit`, profit >= 0 ? 'success' : 'warning');
    }

    case 'UPGRADE_SHIP': {
      const { component } = action;
      const currentLevel = state.player.ship.upgrades[component];
      const cost = getUpgradeCost(component, currentLevel);
      if (cost === null || state.player.credits < cost) return state;

      const newUpgrades = { ...state.player.ship.upgrades, [component]: currentLevel + 1 };
      let newShip = { ...state.player.ship, upgrades: newUpgrades };
      if (component === 'shields') {
        const newMax = state.player.ship.maxShields + 15;
        newShip = { ...newShip, maxShields: newMax, shields: newMax };
      }

      return notify({
        ...state,
        player: { ...state.player, credits: state.player.credits - cost, ship: newShip },
      }, `Upgraded ${component}! (Level ${currentLevel + 1})`, 'success');
    }

    case 'BUY_SHIP': {
      const template = SHIP_TEMPLATES[action.shipClass];
      if (!template || state.player.credits < template.price) return state;
      return notify({
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - template.price,
          ship: {
            class: template.class, cargoCapacity: template.cargoCapacity, speed: template.speed,
            shields: template.maxShields, maxShields: template.maxShields,
            hull: template.maxHull, maxHull: template.maxHull, weaponPower: template.weaponPower,
            upgrades: { cargo: 0, engine: 0, shields: 0, weapons: 0 },
            cargo: state.player.ship.cargo,
          },
        },
      }, `Purchased ${template.name}!`, 'success');
    }

    case 'REPAIR_HULL': {
      const damage = state.player.ship.maxHull - state.player.ship.hull;
      if (damage <= 0) return state;
      const currentPlanet = state.planets.find(p => p.id === state.player.currentPlanetId);
      const ratePerHp = currentPlanet?.isSpaceport ? 3 : 5;
      const cost = damage * ratePerHp;
      if (state.player.credits < cost) return state;
      return notify({
        ...state,
        player: { ...state.player, credits: state.player.credits - cost, ship: { ...state.player.ship, hull: state.player.ship.maxHull } },
      }, `Hull repaired for ${cost}cr${currentPlanet?.isSpaceport ? ' (spaceport rate)' : ''}`, 'success');
    }

    case 'ACCEPT_MISSION': {
      const mission = { ...action.mission, isActive: true };
      return {
        ...state,
        player: {
          ...state.player,
          missions: [...state.player.missions.filter(m => m.id !== mission.id), mission],
        },
      };
    }

    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) };

    case 'REFILL_SHIELDS':
      return notify({
        ...state,
        player: { ...state.player, ship: { ...state.player.ship, shields: state.player.ship.maxShields } },
      }, 'Shields fully recharged — free of charge!', 'success');

    case 'STAMP_LOG':
      return notify({
        ...state,
        player: { ...state.player, reputation: state.player.reputation + 2 },
      }, 'Pilot log stamped. +2 reputation with the Merchant Guild.', 'success');

    case 'BUY_INSURANCE': {
      const cost = 500;
      if (state.player.credits < cost) return state;
      return notify({
        ...state,
        player: { ...state.player, credits: state.player.credits - cost },
      }, 'Emergency beacon registered. Rescue penalty reduced by 20%.', 'info');
    }

    case 'EXPLORE_LOCATION': {
      const { locationId } = action;
      // Find location definition across all spaceports
      const allLocs = Object.values(SPACEPORT_LOCATIONS).flat();
      const loc = allLocs.find(l => l.id === locationId);
      if (!loc) return state;

      // Mark as explored this day
      const exploredLocations = { ...state.player.exploredLocations, [locationId]: state.gameDay };

      const { result, mission } = exploreLocation(
        locationId,
        loc.type,
        state.player.currentPlanetId,
        state.planets,
        state.systems,
        state.gameDay,
        state.player.reputation,
      );

      // Apply cargo reward
      let ship = { ...state.player.ship };
      if (result.cargoReward) {
        const effective = getShipEffectiveStats(ship);
        const free = effective.cargoCapacity - getCargoUsed(ship);
        const canTake = Math.min(result.cargoReward.quantity, Math.floor(free));
        if (canTake > 0) {
          const idx = ship.cargo.findIndex(c => c.good === result.cargoReward!.good);
          const newCargo = [...ship.cargo];
          if (idx >= 0) {
            newCargo[idx] = { ...newCargo[idx], quantity: newCargo[idx].quantity + canTake };
          } else {
            newCargo.push({ good: result.cargoReward.good, quantity: canTake, avgPurchasePrice: 0 });
          }
          ship = { ...ship, cargo: newCargo };
        }
      }

      // Apply hull repair
      if (result.hullRepair) {
        ship = { ...ship, hull: Math.min(ship.maxHull, ship.hull + result.hullRepair) };
      }

      const newMissions = mission ? [...state.player.missions, mission] : state.player.missions;

      let newState: GameState = {
        ...state,
        lastLocationResult: result,
        player: {
          ...state.player,
          exploredLocations,
          ship,
          credits: state.player.credits + (result.creditBonus ?? 0),
          reputation: state.player.reputation + (result.reputationBonus ?? 0),
          missions: newMissions,
        },
      };

      // Notification
      if (result.creditBonus) newState = notify(newState, `${loc.name}: +${result.creditBonus}cr`, 'success');
      else if (result.cargoReward) newState = notify(newState, `${loc.name}: +${result.cargoReward.quantity}× ${GOODS[result.cargoReward.good].name}`, 'success');
      else if (result.reputationBonus) newState = notify(newState, `${loc.name}: +${result.reputationBonus} reputation`, 'success');
      else if (result.hullRepair) newState = notify(newState, `${loc.name}: +${result.hullRepair} hull repaired`, 'success');
      else if (result.missionId) newState = notify(newState, `${loc.name}: New mission available!`, 'success');
      return newState;
    }

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  currentPlanet: ReturnType<typeof getCurrentPlanet>;
  travelTo: (planetId: string) => void;
  buyGood: (good: GoodType, quantity: number) => void;
  sellGood: (good: GoodType, quantity: number) => void;
  attackEnemy: () => void;
  fleeFromEnemy: () => void;
  upgradeShip: (component: 'cargo' | 'engine' | 'shields' | 'weapons') => void;
  buyShip: (shipClass: string) => void;
  repairHull: () => void;
  acceptMission: (mission: Mission) => void;
  newGame: () => void;
  dismissNotification: (id: string) => void;
}

function getCurrentPlanet(state: GameState) {
  return state.planets.find(p => p.id === state.player.currentPlanetId) ?? state.planets[0];
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, getInitialState);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  // Travel tick
  useEffect(() => {
    if (state.screen !== 'travel') return;
    const startTime = Date.now();
    const duration = state.travelDuration;

    const interval = setInterval(() => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      dispatch({ type: 'UPDATE_TRAVEL', progress });

      if (progress >= 1) {
        clearInterval(interval);
        const from = state.planets.find(p => p.id === state.player.currentPlanetId)!;
        const to = state.planets.find(p => p.id === state.travelDestinationId)!;
        const dist = getTravelDistance(from, to);
        const crossSystem = !isSameSystem(from, to);

        // Check if there's an active bounty mission targeting this destination
        const bountyMission = state.player.missions.find(
          m => m.type === 'bounty' && m.isActive && !m.isComplete && m.targetPlanetId === to.id
        );

        let enemy = bountyMission
          ? generateBountyEnemy(bountyMission.reward)
          : rollEncounter(dist, state.player, crossSystem);

        // Only roll good encounter if no bad one
        const goodEncounter = !enemy ? rollGoodEncounter(crossSystem) : null;

        dispatch({ type: 'ARRIVE_AT_PLANET', encounteredEnemy: enemy ?? undefined, goodEncounter: goodEncounter ?? undefined });
      }
    }, 50);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, state.travelDestinationId]);

  const travelTo = useCallback((planetId: string) => {
    const from = state.planets.find(p => p.id === state.player.currentPlanetId)!;
    const to = state.planets.find(p => p.id === planetId)!;
    const dist = getTravelDistance(from, to);
    const effective = getShipEffectiveStats(state.player.ship);
    const fuelCost = getTravelFuelCost(dist, state.player.ship.upgrades.engine);
    dispatch({ type: 'START_TRAVEL', destinationId: planetId, duration: getTravelDuration(dist, effective.speed), fuelCost });
  }, [state.planets, state.player]);

  const buyGood = useCallback((good: GoodType, qty: number) => dispatch({ type: 'BUY_GOOD', good, quantity: qty }), []);
  const sellGood = useCallback((good: GoodType, qty: number) => dispatch({ type: 'SELL_GOOD', good, quantity: qty }), []);
  const attackEnemy = useCallback(() => dispatch({ type: 'COMBAT_ATTACK' }), []);
  const fleeFromEnemy = useCallback(() => dispatch({ type: 'FLEE_COMBAT' }), []);
  const upgradeShip = useCallback((c: 'cargo' | 'engine' | 'shields' | 'weapons') => dispatch({ type: 'UPGRADE_SHIP', component: c }), []);
  const buyShip = useCallback((sc: string) => dispatch({ type: 'BUY_SHIP', shipClass: sc }), []);
  const repairHull = useCallback(() => dispatch({ type: 'REPAIR_HULL' }), []);
  const acceptMission = useCallback((m: Mission) => dispatch({ type: 'ACCEPT_MISSION', mission: m }), []);
  const newGame = useCallback(() => dispatch({ type: 'NEW_GAME' }), []);
  const dismissNotification = useCallback((id: string) => dispatch({ type: 'DISMISS_NOTIFICATION', id }), []);

  return (
    <GameContext.Provider value={{
      state, dispatch, currentPlanet: getCurrentPlanet(state),
      travelTo, buyGood, sellGood, attackEnemy, fleeFromEnemy,
      upgradeShip, buyShip, repairHull, acceptMission, newGame, dismissNotification,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

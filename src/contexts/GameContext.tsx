import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { GameState, GoodType, CombatEnemy, Mission } from '@/types/game';
import {
  createNewGame, initializePlanets, generateMarket, generateMissions,
  rollEncounter, resolveCombatRound, getCargoUsed, getShipEffectiveStats,
  getUpgradeCost, getTravelDistance, getTravelDuration, makeNotification,
} from '@/lib/game-engine';
import { GOODS, SHIP_TEMPLATES } from '@/data/game-data';

const SAVE_KEY = 'space_rpg_save';
const MARKET_REFRESH_DAYS = 3;

// ── State ─────────────────────────────────────────────────────────────────────

function getInitialState(): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GameState;
      if (parsed.initialized) return parsed;
    }
  } catch { /* ignore */ }

  const { player, planets } = createNewGame();
  return {
    player,
    planets,
    screen: 'planet',
    travelProgress: 0,
    travelDuration: 3000,
    combat: undefined,
    combatLog: [],
    notifications: [],
    gameDay: 1,
    marketLastRefresh: 1,
    initialized: true,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'NEW_GAME' }
  | { type: 'SET_SCREEN'; screen: GameState['screen'] }
  | { type: 'START_TRAVEL'; destinationId: string; duration: number }
  | { type: 'UPDATE_TRAVEL'; progress: number }
  | { type: 'ARRIVE_AT_PLANET'; encounteredEnemy?: CombatEnemy }
  | { type: 'START_COMBAT'; enemy: CombatEnemy }
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
  | { type: 'REFRESH_MARKET' };

function addNotification(state: GameState, message: string, type: GameState['notifications'][0]['type']): GameState {
  const note = makeNotification(message, type);
  return { ...state, notifications: [...state.notifications.slice(-4), note] };
}

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {

    case 'NEW_GAME': {
      const { player, planets } = createNewGame();
      const fresh: GameState = {
        player, planets,
        screen: 'planet',
        travelProgress: 0,
        travelDuration: 3000,
        combat: undefined,
        combatLog: [],
        notifications: [makeNotification('New game started. Good luck, pilot!', 'info')],
        gameDay: 1,
        marketLastRefresh: 1,
        initialized: true,
      };
      return fresh;
    }

    case 'SET_SCREEN':
      return { ...state, screen: action.screen };

    case 'START_TRAVEL':
      return {
        ...state,
        screen: 'travel',
        travelDestinationId: action.destinationId,
        travelProgress: 0,
        travelDuration: action.duration,
      };

    case 'UPDATE_TRAVEL':
      return { ...state, travelProgress: action.progress };

    case 'ARRIVE_AT_PLANET': {
      const destId = state.travelDestinationId!;
      const destPlanet = state.planets.find(p => p.id === destId)!;
      const newDay = state.gameDay + 1;
      const visited = state.player.visitedPlanets.includes(destId)
        ? state.player.visitedPlanets
        : [...state.player.visitedPlanets, destId];

      // Check completed missions
      const completedMissions = state.player.missions.filter(
        m => m.isActive && !m.isComplete && m.targetPlanetId === destId,
      );
      let missionReward = 0;
      let missionMsg = '';
      const updatedMissions = state.player.missions.map(m => {
        if (m.isActive && !m.isComplete && m.targetPlanetId === destId) {
          missionReward += m.reward;
          missionMsg = `Mission complete: ${m.title} (+${m.reward}cr)`;
          return { ...m, isComplete: true };
        }
        return m;
      });

      // Refresh market if needed
      let planets = state.planets;
      if (newDay - state.marketLastRefresh >= MARKET_REFRESH_DAYS) {
        planets = initializePlanets(newDay);
      }

      // Generate missions for new planet
      const newMissions = generateMissions(destId, planets);

      let newState: GameState = {
        ...state,
        screen: action.encounteredEnemy ? 'combat' : 'planet',
        combat: action.encounteredEnemy,
        combatLog: action.encounteredEnemy ? [`A ${action.encounteredEnemy.name} intercepts you!`] : [],
        travelProgress: 0,
        planets,
        gameDay: newDay,
        marketLastRefresh: newDay - state.marketLastRefresh >= MARKET_REFRESH_DAYS ? newDay : state.marketLastRefresh,
        player: {
          ...state.player,
          currentPlanetId: destId,
          visitedPlanets: visited,
          tripsCompleted: state.player.tripsCompleted + 1,
          credits: state.player.credits + missionReward,
          missions: [
            ...updatedMissions.filter(m => !m.isComplete),
            ...newMissions,
          ],
        },
      };

      if (!action.encounteredEnemy) {
        newState = addNotification(newState, `Arrived at ${destPlanet.name}.`, 'info');
      }
      if (missionMsg) {
        newState = addNotification(newState, missionMsg, 'success');
      }

      return newState;
    }

    case 'START_COMBAT':
      return {
        ...state,
        screen: 'combat',
        combat: action.enemy,
        combatLog: [`⚠ ${action.enemy.name} attacks!`],
      };

    case 'COMBAT_ATTACK': {
      if (!state.combat) return state;
      const enemy = state.combat;
      const result = resolveCombatRound(state.player.ship, enemy);

      let newEnemyShields = Math.max(0, enemy.shields - result.enemyShieldDamage);
      let newEnemyHull = Math.max(0, enemy.hull - result.enemyDamage);
      let newPlayerShields = Math.max(0, state.player.ship.shields - result.playerShieldDamage);
      let newPlayerHull = Math.max(0, state.player.ship.hull - result.playerDamage);

      const newEnemy = { ...enemy, shields: newEnemyShields, hull: newEnemyHull };
      const newShip = { ...state.player.ship, shields: newPlayerShields, hull: newPlayerHull };

      let newState: GameState = {
        ...state,
        combat: newEnemy,
        combatLog: [...state.combatLog, ...result.log].slice(-8),
        player: { ...state.player, ship: newShip },
      };

      if (newEnemyHull <= 0) {
        return gameReducer(newState, { type: 'END_COMBAT_WIN' });
      }
      if (newPlayerHull <= 0) {
        return gameReducer(newState, { type: 'END_COMBAT_LOSS' });
      }
      return newState;
    }

    case 'FLEE_COMBAT': {
      if (!state.combat?.isEscapable) return state;
      let newState: GameState = {
        ...state,
        screen: 'planet',
        combat: undefined,
        combatLog: [],
      };
      newState = addNotification(newState, 'You managed to escape!', 'warning');
      return newState;
    }

    case 'END_COMBAT_WIN': {
      const reward = state.combat?.creditReward ?? 0;
      const name = state.combat?.name ?? 'enemy';
      let newState: GameState = {
        ...state,
        screen: 'planet',
        combat: undefined,
        combatLog: [],
        player: {
          ...state.player,
          credits: state.player.credits + reward,
          totalProfit: state.player.totalProfit + reward,
          reputation: state.player.reputation + 5,
        },
      };
      newState = addNotification(newState, `${name} destroyed! +${reward} credits`, 'success');
      return newState;
    }

    case 'END_COMBAT_LOSS': {
      // Lose some credits but not game-ending
      const lost = Math.floor(state.player.credits * 0.3);
      let newState: GameState = {
        ...state,
        screen: 'planet',
        combat: undefined,
        combatLog: [],
        player: {
          ...state.player,
          credits: Math.max(50, state.player.credits - lost),
          ship: {
            ...state.player.ship,
            hull: Math.round(state.player.ship.maxHull * 0.2),
            shields: 0,
          },
        },
      };
      newState = addNotification(newState, `Ship destroyed! Lost ${lost} credits. Emergency rescue deployed.`, 'danger');
      return newState;
    }

    case 'BUY_GOOD': {
      const { good, quantity } = action;
      const planet = state.planets.find(p => p.id === state.player.currentPlanetId)!;
      const listing = planet.market.find(m => m.good === good)!;
      const goodData = GOODS[good];
      const totalCost = listing.buyPrice * quantity;
      const cargoWeight = goodData.weight * quantity;
      const effective = getShipEffectiveStats(state.player.ship);
      const currentUsed = getCargoUsed(state.player.ship);

      if (state.player.credits < totalCost) return state;
      if (currentUsed + cargoWeight > effective.cargoCapacity) return state;

      const existingIdx = state.player.ship.cargo.findIndex(c => c.good === good);
      let newCargo = [...state.player.ship.cargo];

      if (existingIdx >= 0) {
        const existing = newCargo[existingIdx];
        const totalQty = existing.quantity + quantity;
        const avgPrice = Math.round((existing.avgPurchasePrice * existing.quantity + listing.buyPrice * quantity) / totalQty);
        newCargo[existingIdx] = { ...existing, quantity: totalQty, avgPurchasePrice: avgPrice };
      } else {
        newCargo.push({ good, quantity, avgPurchasePrice: listing.buyPrice });
      }

      // Update market quantity
      const updatedPlanets = state.planets.map(p => {
        if (p.id !== state.player.currentPlanetId) return p;
        return {
          ...p,
          market: p.market.map(m => m.good === good ? { ...m, quantity: m.quantity - quantity } : m),
        };
      });

      return {
        ...state,
        planets: updatedPlanets,
        player: {
          ...state.player,
          credits: state.player.credits - totalCost,
          ship: { ...state.player.ship, cargo: newCargo },
        },
      };
    }

    case 'SELL_GOOD': {
      const { good, quantity } = action;
      const planet = state.planets.find(p => p.id === state.player.currentPlanetId)!;
      const listing = planet.market.find(m => m.good === good)!;
      const totalRevenue = listing.sellPrice * quantity;

      const existingIdx = state.player.ship.cargo.findIndex(c => c.good === good);
      if (existingIdx < 0) return state;

      const existing = state.player.ship.cargo[existingIdx];
      const profit = totalRevenue - existing.avgPurchasePrice * quantity;
      let newCargo = [...state.player.ship.cargo];

      if (existing.quantity === quantity) {
        newCargo.splice(existingIdx, 1);
      } else {
        newCargo[existingIdx] = { ...existing, quantity: existing.quantity - quantity };
      }

      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits + totalRevenue,
          totalProfit: state.player.totalProfit + profit,
          ship: { ...state.player.ship, cargo: newCargo },
        },
      };

      const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
      newState = addNotification(newState, `Sold ${quantity}x ${GOODS[good].name} for ${totalRevenue}cr (${profitStr} profit)`, profit >= 0 ? 'success' : 'warning');
      return newState;
    }

    case 'UPGRADE_SHIP': {
      const { component } = action;
      const currentLevel = state.player.ship.upgrades[component];
      const cost = getUpgradeCost(component, currentLevel);
      if (cost === null || state.player.credits < cost) return state;

      const newUpgrades = { ...state.player.ship.upgrades, [component]: currentLevel + 1 };
      let newShip = { ...state.player.ship, upgrades: newUpgrades };

      // Apply stat boost immediately
      if (component === 'shields') {
        const newMax = state.player.ship.maxShields + 15;
        newShip = { ...newShip, maxShields: newMax, shields: newMax };
      }

      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - cost,
          ship: newShip,
        },
      };
      newState = addNotification(newState, `Upgraded ${component}! (Level ${currentLevel + 1})`, 'success');
      return newState;
    }

    case 'BUY_SHIP': {
      const template = SHIP_TEMPLATES[action.shipClass];
      if (!template || state.player.credits < template.price) return state;

      const newShip = {
        class: template.class,
        cargoCapacity: template.cargoCapacity,
        speed: template.speed,
        shields: template.maxShields,
        maxShields: template.maxShields,
        hull: template.maxHull,
        maxHull: template.maxHull,
        weaponPower: template.weaponPower,
        upgrades: { cargo: 0, engine: 0, shields: 0, weapons: 0 } as const,
        cargo: state.player.ship.cargo, // Keep cargo
      };

      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - template.price,
          ship: newShip,
        },
      };
      newState = addNotification(newState, `Purchased ${template.name}!`, 'success');
      return newState;
    }

    case 'REPAIR_HULL': {
      const damage = state.player.ship.maxHull - state.player.ship.hull;
      if (damage <= 0) return state;
      const cost = damage * 5;
      if (state.player.credits < cost) return state;
      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - cost,
          ship: { ...state.player.ship, hull: state.player.ship.maxHull },
        },
      };
      newState = addNotification(newState, `Hull repaired for ${cost}cr`, 'success');
      return newState;
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
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.id),
      };

    case 'REFRESH_MARKET': {
      const updatedPlanets = state.planets.map(p => ({
        ...p,
        market: generateMarket(p, state.gameDay),
      }));
      return { ...state, planets: updatedPlanets };
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

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  // Travel tick
  useEffect(() => {
    if (state.screen !== 'travel') return;

    const startTime = Date.now();
    const duration = state.travelDuration;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      dispatch({ type: 'UPDATE_TRAVEL', progress });

      if (progress >= 1) {
        clearInterval(interval);
        const from = state.planets.find(p => p.id === state.player.currentPlanetId)!;
        const to = state.planets.find(p => p.id === state.travelDestinationId)!;
        const dist = getTravelDistance(from, to);
        const enemy = rollEncounter(dist, state.player);
        dispatch({ type: 'ARRIVE_AT_PLANET', encounteredEnemy: enemy ?? undefined });
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
    const duration = getTravelDuration(dist, effective.speed);
    dispatch({ type: 'START_TRAVEL', destinationId: planetId, duration });
  }, [state.planets, state.player]);

  const buyGood = useCallback((good: GoodType, quantity: number) => {
    dispatch({ type: 'BUY_GOOD', good, quantity });
  }, []);

  const sellGood = useCallback((good: GoodType, quantity: number) => {
    dispatch({ type: 'SELL_GOOD', good, quantity });
  }, []);

  const attackEnemy = useCallback(() => {
    dispatch({ type: 'COMBAT_ATTACK' });
  }, []);

  const fleeFromEnemy = useCallback(() => {
    dispatch({ type: 'FLEE_COMBAT' });
  }, []);

  const upgradeShip = useCallback((component: 'cargo' | 'engine' | 'shields' | 'weapons') => {
    dispatch({ type: 'UPGRADE_SHIP', component });
  }, []);

  const buyShip = useCallback((shipClass: string) => {
    dispatch({ type: 'BUY_SHIP', shipClass });
  }, []);

  const repairHull = useCallback(() => {
    dispatch({ type: 'REPAIR_HULL' });
  }, []);

  const acceptMission = useCallback((mission: Mission) => {
    dispatch({ type: 'ACCEPT_MISSION', mission });
  }, []);

  const newGame = useCallback(() => {
    dispatch({ type: 'NEW_GAME' });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_NOTIFICATION', id });
  }, []);

  const currentPlanet = getCurrentPlanet(state);

  return (
    <GameContext.Provider value={{
      state, dispatch, currentPlanet,
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

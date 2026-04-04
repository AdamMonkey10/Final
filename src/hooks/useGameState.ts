import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  GameState,
  LocationId,
  NpcId,
  ItemId,
  QuestId,
  CombatState,
  PlayerStats,
  InventoryItem,
  QuestStatus,
  ActiveQuest,
} from '../types/game';
import { LOCATIONS } from '../data/locations';
import { ENEMIES } from '../data/enemies';
import { QUESTS } from '../data/quests';
import { NPCS } from '../data/npcs';
import { ITEMS } from '../data/items';
import { saveGame, loadGame, deleteSave } from './useSaveLoad';

// Level thresholds
export const XP_THRESHOLDS = [0, 50, 150, 300, 500];

export const LEVEL_STATS: Record<number, Omit<PlayerStats, 'xp' | 'level'>> = {
  1: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
  2: { hp: 45, maxHp: 45, attack: 8, defense: 4 },
  3: { hp: 65, maxHp: 65, attack: 12, defense: 6 },
  4: { hp: 90, maxHp: 90, attack: 17, defense: 9 },
  5: { hp: 120, maxHp: 120, attack: 23, defense: 13 },
};

const LEVEL_UP_MESSAGES: Record<number, string> = {
  2: "You're getting spookier! Your ghost-fighting skills improve!",
  3: 'Now we\'re talking! Even the zombies are impressed!',
  4: 'Castle Dooooom unlocked! Von Dooooom is very anxious about this.',
  5: 'MAX LEVEL! You are officially the Spookiest Kid in the Graveyard!',
};

function createInitialState(playerName: string): GameState {
  return {
    screen: 'game',
    playerName,
    stats: { level: 1, xp: 0, ...LEVEL_STATS[1] },
    inventory: [{ itemId: 'health_potion', quantity: 2 }],
    gold: 15,
    currentLocation: 'graveyard',
    questStates: {
      missing_moan: 'active',
      worst_cake: 'active',
      screaming_sock: 'locked',
      beatrice_performance: 'locked',
      final_confrontation: 'locked',
    },
    activeQuests: [
      { questId: 'missing_moan', objectives: QUESTS.missing_moan.objectives.map(o => ({ ...o })) },
      { questId: 'worst_cake', objectives: QUESTS.worst_cake.objectives.map(o => ({ ...o })) },
    ],
    npcFlags: {},
    gameLog: [
      "🪦 Welcome to the Giggling Graveyard! It smells like old leaves and mystery.",
      "A nearby tombstone reads: 'Here lies Kevin. He looked at the wrong mushroom.'",
      `👻 Gerald the Ghost floats over. "Oh! ${playerName}! I was expecting you! Or someone. I forget. Welcome!"`,
      "💡 Tip: Talk to Gerald to get your first quests started!",
    ],
    overlay: 'none',
    activeNpcId: null,
    combat: null,
    playtime: 0,
    sessionStart: Date.now(),
    pendingLevelUp: false,
    soundEnabled: true,
  };
}

export function useGameState() {
  const [state, setState] = useState<GameState>(() => {
    const save = loadGame();
    if (save) {
      return { ...save, screen: 'start', sessionStart: Date.now() };
    }
    return {
      screen: 'start',
      playerName: '',
      stats: { level: 1, xp: 0, ...LEVEL_STATS[1] },
      inventory: [],
      gold: 0,
      currentLocation: 'graveyard',
      questStates: {},
      activeQuests: [],
      npcFlags: {},
      gameLog: [],
      overlay: 'none',
      activeNpcId: null,
      combat: null,
      playtime: 0,
      sessionStart: Date.now(),
      pendingLevelUp: false,
      soundEnabled: true,
    };
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-save after every state change (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (state.screen !== 'game' && state.screen !== 'win') return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveGame(state);
    }, 500);
  }, [state]);

  const addLog = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      gameLog: [...prev.gameLog.slice(-49), message],
    }));
  }, []);

  const startNewGame = useCallback((playerName: string) => {
    deleteSave();
    const newState = createInitialState(playerName);
    setState(newState);
  }, []);

  const continueGame = useCallback(() => {
    setState(prev => ({ ...prev, screen: 'game' }));
  }, []);

  // Inventory helpers
  const getItemCount = useCallback((itemId: ItemId): number => {
    const item = stateRef.current.inventory.find(i => i.itemId === itemId);
    return item?.quantity ?? 0;
  }, []);

  const addItem = useCallback((itemId: ItemId, quantity: number) => {
    setState(prev => {
      const existing = prev.inventory.find(i => i.itemId === itemId);
      if (existing) {
        return {
          ...prev,
          inventory: prev.inventory.map(i =>
            i.itemId === itemId ? { ...i, quantity: i.quantity + quantity } : i
          ),
        };
      }
      if (prev.inventory.length >= 10) {
        return prev; // Inventory full — don't add
      }
      return {
        ...prev,
        inventory: [...prev.inventory, { itemId, quantity }],
      };
    });
  }, []);

  const removeItem = useCallback((itemId: ItemId, quantity: number): boolean => {
    const current = stateRef.current.inventory.find(i => i.itemId === itemId);
    if (!current || current.quantity < quantity) return false;
    setState(prev => ({
      ...prev,
      inventory: prev.inventory
        .map(i => (i.itemId === itemId ? { ...i, quantity: i.quantity - quantity } : i))
        .filter(i => i.quantity > 0),
    }));
    return true;
  }, []);

  const addGold = useCallback((amount: number) => {
    setState(prev => ({ ...prev, gold: prev.gold + amount }));
  }, []);

  const spendGold = useCallback((amount: number): boolean => {
    if (stateRef.current.gold < amount) return false;
    setState(prev => ({ ...prev, gold: prev.gold - amount }));
    return true;
  }, []);

  // XP + levelling
  const gainXp = useCallback((amount: number) => {
    setState(prev => {
      const currentLevel = prev.stats.level;
      const newXp = prev.stats.xp + amount;
      let newLevel = currentLevel;
      while (newLevel < 5 && newXp >= XP_THRESHOLDS[newLevel]) {
        newLevel++;
      }
      if (newLevel > currentLevel) {
        const newLevelStats = LEVEL_STATS[newLevel];
        return {
          ...prev,
          stats: {
            ...prev.stats,
            xp: newXp,
            level: newLevel,
            maxHp: newLevelStats.maxHp,
            hp: newLevelStats.maxHp, // Full heal on level up
            attack: newLevelStats.attack,
            defense: newLevelStats.defense,
          },
          pendingLevelUp: true,
          // Unlock castle at level 4
          questStates:
            newLevel >= 4 && prev.questStates.final_confrontation === 'locked'
              ? { ...prev.questStates }
              : prev.questStates,
        };
      }
      return { ...prev, stats: { ...prev.stats, xp: newXp } };
    });
  }, []);

  const clearLevelUp = useCallback(() => {
    setState(prev => ({ ...prev, pendingLevelUp: false }));
  }, []);

  // Travel
  const travelTo = useCallback((locationId: LocationId) => {
    const location = LOCATIONS[locationId];
    const currentState = stateRef.current;

    if (location.requiredLevel && currentState.stats.level < location.requiredLevel) {
      addLog(`🔒 Castle Dooooom requires Level ${location.requiredLevel}! You need to level up first.`);
      return;
    }

    // Random encounter check
    const shouldEncounter =
      location.enemyIds.length > 0 && Math.random() < location.encounterChance;

    setState(prev => {
      const newLog = [
        ...prev.gameLog,
        `🚶 You travel to the ${location.name}...`,
        `${location.emoji} ${location.description.split('.')[0]}.`,
      ];

      if (shouldEncounter) {
        const enemyId = location.enemyIds[Math.floor(Math.random() * location.enemyIds.length)];
        const enemyTemplate = ENEMIES[enemyId];
        const enemy = { ...enemyTemplate };
        const combatState: CombatState = {
          enemy,
          playerHp: prev.stats.hp,
          log: [`⚔️ A wild ${enemy.name} appears!`, enemy.dialogue[0]],
          phase: 'player_turn',
          bossPhaseIndex: 0,
        };
        return {
          ...prev,
          currentLocation: locationId,
          gameLog: [...newLog, `⚠️ Encounter! A ${enemy.emoji} ${enemy.name} blocks your path!`],
          combat: combatState,
          overlay: 'combat',
        };
      }

      return { ...prev, currentLocation: locationId, gameLog: newLog };
    });
  }, [addLog]);

  // Combat
  const attackEnemy = useCallback(() => {
    setState(prev => {
      if (!prev.combat || prev.combat.phase !== 'player_turn') return prev;

      const { combat, stats } = prev;
      const weaponBonus = prev.inventory.reduce((bonus, invItem) => {
        const item = ITEMS[invItem.itemId];
        return bonus + (item.attackBonus ?? 0);
      }, 0);

      const playerDmg = Math.max(1, stats.attack + weaponBonus - combat.enemy.defense + Math.floor(Math.random() * 5));
      const newEnemyHp = combat.enemy.hp - playerDmg;
      const combatLog = [...combat.log, `⚔️ You deal ${playerDmg} damage! ${combat.enemy.name} has ${Math.max(0, newEnemyHp)} HP left.`];

      if (newEnemyHp <= 0) {
        // Check boss phases
        const enemy = { ...combat.enemy, hp: 0 };
        return {
          ...prev,
          combat: { ...combat, enemy, log: [...combatLog, combat.enemy.defeatMessage], phase: 'victory' },
        };
      }

      // Check for boss phase transitions
      const enemy = { ...combat.enemy, hp: newEnemyHp };
      let newPhaseIndex = combat.bossPhaseIndex;
      if (enemy.bossPhases && newPhaseIndex < enemy.bossPhases.length) {
        const nextPhase = enemy.bossPhases[newPhaseIndex];
        if (newEnemyHp <= nextPhase.hpThreshold) {
          combatLog.push(nextPhase.dialogue);
          newPhaseIndex++;
        }
      }

      // Enemy counter-attack
      const defenseBonus = prev.inventory.reduce((bonus, invItem) => {
        const item = ITEMS[invItem.itemId];
        return bonus + (item.defenseBonus ?? 0);
      }, 0);
      const enemyDmg = Math.max(1, enemy.attack - stats.defense - defenseBonus + Math.floor(Math.random() * 4));
      const newPlayerHp = combat.playerHp - enemyDmg;
      combatLog.push(`💥 ${enemy.name} attacks for ${enemyDmg} damage!`);
      const randomDialogue = enemy.dialogue[Math.floor(Math.random() * enemy.dialogue.length)];
      combatLog.push(`💬 "${randomDialogue}"`);

      if (newPlayerHp <= 0) {
        return {
          ...prev,
          combat: { ...combat, enemy, playerHp: 0, log: [...combatLog, '💀 You were defeated! But this is a kid-friendly game, so you just wake up in the graveyard feeling dizzy.'], phase: 'defeat', bossPhaseIndex: newPhaseIndex },
        };
      }

      return {
        ...prev,
        combat: { ...combat, enemy, playerHp: newPlayerHp, log: combatLog, phase: 'player_turn', bossPhaseIndex: newPhaseIndex },
      };
    });
  }, []);

  const useItemInCombat = useCallback((itemId: ItemId) => {
    setState(prev => {
      if (!prev.combat || prev.combat.phase !== 'player_turn') return prev;
      const item = ITEMS[itemId];
      const invItem = prev.inventory.find(i => i.itemId === itemId);
      if (!invItem || invItem.quantity <= 0) return prev;

      const { combat } = prev;
      const combatLog = [...combat.log];
      let newPlayerHp = combat.playerHp;

      if (item.healAmount) {
        newPlayerHp = Math.min(prev.stats.maxHp, combat.playerHp + item.healAmount);
        combatLog.push(`🧪 You use ${item.emoji} ${item.name} and restore ${item.healAmount} HP!`);
      }

      // Enemy counter-attack
      const defenseBonus = prev.inventory.reduce((bonus, invItem) => {
        const invItemObj = ITEMS[invItem.itemId];
        return bonus + (invItemObj.defenseBonus ?? 0);
      }, 0);
      const enemyDmg = Math.max(1, combat.enemy.attack - prev.stats.defense - defenseBonus + Math.floor(Math.random() * 4));
      const afterEnemyHp = newPlayerHp - enemyDmg;
      combatLog.push(`💥 ${combat.enemy.name} attacks for ${enemyDmg} damage!`);

      const newInventory = prev.inventory
        .map(i => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter(i => i.quantity > 0);

      if (afterEnemyHp <= 0) {
        return {
          ...prev,
          inventory: newInventory,
          combat: { ...combat, playerHp: 0, log: [...combatLog, '💀 You fainted! You wake up back at the start, a bit dazed.'], phase: 'defeat' },
        };
      }

      return {
        ...prev,
        inventory: newInventory,
        combat: { ...combat, playerHp: afterEnemyHp, log: combatLog, phase: 'player_turn' },
      };
    });
  }, []);

  const runFromCombat = useCallback(() => {
    setState(prev => {
      if (!prev.combat) return prev;
      const success = Math.random() < 0.6;
      if (success) {
        return {
          ...prev,
          combat: { ...prev.combat, log: [...prev.combat.log, '🏃 You ran away successfully! Sometimes the better part of valour is your legs.'], phase: 'fled' },
        };
      } else {
        const enemy = prev.combat.enemy;
        const defenseBonus = prev.inventory.reduce((bonus, invItem) => {
          const item = ITEMS[invItem.itemId];
          return bonus + (item.defenseBonus ?? 0);
        }, 0);
        const enemyDmg = Math.max(1, enemy.attack - prev.stats.defense - defenseBonus + Math.floor(Math.random() * 3));
        const newHp = prev.combat.playerHp - enemyDmg;
        const newLog = [...prev.combat.log, `🏃 You tried to run but ${enemy.name} caught you! Takes ${enemyDmg} damage.`];
        if (newHp <= 0) {
          return { ...prev, combat: { ...prev.combat, playerHp: 0, log: [...newLog, '💀 You fainted!'], phase: 'defeat' } };
        }
        return { ...prev, combat: { ...prev.combat, playerHp: newHp, log: newLog, phase: 'player_turn' } };
      }
    });
  }, []);

  const endCombat = useCallback((victory: boolean) => {
    setState(prev => {
      if (!prev.combat) return prev;
      const { combat } = prev;

      if (victory) {
        const xp = combat.enemy.xpReward;
        const gold = combat.enemy.goldReward;
        const newGold = prev.gold + gold;
        const newXp = prev.stats.xp + xp;
        let newLevel = prev.stats.level;
        while (newLevel < 5 && newXp >= XP_THRESHOLDS[newLevel]) {
          newLevel++;
        }
        const leveledUp = newLevel > prev.stats.level;
        const newLevelStats = leveledUp ? LEVEL_STATS[newLevel] : null;
        const newStats = leveledUp
          ? { ...prev.stats, xp: newXp, level: newLevel, ...newLevelStats }
          : { ...prev.stats, xp: newXp };

        const isBossVictory = combat.enemy.id === 'von_dooooom_boss';
        const newLog = [
          ...prev.gameLog,
          `🏆 Victory! Defeated ${combat.enemy.name}! Gained ${xp} XP and ${gold} 💰`,
        ];
        if (isBossVictory) newLog.push('😱 Lord Von Dooooom collapses onto his throne. "...tea?" he whispers hopefully.');

        // Auto-complete final quest on boss victory
        let newQuestStates = prev.questStates;
        let newScreen = prev.screen;
        if (isBossVictory && prev.questStates.final_confrontation === 'active') {
          newQuestStates = { ...prev.questStates, final_confrontation: 'complete' };
          newScreen = 'win';
        }

        return {
          ...prev,
          stats: { ...newStats, hp: Math.min(newStats.maxHp, combat.playerHp) },
          gold: newGold,
          combat: null,
          overlay: 'none',
          gameLog: newLog,
          pendingLevelUp: leveledUp,
          questStates: newQuestStates,
          screen: newScreen,
        };
      } else {
        // Defeat — return to graveyard with 5 HP
        return {
          ...prev,
          stats: { ...prev.stats, hp: 5 },
          currentLocation: 'graveyard',
          combat: null,
          overlay: 'none',
          gameLog: [...prev.gameLog, '💀 You woke up in the Giggling Graveyard, a bit embarrassed. Gerald didn\'t notice.'],
        };
      }
    });
  }, []);

  // NPC interaction
  const openNpcDialog = useCallback((npcId: NpcId) => {
    setState(prev => {
      const flags = prev.npcFlags[npcId] ?? { visited: false };
      const npc = NPCS[npcId];
      const isFirstVisit = !flags.visited;
      const greeting = isFirstVisit
        ? npc.firstVisitDialogue.replace(/{name}/g, prev.playerName)
        : npc.repeatVisitDialogue.replace(/{name}/g, prev.playerName);
      return {
        ...prev,
        npcFlags: { ...prev.npcFlags, [npcId]: { ...flags, visited: true } },
        activeNpcId: npcId,
        overlay: 'npc',
        gameLog: [...prev.gameLog, `💬 ${npc.emoji} ${npc.name}: "${greeting}"`],
      };
    });
  }, []);

  const closeOverlay = useCallback(() => {
    setState(prev => ({ ...prev, overlay: 'none', activeNpcId: null }));
  }, []);

  const openOverlay = useCallback((overlay: GameState['overlay']) => {
    setState(prev => ({ ...prev, overlay }));
  }, []);

  // Quest management
  const getQuestStatus = useCallback((questId: QuestId): QuestStatus => {
    return stateRef.current.questStates[questId] ?? 'locked';
  }, []);

  const completeQuest = useCallback((questId: QuestId) => {
    setState(prev => {
      const quest = QUESTS[questId];
      if (!quest) return prev;

      const newGold = prev.gold + quest.rewards.gold;
      const newXp = prev.stats.xp + quest.rewards.xp;
      let newLevel = prev.stats.level;
      while (newLevel < 5 && newXp >= XP_THRESHOLDS[newLevel]) newLevel++;
      const leveledUp = newLevel > prev.stats.level;
      const newLevelStats = leveledUp ? LEVEL_STATS[newLevel] : null;
      const newStats = leveledUp
        ? { ...prev.stats, xp: newXp, level: newLevel, ...newLevelStats }
        : { ...prev.stats, xp: newXp };

      // Add reward items
      let newInventory = [...prev.inventory];
      if (quest.rewards.items) {
        for (const reward of quest.rewards.items) {
          const existing = newInventory.find(i => i.itemId === reward.itemId);
          if (existing) {
            newInventory = newInventory.map(i =>
              i.itemId === reward.itemId ? { ...i, quantity: i.quantity + reward.quantity } : i
            );
          } else if (newInventory.length < 10) {
            newInventory.push({ itemId: reward.itemId, quantity: reward.quantity });
          }
        }
      }

      const newQuestStates: Record<string, QuestStatus> = {
        ...prev.questStates,
        [questId]: 'complete',
      };

      // Unlock next quests
      if (questId === 'screaming_sock') newQuestStates.beatrice_performance = 'active';
      if (questId === 'beatrice_performance') newQuestStates.final_confrontation = 'active';

      const newActiveQuests = prev.activeQuests.filter(q => q.questId !== questId);
      if (newQuestStates.beatrice_performance === 'active' && !newActiveQuests.find(q => q.questId === 'beatrice_performance')) {
        newActiveQuests.push({ questId: 'beatrice_performance', objectives: QUESTS.beatrice_performance.objectives.map(o => ({ ...o })) });
      }
      if (newQuestStates.final_confrontation === 'active' && !newActiveQuests.find(q => q.questId === 'final_confrontation')) {
        newActiveQuests.push({ questId: 'final_confrontation', objectives: QUESTS.final_confrontation.objectives.map(o => ({ ...o })) });
      }

      const newLog = [
        ...prev.gameLog,
        `✅ ${quest.completionMessage}`,
        `💰 +${quest.rewards.gold} Gold! ⭐ +${quest.rewards.xp} XP!`,
      ];

      if (questId === 'missing_moan') {
        // Unlock screaming_sock
        newQuestStates.screaming_sock = 'active';
        newActiveQuests.push({ questId: 'screaming_sock', objectives: QUESTS.screaming_sock.objectives.map(o => ({ ...o })) });
      }

      // Win screen for final quest
      const newScreen = questId === 'final_confrontation' ? 'win' : prev.screen;

      return {
        ...prev,
        stats: { ...newStats, hp: Math.min(newStats.maxHp, prev.stats.hp) },
        gold: newGold,
        inventory: newInventory,
        questStates: newQuestStates,
        activeQuests: newActiveQuests,
        gameLog: newLog,
        pendingLevelUp: leveledUp,
        screen: newScreen,
      };
    });
  }, []);

  // Buy from shop
  const buyItem = useCallback((itemId: ItemId, price: number): boolean => {
    const currentState = stateRef.current;
    if (currentState.gold < price) return false;
    if (currentState.inventory.length >= 10) return false;
    setState(prev => {
      const existing = prev.inventory.find(i => i.itemId === itemId);
      const newInventory: InventoryItem[] = existing
        ? prev.inventory.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev.inventory, { itemId, quantity: 1 }];
      return {
        ...prev,
        gold: prev.gold - price,
        inventory: newInventory,
        gameLog: [...prev.gameLog, `🛍️ Bought ${ITEMS[itemId].emoji} ${ITEMS[itemId].name} for ${price} 💰`],
      };
    });
    return true;
  }, []);

  // Use health item from inventory
  const useHealItem = useCallback((itemId: ItemId): boolean => {
    const item = ITEMS[itemId];
    if (!item.healAmount) return false;
    const currentState = stateRef.current;
    const invItem = currentState.inventory.find(i => i.itemId === itemId);
    if (!invItem || invItem.quantity <= 0) return false;
    if (currentState.stats.hp >= currentState.stats.maxHp) return false;
    setState(prev => {
      const newHp = Math.min(prev.stats.maxHp, prev.stats.hp + (item.healAmount ?? 0));
      const newInventory = prev.inventory
        .map(i => i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      return {
        ...prev,
        stats: { ...prev.stats, hp: newHp },
        inventory: newInventory,
        gameLog: [...prev.gameLog, `🧪 Used ${item.emoji} ${item.name} — restored ${item.healAmount} HP!`],
      };
    });
    return true;
  }, []);

  const toggleSound = useCallback(() => {
    setState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  const manualSave = useCallback(() => {
    saveGame(stateRef.current);
    addLog('💾 Game saved!');
  }, [addLog]);

  const startBossFight = useCallback((combatState: CombatState) => {
    setState(prev => ({
      ...prev,
      combat: { ...combatState, playerHp: prev.stats.hp },
      overlay: 'combat',
      gameLog: [...prev.gameLog, '⚔️ BOSS BATTLE BEGINS!'],
    }));
  }, []);

  const restartGame = useCallback(() => {
    deleteSave();
    setState(prev => ({ ...prev, screen: 'start', playerName: '' }));
  }, []);

  // Location-specific item finds based on active quests
  const LOCATION_FINDS: Record<string, { itemId: ItemId; message: string; questHint?: string }[]> = {
    graveyard: [
      { itemId: 'moan_jar', message: '🫙 You search behind a wonky tombstone and find a glass jar. It sounds faintly like a sleepy kitten inside. Gerald\'s moan jar!', questHint: 'missing_moan' },
      { itemId: 'ghost_dust', message: '✨ You find some Ghost Dust stuck to a gravestone.' },
      { itemId: 'bad_joke_scroll', message: '📜 You find a scroll wedged under a tombstone. It\'s full of terrible puns.' },
    ],
    bakery: [
      { itemId: 'rotten_egg', message: '🥚 You find a suspiciously old egg behind the bakery counter. For the cake!', questHint: 'worst_cake' },
      { itemId: 'bone_biscuit', message: '🦴 A Bone Biscuit fell off the counter. It\'s still crunchy. Somehow.' },
      { itemId: 'burnt_bread', message: '🍞 A loaf of Benny\'s Burnt Bread is sitting on the windowsill. It\'s very charcoal-y.' },
    ],
    mansion: [
      { itemId: 'vampire_costume', message: '🧛 You find a magnificent vampire costume hanging in the mansion wardrobe. Beatrice will love this!', questHint: 'beatrice_performance' },
      { itemId: 'prop_cauldron', message: '🫕 A prop cauldron is sitting in the corner of the ballroom, bubbling dramatically with nothing in it. Beatrice\'s stage prop!', questHint: 'beatrice_performance' },
      { itemId: 'mystery_mushroom', message: '🍄 A glowing mushroom grows out of the carpet. Probably fine.' },
    ],
    swamp: [
      { itemId: 'smelly_sock', message: '🧦 A smelly sock floats past on the bog water. You grab it. Science demands it.', questHint: 'worst_cake' },
      { itemId: 'stinky_cheese', message: '🧀 You find a wheel of extremely opinionated cheese floating in the mud. Cake ingredient secured!', questHint: 'worst_cake' },
    ],
    library: [
      { itemId: 'silence_token', message: '🤫 You find a Silence Token between two books. It makes no sound at all.' },
      { itemId: 'ancient_tome', message: '📕 An Ancient Tome falls off a shelf and hits you. Knowledge acquired (painfully).' },
    ],
    castle: [
      { itemId: 'ghost_shield', message: '🛡️ You find a Ghost Shield propped against the castle wall. It\'s very defensive.' },
      { itemId: 'mega_potion', message: '💖 A Mega Potion is sitting on the castle windowsill. Von Dooooom left it out.' },
    ],
  };

  const exploreArea = useCallback(() => {
    const currentState = stateRef.current;
    const locationId = currentState.currentLocation;
    const finds = LOCATION_FINDS[locationId] ?? [];

    if (finds.length === 0) {
      addLog('🔍 You search the area thoroughly. Nothing new to find.');
      return;
    }

    // Filter to items not already in inventory (or if stackable, allow)
    const questItems = new Set(['moan_jar', 'rotten_egg', 'stinky_cheese', 'vampire_costume', 'prop_cauldron', 'sock_map']);
    const available = finds.filter(f => {
      if (questItems.has(f.itemId)) {
        // Quest items: only show if not already obtained
        return !currentState.inventory.find(i => i.itemId === f.itemId);
      }
      return true;
    });

    if (available.length === 0) {
      addLog('🔍 You search the area. Everything has already been found here!');
      return;
    }

    if (currentState.inventory.length >= 10) {
      addLog('🔍 Your inventory is full! Use or drop something first.');
      return;
    }

    const find = available[Math.floor(Math.random() * available.length)];
    setState(prev => {
      const existing = prev.inventory.find(i => i.itemId === find.itemId);
      const newInventory = existing
        ? prev.inventory.map(i => i.itemId === find.itemId ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev.inventory, { itemId: find.itemId, quantity: 1 }];
      return {
        ...prev,
        inventory: newInventory,
        gameLog: [...prev.gameLog, `🔍 ${find.message}`],
      };
    });
  }, [addLog]);

  return {
    state,
    addLog,
    startNewGame,
    continueGame,
    getItemCount,
    addItem,
    removeItem,
    addGold,
    spendGold,
    gainXp,
    clearLevelUp,
    travelTo,
    attackEnemy,
    useItemInCombat,
    runFromCombat,
    endCombat,
    openNpcDialog,
    closeOverlay,
    openOverlay,
    getQuestStatus,
    completeQuest,
    buyItem,
    useHealItem,
    toggleSound,
    manualSave,
    restartGame,
    exploreArea,
    startBossFight,
  };
}

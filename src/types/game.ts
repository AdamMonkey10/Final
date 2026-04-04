// ============================================================
// SPOOKY QUEST: The Giggling Graveyard — Type Definitions
// ============================================================

export type LocationId =
  | 'graveyard'
  | 'bakery'
  | 'mansion'
  | 'swamp'
  | 'library'
  | 'castle';

export type NpcId =
  | 'gerald'
  | 'beatrice'
  | 'benny'
  | 'professor_squelch'
  | 'wendy'
  | 'von_dooooom';

export type ItemId =
  | 'ghost_dust'
  | 'bad_joke_scroll'
  | 'burnt_bread'
  | 'bone_biscuit'
  | 'mystery_mushroom'
  | 'spooky_potion'
  | 'smelly_sock'
  | 'silence_token'
  | 'knowledge_bomb'
  | 'moan_jar'
  | 'rotten_egg'
  | 'stinky_cheese'
  | 'prop_cauldron'
  | 'vampire_costume'
  | 'sock_map'
  | 'ancient_tome'
  | 'health_potion'
  | 'mega_potion'
  | 'rusty_sword'
  | 'spooky_dagger'
  | 'ghost_shield';

export type EnemyId =
  | 'giggling_zombie'
  | 'muffin_monster'
  | 'chandelier_spider'
  | 'sock_goblin'
  | 'angry_encyclopedia'
  | 'von_dooooom_boss';

export type QuestId =
  | 'missing_moan'
  | 'worst_cake'
  | 'screaming_sock'
  | 'beatrice_performance'
  | 'final_confrontation';

export type QuestStatus = 'locked' | 'active' | 'complete';

export type ItemCategory = 'healing' | 'key' | 'weapon' | 'curiosity';

export interface Item {
  id: ItemId;
  emoji: string;
  name: string;
  description: string;
  category: ItemCategory;
  healAmount?: number;
  attackBonus?: number;
  defenseBonus?: number;
  value: number;
}

export interface InventoryItem {
  itemId: ItemId;
  quantity: number;
}

export interface Enemy {
  id: EnemyId;
  emoji: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xpReward: number;
  goldReward: number;
  dialogue: string[];
  defeatMessage: string;
  isBoss?: boolean;
  bossPhases?: BossPhase[];
}

export interface BossPhase {
  hpThreshold: number;
  dialogue: string;
}

export interface Location {
  id: LocationId;
  emoji: string;
  name: string;
  description: string;
  danger: string;
  connections: LocationId[];
  npcId?: NpcId;
  enemyIds: EnemyId[];
  encounterChance: number;
  requiredLevel?: number;
}

export interface NpcShopItem {
  itemId: ItemId;
  price: number;
  stock: number;
}

export interface NpcTradeOffer {
  give: { itemId: ItemId; quantity: number };
  receive: { itemId: ItemId; quantity: number };
  description: string;
}

export interface DialogueEntry {
  text: string;
  responses?: DialogueResponse[];
}

export interface DialogueResponse {
  text: string;
  nextId?: string;
  action?: DialogueAction;
}

export type DialogueAction =
  | { type: 'give_item'; itemId: ItemId; quantity: number }
  | { type: 'give_gold'; amount: number }
  | { type: 'give_xp'; amount: number }
  | { type: 'start_quest'; questId: QuestId }
  | { type: 'complete_quest'; questId: QuestId }
  | { type: 'open_shop' }
  | { type: 'open_trade' }
  | { type: 'close' };

export interface NpcDialogueTree {
  [key: string]: DialogueEntry;
}

export interface Npc {
  id: NpcId;
  emoji: string;
  name: string;
  locationId: LocationId;
  shop: NpcShopItem[];
  tradeOffer?: NpcTradeOffer;
  dialogueTree: NpcDialogueTree;
  firstVisitDialogue: string;
  repeatVisitDialogue: string;
  questDialogue?: { [questId: string]: string };
}

export interface QuestObjective {
  description: string;
  completed: boolean;
  itemRequired?: { itemId: ItemId; quantity: number };
  locationRequired?: LocationId;
  npcRequired?: NpcId;
}

export interface Quest {
  id: QuestId;
  title: string;
  emoji: string;
  description: string;
  fullDescription: string;
  requiredLevel: number;
  objectives: QuestObjective[];
  rewards: {
    xp: number;
    gold: number;
    items?: { itemId: ItemId; quantity: number }[];
    unlocks?: LocationId[];
  };
  completionMessage: string;
  payoff: string;
}

export interface PlayerStats {
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
}

export type OverlayType =
  | 'none'
  | 'npc'
  | 'trade'
  | 'combat'
  | 'quest_log'
  | 'inventory'
  | 'level_up'
  | 'settings'
  | 'shop'
  | 'map';

export interface CombatState {
  enemy: Enemy;
  playerHp: number;
  log: string[];
  phase: 'player_turn' | 'enemy_turn' | 'victory' | 'defeat' | 'fled';
  bossPhaseIndex: number;
}

export interface ActiveQuest {
  questId: QuestId;
  objectives: QuestObjective[];
}

export interface NpcFlags {
  [npcId: string]: {
    visited: boolean;
    tradeComplete?: boolean;
    questDialogueSeen?: boolean;
  };
}

export interface GameState {
  screen: 'start' | 'game' | 'win';
  playerName: string;
  stats: PlayerStats;
  inventory: InventoryItem[];
  gold: number;
  currentLocation: LocationId;
  questStates: { [questId: string]: QuestStatus };
  activeQuests: ActiveQuest[];
  npcFlags: NpcFlags;
  gameLog: string[];
  overlay: OverlayType;
  activeNpcId: NpcId | null;
  combat: CombatState | null;
  playtime: number;
  sessionStart: number;
  pendingLevelUp: boolean;
  soundEnabled: boolean;
}

export interface SaveData extends GameState {
  savedAt: number;
  version: string;
}

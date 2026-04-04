import { useState, useEffect } from 'react';
import type { GameState, NpcId, DialogueResponse, DialogueAction } from '../types/game';
import { NPCS } from '../data/npcs';
import { QUESTS } from '../data/quests';

interface NPCDialogProps {
  state: GameState;
  npcId: NpcId;
  onClose: () => void;
  onAction: (action: DialogueAction) => void;
  onOpenShop: () => void;
  onOpenTrade: () => void;
}

// Map NPC + quest to the dialogue key that handles quest completion
const QUEST_RETURN_KEYS: Record<string, Record<string, string>> = {
  gerald: { missing_moan: 'quest_return' },
  benny: { worst_cake: 'quest_return' },
  professor_squelch: { screaming_sock: 'quest_return' },
  beatrice: { beatrice_performance: 'start' },
  von_dooooom: { final_confrontation: 'start' },
};

// Items required to trigger quest return dialogue
const QUEST_TRIGGER_ITEMS: Record<string, string> = {
  missing_moan: 'moan_jar',
  worst_cake: 'smelly_sock', // player needs all 3, check all in component
  screaming_sock: 'sock_map',
};

export default function NPCDialog({ state, npcId, onClose, onAction, onOpenShop, onOpenTrade }: NPCDialogProps) {
  const npc = NPCS[npcId];

  // Check if we should auto-route to a quest return dialogue
  const getInitialKey = () => {
    const npcQuestReturns = QUEST_RETURN_KEYS[npcId];
    if (!npcQuestReturns) return 'start';

    for (const [questId, dialogueKey] of Object.entries(npcQuestReturns)) {
      if (state.questStates[questId] !== 'active') continue;
      const triggerItem = QUEST_TRIGGER_ITEMS[questId];
      if (triggerItem) {
        const hasItem = state.inventory.find(i => i.itemId === triggerItem);
        if (!hasItem) continue;
        // Special case: worst_cake needs all 3 ingredients
        if (questId === 'worst_cake') {
          const hasEgg = state.inventory.find(i => i.itemId === 'rotten_egg');
          const hasCheese = state.inventory.find(i => i.itemId === 'stinky_cheese');
          const hasSock = state.inventory.find(i => i.itemId === 'smelly_sock');
          if (!hasEgg || !hasCheese || !hasSock) continue;
        }
        return dialogueKey;
      } else {
        // No item trigger — just show return dialogue if quest active
        return dialogueKey;
      }
    }
    return 'start';
  };

  const [dialogueKey, setDialogueKey] = useState(getInitialKey);

  const entry = npc.dialogueTree[dialogueKey] ?? npc.dialogueTree['start'];
  if (!entry) return null;

  const displayText = entry.text.replace(/{name}/g, state.playerName);

  const handleResponse = (response: DialogueResponse) => {
    if (response.action) {
      const action = response.action;
      if (action.type === 'open_shop') { onOpenShop(); return; }
      if (action.type === 'open_trade') { onOpenTrade(); return; }
      if (action.type === 'close') { onClose(); return; }

      // Remove quest items before completing quest
      if (action.type === 'complete_quest') {
        const triggerItem = QUEST_TRIGGER_ITEMS[action.questId];
        if (triggerItem) {
          // Remove all quest items from inventory via action flow
        }
      }

      onAction(action);
      if (action.type === 'complete_quest' || action.type === 'start_quest') {
        onClose();
        return;
      }
      if (response.nextId) {
        setDialogueKey(response.nextId);
      } else {
        onClose();
      }
    } else if (response.nextId) {
      setDialogueKey(response.nextId);
    } else {
      onClose();
    }
  };

  // Find active quest that is tracking this NPC
  const activeQuestHint = Object.entries(state.questStates).find(([qId, status]) => {
    if (status !== 'active') return false;
    const quest = QUESTS[qId as keyof typeof QUESTS];
    if (!quest) return false;
    const activeQuest = state.activeQuests.find(q => q.questId === qId);
    if (!activeQuest) return false;
    const nextObj = activeQuest.objectives.find(o => !o.completed);
    return nextObj?.npcRequired === npcId;
  });

  return (
    <div className="overlay-fullscreen flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-spooky-purple">
        <div className="flex items-center gap-3">
          <span className="text-5xl float-anim">{npc.emoji}</span>
          <h2 className="font-pixel text-spooky-green text-base md:text-lg">{npc.name}</h2>
        </div>
        <button onClick={onClose} className="overlay-close-btn">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-spooky-card border-2 border-spooky-purple rounded-2xl p-5 relative">
          <div className="absolute -top-3 left-8 text-spooky-purple text-lg">▲</div>
          <p className="font-game text-spooky-text text-base md:text-lg leading-relaxed">
            {displayText}
          </p>
        </div>

        {activeQuestHint && (
          <div className="bg-yellow-900 border border-yellow-600 rounded-xl p-3">
            <p className="font-game text-yellow-300 text-sm font-bold">
              📜 Quest: {QUESTS[activeQuestHint[0] as keyof typeof QUESTS]?.title}
            </p>
            {npc.questDialogue?.[activeQuestHint[0]] && (
              <p className="font-game text-yellow-200 text-xs mt-1 opacity-80 italic">
                "{npc.questDialogue[activeQuestHint[0]]?.replace(/{name}/g, state.playerName)}"
              </p>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-spooky-purple flex flex-col gap-3">
        {(entry.responses ?? []).map((response, i) => (
          <button
            key={i}
            onClick={() => handleResponse(response)}
            className="w-full bg-spooky-card border-2 border-spooky-purple rounded-xl p-4 text-left font-game text-base text-spooky-text active:scale-95 transition-transform min-h-[56px] flex items-center"
          >
            {response.text}
          </button>
        ))}
        {(!entry.responses || entry.responses.length === 0) && (
          <button onClick={onClose} className="w-full game-btn py-4 text-base bg-spooky-card border-2 border-gray-700">
            👋 Goodbye!
          </button>
        )}
      </div>
    </div>
  );
}

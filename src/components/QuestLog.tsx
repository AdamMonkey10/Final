import React, { useState } from 'react';
import type { GameState, QuestId } from '../types/game';
import { QUESTS } from '../data/quests';

interface QuestLogProps {
  state: GameState;
  onClose: () => void;
}

export default function QuestLog({ state, onClose }: QuestLogProps) {
  const [expandedQuest, setExpandedQuest] = useState<QuestId | null>(null);

  const questIds = Object.keys(QUESTS) as QuestId[];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return { text: '🟡 Active', cls: 'text-yellow-400 border-yellow-700 bg-yellow-950' };
      case 'complete': return { text: '✅ Done!', cls: 'text-green-400 border-green-700 bg-green-950' };
      default: return { text: '🔒 Locked', cls: 'text-gray-500 border-gray-700 bg-gray-950' };
    }
  };

  return (
    <div className="overlay-fullscreen flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-spooky-purple">
        <h2 className="font-pixel text-spooky-orange text-base md:text-xl">📜 Quest Log</h2>
        <button onClick={onClose} className="overlay-close-btn">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {questIds.map(questId => {
          const quest = QUESTS[questId];
          const status = state.questStates[questId] ?? 'locked';
          const badge = statusBadge(status);
          const isExpanded = expandedQuest === questId;
          const activeQuest = state.activeQuests.find(q => q.questId === questId);

          return (
            <div key={questId} className="bg-spooky-card border border-spooky-purple rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedQuest(isExpanded ? null : questId)}
                className="w-full flex items-center gap-3 p-4 active:bg-spooky-darker transition-colors"
              >
                <span className="text-3xl">{quest.emoji}</span>
                <div className="flex-1 text-left">
                  <p className="font-game font-bold text-spooky-text text-sm md:text-base">{quest.title}</p>
                  <p className="font-game text-gray-400 text-xs leading-snug">{quest.description}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`font-game text-xs px-2 py-1 rounded-full border ${badge.cls}`}>
                    {badge.text}
                  </span>
                  <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3 flex flex-col gap-3">
                  <p className="font-game text-spooky-text text-sm leading-relaxed">{quest.fullDescription}</p>

                  {/* Objectives */}
                  {status !== 'locked' && (
                    <div>
                      <p className="font-game text-gray-500 text-xs mb-2">OBJECTIVES:</p>
                      <div className="flex flex-col gap-2">
                        {(activeQuest?.objectives ?? quest.objectives).map((obj, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-base shrink-0">{obj.completed ? '✅' : '⬜'}</span>
                            <p className={`font-game text-sm leading-snug ${obj.completed ? 'text-green-400 line-through opacity-60' : 'text-spooky-text'}`}>
                              {obj.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rewards */}
                  <div className="bg-spooky-darker rounded-xl p-3">
                    <p className="font-game text-gray-500 text-xs mb-2">REWARDS:</p>
                    <div className="flex gap-4 flex-wrap">
                      <span className="font-game text-yellow-400 text-sm">💰 {quest.rewards.gold} gold</span>
                      <span className="font-game text-purple-400 text-sm">⭐ {quest.rewards.xp} XP</span>
                      {quest.rewards.items?.map(reward => (
                        <span key={reward.itemId} className="font-game text-green-400 text-sm">
                          + {reward.quantity}x item
                        </span>
                      ))}
                    </div>
                  </div>

                  {status === 'complete' && (
                    <div className="bg-green-950 border border-green-700 rounded-xl p-3">
                      <p className="font-game text-green-300 text-xs leading-relaxed italic">
                        "{quest.payoff}"
                      </p>
                    </div>
                  )}

                  {status === 'locked' && (
                    <p className="font-game text-gray-500 text-xs">
                      🔒 Complete earlier quests to unlock this!
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

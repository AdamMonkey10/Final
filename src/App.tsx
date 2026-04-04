import { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import type { NpcId, ItemId, DialogueAction, CombatState } from './types/game';
import { LOCATIONS } from './data/locations';
import { ITEMS } from './data/items';
import { ENEMIES } from './data/enemies';

import StartScreen from './components/StartScreen';
import WinScreen from './components/WinScreen';
import GameHUD from './components/GameHUD';
import GameLog from './components/GameLog';
import LocationView from './components/LocationView';
import NPCDialog from './components/NPCDialog';
import TradeScreen from './components/TradeScreen';
import CombatScreen from './components/CombatScreen';
import QuestLog from './components/QuestLog';
import Inventory from './components/Inventory';
import LevelUpModal from './components/LevelUpModal';
import SettingsPanel from './components/SettingsPanel';
import MapScreen from './components/MapScreen';

export default function App() {
  const game = useGameState();
  const { state } = game;
  const [_tradeMode, setTradeMode] = useState<'shop' | 'trade'>('shop');

  if (state.screen === 'start') {
    return (
      <StartScreen
        onNewGame={game.startNewGame}
        onContinue={game.continueGame}
      />
    );
  }

  if (state.screen === 'win') {
    return (
      <WinScreen
        state={state}
        onRestart={game.restartGame}
      />
    );
  }

  const handleNpcAction = (action: DialogueAction) => {
    switch (action.type) {
      case 'give_item':
        game.addItem(action.itemId, action.quantity);
        game.addLog(`📦 Received ${ITEMS[action.itemId].emoji} ${ITEMS[action.itemId].name} ×${action.quantity}!`);
        break;
      case 'give_gold':
        game.addGold(action.amount);
        game.addLog(`💰 Received ${action.amount} gold!`);
        break;
      case 'give_xp':
        game.gainXp(action.amount);
        game.addLog(`⭐ Gained ${action.amount} XP!`);
        break;
      case 'start_quest':
        game.addLog(`📜 New quest started: ${action.questId.replace(/_/g, ' ')}!`);
        // Trigger boss fight immediately for final quest
        if (action.questId === 'final_confrontation') {
          const boss = { ...ENEMIES.von_dooooom_boss };
          const combatState: CombatState = {
            enemy: boss,
            playerHp: state.stats.hp,
            log: [
              '😱 Lord Von Dooooom takes a deep breath.',
              '"PREPARE FOR DOOOOOM!" he shouts.',
              '"...I am fine. This is fine. I am definitely not scared."',
              '⚔️ The Final Battle begins!',
            ],
            phase: 'player_turn',
            bossPhaseIndex: 0,
          };
          game.openOverlay('none');
          setTimeout(() => {
            game.startBossFight(combatState);
          }, 100);
        }
        break;
      case 'complete_quest':
        game.completeQuest(action.questId);
        break;
    }
  };

  const handleTrade = (
    give: { itemId: ItemId; quantity: number },
    receive: { itemId: ItemId; quantity: number }
  ): boolean => {
    const hasItems = state.inventory.find(i => i.itemId === give.itemId)?.quantity ?? 0;
    if (hasItems < give.quantity) return false;
    game.removeItem(give.itemId, give.quantity);
    game.addItem(receive.itemId, receive.quantity);
    game.addLog(`🔄 Traded ${ITEMS[give.itemId].emoji} for ${ITEMS[receive.itemId].emoji}!`);
    return true;
  };

  const currentLocation = LOCATIONS[state.currentLocation];
  const currentNpcId = currentLocation?.npcId as NpcId | undefined;

  return (
    <div className="min-h-screen bg-spooky-dark text-spooky-text flex flex-col md:flex-row">
      <GameHUD
        state={state}
        onOpenQuests={() => game.openOverlay('quest_log')}
        onOpenInventory={() => game.openOverlay('inventory')}
        onOpenSettings={() => game.openOverlay('settings')}
        onOpenMap={() => game.openOverlay('map')}
      />

      <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full pb-8">
        <GameLog entries={state.gameLog} />
        <LocationView
          state={state}
          onTravel={game.travelTo}
          onTalkToNpc={() => {
            if (currentNpcId) game.openNpcDialog(currentNpcId);
          }}
          onExplore={game.exploreArea}
        />
      </main>

      {state.pendingLevelUp && state.overlay !== 'combat' && (
        <LevelUpModal state={state} onClose={game.clearLevelUp} />
      )}

      {state.overlay === 'npc' && state.activeNpcId && (
        <NPCDialog
          state={state}
          npcId={state.activeNpcId}
          onClose={game.closeOverlay}
          onAction={handleNpcAction}
          onOpenShop={() => {
            setTradeMode('shop');
            game.openOverlay('shop');
          }}
          onOpenTrade={() => {
            setTradeMode('trade');
            game.openOverlay('trade');
          }}
        />
      )}

      {(state.overlay === 'shop' || state.overlay === 'trade') && state.activeNpcId && (
        <TradeScreen
          state={state}
          npcId={state.activeNpcId}
          mode={state.overlay === 'shop' ? 'shop' : 'trade'}
          onClose={() => game.openOverlay('npc')}
          onBuy={game.buyItem}
          onTrade={handleTrade}
        />
      )}

      {state.overlay === 'combat' && state.combat && (
        <CombatScreen
          state={state}
          onAttack={game.attackEnemy}
          onUseItem={game.useItemInCombat}
          onRun={game.runFromCombat}
          onEndCombat={game.endCombat}
        />
      )}

      {state.overlay === 'quest_log' && (
        <QuestLog state={state} onClose={game.closeOverlay} />
      )}

      {state.overlay === 'inventory' && (
        <Inventory
          state={state}
          onClose={game.closeOverlay}
          onUseItem={game.useHealItem}
        />
      )}

      {state.overlay === 'settings' && (
        <SettingsPanel
          state={state}
          onClose={game.closeOverlay}
          onToggleSound={game.toggleSound}
          onManualSave={game.manualSave}
          onRestart={game.restartGame}
        />
      )}

      {state.overlay === 'map' && (
        <MapScreen
          state={state}
          onClose={game.closeOverlay}
          onTravel={loc => { game.travelTo(loc); game.closeOverlay(); }}
        />
      )}
    </div>
  );
}

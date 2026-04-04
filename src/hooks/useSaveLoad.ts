import type { GameState, SaveData } from '../types/game';

const SAVE_KEY = 'spooky_quest_save';
const SAVE_VERSION = '1.0.0';

export function saveGame(state: GameState): void {
  try {
    const saveData: SaveData = {
      ...state,
      savedAt: Date.now(),
      version: SAVE_VERSION,
      playtime: state.playtime + Math.floor((Date.now() - state.sessionStart) / 1000),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

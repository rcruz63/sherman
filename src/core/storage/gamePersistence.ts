/**
 * Game State Auto-Save & Persistence Module (localStorage / IndexedDB)
 */

import { BoardState, BoardHex } from '../../types/game';

const STORAGE_KEY = 'sherman_game_save_v1';

export interface SavedGameState {
  boardState: {
    tiles: Array<[string, BoardHex]>;
    sherman: BoardState['sherman'];
    enemyTanks: BoardState['enemyTanks'];
    enemyInfantry: BoardState['enemyInfantry'];
    currentTurn: number;
    currentPhase: BoardState['currentPhase'];
    missionData: BoardState['missionData'];
  };
  combatLog: string[];
  savedAt: string;
}

/**
 * Saves current game state to localStorage
 */
export function saveGameStateToStorage(boardState: BoardState, combatLog: string[]): boolean {
  try {
    const tilesArray = Array.from(boardState.tiles.entries());
    const payload: SavedGameState = {
      boardState: {
        tiles: tilesArray,
        sherman: boardState.sherman,
        enemyTanks: boardState.enemyTanks,
        enemyInfantry: boardState.enemyInfantry,
        currentTurn: boardState.currentTurn,
        currentPhase: boardState.currentPhase,
        missionData: boardState.missionData,
      },
      combatLog,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Error saving game state:', err);
    return false;
  }
}

/**
 * Loads saved game state from localStorage
 */
export function loadGameStateFromStorage(): { boardState: BoardState; combatLog: string[] } | null {
  try {
    const jsonStr = localStorage.getItem(STORAGE_KEY);
    if (!jsonStr) return null;

    const parsed: SavedGameState = JSON.parse(jsonStr);
    const tileMap = new Map<string, BoardHex>(parsed.boardState.tiles);

    const boardState: BoardState = {
      tiles: tileMap,
      sherman: parsed.boardState.sherman,
      enemyTanks: parsed.boardState.enemyTanks,
      enemyInfantry: parsed.boardState.enemyInfantry,
      currentTurn: parsed.boardState.currentTurn,
      currentPhase: parsed.boardState.currentPhase,
      missionData: parsed.boardState.missionData,
    };

    return {
      boardState,
      combatLog: parsed.combatLog || [],
    };
  } catch (err) {
    console.error('Error loading game state:', err);
    return null;
  }
}

/**
 * Clears saved game state from localStorage
 */
export function clearSavedGameState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing saved game state:', err);
  }
}

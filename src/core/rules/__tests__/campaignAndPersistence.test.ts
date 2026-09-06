import { describe, it, expect, beforeEach } from 'vitest';
import mission1Raw from '../../../data/missions/mission1.json';
import mission2Raw from '../../../data/missions/mission2.json';
import { MissionJSON } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import { prepareCampaignNextMission } from '../campaign';
import { saveGameStateToStorage, loadGameStateFromStorage, clearSavedGameState } from '../../storage/gamePersistence';

const mission1 = mission1Raw as MissionJSON;
const mission2 = mission2Raw as MissionJSON;

// Mock localStorage for node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Campaign Mode Rules & Local Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Campaign Transition Rules (prepareCampaignNextMission)', () => {
    it('carries over damage flags and allows replacing 1 KIA crew member', () => {
      const board1 = loadMissionState(mission1);

      // Simulate damage and status in Mission 1
      board1.sherman.isTurretDamaged = true;
      board1.sherman.isImmobilized = true;
      board1.sherman.fireLevel = 2;
      board1.sherman.isLoaded = true;

      // Mark Commander & Driver as KIA
      board1.sherman.crew.commander.status = 'kia';
      board1.sherman.crew.driver.status = 'kia';

      // Transition to Mission 2, choosing to replace Commander
      const board2 = prepareCampaignNextMission(mission2, board1.sherman, 'commander');

      // Verify carried-over status
      expect(board2.sherman.isTurretDamaged).toBe(true);
      expect(board2.sherman.isImmobilized).toBe(true);
      expect(board2.sherman.fireLevel).toBe(2);
      expect(board2.sherman.isLoaded).toBe(true);

      // Verify Commander was replaced (active) and Driver remains KIA
      expect(board2.sherman.crew.commander.status).toBe('active');
      expect(board2.sherman.crew.driver.status).toBe('kia');
    });
  });

  describe('Local Storage Persistence System', () => {
    it('saves and restores exact game state and combat log', () => {
      const boardState = loadMissionState(mission1);
      boardState.currentTurn = 4;
      boardState.sherman.isLoaded = true;

      const log = ['Turn 4 started', 'Sherman loaded cannon'];

      const saved = saveGameStateToStorage(boardState, log);
      expect(saved).toBe(true);

      const restored = loadGameStateFromStorage();
      expect(restored).not.toBeNull();
      expect(restored?.boardState.currentTurn).toBe(4);
      expect(restored?.boardState.sherman.isLoaded).toBe(true);
      expect(restored?.combatLog).toEqual(log);
    });

    it('clears saved state correctly', () => {
      const boardState = loadMissionState(mission1);
      saveGameStateToStorage(boardState, ['Log test']);

      clearSavedGameState();
      expect(loadGameStateFromStorage()).toBeNull();
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import mission11Raw from '../../../data/missions/mission11.json';
import mission12Raw from '../../../data/missions/mission12.json';
import mission13Raw from '../../../data/missions/mission13.json';
import { MissionJSON } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import { checkGameEndConditions, executePhase7 } from '../turnManager';
import { useGameStore } from '../../../store/gameStore';

const mission11 = mission11Raw as MissionJSON;
const mission12 = mission12Raw as MissionJSON;
const mission13 = mission13Raw as MissionJSON;

describe('Missions 11 to 13 Integration & Special Rules Verification', () => {
  describe('Mission 11 - Gladiadores de Acero', () => {
    it('deploys 3 enemy tanks (Tiger, Panzer IV, Panzer III)', () => {
      const boardState = loadMissionState(mission11);
      expect(boardState.enemyTanks).toHaveLength(3);
      expect(boardState.enemyTanks.some((t) => t.type === 'tiger')).toBe(true);
      expect(boardState.enemyTanks.some((t) => t.type === 'panzerIV')).toBe(true);
      expect(boardState.enemyTanks.some((t) => t.type === 'panzerIII')).toBe(true);
    });

    it('handles NO_EVENT (roll 6-7) in Phase 7 without applying actions and advances turn', () => {
      const boardState = loadMissionState(mission11);
      const initialTurn = boardState.currentTurn;
      const initialFire = boardState.sherman.fireLevel;

      const logMsg = executePhase7(boardState, 6);

      expect(logMsg).toContain('NO_EVENT');
      expect(logMsg).toContain('No ocurre ningún evento');
      expect(boardState.currentTurn).toBe(initialTurn + 1);
      expect(boardState.sherman.fireLevel).toBe(initialFire);
    });

    it('achieves VICTORY when all enemy tanks are destroyed without requiring map exit', () => {
      const boardState = loadMissionState(mission11);

      // Sherman remains at starting hex (1,8)
      expect(boardState.sherman.coord).toEqual({ q: 1, r: 8 });

      // Destroy all enemy tanks
      boardState.enemyTanks.forEach((t) => (t.status = 'destroyed'));

      const gameEnd = checkGameEndConditions(boardState);

      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA TÁCTICA');
    });
  });

  describe('Mission 12 - La Caza del Tiger 2', () => {
    it('restricts Tiger I spawn strictly to black numbers 1, 2, 3, or 4 across multiple runs', () => {
      const allowedNumbers = [1, 2, 3, 4];

      for (let run = 0; run < 25; run++) {
        const boardState = loadMissionState(mission12);
        const tiger = boardState.enemyTanks.find((t) => t.type === 'tiger');

        expect(tiger).toBeDefined();
        expect(tiger?.spawnNumber).toBeDefined();
        expect(allowedNumbers).toContain(tiger?.spawnNumber);
      }
    });

    it('achieves VICTORY by destroying the Tiger I and exiting at (1,0)', () => {
      const boardState = loadMissionState(mission12);
      const tiger = boardState.enemyTanks.find((t) => t.type === 'tiger')!;

      // Destroy Tiger I (Panzer III tanks remain operational)
      tiger.status = 'destroyed';

      // Before reaching exit, game is not over
      expect(checkGameEndConditions(boardState).isGameOver).toBe(false);

      // Move Sherman to exit hex (1,0)
      boardState.sherman.coord = { q: 1, r: 0 };

      const gameEnd = checkGameEndConditions(boardState);
      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
    });
  });

  describe('Mission 13 - Rescate', () => {
    beforeEach(() => {
      useGameStore.getState().loadMission(mission13);
    });

    it('initializes disabledSherman special rule at hex (1,3)', () => {
      const storeState = useGameStore.getState();
      const disabledRule = storeState.boardState?.missionData?.specialRules?.disabledSherman;

      expect(disabledRule).toBeDefined();
      expect(disabledRule?.hex).toEqual({ q: 1, r: 3 });
      expect(disabledRule?.rescued).toBe(false);
    });

    it('rescues crew at hex (1,3) and restores KIA crew members to active', () => {
      const store = useGameStore.getState();
      if (!store.boardState) return;

      // Set loader KIA
      store.boardState.sherman.crew.loader.status = 'kia';
      expect(store.boardState.sherman.crew.loader.status).toBe('kia');

      // Attempt rescue away from hex (1,3) -> fails
      store.rescueCrew();
      expect(useGameStore.getState().boardState?.missionData?.specialRules?.disabledSherman?.rescued).toBe(false);

      // Move Sherman to (1,3) and rescue
      useGameStore.setState((state) => {
        if (!state.boardState) return state;
        return {
          boardState: {
            ...state.boardState,
            sherman: { ...state.boardState.sherman, coord: { q: 1, r: 3 } },
          },
        };
      });

      useGameStore.getState().rescueCrew();

      const updatedStore = useGameStore.getState();
      const disabledRule = updatedStore.boardState?.missionData?.specialRules?.disabledSherman;

      expect(disabledRule?.rescued).toBe(true);
      expect(updatedStore.boardState?.sherman.crew.loader.status).toBe('active');
    });

    it('requires crewRescued = true before exit hex (1,8) grants victory', () => {
      const store = useGameStore.getState();
      if (!store.boardState) return;

      // Position Sherman at exit hex (1,8) BEFORE rescue
      store.boardState.sherman.coord = { q: 1, r: 8 };
      let gameEnd = checkGameEndConditions(store.boardState);
      expect(gameEnd.isVictory).toBe(false);

      // Mark rescued = true
      if (store.boardState.missionData?.specialRules?.disabledSherman) {
        store.boardState.missionData.specialRules.disabledSherman.rescued = true;
      }

      gameEnd = checkGameEndConditions(store.boardState);
      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
    });
  });
});

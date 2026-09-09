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
    it('initializes 36 hexes and deploys Sherman to a random black spot matching its facing', () => {
      // Test deterministic player black spawn #4 (hex 3,6 with facing 0)
      const boardState = loadMissionState(mission11, { selectedPlayerBlackSpawn: 4 });

      expect(boardState.tiles.size).toBe(36);
      expect(boardState.sherman.coord).toEqual({ q: 3, r: 6 });
      expect(boardState.sherman.facing).toBe(0);

      // Verify enemy tanks spawned on remaining black spots without collision with Sherman
      expect(boardState.enemyTanks).toHaveLength(3);
      expect(boardState.enemyTanks.every((t) => t.spawnNumber !== 4)).toBe(true);
      expect(boardState.enemyTanks.some((t) => t.type === 'tiger')).toBe(true);
      expect(boardState.enemyTanks.some((t) => t.type === 'panzerIV')).toBe(true);
      expect(boardState.enemyTanks.some((t) => t.type === 'panzerIII')).toBe(true);
    });

    it('spawns Sherman and enemy tanks on distinct black numbers across randomized runs', () => {
      for (let i = 0; i < 20; i++) {
        const boardState = loadMissionState(mission11);
        const playerCoordKey = `${boardState.sherman.coord.q},${boardState.sherman.coord.r}`;
        const enemyCoords = boardState.enemyTanks.map((t) => `${t.coord.q},${t.coord.r}`);

        // Sherman never collides with enemy tanks
        expect(enemyCoords).not.toContain(playerCoordKey);
        // All 3 enemy tanks have distinct coordinates
        expect(new Set(enemyCoords).size).toBe(3);
      }
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

      // Destroy all enemy tanks
      boardState.enemyTanks.forEach((t) => (t.status = 'destroyed'));

      const gameEnd = checkGameEndConditions(boardState);

      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA TÁCTICA');
    });

    it('verifies Mission 11 dice pool and canonical event table', () => {
      const dice = mission11.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(dice.misc).toEqual({ road: 1, field: 2, mud: 1 });

      const events = mission11.endOfTurnEvents;
      expect(events.find((e) => 2 >= e.rollMin && 2 <= e.rollMax)?.type).toBe('MINES');
      expect(events.find((e) => 6 >= e.rollMin && 6 <= e.rollMax)?.type).toBe('NO_EVENT');
      expect(events.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('MECHANICAL_FAILURE');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('STUKA');
    });

    it('supports customizable difficulty scaling up to 5 enemy tanks on remaining black spots', () => {
      const customMission11 = JSON.parse(JSON.stringify(mission11)) as MissionJSON;
      customMission11.enemyDeployment.tanks = [
        { type: 'TIGER', spawnMethod: 'RANDOM_UNIQUE_BLACK_NUMBERS', count: 2 },
        { type: 'PANZER_IV', spawnMethod: 'RANDOM_UNIQUE_BLACK_NUMBERS', count: 2 },
        { type: 'PANZER_III', spawnMethod: 'RANDOM_UNIQUE_BLACK_NUMBERS', count: 1 },
      ];

      const boardState = loadMissionState(customMission11, { selectedPlayerBlackSpawn: 1 });
      expect(boardState.enemyTanks).toHaveLength(5);
      expect(boardState.enemyTanks.every((t) => t.spawnNumber !== 1)).toBe(true);
      expect(new Set(boardState.enemyTanks.map((t) => t.spawnNumber)).size).toBe(5);
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

    it('initializes 36 hexes with bridges at (1,3) and (4,2)', () => {
      const boardState = loadMissionState(mission12);
      expect(boardState.tiles.size).toBe(36);
      expect(boardState.tiles.get('1,3')?.isBridge).toBe(true);
      expect(boardState.tiles.get('4,2')?.isBridge).toBe(true);
      expect(boardState.sherman.coord).toEqual({ q: 3, r: 6 });
      expect(boardState.sherman.facing).toBe(0);
    });

    it('achieves VICTORY by destroying the Tiger I and exiting at (2,0)', () => {
      const boardState = loadMissionState(mission12);
      const tiger = boardState.enemyTanks.find((t) => t.type === 'tiger')!;

      // Destroy Tiger I (Panzer III tanks remain operational)
      tiger.status = 'destroyed';

      // Before reaching exit, game is not over
      expect(checkGameEndConditions(boardState).isGameOver).toBe(false);

      // Move Sherman to exit hex (2,0)
      boardState.sherman.coord = { q: 2, r: 0 };

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

    it('verifies Mission 11, 12, 13 dice pools and event resolution tables', () => {
      // Mission 11
      expect(mission11.shermanDicePool.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(mission11.shermanDicePool.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(mission11.shermanDicePool.misc).toEqual({ road: 1, field: 2, mud: 1 });
      expect(mission11.endOfTurnEvents.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('MINES');
      expect(mission11.endOfTurnEvents.find((e) => 6 >= e.rollMin && 6 <= e.rollMax)?.type).toBe('NO_EVENT');
      expect(mission11.endOfTurnEvents.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(mission11.endOfTurnEvents.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('MECHANICAL_FAILURE');
      expect(mission11.endOfTurnEvents.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('STUKA');

      // Mission 12
      expect(mission12.shermanDicePool.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(mission12.shermanDicePool.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(mission12.shermanDicePool.misc).toEqual({ road: 1, field: 2, mud: 1 });
      expect(mission12.endOfTurnEvents.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('MINES');
      expect(mission12.endOfTurnEvents.find((e) => 6 >= e.rollMin && 6 <= e.rollMax)?.type).toBe('MECHANICAL_FAILURE');
      expect(mission12.endOfTurnEvents.find((e) => 7 >= e.rollMin && 7 <= e.rollMax)?.type).toBe('NO_EVENT');
      expect(mission12.endOfTurnEvents.find((e) => 9 >= e.rollMin && 9 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(mission12.endOfTurnEvents.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('STUKA');
      expect(mission12.endOfTurnEvents.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('SPAWN_PANZER_III');

      // Mission 13
      expect(mission13.shermanDicePool.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(mission13.shermanDicePool.attack).toEqual({ road: 2, field: 1, mud: 2 });
      expect(mission13.shermanDicePool.misc).toEqual({ road: 1, field: 2, mud: 1 });
      expect(mission13.endOfTurnEvents.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('SNIPER');
      expect(mission13.endOfTurnEvents.find((e) => 4 >= e.rollMin && 4 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(mission13.endOfTurnEvents.find((e) => 5 >= e.rollMin && 5 <= e.rollMax)?.type).toBe('SPAWN_INFANTRY');
      expect(mission13.endOfTurnEvents.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(mission13.endOfTurnEvents.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('STUKA');
      expect(mission13.endOfTurnEvents.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('SPAWN_PANZER_III');
    });
  });
});

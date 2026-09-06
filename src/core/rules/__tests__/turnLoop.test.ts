import { describe, it, expect } from 'vitest';
import mission1Raw from '../../../data/missions/mission1.json';
import { MissionJSON, TurnPhase } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import {
  executePhase1,
  executePhase4,
  executePhase5,
  executePhase7,
  checkGameEndConditions,
} from '../turnManager';
import { calculateAITurningFacing, runAllGermanActivations } from '../germanAI';

const mission1 = mission1Raw as MissionJSON;

describe('Stage 3 - Game Loop & German AI Tests', () => {
  describe('Full 7-Phase Turn Transition Cycle', () => {
    it('executes a complete turn cycle from Phase 1 through Phase 7', () => {
      const boardState = loadMissionState(mission1, { selectedBlackSpawns: [1, 2] });

      expect(boardState.currentTurn).toBe(1);
      expect(boardState.currentPhase).toBe(TurnPhase.SHERMAN_SMOKE_CLEANUP);

      // Phase 1: Smoke cleanup
      executePhase1(boardState);
      expect(boardState.sherman.hasSmoke).toBe(false);
      expect(boardState.currentPhase).toBe(TurnPhase.COMMANDER_ASSIGNMENT);

      // Phase 2: Commander assignment
      boardState.sherman.commanderPosition = 'hatched';
      boardState.currentPhase = TurnPhase.SHERMAN_OPERATIONS;

      // Phase 3: Operations
      boardState.currentPhase = TurnPhase.GERMAN_SMOKE_CLEANUP;

      // Phase 4: German Smoke cleanup
      executePhase4(boardState);
      expect(boardState.currentPhase).toBe(TurnPhase.FIRE_CHECK);

      // Phase 5: Fire check
      executePhase5(boardState, [2]);
      expect(boardState.currentPhase).toBe(TurnPhase.GERMAN_OPERATIONS);

      // Phase 6: German AI Operations
      const aiResults = runAllGermanActivations(boardState);
      expect(aiResults).toHaveLength(2);
      boardState.currentPhase = TurnPhase.END_TURN_EVENTS;

      // Phase 7: End of Turn Events & Turn increment
      executePhase7(boardState, 7); // Event roll 7
      expect(boardState.currentTurn).toBe(2);
      expect(boardState.currentPhase).toBe(TurnPhase.SHERMAN_SMOKE_CLEANUP);
    });
  });

  describe('German AI Turning Rules Logic', () => {
    it('does not turn if directly facing Sherman (Rule 3)', () => {
      const boardState = loadMissionState(mission1, { selectedBlackSpawns: [1] });
      // Position Sherman at (2,4) and Tank at (2,0) facing 3 (South towards Sherman)
      boardState.sherman.coord = { q: 2, r: 4 };
      const tank = boardState.enemyTanks[0];
      tank.coord = { q: 2, r: 0 };
      tank.facing = 3; // Facing South towards (2,4)

      const nextFacing = calculateAITurningFacing(tank, boardState);
      expect(nextFacing).toBe(3); // Does not turn!
    });

    it('turns towards Sherman by smallest angle when offset', () => {
      const boardState = loadMissionState(mission1, { selectedBlackSpawns: [1] });
      boardState.sherman.coord = { q: 2, r: 4 };
      const tank = boardState.enemyTanks[0];
      tank.coord = { q: 2, r: 0 };
      tank.facing = 2; // Facing SE (2), Sherman is South (3)

      const nextFacing = calculateAITurningFacing(tank, boardState);
      expect(nextFacing).toBe(3); // Turns +1 towards Sherman
    });
  });

  describe('Game End Conditions (Victory & Defeat)', () => {
    it('detects VICTORY when all target enemies are destroyed and exit hex is reached', () => {
      const boardState = loadMissionState(mission1, { selectedBlackSpawns: [1, 2] });

      // Destroy all enemies
      boardState.enemyTanks.forEach((t) => (t.status = 'destroyed'));

      // Move Sherman to exit hex (2,0)
      boardState.sherman.coord = { q: 2, r: 0 };

      const gameEnd = checkGameEndConditions(boardState);
      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA');
    });

    it('detects DEFEAT when all crew members are KIA', () => {
      const boardState = loadMissionState(mission1);

      // Set all 5 crew members KIA
      Object.values(boardState.sherman.crew).forEach((c) => (c.status = 'kia'));

      const gameEnd = checkGameEndConditions(boardState);
      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(false);
      expect(gameEnd.message).toContain('DERROTA');
    });
  });
});

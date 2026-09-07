import { describe, it, expect } from 'vitest';
import mission5Raw from '../../../data/missions/mission5.json';
import mission6Raw from '../../../data/missions/mission6.json';
import mission7Raw from '../../../data/missions/mission7.json';
import mission8Raw from '../../../data/missions/mission8.json';
import { MissionJSON } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import { handleMoveTruckEvent } from '../eventHandlers';
import { checkGameEndConditions } from '../turnManager';

const mission5 = mission5Raw as MissionJSON;
const mission6 = mission6Raw as MissionJSON;
const mission7 = mission7Raw as MissionJSON;
const mission8 = mission8Raw as MissionJSON;

describe('Missions 5, 6, 7, and 8 Special Mechanics Tests', () => {
  describe('Mission 5 - Destruir el Camión', () => {
    it('advances supply truck along road path on event and triggers defeat if truck escapes (8 moves)', () => {
      const boardState = loadMissionState(mission5);

      expect(boardState.enemyTrucks).toBeDefined();
      expect(boardState.enemyTrucks).toHaveLength(1);

      // Verify 3 infantry units deployed on red spots
      expect(boardState.enemyInfantry).toHaveLength(3);
      expect(boardState.enemyInfantry.every((inf) => inf.status === 'active')).toBe(true);

      const truck = boardState.enemyTrucks![0];
      expect(truck.coord).toEqual({ q: 2, r: 0 });
      expect(truck.facing).toBe(2); // Heading SE
      expect(truck.moveIndex).toBe(0);

      // Advance truck 1 step along road (2,0) -> (3,0)
      const move1 = handleMoveTruckEvent(boardState);
      expect(move1.moved).toBe(true);
      expect(truck.coord).toEqual({ q: 3, r: 0 });
      expect(truck.moveIndex).toBe(1);

      // Advance truck remaining steps until maxMoves (8 moves)
      for (let i = 2; i <= 8; i++) {
        handleMoveTruckEvent(boardState);
      }

      expect(truck.moveIndex).toBeGreaterThanOrEqual(7);

      const gameEnd = checkGameEndConditions(boardState);
      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(false);
      expect(gameEnd.message).toContain('camión de suministros alemán ha escapado');
    });

    it('verifies Mission 5 dice pool and event resolution table', () => {
      const dice = mission5.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(dice.misc).toEqual({ road: 1, field: 2, mud: 1 });

      const events = mission5.endOfTurnEvents;
      expect(events.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(events.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('MOVE_TRUCK');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('SPAWN_PANZER_IV');
    });
  });

  describe('Mission 6 - Averiado y Rodeado', () => {
    it('starts with Sherman immobilized: true on initial deployment', () => {
      const boardState = loadMissionState(mission6);

      expect(boardState.sherman.isImmobilized).toBe(true);
      expect(boardState.enemyTanks).toHaveLength(3);
      expect(boardState.enemyTanks.every((t) => t.type === 'panzerIII')).toBe(true);
    });

    it('verifies Mission 6 dice pool and event resolution table', () => {
      const dice = mission6.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(dice.misc).toEqual({ road: 1, field: 2, mud: 1 });

      const events = mission6.endOfTurnEvents;
      expect(events.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('SNIPER');
      expect(events.find((e) => 5 >= e.rollMin && 5 <= e.rollMax)?.type).toBe('SPAWN_INFANTRY');
      expect(events.find((e) => 6 >= e.rollMin && 6 <= e.rollMax)?.type).toBe('MINES');
      expect(events.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('STUKA');
      expect(events.find((e) => 12 >= e.rollMin && 12 <= e.rollMax)?.type).toBe('SPAWN_PANZER_III');
    });
  });

  describe('Mission 7 - Pasaba por Aquí: El Puente', () => {
    it('configures bridge hex (1,4) and restricts allowed entry/exit directions', () => {
      const boardState = loadMissionState(mission7);

      const bridgeTile = boardState.tiles.get('1,4');
      expect(bridgeTile).toBeDefined();
      expect(bridgeTile?.isBridge).toBe(true);

      const bridgeRule = boardState.missionData?.specialRules?.bridge;
      expect(bridgeRule).toBeDefined();
      expect(bridgeRule?.allowedEntryDirections).toEqual([0, 3]);
    });

    it('verifies Mission 7 dice pool and event resolution table', () => {
      const dice = mission7.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(dice.misc).toEqual({ road: 1, field: 2, mud: 1 });

      const events = mission7.endOfTurnEvents;
      expect(events.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('MINES');
      expect(events.find((e) => 5 >= e.rollMin && 5 <= e.rollMax)?.type).toBe('SPAWN_INFANTRY');
      expect(events.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('STUKA');
    });
  });

  describe('Mission 8 - Asesinato (Oficial Objetivo)', () => {
    it('achieves VICTORY when officer infantry is eliminated and Sherman reaches exit hex', () => {
      const boardState = loadMissionState(mission8);

      const officer = boardState.enemyInfantry.find((inf) => inf.id === 'OFFICER_INFANTRY' || inf.isObjective);
      expect(officer).toBeDefined();
      expect(officer?.coord).toEqual({ q: 1, r: 3 });

      // Eliminate officer infantry
      officer!.status = 'eliminated';

      // Move Sherman to exit hex (1,0)
      boardState.sherman.coord = { q: 1, r: 0 };

      const gameEnd = checkGameEndConditions(boardState);

      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA TÁCTICA');
    });

    it('verifies Mission 8 dice pool and event resolution table', () => {
      const dice = mission8.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(dice.misc).toEqual({ road: 1, field: 2, mud: 1 });

      const events = mission8.endOfTurnEvents;
      expect(events.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('MINES');
      expect(events.find((e) => 5 >= e.rollMin && 5 <= e.rollMax)?.type).toBe('SPAWN_INFANTRY');
      expect(events.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('STUKA');
    });
  });
});

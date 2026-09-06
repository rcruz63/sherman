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

      const truck = boardState.enemyTrucks![0];
      expect(truck.coord).toEqual({ q: 1, r: 1 });
      expect(truck.moveIndex).toBe(0);

      // Advance truck 1 step
      const move1 = handleMoveTruckEvent(boardState);
      expect(move1.moved).toBe(true);
      expect(truck.coord).toEqual({ q: 1, r: 2 });
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
  });

  describe('Mission 6 - Averiado y Rodeado', () => {
    it('starts with Sherman immobilized: true on initial deployment', () => {
      const boardState = loadMissionState(mission6);

      expect(boardState.sherman.isImmobilized).toBe(true);
      expect(boardState.enemyTanks).toHaveLength(3);
      expect(boardState.enemyTanks.every((t) => t.type === 'panzerIII')).toBe(true);
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
  });
});

import { describe, it, expect } from 'vitest';
import mission3Raw from '../../../data/missions/mission3.json';
import mission4Raw from '../../../data/missions/mission4.json';
import { MissionJSON } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import { checkGameEndConditions } from '../turnManager';

const mission3 = mission3Raw as MissionJSON;
const mission4 = mission4Raw as MissionJSON;

describe('Missions 3 & 4 Victory Conditions Verification', () => {
  describe('Mission 3 - Elimina la Infantería', () => {
    it('initializes 36-hex grid, 6 building infantry, 2 Panzer IVs, and Sherman at (3,6)', () => {
      const boardState = loadMissionState(mission3);

      expect(boardState.tiles.size).toBe(36);
      expect(boardState.sherman.coord).toEqual({ q: 3, r: 6 });
      expect(boardState.sherman.facing).toBe(0);

      // Verify 2 Panzer IVs deployed on black spots
      expect(boardState.enemyTanks).toHaveLength(2);
      expect(boardState.enemyTanks.every((t) => t.type === 'panzerIV')).toBe(true);

      // Verify 6 infantry squads spawned on the 6 building hexes
      expect(boardState.enemyInfantry).toHaveLength(6);
      boardState.enemyInfantry.forEach((inf) => {
        const tile = boardState.tiles.get(`${inf.coord.q},${inf.coord.r}`);
        expect(tile?.hasBuilding).toBe(true);
        expect(inf.status).toBe('active');
      });
    });

    it('achieves VICTORY by eliminating all infantry and reaching exit hex (2,0), ignoring alive tanks', () => {
      const boardState = loadMissionState(mission3);

      // Verify German tanks are operational
      expect(boardState.enemyTanks.length).toBeGreaterThan(0);
      boardState.enemyTanks.forEach((t) => expect(t.status).toBe('operational'));

      // Eliminate all infantry
      boardState.enemyInfantry.forEach((inf) => {
        inf.status = 'eliminated';
      });

      // Move Sherman to exit hex (2,0)
      boardState.sherman.coord = { q: 2, r: 0 };

      const gameEnd = checkGameEndConditions(boardState);

      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA TÁCTICA');
    });

    it('verifies Mission 3 dice pool and event resolution table', () => {
      const dice = mission3.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 1, mud: 2 });
      expect(dice.misc).toEqual({ road: 1, field: 2, mud: 1 });

      const events = mission3.endOfTurnEvents;
      expect(events.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('SNIPER');
      expect(events.find((e) => 5 >= e.rollMin && 5 <= e.rollMax)?.type).toBe('MINES');
      expect(events.find((e) => 7 >= e.rollMin && 7 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(events.find((e) => 9 >= e.rollMin && 9 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('STUKA');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('SPAWN_PANZER_III');
    });
  });

  describe('Mission 4 - Pasaba por Aquí: El Lago', () => {
    it('achieves VICTORY exclusively by reaching exit hex, even with Tiger I and Panzer IV fully intact', () => {
      const boardState = loadMissionState(mission4);

      // Verify Tiger I and Panzer IV are intact
      expect(boardState.enemyTanks).toHaveLength(2);
      expect(boardState.enemyTanks.some((t) => t.type === 'tiger')).toBe(true);
      expect(boardState.enemyTanks.some((t) => t.type === 'panzerIV')).toBe(true);

      // Both tanks are fully operational
      boardState.enemyTanks.forEach((t) => expect(t.status).toBe('operational'));

      // Move Sherman to exit hex (1,0)
      boardState.sherman.coord = { q: 1, r: 0 };

      const gameEnd = checkGameEndConditions(boardState);

      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA TÁCTICA');
    });

    it('verifies Mission 4 dice pool and event resolution table', () => {
      const dice = mission4.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(dice.misc).toEqual({ road: 1, field: 1, mud: 2 });

      const events = mission4.endOfTurnEvents;
      expect(events.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('SNIPER');
      expect(events.find((e) => 4 >= e.rollMin && 4 <= e.rollMax)?.type).toBe('MECHANICAL_FAILURE');
      expect(events.find((e) => 6 >= e.rollMin && 6 <= e.rollMax)?.type).toBe('SPAWN_INFANTRY');
      expect(events.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('STUKA');
    });
  });
});

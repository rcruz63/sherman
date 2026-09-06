import { describe, it, expect } from 'vitest';
import mission3Raw from '../../../data/missions/mission3.json';
import mission4Raw from '../../../data/missions/mission4.json';
import { MissionJSON, EnemyInfantry } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import { checkGameEndConditions } from '../turnManager';

const mission3 = mission3Raw as MissionJSON;
const mission4 = mission4Raw as MissionJSON;

describe('Missions 3 & 4 Victory Conditions Verification', () => {
  describe('Mission 3 - Elimina la Infantería', () => {
    it('achieves VICTORY by eliminating all infantry and reaching exit hex, ignoring alive tanks', () => {
      const boardState = loadMissionState(mission3);

      // Verify German tanks are operational
      expect(boardState.enemyTanks.length).toBeGreaterThan(0);
      boardState.enemyTanks.forEach((t) => expect(t.status).toBe('operational'));

      // Spawn 6 infantry squads and eliminate them
      const infantryList: EnemyInfantry[] = [];
      for (let i = 1; i <= 6; i++) {
        infantryList.push({
          id: `inf_${i}`,
          type: 'infantry',
          coord: { q: i % 3, r: i },
          status: 'eliminated', // All eliminated
        });
      }
      boardState.enemyInfantry = infantryList;

      // Move Sherman to exit hex (1,0)
      boardState.sherman.coord = { q: 1, r: 0 };

      const gameEnd = checkGameEndConditions(boardState);

      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA TÁCTICA');
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
  });
});

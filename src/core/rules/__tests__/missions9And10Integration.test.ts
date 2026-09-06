import { describe, it, expect } from 'vitest';
import mission9Raw from '../../../data/missions/mission9.json';
import mission10Raw from '../../../data/missions/mission10.json';
import { MissionJSON } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import { checkGameEndConditions } from '../turnManager';

const mission9 = mission9Raw as MissionJSON;
const mission10 = mission10Raw as MissionJSON;

describe('Missions 9 & 10 Victory Conditions Verification', () => {
  describe('Mission 9 - Al Otro Lado del Río', () => {
    it('achieves VICTORY by destroying all German tanks and reaching exit hex, ignoring alive building infantry', () => {
      const boardState = loadMissionState(mission9);

      // Verify 1 Tiger and 1 Panzer IV are deployed
      expect(boardState.enemyTanks).toHaveLength(2);
      expect(boardState.enemyTanks.some((t) => t.type === 'tiger')).toBe(true);
      expect(boardState.enemyTanks.some((t) => t.type === 'panzerIV')).toBe(true);

      // Destroy all enemy tanks
      boardState.enemyTanks.forEach((t) => (t.status = 'destroyed'));

      // Building infantry remains active
      expect(boardState.enemyInfantry).toBeDefined();

      // Move Sherman to exit hex (1,0)
      boardState.sherman.coord = { q: 1, r: 0 };

      const gameEnd = checkGameEndConditions(boardState);

      expect(gameEnd.isGameOver).toBe(true);
      expect(gameEnd.isVictory).toBe(true);
      expect(gameEnd.message).toContain('VICTORIA TÁCTICA');
    });

    it('verifies Mission 9 dice pool and event resolution table', () => {
      const dice = mission9.shermanDicePool;
      expect(dice.maneuver).toEqual({ road: 2, field: 1, mud: 0 });
      expect(dice.attack).toEqual({ road: 2, field: 2, mud: 1 });
      expect(dice.misc).toEqual({ road: 1, field: 2, mud: 1 });

      const events = mission9.endOfTurnEvents;
      expect(events.find((e) => 3 >= e.rollMin && 3 <= e.rollMax)?.type).toBe('SNIPER');
      expect(events.find((e) => 5 >= e.rollMin && 5 <= e.rollMax)?.type).toBe('MINES');
      expect(events.find((e) => 6 >= e.rollMin && 6 <= e.rollMax)?.type).toBe('MECHANICAL_FAILURE');
      expect(events.find((e) => 8 >= e.rollMin && 8 <= e.rollMax)?.type).toBe('INFANTRY_ATTACK');
      expect(events.find((e) => 10 >= e.rollMin && 10 <= e.rollMax)?.type).toBe('COMMANDER_ORDER');
      expect(events.find((e) => 11 >= e.rollMin && 11 <= e.rollMax)?.type).toBe('STUKA');
    });
  });

  describe('Mission 10 - Pasaba por Aquí: El Pueblo', () => {
    it('achieves VICTORY exclusively by reaching exit hex, escaping Tiger + 2 Panzer IV tanks', () => {
      const boardState = loadMissionState(mission10);

      // Verify 1 Tiger + 2 Panzer IV tanks are deployed
      expect(boardState.enemyTanks).toHaveLength(3);
      expect(boardState.enemyTanks.filter((t) => t.type === 'tiger')).toHaveLength(1);
      expect(boardState.enemyTanks.filter((t) => t.type === 'panzerIV')).toHaveLength(2);

      // All enemy tanks remain 100% operational
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

import { describe, it, expect } from 'vitest';
import mission1Raw from '../../../data/missions/mission1.json';
import { MissionJSON } from '../../../types/game';
import {
  loadMissionState,
  calculateShermanDicePool,
  resolveMissionEvent,
} from '../missionLoader';
import { calculateHitDifficulty } from '../combat';

const mission1 = mission1Raw as MissionJSON;

describe('Mission 1 Integration Tests', () => {
  describe('Sherman Initialization & Crew Verification', () => {
    it('initializes Sherman at exact deployment specs', () => {
      const boardState = loadMissionState(mission1);
      const sherman = boardState.sherman;

      expect(sherman.coord).toEqual({ q: 5, r: 4 });
      expect(sherman.facing).toBe(5); // Noroeste (NW)
      expect(sherman.isLoaded).toBe(false); // Initial status: unloaded
      expect(sherman.fireLevel).toBe(0); // Initial status: no fire
      expect(sherman.commanderPosition).toBe('unhatched'); // Interior
      expect(sherman.isTurretDamaged).toBe(false);
      expect(sherman.isImmobilized).toBe(false);
      expect(sherman.hasSmoke).toBe(false);
      expect(sherman.isHullDown).toBe(false);

      // Verify all 5 crew members are active (not KIA)
      const crewList = Object.values(sherman.crew);
      expect(crewList).toHaveLength(5);
      crewList.forEach((member) => {
        expect(member.status).toBe('active');
      });
    });

    it('spawns 2 Panzer IV tanks on 2 unique black numbers with correct facings', () => {
      const boardState = loadMissionState(mission1, { selectedBlackSpawns: [1, 2] });
      expect(boardState.enemyTanks).toHaveLength(2);

      const pz1 = boardState.enemyTanks.find((t) => t.spawnNumber === 1)!;
      expect(pz1).toBeDefined();
      expect(pz1.coord).toEqual({ q: 2, r: 0 });
      expect(pz1.facing).toBe(3); // South
      expect(pz1.size).toBe(4);
      expect(pz1.armor).toEqual({ D: 6, LD: 4, LT: 3, T: 2 });
      expect(pz1.penetration).toBe(6);

      const pz2 = boardState.enemyTanks.find((t) => t.spawnNumber === 2)!;
      expect(pz2).toBeDefined();
      expect(pz2.coord).toEqual({ q: 4, r: 0 });
      expect(pz2.facing).toBe(4); // Southwest
    });
  });

  describe('Sherman Action Dice Pool by Terrain', () => {
    it('calculates dice pool accurately based on terrain', () => {
      const diceConfig = mission1.shermanDicePool;

      const roadPool = calculateShermanDicePool('road', diceConfig);
      expect(roadPool).toEqual({ maneuver: 2, attack: 2, misc: 1, total: 5 });

      const fieldPool = calculateShermanDicePool('field', diceConfig);
      expect(fieldPool).toEqual({ maneuver: 1, attack: 2, misc: 2, total: 5 });

      const mudPool = calculateShermanDicePool('mud', diceConfig);
      expect(mudPool).toEqual({ maneuver: 0, attack: 1, misc: 1, total: 2 });
    });
  });

  describe('End of Turn Event Table Resolution (2d6)', () => {
    const events = mission1.endOfTurnEvents;

    it('resolves roll 2-3 to SNIPER', () => {
      expect(resolveMissionEvent(events, 2)?.type).toBe('SNIPER');
      expect(resolveMissionEvent(events, 3)?.type).toBe('SNIPER');
    });

    it('resolves roll 4 to COMMANDER_ORDER', () => {
      const rule = resolveMissionEvent(events, 4);
      expect(rule?.type).toBe('COMMANDER_ORDER');
      expect(rule?.description).toContain('Cargar');
    });

    it('resolves roll 5-6 to SPAWN_INFANTRY', () => {
      expect(resolveMissionEvent(events, 5)?.type).toBe('SPAWN_INFANTRY');
      expect(resolveMissionEvent(events, 6)?.type).toBe('SPAWN_INFANTRY');
    });

    it('resolves roll 7-8 to INFANTRY_ATTACK', () => {
      expect(resolveMissionEvent(events, 7)?.type).toBe('INFANTRY_ATTACK');
      expect(resolveMissionEvent(events, 8)?.type).toBe('INFANTRY_ATTACK');
    });

    it('resolves roll 9 to MECHANICAL_FAILURE', () => {
      const rule = resolveMissionEvent(events, 9);
      expect(rule?.type).toBe('MECHANICAL_FAILURE');
      expect(rule?.description).toContain('Inmovilizado');
    });

    it('resolves roll 10 to STUKA', () => {
      const rule = resolveMissionEvent(events, 10);
      expect(rule?.type).toBe('STUKA');
    });

    it('resolves roll 11-12 to SPAWN_PANZER_III', () => {
      expect(resolveMissionEvent(events, 11)?.type).toBe('SPAWN_PANZER_III');
      expect(resolveMissionEvent(events, 12)?.type).toBe('SPAWN_PANZER_III');
    });
  });

  describe('Line of Sight & Combat Calculation on Mission 1 Map', () => {
    it('evaluates clear LOS from (5,4) to Black Spawn 4 at (0,4) along NW axis', () => {
      const boardState = loadMissionState(mission1, { selectedBlackSpawns: [4] });
      const sherman = boardState.sherman; // at (5,4) facing 5 (NW)
      const pz4 = boardState.enemyTanks[0]; // at Black Spawn 4: (0,4) facing 1 (NE)

      expect(pz4.coord).toEqual({ q: 0, r: 4 });

      const breakdown = calculateHitDifficulty(sherman, pz4, boardState);

      expect(breakdown.hasLOS).toBe(true);
      expect(breakdown.baseDistance).toBe(5);
      expect(breakdown.targetSize).toBe(4); // TAM 4
      expect(breakdown.baseDifficulty).toBe(9); // TAM 4 + Dist 5
    });

    it('blocks LOS from (5,3) to (0,3) due to intermediate Town Building at (4,3)', () => {
      const boardState = loadMissionState(mission1, { selectedBlackSpawns: [4] });
      const sherman = { coord: { q: 5, r: 3 }, facing: 5 as const };
      const target = { coord: { q: 0, r: 3 }, facing: 1 as const, size: 4, hasSmoke: false, isHullDown: false };

      const breakdown = calculateHitDifficulty(sherman, target, boardState);

      expect(breakdown.hasLOS).toBe(false);
      expect(breakdown.losReason).toBe('BLOCKED_BY_OBSTACLE');
    });
  });
});

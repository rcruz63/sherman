import { describe, it, expect } from 'vitest';
import {
  calculateHitDifficulty,
  resolveDamageCheck,
  resolveDamageEffect,
} from '../combat';
import { BoardState, HexTile } from '../../../types/game';

function createTestBoard(): BoardState {
  const tiles = new Map<string, HexTile>();

  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      tiles.set(`${q},${r}`, {
        coord: { q, r },
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });
    }
  }

  return {
    tiles,
    sherman: {} as any,
    enemyTanks: [],
    enemyInfantry: [],
    currentTurn: 1,
    currentPhase: 1,
  };
}

describe('Combat Rules Engine', () => {
  describe('calculateHitDifficulty', () => {
    it('calculates base difficulty correctly (TAM + Distance)', () => {
      const board = createTestBoard();
      const attacker = { coord: { q: 0, r: 0 }, facing: 0 as const }; // Facing North
      const target = {
        coord: { q: 0, r: -3 }, // Target to the North (Dist 3)
        facing: 3 as const, // Target facing South towards attacker
        size: 4, // Panzer IV TAM = 4
        hasSmoke: false,
        isHullDown: false,
      };

      const breakdown = calculateHitDifficulty(attacker, target, board);

      expect(breakdown.hasLOS).toBe(true);
      expect(breakdown.baseDistance).toBe(3);
      expect(breakdown.targetSize).toBe(4);
      expect(breakdown.baseDifficulty).toBe(7);
      expect(breakdown.totalDifficulty).toBe(7);
      expect(breakdown.impactSector).toBe('D');
    });

    it('applies all modifiers: Building, Smoke, Hull Down, Rear Arc', () => {
      const board = createTestBoard();
      // Target tile is a building
      board.tiles.set('0,-3', {
        coord: { q: 0, r: -3 },
        terrain: 'building',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });

      const attacker = { coord: { q: 0, r: 0 }, facing: 0 as const }; // Facing North
      const target = {
        coord: { q: 0, r: -3 }, // Target to the North
        facing: 0 as const, // Target facing North -> Attacker (0,0) is behind target!
        size: 4,
        hasSmoke: true,
        isHullDown: true,
      };

      const breakdown = calculateHitDifficulty(attacker, target, board);

      expect(breakdown.baseDifficulty).toBe(7); // TAM 4 + Dist 3
      expect(breakdown.buildingModifier).toBe(1);
      expect(breakdown.smokeModifier).toBe(1);
      expect(breakdown.hullDownModifier).toBe(2);
      expect(breakdown.rearArcModifier).toBe(0); // Target is in front of attacker
      expect(breakdown.totalDifficulty).toBe(11); // 7 + 1 + 1 + 2 = 11
      expect(breakdown.impactSector).toBe('T'); // Attacker firing from behind target!
    });

    it('applies rear arc modifier when shooting at a target behind the attacker', () => {
      const board = createTestBoard();
      const attacker = { coord: { q: 0, r: 0 }, facing: 0 as const }; // Attacker facing North
      const target = {
        coord: { q: 0, r: 3 }, // Target is to the South (behind attacker)
        facing: 0 as const,
        size: 4,
        hasSmoke: false,
        isHullDown: false,
      };

      const breakdown = calculateHitDifficulty(attacker, target, board);

      expect(breakdown.rearArcModifier).toBe(1);
      expect(breakdown.totalDifficulty).toBe(8); // Base 7 + Rear 1
    });

    it('returns totalDifficulty = Infinity if LOS is blocked', () => {
      const board = createTestBoard();
      board.tiles.set('0,-2', {
        coord: { q: 0, r: -2 },
        terrain: 'woods',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });

      const attacker = { coord: { q: 0, r: 0 }, facing: 0 as const };
      const target = {
        coord: { q: 0, r: -4 },
        facing: 3 as const,
        size: 4,
        hasSmoke: false,
        isHullDown: false,
      };

      const breakdown = calculateHitDifficulty(attacker, target, board);

      expect(breakdown.hasLOS).toBe(false);
      expect(breakdown.totalDifficulty).toBe(Infinity);
    });
  });

  describe('resolveDamageCheck', () => {
    it('resolves NO_EFFECT when attack fails to reach armor value', () => {
      const result = resolveDamageCheck(7, 10, 2);
      expect(result.result).toBe('NO_EFFECT');
      expect(result.totalAttack).toBe(9);
    });

    it('resolves DAMAGED when attack equals or slightly exceeds armor value', () => {
      const result = resolveDamageCheck(7, 10, 3);
      expect(result.result).toBe('DAMAGED');
      expect(result.totalAttack).toBe(10);
    });

    it('resolves DESTROYED when attack exceeds armor value by at least 3', () => {
      const result = resolveDamageCheck(7, 10, 6);
      expect(result.result).toBe('DESTROYED');
      expect(result.totalAttack).toBe(13);
    });
  });

  describe('resolveDamageEffect', () => {
    it('resolves damage effects for German tanks correctly', () => {
      expect(resolveDamageEffect('germanTank', 2).outcome).toBe('DAMAGED_GUN');
      expect(resolveDamageEffect('germanTank', 5).outcome).toBe('IMMOBILIZED');
      expect(resolveDamageEffect('germanTank', 7).outcome).toBe('CREW_CASUALTY');
      expect(resolveDamageEffect('germanTank', 10).outcome).toBe('DESTROYED');
    });

    it('resolves damage effects for Sherman tank correctly', () => {
      expect(resolveDamageEffect('sherman', 2).outcome).toBe('TURRET_DAMAGED');
      expect(resolveDamageEffect('sherman', 5).outcome).toBe('IMMOBILIZED');
      expect(resolveDamageEffect('sherman', 7).outcome).toBe('CREW_CASUALTY');
      expect(resolveDamageEffect('sherman', 9).outcome).toBe('FIRE_STARTED');
      expect(resolveDamageEffect('sherman', 11).outcome).toBe('DESTROYED');
    });
  });
});

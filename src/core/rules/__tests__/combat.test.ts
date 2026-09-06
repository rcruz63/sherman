import { describe, it, expect } from 'vitest';
import {
  calculateHitDifficulty,
  resolveDamageCheck,
  resolveDamageEffect,
  resolveCrewCasualtyRoll,
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
    it('resolves NO_EFFECT when 1d6 is below (targetArmor - attackerPen)', () => {
      // 10 armor, 7 pen -> threshold is 3
      const result = resolveDamageCheck(7, 10, 2);
      expect(result.result).toBe('NO_EFFECT');
      expect(result.threshold).toBe(3);
      expect(result.roll).toBe(2);
    });

    it('resolves DAMAGED when 1d6 meets or exceeds threshold', () => {
      const resultEqual = resolveDamageCheck(7, 10, 3);
      expect(resultEqual.result).toBe('DAMAGED');
      expect(resultEqual.threshold).toBe(3);

      const resultExceed = resolveDamageCheck(7, 10, 6);
      expect(resultExceed.result).toBe('DAMAGED');
    });
  });

  describe('resolveDamageEffect', () => {
    it('resolves damage effects for German tanks correctly (1d6)', () => {
      expect(resolveDamageEffect('germanTank', 1).outcome).toBe('DAMAGED');
      expect(resolveDamageEffect('germanTank', 2).outcome).toBe('DAMAGED');
      expect(resolveDamageEffect('germanTank', 3).outcome).toBe('TURRET_DAMAGED');
      expect(resolveDamageEffect('germanTank', 4).outcome).toBe('TURRET_DAMAGED');
      expect(resolveDamageEffect('germanTank', 5).outcome).toBe('DESTROYED');
      expect(resolveDamageEffect('germanTank', 6).outcome).toBe('DESTROYED');
    });

    it('resolves damage effects for Sherman tank correctly (1d6)', () => {
      expect(resolveDamageEffect('sherman', 1).outcome).toBe('DESTROYED');
      expect(resolveDamageEffect('sherman', 2).outcome).toBe('CREW_CASUALTY');
      expect(resolveDamageEffect('sherman', 3).outcome).toBe('DAMAGED_FIRE');
      expect(resolveDamageEffect('sherman', 4).outcome).toBe('DAMAGED_FIRE');
      expect(resolveDamageEffect('sherman', 5).outcome).toBe('IMMOBILIZED');
      expect(resolveDamageEffect('sherman', 6).outcome).toBe('CREW_CASUALTY');
    });
  });

  describe('resolveCrewCasualtyRoll', () => {
    it('resolves roles 1-5 correctly regardless of hatch position', () => {
      expect(resolveCrewCasualtyRoll(1, false)?.role).toBe('commander');
      expect(resolveCrewCasualtyRoll(2, false)?.role).toBe('loader');
      expect(resolveCrewCasualtyRoll(3, false)?.role).toBe('gunner');
      expect(resolveCrewCasualtyRoll(4, false)?.role).toBe('driver');
      expect(resolveCrewCasualtyRoll(5, false)?.role).toBe('assistant');
    });

    it('resolves roll 6: casualty only if commander is hatched', () => {
      expect(resolveCrewCasualtyRoll(6, true)?.role).toBe('commander');
      expect(resolveCrewCasualtyRoll(6, false)).toBeNull();
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  calculateSectionDice,
  getAvailableDoubles,
  validateManeuverMove,
  executeMGAttack,
} from '../shermanOperations';
import {
  BoardState,
  ShermanState,
  HexTile,
  EnemyInfantry,
  EnemyTank,
  TurnPhase,
  CrewRole,
  CrewMember,
  TerrainType,
} from '../../../types/game';

function createMockCrew(overrides: Partial<Record<CrewRole, Partial<CrewMember>>> = {}): Record<CrewRole, CrewMember> {
  return {
    commander: { role: 'commander', name: 'Comandante', status: 'active', ...overrides.commander },
    loader: { role: 'loader', name: 'Cargador', status: 'active', ...overrides.loader },
    gunner: { role: 'gunner', name: 'Artillero', status: 'active', ...overrides.gunner },
    driver: { role: 'driver', name: 'Conductor', status: 'active', ...overrides.driver },
    assistant: { role: 'assistant', name: 'Asistente Conductor', status: 'active', ...overrides.assistant },
  };
}

function createMockShermanState(overrides: Partial<ShermanState> = {}): ShermanState {
  return {
    coord: { q: 0, r: 0 },
    facing: 0, // N
    crew: createMockCrew(),
    commanderPosition: 'hatched',
    isLoaded: true,
    isTurretDamaged: false,
    isImmobilized: false,
    fireLevel: 0,
    hasSmoke: true,
    isHullDown: false,
    armor: { D: 9, LD: 6, LT: 6, T: 5 },
    gunPenetration: 7,
    ...overrides,
  };
}

function createMockBoard(terrain: TerrainType = 'road', shermanOverrides: Partial<ShermanState> = {}): BoardState {
  const tiles = new Map<string, HexTile>();
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      tiles.set(`${q},${r}`, {
        coord: { q, r },
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });
    }
  }

  // Set sherman start tile terrain
  tiles.set('0,0', {
    coord: { q: 0, r: 0 },
    terrain,
    edges: ['none', 'none', 'none', 'none', 'none', 'none'],
  });

  return {
    currentTurn: 1,
    currentPhase: TurnPhase.SHERMAN_OPERATIONS,
    tiles,
    sherman: createMockShermanState(shermanOverrides),
    enemyTanks: [],
    enemyInfantry: [],
  };
}

describe('shermanOperations rules', () => {
  describe('calculateSectionDice', () => {
    describe('Maniobra (Maneuver)', () => {
      it('returns 0 if Sherman is immobilized', () => {
        const sherman = createMockShermanState({ isImmobilized: true });
        const res = calculateSectionDice('maneuver', 'road', sherman);
        expect(res.totalDice).toBe(0);
        expect(res.isImmobilized).toBe(true);
      });

      it('calculates Road base 2 + 3 crew bonus = 5 dice max', () => {
        const sherman = createMockShermanState();
        const res = calculateSectionDice('maneuver', 'road', sherman);
        expect(res.baseTerrainDice).toBe(2);
        expect(res.crewBonusDice).toBe(3); // driver + assistant + hatched commander
        expect(res.totalDice).toBe(5);
      });

      it('calculates Field base 1 + 3 crew bonus = 4 dice', () => {
        const sherman = createMockShermanState();
        const res = calculateSectionDice('maneuver', 'field', sherman);
        expect(res.baseTerrainDice).toBe(1);
        expect(res.totalDice).toBe(4);
      });

      it('calculates Mud base 0 + 3 crew bonus = 3 dice', () => {
        const sherman = createMockShermanState();
        const res = calculateSectionDice('maneuver', 'mud', sherman);
        expect(res.baseTerrainDice).toBe(0);
        expect(res.totalDice).toBe(3);
      });

      it('does not give commander bonus if commander is unhatched (interior)', () => {
        const sherman = createMockShermanState({ commanderPosition: 'unhatched' });
        const res = calculateSectionDice('maneuver', 'road', sherman);
        expect(res.crewBonusDice).toBe(2); // driver + assistant
        expect(res.totalDice).toBe(4);
      });

      it('does not give bonus for KIA driver or assistant', () => {
        const sherman = createMockShermanState({
          crew: createMockCrew({
            driver: { status: 'kia' },
            assistant: { status: 'kia' },
          }),
        });
        const res = calculateSectionDice('maneuver', 'road', sherman);
        expect(res.crewBonusDice).toBe(1); // commander only
        expect(res.totalDice).toBe(3);
      });
    });

    describe('Ataque (Attack)', () => {
      it('calculates Road/Field base 2 + gunner + loader + hatched commander = 5 dice', () => {
        const sherman = createMockShermanState();
        const resRoad = calculateSectionDice('attack', 'road', sherman);
        expect(resRoad.baseTerrainDice).toBe(2);
        expect(resRoad.crewBonusDice).toBe(3);
        expect(resRoad.totalDice).toBe(5);

        const resField = calculateSectionDice('attack', 'field', sherman);
        expect(resField.baseTerrainDice).toBe(2);
        expect(resField.totalDice).toBe(5);
      });

      it('calculates Mud base 1 + 3 crew bonus = 4 dice', () => {
        const sherman = createMockShermanState();
        const res = calculateSectionDice('attack', 'mud', sherman);
        expect(res.baseTerrainDice).toBe(1);
        expect(res.totalDice).toBe(4);
      });

      it('reduces bonus when gunner or loader is KIA', () => {
        const sherman = createMockShermanState({
          crew: createMockCrew({
            gunner: { status: 'kia' },
          }),
        });
        const res = calculateSectionDice('attack', 'road', sherman);
        expect(res.crewBonusDice).toBe(2); // loader + commander
        expect(res.totalDice).toBe(4);
      });
    });

    describe('Varios (Misc)', () => {
      it('calculates Campo base 2 + commander bonus = 3 dice max', () => {
        const sherman = createMockShermanState();
        const res = calculateSectionDice('misc', 'field', sherman);
        expect(res.baseTerrainDice).toBe(2);
        expect(res.crewBonusDice).toBe(1); // commander alive (interior or hatched)
        expect(res.totalDice).toBe(3);
      });

      it('calculates Carretera base 1 + commander bonus = 2 dice', () => {
        const sherman = createMockShermanState();
        const res = calculateSectionDice('misc', 'road', sherman);
        expect(res.baseTerrainDice).toBe(1);
        expect(res.crewBonusDice).toBe(1);
        expect(res.totalDice).toBe(2);
      });

      it('calculates base 2 with no bonus if commander is KIA on field', () => {
        const sherman = createMockShermanState({
          crew: createMockCrew({
            commander: { status: 'kia' },
          }),
        });
        const res = calculateSectionDice('misc', 'field', sherman);
        expect(res.baseTerrainDice).toBe(2);
        expect(res.crewBonusDice).toBe(0);
        expect(res.totalDice).toBe(2);
      });
    });
  });

  describe('getAvailableDoubles', () => {
    it('returns Conductor (Mover) and Asistente (Girar) for Maneuver when crew is active', () => {
      const sherman = createMockShermanState();
      const dice = [2, 2, 5];
      const doubles = getAvailableDoubles('maneuver', dice, sherman);
      expect(doubles.length).toBe(2);
      expect(doubles.some((d) => d.actionKey === 'double_move' && d.allowed)).toBe(true);
      expect(doubles.some((d) => d.actionKey === 'double_turn' && d.allowed)).toBe(true);
    });

    it('does not offer doubles if no pairs exist in available dice', () => {
      const sherman = createMockShermanState();
      const dice = [2, 3, 5];
      const doubles = getAvailableDoubles('maneuver', dice, sherman);
      expect(doubles.length).toBe(0);
    });

    it('returns Artillero (DCP) and Cargador (Cargar) for Attack', () => {
      const shermanLoaded = createMockShermanState({ isLoaded: true });
      const dice = [3, 3];
      const doublesLoaded = getAvailableDoubles('attack', dice, shermanLoaded);
      expect(doublesLoaded.length).toBe(2);
      const dcp = doublesLoaded.find((d) => d.actionKey === 'double_dcp');
      const load = doublesLoaded.find((d) => d.actionKey === 'double_load');
      expect(dcp?.allowed).toBe(true);
      expect(load?.allowed).toBe(false); // already loaded

      const shermanUnloaded = createMockShermanState({ isLoaded: false });
      const doublesUnloaded = getAvailableDoubles('attack', dice, shermanUnloaded);
      const dcp2 = doublesUnloaded.find((d) => d.actionKey === 'double_dcp');
      const load2 = doublesUnloaded.find((d) => d.actionKey === 'double_load');
      expect(dcp2?.allowed).toBe(false);
      expect(load2?.allowed).toBe(true);
    });

    it('returns Desenfilada for Misc section', () => {
      const sherman = createMockShermanState({ isHullDown: false, isImmobilized: false });
      const dice = [4, 4];
      const doubles = getAvailableDoubles('misc', dice, sherman);
      expect(doubles.length).toBe(1);
      expect(doubles[0].actionKey).toBe('double_hull_down');
      expect(doubles[0].allowed).toBe(true);
    });
  });

  describe('validateManeuverMove', () => {
    it('allows move forward into open field', () => {
      const board = createMockBoard('road');
      const res = validateManeuverMove(board, 'forward');
      expect(res.isValid).toBe(true);
    });

    it('blocks forward move into woods or water', () => {
      const board = createMockBoard('road');
      // Hex in front of (0,0) facing 0 (N) is (0, -1)
      board.tiles.set('0,-1', {
        coord: { q: 0, r: -1 },
        terrain: 'woods',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });
      const resWoods = validateManeuverMove(board, 'forward');
      expect(resWoods.isValid).toBe(false);
      expect(resWoods.reason).toContain('Bosque');

      board.tiles.set('0,-1', {
        coord: { q: 0, r: -1 },
        terrain: 'water',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });
      const resWater = validateManeuverMove(board, 'forward');
      expect(resWater.isValid).toBe(false);
      expect(resWater.reason).toContain('Agua');
    });

    it('blocks forward move into enemy-occupied hex', () => {
      const board = createMockBoard('road');
      board.enemyTanks.push({
        id: 'panzer-1',
        type: 'panzerIV',
        coord: { q: 0, r: -1 },
        facing: 3,
        armor: { D: 6, LD: 4, LT: 4, T: 4 },
        penetration: 6,
        size: 3,
        baseDice: 2,
        hasSmoke: false,
        isHullDown: false,
        status: 'operational',
      } as EnemyTank);

      const res = validateManeuverMove(board, 'forward');
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('ocupado');
    });

    it('validates reverse move correctly (opposite direction)', () => {
      const board = createMockBoard('road');
      // Hex behind (0,0) facing 0 (N) is facing 3 (S) -> (0, 1)
      board.tiles.set('0,1', {
        coord: { q: 0, r: 1 },
        terrain: 'woods',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });
      const res = validateManeuverMove(board, 'reverse');
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('Bosque');
    });
  });

  describe('executeMGAttack', () => {
    it('destroys adjacent infantry when 2d6 roll is >= 7', () => {
      const target: EnemyInfantry = {
        id: 'inf-1',
        type: 'infantry',
        coord: { q: 0, r: -1 }, // adjacent (distance 1)
        status: 'active',
      };

      const res = executeMGAttack({ q: 0, r: 0 }, target, [4, 3]);
      expect(res.success).toBe(true);
      expect(res.total).toBe(7);
      expect(res.detail).toContain('¡ELIMINADA!');
    });

    it('does not destroy adjacent infantry when 2d6 roll is < 7', () => {
      const target: EnemyInfantry = {
        id: 'inf-1',
        type: 'infantry',
        coord: { q: 0, r: -1 },
        status: 'active',
      };

      const res = executeMGAttack({ q: 0, r: 0 }, target, [3, 3]);
      expect(res.success).toBe(false);
      expect(res.total).toBe(6);
      expect(res.detail).toContain('FALLADO');
    });

    it('rejects MG attack against non-adjacent targets (distance > 1)', () => {
      const target: EnemyInfantry = {
        id: 'inf-1',
        type: 'infantry',
        coord: { q: 0, r: -2 }, // distance 2
        status: 'active',
      };

      const res = executeMGAttack({ q: 0, r: 0 }, target, [5, 5]);
      expect(res.success).toBe(false);
      expect(res.detail).toContain('adyacente');
    });
  });
});

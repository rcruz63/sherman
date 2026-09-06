import { describe, it, expect } from 'vitest';
import {
  calculateAITurningFacing,
  executeAITankTurn,
  getTankInitialState,
  runAllGermanActivations,
  GERMAN_OPERATIONS_TABLE,
} from '../germanAI';
import {
  BoardState,
  EnemyTank,
  HexTile,
  ShermanState,
  TurnPhase,
} from '../../../types/game';

function createMockSherman(overrides: Partial<ShermanState> = {}): ShermanState {
  return {
    coord: { q: 2, r: 4 },
    facing: 0,
    crew: {
      commander: { role: 'commander', name: 'Comandante', status: 'active' },
      loader: { role: 'loader', name: 'Cargador', status: 'active' },
      gunner: { role: 'gunner', name: 'Artillero', status: 'active' },
      driver: { role: 'driver', name: 'Conductor', status: 'active' },
      assistant: { role: 'assistant', name: 'Asistente Conductor', status: 'active' },
    },
    commanderPosition: 'interior' as any,
    isLoaded: true,
    isTurretDamaged: false,
    isImmobilized: false,
    fireLevel: 0,
    hasSmoke: false,
    isHullDown: false,
    armor: { D: 9, LD: 6, LT: 6, T: 5 },
    gunPenetration: 7,
    ...overrides,
  };
}

function createMockTank(id: string, overrides: Partial<EnemyTank> = {}): EnemyTank {
  return {
    id,
    type: 'panzerIV',
    coord: { q: 2, r: 1 },
    facing: 3, // Facing South towards Sherman at (2, 4)
    armor: { D: 6, LD: 4, LT: 4, T: 4 },
    penetration: 6,
    size: 3,
    baseDice: 2,
    hasSmoke: false,
    isHullDown: false,
    status: 'operational',
    ...overrides,
  };
}

function createMockBoard(): BoardState {
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
    currentTurn: 1,
    currentPhase: TurnPhase.GERMAN_OPERATIONS,
    tiles,
    sherman: createMockSherman(),
    enemyTanks: [],
    enemyInfantry: [],
  };
}

describe('Fase 6: Operaciones de Tanques Alemanes (germanAI)', () => {
  describe('Determinar dados y columna inicial (getTankInitialState)', () => {
    it('assigns 4 dice and ROAD column when tank starts on Road', () => {
      const board = createMockBoard();
      board.tiles.set('2,1', { coord: { q: 2, r: 1 }, terrain: 'road', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      const tank = createMockTank('t1');

      const info = getTankInitialState(tank, board);
      expect(info.column).toBe('ROAD');
      expect(info.diceCount).toBe(4);
    });

    it('assigns 4 dice and FIELD column when tank starts on Field', () => {
      const board = createMockBoard();
      const tank = createMockTank('t1');

      const info = getTankInitialState(tank, board);
      expect(info.column).toBe('FIELD');
      expect(info.diceCount).toBe(4);
    });

    it('assigns 3 dice and MUD column when tank starts on Mud', () => {
      const board = createMockBoard();
      board.tiles.set('2,1', { coord: { q: 2, r: 1 }, terrain: 'mud', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      const tank = createMockTank('t1');

      const info = getTankInitialState(tank, board);
      expect(info.column).toBe('MUD');
      expect(info.diceCount).toBe(3);
    });

    it('assigns 2 dice and DAMAGED column when tank is Damaged, regardless of terrain', () => {
      const board = createMockBoard();
      board.tiles.set('2,1', { coord: { q: 2, r: 1 }, terrain: 'road', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      const tank = createMockTank('t1', { status: 'damaged' });

      const info = getTankInitialState(tank, board);
      expect(info.column).toBe('DAMAGED');
      expect(info.diceCount).toBe(2);
    });
  });

  describe('Tabla de Operaciones Alemanas (Página 11)', () => {
    it('verifies exact primary and secondary actions across columns', () => {
      expect(GERMAN_OPERATIONS_TABLE.ROAD[1]).toEqual({ primary: 'DISPARAR', secondary: 'GIRAR' });
      expect(GERMAN_OPERATIONS_TABLE.ROAD[5]).toEqual({ primary: 'MOVER', secondary: 'RETROCEDER' });
      expect(GERMAN_OPERATIONS_TABLE.FIELD[4]).toEqual({ primary: 'GIRAR' });
      expect(GERMAN_OPERATIONS_TABLE.FIELD[6]).toEqual({ primary: 'DISPARAR', secondary: 'DESENFILADA' });
      expect(GERMAN_OPERATIONS_TABLE.MUD[1]).toEqual({ primary: 'DISPARAR' });
      expect(GERMAN_OPERATIONS_TABLE.MUD[6]).toEqual({ primary: 'HUMO' });
      expect(GERMAN_OPERATIONS_TABLE.DAMAGED[1]).toEqual({ primary: 'REPARAR' });
    });
  });

  describe('Reglas de Giro (Pages 13-14)', () => {
    it('Rule 1: turns to accessible hex if directly facing Sherman and front is blocked', () => {
      const board = createMockBoard();
      // Tank at (2,0) facing 3 (South). Front hex is (2,1).
      // Block (2,1) with Woods
      board.tiles.set('2,1', { coord: { q: 2, r: 1 }, terrain: 'woods', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      board.sherman.coord = { q: 2, r: 4 };
      const tank = createMockTank('t1', { coord: { q: 2, r: 0 }, facing: 3 });

      const nextFacing = calculateAITurningFacing(tank, board);
      // Front (3) is blocked, so it turns either to 2 or 4 (accessible hex)
      expect(nextFacing === 2 || nextFacing === 4).toBe(true);
    });

    it('Rule 2: turns to accessible hex if Sherman is in direct rear', () => {
      const board = createMockBoard();
      // Tank at (2,2) facing 0 (North). Sherman at (2,4) South (direct rear: facing 3)
      board.sherman.coord = { q: 2, r: 4 };
      const tank = createMockTank('t1', { coord: { q: 2, r: 2 }, facing: 0 });

      const nextFacing = calculateAITurningFacing(tank, board);
      expect(nextFacing === 1 || nextFacing === 5).toBe(true);
    });

    it('Rule 3: does NOT turn if directly facing Sherman and front hex is accessible', () => {
      const board = createMockBoard();
      board.sherman.coord = { q: 2, r: 4 };
      const tank = createMockTank('t1', { coord: { q: 2, r: 0 }, facing: 3 });

      const nextFacing = calculateAITurningFacing(tank, board);
      expect(nextFacing).toBe(3); // Maintains facing
    });

    it('Rule 4: turns towards Sherman by smallest angle when not in line', () => {
      const board = createMockBoard();
      board.sherman.coord = { q: 2, r: 4 };
      const tank = createMockTank('t1', { coord: { q: 2, r: 0 }, facing: 2 });

      const nextFacing = calculateAITurningFacing(tank, board);
      expect(nextFacing).toBe(3);
    });
  });

  describe('Resolución de acciones y fallbacks (executeAITankTurn)', () => {
    it('executes DISPARAR when LOS exists, does not use secondary', () => {
      const board = createMockBoard();
      const tank = createMockTank('t1', { coord: { q: 2, r: 1 }, facing: 3 });
      board.enemyTanks = [tank];

      // Die 1 on Field is DISPARAR > GIRAR
      const result = executeAITankTurn(tank, board, [1], {
        hitRoll: [1, 1], // miss
      });

      expect(result.actionTaken).toContain('DISPARAR');
      expect(result.actionTaken).not.toContain('GIRAR');
    });

    it('falls back to GIRAR when DISPARAR has no LOS (blocked by woods)', () => {
      const board = createMockBoard();
      // Put woods between tank at (2,1) and Sherman at (2,4)
      board.tiles.set('2,2', { coord: { q: 2, r: 2 }, terrain: 'woods', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      const tank = createMockTank('t1', { coord: { q: 2, r: 1 }, facing: 2 });
      board.enemyTanks = [tank];

      // Die 1 on Field is DISPARAR > GIRAR
      const result = executeAITankTurn(tank, board, [1]);
      expect(result.actionTaken).toContain('GIRAR');
    });

    it('moves forward and cancels Hull Down', () => {
      const board = createMockBoard();
      const tank = createMockTank('t1', { coord: { q: 2, r: 1 }, facing: 3, isHullDown: true });
      board.enemyTanks = [tank];

      // Die 5 on Road is MOVER > RETROCEDER
      executeAITankTurn(tank, board, [5]);
      expect(tank.coord).toEqual({ q: 2, r: 2 });
      expect(tank.isHullDown).toBe(false);
    });

    it('falls back to RETROCEDER when MOVER is blocked by water', () => {
      const board = createMockBoard();
      // Front of (2,1) facing 3 is (2,2) -> set water
      board.tiles.set('2,2', { coord: { q: 2, r: 2 }, terrain: 'water', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      const tank = createMockTank('t1', { coord: { q: 2, r: 1 }, facing: 3, isHullDown: true });
      board.enemyTanks = [tank];

      // Die 5 on Road is MOVER > RETROCEDER
      executeAITankTurn(tank, board, [5]);
      // Rear of (2,1) facing 3 is (2,0)
      expect(tank.coord).toEqual({ q: 2, r: 0 });
      expect(tank.isHullDown).toBe(false);
    });

    it('adopts DESENFILADA (Hull Down) on Campo die 6 when no LOS', () => {
      const board = createMockBoard();
      board.tiles.set('2,2', { coord: { q: 2, r: 2 }, terrain: 'woods', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      const tank = createMockTank('t1', { coord: { q: 2, r: 1 }, facing: 3, isHullDown: false });
      board.enemyTanks = [tank];

      // Campo die 6 is DISPARAR > DESENFILADA
      executeAITankTurn(tank, board, [6]);
      expect(tank.isHullDown).toBe(true);
    });

    it('deploys HUMO on Mud die 6', () => {
      const board = createMockBoard();
      board.tiles.set('2,1', { coord: { q: 2, r: 1 }, terrain: 'mud', edges: ['none', 'none', 'none', 'none', 'none', 'none'] });
      const tank = createMockTank('t1', { coord: { q: 2, r: 1 }, facing: 3, hasSmoke: false });
      board.enemyTanks = [tank];

      executeAITankTurn(tank, board, [6]);
      expect(tank.hasSmoke).toBe(true);
    });

    it('repairs damaged tank on Damaged die 1', () => {
      const board = createMockBoard();
      const tank = createMockTank('t1', { status: 'damaged' });
      board.enemyTanks = [tank];

      executeAITankTurn(tank, board, [1]);
      expect(tank.status).toBe('operational');
    });

    it('stops firing when Sherman is destroyed', () => {
      const board = createMockBoard();
      const tank = createMockTank('t1', { coord: { q: 2, r: 1 }, facing: 3, penetration: 10 });
      board.enemyTanks = [tank];

      // Rolls: [1, 3] both have DISPARAR
      executeAITankTurn(tank, board, [1, 3], {
        hitRoll: [6, 6], // hit!
        dmgRoll: 6,     // damage!
        effectRoll: 1,  // 1: Sherman Destroyed!
      });

      expect(board.sherman.isDestroyed).toBe(true);
    });
  });

  describe('Orden de activación por proximidad (runAllGermanActivations)', () => {
    it('activates closest tank first', () => {
      const board = createMockBoard();
      // Sherman at (2,4)
      // Tank 1 at (2,0) -> distance 4
      // Tank 2 at (2,3) -> distance 1 (closest!)
      const tankFar = createMockTank('far', { coord: { q: 2, r: 0 } });
      const tankClose = createMockTank('close', { coord: { q: 2, r: 3 } });
      board.enemyTanks = [tankFar, tankClose];

      const results = runAllGermanActivations(board);
      expect(results[0].tankId).toBe('close');
      expect(results[1].tankId).toBe('far');
    });

    it('skips destroyed tanks', () => {
      const board = createMockBoard();
      const tankDead = createMockTank('dead', { status: 'destroyed' });
      const tankAlive = createMockTank('alive', { coord: { q: 2, r: 0 }, status: 'operational' });
      board.enemyTanks = [tankDead, tankAlive];

      const results = runAllGermanActivations(board);
      expect(results.length).toBe(1);
      expect(results[0].tankId).toBe('alive');
    });
  });
});

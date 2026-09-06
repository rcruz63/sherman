import { describe, it, expect } from 'vitest';
import {
  handleSpawnInfantryEvent,
  handleInfantryAttackEvent,
  handleSniperEvent,
  handleMinesEvent,
  handleStukaEvent,
  handleCommanderOrderEvent,
  handleMechanicalFailureEvent,
  handleSpawnTankEvent,
} from '../eventHandlers';
import { executePhase7 } from '../turnManager';
import { loadMissionState } from '../missionLoader';
import mission1Raw from '../../../data/missions/mission1.json';
import {
  BoardState,
  HexTile,
  MissionJSON,
  ShermanState,
  TurnPhase,
} from '../../../types/game';

const mission1 = mission1Raw as MissionJSON;

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
    commanderPosition: 'unhatched', // Interior
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

function createMockBoard(shermanOverrides: Partial<ShermanState> = {}): BoardState {
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
    currentPhase: TurnPhase.END_TURN_EVENTS,
    tiles,
    sherman: createMockSherman(shermanOverrides),
    enemyTanks: [],
    enemyInfantry: [],
  };
}

describe('Fase 7: Eventos de Fin de Turno (eventHandlers)', () => {
  describe('Infantería Alemana (Aparición / Refuerzos)', () => {
    it('spawns infantry on matching red spot', () => {
      const board = createMockBoard();
      board.tiles.set('1,1', {
        coord: { q: 1, r: 1 },
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        redSpawnNumber: 3,
      });

      const res = handleSpawnInfantryEvent(board, 3);
      expect(res.spawned).toBe(true);
      expect(board.enemyInfantry).toHaveLength(1);
      expect(board.enemyInfantry[0].coord).toEqual({ q: 1, r: 1 });
    });

    it('cancels spawn if red hex is occupied by Sherman', () => {
      const board = createMockBoard();
      board.tiles.set('2,4', {
        coord: { q: 2, r: 4 }, // Sherman is here!
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        redSpawnNumber: 2,
      });

      const res = handleSpawnInfantryEvent(board, 2);
      expect(res.spawned).toBe(false);
      expect(board.enemyInfantry).toHaveLength(0);
      expect(res.detail).toContain('ocupado por el Sherman');
    });

    it('cancels spawn if red hex already contains active infantry', () => {
      const board = createMockBoard();
      board.tiles.set('1,1', {
        coord: { q: 1, r: 1 },
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        redSpawnNumber: 4,
      });
      board.enemyInfantry = [
        { id: 'inf-1', type: 'infantry', status: 'active', coord: { q: 1, r: 1 } },
      ];

      const res = handleSpawnInfantryEvent(board, 4);
      expect(res.spawned).toBe(false);
      expect(board.enemyInfantry).toHaveLength(1); // unchanged
      expect(res.detail).toContain('ya contiene infantería');
    });
  });

  describe('Ataque de Infantería Alemana', () => {
    it('attacks if infantry is adjacent (dist 1), ignores non-adjacent', () => {
      const board = createMockBoard();
      // Sherman at (2,4). Adjacent: (2,3) distance 1. Far: (2,1) distance 3.
      board.enemyInfantry = [
        { id: 'adj', type: 'infantry', status: 'active', coord: { q: 2, r: 3 } },
        { id: 'far', type: 'infantry', status: 'active', coord: { q: 2, r: 1 } },
      ];

      const res = handleInfantryAttackEvent(board, {
        hitRolls: [[1, 1]], // miss
      });

      expect(res.attacksCount).toBe(1);
      expect(res.detail).toContain('Infantería (2,3) ataca');
      expect(res.detail).not.toContain('Infantería (2,1)');
    });

    it('infantry hit with Pen 1 damages Sherman and applies consequence', () => {
      const board = createMockBoard({ facing: 3 }); // facing away, so infantry hits Rear (BL 5)
      board.enemyInfantry = [
        { id: 'adj', type: 'infantry', status: 'active', coord: { q: 2, r: 3 } },
      ];

      const res = handleInfantryAttackEvent(board, {
        hitRolls: [[6, 6]], // hit!
        dmgRolls: [6],      // damage!
        effectRolls: [5],   // 5: Turret damaged
      });

      expect(res.hitsCount).toBe(1);
      expect(res.damageInflicted).toBe(true);
      expect(board.sherman.isTurretDamaged).toBe(true);
    });
  });

  describe('Francotirador (Sniper)', () => {
    it('kills Commander if Hatched and in LOS of German infantry', () => {
      const board = createMockBoard({ commanderPosition: 'hatched' });
      // Clear LOS between (2,4) and (2,2)
      board.enemyInfantry = [
        { id: 'inf-1', type: 'infantry', status: 'active', coord: { q: 2, r: 2 } },
      ];

      const res = handleSniperEvent(board);
      expect(res.killed).toBe(true);
      expect(board.sherman.crew.commander.status).toBe('kia');
    });

    it('does NOT kill Commander if in Interior (unhatched)', () => {
      const board = createMockBoard({ commanderPosition: 'unhatched' });
      board.enemyInfantry = [
        { id: 'inf-1', type: 'infantry', status: 'active', coord: { q: 2, r: 2 } },
      ];

      const res = handleSniperEvent(board);
      expect(res.killed).toBe(false);
      expect(board.sherman.crew.commander.status).toBe('active');
    });

    it('does NOT kill Commander if LOS is blocked by woods', () => {
      const board = createMockBoard({ commanderPosition: 'hatched' });
      // Block LOS with woods at (2,3)
      board.tiles.set('2,3', {
        coord: { q: 2, r: 3 },
        terrain: 'woods',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });
      board.enemyInfantry = [
        { id: 'inf-1', type: 'infantry', status: 'active', coord: { q: 2, r: 2 } },
      ];

      const res = handleSniperEvent(board);
      expect(res.killed).toBe(false);
      expect(board.sherman.crew.commander.status).toBe('active');
    });
  });

  describe('¡Minas! (Mines)', () => {
    it('damages and immobilizes Sherman on road when 1d6 >= 4', () => {
      const board = createMockBoard({ isImmobilized: false, isHullDown: true });
      board.tiles.set('2,4', {
        coord: { q: 2, r: 4 },
        terrain: 'road',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });

      const res = handleMinesEvent(board, 5); // 5 >= 4
      expect(res.affected).toBe(true);
      expect(board.sherman.isImmobilized).toBe(true);
      expect(board.sherman.isHullDown).toBe(false);
    });

    it('does nothing if Sherman is not on a road', () => {
      const board = createMockBoard();
      // Hex (2,4) is field
      const res = handleMinesEvent(board, 6);
      expect(res.affected).toBe(false);
      expect(board.sherman.isImmobilized).toBe(false);
    });

    it('does nothing if Sherman is already immobilized', () => {
      const board = createMockBoard({ isImmobilized: true });
      board.tiles.set('2,4', {
        coord: { q: 2, r: 4 },
        terrain: 'road',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
      });

      const res = handleMinesEvent(board, 6);
      expect(res.affected).toBe(false);
      expect(res.detail).toContain('ya se encuentra Inmovilizado');
    });
  });

  describe('Stuka (Ataque Aéreo)', () => {
    it('shoots down Stuka if Commander is Hatched and 2d6 >= 6', () => {
      const board = createMockBoard({ commanderPosition: 'hatched' });

      const res = handleStukaEvent(board, {
        aaRoll: [3, 4], // 7 >= 6 -> Shot down!
      });

      expect(res.shotDown).toBe(true);
      expect(res.hit).toBe(false);
      expect(res.detail).toContain('STUKA DERRIBADO');
    });

    it('Stuka impacts with 8+ if AA fails or Commander Interior, and damages with Pen 1 vs BL 4', () => {
      const board = createMockBoard({ commanderPosition: 'unhatched' });

      const res = handleStukaEvent(board, {
        bombRoll: [5, 4], // 9 >= 8 -> Hit!
        dmgRoll: 4,      // 4 >= 3 -> Damage!
        effectRoll: 3,   // 3: Fire level +1
      });

      expect(res.shotDown).toBe(false);
      expect(res.hit).toBe(true);
      expect(res.damaged).toBe(true);
      expect(board.sherman.fireLevel).toBe(1);
    });

    it('Stuka misses if bomb roll < 8', () => {
      const board = createMockBoard({ commanderPosition: 'unhatched' });

      const res = handleStukaEvent(board, {
        bombRoll: [3, 3], // 6 < 8 -> Miss!
      });

      expect(res.hit).toBe(false);
      expect(res.detail).toContain('fallan el blanco');
    });
  });

  describe('Orden del Comandante (Commander Order)', () => {
    it('executes free EXTINGUISH when fire > 0', () => {
      const board = createMockBoard({ fireLevel: 2 });
      const res = handleCommanderOrderEvent(board);
      expect(res.executed).toBe(true);
      expect(res.actionDone).toBe('EXTINGUISH');
      expect(board.sherman.fireLevel).toBe(1);
    });

    it('executes free REPAIR when turret is damaged', () => {
      const board = createMockBoard({ isTurretDamaged: true });
      const res = handleCommanderOrderEvent(board);
      expect(res.executed).toBe(true);
      expect(res.actionDone).toBe('REPAIR');
      expect(board.sherman.isTurretDamaged).toBe(false);
    });

    it('executes free LOAD when cannon is empty', () => {
      const board = createMockBoard({ isLoaded: false });
      const res = handleCommanderOrderEvent(board);
      expect(res.executed).toBe(true);
      expect(res.actionDone).toBe('LOAD');
      expect(board.sherman.isLoaded).toBe(true);
    });

    it('does nothing if Commander is KIA', () => {
      const board = createMockBoard();
      board.sherman.crew.commander.status = 'kia';
      const res = handleCommanderOrderEvent(board);
      expect(res.executed).toBe(false);
      expect(res.detail).toContain('KIA');
    });
  });

  describe('Fallo Mecánico (Mechanical Failure)', () => {
    it('immobilizes Sherman and removes Hull Down', () => {
      const board = createMockBoard({ isImmobilized: false, isHullDown: true });
      const res = handleMechanicalFailureEvent(board);
      expect(res.affected).toBe(true);
      expect(board.sherman.isImmobilized).toBe(true);
      expect(board.sherman.isHullDown).toBe(false);
    });
  });

  describe('Refuerzo de Tanque (Panzer III / IV)', () => {
    it('spawns Panzer III on matching black spot', () => {
      const board = createMockBoard();
      board.tiles.set('0,2', {
        coord: { q: 0, r: 2 },
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        blackSpawnNumber: 5,
        blackSpawnFacing: 2,
      });

      const res = handleSpawnTankEvent(board, 'panzerIII', 5);
      expect(res.spawned).toBe(true);
      expect(board.enemyTanks).toHaveLength(1);
      expect(board.enemyTanks[0].type).toBe('panzerIII');
      expect(board.enemyTanks[0].coord).toEqual({ q: 0, r: 2 });
      expect(board.enemyTanks[0].facing).toBe(2);
    });

    it('discards reinforcement if black spot is already occupied by a tank', () => {
      const board = createMockBoard();
      board.tiles.set('0,2', {
        coord: { q: 0, r: 2 },
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        blackSpawnNumber: 5,
      });
      board.enemyTanks = [
        {
          id: 'existing',
          type: 'tiger',
          coord: { q: 0, r: 2 },
          facing: 1,
          armor: { D: 9, LD: 7, LT: 7, T: 6 },
          penetration: 8,
          size: 2,
          baseDice: 2,
          hasSmoke: false,
          isHullDown: false,
          status: 'operational',
        },
      ];

      const res = handleSpawnTankEvent(board, 'panzerIII', 5);
      expect(res.spawned).toBe(false);
      expect(board.enemyTanks).toHaveLength(1);
      expect(res.detail).toContain('ya contiene un tanque');
    });
  });

  describe('Integración executePhase7 con tabla de Misión 1', () => {
    it('resolves roll 4 (COMMANDER_ORDER)', () => {
      const board = loadMissionState(mission1);
      board.sherman.fireLevel = 1;

      const log = executePhase7(board, 4);
      expect(log).toContain('COMMANDER_ORDER');
      expect(board.sherman.fireLevel).toBe(0);
      expect(board.currentTurn).toBe(2);
      expect(board.currentPhase).toBe(TurnPhase.SHERMAN_SMOKE_CLEANUP);
    });

    it('resolves roll 9 (MECHANICAL_FAILURE)', () => {
      const board = loadMissionState(mission1);
      board.sherman.isImmobilized = false;

      const log = executePhase7(board, 9);
      expect(log).toContain('MECHANICAL_FAILURE');
      expect(board.sherman.isImmobilized).toBe(true);
      expect(board.currentTurn).toBe(2);
    });
  });
});

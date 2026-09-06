import { describe, it, expect } from 'vitest';
import { checkLOS } from '../los';
import { BoardState, HexTile } from '../../../types/game';

function createMockBoardState(terrainMap: Record<string, HexTile['terrain']> = {}): BoardState {
  const tiles = new Map<string, HexTile>();

  // Generate range -5 to 5
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      const key = `${q},${r}`;
      const terrain = terrainMap[key] || 'field';
      tiles.set(key, {
        coord: { q, r },
        terrain,
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

describe('Line of Sight (LOS) Engine', () => {
  it('returns CLEAR LOS over open field in straight line', () => {
    const board = createMockBoardState();
    const result = checkLOS({ q: 0, r: 0 }, { q: 0, r: -4 }, board);

    expect(result.hasLOS).toBe(true);
    expect(result.reason).toBe('CLEAR');
    expect(result.distance).toBe(4);
    expect(result.direction).toBe(0);
  });

  it('rejects LOS for targets not along 6 hex straight lines', () => {
    const board = createMockBoardState();
    const result = checkLOS({ q: 0, r: 0 }, { q: 1, r: 2 }, board);

    expect(result.hasLOS).toBe(false);
    expect(result.reason).toBe('NOT_STRAIGHT_LINE');
    expect(result.direction).toBeNull();
  });

  it('blocks LOS if intermediate hex contains Woods', () => {
    const board = createMockBoardState({
      '0,-2': 'woods', // Intermediate obstacle
    });

    const result = checkLOS({ q: 0, r: 0 }, { q: 0, r: -4 }, board);

    expect(result.hasLOS).toBe(false);
    expect(result.reason).toBe('BLOCKED_BY_OBSTACLE');
    expect(result.blockingCoord).toEqual({ q: 0, r: -2 });
  });

  it('blocks LOS if intermediate hex contains Building', () => {
    const board = createMockBoardState({
      '0,2': 'building', // Intermediate obstacle
    });

    const result = checkLOS({ q: 0, r: 0 }, { q: 0, r: 4 }, board);

    expect(result.hasLOS).toBe(false);
    expect(result.reason).toBe('BLOCKED_BY_OBSTACLE');
    expect(result.blockingCoord).toEqual({ q: 0, r: 2 });
  });

  it('allows LOS TO a target inside Woods or Building (does not block vision TO target)', () => {
    const board = createMockBoardState({
      '0,-4': 'woods', // Target itself is in woods
    });

    const result = checkLOS({ q: 0, r: 0 }, { q: 0, r: -4 }, board);

    expect(result.hasLOS).toBe(true);
    expect(result.reason).toBe('CLEAR');
  });

  it('counts tree lines crossed along intermediate hex edges', () => {
    const board = createMockBoardState();
    // Add treeline to edge of hex (0,-2) in dir 0 (North)
    const tile0_2 = board.tiles.get('0,-2')!;
    tile0_2.edges[0] = 'treeline';

    const result = checkLOS({ q: 0, r: 0 }, { q: 0, r: -4 }, board);

    expect(result.hasLOS).toBe(true);
    expect(result.treeLineCount).toBe(1);
  });
});

/**
 * Hexagonal Grid Mathematics & Utility Functions
 */

import { AxialCoord, CubeCoord, Facing } from '../../types/game';

/**
 * 6 Axial Direction Vectors for flat-topped hex grids
 * 0: Norte (N)      - q:  0, r: -1
 * 1: Noreste (NE)   - q: +1, r: -1
 * 2: Sureste (SE)   - q: +1, r:  0
 * 3: Sur (S)        - q:  0, r: +1
 * 4: Suroeste (SO)  - q: -1, r: +1
 * 5: Noroeste (NO)  - q: -1, r:  0
 */
export const AXIAL_DIRECTIONS: readonly AxialCoord[] = [
  { q: 0, r: -1 },  // 0: N
  { q: 1, r: -1 },  // 1: NE
  { q: 1, r: 0 },   // 2: SE
  { q: 0, r: 1 },   // 3: S
  { q: -1, r: 1 },  // 4: SW
  { q: -1, r: 0 },  // 5: NW
];

export function coordKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

export function keyToCoord(key: string): AxialCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function axialToCube(axial: AxialCoord): CubeCoord {
  return {
    x: axial.q,
    z: axial.r,
    y: -axial.q - axial.r,
  };
}

export function cubeToAxial(cube: CubeCoord): AxialCoord {
  return {
    q: cube.x,
    r: cube.z,
  };
}

export const COLUMN_Y_OFFSETS = [0.0, -0.5, -1.0, -0.5, 0.0, 0.5];

export function getColOffset(col: number): number {
  if (col >= 0 && col <= 5) {
    return COLUMN_Y_OFFSETS[col];
  }
  if (col === -1) return 0.5;
  if (col === -2) return 0.0;
  if (col === -3) return -0.5;
  if (col === -4) return -1.0;
  if (col === -5) return -0.5;
  return 0;
}

export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const offsetA = getColOffset(a.q);
  const offsetB = getColOffset(b.q);

  const colDiff = Math.abs(b.q - a.q);
  const yDiff = Math.abs(2 * (a.r + offsetA) - 2 * (b.r + offsetB));

  if (yDiff <= colDiff) {
    return colDiff;
  } else {
    return colDiff + Math.round((yDiff - colDiff) / 2);
  }
}

export function getAxialDirectionVector(dir: Facing): AxialCoord {
  return AXIAL_DIRECTIONS[dir];
}

export function hexNeighbor(coord: AxialCoord, dir: Facing): AxialCoord {
  const c = coord.q;
  const r = coord.r;

  if (dir === 0) return { q: c, r: r - 1 }; // N
  if (dir === 3) return { q: c, r: r + 1 }; // S

  const cNew = dir === 1 || dir === 2 ? c + 1 : c - 1;
  const deltaY = dir === 1 || dir === 5 ? -0.5 : 0.5;

  const currentOffset = getColOffset(c);
  const newOffset = getColOffset(cNew);

  const rNew = Math.round(r + currentOffset + deltaY - newOffset);
  return { q: cNew, r: rNew };
}

/**
 * Returns direction index (0..5) if `to` is in a straight hex line from `from`.
 * Returns null if not in a straight line along the 6 hex axes.
 */
export function getDirectionBetween(from: AxialCoord, to: AxialCoord): Facing | null {
  if (from.q === to.q && from.r === to.r) return null;

  const pFrom = axialToPixelFlat(from, 20);
  const pTo = axialToPixelFlat(to, 20);

  const dx = pTo.x - pFrom.x;
  const dy = pTo.y - pFrom.y;

  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return null;

  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;

  const sector = Math.round(angle / (Math.PI / 3)) % 6;

  let check = { ...from };
  const maxSteps = Math.max(Math.abs(to.q - from.q), Math.abs(to.r - from.r)) + 2;

  for (let i = 0; i < maxSteps; i++) {
    check = hexNeighbor(check, sector as Facing);
    if (check.q === to.q && check.r === to.r) {
      return sector as Facing;
    }
  }

  return null;
}

/**
 * Converts axial coordinates to 2D pixel coordinates for flat-topped hexes
 * applying column staggering offsets:
 * Col 0: 0.0, Col 1: -0.5, Col 2: -1.0, Col 3: -0.5, Col 4: 0.0, Col 5: +0.5
 */
export function axialToPixelFlat(coord: AxialCoord, radius: number): { x: number; y: number } {
  const col = coord.q;
  const row = coord.r;
  const offset = getColOffset(col);

  const x = radius * 1.5 * col;
  const y = radius * Math.sqrt(3) * (row + offset);
  return { x, y };
}

/**
 * Converts axial coordinates to 2D pixel coordinates for pointy-topped hexes.
 */
export function axialToPixelPointy(coord: AxialCoord, radius: number): { x: number; y: number } {
  const x = radius * Math.sqrt(3) * (coord.q + coord.r / 2);
  const y = radius * (3 / 2) * coord.r;
  return { x, y };
}

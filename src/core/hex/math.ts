/**
 * Hexagonal Grid Mathematics & Utility Functions
 */

import { AxialCoord, CubeCoord, Facing } from '../../types/game';

/**
 * 6 Axial Direction Vectors for standard hex grids
 * 0: +q,  0 (East / 3 o'clock)
 * 1:  0, +r (South-East / 5 o'clock)
 * 2: -q, +r (South-West / 7 o'clock)
 * 3: -q,  0 (West / 9 o'clock)
 * 4:  0, -r (North-West / 11 o'clock)
 * 5: +q, -r (North-East / 1 o'clock)
 */
export const AXIAL_DIRECTIONS: readonly AxialCoord[] = [
  { q: 1, r: 0 },   // 0
  { q: 0, r: 1 },   // 1
  { q: -1, r: 1 },  // 2
  { q: -1, r: 0 },  // 3
  { q: 0, r: -1 },  // 4
  { q: 1, r: -1 },  // 5
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

export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
}

export function getAxialDirectionVector(dir: Facing): AxialCoord {
  return AXIAL_DIRECTIONS[dir];
}

export function hexNeighbor(coord: AxialCoord, dir: Facing): AxialCoord {
  const vec = getAxialDirectionVector(dir);
  return {
    q: coord.q + vec.q,
    r: coord.r + vec.r,
  };
}

/**
 * Returns direction index (0..5) if `to` is in a straight hex line from `from`.
 * Returns null if not in a straight line along the 6 hex axes.
 */
export function getDirectionBetween(from: AxialCoord, to: AxialCoord): Facing | null {
  const dq = to.q - from.q;
  const dr = to.r - from.r;

  if (dq === 0 && dr === 0) return null;

  if (dr === 0 && dq > 0) return 0;
  if (dq === 0 && dr > 0) return 1;
  if (dq < 0 && dr > 0 && dq === -dr) return 2;
  if (dr === 0 && dq < 0) return 3;
  if (dq === 0 && dr < 0) return 4;
  if (dq > 0 && dr < 0 && dq === -dr) return 5;

  return null;
}

/**
 * Converts axial coordinates to 2D pixel coordinates for flat-topped hexes.
 */
export function axialToPixelFlat(coord: AxialCoord, radius: number): { x: number; y: number } {
  const x = radius * (3 / 2) * coord.q;
  const y = radius * Math.sqrt(3) * (coord.r + coord.q / 2);
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

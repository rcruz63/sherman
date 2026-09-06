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

  if (dq === 0 && dr < 0) return 0; // N
  if (dq > 0 && dr < 0 && dq === -dr) return 1; // NE
  if (dq > 0 && dr === 0) return 2; // SE
  if (dq === 0 && dr > 0) return 3; // S
  if (dq < 0 && dr > 0 && dq === -dr) return 4; // SW
  if (dq < 0 && dr === 0) return 5; // NW

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

import { describe, it, expect } from 'vitest';
import {
  axialToCube,
  cubeToAxial,
  hexDistance,
  getDirectionBetween,
  axialToPixelFlat,
  axialToPixelPointy,
  coordKey,
  keyToCoord,
} from '../math';

describe('Hexagonal Math Engine', () => {
  it('converts between axial and cube coordinates correctly', () => {
    const axial = { q: 2, r: -3 };
    const cube = axialToCube(axial);
    expect(cube).toEqual({ x: 2, y: 1, z: -3 });
    expect(cube.x + cube.y + cube.z).toBe(0);

    const backToAxial = cubeToAxial(cube);
    expect(backToAxial).toEqual(axial);
  });

  it('serializes and deserializes coordinate keys', () => {
    const coord = { q: -5, r: 12 };
    const key = coordKey(coord);
    expect(key).toBe('-5,12');
    expect(keyToCoord(key)).toEqual(coord);
  });

  it('calculates distance between hexes correctly', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 5 })).toBe(5);
    expect(hexDistance({ q: 5, r: 4 }, { q: 0, r: 2 })).toBe(5);
  });

  it('identifies straight lines along the 6 flat-topped hex directions', () => {
    const origin = { q: 0, r: 0 };

    // Dir 0: Norte (0, -r)
    expect(getDirectionBetween(origin, { q: 0, r: -3 })).toBe(0);
    // Dir 1: Noreste (+q, -r)
    expect(getDirectionBetween(origin, { q: 3, r: -1 })).toBe(1);
    // Dir 2: Sureste (+q, +r)
    expect(getDirectionBetween(origin, { q: 3, r: 2 })).toBe(2);
    // Dir 3: Sur (0, +r)
    expect(getDirectionBetween(origin, { q: 0, r: 3 })).toBe(3);
    // Dir 4: Suroeste (-q, +r)
    expect(getDirectionBetween(origin, { q: -3, r: 2 })).toBe(4);
    // Dir 5: Noroeste (-q, -r)
    expect(getDirectionBetween(origin, { q: -3, r: -1 })).toBe(5);

    // Non-straight lines
    expect(getDirectionBetween(origin, { q: 1, r: 2 })).toBeNull();
    expect(getDirectionBetween(origin, { q: 2, r: 3 })).toBeNull();
  });

  it('converts axial coordinates to 2D pixel coordinates with flat-topped column stagger', () => {
    const flatPixel = axialToPixelFlat({ q: 2, r: 1 }, 20);
    expect(flatPixel.x).toBeCloseTo(60);
    expect(flatPixel.y).toBeCloseTo(0, 2); // col 2 offset is -1.0 -> y = 20 * sqrt(3) * (1 - 1.0) = 0

    const pointyPixel = axialToPixelPointy({ q: 1, r: 2 }, 20);
    expect(pointyPixel.x).toBeCloseTo(69.282, 2);
    expect(pointyPixel.y).toBeCloseTo(60);
  });
});

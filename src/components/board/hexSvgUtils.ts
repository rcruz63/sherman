/**
 * SVG Hexagon rendering utilities for flat-topped orientation
 */

import { AxialCoord, Facing } from '../../types/game';
import { axialToPixelFlat } from '../../core/hex/math';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculates center (cx, cy) for a flat-topped hex given radius R and axial coords (q, r)
 */
export function getHexCenter(coord: AxialCoord, radius: number): Point2D {
  return axialToPixelFlat(coord, radius);
}

/**
 * Returns array of 6 corner points for a flat-topped hexagon
 * Corners at 0°, 60°, 120°, 180°, 240°, 300°
 * Corner 0: (R, 0) - Right/East
 * Corner 1: (R/2, sqrt(3)/2*R) - Bottom-Right/SE
 * Corner 2: (-R/2, sqrt(3)/2*R) - Bottom-Left/SW
 * Corner 3: (-R, 0) - Left/West
 * Corner 4: (-R/2, -sqrt(3)/2*R) - Top-Left/NW
 * Corner 5: (R/2, -sqrt(3)/2*R) - Top-Right/NE
 */
export function getHexCorners(center: Point2D, radius: number): Point2D[] {
  const corners: Point2D[] = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (i * 60);
    corners.push({
      x: center.x + radius * Math.cos(angleRad),
      y: center.y + radius * Math.sin(angleRad),
    });
  }
  return corners;
}

/**
 * Converts corners array to SVG polygon points string
 */
export function cornersToPolygonPoints(corners: Point2D[]): string {
  return corners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/**
 * Returns endpoints for an edge (0..5) of a flat-topped hex
 * Edge 0 (N): corners 4 & 5
 * Edge 1 (NE): corners 5 & 0
 * Edge 2 (SE): corners 0 & 1
 * Edge 3 (S): corners 1 & 2
 * Edge 4 (SW): corners 2 & 3
 * Edge 5 (NW): corners 3 & 4
 */
export function getHexEdgeEndpoints(corners: Point2D[], edgeIndex: Facing): { p1: Point2D; p2: Point2D } {
  const p1 = corners[(edgeIndex + 4) % 6];
  const p2 = corners[(edgeIndex + 5) % 6];
  return { p1, p2 };
}

/**
 * Returns rotation angle in degrees for tank unit facing direction (0..5)
 * for flat-topped hexes (pointing perpendicular to hex edges):
 * 0: N (270° - Top edge), 1: NE (330° - Top-Right edge), 2: SE (30° - Bottom-Right edge),
 * 3: S (90° - Bottom edge), 4: SW (150° - Bottom-Left edge), 5: NW (210° - Top-Left edge)
 */
export function getFacingAngleDegrees(facing: Facing): number {
  return (270 + facing * 60) % 360;
}

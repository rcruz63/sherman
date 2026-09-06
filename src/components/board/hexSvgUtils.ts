/**
 * SVG Hexagon rendering utilities for pointy-topped orientation
 */

import { AxialCoord, Facing } from '../../types/game';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculates center (cx, cy) for a pointy-topped hex given radius R and axial coords (q, r)
 */
export function getHexCenter(coord: AxialCoord, radius: number): Point2D {
  const x = radius * Math.sqrt(3) * (coord.q + coord.r / 2);
  const y = radius * (3 / 2) * coord.r;
  return { x, y };
}

/**
 * Returns array of 6 corner points for a pointy-topped hexagon
 */
export function getHexCorners(center: Point2D, radius: number): Point2D[] {
  const corners: Point2D[] = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (30 + i * 60);
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
 * Returns endpoints for an edge (0..5) of a pointy-topped hex
 */
export function getHexEdgeEndpoints(corners: Point2D[], edgeIndex: Facing): { p1: Point2D; p2: Point2D } {
  const p1 = corners[edgeIndex];
  const p2 = corners[(edgeIndex + 1) % 6];
  return { p1, p2 };
}

/**
 * Returns rotation angle in degrees for tank unit facing direction (0..5)
 */
export function getFacingAngleDegrees(facing: Facing): number {
  return facing * 60;
}

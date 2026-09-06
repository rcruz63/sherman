import { ArmorSector, AxialCoord, Facing } from '../../types/game';
import { axialToPixelFlat, getDirectionBetween } from './math';

/**
 * Returns the hex direction (0..5) from `from` towards `to`.
 * If exact straight line, returns exact direction.
 * Otherwise, finds the closest matching direction vector.
 */
export function getClosestDirection(from: AxialCoord, to: AxialCoord): Facing {
  const exact = getDirectionBetween(from, to);
  if (exact !== null) return exact;

  const pFrom = axialToPixelFlat(from, 20);
  const pTo = axialToPixelFlat(to, 20);

  const dx = pTo.x - pFrom.x;
  const dy = pTo.y - pFrom.y;

  // Angle in radians relative to North (screen -y)
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;

  // Each sector is 60 degrees (PI / 3)
  const sector = Math.round(angle / (Math.PI / 3)) % 6;
  return sector as Facing;
}

/**
 * Determines which armor sector (D, LD, LT, T) of the target is hit by an attacker.
 * - D (Frontal): Exact front direction (0° relative difference)
 * - LD (Lateral Delantero): ±60° (1 or 5 relative difference)
 * - LT (Lateral Trasero): ±120° (2 or 4 relative difference)
 * - T (Trasero): Exact rear direction (180° / 3 relative difference)
 */
export function getTargetImpactSector(
  targetCoord: AxialCoord,
  targetFacing: Facing,
  attackerCoord: AxialCoord
): ArmorSector {
  const incomingDirection = getClosestDirection(targetCoord, attackerCoord);
  const diff = (incomingDirection - targetFacing + 6) % 6;

  switch (diff) {
    case 0:
      return 'D';
    case 1:
    case 5:
      return 'LD';
    case 2:
    case 4:
      return 'LT';
    case 3:
      return 'T';
    default:
      return 'D';
  }
}

/**
 * Checks if target is in the attacker's rear arc (+1 difficulty modifier when firing).
 * Rear arc includes relative directions 2, 3, and 4 (outside the front ±60° cone).
 */
export function isTargetInRearArc(
  attackerCoord: AxialCoord,
  attackerFacing: Facing,
  targetCoord: AxialCoord
): boolean {
  const dirToTarget = getClosestDirection(attackerCoord, targetCoord);
  const diff = (dirToTarget - attackerFacing + 6) % 6;
  return diff === 2 || diff === 3 || diff === 4;
}

/**
 * Checks if target is in exact rear direction (180° / diff === 3).
 */
export function isTargetInExactRear(
  attackerCoord: AxialCoord,
  attackerFacing: Facing,
  targetCoord: AxialCoord
): boolean {
  const dirToTarget = getClosestDirection(attackerCoord, targetCoord);
  const diff = (dirToTarget - attackerFacing + 6) % 6;
  return diff === 3;
}

/**
 * Line of Sight (LOS) Calculation Module
 */

import { AxialCoord, BoardState, Facing } from '../../types/game';
import { coordKey, getDirectionBetween, hexDistance, hexNeighbor } from './math';

export interface LOSResult {
  hasLOS: boolean;
  reason?: 'NOT_STRAIGHT_LINE' | 'BLOCKED_BY_OBSTACLE' | 'CLEAR';
  distance: number;
  direction: Facing | null;
  blockingCoord?: AxialCoord;
  treeLineCount: number;
}

/**
 * Checks Line of Sight between `from` and `to` hexes.
 * - LOS must follow a straight ray along one of the 6 hex directions.
 * - Intermediate hexes with terrain 'woods' or 'building' block LOS.
 * - Target hex ('to') can be inside woods/building (vision TO them is allowed, only THROUGH them is blocked).
 * - Tree lines (arboledas) crossed along the ray add to treeLineCount,
 *   excluding tree lines on the attacker's immediate hex boundary.
 */
export function checkLOS(
  from: AxialCoord,
  to: AxialCoord,
  boardState: BoardState
): LOSResult {
  const direction = getDirectionBetween(from, to);
  const distance = hexDistance(from, to);

  if (direction === null) {
    return {
      hasLOS: false,
      reason: 'NOT_STRAIGHT_LINE',
      distance,
      direction: null,
      treeLineCount: 0,
    };
  }

  let treeLineCount = 0;
  let currentCoord = { ...from };

  for (let step = 1; step <= distance; step++) {
    const prevCoord = { ...currentCoord };
    currentCoord = hexNeighbor(prevCoord, direction);

    // Check edge crossed between prevCoord and currentCoord
    // Exclude the edge directly touching the attacker (step === 1)
    if (step > 1) {
      const prevTile = boardState.tiles.get(coordKey(prevCoord));
      const currTile = boardState.tiles.get(coordKey(currentCoord));

      const prevEdgeHasTree = prevTile?.edges[direction] === 'treeline';
      const oppositeDir = ((direction + 3) % 6) as Facing;
      const currEdgeHasTree = currTile?.edges[oppositeDir] === 'treeline';

      if (prevEdgeHasTree || currEdgeHasTree) {
        treeLineCount++;
      }
    }

    // Check if intermediate hex (step < distance) blocks LOS
    if (step < distance) {
      const intermediateTile = boardState.tiles.get(coordKey(currentCoord));
      if (intermediateTile) {
        if (intermediateTile.terrain === 'woods' || intermediateTile.terrain === 'building' || intermediateTile.hasBuilding) {
          return {
            hasLOS: false,
            reason: 'BLOCKED_BY_OBSTACLE',
            distance,
            direction,
            blockingCoord: currentCoord,
            treeLineCount,
          };
        }
      }
    }
  }

  return {
    hasLOS: true,
    reason: 'CLEAR',
    distance,
    direction,
    treeLineCount,
  };
}

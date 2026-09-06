/**
 * Map Validator & Auto-Fixer Module for Sherman Solitario Hex Boards
 */

import { Facing, MissionJSON, RawHexConfig } from '../../types/game';
import { hexNeighbor } from './math';

export type DirName = 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW';

export const DIR_TO_INDEX: Record<string, Facing> = {
  N: 0,
  NE: 1,
  SE: 2,
  S: 3,
  SW: 4,
  NW: 5,
};

export const INDEX_TO_DIR: Record<Facing, DirName> = {
  0: 'N',
  1: 'NE',
  2: 'SE',
  3: 'S',
  4: 'SW',
  5: 'NW',
};

export const OPPOSITE_FACING: Record<Facing, Facing> = {
  0: 3, // N <-> S
  1: 4, // NE <-> SW
  2: 5, // SE <-> NW
  3: 0, // S <-> N
  4: 1, // SW <-> NE
  5: 2, // NW <-> SE
};

export interface ValidationIssue {
  type: 'ERROR' | 'WARNING';
  category: 'TREELINE' | 'ROAD' | 'SPOT' | 'GRID';
  hex: { col: number; row: number };
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export function validateMapConfig(mission: MissionJSON): ValidationResult {
  const issues: ValidationIssue[] = [];
  const hexes = mission.hexes || [];

  const gridMap = new Map<string, RawHexConfig>();
  hexes.forEach((hex) => {
    gridMap.set(`${hex.col},${hex.row}`, hex);
  });

  const redSpots = new Map<number, { col: number; row: number }>();
  const blackSpots = new Map<number, { col: number; row: number }>();

  for (const hex of hexes) {
    // 1. Validate Black Spots
    if (hex.blackSpot) {
      const num = hex.blackSpot.number;
      if (blackSpots.has(num)) {
        const prev = blackSpots.get(num)!;
        issues.push({
          type: 'ERROR',
          category: 'SPOT',
          hex: { col: hex.col, row: hex.row },
          message: `Punto Negro #${num} duplicado entre (${hex.col},${hex.row}) y (${prev.col},${prev.row}).`,
        });
      } else {
        blackSpots.set(num, { col: hex.col, row: hex.row });
      }

      if (hex.blackSpot.facing === undefined || hex.blackSpot.facing < 0 || hex.blackSpot.facing > 5) {
        issues.push({
          type: 'ERROR',
          category: 'SPOT',
          hex: { col: hex.col, row: hex.row },
          message: `Punto Negro #${num} en (${hex.col},${hex.row}) tiene una orientación inválida (${hex.blackSpot.facing}).`,
        });
      }
    }

    // 2. Validate Red Spots
    if (hex.redSpot) {
      const num = hex.redSpot;
      if (redSpots.has(num)) {
        const prev = redSpots.get(num)!;
        issues.push({
          type: 'ERROR',
          category: 'SPOT',
          hex: { col: hex.col, row: hex.row },
          message: `Punto Rojo #${num} duplicado entre (${hex.col},${hex.row}) y (${prev.col},${prev.row}).`,
        });
      } else {
        redSpots.set(num, { col: hex.col, row: hex.row });
      }
    }

    // 3. Validate Treelines Edge Reciprocity (shared edge is valid if declared on either neighbor)
    if (hex.treeLines && hex.treeLines.length > 0) {
      for (const dirStr of hex.treeLines) {
        const dirIdx = DIR_TO_INDEX[dirStr];
        if (dirIdx === undefined) continue;

        const neighborCoord = hexNeighbor({ q: hex.col, r: hex.row }, dirIdx);
        const neighborKey = `${neighborCoord.q},${neighborCoord.r}`;
        const neighbor = gridMap.get(neighborKey);

        if (!neighbor) {
          issues.push({
            type: 'WARNING',
            category: 'TREELINE',
            hex: { col: hex.col, row: hex.row },
            message: `Arboleda en (${hex.col},${hex.row}) hacia [${dirStr}] apunta fuera de los límites del mapa.`,
          });
        }
      }
    }

    // 4. Validate Road Edge Continuity
    if (hex.roadEdges && hex.roadEdges.length > 0) {
      for (const dirStr of hex.roadEdges) {
        const dirIdx = DIR_TO_INDEX[dirStr];
        if (dirIdx === undefined) continue;

        const neighborCoord = hexNeighbor({ q: hex.col, r: hex.row }, dirIdx);
        const neighborKey = `${neighborCoord.q},${neighborCoord.r}`;
        const neighbor = gridMap.get(neighborKey);

        if (neighbor) {
          const oppDirIdx = OPPOSITE_FACING[dirIdx];
          const oppDirStr = INDEX_TO_DIR[oppDirIdx];
          const hasOppositeRoad = neighbor.roadEdges?.includes(oppDirStr) || neighbor.terrain === 'ROAD' || neighbor.isBridge;

          if (!hasOppositeRoad) {
            issues.push({
              type: 'ERROR',
              category: 'ROAD',
              hex: { col: hex.col, row: hex.row },
              message: `Carretera en (${hex.col},${hex.row}) conecta hacia [${dirStr}], pero el vecino (${neighbor.col},${neighbor.row}) no se conecta hacia [${oppDirStr}].`,
            });
          }
        }
      }
    }
  }

  const hasErrors = issues.some((i) => i.type === 'ERROR');

  return {
    isValid: !hasErrors,
    issues,
  };
}

/**
 * Automatically synchronizes edge treelines and road connections across neighbor hexes.
 */
export function autoFixMapConfig(mission: MissionJSON): MissionJSON {
  const fixedMission: MissionJSON = JSON.parse(JSON.stringify(mission));
  const hexes = fixedMission.hexes || [];
  const gridMap = new Map<string, RawHexConfig>();

  hexes.forEach((hex) => {
    gridMap.set(`${hex.col},${hex.row}`, hex);
  });

  // Synchronize Treelines: No longer injects reciprocal treelines into neighbor hexes
  // Treelines declared on one side of a shared edge are fully valid and handled in-memory by missionLoader.


  // Synchronize Road Edges
  hexes.forEach((hex) => {
    if (hex.roadEdges && hex.roadEdges.length > 0) {
      hex.roadEdges.forEach((dirStr) => {
        const dirIdx = DIR_TO_INDEX[dirStr];
        if (dirIdx === undefined) return;

        const neighborCoord = hexNeighbor({ q: hex.col, r: hex.row }, dirIdx);
        const neighbor = gridMap.get(`${neighborCoord.q},${neighborCoord.r}`);

        if (neighbor) {
          const oppDirStr = INDEX_TO_DIR[OPPOSITE_FACING[dirIdx]];
          if (!neighbor.roadEdges) neighbor.roadEdges = [];
          if (!neighbor.roadEdges.includes(oppDirStr)) {
            neighbor.roadEdges.push(oppDirStr);
          }
          if (neighbor.terrain !== 'ROAD' && !neighbor.hasBuilding) {
            neighbor.terrain = 'ROAD';
          }
        }
      });
    }
  });

  return fixedMission;
}

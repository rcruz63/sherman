/**
 * Mission Loader & Event Resolution System
 */

import {
  ArmorStats,
  AxialCoord,
  BlackSpawnPoint,
  BoardHex,
  BoardState,
  CrewMember,
  EdgeFeature,
  EnemyInfantry,
  EnemyTank,
  EnemyTruck,
  EventRule,
  Facing,
  MissionJSON,
  RedSpawnPoint,
  ShermanDicePoolConfig,
  ShermanState,
  TerrainType,
  TurnPhase,
} from '../../types/game';
import { coordKey } from '../hex/math';

export const TANK_STATS: Record<string, { size: number; armor: ArmorStats; penetration: number; baseDice: number }> = {
  PANZER_IV: {
    size: 4,
    armor: { D: 6, LD: 5, LT: 4, T: 4 },
    penetration: 1,
    baseDice: 4,
  },
  PANZER_III: {
    size: 5,
    armor: { D: 5, LD: 4, LT: 3, T: 3 },
    penetration: 0,
    baseDice: 3,
  },
  TIGER: {
    size: 3,
    armor: { D: 7, LD: 6, LT: 5, T: 4 },
    penetration: 2,
    baseDice: 4,
  },
  SHERMAN: {
    size: 4,
    armor: { D: 6, LD: 5, LT: 4, T: 4 },
    penetration: 1,
    baseDice: 4,
  },
};

/**
 * Calculates Sherman Action Dice Pool according to starting terrain of the phase
 */
export function calculateShermanDicePool(
  terrain: TerrainType,
  diceConfig: ShermanDicePoolConfig
): { maneuver: number; attack: number; misc: number; total: number } {
  let key: 'road' | 'field' | 'mud' = 'field';
  if (terrain === 'road') key = 'road';
  else if (terrain === 'mud') key = 'mud';

  const maneuver = diceConfig.maneuver[key];
  const attack = diceConfig.attack[key];
  const misc = diceConfig.misc[key];

  return {
    maneuver,
    attack,
    misc,
    total: maneuver + attack + misc,
  };
}

/**
 * Resolves end-of-turn 2d6 event rule from mission specification
 */
export function resolveMissionEvent(events: EventRule[], roll: number): EventRule | null {
  return events.find((e) => roll >= e.rollMin && roll <= e.rollMax) || null;
}

export interface LoadMissionOptions {
  selectedBlackSpawns?: number[]; // Fixed spawn numbers for deterministic testing/replays
  selectedRedSpawns?: number[]; // Fixed red spawn numbers for deterministic testing/replays
  selectedPlayerBlackSpawn?: number; // Fixed black spawn number for Sherman in missions with RANDOM_BLACK_NUMBER
}

export const DIR_STRING_MAP: Record<string, Facing> = {
  N: 0,
  NE: 1,
  SE: 2,
  S: 3,
  SW: 4,
  SO: 4,
  NW: 5,
  NO: 5,
};

export function parseAxialCoord(
  hex?: AxialCoord | { col: number; row: number } | { q?: number; r?: number; col?: number; row?: number }
): AxialCoord {
  if (!hex) return { q: 0, r: 0 };
  const q = (hex as any).q ?? (hex as any).col ?? 0;
  const r = (hex as any).r ?? (hex as any).row ?? 0;
  return { q, r };
}

import { hexNeighbor } from '../hex/math';
import { OPPOSITE_FACING } from '../hex/mapValidator';

/**
 * Extracts black and red spawn points defined in the mission hexes
 */
export function extractMissionSpawnPoints(missionData: MissionJSON): {
  blackNumbers: BlackSpawnPoint[];
  redNumbers: RedSpawnPoint[];
} {
  const blackNumbers: BlackSpawnPoint[] = [];
  const redNumbers: RedSpawnPoint[] = [];

  if (missionData.hexes && missionData.hexes.length > 0) {
    missionData.hexes.forEach((h) => {
      const q = h.col ?? (h as any).q ?? 0;
      const r = h.row ?? (h as any).r ?? 0;
      if (h.blackSpot) {
        blackNumbers.push({
          number: h.blackSpot.number,
          hex: { q, r },
          facing: h.blackSpot.facing,
        });
      }
      if (h.redSpot !== undefined) {
        redNumbers.push({
          number: h.redSpot,
          hex: { q, r },
        });
      }
    });
  }

  return { blackNumbers, redNumbers };
}


/**
 * Loads a mission JSON into a fully initialized BoardState
 */
export function loadMissionState(
  missionData: MissionJSON,
  options?: LoadMissionOptions
): BoardState {
  const tileMap = new Map<string, BoardHex>();
  const blackNumbers: BlackSpawnPoint[] = [];
  const redNumbers: RedSpawnPoint[] = [];

  if (missionData.hexes && missionData.hexes.length > 0) {
    // Declarative Hexes Array (e.g. Mission 1 flat-topped 36-hex grid)
    missionData.hexes.forEach((h) => {
      const q = h.col ?? (h as any).q;
      const r = h.row ?? (h as any).r;
      const key = `${q},${r}`;

      let terrain: TerrainType = 'field';
      const rawTerrain = (h.terrain || '').toLowerCase();
      if (rawTerrain === 'water') terrain = 'water';
      else if (rawTerrain === 'mud') terrain = 'mud';
      else if (rawTerrain === 'woods') terrain = 'woods';
      else if (rawTerrain === 'road') terrain = 'road';
      else if (rawTerrain === 'building') terrain = 'building';
      else terrain = 'field';

      const hasBuilding = !!h.hasBuilding || rawTerrain === 'building';

      const edges: [EdgeFeature, EdgeFeature, EdgeFeature, EdgeFeature, EdgeFeature, EdgeFeature] = [
        'none', 'none', 'none', 'none', 'none', 'none'
      ];

      const treeLineFacings: Facing[] = [];
      if (h.treeLines) {
        h.treeLines.forEach((str) => {
          const dir = DIR_STRING_MAP[str.toUpperCase()];
          if (dir !== undefined) {
            treeLineFacings.push(dir);
            edges[dir] = 'treeline';
          }
        });
      }

      const roadEdgeFacings: Facing[] = [];
      if (h.roadEdges) {
        h.roadEdges.forEach((str) => {
          const dir = DIR_STRING_MAP[str.toUpperCase()];
          if (dir !== undefined) {
            roadEdgeFacings.push(dir);
          }
        });
      }

      const exitCoord = missionData.victoryConditions.exitHex ? parseAxialCoord(missionData.victoryConditions.exitHex) : null;
      const isExit = !!h.isExit || (
        !!missionData.victoryConditions.requireMapExit &&
        !!exitCoord && exitCoord.q === q && exitCoord.r === r
      );
      const exitFacing: Facing | undefined = isExit
        ? (h.exitFacing ?? (missionData.victoryConditions.exitHex as any)?.facing ?? missionData.victoryConditions.exitFacing)
        : undefined;

      const entryCoord = missionData.playerDeployment.hex ? parseAxialCoord(missionData.playerDeployment.hex) : null;
      const isEntry = !!h.isEntry || (
        !!entryCoord && entryCoord.q === q && entryCoord.r === r
      );
      const entryFacing: Facing | undefined = isEntry
        ? (h.entryFacing ?? missionData.playerDeployment.facing)
        : undefined;

      const tile: BoardHex = {
        coord: { q, r },
        terrain,
        edges,
        hasBuilding,
        buildingType: h.buildingType,
        treeLines: treeLineFacings,
        roadEdges: roadEdgeFacings,
        blackSpawnNumber: h.blackSpot?.number,
        blackSpawnFacing: h.blackSpot?.facing,
        redSpawnNumber: h.redSpot,
        isEntryHex: isEntry,
        entryFacing,
        isExitHex: isExit,
        exitFacing,
        isBridge: !!h.isBridge,
      };

      tileMap.set(key, tile);

      if (h.blackSpot) {
        blackNumbers.push({
          number: h.blackSpot.number,
          hex: { q, r },
          facing: h.blackSpot.facing,
        });
      }

      if (h.redSpot !== undefined) {
        redNumbers.push({
          number: h.redSpot,
          hex: { q, r },
        });
      }
    });

    // In-memory pass: synchronize shared treeline edges between adjacent hexes for Line of Sight
    tileMap.forEach((tile) => {
      tile.treeLines?.forEach((dir) => {
        const neighborCoord = hexNeighbor(tile.coord, dir);
        const neighborTile = tileMap.get(`${neighborCoord.q},${neighborCoord.r}`);
        if (neighborTile) {
          const oppDir = OPPOSITE_FACING[dir];
          neighborTile.edges[oppDir] = 'treeline';
        }
      });
    });
  } else if (missionData.map) {
    // Legacy Rectangular Grid Generation
    for (let q = 0; q < missionData.map.columns; q++) {
      for (let r = 0; r < missionData.map.rows; r++) {
        let terrain: TerrainType = 'field';

        if (q === 1) terrain = 'road';
        if ((q === 0 && r === 3) || (q === 2 && r === 4)) terrain = 'woods';
        if (q === 1 && r === 4) terrain = 'building';

        const exitCoord = missionData.victoryConditions.exitHex ? parseAxialCoord(missionData.victoryConditions.exitHex) : null;
        const key = `${q},${r}`;
        tileMap.set(key, {
          coord: { q, r },
          terrain,
          edges: ['none', 'none', 'none', 'none', 'none', 'none'],
          isExitHex: !!(
            missionData.victoryConditions.requireMapExit &&
            exitCoord && exitCoord.q === q && exitCoord.r === r
          ),
          isBridge: missionData.specialRules?.bridge &&
            missionData.specialRules.bridge.hex.q === q &&
            missionData.specialRules.bridge.hex.r === r,
        });
      }
    }
  }

  // Overlay Black & Red Spawns if provided via spawnPoints field
  if (missionData.spawnPoints?.blackNumbers) {
    missionData.spawnPoints.blackNumbers.forEach((sp) => {
      const key = coordKey(sp.hex);
      const tile = tileMap.get(key);
      if (tile) {
        tile.blackSpawnNumber = sp.number;
        tile.blackSpawnFacing = sp.facing;
      }
      if (!blackNumbers.some((b) => b.number === sp.number)) {
        blackNumbers.push(sp);
      }
    });
  }

  if (missionData.spawnPoints?.redNumbers) {
    missionData.spawnPoints.redNumbers.forEach((sp) => {
      const key = coordKey(sp.hex);
      const tile = tileMap.get(key);
      if (tile) {
        tile.redSpawnNumber = sp.number;
      }
      if (!redNumbers.some((r) => r.number === sp.number)) {
        redNumbers.push(sp);
      }
    });
  }

  // Initialize Sherman State
  const crewState: Record<string, CrewMember> = {};
  missionData.playerDeployment.crew.forEach((c) => {
    const roleKey =
      c.id === 1 ? 'commander' :
      c.id === 2 ? 'loader' :
      c.id === 3 ? 'gunner' :
      c.id === 4 ? 'driver' : 'assistant';

    crewState[roleKey] = {
      id: c.id,
      role: roleKey as any,
      name: c.name,
      status: c.kia ? 'kia' : 'active',
      position: c.position || 'INTERIOR',
    };
  });

  const usedBlackNumbers = new Set<number>();
  let shermanCoord: AxialCoord;
  let shermanFacing: Facing;

  const isRandomPlayerSpawn =
    missionData.playerDeployment.spawnMethod === 'RANDOM_BLACK_NUMBER' ||
    !missionData.playerDeployment.hex;

  if (isRandomPlayerSpawn && blackNumbers.length > 0) {
    let playerSp: BlackSpawnPoint | undefined;
    if (options?.selectedPlayerBlackSpawn !== undefined) {
      playerSp = blackNumbers.find((b) => b.number === options.selectedPlayerBlackSpawn);
    }
    if (!playerSp) {
      const randIdx = Math.floor(Math.random() * blackNumbers.length);
      playerSp = blackNumbers[randIdx];
    }
    if (playerSp) {
      shermanCoord = { ...playerSp.hex };
      shermanFacing = playerSp.facing;
      usedBlackNumbers.add(playerSp.number);
    } else {
      shermanCoord = { q: 0, r: 0 };
      shermanFacing = 0;
    }
  } else {
    shermanCoord = parseAxialCoord(missionData.playerDeployment.hex);
    shermanFacing = missionData.playerDeployment.facing ?? 0;
  }

  const shermanState: ShermanState = {
    coord: shermanCoord,
    facing: shermanFacing,
    commanderPosition: 'unhatched', // Interior
    isLoaded: missionData.playerDeployment.initialStatus.loaded,
    fireLevel: missionData.playerDeployment.initialStatus.fireLevel,
    isTurretDamaged: missionData.playerDeployment.initialStatus.turretDamaged,
    isImmobilized: missionData.playerDeployment.initialStatus.immobilized,
    hasSmoke: missionData.playerDeployment.initialStatus.smoke,
    isHullDown: missionData.playerDeployment.initialStatus.hullDown,
    armor: TANK_STATS.SHERMAN.armor,
    gunPenetration: TANK_STATS.SHERMAN.penetration,
    crew: crewState as any,
  };

  // Process Enemy Tank Deployment
  const availableBlackSpawns = [...blackNumbers].filter((sp) => !usedBlackNumbers.has(sp.number));
  let spawnIndex = 0;

  if (!options?.selectedBlackSpawns) {
    availableBlackSpawns.sort(() => 0.5 - Math.random());
  }

  const enemyTanks: EnemyTank[] = [];
  let tankIdCounter = 1;

  if (missionData.enemyDeployment.tanks) {
    missionData.enemyDeployment.tanks.forEach((group) => {
      const stats = TANK_STATS[group.type] || TANK_STATS.PANZER_IV;

      for (let i = 0; i < group.count; i++) {
        let sp: typeof availableBlackSpawns[0] | undefined;

        if (options?.selectedBlackSpawns && spawnIndex < options.selectedBlackSpawns.length) {
          const targetNum = options.selectedBlackSpawns[spawnIndex];
          sp = blackNumbers.find((s) => s.number === targetNum);
        } else {
          sp = availableBlackSpawns.find((s) => {
            if (usedBlackNumbers.has(s.number)) return false;
            if (group.allowedNumbers && group.allowedNumbers.length > 0) {
              return group.allowedNumbers.includes(s.number);
            }
            return true;
          });
        }

        if (sp) {
          usedBlackNumbers.add(sp.number);
          enemyTanks.push({
            id: `${group.type.toLowerCase()}_${tankIdCounter++}`,
            type: group.type === 'TIGER' ? 'tiger' : group.type === 'PANZER_III' ? 'panzerIII' : 'panzerIV',
            coord: { ...sp.hex },
            facing: sp.facing,
            status: 'operational',
            hasSmoke: false,
            isHullDown: false,
            size: stats.size,
            armor: stats.armor,
            penetration: stats.penetration,
            baseDice: stats.baseDice,
            spawnNumber: sp.number,
          });
        }
        spawnIndex++;
      }
    });
  }

  // Process Special Units (e.g. TRUCK in Mission 5)
  const enemyTrucks: EnemyTruck[] = [];
  if (missionData.enemyDeployment.specialUnits) {
    missionData.enemyDeployment.specialUnits.forEach((unit, idx) => {
      if (unit.type === 'TRUCK') {
        const truckRules = missionData.specialRules?.truck;
        enemyTrucks.push({
          id: `truck_${idx + 1}`,
          type: 'truck',
          coord: parseAxialCoord(unit.hex),
          facing: unit.facing,
          status: 'operational',
          moveIndex: truckRules?.moveIndex || 0,
          maxMoves: truckRules?.maxMoves || 8,
          size: truckRules?.stats.tam || 3,
          armor: {
            D: truckRules?.stats.d || 1,
            LD: truckRules?.stats.ld || 1,
            LT: truckRules?.stats.lt || 1,
            T: truckRules?.stats.t || 1,
          },
          roadPath: (truckRules?.roadPath && truckRules.roadPath.length > 0)
            ? truckRules.roadPath.map((p) => parseAxialCoord(p))
            : [
                { q: 1, r: 1 }, { q: 1, r: 2 }, { q: 1, r: 3 }, { q: 1, r: 4 },
                { q: 1, r: 5 }, { q: 1, r: 6 }, { q: 1, r: 7 }, { q: 1, r: 8 },
              ],
        });
      }
    });
  }

  // Process Infantry Deployment (e.g., Mission 3, 4, 5, 8)
  const enemyInfantry: EnemyInfantry[] = [];
  if (missionData.enemyDeployment.infantry) {
    let infIdCounter = 1;
    missionData.enemyDeployment.infantry.forEach((infConfig) => {
      if (infConfig.spawnMethod === 'FIXED_HEX' && infConfig.hex) {
        enemyInfantry.push({
          id: infConfig.id || `inf_${infIdCounter++}`,
          type: 'infantry',
          coord: parseAxialCoord(infConfig.hex),
          status: 'active',
          isObjective: infConfig.isObjective,
        });
      } else if (infConfig.spawnMethod === 'ALL_BUILDING_HEXES') {
        tileMap.forEach((tile) => {
          if (tile.hasBuilding || tile.terrain === 'building') {
            enemyInfantry.push({
              id: `inf_${infIdCounter++}`,
              type: 'infantry',
              coord: { ...tile.coord },
              status: 'active',
              isObjective: infConfig.isObjective,
            });
          }
        });
      } else if (infConfig.spawnMethod === 'FIXED_RED_NUMBER' && infConfig.number !== undefined) {
        const targetTile = Array.from(tileMap.values()).find((t) => t.redSpawnNumber === infConfig.number);
        if (targetTile) {
          enemyInfantry.push({
            id: `inf_${infIdCounter++}`,
            type: 'infantry',
            coord: { ...targetTile.coord },
            status: 'active',
            spawnNumber: infConfig.number,
            isObjective: infConfig.isObjective,
          });
        }
      } else if (infConfig.spawnMethod === 'RANDOM_UNIQUE_RED_NUMBERS' && infConfig.count) {
        let selected: RedSpawnPoint[] = [];
        if (options?.selectedRedSpawns && options.selectedRedSpawns.length > 0) {
          selected = options.selectedRedSpawns
            .map((num) => redNumbers.find((sp) => sp.number === num))
            .filter((sp): sp is RedSpawnPoint => !!sp);
        } else {
          const availableRedSpawns = [...redNumbers].sort(() => 0.5 - Math.random());
          selected = availableRedSpawns.slice(0, infConfig.count);
        }
        selected.forEach((sp) => {
          enemyInfantry.push({
            id: `inf_${infIdCounter++}`,
            type: 'infantry',
            coord: { ...sp.hex },
            status: 'active',
            spawnNumber: sp.number,
            isObjective: infConfig.isObjective,
          });
        });
      }
    });
  }

  return {
    tiles: tileMap,
    sherman: shermanState,
    enemyTanks,
    enemyTrucks,
    enemyInfantry,
    currentTurn: 1,
    currentPhase: TurnPhase.SHERMAN_SMOKE_CLEANUP,
    missionData,
  };
}

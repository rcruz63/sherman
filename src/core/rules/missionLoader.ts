/**
 * Mission Loader & Event Resolution System
 */

import {
  ArmorStats,
  BoardHex,
  BoardState,
  CrewMember,
  EnemyInfantry,
  EnemyTank,
  EnemyTruck,
  EventRule,
  MissionJSON,
  ShermanDicePoolConfig,
  ShermanState,
  TerrainType,
  TurnPhase,
} from '../../types/game';
import { coordKey } from '../hex/math';

export const TANK_STATS: Record<string, { size: number; armor: ArmorStats; penetration: number; baseDice: number }> = {
  PANZER_IV: {
    size: 4,
    armor: { D: 6, LD: 4, LT: 3, T: 2 },
    penetration: 6,
    baseDice: 4,
  },
  PANZER_III: {
    size: 3,
    armor: { D: 5, LD: 3, LT: 2, T: 2 },
    penetration: 5,
    baseDice: 3,
  },
  TIGER: {
    size: 5,
    armor: { D: 10, LD: 7, LT: 5, T: 4 },
    penetration: 9,
    baseDice: 4,
  },
  SHERMAN: {
    size: 4,
    armor: { D: 8, LD: 6, LT: 4, T: 3 },
    penetration: 7,
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
}

/**
 * Loads a mission JSON into a fully initialized BoardState
 */
export function loadMissionState(
  missionData: MissionJSON,
  options?: LoadMissionOptions
): BoardState {
  const tileMap = new Map<string, BoardHex>();

  // Generate grid tiles according to map dimensions
  for (let q = 0; q < missionData.map.columns; q++) {
    for (let r = 0; r < missionData.map.rows; r++) {
      let terrain: TerrainType = 'field';

      // Center line road for maps
      if (q === 1) terrain = 'road';
      if ((q === 0 && r === 3) || (q === 2 && r === 4)) terrain = 'woods';
      if (q === 1 && r === 4) terrain = 'building';

      const key = `${q},${r}`;
      tileMap.set(key, {
        coord: { q, r },
        terrain,
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        isExitHex: !!(
          missionData.victoryConditions.requireMapExit &&
          missionData.victoryConditions.exitHex &&
          missionData.victoryConditions.exitHex.q === q &&
          missionData.victoryConditions.exitHex.r === r
        ),
        isBridge: missionData.specialRules?.bridge &&
          missionData.specialRules.bridge.hex.q === q &&
          missionData.specialRules.bridge.hex.r === r,
      });
    }
  }

  // Overlay Black Spawn points (tanks)
  missionData.spawnPoints.blackNumbers.forEach((sp) => {
    const key = coordKey(sp.hex);
    const tile = tileMap.get(key);
    if (tile) {
      tile.blackSpawnNumber = sp.number;
      tile.blackSpawnFacing = sp.facing;
    } else {
      tileMap.set(key, {
        coord: sp.hex,
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        blackSpawnNumber: sp.number,
        blackSpawnFacing: sp.facing,
      });
    }
  });

  // Overlay Red Spawn points (infantry)
  missionData.spawnPoints.redNumbers.forEach((sp) => {
    const key = coordKey(sp.hex);
    const tile = tileMap.get(key);
    if (tile) {
      tile.redSpawnNumber = sp.number;
    } else {
      tileMap.set(key, {
        coord: sp.hex,
        terrain: 'field',
        edges: ['none', 'none', 'none', 'none', 'none', 'none'],
        redSpawnNumber: sp.number,
      });
    }
  });

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

  const shermanState: ShermanState = {
    coord: { ...missionData.playerDeployment.hex },
    facing: missionData.playerDeployment.facing,
    commanderPosition: 'unhatched', // Interior
    isLoaded: missionData.playerDeployment.initialStatus.loaded,
    fireLevel: missionData.playerDeployment.initialStatus.fireLevel,
    isTurretDamaged: missionData.playerDeployment.initialStatus.turretDamaged,
    isImmobilized: missionData.playerDeployment.initialStatus.immobilized, // E.g., true for Mission 6!
    hasSmoke: missionData.playerDeployment.initialStatus.smoke,
    isHullDown: missionData.playerDeployment.initialStatus.hullDown,
    armor: TANK_STATS.SHERMAN.armor,
    gunPenetration: TANK_STATS.SHERMAN.penetration,
    crew: crewState as any,
  };

  // Process Enemy Tank Deployment
  const availableBlackSpawns = [...missionData.spawnPoints.blackNumbers];
  let spawnIndex = 0;

  if (!options?.selectedBlackSpawns) {
    availableBlackSpawns.sort(() => 0.5 - Math.random());
  }

  const enemyTanks: EnemyTank[] = [];
  let tankIdCounter = 1;
  const usedBlackNumbers = new Set<number>();

  if (missionData.enemyDeployment.tanks) {
    missionData.enemyDeployment.tanks.forEach((group) => {
      const stats = TANK_STATS[group.type] || TANK_STATS.PANZER_IV;

      for (let i = 0; i < group.count; i++) {
        let sp: typeof availableBlackSpawns[0] | undefined;

        if (options?.selectedBlackSpawns && spawnIndex < options.selectedBlackSpawns.length) {
          const targetNum = options.selectedBlackSpawns[spawnIndex];
          sp = missionData.spawnPoints.blackNumbers.find((s) => s.number === targetNum);
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
          coord: { ...unit.hex },
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
          roadPath: truckRules?.roadPath || [
            { q: 1, r: 1 }, { q: 1, r: 2 }, { q: 1, r: 3 }, { q: 1, r: 4 },
            { q: 1, r: 5 }, { q: 1, r: 6 }, { q: 1, r: 7 }, { q: 1, r: 8 },
          ],
        });
      }
    });
  }

  // Process Infantry Deployment (e.g., OFFICER_INFANTRY in Mission 8)
  const enemyInfantry: EnemyInfantry[] = [];
  if (missionData.enemyDeployment.infantry) {
    missionData.enemyDeployment.infantry.forEach((infConfig, idx) => {
      if (infConfig.spawnMethod === 'FIXED_HEX' && infConfig.hex) {
        enemyInfantry.push({
          id: infConfig.id || `inf_${idx + 1}`,
          type: 'infantry',
          coord: { ...infConfig.hex },
          status: 'active',
          isObjective: infConfig.isObjective,
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

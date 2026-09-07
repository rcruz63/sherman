/**
 * Sherman Operations Phase Rules Engine (Phase 3)
 * Exact implementation of Mike Lambo's "Sherman Solitario" (Pages 8-10)
 */

import {
  AxialCoord,
  BoardState,
  EnemyInfantry,
  Facing,
  ShermanDicePoolConfig,
  ShermanState,
  TerrainType,
} from '../../types/game';
import { getDirectionBetween, hexDistance, hexNeighbor } from '../hex/math';

export type ShermanSectionType = 'maneuver' | 'attack' | 'misc';
export type ShermanOperationsOrder = 'MAV' | 'AMV';

export interface SectionDiceBreakdown {
  section: ShermanSectionType;
  terrain: TerrainType;
  baseTerrainDice: number;
  crewBonusDice: number;
  totalDice: number;
  isImmobilized?: boolean;
  explanation: string[];
}

/**
 * Calculates the number of dice to roll for a given section of Phase 3,
 * based on the Sherman's phase-start terrain and living crew.
 */
export function calculateSectionDice(
  section: ShermanSectionType,
  phaseStartTerrain: TerrainType,
  sherman: ShermanState,
  dicePoolConfig?: ShermanDicePoolConfig
): SectionDiceBreakdown {
  const explanation: string[] = [];

  // Normalize terrain: buildings don't change base terrain; tanks are only on road, field, or mud
  let effectiveTerrain: 'road' | 'field' | 'mud' = 'field';
  if (phaseStartTerrain === 'road') effectiveTerrain = 'road';
  else if (phaseStartTerrain === 'mud') effectiveTerrain = 'mud';

  if (section === 'maneuver') {
    if (sherman.isImmobilized) {
      return {
        section,
        terrain: phaseStartTerrain,
        baseTerrainDice: 0,
        crewBonusDice: 0,
        totalDice: 0,
        isImmobilized: true,
        explanation: ['Sherman Inmovilizado: Sección de Maniobra omitida automáticamente (0 dados).'],
      };
    }

    const baseTerrainDice = dicePoolConfig
      ? dicePoolConfig.maneuver[effectiveTerrain]
      : effectiveTerrain === 'road' ? 2 : effectiveTerrain === 'field' ? 1 : 0;
    explanation.push(`Terreno inicial (${effectiveTerrain.toUpperCase()}): ${baseTerrainDice} dado(s)`);

    let crewBonus = 0;
    if (sherman.crew.driver.status === 'active') {
      crewBonus += 1;
      explanation.push('Conductor activo: +1 dado');
    }
    if (sherman.crew.assistant.status === 'active') {
      crewBonus += 1;
      explanation.push('Asistente de Conductor activo: +1 dado');
    }
    if (sherman.crew.commander.status === 'active' && sherman.commanderPosition === 'hatched') {
      crewBonus += 1;
      explanation.push('Comandante activo y Asomado (A): +1 dado');
    }

    const totalDice = Math.min(5, baseTerrainDice + crewBonus);
    return {
      section,
      terrain: phaseStartTerrain,
      baseTerrainDice,
      crewBonusDice: crewBonus,
      totalDice,
      explanation,
    };
  }

  if (section === 'attack') {
    const baseTerrainDice = dicePoolConfig
      ? dicePoolConfig.attack[effectiveTerrain]
      : effectiveTerrain === 'mud' ? 1 : 2;
    explanation.push(`Terreno inicial (${effectiveTerrain.toUpperCase()}): ${baseTerrainDice} dado(s)`);

    let crewBonus = 0;
    if (sherman.crew.gunner.status === 'active') {
      crewBonus += 1;
      explanation.push('Artillero activo: +1 dado');
    }
    if (sherman.crew.loader.status === 'active') {
      crewBonus += 1;
      explanation.push('Cargador activo: +1 dado');
    }
    if (sherman.crew.commander.status === 'active' && sherman.commanderPosition === 'hatched') {
      crewBonus += 1;
      explanation.push('Comandante activo y Asomado (A): +1 dado');
    }

    const totalDice = Math.min(5, baseTerrainDice + crewBonus);
    return {
      section,
      terrain: phaseStartTerrain,
      baseTerrainDice,
      crewBonusDice: crewBonus,
      totalDice,
      explanation,
    };
  }

  // Section: misc
  const baseTerrainDice = dicePoolConfig
    ? dicePoolConfig.misc[effectiveTerrain]
    : effectiveTerrain === 'field' ? 2 : 1;
  explanation.push(`Terreno inicial (${effectiveTerrain.toUpperCase()}): ${baseTerrainDice} dado(s)`);

  let crewBonus = 0;
  if (sherman.crew.commander.status === 'active') {
    crewBonus += 1;
    explanation.push('Comandante activo (Interior o Asomado): +1 dado');
  }

  const totalDice = Math.min(3, baseTerrainDice + crewBonus);
  return {
    section,
    terrain: phaseStartTerrain,
    baseTerrainDice,
    crewBonusDice: crewBonus,
    totalDice,
    explanation,
  };
}

/**
 * Validates whether a move (forward or reverse) is legal based on map bounds,
 * impassable terrain (woods, water), bridge restrictions, and enemy occupation.
 */
export function validateManeuverMove(
  boardState: BoardState,
  direction: 'forward' | 'reverse'
): { isValid: boolean; targetCoord?: AxialCoord; reason?: string } {
  const sherman = boardState.sherman;
  const currentCoord = sherman.coord;
  const targetFacing =
    direction === 'forward'
      ? sherman.facing
      : (((sherman.facing + 3) % 6) as Facing);

  const targetCoord = hexNeighbor(currentCoord, targetFacing);
  const targetTileKey = `${targetCoord.q},${targetCoord.r}`;
  const targetTile = boardState.tiles.get(targetTileKey);

  if (!targetTile) {
    return { isValid: false, reason: 'Fuera de los límites del mapa.' };
  }

  if (targetTile.terrain === 'water') {
    return { isValid: false, reason: 'No se puede entrar en hexágonos de Agua.' };
  }

  if (targetTile.terrain === 'woods') {
    return { isValid: false, reason: 'No se puede entrar en hexágonos de Bosque.' };
  }

  // Check enemy tanks
  const tankInHex = boardState.enemyTanks.find(
    (t) => t.status !== 'destroyed' && t.coord.q === targetCoord.q && t.coord.r === targetCoord.r
  );
  if (tankInHex) {
    return { isValid: false, reason: `Hexágono ocupado por tanque enemigo (${tankInHex.type.toUpperCase()}).` };
  }

  // Check enemy trucks
  const truckInHex = boardState.enemyTrucks?.find(
    (tr) => tr.status !== 'destroyed' && tr.coord.q === targetCoord.q && tr.coord.r === targetCoord.r
  );
  if (truckInHex) {
    return { isValid: false, reason: 'Hexágono ocupado por camión enemigo.' };
  }

  // Check enemy infantry
  const infantryInHex = boardState.enemyInfantry.find(
    (inf) => inf.status !== 'eliminated' && inf.coord.q === targetCoord.q && inf.coord.r === targetCoord.r
  );
  if (infantryInHex) {
    return { isValid: false, reason: 'Hexágono ocupado por infantería enemiga.' };
  }

  // Bridge Special Rules (Mission 7)
  const bridgeRule = boardState.missionData?.specialRules?.bridge;
  if (bridgeRule) {
    const isEnteringBridge = targetTile.isBridge || (targetCoord.q === bridgeRule.hex.q && targetCoord.r === bridgeRule.hex.r);
    const isLeavingBridge = currentCoord.q === bridgeRule.hex.q && currentCoord.r === bridgeRule.hex.r;

    if (isEnteringBridge || isLeavingBridge) {
      const moveDir = getDirectionBetween(currentCoord, targetCoord);
      if (moveDir !== null) {
        const allowedDirs = isEnteringBridge ? bridgeRule.allowedEntryDirections : bridgeRule.allowedExitDirections;
        if (!allowedDirs.includes(moveDir)) {
          return { isValid: false, reason: 'El puente solo permite entradas y salidas por las conexiones de carretera.' };
        }
      }
    }
  }

  return { isValid: true, targetCoord };
}

export interface AvailableDoubleOption {
  value: number;
  label: string;
  actionKey: string;
  allowed: boolean;
  requirementText?: string;
}

/**
 * Finds all pairs of identical dice in the given available dice list
 * and determines the special double actions they can perform.
 */
export function getAvailableDoubles(
  section: ShermanSectionType,
  availableDice: number[],
  sherman: ShermanState
): AvailableDoubleOption[] {
  const counts: Record<number, number> = {};
  availableDice.forEach((d) => {
    counts[d] = (counts[d] || 0) + 1;
  });

  const doubles: AvailableDoubleOption[] = [];

  Object.entries(counts).forEach(([valStr, count]) => {
    const val = parseInt(valStr, 10);
    if (count >= 2) {
      if (section === 'maneuver') {
        const driverActive = sherman.crew.driver.status === 'active';
        const assistantActive = sherman.crew.assistant.status === 'active';

        doubles.push({
          value: val,
          label: `⚡ Doble [${val}, ${val}]: 🚗 Avanzar (Conductor)`,
          actionKey: 'double_move',
          allowed: driverActive && !sherman.isImmobilized,
          requirementText: !driverActive
            ? 'Requiere Conductor vivo'
            : sherman.isImmobilized
            ? 'Inmovilizado'
            : 'Conductor listo',
        });

        doubles.push({
          value: val,
          label: `⚡ Doble [${val}, ${val}]: ↺ Girar Izq (-60°) (Asistente)`,
          actionKey: 'double_turn_left',
          allowed: assistantActive,
          requirementText: assistantActive ? 'Asistente activo' : 'Requiere Asistente Conductor vivo',
        });

        doubles.push({
          value: val,
          label: `⚡ Doble [${val}, ${val}]: ↻ Girar Der (+60°) (Asistente)`,
          actionKey: 'double_turn_right',
          allowed: assistantActive,
          requirementText: assistantActive ? 'Asistente activo' : 'Requiere Asistente Conductor vivo',
        });
      } else if (section === 'attack') {
        const gunnerActive = sherman.crew.gunner.status === 'active';
        const loaderActive = sherman.crew.loader.status === 'active';
        const canDCP = gunnerActive && sherman.isLoaded && !sherman.isTurretDamaged;

        doubles.push({
          value: val,
          label: `Doble [${val}, ${val}]: DISPARAR CAÑÓN (Artillero)`,
          actionKey: 'double_dcp',
          allowed: canDCP,
          requirementText: !gunnerActive
            ? 'Requiere Artillero vivo'
            : !sherman.isLoaded
            ? 'Requiere Cañón Cargado'
            : sherman.isTurretDamaged
            ? 'Torreta dañada'
            : 'Artillero listo',
        });

        doubles.push({
          value: val,
          label: `Doble [${val}, ${val}]: CARGAR CAÑÓN (Cargador)`,
          actionKey: 'double_load',
          allowed: loaderActive && !sherman.isLoaded,
          requirementText: !loaderActive
            ? 'Requiere Cargador vivo'
            : sherman.isLoaded
            ? 'Cañón ya cargado'
            : 'Cargador listo',
        });
      } else if (section === 'misc') {
        const canHullDown = !sherman.isImmobilized && !sherman.isHullDown;
        doubles.push({
          value: val,
          label: `Doble [${val}, ${val}]: DESENFILADA (+2 Cobertura)`,
          actionKey: 'double_hull_down',
          allowed: canHullDown,
          requirementText: sherman.isImmobilized
            ? 'Imposible si está Inmovilizado'
            : sherman.isHullDown
            ? 'Ya se encuentra en Desenfilada'
            : 'Disponible',
        });
      }
    }
  });

  return doubles;
}

/**
 * Resolves Machine Gun (MG) attack against an adjacent enemy infantry unit.
 * Rules: Requires distance === 1. 2d6 roll >= 7 eliminates the infantry.
 * Terrain modifiers do not apply.
 */
export function executeMGAttack(
  shermanCoord: AxialCoord,
  targetInfantry: EnemyInfantry,
  presetRolls?: [number, number]
): {
  success: boolean;
  distance: number;
  rolls: [number, number];
  total: number;
  detail: string;
} {
  const dist = hexDistance(shermanCoord, targetInfantry.coord);
  if (dist !== 1) {
    return {
      success: false,
      distance: dist,
      rolls: [0, 0],
      total: 0,
      detail: `Objetivo fuera de alcance para MG: La infantería se encuentra a distancia ${dist} (debe ser adyacente, distancia 1).`,
    };
  }

  const d1 = presetRolls ? presetRolls[0] : Math.floor(Math.random() * 6) + 1;
  const d2 = presetRolls ? presetRolls[1] : Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;
  const success = total >= 7;

  return {
    success,
    distance: dist,
    rolls: [d1, d2],
    total,
    detail: `Disparo de Ametralladora (MG) a Infantería (${targetInfantry.coord.q},${targetInfantry.coord.r}): Tirada 2d6 [${d1}, ${d2}] = ${total} (Req 7+) ➔ ${
      success ? '¡ELIMINADA!' : 'FALLADO'
    }`,
  };
}

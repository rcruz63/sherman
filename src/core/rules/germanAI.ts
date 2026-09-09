/**
 * German Tank Operations Engine (Phase 6)
 * Complete and exact implementation of Mike Lambo's "Sherman Solitario" (Pages 11-14)
 */

import { AxialCoord, BoardState, EnemyTank, Facing } from '../../types/game';
import { getDirectionBetween, hexDistance, hexNeighbor } from '../hex/math';
import { getClosestDirection } from '../hex/facing';
import { OPPOSITE_FACING } from '../hex/mapValidator';
import {
  calculateHitDifficulty,
  resolveDamageCheck,
  resolveDamageEffect,
  resolveCrewCasualtyRoll,
} from './combat';
import { SECTOR_NAMES } from './logUtils';

export type GermanAIAction =
  | 'DISPARAR'
  | 'MOVER'
  | 'RETROCEDER'
  | 'GIRAR'
  | 'HUMO'
  | 'DESENFILADA'
  | 'REPARAR';

export type GermanTerrainColumn = 'ROAD' | 'FIELD' | 'MUD' | 'DAMAGED';

export interface TableEntry {
  primary: GermanAIAction;
  secondary?: GermanAIAction;
}

/**
 * Tabla de Operaciones Alemanas (Página 11)
 */
export const GERMAN_OPERATIONS_TABLE: Record<GermanTerrainColumn, Record<number, TableEntry>> = {
  ROAD: {
    1: { primary: 'DISPARAR', secondary: 'GIRAR' },
    2: { primary: 'MOVER', secondary: 'GIRAR' },
    3: { primary: 'DISPARAR', secondary: 'MOVER' },
    4: { primary: 'MOVER', secondary: 'GIRAR' },
    5: { primary: 'MOVER', secondary: 'RETROCEDER' },
    6: { primary: 'DISPARAR', secondary: 'HUMO' },
  },
  FIELD: {
    1: { primary: 'DISPARAR', secondary: 'GIRAR' },
    2: { primary: 'MOVER', secondary: 'GIRAR' },
    3: { primary: 'DISPARAR', secondary: 'MOVER' },
    4: { primary: 'GIRAR' },
    5: { primary: 'MOVER', secondary: 'RETROCEDER' },
    6: { primary: 'DISPARAR', secondary: 'DESENFILADA' },
  },
  MUD: {
    1: { primary: 'DISPARAR' },
    2: { primary: 'GIRAR' },
    3: { primary: 'MOVER', secondary: 'GIRAR' },
    4: { primary: 'MOVER', secondary: 'RETROCEDER' },
    5: { primary: 'DISPARAR' },
    6: { primary: 'HUMO' },
  },
  DAMAGED: {
    1: { primary: 'REPARAR' },
    2: { primary: 'GIRAR' },
    3: { primary: 'MOVER', secondary: 'GIRAR' },
    4: { primary: 'MOVER', secondary: 'RETROCEDER' },
    5: { primary: 'DISPARAR' },
    6: { primary: 'HUMO' },
  },
};

export interface AIActionResult {
  tankId: string;
  tankType: string;
  startingTerrain: string;
  column: GermanTerrainColumn;
  diceCount: number;
  diceRolls: number[];
  actionTaken: string;
  detail: string;
}

/**
 * Checks whether a hex can be entered by a German tank according to movement rules:
 * - Inside map bounds
 * - Not woods or water
 * - Not occupied by other German tanks or trucks
 * - Not occupied by Sherman (unless ignoreSherman is true for Rule 1 front accessibility check)
 * - CAN enter building hexes occupied by German infantry
 */
export function isHexAccessibleForGermanTank(
  tank: EnemyTank,
  targetCoord: AxialCoord,
  boardState: BoardState,
  ignoreSherman: boolean = false
): boolean {
  const targetTile = boardState.tiles.get(`${targetCoord.q},${targetCoord.r}`);
  if (!targetTile) return false;

  // Cannot enter woods or water (unless bridge)
  if (targetTile.terrain === 'woods' || (targetTile.terrain === 'water' && !targetTile.isBridge)) {
    return false;
  }

  // Cannot enter hex occupied by other German tanks
  const tankInHex = boardState.enemyTanks.find(
    (t) =>
      t.id !== tank.id &&
      t.status !== 'destroyed' &&
      t.coord.q === targetCoord.q &&
      t.coord.r === targetCoord.r
  );
  if (tankInHex) return false;

  // Cannot enter hex occupied by German truck (Mission 5)
  const truckInHex = boardState.enemyTrucks?.find(
    (tr) =>
      tr.status !== 'destroyed' &&
      tr.coord.q === targetCoord.q &&
      tr.coord.r === targetCoord.r
  );
  if (truckInHex) return false;

  // Cannot enter Sherman hex (unless checking front obstacle per Rule 1)
  if (!ignoreSherman) {
    if (
      boardState.sherman.coord.q === targetCoord.q &&
      boardState.sherman.coord.r === targetCoord.r
    ) {
      return false;
    }
  }

  // Bridge Rules
  const bridgeRule = boardState.missionData?.specialRules?.bridge;
  const currentTile = boardState.tiles.get(`${tank.coord.q},${tank.coord.r}`);
  if (bridgeRule) {
    const isEnteringBridge =
      targetTile.isBridge ||
      (targetCoord.q === bridgeRule.hex.q && targetCoord.r === bridgeRule.hex.r);
    const isLeavingBridge =
      tank.coord.q === bridgeRule.hex.q && tank.coord.r === bridgeRule.hex.r;
    if (isEnteringBridge || isLeavingBridge) {
      const moveDir = getDirectionBetween(tank.coord, targetCoord);
      if (moveDir !== null) {
        const allowedDirs = isEnteringBridge
          ? bridgeRule.allowedEntryDirections
          : bridgeRule.allowedExitDirections;
        if (!allowedDirs.includes(moveDir)) return false;
      }
    }
  } else if (targetTile.isBridge || currentTile?.isBridge) {
    const moveDir = getDirectionBetween(tank.coord, targetCoord);
    if (moveDir !== null) {
      if (targetTile.isBridge) {
        const oppDir = OPPOSITE_FACING[moveDir];
        if (!targetTile.roadEdges || !targetTile.roadEdges.includes(oppDir)) {
          return false;
        }
      }
      if (currentTile?.isBridge) {
        if (!currentTile.roadEdges || !currentTile.roadEdges.includes(moveDir)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Calculates facing turn towards Sherman according to the 4 strict AI Turning Rules (Pages 13-14):
 * Rule 1: Directly facing Sherman + front hex blocked (not by Sherman) -> Turn 1 spine to accessible hex.
 * Rule 2: Sherman in direct rear -> Turn 1 spine to accessible hex.
 * Rule 3: If directly facing Sherman (front hex accessible) -> Do NOT turn.
 * Rule 4: Otherwise -> Turn towards Sherman by smallest angle (left or right).
 */
export function calculateAITurningFacing(
  tank: EnemyTank,
  boardState: BoardState,
  randomTieBreaker?: number // 0: left, 1: right (for tests)
): Facing {
  const shermanCoord = boardState.sherman.coord;
  const exactDir = getDirectionBetween(tank.coord, shermanCoord);
  const isDirectlyFacing = exactDir !== null && exactDir === tank.facing;
  const isDirectRear = exactDir !== null && exactDir === ((tank.facing + 3) % 6);

  const leftFacing = ((tank.facing + 5) % 6) as Facing;
  const rightFacing = ((tank.facing + 1) % 6) as Facing;
  const leftHex = hexNeighbor(tank.coord, leftFacing);
  const rightHex = hexNeighbor(tank.coord, rightFacing);

  // Rule 1: Directly facing Sherman + front hex blocked (not due to Sherman itself)
  if (isDirectlyFacing) {
    const frontHex = hexNeighbor(tank.coord, tank.facing);
    const isFrontAccessible = isHexAccessibleForGermanTank(tank, frontHex, boardState, true);
    if (!isFrontAccessible) {
      const leftOk = isHexAccessibleForGermanTank(tank, leftHex, boardState, false);
      const rightOk = isHexAccessibleForGermanTank(tank, rightHex, boardState, false);
      if (leftOk && !rightOk) return leftFacing;
      if (rightOk && !leftOk) return rightFacing;
      const pickRight =
        randomTieBreaker !== undefined ? randomTieBreaker === 1 : Math.random() < 0.5;
      return pickRight ? rightFacing : leftFacing;
    }
  }

  // Rule 2: Directly in line with Sherman in exact rear
  if (isDirectRear) {
    const leftOk = isHexAccessibleForGermanTank(tank, leftHex, boardState, false);
    const rightOk = isHexAccessibleForGermanTank(tank, rightHex, boardState, false);
    if (leftOk && !rightOk) return leftFacing;
    if (rightOk && !leftOk) return rightFacing;
    const pickRight =
      randomTieBreaker !== undefined ? randomTieBreaker === 1 : Math.random() < 0.5;
    return pickRight ? rightFacing : leftFacing;
  }

  // Rule 3: Directly facing Sherman (and front hex is accessible) -> Do NOT turn!
  if (isDirectlyFacing) {
    return tank.facing;
  }

  // Rule 4: Turn towards Sherman by smallest angle
  const closestDir = getClosestDirection(tank.coord, shermanCoord);
  const diff = (closestDir - tank.facing + 6) % 6;

  if (diff === 1 || diff === 2) {
    return rightFacing;
  } else if (diff === 4 || diff === 5) {
    return leftFacing;
  } else {
    // Exact rear (diff === 3, if not in straight hex line)
    const pickRight =
      randomTieBreaker !== undefined ? randomTieBreaker === 1 : Math.random() < 0.5;
    return pickRight ? rightFacing : leftFacing;
  }
}

/**
 * Determines the starting table column and dice count for a German tank:
 * - Damaged: Column DAMAGED, 2 dice.
 * - Road: Column ROAD, 4 dice.
 * - Mud: Column MUD, 3 dice.
 * - Field / Other: Column FIELD, 4 dice.
 */
export function getTankInitialState(
  tank: EnemyTank,
  boardState: BoardState
): { column: GermanTerrainColumn; diceCount: number; startingTerrain: string } {
  const tile = boardState.tiles.get(`${tank.coord.q},${tank.coord.r}`);
  const terrain = tile?.terrain || 'field';

  if (tank.status === 'damaged') {
    return { column: 'DAMAGED', diceCount: 2, startingTerrain: terrain };
  }
  if (terrain === 'road') {
    return { column: 'ROAD', diceCount: 4, startingTerrain: 'road' };
  }
  if (terrain === 'mud') {
    return { column: 'MUD', diceCount: 3, startingTerrain: 'mud' };
  }
  return { column: 'FIELD', diceCount: 4, startingTerrain: terrain };
}

export interface PresetCombatRolls {
  hitRoll?: [number, number];
  dmgRoll?: number;
  effectRoll?: number;
  kiaRoll?: number;
}

/**
 * Attempts to execute a single German AI action.
 * Returns true if action occurred, false if blocked/impossible (allowing fallback).
 */
function executeSingleAIAction(
  action: GermanAIAction,
  tank: EnemyTank,
  boardState: BoardState,
  presetCombat?: PresetCombatRolls
): { success: boolean; detail: string; fired?: boolean } {
  if (action === 'DISPARAR') {
    // First check LOS
    const hitCalc = calculateHitDifficulty(
      { coord: tank.coord, facing: tank.facing },
      {
        coord: boardState.sherman.coord,
        facing: boardState.sherman.facing,
        size: 4,
        hasSmoke: boardState.sherman.hasSmoke,
        isHullDown: boardState.sherman.isHullDown,
      },
      boardState
    );

    if (!hitCalc.hasLOS) {
      return { success: false, detail: 'Sin Línea de Visión con el Sherman' };
    }

    // Shot occurs (even if difficulty > 12)
    const d1 = presetCombat?.hitRoll ? presetCombat.hitRoll[0] : Math.floor(Math.random() * 6) + 1;
    const d2 = presetCombat?.hitRoll ? presetCombat.hitRoll[1] : Math.floor(Math.random() * 6) + 1;
    const roll2d6 = d1 + d2;
    const hitSuccess = roll2d6 >= hitCalc.totalDifficulty;

    const sectorName = SECTOR_NAMES[hitCalc.impactSector] || hitCalc.impactSector;
    const mods: string[] = [`Dist ${hitCalc.baseDistance}`, `TAM 4`];
    if (hitCalc.buildingModifier) mods.push('Edificio +1');
    if (hitCalc.treeLineModifier) mods.push(`Arboleda +${hitCalc.treeLineModifier}`);
    if (hitCalc.smokeModifier) mods.push('Humo +1');
    if (hitCalc.hullDownModifier) mods.push('Desenfilada +2');
    if (hitCalc.rearArcModifier) mods.push('Arco Trasero +1');
    const modStr = mods.join(' + ');

    if (!hitSuccess) {
      return {
        success: true,
        detail: `Disparo al Sherman (Dif ${hitCalc.totalDifficulty} [${modStr}]) ➔ Tirada 2d6 = [${d1}, ${d2}] = ${roll2d6} ➔ FALLADO`,
        fired: true,
      };
    }

    // Hit! Paso 2: ¿Daños? 1d6 >= Sherman Armor - Tank Penetration
    const shermanArmor = boardState.sherman.armor[hitCalc.impactSector];
    const dDmg = presetCombat?.dmgRoll ?? (Math.floor(Math.random() * 6) + 1);
    const damageRes = resolveDamageCheck(tank.penetration, shermanArmor, dDmg);

    if (damageRes.result === 'NO_EFFECT') {
      return {
        success: true,
        detail: `Disparo al Sherman (Dif ${hitCalc.totalDifficulty}) ➔ ¡IMPACTO! (2d6=${roll2d6}) ➔ Paso 2 ¿Daños?: 1d6 [${dDmg}] < Req ${damageRes.threshold} (Blindaje ${sectorName} ${shermanArmor} - PEN ${tank.penetration}) ➔ REBOTADO`,
        fired: true,
      };
    }

    // Damage confirmed! Paso 3: ¿Qué Daños? (1d6)
    const dEff = presetCombat?.effectRoll ?? (Math.floor(Math.random() * 6) + 1);
    const effect = resolveDamageEffect('sherman', dEff);
    let consequenceDetail = effect.description;

    if (effect.outcome === 'DESTROYED') {
      boardState.sherman.isDestroyed = true;
      consequenceDetail = '¡Sherman Destruido!';
    } else if (effect.outcome === 'CREW_CASUALTY') {
      const dKia = presetCombat?.kiaRoll ?? (Math.floor(Math.random() * 6) + 1);
      const isHatched = boardState.sherman.commanderPosition === 'hatched';
      const casualty = resolveCrewCasualtyRoll(dKia, isHatched);
      if (casualty) {
        boardState.sherman.crew[casualty.role].status = 'kia';
        consequenceDetail = `Comprueba KIA (1d6=[${dKia}]) ➔ ${casualty.description}`;
      } else {
        consequenceDetail = `Comprueba KIA (1d6=[${dKia}]) ➔ Comandante en Interior ➔ ¡Sin bajas!`;
      }
    } else if (effect.outcome === 'DAMAGED_FIRE') {
      boardState.sherman.fireLevel += 1;
      consequenceDetail = `¡Fuego! (+1 Nivel de fuego, total 🔥 ${boardState.sherman.fireLevel})`;
    } else if (effect.outcome === 'TURRET_DAMAGED') {
      boardState.sherman.isTurretDamaged = true;
      consequenceDetail = 'Torreta dañada';
    } else if (effect.outcome === 'IMMOBILIZED') {
      boardState.sherman.isImmobilized = true;
      if (boardState.sherman.isHullDown) {
        boardState.sherman.isHullDown = false;
        consequenceDetail = 'Inmovilizado (pierde Desenfilada)';
      } else {
        consequenceDetail = 'Inmovilizado';
      }
    }

    return {
      success: true,
      detail: `💥 ¡IMPACTO Y DAÑO EN SHERMAN! (2d6=${roll2d6}, 1d6 daño=[${dDmg}] >= Req ${damageRes.threshold}) ➔ Paso 3: Tirada 1d6=[${dEff}] ➔ ${consequenceDetail}`,
      fired: true,
    };
  }

  if (action === 'MOVER') {
    const forwardHex = hexNeighbor(tank.coord, tank.facing);
    const isAccessible = isHexAccessibleForGermanTank(tank, forwardHex, boardState, false);
    if (!isAccessible) {
      return { success: false, detail: 'Hexágono frontal inaccesible o bloqueado' };
    }
    tank.coord = forwardHex;
    tank.isHullDown = false; // Move removes hull down
    return {
      success: true,
      detail: `Avanza 1 hexágono hacia adelante a (${forwardHex.q},${forwardHex.r})`,
    };
  }

  if (action === 'RETROCEDER') {
    const reverseFacing = ((tank.facing + 3) % 6) as Facing;
    const rearHex = hexNeighbor(tank.coord, reverseFacing);
    const isAccessible = isHexAccessibleForGermanTank(tank, rearHex, boardState, false);
    if (!isAccessible) {
      return { success: false, detail: 'Hexágono trasero inaccesible o bloqueado' };
    }
    tank.coord = rearHex;
    tank.isHullDown = false; // Reverse removes hull down
    return {
      success: true,
      detail: `Retrocede 1 hexágono a (${rearHex.q},${rearHex.r})`,
    };
  }

  if (action === 'GIRAR') {
    const oldFacing = tank.facing;
    const newFacing = calculateAITurningFacing(tank, boardState);
    if (newFacing !== oldFacing) {
      tank.facing = newFacing;
      tank.isHullDown = false; // Turn removes hull down
      return {
        success: true,
        detail: `Gira encaramiento de ${oldFacing} a ${newFacing}`,
      };
    }
    return {
      success: true,
      detail: `Mantiene encaramiento ${oldFacing} frente al Sherman (Regla 3)`,
    };
  }

  if (action === 'HUMO') {
    if (tank.hasSmoke) {
      return { success: false, detail: 'Ya dispone de un marcador de Humo activo' };
    }
    tank.hasSmoke = true;
    return {
      success: true,
      detail: 'Despliega defensas de Humo (+1 a la dificultad para impactarle)',
    };
  }

  if (action === 'DESENFILADA') {
    if (tank.isHullDown) {
      return { success: false, detail: 'Ya se encuentra en Desenfilada' };
    }
    tank.isHullDown = true;
    return {
      success: true,
      detail: 'Adopta posición de Desenfilada (+2 cobertura)',
    };
  }

  if (action === 'REPARAR') {
    if (tank.status !== 'damaged') {
      return { success: false, detail: 'El tanque no se encuentra dañado' };
    }
    tank.status = 'operational';
    return {
      success: true,
      detail: 'Reparado: Retira marcador de Dañado y vuelve a estado operativo',
    };
  }

  return { success: false, detail: `Acción desconocida ${action}` };
}

/**
 * Executes German AI Activation for a single enemy tank.
 * Steps:
 * 1. Determines initial terrain column and dice count.
 * 2. Rolls and sorts dice ascending.
 * 3. Resolves 1 action per die using primary > secondary fallback.
 */
export function executeAITankTurn(
  tank: EnemyTank,
  boardState: BoardState,
  presetRolls?: number[],
  presetCombat?: PresetCombatRolls
): AIActionResult {
  if (tank.status === 'destroyed') {
    return {
      tankId: tank.id,
      tankType: tank.type,
      startingTerrain: 'none',
      column: 'ROAD',
      diceCount: 0,
      diceRolls: [],
      actionTaken: 'NONE',
      detail: `Tanque ${tank.type.toUpperCase()} #${tank.id} destruido no actúa.`,
    };
  }

  // 1. Initial State determines column and dice count
  const { column, diceCount, startingTerrain } = getTankInitialState(tank, boardState);

  // 2. Roll dice (or use preset rolls) and sort ascending
  const diceRolls: number[] = presetRolls && presetRolls.length > 0 ? [...presetRolls] : [];
  if (diceRolls.length === 0) {
    for (let i = 0; i < diceCount; i++) {
      diceRolls.push(Math.floor(Math.random() * 6) + 1);
    }
  }
  diceRolls.sort((a, b) => a - b);

  // 3. Resolve dice sequentially in ascending order
  const logs: string[] = [];
  const actionsPerformed: string[] = [];

  for (const die of diceRolls) {
    // If Sherman was destroyed by an earlier shot, stop activation
    if (boardState.sherman.isDestroyed) {
      logs.push('Sherman destruido: Fin del combate.');
      break;
    }

    const entry = GERMAN_OPERATIONS_TABLE[column][die];
    if (!entry) continue;

    // Try primary action
    const primaryRes = executeSingleAIAction(entry.primary, tank, boardState, presetCombat);
    if (primaryRes.success) {
      logs.push(`[Dado ${die} ➔ ${entry.primary}]: ${primaryRes.detail}`);
      actionsPerformed.push(entry.primary);
    } else if (entry.secondary) {
      // Primary failed -> Try secondary action
      const secondaryRes = executeSingleAIAction(entry.secondary, tank, boardState, presetCombat);
      if (secondaryRes.success) {
        logs.push(
          `[Dado ${die} ➔ ${entry.secondary} (secundaria por ${entry.primary} imposible)]: ${secondaryRes.detail}`
        );
        actionsPerformed.push(entry.secondary);
      } else {
        logs.push(
          `[Dado ${die} ➔ Descartado]: No se pudo realizar ${entry.primary} (${primaryRes.detail}) ni ${entry.secondary} (${secondaryRes.detail}).`
        );
      }
    } else {
      logs.push(`[Dado ${die} ➔ Descartado]: No se pudo realizar ${entry.primary} (${primaryRes.detail}).`);
    }
  }

  return {
    tankId: tank.id,
    tankType: tank.type,
    startingTerrain,
    column,
    diceCount,
    diceRolls,
    actionTaken: actionsPerformed.join(', ') || 'NONE',
    detail: logs.join(' | '),
  };
}

/**
 * Runs activation for all active German tanks sorted by distance to Sherman (ascending).
 * Ties are broken randomly or deterministically.
 */
export function runAllGermanActivations(
  boardState: BoardState,
  presetTankRolls?: Record<string, number[]>,
  presetCombat?: PresetCombatRolls
): AIActionResult[] {
  const activeTanks = [...boardState.enemyTanks].filter((t) => t.status !== 'destroyed');

  // Sort by distance to Sherman ascending (closest first)
  activeTanks.sort((a, b) => {
    const distA = hexDistance(a.coord, boardState.sherman.coord);
    const distB = hexDistance(b.coord, boardState.sherman.coord);
    if (distA !== distB) return distA - distB;
    // Tie-break: random roll or stable tie-break
    return (a.spawnNumber ?? 0) - (b.spawnNumber ?? 0);
  });

  const results: AIActionResult[] = [];
  for (const tank of activeTanks) {
    if (boardState.sherman.isDestroyed) {
      break; // Sherman already destroyed
    }
    const preset = presetTankRolls ? presetTankRolls[tank.id] : undefined;
    const res = executeAITankTurn(tank, boardState, preset, presetCombat);
    results.push(res);
  }

  return results;
}

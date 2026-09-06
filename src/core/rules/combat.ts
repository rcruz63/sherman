/**
 * Deterministic Combat Rules Engine
 */

import { ArmorSector, AxialCoord, BoardState, Facing } from '../../types/game';
import { checkLOS } from '../hex/los';
import { getTargetImpactSector, isTargetInRearArc } from '../hex/facing';
import { coordKey } from '../hex/math';

export interface AttackerEntity {
  coord: AxialCoord;
  facing: Facing;
}

export interface TargetEntity {
  coord: AxialCoord;
  facing: Facing;
  size: number; // TAM
  hasSmoke: boolean;
  isHullDown: boolean;
}

export interface HitDifficultyBreakdown {
  baseDistance: number;
  targetSize: number;
  baseDifficulty: number;
  treeLineModifier: number;
  buildingModifier: number;
  smokeModifier: number;
  hullDownModifier: number;
  rearArcModifier: number;
  totalDifficulty: number;
  hasLOS: boolean;
  losReason?: string;
  impactSector: ArmorSector;
}

/**
 * Calculates hit difficulty for a 2d6 roll based on distance, size, terrain, smoke, hull down, and facing.
 * Modifiers:
 * - Base = Target TAM + Hex Distance
 * - +1 per tree line crossed along LOS (excluding attacker border)
 * - +1 if target is in Building terrain
 * - +1 if target has Smoke
 * - +2 if target is in Hull Down (Desenfilada)
 * - +1 if target is in attacker's rear arc
 */
export function calculateHitDifficulty(
  attacker: AttackerEntity,
  target: TargetEntity,
  boardState: BoardState
): HitDifficultyBreakdown {
  const los = checkLOS(attacker.coord, target.coord, boardState);
  const distance = los.distance;
  const targetSize = target.size;
  const baseDifficulty = targetSize + distance;

  const impactSector = getTargetImpactSector(target.coord, target.facing, attacker.coord);

  if (!los.hasLOS) {
    return {
      baseDistance: distance,
      targetSize,
      baseDifficulty,
      treeLineModifier: 0,
      buildingModifier: 0,
      smokeModifier: 0,
      hullDownModifier: 0,
      rearArcModifier: 0,
      totalDifficulty: Infinity,
      hasLOS: false,
      losReason: los.reason,
      impactSector,
    };
  }

  const treeLineModifier = los.treeLineCount;

  const targetTile = boardState.tiles.get(coordKey(target.coord));
  const buildingModifier = targetTile?.terrain === 'building' ? 1 : 0;
  const smokeModifier = target.hasSmoke ? 1 : 0;
  const hullDownModifier = target.isHullDown ? 2 : 0;
  const rearArcModifier = isTargetInRearArc(attacker.coord, attacker.facing, target.coord) ? 1 : 0;

  const totalDifficulty =
    baseDifficulty +
    treeLineModifier +
    buildingModifier +
    smokeModifier +
    hullDownModifier +
    rearArcModifier;

  return {
    baseDistance: distance,
    targetSize,
    baseDifficulty,
    treeLineModifier,
    buildingModifier,
    smokeModifier,
    hullDownModifier,
    rearArcModifier,
    totalDifficulty,
    hasLOS: true,
    impactSector,
  };
}

export type DamageResultType = 'NO_EFFECT' | 'DAMAGED' | 'DESTROYED';

export interface DamageCheckResult {
  attackerPen: number;
  targetArmor: number;
  roll: number;
  totalAttack: number;
  result: DamageResultType;
  detail: string;
}

/**
 * Resolves penetration vs armor check.
 * Effective Attack = Attacker PEN + Roll (2d6).
 * - Total < Target Armor -> NO_EFFECT (Bounce / Sin penetración)
 * - Total >= Target Armor and Total < Target Armor + 3 -> DAMAGED
 * - Total >= Target Armor + 3 -> DESTROYED
 */
export function resolveDamageCheck(
  attackerPen: number,
  targetArmor: number,
  roll: number
): DamageCheckResult {
  const totalAttack = attackerPen + roll;

  if (totalAttack < targetArmor) {
    return {
      attackerPen,
      targetArmor,
      roll,
      totalAttack,
      result: 'NO_EFFECT',
      detail: `PEN ${attackerPen} + Tirada ${roll} = ${totalAttack} vs Blindaje ${targetArmor}: Sin Penetración`,
    };
  } else if (totalAttack < targetArmor + 3) {
    return {
      attackerPen,
      targetArmor,
      roll,
      totalAttack,
      result: 'DAMAGED',
      detail: `PEN ${attackerPen} + Tirada ${roll} = ${totalAttack} vs Blindaje ${targetArmor}: Objetivo Dañado`,
    };
  } else {
    return {
      attackerPen,
      targetArmor,
      roll,
      totalAttack,
      result: 'DESTROYED',
      detail: `PEN ${attackerPen} + Tirada ${roll} = ${totalAttack} vs Blindaje ${targetArmor}: Objetivo Destruido`,
    };
  }
}

/**
 * Resolves specific damage tables (e.g., German damage or Sherman damage effect tables).
 */
export function resolveDamageEffect(
  targetType: 'germanTank' | 'sherman',
  roll: number
): { outcome: string; description: string } {
  if (targetType === 'germanTank') {
    if (roll <= 3) return { outcome: 'DAMAGED_GUN', description: 'Cañón Dañado (-1 a dados de IA)' };
    if (roll <= 5) return { outcome: 'IMMOBILIZED', description: 'Inmovilizado' };
    if (roll <= 8) return { outcome: 'CREW_CASUALTY', description: 'Baja en Tripulación' };
    return { outcome: 'DESTROYED', description: 'Tanque Destruido' };
  } else {
    if (roll <= 3) return { outcome: 'TURRET_DAMAGED', description: 'Torreta Dañada' };
    if (roll <= 5) return { outcome: 'IMMOBILIZED', description: 'Inmovilizado' };
    if (roll <= 7) return { outcome: 'CREW_CASUALTY', description: 'Baja de Tripulante' };
    if (roll <= 9) return { outcome: 'FIRE_STARTED', description: 'Fuego iniciado (+1 Nivel de Fuego)' };
    return { outcome: 'DESTROYED', description: 'Sherman Destruido' };
  }
}

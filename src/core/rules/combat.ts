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
  threshold: number;
  totalAttack?: number; // legacy backwards-compat
  result: DamageResultType;
  detail: string;
}

/**
 * Resolves penetration vs armor check (Paso 2: ¿DAÑOS?).
 * Roll 1d6: Requires 1d6 >= Target Armor - Attacker PEN.
 */
export function resolveDamageCheck(
  attackerPen: number,
  targetArmor: number,
  roll: number
): DamageCheckResult {
  const threshold = targetArmor - attackerPen;
  const isDamage = roll >= threshold;

  if (!isDamage) {
    return {
      attackerPen,
      targetArmor,
      roll,
      threshold,
      totalAttack: attackerPen + roll,
      result: 'NO_EFFECT',
      detail: `Tirada 1d6 [${roll}] < Blindaje ${targetArmor} - PEN ${attackerPen} (Req ${threshold}): Sin Penetración`,
    };
  } else {
    return {
      attackerPen,
      targetArmor,
      roll,
      threshold,
      totalAttack: attackerPen + roll,
      result: 'DAMAGED',
      detail: `Tirada 1d6 [${roll}] >= Blindaje ${targetArmor} - PEN ${attackerPen} (Req ${threshold}): ¡CAUSA DAÑO!`,
    };
  }
}

export type DamageEffectOutcome =
  | 'DAMAGED'
  | 'TURRET_DAMAGED'
  | 'DESTROYED'
  | 'DAMAGED_FIRE'
  | 'IMMOBILIZED'
  | 'CREW_CASUALTY';

export interface DamageEffectResult {
  outcome: DamageEffectOutcome;
  description: string;
}

/**
 * Resolves specific damage tables (Paso 3: ¿Qué Daños?, tirada 1d6).
 * Official rules:
 * German:
 * - 1-2: Dañado > Destruido
 * - 3-4: Torreta dañada
 * - 5-6: Destruido
 * Sherman:
 * - 1: Destruido
 * - 2: Comprueba KIA
 * - 3-4: Dañado > ¡Fuego! +1 Nivel de fuego
 * - 5: Inmovilizado
 * - 6: Comprueba KIA
 */
export function resolveDamageEffect(
  targetType: 'germanTank' | 'sherman',
  roll: number
): DamageEffectResult {
  if (targetType === 'germanTank') {
    if (roll <= 2) {
      return { outcome: 'DAMAGED', description: 'Dañado (si ya estaba dañado > Destruido)' };
    }
    if (roll <= 4) {
      return { outcome: 'TURRET_DAMAGED', description: 'Torreta Dañada' };
    }
    return { outcome: 'DESTROYED', description: 'Tanque Destruido' };
  } else {
    if (roll === 1) {
      return { outcome: 'DESTROYED', description: 'Sherman Destruido' };
    }
    if (roll === 2) {
      return { outcome: 'CREW_CASUALTY', description: 'Comprueba KIA' };
    }
    if (roll <= 4) {
      return { outcome: 'DAMAGED_FIRE', description: 'Fuego! (+1 Nivel de fuego)' };
    }
    if (roll === 5) {
      return { outcome: 'TURRET_DAMAGED', description: 'Torreta dañada' };
    }
    return { outcome: 'IMMOBILIZED', description: 'Inmovilizado' };
  }
}

export const CREW_ROLES_ORDER: ('commander' | 'loader' | 'gunner' | 'driver' | 'assistant')[] = [
  'commander',
  'loader',
  'gunner',
  'driver',
  'assistant',
];

/**
 * Helper to determine which crew member is KIA from a 1d6 roll:
 * 1: Commander, 2: Loader, 3: Gunner, 4: Driver, 5: Assistant
 * 6: Commander only if Hatched (Asomado).
 */
export function resolveCrewCasualtyRoll(
  roll1d6: number,
  isCommanderHatched: boolean
): { role: 'commander' | 'loader' | 'gunner' | 'driver' | 'assistant'; description: string } | null {
  if (roll1d6 >= 1 && roll1d6 <= 5) {
    const role = CREW_ROLES_ORDER[roll1d6 - 1];
    const names: Record<string, string> = {
      commander: 'Comandante',
      loader: 'Cargador',
      gunner: 'Artillero',
      driver: 'Conductor',
      assistant: 'Asistente Conductor',
    };
    return { role, description: `${names[role]} KIA` };
  }
  if (roll1d6 === 6) {
    if (isCommanderHatched) {
      return { role: 'commander', description: 'Comandante KIA (por estar Asomado)' };
    }
    return null; // Afortunado: Comandante estaba Interior
  }
  return null;
}

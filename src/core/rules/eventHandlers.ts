/**
 * Mission End-of-Turn Event Resolvers
 */

import { BoardState, EnemyTruck } from '../../types/game';
import { coordKey } from '../hex/math';
import { resolveDamageCheck, DamageCheckResult } from './combat';

export interface MinesEventResult {
  triggered: boolean;
  affected: boolean;
  detail: string;
  damageResult?: DamageCheckResult;
}

export interface MoveTruckResult {
  triggered: boolean;
  moved: boolean;
  escaped: boolean;
  detail: string;
  truck?: EnemyTruck;
}

/**
 * Resolves the MINES event logic:
 * "¡Minas! Si el Sherman está en carretera y no está Inmovilizado, impacto automático (Pen 0 vs BL 4)."
 */
export function handleMinesEvent(
  boardState: BoardState,
  diceRoll: number = 7 // Default 2d6 roll if not provided
): MinesEventResult {
  const sherman = boardState.sherman;
  const tileKey = coordKey(sherman.coord);
  const currentTile = boardState.tiles.get(tileKey);

  const isOnRoad = currentTile?.terrain === 'road';
  const isAlreadyImmobilized = sherman.isImmobilized;

  if (!isOnRoad) {
    return {
      triggered: true,
      affected: false,
      detail: 'Evento Minas sin efecto: El Sherman no se encuentra en una carretera.',
    };
  }

  if (isAlreadyImmobilized) {
    return {
      triggered: true,
      affected: false,
      detail: 'Evento Minas sin efecto: El Sherman ya se encuentra Inmovilizado.',
    };
  }

  // Automatic hit occurs: Pen 0 vs BL 4
  const targetArmor = 4;
  const damageResult = resolveDamageCheck(0, targetArmor, diceRoll);

  // If damage check passes (totalAttack >= 4), immobilize the Sherman
  if (damageResult.result === 'DAMAGED' || damageResult.result === 'DESTROYED') {
    sherman.isImmobilized = true;
  }

  return {
    triggered: true,
    affected: true,
    detail: `¡MINAS EN CARRETERA! Impacto automático. ${damageResult.detail}`,
    damageResult,
  };
}

/**
 * Resolves the MOVE_TRUCK event logic for Mission 5:
 * Advances the supply truck 1 step along the road path towards the south.
 * Skips hexes occupied by tanks and triggers defeat if move count reaches 8.
 */
export function handleMoveTruckEvent(boardState: BoardState): MoveTruckResult {
  const truck = boardState.enemyTrucks?.[0];
  if (!truck || truck.status === 'destroyed') {
    return {
      triggered: true,
      moved: false,
      escaped: false,
      detail: 'Evento Mover Camión sin efecto: El camión no está presente o ha sido destruido.',
    };
  }

  let nextIndex = truck.moveIndex + 1;
  if (nextIndex >= truck.roadPath.length) {
    return {
      triggered: true,
      moved: false,
      escaped: true,
      detail: '¡EL CAMIÓN DE SUMINISTROS HA ESCAPADO DEL SECTOR POR EL SUR!',
      truck,
    };
  }

  // Check if destination is blocked by an active enemy tank
  let targetHex = truck.roadPath[nextIndex];
  while (nextIndex < truck.roadPath.length) {
    const isTankOccupied = boardState.enemyTanks.some(
      (t) => t.status !== 'destroyed' && t.coord.q === targetHex.q && t.coord.r === targetHex.r
    );
    if (!isTankOccupied) break;
    nextIndex++;
    if (nextIndex < truck.roadPath.length) {
      targetHex = truck.roadPath[nextIndex];
    }
  }

  truck.moveIndex = nextIndex;
  truck.coord = { ...targetHex };

  const escaped = truck.moveIndex >= (truck.maxMoves - 1) || nextIndex >= truck.roadPath.length;

  return {
    triggered: true,
    moved: true,
    escaped,
    detail: `🚚 El camión avanza por carretera a (${truck.coord.q},${truck.coord.r}) [Paso ${truck.moveIndex + 1}/${truck.maxMoves}].`,
    truck,
  };
}

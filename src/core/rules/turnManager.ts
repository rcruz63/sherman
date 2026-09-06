/**
 * Turn Flow Manager & Game End Evaluation System
 */

import { BoardState, TurnPhase } from '../../types/game';
import { resolveDamageEffect } from './combat';
import { resolveMissionEvent } from './missionLoader';
import { handleMoveTruckEvent } from './eventHandlers';

export interface GameEndStatus {
  isGameOver: boolean;
  isVictory: boolean;
  message: string;
}

/**
 * Checks Victory or Defeat conditions against mission rules
 */
export function checkGameEndConditions(boardState: BoardState): GameEndStatus {
  const missionData = boardState.missionData;
  const sherman = boardState.sherman;

  // Defeat Condition 1: All crew members KIA
  const crewArray = Object.values(sherman.crew);
  const allCrewKIA = crewArray.length > 0 && crewArray.every((c) => c.status === 'kia');

  if (allCrewKIA) {
    return {
      isGameOver: true,
      isVictory: false,
      message: 'DERROTA: Toda la tripulación del Sherman ha caído KIA.',
    };
  }

  // Defeat Condition 2: Fire level out of control
  if (sherman.fireLevel >= 5) {
    return {
      isGameOver: true,
      isVictory: false,
      message: 'DERROTA: El fuego ha consumido por completo el Sherman.',
    };
  }

  // Defeat Condition 3: Truck Escaped (Mission 5)
  if (boardState.enemyTrucks && boardState.enemyTrucks.length > 0) {
    const truck = boardState.enemyTrucks[0];
    if (truck.status !== 'destroyed' && truck.moveIndex >= 7) {
      return {
        isGameOver: true,
        isVictory: false,
        message: 'DERROTA: El camión de suministros alemán ha escapado por la ruta sur.',
      };
    }
  }

  // Victory Conditions Check
  if (missionData) {
    const vc = missionData.victoryConditions;

    // Check tank destruction requirement by specific types
    let tankVictory = true;
    if (vc.destroyAllEnemiesOfType && vc.destroyAllEnemiesOfType.length > 0) {
      tankVictory = boardState.enemyTanks.every((tank) => {
        const typeMatch = vc.destroyAllEnemiesOfType!.some(
          (t) => t.toLowerCase() === tank.type.toLowerCase()
        );
        return !typeMatch || tank.status === 'destroyed';
      });

      if (vc.destroyAllEnemiesOfType.includes('TRUCK') && boardState.enemyTrucks) {
        const truckDestroyed = boardState.enemyTrucks.every((tr) => tr.status === 'destroyed');
        if (!truckDestroyed) tankVictory = false;
      }
    }

    // Check clear all enemy tanks requirement (Mission 9)
    let clearAllEnemyTanksVictory = true;
    if (vc.clearAllEnemyTanks) {
      clearAllEnemyTanksVictory = boardState.enemyTanks.every((t) => t.status === 'destroyed');
    }

    // Check infantry destruction requirement (Mission 3)
    let infantryVictory = true;
    if (vc.destroyAllInfantry) {
      infantryVictory = boardState.enemyInfantry.every((inf) => inf.status === 'eliminated');
    }

    // Check specific unit destruction (Mission 8 - OFFICER_INFANTRY)
    let specificUnitVictory = true;
    if (vc.destroySpecificUnit) {
      const targetUnit = boardState.enemyInfantry.find((inf) => inf.id === vc.destroySpecificUnit || inf.isObjective);
      if (targetUnit) {
        specificUnitVictory = targetUnit.status === 'eliminated';
      }
    }

    // Check clear all enemies requirement (Mission 6)
    let clearAllVictory = true;
    if (vc.clearAllEnemies) {
      const tanksClear = boardState.enemyTanks.every((t) => t.status === 'destroyed');
      const infClear = boardState.enemyInfantry.every((i) => i.status === 'eliminated');
      clearAllVictory = tanksClear && infClear;
    }

    // Check crew rescue requirement (Mission 13)
    let crewRescuedVictory = true;
    if (vc.crewRescued) {
      crewRescuedVictory = boardState.missionData?.specialRules?.disabledSherman?.rescued === true;
    }

    // Check map exit requirement
    let reachedExit = true;
    if (vc.requireMapExit && vc.exitHex) {
      const exit = vc.exitHex;
      reachedExit = sherman.coord.q === exit.q && sherman.coord.r === exit.r;
    }

    if (tankVictory && clearAllEnemyTanksVictory && infantryVictory && specificUnitVictory && clearAllVictory && crewRescuedVictory && reachedExit) {
      return {
        isGameOver: true,
        isVictory: true,
        message: '¡VICTORIA TÁCTICA! Todos los objetivos especificados han sido cumplidos y el Sherman ha alcanzado la ruta de escape.',
      };
    }
  }

  return {
    isGameOver: false,
    isVictory: false,
    message: '',
  };
}

/**
 * Phase 1: Sherman Smoke Cleanup
 */
export function executePhase1(boardState: BoardState): string {
  boardState.sherman.hasSmoke = false;
  boardState.currentPhase = TurnPhase.COMMANDER_ASSIGNMENT;
  return 'Fase 1: Limpieza de humo del Sherman completada.';
}

/**
 * Phase 4: German Smoke Cleanup
 */
export function executePhase4(boardState: BoardState): string {
  boardState.enemyTanks.forEach((tank) => {
    tank.hasSmoke = false;
  });
  boardState.currentPhase = TurnPhase.FIRE_CHECK;
  return 'Fase 4: Limpieza de humo de tanques enemigos completada.';
}

/**
 * Phase 5: Fire Check
 */
export function executePhase5(boardState: BoardState, presetRolls?: number[]): string {
  const fireLevel = boardState.sherman.fireLevel;

  if (fireLevel <= 0) {
    boardState.currentPhase = TurnPhase.GERMAN_OPERATIONS;
    return 'Fase 5: Sin fuego activo en el Sherman.';
  }

  // Roll N d6 = fireLevel and take the minimum result
  const rolls: number[] = presetRolls || [];
  if (rolls.length === 0) {
    for (let i = 0; i < fireLevel; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
  }

  const minRoll = Math.min(...rolls);
  const effect = resolveDamageEffect('sherman', minRoll);

  boardState.currentPhase = TurnPhase.GERMAN_OPERATIONS;
  return `Fase 5 Fuego: ${fireLevel} dado(s) [${rolls.join(', ')}] ➔ Menor: ${minRoll} (${effect.description})`;
}

/**
 * Phase 7: End of Turn Events & Turn Increment
 */
export function executePhase7(boardState: BoardState, roll2d6: number): string {
  const events = boardState.missionData?.endOfTurnEvents || [];
  const eventRule = resolveMissionEvent(events, roll2d6);

  let extraLog = '';

  // Trigger special event handler for MOVE_TRUCK in Mission 5
  if (eventRule && eventRule.type === 'MOVE_TRUCK') {
    const truckRes = handleMoveTruckEvent(boardState);
    extraLog = ` | ${truckRes.detail}`;
  }

  boardState.currentTurn += 1;
  boardState.currentPhase = TurnPhase.SHERMAN_SMOKE_CLEANUP;

  const eventDesc = eventRule ? `${eventRule.type}: ${eventRule.description}` : 'Sin evento.';
  return `Fase 7 Eventos (2d6=${roll2d6}): ${eventDesc}${extraLog} ➔ Avanzando a Turno ${boardState.currentTurn}.`;
}

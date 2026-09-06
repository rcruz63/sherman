/**
 * Turn Flow Manager & Game End Evaluation System
 */

import { BoardState, TurnPhase } from '../../types/game';
import { resolveDamageEffect, resolveCrewCasualtyRoll } from './combat';
import { resolveMissionEvent } from './missionLoader';
import {
  handleMoveTruckEvent,
  handleSpawnInfantryEvent,
  handleInfantryAttackEvent,
  handleSniperEvent,
  handleMinesEvent,
  handleStukaEvent,
  handleCommanderOrderEvent,
  handleMechanicalFailureEvent,
  handleSpawnTankEvent,
} from './eventHandlers';

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

  // Defeat Condition 0: Sherman Destroyed
  if (sherman.isDestroyed) {
    return {
      isGameOver: true,
      isVictory: false,
      message: 'DERROTA: El tanque Sherman ha sido Destruido.',
    };
  }

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
      const exitQ = (vc.exitHex as any).q ?? (vc.exitHex as any).col;
      const exitR = (vc.exitHex as any).r ?? (vc.exitHex as any).row;
      reachedExit = sherman.coord.q === exitQ && sherman.coord.r === exitR;
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
 * Removes smoke markers from all German tanks (smoke lasts only 1 turn).
 */
export function executePhase4(boardState: BoardState): string {
  const tanksWithSmoke = boardState.enemyTanks.filter((t) => t.hasSmoke);
  boardState.enemyTanks.forEach((tank) => {
    tank.hasSmoke = false;
  });
  boardState.currentPhase = TurnPhase.FIRE_CHECK;
  if (tanksWithSmoke.length > 0) {
    const ids = tanksWithSmoke.map((t) => `${t.type.toUpperCase()} #${t.id}`).join(', ');
    return `Fase 4: Humo disipado en los tanques alemanes: ${ids}.`;
  }
  return 'Fase 4: Limpieza de Humo Alemán (ningún tanque enemigo tenía humo activo).';
}

/**
 * Phase 5: Fire Check
 * If fireLevel > 0, rolls 1d6 per fire level and takes the lowest result.
 * Resolves damage on Sherman table without armor penetration step:
 * 1: Sherman Destroyed
 * 2: Crew Casualty Check (1d6)
 * 3-4: Fire Level +1
 * 5: Turret Damaged
 * 6: Immobilized (and loses Hull Down if present)
 */
export function executePhase5(
  boardState: BoardState,
  presetRolls?: number[],
  presetCasualtyRoll?: number
): string {
  const sherman = boardState.sherman;
  const fireLevel = sherman.fireLevel;

  if (fireLevel <= 0) {
    boardState.currentPhase = TurnPhase.GERMAN_OPERATIONS;
    return 'Fase 5: Sin fuego activo en el Sherman (Nivel 0) ➔ Fase 5 omitida, avanzando a Fase 6.';
  }

  // Roll N d6 = fireLevel and take the minimum result
  const rolls: number[] = presetRolls && presetRolls.length > 0 ? [...presetRolls] : [];
  if (rolls.length === 0) {
    for (let i = 0; i < fireLevel; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
  }

  const minRoll = Math.min(...rolls);
  const effect = resolveDamageEffect('sherman', minRoll);

  let effectDetail = effect.description;

  if (effect.outcome === 'DESTROYED') {
    sherman.isDestroyed = true;
    effectDetail = '¡Sherman Destruido por el fuego!';
  } else if (effect.outcome === 'CREW_CASUALTY') {
    const dKia = presetCasualtyRoll ?? (Math.floor(Math.random() * 6) + 1);
    const isHatched = sherman.commanderPosition === 'hatched';
    const casualty = resolveCrewCasualtyRoll(dKia, isHatched);
    if (casualty) {
      sherman.crew[casualty.role].status = 'kia';
      effectDetail = `Comprueba KIA (Tirada 1d6 [${dKia}]) ➔ ${casualty.description}`;
    } else {
      effectDetail = `Comprueba KIA (Tirada 1d6 [${dKia}]) ➔ Comandante en Interior ➔ ¡Sin bajas!`;
    }
  } else if (effect.outcome === 'DAMAGED_FIRE') {
    sherman.fireLevel += 1;
    effectDetail = `¡El fuego se extiende! +1 Nivel de fuego (Nuevo nivel: 🔥 ${sherman.fireLevel})`;
  } else if (effect.outcome === 'TURRET_DAMAGED') {
    sherman.isTurretDamaged = true;
    effectDetail = 'Torreta dañada por el fuego.';
  } else if (effect.outcome === 'IMMOBILIZED') {
    sherman.isImmobilized = true;
    if (sherman.isHullDown) {
      sherman.isHullDown = false;
      effectDetail = 'Inmovilizado por el fuego (pierde Desenfilada).';
    } else {
      effectDetail = 'Inmovilizado por el fuego.';
    }
  }

  boardState.currentPhase = TurnPhase.GERMAN_OPERATIONS;
  return `Fase 5 Fuego: Nivel actual 🔥 ${fireLevel} (${fireLevel} dados: [${rolls.join(', ')}]) ➔ Menor: ${minRoll} ➔ ${effectDetail}`;
}

export interface Phase7PresetRolls {
  spawnRoll?: number;
  commanderOrderAction?: 'LOAD' | 'REPAIR' | 'EXTINGUISH';
  stukaRolls?: {
    aaRoll?: [number, number];
    bombRoll?: [number, number];
    dmgRoll?: number;
    effectRoll?: number;
    kiaRoll?: number;
  };
  infantryAttackRolls?: {
    hitRolls?: [number, number][];
    dmgRolls?: number[];
    effectRolls?: number[];
    kiaRolls?: number[];
  };
}

/**
 * Phase 7: End of Turn Events & Turn Increment
 * Resolves 2d6 event roll from mission-specific event table.
 */
export function executePhase7(
  boardState: BoardState,
  roll2d6: number,
  presetEventOptions?: Phase7PresetRolls
): string {
  const events = boardState.missionData?.endOfTurnEvents || [];
  const eventRule = resolveMissionEvent(events, roll2d6);

  let eventResolutionDetail = '';

  if (eventRule) {
    switch (eventRule.type) {
      case 'SNIPER': {
        const res = handleSniperEvent(boardState);
        eventResolutionDetail = res.detail;
        break;
      }
      case 'COMMANDER_ORDER': {
        const res = handleCommanderOrderEvent(
          boardState,
          presetEventOptions?.commanderOrderAction
        );
        eventResolutionDetail = res.detail;
        break;
      }
      case 'SPAWN_INFANTRY': {
        const res = handleSpawnInfantryEvent(boardState, presetEventOptions?.spawnRoll);
        eventResolutionDetail = res.detail;
        break;
      }
      case 'INFANTRY_ATTACK': {
        const res = handleInfantryAttackEvent(
          boardState,
          presetEventOptions?.infantryAttackRolls
        );
        eventResolutionDetail = res.detail;
        break;
      }
      case 'MECHANICAL_FAILURE': {
        const res = handleMechanicalFailureEvent(boardState);
        eventResolutionDetail = res.detail;
        break;
      }
      case 'STUKA': {
        const res = handleStukaEvent(boardState, presetEventOptions?.stukaRolls);
        eventResolutionDetail = res.detail;
        break;
      }
      case 'SPAWN_PANZER_III': {
        const res = handleSpawnTankEvent(
          boardState,
          'panzerIII',
          presetEventOptions?.spawnRoll
        );
        eventResolutionDetail = res.detail;
        break;
      }
      case 'SPAWN_PANZER_IV': {
        const res = handleSpawnTankEvent(
          boardState,
          'panzerIV',
          presetEventOptions?.spawnRoll
        );
        eventResolutionDetail = res.detail;
        break;
      }
      case 'MINES': {
        const res = handleMinesEvent(boardState, presetEventOptions?.spawnRoll);
        eventResolutionDetail = res.detail;
        break;
      }
      case 'MOVE_TRUCK': {
        const res = handleMoveTruckEvent(boardState);
        eventResolutionDetail = res.detail;
        break;
      }
      case 'NO_EVENT':
      case 'NONE':
      default: {
        eventResolutionDetail = `Sin evento en este turno (${eventRule.description}).`;
        break;
      }
    }
  } else {
    eventResolutionDetail = 'No ocurrió ningún evento para este resultado de dados.';
  }

  boardState.currentTurn += 1;
  boardState.currentPhase = TurnPhase.SHERMAN_SMOKE_CLEANUP;

  return `Fase 7 Eventos (Tirada 2d6 = ${roll2d6} ➔ ${
    eventRule ? eventRule.type : 'SIN EVENTO'
  }): ${eventResolutionDetail} ➔ Avanzando a Turno ${boardState.currentTurn}.`;
}

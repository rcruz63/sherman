import { create } from 'zustand';
import {
  BoardState,
  CommanderPosition,
  Facing,
  MissionJSON,
  TurnPhase,
  EnemyTank,
  EnemyInfantry,
  ShermanState,
  LogEntry,
  LogVerbosityMode,
} from '../types/game';
import mission1Raw from '../data/missions/mission1.json';
import { loadMissionState, LoadMissionOptions } from '../core/rules/missionLoader';
import {
  checkGameEndConditions,
  executePhase1,
  executePhase4,
  executePhase5,
  executePhase7,
  GameEndStatus,
} from '../core/rules/turnManager';
import { runAllGermanActivations } from '../core/rules/germanAI';
import { calculateHitDifficulty, resolveDamageCheck, resolveDamageEffect } from '../core/rules/combat';
import { getDirectionBetween, hexNeighbor } from '../core/hex/math';
import { createLogEntry, buildHitModifiersList, SECTOR_NAMES } from '../core/rules/logUtils';

import {
  calculateSectionDice,
  validateManeuverMove,
  executeMGAttack,
  ShermanSectionType,
  ShermanOperationsOrder,
} from '../core/rules/shermanOperations';

const mission1Data = mission1Raw as MissionJSON;

export interface GameStoreState {
  boardState: BoardState | null;
  combatLog: (string | LogEntry)[];
  logVerbosity: LogVerbosityMode;
  gameEndStatus: GameEndStatus | null;

  // Store Actions
  loadMission: (missionData?: MissionJSON, options?: LoadMissionOptions) => void;
  setCommanderPosition: (position: CommanderPosition) => void;
  setPhase: (phase: TurnPhase) => void;
  addLogMessage: (message: string | LogEntry) => void;
  setLogVerbosity: (mode: LogVerbosityMode) => void;
  clearLog: () => void;

  // Tactical Gameplay Actions (Legacy / General)
  moveShermanForward: () => void;
  rotateSherman: (deltaFacing: number) => void;
  loadCannon: () => void;
  fireMainGunAt: (target: EnemyTank) => void;
  repairImmobilized: () => void;
  toggleSmoke: () => void;
  toggleHullDown: () => void;
  extinguishFire: () => void;
  rescueCrew: () => void;

  // Sherman Operations Phase Actions (Phase 3)
  selectOperationsOrder: (order: ShermanOperationsOrder) => void;
  rollSectionDice: (presetRolls?: number[]) => void;
  executeManeuverForward: (consume?: { type: 'single'; value: number } | { type: 'double'; value: number }) => void;
  executeManeuverReverse: (consume?: { type: 'single'; value: number }) => void;
  executeManeuverTurn: (deltaFacing: -1 | 1, consume?: { type: 'single'; value: number } | { type: 'double'; value: number }) => void;
  executeAttackLoad: (consume?: { type: 'single'; value: number } | { type: 'double'; value: number }) => void;
  executeAttackFireGun: (target: EnemyTank, consume?: { type: 'single'; value: number } | { type: 'double'; value: number }) => void;
  executeAttackFireMG: (target: EnemyInfantry, dieValue?: number, presetRolls?: [number, number]) => void;
  executeMiscAction: (
    actionType: 'dcp' | 'load' | 'mg' | 'turn' | 'move' | 'repair' | 'smoke' | 'extinguish' | 'hull_down',
    consume?: { type: 'single'; value: number } | { type: 'double'; value: number },
    params?: { targetTank?: EnemyTank; targetInfantry?: EnemyInfantry; turnDelta?: -1 | 1; repairTarget?: 'turret' | 'immobilized' }
  ) => void;
  advanceSection: () => void;

  // Phase Execution Actions
  runPhase1: () => void;
  runPhase4: () => void;
  runPhase5: () => void;
  runPhase6GermanAI: () => void;
  runPhase7EndTurn: (roll2d6?: number) => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  boardState: null,
  combatLog: [],
  logVerbosity: 'compact',
  gameEndStatus: null,

  loadMission: (missionData = mission1Data, options?: LoadMissionOptions) => {
    const boardState = loadMissionState(missionData, options);

    const facingNames = ['N (0)', 'NE (1)', 'SE (2)', 'S (3)', 'SO (4)', 'NO (5)'];
    const enemyLogs = boardState.enemyTanks.map((t) => {
      const fName = facingNames[t.facing] || `${t.facing}`;
      return `Despliegue ${t.type.toUpperCase()} #${t.spawnNumber}: Posición (${t.coord.q},${t.coord.r}), encaramiento ${fName}.`;
    });

    const startTile = boardState.tiles.get(`${boardState.sherman.coord.q},${boardState.sherman.coord.r}`);
    boardState.shermanOperations = {
      order: null,
      sectionIndex: 0,
      phaseStartTerrain: startTile?.terrain || 'field',
      currentSection: null,
      status: 'order_selection',
      rolledDice: [],
      availableDice: [],
    };

    set({
      boardState,
      gameEndStatus: null,
      combatLog: [
        `📋 Misión "${missionData.title}" cargada exitosamente.`,
        ` Despliegue inicial Sherman en (${boardState.sherman.coord.q},${boardState.sherman.coord.r}), encaramiento NO (5).`,
        ...enemyLogs,
      ],
    });
  },

  setCommanderPosition: (position: CommanderPosition) => {
    set((state) => {
      if (!state.boardState) return state;
      const updatedSherman = {
        ...state.boardState.sherman,
        commanderPosition: position,
      };

      const updatedState = {
        ...state.boardState,
        sherman: updatedSherman,
      };

      const gameEnd = checkGameEndConditions(updatedState);

      return {
        boardState: updatedState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : null,
        combatLog: [
          ...state.combatLog,
          `Comandante posicionado en: ${position === 'hatched' ? 'Asomado (A)' : 'Interior (I)'}`,
        ],
      };
    });
  },

  setPhase: (phase: TurnPhase) => {
    set((state) => {
      if (!state.boardState) return state;
      let updatedOps = state.boardState.shermanOperations;
      if (phase === TurnPhase.SHERMAN_OPERATIONS) {
        const startTile = state.boardState.tiles.get(
          `${state.boardState.sherman.coord.q},${state.boardState.sherman.coord.r}`
        );
        updatedOps = {
          order: null,
          sectionIndex: 0,
          phaseStartTerrain: startTile?.terrain || 'field',
          currentSection: null,
          status: 'order_selection',
          rolledDice: [],
          availableDice: [],
        };
      }
      return {
        boardState: {
          ...state.boardState,
          currentPhase: phase,
          shermanOperations: updatedOps,
        },
      };
    });
  },

  addLogMessage: (message: string | LogEntry) => {
    const entry = typeof message === 'string' ? createLogEntry(message) : message;
    set((state) => ({
      combatLog: [...state.combatLog, entry],
    }));
  },

  setLogVerbosity: (mode: LogVerbosityMode) => {
    set({ logVerbosity: mode });
  },

  clearLog: () => set({ combatLog: [] }),

  // Movement & Rotation
  moveShermanForward: () => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (boardState.sherman.isImmobilized) {
      addLogMessage('⚠️ No se puede mover: El Sherman está Inmovilizado.');
      return;
    }

    const currentCoord = boardState.sherman.coord;
    const forwardCoord = hexNeighbor(currentCoord, boardState.sherman.facing);
    const tileKey = `${forwardCoord.q},${forwardCoord.r}`;
    const targetTile = boardState.tiles.get(tileKey);

    if (!targetTile || targetTile.terrain === 'water' || targetTile.terrain === 'building') {
      addLogMessage(`⚠️ Movimiento bloqueado hacia (${forwardCoord.q},${forwardCoord.r}) por terreno infranqueable.`);
      return;
    }

    // Bridge Special Rules Check (Mission 7)
    const bridgeRule = boardState.missionData?.specialRules?.bridge;
    if (bridgeRule) {
      const isEnteringBridge = targetTile.isBridge || (forwardCoord.q === bridgeRule.hex.q && forwardCoord.r === bridgeRule.hex.r);
      const isLeavingBridge = currentCoord.q === bridgeRule.hex.q && currentCoord.r === bridgeRule.hex.r;

      if (isEnteringBridge || isLeavingBridge) {
        const moveDir = getDirectionBetween(currentCoord, forwardCoord);
        if (moveDir !== null) {
          const allowedDirs = isEnteringBridge ? bridgeRule.allowedEntryDirections : bridgeRule.allowedExitDirections;
          if (!allowedDirs.includes(moveDir)) {
            addLogMessage('⚠️ Movimiento bloqueado: El puente solo permite entradas y salidas por las conexiones de carretera.');
            return;
          }
        }
      }
    }

    set((state) => {
      if (!state.boardState) return state;
      const updatedState: BoardState = {
        ...state.boardState,
        sherman: {
          ...state.boardState.sherman,
          coord: forwardCoord,
        },
      };

      const gameEnd = checkGameEndConditions(updatedState);

      return {
        boardState: updatedState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : state.gameEndStatus,
        combatLog: [
          ...state.combatLog,
          `🚗 Sherman avanza a (${forwardCoord.q},${forwardCoord.r}) en terreno ${targetTile.terrain.toUpperCase()}`,
        ],
      };
    });
  },

  rotateSherman: (deltaFacing: number) => {
    const { boardState } = get();
    if (!boardState) return;

    const newFacing = ((boardState.sherman.facing + deltaFacing + 6) % 6) as Facing;
    const facingNames = ['N (0)', 'NE (1)', 'SE (2)', 'S (3)', 'SO (4)', 'NO (5)'];

    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            facing: newFacing,
          },
        },
        combatLog: [
          ...state.combatLog,
          `🔄 Encaramiento Sherman cambiado a ${facingNames[newFacing]}`,
        ],
      };
    });
  },

  loadCannon: () => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (boardState.sherman.isLoaded) {
      addLogMessage('Cañón ya se encontraba cargado.');
      return;
    }

    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            isLoaded: true,
          },
        },
        combatLog: [...state.combatLog, '⚡ Cañón principal del Sherman Cargado.'],
      };
    });
  },

  fireMainGunAt: (target: EnemyTank) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (!boardState.sherman.isLoaded) {
      addLogMessage('⚠️ Cañón descargado: Se requiere acción de Cargar antes de disparar.');
      return;
    }

    const hitCalc = calculateHitDifficulty(boardState.sherman, target, boardState);

    if (!hitCalc.hasLOS) {
      addLogMessage(`⚠️ Disparo imposible a ${target.type.toUpperCase()}: Sin Línea de Visión (${hitCalc.losReason}).`);
      return;
    }

    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const rollTotal = roll1 + roll2;
    const hitSuccess = rollTotal >= hitCalc.totalDifficulty;

    const modifiers = buildHitModifiersList(hitCalc);
    const sectorName = SECTOR_NAMES[hitCalc.impactSector] || hitCalc.impactSector;
    const diffStr = modifiers.map((m) => `${m.label} ${m.value}`).join(' + ');

    const fireLogEntry: LogEntry = createLogEntry(
      `🎯 Sherman dispara a ${target.type.toUpperCase()} (${target.coord.q},${target.coord.r}): ${
        hitSuccess ? '¡IMPACTO!' : 'FALLADO'
      } (${rollTotal} vs Dif ${hitCalc.totalDifficulty})`,
      {
        type: 'combat',
        detail: `Disparo Sherman a ${target.type.toUpperCase()} en (${target.coord.q},${target.coord.r}) | Tirada 2d6 = [${roll1}, ${roll2}] = ${rollTotal} vs Dificultad ${hitCalc.totalDifficulty} (${diffStr}) | Sector de Impacto: ${sectorName}`,
        breakdown: {
          diceRolls: [roll1, roll2],
          diceTotal: rollTotal,
          targetDifficulty: hitCalc.totalDifficulty,
          baseDistance: hitCalc.baseDistance,
          targetSize: target.size,
          modifiers,
          impactSector: sectorName,
        },
      }
    );

    const logMessages: (string | LogEntry)[] = [fireLogEntry];
    let updatedTanks = [...boardState.enemyTanks];

    if (hitSuccess) {
      // Step 2: 1d6 >= targetArmor - penetration
      const targetArmor = target.armor[hitCalc.impactSector];
      const dDmg = Math.floor(Math.random() * 6) + 1;
      const damageRes = resolveDamageCheck(boardState.sherman.gunPenetration, targetArmor, dDmg);

      if (damageRes.result === 'DAMAGED') {
        // Step 3: What Damage table
        const effectRoll = Math.floor(Math.random() * 6) + 1;
        const damageEffect = resolveDamageEffect('germanTank', effectRoll);

        updatedTanks = updatedTanks.map((t) => {
          if (t.id === target.id) {
            let newStatus = t.status;
            if (damageEffect.outcome === 'DESTROYED') {
              newStatus = 'destroyed';
            } else if (damageEffect.outcome === 'DAMAGED') {
              newStatus = t.status === 'damaged' ? 'destroyed' : 'damaged';
            }
            return { ...t, status: newStatus };
          }
          return t;
        });

        const isDestroyedNow = updatedTanks.find((t) => t.id === target.id)?.status === 'destroyed';
        const damageLogEntry: LogEntry = createLogEntry(
          `💥 Daño en ${target.type.toUpperCase()}: ${
            isDestroyedNow ? '¡DESTRUIDO!' : damageEffect.outcome === 'TURRET_DAMAGED' ? 'TORRETA DAÑADA' : 'DAÑADO'
          } (${damageEffect.description})`,
          {
            type: 'combat',
            detail: `Paso 2 ¿Daños?: 1d6 [${dDmg}] >= Req ${damageRes.threshold} ➔ Paso 3 ¿Qué Daños?: 1d6 [${effectRoll}] ➔ ${damageEffect.description}`,
            breakdown: {
              diceRolls: [dDmg],
              armorValue: targetArmor,
              penetration: boardState.sherman.gunPenetration,
              damageRoll: effectRoll,
              damageEffect: damageEffect.description,
            },
          }
        );
        logMessages.push(damageLogEntry);
      } else {
        const bounceLogEntry: LogEntry = createLogEntry(
          `🛡️ Disparo rebotado en ${target.type.toUpperCase()}: Sin Penetración (1d6 [${dDmg}] vs Req ${damageRes.threshold})`,
          {
            type: 'combat',
            detail: `Paso 2 ¿Daños?: 1d6 [${dDmg}] < Blindaje ${targetArmor} - PEN ${boardState.sherman.gunPenetration} (${damageRes.threshold}) ➔ Sin Penetración`,
          }
        );
        logMessages.push(bounceLogEntry);
      }
    }

    set((state) => {
      if (!state.boardState) return state;
      const updatedState: BoardState = {
        ...state.boardState,
        sherman: {
          ...state.boardState.sherman,
          isLoaded: false,
        },
        enemyTanks: updatedTanks,
      };

      const gameEnd = checkGameEndConditions(updatedState);

      return {
        boardState: updatedState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : state.gameEndStatus,
        combatLog: [...state.combatLog, ...logMessages],
      };
    });
  },

  repairImmobilized: () => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (!boardState.sherman.isImmobilized) {
      addLogMessage('El Sherman no se encuentra inmovilizado.');
      return;
    }

    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            isImmobilized: false,
          },
        },
        combatLog: [...state.combatLog, '🔧 Reparación completada: Sherman ya no está inmovilizado.'],
      };
    });
  },

  toggleSmoke: () => {
    const { boardState } = get();
    if (!boardState) return;
    const val = !boardState.sherman.hasSmoke;
    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: { ...state.boardState.sherman, hasSmoke: val },
        },
        combatLog: [...state.combatLog, `Humo Pantalla Sherman: ${val ? 'ACTIVADO' : 'DESACTIVADO'}`],
      };
    });
  },

  toggleHullDown: () => {
    const { boardState } = get();
    if (!boardState) return;
    const val = !boardState.sherman.isHullDown;
    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: { ...state.boardState.sherman, isHullDown: val },
        },
        combatLog: [...state.combatLog, `Desenfilada Sherman: ${val ? 'ACTIVADA' : 'DESACTIVADA'}`],
      };
    });
  },

  extinguishFire: () => {
    const { boardState } = get();
    if (!boardState) return;
    if (boardState.sherman.fireLevel <= 0) return;

    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            fireLevel: Math.max(0, state.boardState.sherman.fireLevel - 1),
          },
        },
        combatLog: [...state.combatLog, '🧯 Fuego extinguido (-1 Nivel de Fuego).'],
      };
    });
  },

  rescueCrew: () => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    const disabledShermanRule = boardState.missionData?.specialRules?.disabledSherman;
    if (!disabledShermanRule) {
      addLogMessage('⚠️ No hay misión de rescate activa.');
      return;
    }

    const { q, r } = boardState.sherman.coord;
    if (q !== disabledShermanRule.hex.q || r !== disabledShermanRule.hex.r) {
      addLogMessage(`⚠️ Debes posicionar el Sherman en la casilla (${disabledShermanRule.hex.q},${disabledShermanRule.hex.r}) para realizar el rescate.`);
      return;
    }

    if (disabledShermanRule.rescued) {
      addLogMessage('La tripulación del Sherman averiado ya fue rescatada.');
      return;
    }

    set((state) => {
      if (!state.boardState) return state;

      const updatedCrew = { ...state.boardState.sherman.crew };
      let restoredCount = 0;
      Object.keys(updatedCrew).forEach((role) => {
        const crewRole = role as keyof typeof updatedCrew;
        if (updatedCrew[crewRole].status === 'kia') {
          updatedCrew[crewRole] = {
            ...updatedCrew[crewRole],
            status: 'active',
          };
          restoredCount++;
        }
      });

      const updatedSpecialRules = {
        ...state.boardState.missionData?.specialRules,
        disabledSherman: {
          ...disabledShermanRule,
          rescued: true,
        },
      };

      const updatedMissionData = state.boardState.missionData
        ? {
            ...state.boardState.missionData,
            specialRules: updatedSpecialRules,
          }
        : undefined;

      const updatedBoardState: BoardState = {
        ...state.boardState,
        sherman: {
          ...state.boardState.sherman,
          crew: updatedCrew,
        },
        missionData: updatedMissionData,
      };

      const gameEnd = checkGameEndConditions(updatedBoardState);

      return {
        boardState: updatedBoardState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : state.gameEndStatus,
        combatLog: [
          ...state.combatLog,
          `🛟 Rescate de Tripulación completado exitosamente.${
            restoredCount > 0 ? ` ¡${restoredCount} tripulante(s) KIA restaurado(s) a activo!` : ''
          }`,
        ],
      };
    });
  },

  // Sherman Operations Phase Actions (Phase 3)
  selectOperationsOrder: (order: ShermanOperationsOrder) => {
    set((state) => {
      if (!state.boardState) return state;
      const firstSection: ShermanSectionType = order === 'MAV' ? 'maneuver' : 'attack';
      const startTerrain = state.boardState.shermanOperations?.phaseStartTerrain || 'field';
      const updatedOps = {
        order,
        sectionIndex: 0,
        phaseStartTerrain: startTerrain,
        currentSection: firstSection,
        status: 'not_rolled' as const,
        rolledDice: [],
        availableDice: [],
      };
      return {
        boardState: {
          ...state.boardState,
          shermanOperations: updatedOps,
        },
        combatLog: [
          ...state.combatLog,
          `📋 Orden de Operaciones seleccionado: ${
            order === 'MAV' ? '[1. Maniobra ➔ 2. Ataque ➔ 3. Varios]' : '[1. Ataque ➔ 2. Maniobra ➔ 3. Varios]'
          }`,
        ],
      };
    });
  },

  rollSectionDice: (presetRolls?: number[]) => {
    const { boardState, addLogMessage } = get();
    if (!boardState || !boardState.shermanOperations) return;
    const ops = boardState.shermanOperations;
    if (!ops.currentSection) return;

    const diceInfo = calculateSectionDice(ops.currentSection, ops.phaseStartTerrain, boardState.sherman);

    if (diceInfo.isImmobilized) {
      addLogMessage('⚠️ Sherman Inmovilizado: La sección de Maniobra se omite automáticamente (0 dados).');
      set((state) => ({
        boardState: state.boardState
          ? {
              ...state.boardState,
              shermanOperations: {
                ...ops,
                status: 'section_completed',
                rolledDice: [],
                availableDice: [],
              },
            }
          : state.boardState,
      }));
      return;
    }

    const rolls = presetRolls ? [...presetRolls] : [];
    if (rolls.length === 0) {
      for (let i = 0; i < diceInfo.totalDice; i++) {
        rolls.push(Math.floor(Math.random() * 6) + 1);
      }
    }
    rolls.sort((a, b) => a - b);

    const sectionNames: Record<ShermanSectionType, string> = {
      maneuver: 'MANIOBRA',
      attack: 'ATAQUE',
      misc: 'VARIOS',
    };

    set((state) => ({
      boardState: state.boardState
        ? {
            ...state.boardState,
            shermanOperations: {
              ...ops,
              status: 'rolled',
              rolledDice: rolls,
              availableDice: [...rolls],
            },
          }
        : state.boardState,
      combatLog: [
        ...state.combatLog,
        `🎲 Tirada de ${ops.currentSection ? sectionNames[ops.currentSection] : 'OPERACIONES'} (${diceInfo.totalDice} dados): [${rolls.join(', ')}] (${diceInfo.explanation.join(' | ')})`,
      ],
    }));
  },

  executeManeuverForward: (consume?: { type: 'single'; value: number } | { type: 'double'; value: number }) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (boardState.sherman.isImmobilized) {
      addLogMessage('⚠️ Sherman Inmovilizado: No puede moverse.');
      return;
    }

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops && ops.currentSection === 'maneuver') {
      const deduction =
        consume ||
        (nextAvailable.includes(5)
          ? { type: 'single' as const, value: 5 }
          : nextAvailable.includes(6)
          ? { type: 'single' as const, value: 6 }
          : null);

      if (!deduction) {
        addLogMessage('⚠️ No dispones de dados (5 o 6, o doble de Conductor) para Avanzar.');
        return;
      }
      if (deduction.type === 'double' && boardState.sherman.crew.driver.status !== 'active') {
        addLogMessage('⚠️ No se puede usar el doble para Mover: El Conductor está KIA.');
        return;
      }

      if (deduction.type === 'single') {
        const idx = nextAvailable.indexOf(deduction.value);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      } else {
        const idx1 = nextAvailable.indexOf(deduction.value);
        if (idx1 !== -1) nextAvailable.splice(idx1, 1);
        const idx2 = nextAvailable.indexOf(deduction.value);
        if (idx2 !== -1) nextAvailable.splice(idx2, 1);
      }
    }

    const valResult = validateManeuverMove(boardState, 'forward');
    if (!valResult.isValid || !valResult.targetCoord) {
      addLogMessage(`⚠️ Movimiento bloqueado: ${valResult.reason}`);
      return;
    }

    const forwardCoord = valResult.targetCoord;
    const tileKey = `${forwardCoord.q},${forwardCoord.r}`;
    const targetTile = boardState.tiles.get(tileKey);

    set((state) => {
      if (!state.boardState) return state;
      const updatedSherman: ShermanState = {
        ...state.boardState.sherman,
        coord: forwardCoord,
        isHullDown: false,
      };

      const updatedBoardState: BoardState = {
        ...state.boardState,
        sherman: updatedSherman,
        shermanOperations: state.boardState.shermanOperations
          ? {
              ...state.boardState.shermanOperations,
              availableDice: nextAvailable,
            }
          : undefined,
      };

      const gameEnd = checkGameEndConditions(updatedBoardState);

      return {
        boardState: updatedBoardState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : state.gameEndStatus,
        combatLog: [
          ...state.combatLog,
          `🚗 Sherman avanza a (${forwardCoord.q},${forwardCoord.r}) [Terreno: ${targetTile?.terrain.toUpperCase()}]${
            state.boardState.sherman.isHullDown ? ' (Desenfilada retirada)' : ''
          }`,
        ],
      };
    });
  },

  executeManeuverReverse: (consume?: { type: 'single'; value: number }) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (boardState.sherman.isImmobilized) {
      addLogMessage('⚠️ Sherman Inmovilizado: No puede moverse.');
      return;
    }

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops && ops.currentSection === 'maneuver') {
      const deduction = consume || (nextAvailable.includes(1) ? { type: 'single' as const, value: 1 } : null);
      if (!deduction) {
        addLogMessage('⚠️ No dispones de dado con valor 1 para Retroceder.');
        return;
      }
      const idx = nextAvailable.indexOf(deduction.value);
      if (idx !== -1) nextAvailable.splice(idx, 1);
    }

    const valResult = validateManeuverMove(boardState, 'reverse');
    if (!valResult.isValid || !valResult.targetCoord) {
      addLogMessage(`⚠️ Retroceso bloqueado: ${valResult.reason}`);
      return;
    }

    const reverseCoord = valResult.targetCoord;
    const tileKey = `${reverseCoord.q},${reverseCoord.r}`;
    const targetTile = boardState.tiles.get(tileKey);

    set((state) => {
      if (!state.boardState) return state;
      const updatedSherman: ShermanState = {
        ...state.boardState.sherman,
        coord: reverseCoord,
        isHullDown: false,
      };

      const updatedBoardState: BoardState = {
        ...state.boardState,
        sherman: updatedSherman,
        shermanOperations: state.boardState.shermanOperations
          ? {
              ...state.boardState.shermanOperations,
              availableDice: nextAvailable,
            }
          : undefined,
      };

      const gameEnd = checkGameEndConditions(updatedBoardState);

      return {
        boardState: updatedBoardState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : state.gameEndStatus,
        combatLog: [
          ...state.combatLog,
          `🔙 Sherman retrocede a (${reverseCoord.q},${reverseCoord.r}) [Terreno: ${targetTile?.terrain.toUpperCase()}]${
            state.boardState.sherman.isHullDown ? ' (Desenfilada retirada)' : ''
          }`,
        ],
      };
    });
  },

  executeManeuverTurn: (
    deltaFacing: -1 | 1,
    consume?: { type: 'single'; value: number } | { type: 'double'; value: number }
  ) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops && ops.currentSection === 'maneuver') {
      const deduction =
        consume ||
        (nextAvailable.includes(2)
          ? { type: 'single' as const, value: 2 }
          : nextAvailable.includes(3)
          ? { type: 'single' as const, value: 3 }
          : nextAvailable.includes(4)
          ? { type: 'single' as const, value: 4 }
          : null);

      if (!deduction) {
        addLogMessage('⚠️ No dispones de dados (2, 3 o 4, o doble de Asistente) para Girar.');
        return;
      }
      if (deduction.type === 'double' && boardState.sherman.crew.assistant.status !== 'active') {
        addLogMessage('⚠️ No se puede usar el doble para Girar: El Asistente de Conductor está KIA.');
        return;
      }

      if (deduction.type === 'single') {
        const idx = nextAvailable.indexOf(deduction.value);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      } else {
        const idx1 = nextAvailable.indexOf(deduction.value);
        if (idx1 !== -1) nextAvailable.splice(idx1, 1);
        const idx2 = nextAvailable.indexOf(deduction.value);
        if (idx2 !== -1) nextAvailable.splice(idx2, 1);
      }
    }

    const newFacing = ((boardState.sherman.facing + deltaFacing + 6) % 6) as Facing;
    const facingNames = ['N (0)', 'NE (1)', 'SE (2)', 'S (3)', 'SO (4)', 'NO (5)'];

    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            facing: newFacing,
            isHullDown: false,
          },
          shermanOperations: state.boardState.shermanOperations
            ? {
                ...state.boardState.shermanOperations,
                availableDice: nextAvailable,
              }
            : undefined,
        },
        combatLog: [
          ...state.combatLog,
          `🔄 Encaramiento Sherman cambiado a ${facingNames[newFacing]} (${deltaFacing === -1 ? 'Izquierda' : 'Derecha'})${
            state.boardState.sherman.isHullDown ? ' (Desenfilada retirada)' : ''
          }`,
        ],
      };
    });
  },

  executeAttackLoad: (consume?: { type: 'single'; value: number } | { type: 'double'; value: number }) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (boardState.sherman.isLoaded) {
      addLogMessage('El cañón ya se encuentra cargado.');
      return;
    }

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops && ops.currentSection === 'attack') {
      const deduction =
        consume ||
        (nextAvailable.includes(1)
          ? { type: 'single' as const, value: 1 }
          : nextAvailable.includes(2)
          ? { type: 'single' as const, value: 2 }
          : null);

      if (!deduction) {
        addLogMessage('⚠️ No dispones de dados (1 o 2, o doble de Cargador) para Cargar el cañón.');
        return;
      }
      if (deduction.type === 'double' && boardState.sherman.crew.loader.status !== 'active') {
        addLogMessage('⚠️ No se puede usar el doble para Cargar: El Cargador está KIA.');
        return;
      }

      if (deduction.type === 'single') {
        const idx = nextAvailable.indexOf(deduction.value);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      } else {
        const idx1 = nextAvailable.indexOf(deduction.value);
        if (idx1 !== -1) nextAvailable.splice(idx1, 1);
        const idx2 = nextAvailable.indexOf(deduction.value);
        if (idx2 !== -1) nextAvailable.splice(idx2, 1);
      }
    }

    set((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            isLoaded: true,
          },
          shermanOperations: state.boardState.shermanOperations
            ? {
                ...state.boardState.shermanOperations,
                availableDice: nextAvailable,
              }
            : undefined,
        },
        combatLog: [...state.combatLog, '⚡ Cañón principal del Sherman Cargado.'],
      };
    });
  },

  executeAttackFireGun: (
    target: EnemyTank,
    consume?: { type: 'single'; value: number } | { type: 'double'; value: number }
  ) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    if (!boardState.sherman.isLoaded) {
      addLogMessage('⚠️ Cañón descargado: Se requiere acción de Cargar antes de disparar.');
      return;
    }

    if (boardState.sherman.isTurretDamaged) {
      addLogMessage('⚠️ Torreta Dañada: No se puede disparar el cañón principal.');
      return;
    }

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops && ops.currentSection === 'attack') {
      const deduction =
        consume ||
        (nextAvailable.includes(5)
          ? { type: 'single' as const, value: 5 }
          : nextAvailable.includes(6)
          ? { type: 'single' as const, value: 6 }
          : null);

      if (!deduction) {
        addLogMessage('⚠️ No dispones de dados (5 o 6, o doble de Artillero) para Disparar el Cañón.');
        return;
      }
      if (deduction.type === 'double' && boardState.sherman.crew.gunner.status !== 'active') {
        addLogMessage('⚠️ No se puede usar el doble para Disparar: El Artillero está KIA.');
        return;
      }

      if (deduction.type === 'single') {
        const idx = nextAvailable.indexOf(deduction.value);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      } else {
        const idx1 = nextAvailable.indexOf(deduction.value);
        if (idx1 !== -1) nextAvailable.splice(idx1, 1);
        const idx2 = nextAvailable.indexOf(deduction.value);
        if (idx2 !== -1) nextAvailable.splice(idx2, 1);
      }
    }

    // Resolve 3-step combat
    const hitCalc = calculateHitDifficulty(boardState.sherman, target, boardState);
    if (!hitCalc.hasLOS) {
      addLogMessage(`⚠️ Disparo imposible a ${target.type.toUpperCase()}: Sin Línea de Visión (${hitCalc.losReason}).`);
      return;
    }

    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const rollTotal = roll1 + roll2;
    const hitSuccess = rollTotal >= hitCalc.totalDifficulty;

    const modifiers = buildHitModifiersList(hitCalc);
    const sectorName = SECTOR_NAMES[hitCalc.impactSector] || hitCalc.impactSector;
    const diffStr = modifiers.map((m) => `${m.label} ${m.value}`).join(' + ');

    const fireLogEntry: LogEntry = createLogEntry(
      `🎯 Sherman dispara Cañón a ${target.type.toUpperCase()} (${target.coord.q},${target.coord.r}): ${
        hitSuccess ? '¡IMPACTO!' : 'FALLADO'
      } (${rollTotal} vs Dif ${hitCalc.totalDifficulty})`,
      {
        type: 'combat',
        detail: `Disparo Sherman a ${target.type.toUpperCase()} en (${target.coord.q},${target.coord.r}) | Tirada 2d6 = [${roll1}, ${roll2}] = ${rollTotal} vs Dificultad ${hitCalc.totalDifficulty} (${diffStr}) | Sector de Impacto: ${sectorName}`,
        breakdown: {
          diceRolls: [roll1, roll2],
          diceTotal: rollTotal,
          targetDifficulty: hitCalc.totalDifficulty,
          baseDistance: hitCalc.baseDistance,
          targetSize: target.size,
          modifiers,
          impactSector: sectorName,
        },
      }
    );

    const logMessages: (string | LogEntry)[] = [fireLogEntry];
    let updatedTanks = [...boardState.enemyTanks];

    if (hitSuccess) {
      // Step 2: 1d6 >= targetArmor - penetration
      const targetArmor = target.armor[hitCalc.impactSector];
      const dDmg = Math.floor(Math.random() * 6) + 1;
      const damageRes = resolveDamageCheck(boardState.sherman.gunPenetration, targetArmor, dDmg);

      if (damageRes.result === 'DAMAGED') {
        // Step 3: What Damage table
        const effectRoll = Math.floor(Math.random() * 6) + 1;
        const damageEffect = resolveDamageEffect('germanTank', effectRoll);

        updatedTanks = updatedTanks.map((t) => {
          if (t.id === target.id) {
            let newStatus = t.status;
            if (damageEffect.outcome === 'DESTROYED') {
              newStatus = 'destroyed';
            } else if (damageEffect.outcome === 'DAMAGED') {
              newStatus = t.status === 'damaged' ? 'destroyed' : 'damaged';
            }
            return { ...t, status: newStatus };
          }
          return t;
        });

        const isDestroyedNow = updatedTanks.find((t) => t.id === target.id)?.status === 'destroyed';
        const damageLogEntry: LogEntry = createLogEntry(
          `💥 Daño en ${target.type.toUpperCase()}: ${
            isDestroyedNow ? '¡DESTRUIDO!' : damageEffect.outcome === 'TURRET_DAMAGED' ? 'TORRETA DAÑADA' : 'DAÑADO'
          } (${damageEffect.description})`,
          {
            type: 'combat',
            detail: `Paso 2 ¿Daños?: 1d6 [${dDmg}] >= Req ${damageRes.threshold} ➔ Paso 3 ¿Qué Daños?: 1d6 [${effectRoll}] ➔ ${damageEffect.description}`,
            breakdown: {
              diceRolls: [dDmg],
              armorValue: targetArmor,
              penetration: boardState.sherman.gunPenetration,
              damageRoll: effectRoll,
              damageEffect: damageEffect.description,
            },
          }
        );
        logMessages.push(damageLogEntry);
      } else {
        const bounceLogEntry: LogEntry = createLogEntry(
          `🛡️ Disparo rebotado en ${target.type.toUpperCase()}: Sin Penetración (1d6 [${dDmg}] vs Req ${damageRes.threshold})`,
          {
            type: 'combat',
            detail: `Paso 2 ¿Daños?: 1d6 [${dDmg}] < Blindaje ${targetArmor} - PEN ${boardState.sherman.gunPenetration} (${damageRes.threshold}) ➔ Sin Penetración`,
          }
        );
        logMessages.push(bounceLogEntry);
      }
    }

    set((state) => {
      if (!state.boardState) return state;
      const updatedBoardState: BoardState = {
        ...state.boardState,
        sherman: {
          ...state.boardState.sherman,
          isLoaded: false,
        },
        enemyTanks: updatedTanks,
        shermanOperations: state.boardState.shermanOperations
          ? {
              ...state.boardState.shermanOperations,
              availableDice: nextAvailable,
            }
          : undefined,
      };

      const gameEnd = checkGameEndConditions(updatedBoardState);

      return {
        boardState: updatedBoardState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : state.gameEndStatus,
        combatLog: [...state.combatLog, ...logMessages],
      };
    });
  },

  executeAttackFireMG: (target: EnemyInfantry, dieValue?: number, presetRolls?: [number, number]) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops && ops.currentSection === 'attack') {
      const valToConsume = dieValue || (nextAvailable.includes(3) ? 3 : nextAvailable.includes(4) ? 4 : null);
      if (!valToConsume) {
        addLogMessage('⚠️ No dispones de dado con valor 3 o 4 para Disparar Ametralladora (MG).');
        return;
      }
      const idx = nextAvailable.indexOf(valToConsume);
      if (idx !== -1) nextAvailable.splice(idx, 1);
    }

    const mgResult = executeMGAttack(boardState.sherman.coord, target, presetRolls);
    if (mgResult.distance !== 1) {
      addLogMessage(`⚠️ ${mgResult.detail}`);
      return;
    }

    let updatedInfantry = [...boardState.enemyInfantry];
    if (mgResult.success) {
      updatedInfantry = updatedInfantry.map((inf) =>
        inf.id === target.id ? { ...inf, status: 'eliminated' } : inf
      );
    }

    const mgLogEntry: LogEntry = createLogEntry(
      `🔫 Disparo MG a Infantería en (${target.coord.q},${target.coord.r}): ${
        mgResult.success ? '¡ELIMINADA!' : 'FALLADO'
      } (${mgResult.total} vs 7+)`,
      {
        type: 'combat',
        detail: mgResult.detail,
        breakdown: {
          diceRolls: mgResult.rolls,
          diceTotal: mgResult.total,
          targetDifficulty: 7,
        },
      }
    );

    set((state) => {
      if (!state.boardState) return state;
      const updatedBoardState: BoardState = {
        ...state.boardState,
        enemyInfantry: updatedInfantry,
        shermanOperations: state.boardState.shermanOperations
          ? {
              ...state.boardState.shermanOperations,
              availableDice: nextAvailable,
            }
          : undefined,
      };

      const gameEnd = checkGameEndConditions(updatedBoardState);

      return {
        boardState: updatedBoardState,
        gameEndStatus: gameEnd.isGameOver ? gameEnd : state.gameEndStatus,
        combatLog: [...state.combatLog, mgLogEntry],
      };
    });
  },

  executeMiscAction: (
    actionType: 'dcp' | 'load' | 'mg' | 'turn' | 'move' | 'repair' | 'smoke' | 'extinguish' | 'hull_down',
    consume?: { type: 'single'; value: number } | { type: 'double'; value: number },
    params?: { targetTank?: EnemyTank; targetInfantry?: EnemyInfantry; turnDelta?: -1 | 1; repairTarget?: 'turret' | 'immobilized' }
  ) => {
    const { boardState, addLogMessage } = get();
    if (!boardState) return;

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops && ops.currentSection === 'misc') {
      if (consume) {
        if (consume.type === 'single') {
          const idx = nextAvailable.indexOf(consume.value);
          if (idx !== -1) nextAvailable.splice(idx, 1);
        } else {
          const idx1 = nextAvailable.indexOf(consume.value);
          if (idx1 !== -1) nextAvailable.splice(idx1, 1);
          const idx2 = nextAvailable.indexOf(consume.value);
          if (idx2 !== -1) nextAvailable.splice(idx2, 1);
        }
      }
    }

    if (actionType === 'load') {
      if (boardState.sherman.crew.loader.status !== 'active') {
        addLogMessage('⚠️ Requiere Cargador vivo para Cargar en Varios.');
        return;
      }
      set((state) => ({
        boardState: state.boardState
          ? {
              ...state.boardState,
              sherman: { ...state.boardState.sherman, isLoaded: true },
              shermanOperations: state.boardState.shermanOperations
                ? { ...state.boardState.shermanOperations, availableDice: nextAvailable }
                : undefined,
            }
          : state.boardState,
        combatLog: [...state.combatLog, '⚡ [Varios] Cargador carga el cañón principal.'],
      }));
      return;
    }

    if (actionType === 'dcp') {
      if (boardState.sherman.crew.gunner.status !== 'active') {
        addLogMessage('⚠️ Requiere Artillero vivo para disparar en Varios.');
        return;
      }
      if (!params?.targetTank) {
        addLogMessage('⚠️ Se requiere un tanque objetivo válido para disparar.');
        return;
      }
      get().executeAttackFireGun(params.targetTank);
      return;
    }

    if (actionType === 'mg') {
      if (boardState.sherman.crew.assistant.status !== 'active') {
        addLogMessage('⚠️ Requiere Asistente de Conductor vivo para disparar MG en Varios.');
        return;
      }
      if (!params?.targetInfantry) {
        addLogMessage('⚠️ Se requiere infantería adyacente para disparar MG.');
        return;
      }
      get().executeAttackFireMG(params.targetInfantry);
      return;
    }

    if (actionType === 'move') {
      if (boardState.sherman.crew.driver.status !== 'active') {
        addLogMessage('⚠️ Requiere Conductor vivo para Mover en Varios.');
        return;
      }
      get().executeManeuverForward();
      return;
    }

    if (actionType === 'turn') {
      if (boardState.sherman.crew.driver.status !== 'active') {
        addLogMessage('⚠️ Requiere Conductor vivo para Girar en Varios.');
        return;
      }
      get().executeManeuverTurn(params?.turnDelta || 1);
      return;
    }

    if (actionType === 'repair') {
      const repTurret = params?.repairTarget === 'turret' || boardState.sherman.isTurretDamaged;
      set((state) => {
        if (!state.boardState) return state;
        const updatedSherman = {
          ...state.boardState.sherman,
          isTurretDamaged: repTurret ? false : state.boardState.sherman.isTurretDamaged,
          isImmobilized: !repTurret ? false : state.boardState.sherman.isImmobilized,
        };
        return {
          boardState: {
            ...state.boardState,
            sherman: updatedSherman,
            shermanOperations: state.boardState.shermanOperations
              ? { ...state.boardState.shermanOperations, availableDice: nextAvailable }
              : undefined,
          },
          combatLog: [
            ...state.combatLog,
            `🔧 [Varios] Reparación completada: ${repTurret ? 'Torreta reparada' : 'Sherman ya no está inmovilizado'}.`,
          ],
        };
      });
      return;
    }

    if (actionType === 'smoke') {
      set((state) => {
        if (!state.boardState) return state;
        return {
          boardState: {
            ...state.boardState,
            sherman: { ...state.boardState.sherman, hasSmoke: true },
            shermanOperations: state.boardState.shermanOperations
              ? { ...state.boardState.shermanOperations, availableDice: nextAvailable }
              : undefined,
          },
          combatLog: [...state.combatLog, '💨 [Varios] Humo de cobertura desplegado (+1 para ser impactado).'],
        };
      });
      return;
    }

    if (actionType === 'extinguish') {
      set((state) => {
        if (!state.boardState) return state;
        return {
          boardState: {
            ...state.boardState,
            sherman: {
              ...state.boardState.sherman,
              fireLevel: Math.max(0, state.boardState.sherman.fireLevel - 1),
            },
            shermanOperations: state.boardState.shermanOperations
              ? { ...state.boardState.shermanOperations, availableDice: nextAvailable }
              : undefined,
          },
          combatLog: [...state.combatLog, '🧯 [Varios] Fuego extinguido (-1 Nivel de Fuego).'],
        };
      });
      return;
    }

    if (actionType === 'hull_down') {
      if (boardState.sherman.isImmobilized) {
        addLogMessage('⚠️ No se puede adoptar Desenfilada si el Sherman está Inmovilizado.');
        return;
      }
      set((state) => {
        if (!state.boardState) return state;
        return {
          boardState: {
            ...state.boardState,
            sherman: { ...state.boardState.sherman, isHullDown: true },
            shermanOperations: state.boardState.shermanOperations
              ? { ...state.boardState.shermanOperations, availableDice: nextAvailable }
              : undefined,
          },
          combatLog: [...state.combatLog, '🛡️ [Varios Doble] Sherman posicionado en Desenfilada (+2 Cobertura).'],
        };
      });
      return;
    }
  },

  advanceSection: () => {
    set((state) => {
      if (!state.boardState || !state.boardState.shermanOperations) return state;
      const ops = state.boardState.shermanOperations;
      const sectionsOrder: ShermanSectionType[] =
        ops.order === 'MAV' ? ['maneuver', 'attack', 'misc'] : ['attack', 'maneuver', 'misc'];

      const nextIndex = ops.sectionIndex + 1;
      if (nextIndex >= sectionsOrder.length) {
        return {
          boardState: {
            ...state.boardState,
            shermanOperations: {
              ...ops,
              sectionIndex: nextIndex,
              currentSection: null,
              status: 'phase_completed',
              rolledDice: [],
              availableDice: [],
            },
          },
          combatLog: [
            ...state.combatLog,
            '🏁 Todas las secciones de Operaciones del Sherman han finalizado para este turno.',
          ],
        };
      }

      const nextSection = sectionsOrder[nextIndex];
      const sectionLabels: Record<ShermanSectionType, string> = {
        maneuver: 'Maniobra',
        attack: 'Ataque',
        misc: 'Varios',
      };

      return {
        boardState: {
          ...state.boardState,
          shermanOperations: {
            ...ops,
            sectionIndex: nextIndex,
            currentSection: nextSection,
            status: 'not_rolled',
            rolledDice: [],
            availableDice: [],
          },
        },
        combatLog: [
          ...state.combatLog,
          `➔ Avanzando a Sección ${nextIndex + 1}: ${sectionLabels[nextSection]}.`,
        ],
      };
    });
  },

  // Phase Execution Helpers
  runPhase1: () => {
    const { boardState } = get();
    if (!boardState) return;
    const logMsg = executePhase1(boardState);
    get().addLogMessage(logMsg);
    set({ boardState: { ...boardState } });
  },

  runPhase4: () => {
    const { boardState } = get();
    if (!boardState) return;
    const logMsg = executePhase4(boardState);
    get().addLogMessage(logMsg);
    set({ boardState: { ...boardState } });
  },

  runPhase5: () => {
    const { boardState } = get();
    if (!boardState) return;
    const logMsg = executePhase5(boardState);
    get().addLogMessage(logMsg);

    const gameEnd = checkGameEndConditions(boardState);
    set({
      boardState: { ...boardState },
      gameEndStatus: gameEnd.isGameOver ? gameEnd : null,
    });
  },

  runPhase6GermanAI: () => {
    const { boardState } = get();
    if (!boardState) return;

    const aiResults = runAllGermanActivations(boardState);
    aiResults.forEach((res) => {
      if (res.actionTaken !== 'NONE') {
        get().addLogMessage(`🤖 IA ${res.tankType.toUpperCase()} #${res.tankId}: ${res.detail}`);
      }
    });

    boardState.currentPhase = TurnPhase.END_TURN_EVENTS;
    const gameEnd = checkGameEndConditions(boardState);

    set({
      boardState: { ...boardState },
      gameEndStatus: gameEnd.isGameOver ? gameEnd : null,
    });
  },

  runPhase7EndTurn: (roll2d6?: number) => {
    const { boardState } = get();
    if (!boardState) return;

    const roll = roll2d6 || Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    const logMsg = executePhase7(boardState, roll);
    get().addLogMessage(logMsg);

    const gameEnd = checkGameEndConditions(boardState);

    set({
      boardState: { ...boardState },
      gameEndStatus: gameEnd.isGameOver ? gameEnd : null,
    });
  },
}));

import { create } from 'zustand';
import { BoardState, CommanderPosition, Facing, MissionJSON, TurnPhase, EnemyTank, LogEntry, LogVerbosityMode } from '../types/game';
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

  // Tactical Gameplay Actions
  moveShermanForward: () => void;
  rotateSherman: (deltaFacing: number) => void;
  loadCannon: () => void;
  fireMainGunAt: (target: EnemyTank) => void;
  repairImmobilized: () => void;
  toggleSmoke: () => void;
  toggleHullDown: () => void;
  extinguishFire: () => void;
  rescueCrew: () => void;

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
      return {
        boardState: {
          ...state.boardState,
          currentPhase: phase,
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
      const targetArmor = target.armor[hitCalc.impactSector];
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const dTotal = d1 + d2;
      const damageRes = resolveDamageCheck(boardState.sherman.gunPenetration, targetArmor, dTotal);

      let damageEffectDesc = '';
      let effectRoll: number | undefined;

      if (damageRes.result === 'DAMAGED' || damageRes.result === 'DESTROYED') {
        effectRoll = Math.floor(Math.random() * 6) + 1;
        const damageEffect = resolveDamageEffect('germanTank', effectRoll);
        damageEffectDesc = damageEffect.description;

        updatedTanks = updatedTanks.map((t) => {
          if (t.id === target.id) {
            const newStatus = damageRes.result === 'DESTROYED' ? 'destroyed' : 'damaged';
            return { ...t, status: newStatus };
          }
          return t;
        });
      }

      const damageLogEntry: LogEntry = createLogEntry(
        `💥 Control de Daños en ${target.type.toUpperCase()}: ${
          damageRes.result === 'NO_EFFECT'
            ? 'SIN PENETRACIÓN'
            : damageRes.result === 'DESTROYED'
            ? `¡DESTRUIDO! (${damageEffectDesc})`
            : `DAÑADO (${damageEffectDesc})`
        }`,
        {
          type: 'combat',
          detail: `Penetración Sherman ${boardState.sherman.gunPenetration} + Tirada 2d6 [${d1}, ${d2}] = Total ${damageRes.totalAttack} vs Blindaje ${sectorName} (${targetArmor}) ➔ ${
            damageRes.result === 'NO_EFFECT' ? 'Sin Penetración' : `Efecto: ${damageEffectDesc} (Tirada d6 = ${effectRoll})`
          }`,
          breakdown: {
            diceRolls: [d1, d2],
            diceTotal: dTotal,
            penetration: boardState.sherman.gunPenetration,
            armorValue: targetArmor,
            impactSector: sectorName,
            damageRoll: effectRoll,
            damageEffect: damageEffectDesc,
          },
        }
      );

      logMessages.push(damageLogEntry);
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

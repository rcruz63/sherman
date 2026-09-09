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
  CampaignProgress,
  CampaignType,
  CrewRole,
} from '../types/game';
import { missions } from '../data/missions';
import mission1Raw from '../data/missions/mission1.json';
import { loadMissionState, LoadMissionOptions } from '../core/rules/missionLoader';
import {
  createCampaign,
  prepareCampaignNextMission,
  advanceCampaignProgress,
  isCampaignCompleted,
} from '../core/rules/campaign';
import {
  saveGameToSlot,
  loadGameFromSlot,
  deleteSaveSlot,
  renameSaveSlot,
  duplicateSaveSlot,
  getActiveSlotId,
} from '../core/storage/gamePersistence';
import {
  checkGameEndConditions,
  executePhase1,
  executePhase4,
  executePhase5,
  executePhase7,
  GameEndStatus,
} from '../core/rules/turnManager';
import { calculateHitDifficulty, resolveDamageCheck, resolveDamageEffect } from '../core/rules/combat';

import { getDirectionBetween, hexNeighbor } from '../core/hex/math';
import { OPPOSITE_FACING } from '../core/hex/mapValidator';
import { createLogEntry, buildHitModifiersList, SECTOR_NAMES } from '../core/rules/logUtils';

import {
  calculateSectionDice,
  validateManeuverMove,
  executeMGAttack,
  selectBestDieToConsume,
  ShermanSectionType,
  ShermanOperationsOrder,
} from '../core/rules/shermanOperations';
import { DiceMode, DiceRollPrompt, DiceRollResult } from '../types/dice';
import {
  createDeploymentPrompt,
  createSectionDicePrompt,
  createShermanGunHitPrompt,
  createGunDamageCheckPrompt,
  createGermanTankDamageEffectPrompt,
  createShermanMGPrompt,
  createFireCheckPrompt,
  createCrewCasualtyPrompt,
  createGermanAIPoolPrompt,
  createPhase7EventPrompt,
} from '../core/rules/dicePrompts';
import { extractMissionSpawnPoints } from '../core/rules/missionLoader';
import { executeAITankTurn, getTankInitialState } from '../core/rules/germanAI';
import { hexDistance } from '../core/hex/math';

const mission1Data = mission1Raw as MissionJSON;

export interface GameStoreState {
  boardState: BoardState | null;
  combatLog: (string | LogEntry)[];
  logVerbosity: LogVerbosityMode;
  gameEndStatus: GameEndStatus | null;

  selectedTargetId: string | null;
  setSelectedTargetId: (id: string | null) => void;

  // Interactive Dice Roller State
  activeDiceRoll: DiceRollPrompt | null;
  diceModePreference: DiceMode;
  setDiceModePreference: (mode: DiceMode) => void;
  promptDiceRoll: (promptConfig: Omit<DiceRollPrompt, 'resolve' | 'reject'>) => Promise<DiceRollResult>;
  resolveActiveDiceRoll: (result: DiceRollResult) => void;
  cancelActiveDiceRoll: () => void;

  // Multi-slot & Campaign Mode State
  currentSlotId: string | null;
  gameMode: 'single' | 'campaign';
  campaignState: CampaignProgress | null;
  isIntermissionOpen: boolean;
  isSaveSlotsModalOpen: boolean;
  isNewGameModalOpen: boolean;


  // UI Modal Actions
  setIntermissionOpen: (isOpen: boolean) => void;
  setSaveSlotsModalOpen: (isOpen: boolean) => void;
  setNewGameModalOpen: (isOpen: boolean) => void;

  // Campaign & Slot Actions
  startNewSingleMission: (missionId: number, slotName?: string) => void;
  startNewCampaign: (type: CampaignType, options?: { missionIds?: number[]; count?: number; slotName?: string }) => void;
  advanceCampaignMission: (replacedCrewRole?: CrewRole) => void;
  loadSlot: (slotId: string) => boolean;
  saveCurrentSlot: (customName?: string) => boolean;
  deleteSlot: (slotId: string) => boolean;
  renameSlot: (slotId: string, newName: string) => boolean;
  duplicateSlot: (slotId: string, newName?: string) => string | null;

  // Store Actions
  loadMission: (missionData?: MissionJSON, options?: LoadMissionOptions) => Promise<void>;
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
  executeAttackFireMG: (
    target: EnemyInfantry,
    consume?: { type: 'single'; value: number } | { type: 'double'; value: number } | number,
    presetRolls?: [number, number]
  ) => void;
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

async function promptMissionDeploymentRolls(
  missionData: MissionJSON,
  promptDiceRoll: (prompt: Omit<DiceRollPrompt, 'resolve' | 'reject'>) => Promise<DiceRollResult>
): Promise<LoadMissionOptions> {
  const { blackNumbers, redNumbers } = extractMissionSpawnPoints(missionData);
  const selectedBlackSpawns: number[] = [];
  const selectedRedSpawns: number[] = [];
  let selectedPlayerBlackSpawn: number | undefined;

  // 1. Check Sherman spawn
  if (
    missionData.playerDeployment.spawnMethod === 'RANDOM_BLACK_NUMBER' ||
    !missionData.playerDeployment.hex
  ) {
    if (blackNumbers.length > 0) {
      const prompt = createDeploymentPrompt({
        unitLabel: 'Sherman',
        spawnType: 'black',
        availablePoints: blackNumbers.map((b) => ({ number: b.number, coord: b.hex, facing: b.facing })),
        occupiedNumbers: selectedBlackSpawns,
      });
      const res = await promptDiceRoll(prompt);
      const chosen = res.rolls[0] || 1;
      selectedPlayerBlackSpawn = chosen;
      selectedBlackSpawns.push(chosen);
    }
  }

  // 2. Check enemy tanks
  if (missionData.enemyDeployment.tanks) {
    let tankCount = 1;
    for (const group of missionData.enemyDeployment.tanks) {
      for (let i = 0; i < group.count; i++) {
        const available = blackNumbers.filter(
          (b) =>
            !selectedBlackSpawns.includes(b.number) &&
            (!group.allowedNumbers || group.allowedNumbers.length > 0 ? group.allowedNumbers?.includes(b.number) : true)
        );

        if (available.length > 0) {
          const prompt = createDeploymentPrompt({
            unitLabel: `${group.type} #${tankCount++}`,
            spawnType: 'black',
            availablePoints: blackNumbers.map((b) => ({ number: b.number, coord: b.hex, facing: b.facing })),
            occupiedNumbers: selectedBlackSpawns,
          });
          const res = await promptDiceRoll(prompt);
          let chosen = res.rolls[0] || 1;
          if (!available.some((a) => a.number === chosen)) {
            chosen = available[0].number;
          }
          selectedBlackSpawns.push(chosen);
        }
      }
    }
  }

  // 3. Check enemy infantry (e.g. RANDOM_UNIQUE_RED_NUMBERS)
  if (missionData.enemyDeployment.infantry) {
    let infCount = 1;
    for (const inf of missionData.enemyDeployment.infantry) {
      if (inf.spawnMethod === 'RANDOM_UNIQUE_RED_NUMBERS' && inf.count) {
        for (let i = 0; i < inf.count; i++) {
          const available = redNumbers.filter((r) => !selectedRedSpawns.includes(r.number));
          if (available.length > 0) {
            const prompt = createDeploymentPrompt({
              unitLabel: `Infantería #${infCount++}`,
              spawnType: 'red',
              availablePoints: redNumbers.map((r) => ({ number: r.number, coord: r.hex })),
              occupiedNumbers: selectedRedSpawns,
            });
            const res = await promptDiceRoll(prompt);
            let chosen = res.rolls[0] || 1;
            if (!available.some((a) => a.number === chosen)) {
              chosen = available[0].number;
            }
            selectedRedSpawns.push(chosen);
          }
        }
      }
    }
  }

  return {
    selectedBlackSpawns,
    selectedRedSpawns,
    selectedPlayerBlackSpawn,
  };
}

export const useGameStore = create<GameStoreState>((set, get) => ({

  boardState: null,
  combatLog: [],
  logVerbosity: 'compact',
  gameEndStatus: null,
  selectedTargetId: null,
  setSelectedTargetId: (id: string | null) => set({ selectedTargetId: id }),

  // Interactive Dice Roller
  activeDiceRoll: null,
  diceModePreference:
    typeof window !== 'undefined' && localStorage.getItem('sherman_dice_mode') === 'manual'
      ? 'manual'
      : 'auto',
  setDiceModePreference: (mode: DiceMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sherman_dice_mode', mode);
    }
    set({ diceModePreference: mode });
  },
  promptDiceRoll: (promptConfig) => {
    return new Promise<DiceRollResult>((resolve, reject) => {
      set({
        activeDiceRoll: {
          ...promptConfig,
          resolve: (res) => {
            set({ activeDiceRoll: null });
            resolve(res);
          },
          reject: (err) => {
            set({ activeDiceRoll: null });
            reject(err);
          },
        },
      });
    });
  },
  resolveActiveDiceRoll: (result: DiceRollResult) => {
    const { activeDiceRoll } = get();
    if (activeDiceRoll) {
      activeDiceRoll.resolve(result);
    }
  },
  cancelActiveDiceRoll: () => {
    const { activeDiceRoll } = get();
    if (activeDiceRoll) {
      if (activeDiceRoll.reject) {
        activeDiceRoll.reject(new Error('Dice roll canceled by user'));
      }
      set({ activeDiceRoll: null });
    }
  },

  currentSlotId: null,
  gameMode: 'single',
  campaignState: null,
  isIntermissionOpen: false,
  isSaveSlotsModalOpen: false,
  isNewGameModalOpen: false,

  setIntermissionOpen: (isOpen: boolean) => set({ isIntermissionOpen: isOpen }),
  setSaveSlotsModalOpen: (isOpen: boolean) => set({ isSaveSlotsModalOpen: isOpen }),
  setNewGameModalOpen: (isOpen: boolean) => set({ isNewGameModalOpen: isOpen }),

  startNewSingleMission: async (missionId: number, slotName?: string) => {
    const targetMission = missions.find((m) => m.id === missionId) || missions[0];
    const newSlotId = `slot_${Date.now()}`;

    // Close new game modal first so dice modal has full screen focus
    set({ isNewGameModalOpen: false });

    // Interactive Force Deployment Dice Rolls
    const deploymentOptions = await promptMissionDeploymentRolls(targetMission, get().promptDiceRoll);
    const boardState = loadMissionState(targetMission, deploymentOptions);

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
    const combatLog = [
      `📋 Misión "${targetMission.title}" iniciada.`,
      `📍 Despliegue inicial Sherman en (${boardState.sherman.coord.q},${boardState.sherman.coord.r}), encaramiento NO (5).`,
      ...enemyLogs,
    ];

    saveGameToSlot(newSlotId, {
      name: slotName || `Misión ${missionId} - ${targetMission.title}`,
      mode: 'single',
      boardState,
      combatLog,
      campaignState: null,
    });

    set({
      currentSlotId: newSlotId,
      gameMode: 'single',
      campaignState: null,
      boardState,
      combatLog,
      gameEndStatus: null,
      isSaveSlotsModalOpen: false,
      isIntermissionOpen: false,
    });
  },

  startNewCampaign: async (type: CampaignType, options?: { missionIds?: number[]; count?: number; slotName?: string }) => {
    const campaign = createCampaign(type, options);
    const firstMissionId = campaign.missionSequence[0] || 1;
    const targetMission = missions.find((m) => m.id === firstMissionId) || missions[0];
    const newSlotId = `slot_${Date.now()}`;

    // Close new game modal first
    set({ isNewGameModalOpen: false });

    // Interactive Force Deployment Dice Rolls
    const deploymentOptions = await promptMissionDeploymentRolls(targetMission, get().promptDiceRoll);
    const boardState = loadMissionState(targetMission, deploymentOptions);

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

    const typeNames: Record<CampaignType, string> = {
      sequential: 'Campaña Histórica (1-13)',
      custom: 'Campaña Personalizada',
      random: `Campaña Aleatoria (${campaign.missionSequence.length} misiones)`,
    };

    const combatLog = [
      `🎖️ ¡Comienza ${typeNames[type]}! [Secuencia: ${campaign.missionSequence.join(' ➔ ')}]`,
      `📋 Misión 1/${campaign.missionSequence.length}: "${targetMission.title}"`,
      `📍 Despliegue inicial Sherman en (${boardState.sherman.coord.q},${boardState.sherman.coord.r}), encaramiento NO (5).`,
      ...enemyLogs,
    ];


    saveGameToSlot(newSlotId, {
      name: options?.slotName || `${typeNames[type]} - Misión ${firstMissionId}`,
      mode: 'campaign',
      boardState,
      combatLog,
      campaignState: campaign,
    });

    set({
      currentSlotId: newSlotId,
      gameMode: 'campaign',
      campaignState: campaign,
      boardState,
      combatLog,
      gameEndStatus: null,
      isNewGameModalOpen: false,
      isSaveSlotsModalOpen: false,
      isIntermissionOpen: false,
    });
  },

  advanceCampaignMission: (replacedCrewRole?: CrewRole) => {
    const { boardState, campaignState, currentSlotId, combatLog } = get();
    if (!boardState || !campaignState) return;

    const currentMissionId = boardState.missionData?.id || 1;
    const nextCampaign = advanceCampaignProgress(campaignState, currentMissionId, {
      turns: boardState.currentTurn,
      tanksDestroyed: boardState.enemyTanks.filter((t) => t.status === 'destroyed').length,
      infantryEliminated: boardState.enemyInfantry.filter((i) => i.status === 'eliminated').length,
    });

    if (isCampaignCompleted(nextCampaign)) {
      set({
        campaignState: nextCampaign,
        isIntermissionOpen: false,
        gameEndStatus: {
          isGameOver: true,
          isVictory: true,
          message: `🎖️ ¡VICTORIA TOTAL EN LA CAMPAÑA! Has completado con éxito todas las ${nextCampaign.missionSequence.length} misiones de la campaña. Turnos totales: ${nextCampaign.campaignStats.totalTurns}. ¡Honor a la tripulación del Sherman!`,
        },
      });
      return;
    }

    const nextMissionId = nextCampaign.missionSequence[nextCampaign.currentMissionIndex];
    const nextMissionData = missions.find((m) => m.id === nextMissionId) || missions[0];

    const nextBoardState = prepareCampaignNextMission(nextMissionData, boardState.sherman, replacedCrewRole);

    const facingNames = ['N (0)', 'NE (1)', 'SE (2)', 'S (3)', 'SO (4)', 'NO (5)'];
    const enemyLogs = nextBoardState.enemyTanks.map((t) => {
      const fName = facingNames[t.facing] || `${t.facing}`;
      return `Despliegue ${t.type.toUpperCase()} #${t.spawnNumber}: Posición (${t.coord.q},${t.coord.r}), encaramiento ${fName}.`;
    });

    const replacedMsg = replacedCrewRole
      ? `🎖️ Reemplazo de tripulación: ${nextBoardState.sherman.crew[replacedCrewRole]?.name} (${replacedCrewRole.toUpperCase()}) se une a la tripulación como nuevo recluta.`
      : '';

    const damageSummary = `⚙️ Estado del tanque trasladado: Torreta ${
      nextBoardState.sherman.isTurretDamaged ? 'DAÑADA' : 'OK'
    } | Inmovilizado: ${nextBoardState.sherman.isImmobilized ? 'SÍ' : 'NO'} | Nivel Fuego: 🔥 ${
      nextBoardState.sherman.fireLevel
    } | Cañón: ${nextBoardState.sherman.isLoaded ? '⚡ CARGADO' : 'DESCARGADO'}.`;

    const newCombatLog = [
      ...combatLog,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎖️ Avanzando en Campaña a Misión ${nextCampaign.currentMissionIndex + 1}/${nextCampaign.missionSequence.length}: "${nextMissionData.title}"`,
      replacedMsg,
      damageSummary,
      `📍 Despliegue inicial Sherman en (${nextBoardState.sherman.coord.q},${nextBoardState.sherman.coord.r}), encaramiento NO (5).`,
      ...enemyLogs,
    ].filter(Boolean);

    if (currentSlotId) {
      saveGameToSlot(currentSlotId, {
        mode: 'campaign',
        boardState: nextBoardState,
        combatLog: newCombatLog,
        campaignState: nextCampaign,
      });
    }

    set({
      boardState: nextBoardState,
      campaignState: nextCampaign,
      combatLog: newCombatLog,
      gameEndStatus: null,
      isIntermissionOpen: false,
    });
  },

  loadSlot: (slotId: string) => {
    const loaded = loadGameFromSlot(slotId);
    if (!loaded) return false;

    set({
      currentSlotId: slotId,
      gameMode: loaded.metadata.mode,
      campaignState: loaded.campaignState,
      boardState: loaded.boardState,
      combatLog: [...loaded.combatLog, `📁 Partida "${loaded.metadata.name}" cargada con éxito.`],
      gameEndStatus: null,
      isSaveSlotsModalOpen: false,
      isNewGameModalOpen: false,
      isIntermissionOpen: false,
    });
    return true;
  },

  saveCurrentSlot: (customName?: string) => {
    const { currentSlotId, gameMode, campaignState, boardState, combatLog } = get();
    if (!boardState) return false;
    let slotId = currentSlotId;
    if (!slotId) {
      slotId = `slot_${Date.now()}`;
      set({ currentSlotId: slotId });
    }

    const success = saveGameToSlot(slotId, {
      name: customName,
      mode: gameMode,
      boardState,
      combatLog,
      campaignState,
    });

    if (success) {
      get().addLogMessage('💾 Partida guardada correctamente en el slot activo.');
    }
    return success;
  },

  deleteSlot: (slotId: string) => {
    const success = deleteSaveSlot(slotId);
    if (success && get().currentSlotId === slotId) {
      const activeId = getActiveSlotId();
      if (activeId) {
        get().loadSlot(activeId);
      } else {
        set({ currentSlotId: null });
      }
    }
    return success;
  },

  renameSlot: (slotId: string, newName: string) => {
    return renameSaveSlot(slotId, newName);
  },

  duplicateSlot: (slotId: string, newName?: string) => {
    return duplicateSaveSlot(slotId, newName);
  },

  loadMission: async (missionData = mission1Data, options?: LoadMissionOptions) => {
    let effectiveOptions = options;
    if (!options?.selectedBlackSpawns && !options?.selectedRedSpawns && !options?.skipDeploymentPrompt) {
      effectiveOptions = await promptMissionDeploymentRolls(missionData, get().promptDiceRoll);
    }
    const boardState = loadMissionState(missionData, effectiveOptions);

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

    if (!targetTile || (targetTile.terrain === 'water' && !targetTile.isBridge) || targetTile.terrain === 'building') {
      addLogMessage(`⚠️ Movimiento bloqueado hacia (${forwardCoord.q},${forwardCoord.r}) por terreno infranqueable.`);
      return;
    }

    // Bridge Rules Check
    const bridgeRule = boardState.missionData?.specialRules?.bridge;
    const currentTile = boardState.tiles.get(`${currentCoord.q},${currentCoord.r}`);
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
    } else if (targetTile.isBridge || currentTile?.isBridge) {
      const moveDir = getDirectionBetween(currentCoord, forwardCoord);
      if (moveDir !== null) {
        if (targetTile.isBridge) {
          const oppDir = OPPOSITE_FACING[moveDir];
          if (!targetTile.roadEdges || !targetTile.roadEdges.includes(oppDir)) {
            addLogMessage('⚠️ Movimiento bloqueado: El puente solo permite entrada por sus conexiones de carretera.');
            return;
          }
        }
        if (currentTile?.isBridge) {
          if (!currentTile.roadEdges || !currentTile.roadEdges.includes(moveDir)) {
            addLogMessage('⚠️ Movimiento bloqueado: El puente solo permite salida por sus conexiones de carretera.');
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
    get().executeAttackFireGun(target);
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
      const currentTile = state.boardState.tiles.get(
        `${state.boardState.sherman.coord.q},${state.boardState.sherman.coord.r}`
      );
      const startTerrain = currentTile?.terrain || state.boardState.shermanOperations?.phaseStartTerrain || 'field';
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

  rollSectionDice: async (presetRolls?: number[]) => {
    const { boardState, addLogMessage, promptDiceRoll } = get();
    if (!boardState || !boardState.shermanOperations) return;
    const ops = boardState.shermanOperations;
    if (!ops.currentSection) return;
    const diceInfo = calculateSectionDice(
      ops.currentSection,
      ops.phaseStartTerrain,
      boardState.sherman,
      boardState.missionData?.shermanDicePool
    );

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

    let rolls = presetRolls ? [...presetRolls] : [];
    if (rolls.length === 0) {
      const prompt = createSectionDicePrompt({
        section: ops.currentSection,
        terrain: ops.phaseStartTerrain,
        diceCount: diceInfo.totalDice,
        explanation: diceInfo.explanation,
      });
      const res = await promptDiceRoll(prompt);
      rolls = [...res.rolls];
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

    if (ops) {
      if (consume) {
        if (consume.type === 'double' && boardState.sherman.crew.driver.status !== 'active') {
          addLogMessage('⚠️ No se puede usar el doble para Mover: El Conductor está KIA.');
          return;
        }
        if (consume.type === 'single') {
          const idx = nextAvailable.indexOf(consume.value);
          if (idx !== -1) nextAvailable.splice(idx, 1);
        } else {
          const idx1 = nextAvailable.indexOf(consume.value);
          if (idx1 !== -1) nextAvailable.splice(idx1, 1);
          const idx2 = nextAvailable.indexOf(consume.value);
          if (idx2 !== -1) nextAvailable.splice(idx2, 1);
        }
      } else if (ops.currentSection === 'maneuver') {
        const bestVal = selectBestDieToConsume(nextAvailable, [5, 6]);
        if (!bestVal) {
          addLogMessage('⚠️ No dispones de dados (5 o 6, o doble de Conductor) para Avanzar.');
          return;
        }
        const idx = nextAvailable.indexOf(bestVal);
        if (idx !== -1) nextAvailable.splice(idx, 1);
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
              phaseStartTerrain: targetTile?.terrain || 'field',
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

    if (ops) {
      if (consume) {
        const idx = nextAvailable.indexOf(consume.value);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      } else if (ops.currentSection === 'maneuver') {
        if (!nextAvailable.includes(1)) {
          addLogMessage('⚠️ No dispones de dado con valor 1 para Retroceder.');
          return;
        }
        const idx = nextAvailable.indexOf(1);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      }
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
              phaseStartTerrain: targetTile?.terrain || 'field',
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

    if (ops) {
      if (consume) {
        if (consume.type === 'double' && boardState.sherman.crew.assistant.status !== 'active') {
          addLogMessage('⚠️ No se puede usar el doble para Girar: El Asistente de Conductor está KIA.');
          return;
        }
        if (consume.type === 'single') {
          const idx = nextAvailable.indexOf(consume.value);
          if (idx !== -1) nextAvailable.splice(idx, 1);
        } else {
          const idx1 = nextAvailable.indexOf(consume.value);
          if (idx1 !== -1) nextAvailable.splice(idx1, 1);
          const idx2 = nextAvailable.indexOf(consume.value);
          if (idx2 !== -1) nextAvailable.splice(idx2, 1);
        }
      } else if (ops.currentSection === 'maneuver') {
        const bestVal = selectBestDieToConsume(nextAvailable, [2, 3, 4]);
        if (!bestVal) {
          addLogMessage('⚠️ No dispones de dados (2, 3 o 4, o doble de Asistente) para Girar.');
          return;
        }
        const idx = nextAvailable.indexOf(bestVal);
        if (idx !== -1) nextAvailable.splice(idx, 1);
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

    if (ops) {
      if (consume) {
        if (consume.type === 'double' && boardState.sherman.crew.loader.status !== 'active') {
          addLogMessage('⚠️ No se puede usar el doble para Cargar: El Cargador está KIA.');
          return;
        }
        if (consume.type === 'single') {
          const idx = nextAvailable.indexOf(consume.value);
          if (idx !== -1) nextAvailable.splice(idx, 1);
        } else {
          const idx1 = nextAvailable.indexOf(consume.value);
          if (idx1 !== -1) nextAvailable.splice(idx1, 1);
          const idx2 = nextAvailable.indexOf(consume.value);
          if (idx2 !== -1) nextAvailable.splice(idx2, 1);
        }
      } else if (ops.currentSection === 'attack') {
        const bestVal = selectBestDieToConsume(nextAvailable, [1, 2]);
        if (!bestVal) {
          addLogMessage('⚠️ No dispones de dados (1 o 2, o doble de Cargador) para Cargar el cañón.');
          return;
        }
        const idx = nextAvailable.indexOf(bestVal);
        if (idx !== -1) nextAvailable.splice(idx, 1);
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

  executeAttackFireGun: async (
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

    if (ops) {
      if (consume) {
        if (consume.type === 'double' && boardState.sherman.crew.gunner.status !== 'active') {
          addLogMessage('⚠️ No se puede usar el doble para Disparar: El Artillero está KIA.');
          return;
        }
        if (consume.type === 'single') {
          const idx = nextAvailable.indexOf(consume.value);
          if (idx !== -1) nextAvailable.splice(idx, 1);
        } else {
          const idx1 = nextAvailable.indexOf(consume.value);
          if (idx1 !== -1) nextAvailable.splice(idx1, 1);
          const idx2 = nextAvailable.indexOf(consume.value);
          if (idx2 !== -1) nextAvailable.splice(idx2, 1);
        }
      } else if (ops.currentSection === 'attack') {
        const bestVal = selectBestDieToConsume(nextAvailable, [5, 6]);
        if (!bestVal) {
          addLogMessage('⚠️ No dispones de dados (5 o 6, o doble de Artillero) para Disparar el Cañón.');
          return;
        }
        const idx = nextAvailable.indexOf(bestVal);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      }
    }

    // Resolve 3-step combat
    const hitCalc = calculateHitDifficulty(boardState.sherman, target, boardState);
    if (!hitCalc.hasLOS) {
      addLogMessage(`⚠️ Disparo imposible a ${target.type.toUpperCase()}: Sin Línea de Visión (${hitCalc.losReason}).`);
      return;
    }

    // Step 1: Hit Check (2d6)
    const hitPrompt = createShermanGunHitPrompt(boardState.sherman, target, boardState);
    const hitRes = await get().promptDiceRoll(hitPrompt);
    const [roll1, roll2] = hitRes.rolls;
    const rollTotal = hitRes.total;
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
      const dmgPrompt = createGunDamageCheckPrompt(
        boardState.sherman.gunPenetration,
        targetArmor,
        `${target.type.toUpperCase()} #${target.spawnNumber || ''}`,
        sectorName
      );
      const dmgRes = await get().promptDiceRoll(dmgPrompt);
      const dDmg = dmgRes.rolls[0];
      const damageRes = resolveDamageCheck(boardState.sherman.gunPenetration, targetArmor, dDmg);

      if (damageRes.result === 'DAMAGED') {
        // Step 3: What Damage table
        const effPrompt = createGermanTankDamageEffectPrompt(`${target.type.toUpperCase()} #${target.spawnNumber || ''}`);
        const effRes = await get().promptDiceRoll(effPrompt);
        const effectRoll = effRes.rolls[0];
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

  executeAttackFireMG: async (
    target: EnemyInfantry,
    consume?: { type: 'single'; value: number } | { type: 'double'; value: number } | number,
    presetRolls?: [number, number]
  ) => {
    const { boardState, addLogMessage, promptDiceRoll } = get();
    if (!boardState) return;

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    const requestedVal = typeof consume === 'number' ? consume : consume?.value;

    if (ops) {
      if (requestedVal) {
        const idx = nextAvailable.indexOf(requestedVal);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      } else if (ops.currentSection === 'attack') {
        const valToConsume = selectBestDieToConsume(nextAvailable, [3, 4]);
        if (!valToConsume) {
          addLogMessage('⚠️ No dispones de dado con valor 3 o 4 para Disparar Ametralladora (MG).');
          return;
        }
        const idx = nextAvailable.indexOf(valToConsume);
        if (idx !== -1) nextAvailable.splice(idx, 1);
      }
    }

    let rolls = presetRolls;
    if (!rolls) {
      const mgPrompt = createShermanMGPrompt(target.coord, 7);
      const res = await promptDiceRoll(mgPrompt);
      rolls = [res.rolls[0], res.rolls[1]] as [number, number];
    }

    const mgResult = executeMGAttack(boardState.sherman.coord, target, rolls);

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

    if (actionType === 'dcp') {
      if (boardState.sherman.crew.gunner.status !== 'active') {
        addLogMessage('⚠️ Requiere Artillero vivo para disparar en Varios.');
        return;
      }
      if (!params?.targetTank) {
        addLogMessage('⚠️ Se requiere un tanque objetivo válido para disparar.');
        return;
      }
      get().executeAttackFireGun(params.targetTank, consume || { type: 'single', value: 1 });
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
      get().executeAttackFireMG(params.targetInfantry, consume || { type: 'single', value: 2 });
      return;
    }

    if (actionType === 'move') {
      if (boardState.sherman.crew.driver.status !== 'active') {
        addLogMessage('⚠️ Requiere Conductor vivo para Mover en Varios.');
        return;
      }
      get().executeManeuverForward(consume || { type: 'single', value: 3 });
      return;
    }

    if (actionType === 'turn') {
      if (boardState.sherman.crew.driver.status !== 'active') {
        addLogMessage('⚠️ Requiere Conductor vivo para Girar en Varios.');
        return;
      }
      get().executeManeuverTurn(params?.turnDelta || 1, consume || { type: 'single', value: 3 });
      return;
    }

    const ops = boardState.shermanOperations;
    let nextAvailable = ops ? [...ops.availableDice] : [];

    if (ops) {
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
      const currentTile = state.boardState.tiles.get(
        `${state.boardState.sherman.coord.q},${state.boardState.sherman.coord.r}`
      );
      const effectiveTerrain = currentTile?.terrain || ops.phaseStartTerrain || 'field';
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
            phaseStartTerrain: effectiveTerrain,
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

  runPhase5: async () => {
    const { boardState, promptDiceRoll } = get();
    if (!boardState) return;

    let rolls: number[] | undefined;
    let casualtyRoll: number | undefined;

    if (boardState.sherman.fireLevel > 0) {
      const firePrompt = createFireCheckPrompt(boardState.sherman.fireLevel);
      const res = await promptDiceRoll(firePrompt);
      rolls = [...res.rolls];
      const minRoll = Math.min(...rolls);
      if (minRoll === 2) {
        const isHatched = boardState.sherman.commanderPosition === 'hatched';
        const kiaPrompt = createCrewCasualtyPrompt(isHatched);
        const kiaRes = await promptDiceRoll(kiaPrompt);
        casualtyRoll = kiaRes.rolls[0];
      }
    }

    const logMsg = executePhase5(boardState, rolls, casualtyRoll);
    get().addLogMessage(logMsg);

    const gameEnd = checkGameEndConditions(boardState);
    set({
      boardState: { ...boardState },
      gameEndStatus: gameEnd.isGameOver ? gameEnd : null,
    });
  },

  runPhase6GermanAI: async () => {
    const { boardState, promptDiceRoll, addLogMessage } = get();
    if (!boardState) return;

    const activeTanks = [...boardState.enemyTanks]
      .filter((t) => t.status !== 'destroyed')
      .sort((a, b) => {
        const distA = hexDistance(a.coord, boardState.sherman.coord);
        const distB = hexDistance(b.coord, boardState.sherman.coord);
        return distA - distB;
      });

    for (const tank of activeTanks) {
      if (boardState.sherman.isDestroyed) {
        addLogMessage('Sherman destruido: Fin de las operaciones enemigas.');
        break;
      }
      const { column, diceCount, startingTerrain } = getTankInitialState(tank, boardState);
      const aiPrompt = createGermanAIPoolPrompt(tank, startingTerrain, column, diceCount);
      const aiRes = await promptDiceRoll(aiPrompt);

      const res = executeAITankTurn(tank, boardState, aiRes.rolls);
      if (res.actionTaken !== 'NONE') {
        addLogMessage(`🤖 IA ${res.tankType.toUpperCase()} #${res.tankId}: ${res.detail}`);
      }
    }

    boardState.currentPhase = TurnPhase.END_TURN_EVENTS;
    const gameEnd = checkGameEndConditions(boardState);

    set({
      boardState: { ...boardState },
      gameEndStatus: gameEnd.isGameOver ? gameEnd : null,
    });
  },

  runPhase7EndTurn: async (roll2d6?: number) => {
    const { boardState, promptDiceRoll, addLogMessage } = get();
    if (!boardState) return;

    let roll = roll2d6;
    if (roll === undefined) {
      const events = boardState.missionData?.endOfTurnEvents || [];
      const prompt = createPhase7EventPrompt(events, boardState.currentTurn);
      const res = await promptDiceRoll(prompt);
      roll = res.total;
    }

    const logMsg = executePhase7(boardState, roll);
    addLogMessage(logMsg);

    const gameEnd = checkGameEndConditions(boardState);

    set({
      boardState: { ...boardState },
      gameEndStatus: gameEnd.isGameOver ? gameEnd : null,
    });
  },

}));

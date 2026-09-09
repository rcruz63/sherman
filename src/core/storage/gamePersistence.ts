/**
 * Game State Auto-Save & Persistence Module (Multi-Slot localStorage & JSON Export/Import)
 */

import {
  BoardState,
  BoardHex,
  LogEntry,
  CampaignProgress,
  SaveSlotMetadata,
  SaveSlotData,
} from '../../types/game';
import { missions } from '../../data/missions';
import { loadMissionState, extractMissionSpawnPoints } from '../rules/missionLoader';

const SLOTS_INDEX_KEY = 'sherman_save_slots_index_v2';
const ACTIVE_SLOT_KEY = 'sherman_active_slot_id_v2';
const SLOT_DATA_PREFIX = 'sherman_slot_data_';
const LEGACY_STORAGE_KEY = 'sherman_game_save_v1';

/**
 * Helper to compute Sherman summary for metadata
 */
function buildShermanMetadataSummary(sherman: BoardState['sherman']): SaveSlotMetadata['shermanStatus'] {
  const crewRoles = ['commander', 'loader', 'gunner', 'driver', 'assistant'] as const;
  const crewAliveCount = crewRoles.filter((r) => sherman.crew[r]?.status === 'active').length;

  return {
    crewAliveCount,
    isLoaded: sherman.isLoaded,
    isTurretDamaged: sherman.isTurretDamaged,
    isImmobilized: sherman.isImmobilized,
    fireLevel: sherman.fireLevel,
  };
}

/**
 * Check if localStorage is available (browser environment vs test/node)
 */
function isStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

/**
 * Lists all existing save slots metadata, migrating legacy saves if necessary
 */
export function listSaveSlots(): SaveSlotMetadata[] {
  if (!isStorageAvailable()) return [];
  try {
    const indexJson = localStorage.getItem(SLOTS_INDEX_KEY);
    if (indexJson) {
      const parsed: SaveSlotMetadata[] = JSON.parse(indexJson);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Check for legacy v1 save to migrate
    const legacyJson = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyJson) {
      const parsedLegacy = JSON.parse(legacyJson);
      const migratedSlotId = `slot_${Date.now()}`;
      const missionId = parsedLegacy.boardState?.missionData?.id ?? 1;
      const missionTitle = parsedLegacy.boardState?.missionData?.title ?? `Misión ${missionId}`;

      const tileMap = new Map<string, BoardHex>(parsedLegacy.boardState.tiles);
      const restoredBoard: BoardState = {
        tiles: tileMap,
        sherman: parsedLegacy.boardState.sherman,
        enemyTanks: parsedLegacy.boardState.enemyTanks,
        enemyInfantry: parsedLegacy.boardState.enemyInfantry,
        currentTurn: parsedLegacy.boardState.currentTurn,
        currentPhase: parsedLegacy.boardState.currentPhase,
        missionData: parsedLegacy.boardState.missionData,
      };

      const metadata: SaveSlotMetadata = {
        id: migratedSlotId,
        name: `Partida 1 - ${missionTitle}`,
        mode: 'single',
        missionId,
        missionTitle,
        currentTurn: restoredBoard.currentTurn,
        currentPhase: restoredBoard.currentPhase,
        shermanStatus: buildShermanMetadataSummary(restoredBoard.sherman),
        createdAt: parsedLegacy.savedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const slotPayload: SaveSlotData = {
        metadata,
        boardState: {
          tiles: parsedLegacy.boardState.tiles,
          sherman: restoredBoard.sherman,
          enemyTanks: restoredBoard.enemyTanks,
          enemyInfantry: restoredBoard.enemyInfantry,
          currentTurn: restoredBoard.currentTurn,
          currentPhase: restoredBoard.currentPhase,
          missionData: restoredBoard.missionData,
        },
        combatLog: parsedLegacy.combatLog || [],
        campaignState: null,
      };

      localStorage.setItem(`${SLOT_DATA_PREFIX}${migratedSlotId}`, JSON.stringify(slotPayload));
      localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify([metadata]));
      localStorage.setItem(ACTIVE_SLOT_KEY, migratedSlotId);

      return [metadata];
    }

    return [];
  } catch (err) {
    console.error('Error listing save slots:', err);
    return [];
  }
}

/**
 * Gets the ID of the currently active save slot
 */
export function getActiveSlotId(): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return localStorage.getItem(ACTIVE_SLOT_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets the ID of the currently active save slot
 */
export function setActiveSlotId(slotId: string): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
  } catch (err) {
    console.error('Error setting active slot:', err);
  }
}

/**
 * Saves or updates a specific game slot
 */
export function saveGameToSlot(
  slotId: string,
  options: {
    name?: string;
    mode: 'single' | 'campaign';
    boardState: BoardState;
    combatLog: (string | LogEntry)[];
    campaignState?: CampaignProgress | null;
  }
): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const { mode, boardState, combatLog, campaignState } = options;
    const missionId = boardState.missionData?.id ?? 1;
    const missionTitle = boardState.missionData?.title ?? `Misión ${missionId}`;

    const slots = listSaveSlots();
    const existingIndex = slots.findIndex((s) => s.id === slotId);

    const now = new Date().toISOString();
    const slotName =
      options.name ||
      (existingIndex !== -1 ? slots[existingIndex].name : `${mode === 'campaign' ? 'Campaña' : 'Misión'} - ${missionTitle}`);

    const metadata: SaveSlotMetadata = {
      id: slotId,
      name: slotName,
      mode,
      missionId,
      missionTitle,
      campaignInfo: campaignState?.active
        ? {
            type: campaignState.type,
            totalMissions: campaignState.missionSequence.length,
            currentMissionIndex: campaignState.currentMissionIndex,
            missionSequence: campaignState.missionSequence,
            completedMissionIds: campaignState.completedMissionIds,
          }
        : undefined,
      currentTurn: boardState.currentTurn,
      currentPhase: boardState.currentPhase,
      shermanStatus: buildShermanMetadataSummary(boardState.sherman),
      createdAt: existingIndex !== -1 ? slots[existingIndex].createdAt : now,
      updatedAt: now,
    };

    const tilesArray = Array.from(boardState.tiles.entries());
    const payload: SaveSlotData = {
      metadata,
      boardState: {
        tiles: tilesArray,
        sherman: boardState.sherman,
        enemyTanks: boardState.enemyTanks,
        enemyTrucks: boardState.enemyTrucks,
        enemyInfantry: boardState.enemyInfantry,
        currentTurn: boardState.currentTurn,
        currentPhase: boardState.currentPhase,
        missionData: boardState.missionData,
        shermanOperations: boardState.shermanOperations,
      },
      combatLog,
      campaignState: campaignState || null,
    };

    // Save slot payload
    localStorage.setItem(`${SLOT_DATA_PREFIX}${slotId}`, JSON.stringify(payload));

    // Update slots index
    let updatedSlots: SaveSlotMetadata[];
    if (existingIndex !== -1) {
      updatedSlots = [...slots];
      updatedSlots[existingIndex] = metadata;
    } else {
      updatedSlots = [metadata, ...slots];
    }
    localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(updatedSlots));
    localStorage.setItem(ACTIVE_SLOT_KEY, slotId);

    return true;
  } catch (err) {
    console.error(`Error saving game to slot ${slotId}:`, err);
    return false;
  }
}

/**
 * Loads game state from a specific slot
 */
export function loadGameFromSlot(slotId: string): {
  metadata: SaveSlotMetadata;
  boardState: BoardState;
  combatLog: (string | LogEntry)[];
  campaignState: CampaignProgress | null;
} | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(`${SLOT_DATA_PREFIX}${slotId}`);
    if (!raw) return null;

    const parsed: SaveSlotData = JSON.parse(raw);
    let tileMap = new Map<string, BoardHex>(parsed.boardState.tiles);

    // Sanitize and upgrade tile terrain and geometry against official mission specification
    if (parsed.boardState.missionData?.id) {
      const missionDef = missions.find((m) => m.id === parsed.boardState.missionData?.id);
      if (missionDef?.hexes && missionDef.hexes.length > 0) {
        const hasMismatch =
          tileMap.size !== missionDef.hexes.length ||
          missionDef.hexes.some((h) => {
            const q = h.col ?? (h as any).q;
            const r = h.row ?? (h as any).r;
            return !tileMap.has(`${q},${r}`);
          });

        if (hasMismatch) {
          // Re-initialize boardState with fresh geometry if saved slot had obsolete rectangular map
          const freshBoard = loadMissionState(missionDef);
          tileMap = freshBoard.tiles;
          parsed.boardState.tiles = Array.from(tileMap.entries());
          parsed.boardState.enemyTanks = freshBoard.enemyTanks;
          parsed.boardState.enemyInfantry = freshBoard.enemyInfantry;
          parsed.boardState.missionData = freshBoard.missionData;
          if (!tileMap.has(`${parsed.boardState.sherman.coord.q},${parsed.boardState.sherman.coord.r}`)) {
            parsed.boardState.sherman.coord = freshBoard.sherman.coord;
            parsed.boardState.sherman.facing = freshBoard.sherman.facing;
          }
        } else {
          missionDef.hexes.forEach((h) => {
            const q = h.col ?? (h as any).q;
            const r = h.row ?? (h as any).r;
            const tile = tileMap.get(`${q},${r}`);
            if (tile) {
              const raw = (h.terrain || '').toLowerCase();
              if (raw === 'road') tile.terrain = 'road';
              else if (raw === 'mud') tile.terrain = 'mud';
              else if (raw === 'woods') tile.terrain = 'woods';
              else if (raw === 'water') tile.terrain = 'water';
              else if (raw === 'building') tile.terrain = 'building';
            }
          });
        }
      }
    }

    // Sanitize any unit coordinate collision (e.g. legacy save where Sherman and an enemy tank shared a spawn)
    if (parsed.boardState.missionData?.id && parsed.boardState.enemyTanks && parsed.boardState.sherman) {
      const shermanKey = `${parsed.boardState.sherman.coord.q},${parsed.boardState.sherman.coord.r}`;
      const hasCollision = parsed.boardState.enemyTanks.some(
        (t) => `${t.coord.q},${t.coord.r}` === shermanKey
      );
      if (hasCollision) {
        const missionDef = missions.find((m) => m.id === parsed.boardState.missionData?.id);
        if (missionDef) {
          const { blackNumbers } = extractMissionSpawnPoints(missionDef);
          const occupiedKeys = new Set<string>();
          occupiedKeys.add(shermanKey);
          parsed.boardState.enemyTanks.forEach((t) => {
            if (`${t.coord.q},${t.coord.r}` !== shermanKey) {
              occupiedKeys.add(`${t.coord.q},${t.coord.r}`);
            }
          });

          parsed.boardState.enemyTanks.forEach((t) => {
            if (`${t.coord.q},${t.coord.r}` === shermanKey) {
              const freeSp = blackNumbers.find((b) => !occupiedKeys.has(`${b.hex.q},${b.hex.r}`));
              if (freeSp) {
                t.coord = { ...freeSp.hex };
                t.facing = freeSp.facing;
                t.spawnNumber = freeSp.number;
                occupiedKeys.add(`${freeSp.hex.q},${freeSp.hex.r}`);
              }
            }
          });
        }
      }
    }

    const shermanTile = tileMap.get(`${parsed.boardState.sherman.coord.q},${parsed.boardState.sherman.coord.r}`);
    const shermanOperations = parsed.boardState.shermanOperations
      ? {
          ...parsed.boardState.shermanOperations,
          phaseStartTerrain: shermanTile?.terrain || parsed.boardState.shermanOperations.phaseStartTerrain || 'field',
        }
      : undefined;

    const boardState: BoardState = {
      tiles: tileMap,
      sherman: parsed.boardState.sherman,
      enemyTanks: parsed.boardState.enemyTanks,
      enemyTrucks: parsed.boardState.enemyTrucks,
      enemyInfantry: parsed.boardState.enemyInfantry,
      currentTurn: parsed.boardState.currentTurn,
      currentPhase: parsed.boardState.currentPhase,
      missionData: parsed.boardState.missionData,
      shermanOperations,
    };

    setActiveSlotId(slotId);

    return {
      metadata: parsed.metadata,
      boardState,
      combatLog: parsed.combatLog || [],
      campaignState: parsed.campaignState || null,
    };
  } catch (err) {
    console.error(`Error loading game from slot ${slotId}:`, err);
    return null;
  }
}

/**
 * Deletes a save slot by ID
 */
export function deleteSaveSlot(slotId: string): boolean {
  try {
    localStorage.removeItem(`${SLOT_DATA_PREFIX}${slotId}`);
    const slots = listSaveSlots().filter((s) => s.id !== slotId);
    localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));

    const activeId = getActiveSlotId();
    if (activeId === slotId) {
      if (slots.length > 0) {
        setActiveSlotId(slots[0].id);
      } else {
        localStorage.removeItem(ACTIVE_SLOT_KEY);
      }
    }
    return true;
  } catch (err) {
    console.error(`Error deleting slot ${slotId}:`, err);
    return false;
  }
}

/**
 * Renames a save slot
 */
export function renameSaveSlot(slotId: string, newName: string): boolean {
  try {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    const slots = listSaveSlots();
    const target = slots.find((s) => s.id === slotId);
    if (!target) return false;

    target.name = trimmed;
    target.updatedAt = new Date().toISOString();
    localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));

    // Update inside payload if exists
    const raw = localStorage.getItem(`${SLOT_DATA_PREFIX}${slotId}`);
    if (raw) {
      const parsed: SaveSlotData = JSON.parse(raw);
      parsed.metadata.name = trimmed;
      parsed.metadata.updatedAt = target.updatedAt;
      localStorage.setItem(`${SLOT_DATA_PREFIX}${slotId}`, JSON.stringify(parsed));
    }
    return true;
  } catch (err) {
    console.error(`Error renaming slot ${slotId}:`, err);
    return false;
  }
}

/**
 * Duplicates a save slot
 */
export function duplicateSaveSlot(sourceSlotId: string, newName?: string): string | null {
  try {
    const loaded = loadGameFromSlot(sourceSlotId);
    if (!loaded) return null;

    const newSlotId = `slot_${Date.now()}`;
    const name = newName || `${loaded.metadata.name} (Copia)`;

    const success = saveGameToSlot(newSlotId, {
      name,
      mode: loaded.metadata.mode,
      boardState: loaded.boardState,
      combatLog: loaded.combatLog,
      campaignState: loaded.campaignState,
    });

    return success ? newSlotId : null;
  } catch (err) {
    console.error(`Error duplicating slot ${sourceSlotId}:`, err);
    return null;
  }
}

/**
 * Exports a single slot to a JSON string
 */
export function exportSlotToJson(slotId: string): string | null {
  try {
    const raw = localStorage.getItem(`${SLOT_DATA_PREFIX}${slotId}`);
    if (!raw) return null;
    return raw;
  } catch (err) {
    console.error(`Error exporting slot ${slotId}:`, err);
    return null;
  }
}

/**
 * Exports all slots and index to a JSON backup bundle
 */
export function exportAllSlotsToJson(): string {
  try {
    const slots = listSaveSlots();
    const dataMap: Record<string, SaveSlotData> = {};

    slots.forEach((s) => {
      const raw = localStorage.getItem(`${SLOT_DATA_PREFIX}${s.id}`);
      if (raw) {
        dataMap[s.id] = JSON.parse(raw);
      }
    });

    const bundle = {
      version: 2,
      exportedAt: new Date().toISOString(),
      activeSlotId: getActiveSlotId(),
      slotsIndex: slots,
      slotsData: dataMap,
    };

    return JSON.stringify(bundle, null, 2);
  } catch (err) {
    console.error('Error exporting all slots:', err);
    return '{}';
  }
}

/**
 * Imports a single save slot or a backup bundle from a JSON string
 */
export function importSlotFromJson(jsonStr: string): { success: boolean; slotId?: string; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);

    // Case 1: Backup Bundle containing multiple slots
    if (parsed.version === 2 && parsed.slotsIndex && parsed.slotsData) {
      const currentSlots = listSaveSlots();
      const existingIds = new Set(currentSlots.map((s) => s.id));

      Object.entries(parsed.slotsData).forEach(([slotId, slotData]) => {
        const data = slotData as SaveSlotData;
        const targetId = existingIds.has(slotId) ? `slot_${Date.now()}_${Math.floor(Math.random() * 1000)}` : slotId;
        data.metadata.id = targetId;
        localStorage.setItem(`${SLOT_DATA_PREFIX}${targetId}`, JSON.stringify(data));
      });

      // Rebuild index
      const allFoundSlots: SaveSlotMetadata[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(SLOT_DATA_PREFIX)) {
          try {
            const itemRaw = localStorage.getItem(key);
            if (itemRaw) {
              const itemParsed: SaveSlotData = JSON.parse(itemRaw);
              allFoundSlots.push(itemParsed.metadata);
            }
          } catch {
            // ignore malformed
          }
        }
      }
      allFoundSlots.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(allFoundSlots));

      if (allFoundSlots.length > 0) {
        setActiveSlotId(allFoundSlots[0].id);
      }

      return { success: true, slotId: allFoundSlots[0]?.id };
    }

    // Case 2: Single SaveSlotData
    if (parsed.metadata && parsed.boardState) {
      const singleData = parsed as SaveSlotData;
      const targetId = `slot_${Date.now()}`;
      singleData.metadata.id = targetId;
      singleData.metadata.name = `${singleData.metadata.name} (Importada)`;
      singleData.metadata.updatedAt = new Date().toISOString();

      localStorage.setItem(`${SLOT_DATA_PREFIX}${targetId}`, JSON.stringify(singleData));

      const slots = listSaveSlots();
      const updated = [singleData.metadata, ...slots];
      localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(updated));
      setActiveSlotId(targetId);

      return { success: true, slotId: targetId };
    }

    return { success: false, error: 'Formato de archivo JSON no válido para Sherman Solitario.' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Error al procesar JSON: ${message}` };
  }
}

/**
 * Backward compatibility helpers
 */
export function saveGameStateToStorage(
  boardState: BoardState,
  combatLog: (string | LogEntry)[],
  campaignState?: CampaignProgress | null
): boolean {
  let activeId = getActiveSlotId();
  if (!activeId) {
    activeId = `slot_${Date.now()}`;
    setActiveSlotId(activeId);
  }

  const mode = campaignState?.active ? 'campaign' : 'single';
  return saveGameToSlot(activeId, {
    mode,
    boardState,
    combatLog,
    campaignState,
  });
}

export function loadGameStateFromStorage(): {
  boardState: BoardState;
  combatLog: (string | LogEntry)[];
  campaignState?: CampaignProgress | null;
  slotMetadata?: SaveSlotMetadata;
} | null {
  const activeId = getActiveSlotId();
  if (activeId) {
    const loaded = loadGameFromSlot(activeId);
    if (loaded) {
      return {
        boardState: loaded.boardState,
        combatLog: loaded.combatLog,
        campaignState: loaded.campaignState,
        slotMetadata: loaded.metadata,
      };
    }
  }

  // If no active slot, try listSaveSlots which auto-migrates legacy v1 save
  const slots = listSaveSlots();
  if (slots.length > 0) {
    const firstLoaded = loadGameFromSlot(slots[0].id);
    if (firstLoaded) {
      return {
        boardState: firstLoaded.boardState,
        combatLog: firstLoaded.combatLog,
        campaignState: firstLoaded.campaignState,
        slotMetadata: firstLoaded.metadata,
      };
    }
  }

  return null;
}

export function clearSavedGameState(): void {
  const activeId = getActiveSlotId();
  if (activeId) {
    deleteSaveSlot(activeId);
  }
}


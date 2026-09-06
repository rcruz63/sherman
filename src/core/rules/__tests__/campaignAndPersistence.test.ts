import { describe, it, expect, beforeEach } from 'vitest';
import mission1Raw from '../../../data/missions/mission1.json';
import mission2Raw from '../../../data/missions/mission2.json';
import { MissionJSON } from '../../../types/game';
import { loadMissionState } from '../missionLoader';
import {
  createCampaign,
  prepareCampaignNextMission,
  advanceCampaignProgress,
  isCampaignCompleted,
  getShermanCarryOverSummary,
} from '../campaign';
import {
  listSaveSlots,
  saveGameToSlot,
  loadGameFromSlot,
  deleteSaveSlot,
  renameSaveSlot,
  duplicateSaveSlot,
  exportSlotToJson,
  exportAllSlotsToJson,
  importSlotFromJson,
  loadGameStateFromStorage,
} from '../../storage/gamePersistence';

const mission1 = mission1Raw as MissionJSON;
const mission2 = mission2Raw as MissionJSON;

// Mock localStorage for node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Campaign Mode Rules & Multi-Slot Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Campaign Generation & Progression', () => {
    it('creates sequential campaign with 13 missions', () => {
      const camp = createCampaign('sequential');
      expect(camp.active).toBe(true);
      expect(camp.type).toBe('sequential');
      expect(camp.missionSequence).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
      expect(camp.currentMissionIndex).toBe(0);
      expect(isCampaignCompleted(camp)).toBe(false);
    });

    it('creates random campaign with requested count', () => {
      const camp = createCampaign('random', { count: 5 });
      expect(camp.missionSequence.length).toBe(5);
      const unique = new Set(camp.missionSequence);
      expect(unique.size).toBe(5);
    });

    it('creates custom campaign with chosen mission sequence', () => {
      const camp = createCampaign('custom', { missionIds: [1, 4, 7] });
      expect(camp.missionSequence).toEqual([1, 4, 7]);
    });

    it('advances campaign and aggregates statistics', () => {
      let camp = createCampaign('custom', { missionIds: [1, 2] });
      expect(camp.currentMissionIndex).toBe(0);

      camp = advanceCampaignProgress(camp, 1, {
        turns: 6,
        tanksDestroyed: 2,
        infantryEliminated: 1,
        crewCasualtiesCount: 1,
      });

      expect(camp.currentMissionIndex).toBe(1);
      expect(camp.completedMissionIds).toEqual([1]);
      expect(camp.campaignStats.totalTurns).toBe(6);
      expect(camp.campaignStats.tanksDestroyed).toBe(2);
      expect(isCampaignCompleted(camp)).toBe(false);

      // Complete last mission
      camp = advanceCampaignProgress(camp, 2, {
        turns: 4,
        tanksDestroyed: 1,
        infantryEliminated: 0,
        crewCasualtiesCount: 0,
      });

      expect(camp.currentMissionIndex).toBe(2);
      expect(camp.completedMissionIds).toEqual([1, 2]);
      expect(camp.campaignStats.totalTurns).toBe(10);
      expect(camp.campaignStats.tanksDestroyed).toBe(3);
      expect(isCampaignCompleted(camp)).toBe(true);
    });
  });

  describe('Campaign Inter-Mission Transition Rules (Rulebook Page 19)', () => {
    it('carries over turret damage, immobilized, fire level, loaded gun, and allows 1 KIA replacement', () => {
      const board1 = loadMissionState(mission1);

      // Simulate damage and status in Mission 1
      board1.sherman.isTurretDamaged = true;
      board1.sherman.isImmobilized = true;
      board1.sherman.fireLevel = 2;
      board1.sherman.isLoaded = true;

      // Mark Commander & Driver as KIA
      board1.sherman.crew.commander.status = 'kia';
      board1.sherman.crew.driver.status = 'kia';

      const summary = getShermanCarryOverSummary(board1.sherman);
      expect(summary.isTurretDamaged).toBe(true);
      expect(summary.isImmobilized).toBe(true);
      expect(summary.fireLevel).toBe(2);
      expect(summary.isLoaded).toBe(true);
      expect(summary.kiaCrew.length).toBe(2);
      expect(summary.activeCrewCount).toBe(3);

      // Transition to Mission 2, choosing to replace Commander
      const board2 = prepareCampaignNextMission(mission2, board1.sherman, 'commander');

      // Verify carried-over status
      expect(board2.sherman.isTurretDamaged).toBe(true);
      expect(board2.sherman.isImmobilized).toBe(true);
      expect(board2.sherman.fireLevel).toBe(2);
      expect(board2.sherman.isLoaded).toBe(true);

      // Verify Commander was replaced (active) and Driver remains KIA
      expect(board2.sherman.crew.commander.status).toBe('active');
      expect(board2.sherman.crew.driver.status).toBe('kia');
    });
  });

  describe('Multi-Slot Local Storage Persistence System', () => {
    it('saves and loads multiple independent slots', () => {
      const board1 = loadMissionState(mission1);
      board1.currentTurn = 3;
      const log1 = ['Slot 1 turn 3'];

      const board2 = loadMissionState(mission2);
      board2.currentTurn = 5;
      const log2 = ['Slot 2 turn 5'];

      saveGameToSlot('slot_alpha', {
        name: 'Partida Alpha',
        mode: 'single',
        boardState: board1,
        combatLog: log1,
      });

      saveGameToSlot('slot_beta', {
        name: 'Partida Beta (Campaña)',
        mode: 'campaign',
        boardState: board2,
        combatLog: log2,
        campaignState: createCampaign('sequential'),
      });

      const slots = listSaveSlots();
      expect(slots.length).toBe(2);

      const loadedAlpha = loadGameFromSlot('slot_alpha');
      expect(loadedAlpha?.metadata.name).toBe('Partida Alpha');
      expect(loadedAlpha?.boardState.currentTurn).toBe(3);
      expect(loadedAlpha?.metadata.mode).toBe('single');

      const loadedBeta = loadGameFromSlot('slot_beta');
      expect(loadedBeta?.metadata.name).toBe('Partida Beta (Campaña)');
      expect(loadedBeta?.boardState.currentTurn).toBe(5);
      expect(loadedBeta?.metadata.mode).toBe('campaign');
      expect(loadedBeta?.campaignState?.active).toBe(true);
    });

    it('renames, duplicates, and deletes slots properly', () => {
      const board = loadMissionState(mission1);
      saveGameToSlot('slot_1', {
        name: 'Original',
        mode: 'single',
        boardState: board,
        combatLog: ['Test log'],
      });

      renameSaveSlot('slot_1', 'Nuevo Nombre');
      expect(loadGameFromSlot('slot_1')?.metadata.name).toBe('Nuevo Nombre');

      const dupId = duplicateSaveSlot('slot_1', 'Copia de Seguridad');
      expect(dupId).not.toBeNull();
      expect(listSaveSlots().length).toBe(2);
      if (dupId) {
        expect(loadGameFromSlot(dupId)?.metadata.name).toBe('Copia de Seguridad');
      }

      deleteSaveSlot('slot_1');
      expect(listSaveSlots().length).toBe(1);
      expect(loadGameFromSlot('slot_1')).toBeNull();
    });

    it('exports and imports JSON single saves and backup bundles', () => {
      const board = loadMissionState(mission1);
      saveGameToSlot('slot_export', {
        name: 'Partida Exportable',
        mode: 'single',
        boardState: board,
        combatLog: ['Export log'],
      });

      const jsonSingle = exportSlotToJson('slot_export');
      expect(jsonSingle).not.toBeNull();

      const backupAll = exportAllSlotsToJson();
      expect(backupAll).toContain('Partida Exportable');

      localStorageMock.clear();
      expect(listSaveSlots().length).toBe(0);

      const importRes = importSlotFromJson(jsonSingle!);
      expect(importRes.success).toBe(true);
      expect(listSaveSlots().length).toBe(1);
      expect(listSaveSlots()[0].name).toContain('Partida Exportable');

      // Test importing full backup bundle
      const importBundleRes = importSlotFromJson(backupAll);
      expect(importBundleRes.success).toBe(true);
    });

    it('auto-migrates legacy v1 single save to slot system', () => {
      const legacyPayload = {
        boardState: {
          tiles: Array.from(loadMissionState(mission1).tiles.entries()),
          sherman: loadMissionState(mission1).sherman,
          enemyTanks: loadMissionState(mission1).enemyTanks,
          enemyInfantry: loadMissionState(mission1).enemyInfantry,
          currentTurn: 7,
          currentPhase: 'PHASE_1_EVENT',
          missionData: mission1,
        },
        combatLog: ['Legacy turn 7'],
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem('sherman_game_save_v1', JSON.stringify(legacyPayload));

      const slots = listSaveSlots();
      expect(slots.length).toBe(1);
      expect(slots[0].currentTurn).toBe(7);

      const loaded = loadGameStateFromStorage();
      expect(loaded?.boardState.currentTurn).toBe(7);
      expect(loaded?.combatLog).toEqual(['Legacy turn 7']);
    });
  });
});


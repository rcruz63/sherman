import { describe, it, expect } from 'vitest';
import mission2Raw from '../../../data/missions/mission2.json';
import { MissionJSON } from '../../../types/game';
import {
  loadMissionState,
  resolveMissionEvent,
} from '../missionLoader';
import { handleMinesEvent } from '../eventHandlers';

const mission2 = mission2Raw as MissionJSON;

describe('Mission 2 & MINES Event Integration Tests', () => {
  describe('Mission 2 Loading & Multi-Tank Deployment', () => {
    it('loads Mission 2 correctly with 1 Tiger and 2 Panzer III tanks', () => {
      const boardState = loadMissionState(mission2, { selectedBlackSpawns: [1, 2, 3] });

      expect(boardState.missionData?.id).toBe(2);
      expect(boardState.missionData?.title).toBe('Misión 2 - La Caza del Tiger');
      expect(boardState.enemyTanks).toHaveLength(3);

      const tiger = boardState.enemyTanks.find((t) => t.type === 'tiger');
      expect(tiger).toBeDefined();
      expect(tiger?.size).toBe(5); // TAM 5
      expect(tiger?.armor).toEqual({ D: 10, LD: 7, LT: 5, T: 4 });
      expect(tiger?.penetration).toBe(9); // PEN 9

      const panzer3Tanks = boardState.enemyTanks.filter((t) => t.type === 'panzerIII');
      expect(panzer3Tanks).toHaveLength(2);
      expect(panzer3Tanks[0].size).toBe(3);
      expect(panzer3Tanks[0].armor).toEqual({ D: 5, LD: 3, LT: 2, T: 2 });
    });
  });

  describe('MINES Event Logic Verification (handleMinesEvent)', () => {
    it('triggers mine hit and immobilizes Sherman when on Road and not immobilized', () => {
      const boardState = loadMissionState(mission2);
      // Sherman is at (1,8) which is on Road
      boardState.sherman.isImmobilized = false;

      // Roll 6 -> PEN 0 + Roll 6 = 6 vs BL 4 -> Damage/Penetration!
      const result = handleMinesEvent(boardState, 6);

      expect(result.triggered).toBe(true);
      expect(result.affected).toBe(true);
      expect(boardState.sherman.isImmobilized).toBe(true);
      expect(result.detail).toContain('MINAS EN CARRETERA');
    });

    it('has NO effect when Sherman is on Field terrain', () => {
      const boardState = loadMissionState(mission2);
      // Move Sherman to a field tile (0,8)
      boardState.sherman.coord = { q: 0, r: 8 };
      boardState.sherman.isImmobilized = false;

      const result = handleMinesEvent(boardState, 6);

      expect(result.triggered).toBe(true);
      expect(result.affected).toBe(false);
      expect(boardState.sherman.isImmobilized).toBe(false);
      expect(result.detail).toContain('no se encuentra en una carretera');
    });

    it('has NO effect when Sherman is ALREADY immobilized', () => {
      const boardState = loadMissionState(mission2);
      // Sherman is on Road (1,8) but already immobilized
      boardState.sherman.isImmobilized = true;

      const result = handleMinesEvent(boardState, 6);

      expect(result.triggered).toBe(true);
      expect(result.affected).toBe(false);
      expect(result.detail).toContain('ya se encuentra Inmovilizado');
    });
  });

  describe('Mission 2 Event Table Resolution (2d6)', () => {
    const events = mission2.endOfTurnEvents;

    it('resolves roll 2-5 to SPAWN_INFANTRY', () => {
      expect(resolveMissionEvent(events, 2)?.type).toBe('SPAWN_INFANTRY');
      expect(resolveMissionEvent(events, 5)?.type).toBe('SPAWN_INFANTRY');
    });

    it('resolves roll 6 to MINES', () => {
      const rule = resolveMissionEvent(events, 6);
      expect(rule?.type).toBe('MINES');
      expect(rule?.description).toContain('Minas');
    });

    it('resolves roll 7-8 to INFANTRY_ATTACK', () => {
      expect(resolveMissionEvent(events, 7)?.type).toBe('INFANTRY_ATTACK');
      expect(resolveMissionEvent(events, 8)?.type).toBe('INFANTRY_ATTACK');
    });

    it('resolves roll 9 to COMMANDER_ORDER', () => {
      expect(resolveMissionEvent(events, 9)?.type).toBe('COMMANDER_ORDER');
    });

    it('resolves roll 10 to STUKA', () => {
      expect(resolveMissionEvent(events, 10)?.type).toBe('STUKA');
    });

    it('resolves roll 11-12 to SPAWN_PANZER_IV', () => {
      expect(resolveMissionEvent(events, 11)?.type).toBe('SPAWN_PANZER_IV');
      expect(resolveMissionEvent(events, 12)?.type).toBe('SPAWN_PANZER_IV');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { missions } from '../../../data/missions';
import { loadMissionState } from '../missionLoader';
import { calculateSectionDice } from '../shermanOperations';

describe('All 13 Missions Terrain & Sherman Operations Dice Pools Verification', () => {
  missions.forEach((mission) => {
    it(`Mission ${mission.id} - ${mission.title}: Sherman initial tile terrain and operations pool`, () => {
      const boardState = loadMissionState(mission);
      const sherman = boardState.sherman;
      const startKey = `${sherman.coord.q},${sherman.coord.r}`;
      const startTile = boardState.tiles.get(startKey);

      expect(startTile).toBeDefined();

      // For Missions 1 to 5 and 7 to 13 (entry at road (5,4)):
      // The entry hex should be road terrain
      if (sherman.coord.q === 5 && sherman.coord.r === 4) {
        expect(startTile!.terrain).toBe('road');
      }

      // Test Maneuver dice calculation
      const maneuverInterior = calculateSectionDice(
        'maneuver',
        startTile!.terrain,
        { ...sherman, commanderPosition: 'unhatched' },
        mission.shermanDicePool
      );

      const maneuverHatched = calculateSectionDice(
        'maneuver',
        startTile!.terrain,
        { ...sherman, commanderPosition: 'hatched' },
        mission.shermanDicePool
      );

      if (sherman.isImmobilized) {
        // e.g. Mission 6 begins immobilized
        expect(maneuverInterior.totalDice).toBe(0);
        expect(maneuverInterior.isImmobilized).toBe(true);
      } else if (startTile!.terrain === 'road') {
        // Road: Base 2 + Driver 1 + Assistant 1 = 4 (or 5 if Hatched)
        expect(maneuverInterior.totalDice).toBe(4);
        expect(maneuverHatched.totalDice).toBe(5);
      } else if (startTile!.terrain === 'field') {
        // Field: Base 1 + Driver 1 + Assistant 1 = 3 (or 4 if Hatched)
        expect(maneuverInterior.totalDice).toBe(3);
        expect(maneuverHatched.totalDice).toBe(4);
      }

      // Test Attack dice calculation
      const attackHatched = calculateSectionDice(
        'attack',
        startTile!.terrain,
        { ...sherman, commanderPosition: 'hatched' },
        mission.shermanDicePool
      );

      if (startTile!.terrain === 'road' || startTile!.terrain === 'field') {
        // Base 2 + Gunner 1 + Loader 1 + Hatched 1 = 5
        expect(attackHatched.totalDice).toBe(5);
      }
    });
  });
});

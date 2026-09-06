import { describe, it, expect } from 'vitest';
import { validateMapConfig, autoFixMapConfig } from '../mapValidator';
import { missions } from '../../../data/missions';

describe('Map Validator for all Campaign Missions', () => {
  missions.forEach((mission) => {
    it(`validates Mission ${mission.id} ("${mission.title}")`, () => {
      const fixed = autoFixMapConfig(mission);
      const result = validateMapConfig(fixed);
      expect(result.isValid).toBe(true);
      expect(result.issues.filter(i => i.type === 'ERROR')).toHaveLength(0);
    });
  });
});

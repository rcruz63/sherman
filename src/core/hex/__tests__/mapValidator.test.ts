import { describe, it, expect } from 'vitest';
import { validateMapConfig, autoFixMapConfig } from '../mapValidator';
import { mission1Data } from '../../../data/missions/mission1';

describe('Map Validator & Auto-Fixer', () => {
  it('validates Mission 1 map configuration', () => {
    const result = validateMapConfig(mission1Data);
    expect(result.isValid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('auto-fixes maps with missing reciprocal edge features', () => {
    const dirtyMission = JSON.parse(JSON.stringify(mission1Data));
    // Introduce a missing treeline on neighbor
    dirtyMission.hexes[0].treeLines = ['NE'];
    
    const fixed = autoFixMapConfig(dirtyMission);
    const result = validateMapConfig(fixed);
    expect(result.isValid).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { getTargetImpactSector, isTargetInRearArc } from '../facing';
import { Facing } from '../../../types/game';

describe('Facing & Armor Impact Sectors', () => {
  it('correctly maps impact sectors for a target facing 0 (East)', () => {
    const targetPos = { q: 0, r: 0 };
    const targetFacing: Facing = 0; // Front = East (Dir 0)

    // Attacker at Dir 0 (East) -> Frontal (D)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 3, r: 0 })).toBe('D');

    // Attacker at Dir 1 (South-East) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 0, r: 3 })).toBe('LD');

    // Attacker at Dir 5 (North-East) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 3, r: -3 })).toBe('LD');

    // Attacker at Dir 2 (South-West) -> Lateral Trasero (LT)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: -3, r: 3 })).toBe('LT');

    // Attacker at Dir 4 (North-West) -> Lateral Trasero (LT)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 0, r: -3 })).toBe('LT');

    // Attacker at Dir 3 (West) -> Trasero (T)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: -3, r: 0 })).toBe('T');
  });

  it('correctly maps impact sectors when target rotates (Facing 3 - West)', () => {
    const targetPos = { q: 0, r: 0 };
    const targetFacing: Facing = 3; // Front = West (Dir 3)

    // Attacker at Dir 3 (West) -> Frontal (D)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: -4, r: 0 })).toBe('D');

    // Attacker at Dir 0 (East) -> Rear (T)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 4, r: 0 })).toBe('T');

    // Attacker at Dir 2 (South-West) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: -2, r: 2 })).toBe('LD');

    // Attacker at Dir 4 (North-West) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 0, r: -2 })).toBe('LD');
  });

  it('identifies if target is in attacker rear arc', () => {
    const attackerPos = { q: 0, r: 0 };
    const attackerFacing: Facing = 0; // Facing East

    // Target to East -> Front arc
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: 3, r: 0 })).toBe(false);

    // Target to West -> Rear arc (180°)
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: -3, r: 0 })).toBe(true);

    // Target to South-West -> Rear arc (120°)
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: -2, r: 2 })).toBe(true);

    // Target to North-West -> Rear arc (120°)
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: 0, r: -2 })).toBe(true);
  });
});

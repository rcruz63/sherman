import { describe, it, expect } from 'vitest';
import { getTargetImpactSector, isTargetInRearArc } from '../facing';
import { Facing } from '../../../types/game';

describe('Facing & Armor Impact Sectors', () => {
  it('correctly maps impact sectors for a target facing 0 (North)', () => {
    const targetPos = { q: 0, r: 0 };
    const targetFacing: Facing = 0; // Front = North (Dir 0)

    // Attacker at Dir 0 (North) -> Frontal (D)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 0, r: -3 })).toBe('D');

    // Attacker at Dir 1 (Noreste) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 3, r: -3 })).toBe('LD');

    // Attacker at Dir 5 (Noroeste) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: -3, r: 0 })).toBe('LD');

    // Attacker at Dir 2 (Sureste) -> Lateral Trasero (LT)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 3, r: 0 })).toBe('LT');

    // Attacker at Dir 4 (Suroeste) -> Lateral Trasero (LT)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: -3, r: 3 })).toBe('LT');

    // Attacker at Dir 3 (Sur) -> Trasero (T)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 0, r: 3 })).toBe('T');
  });

  it('correctly maps impact sectors when target rotates (Facing 3 - South)', () => {
    const targetPos = { q: 0, r: 0 };
    const targetFacing: Facing = 3; // Front = South (Dir 3)

    // Attacker at Dir 3 (South) -> Frontal (D)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 0, r: 4 })).toBe('D');

    // Attacker at Dir 0 (North) -> Rear (T)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 0, r: -4 })).toBe('T');

    // Attacker at Dir 2 (Sureste) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: 3, r: 0 })).toBe('LD');

    // Attacker at Dir 4 (Suroeste) -> Lateral Delantero (LD)
    expect(getTargetImpactSector(targetPos, targetFacing, { q: -2, r: 2 })).toBe('LD');
  });

  it('identifies if target is in attacker rear arc', () => {
    const attackerPos = { q: 0, r: 0 };
    const attackerFacing: Facing = 0; // Facing North

    // Target to North -> Front arc
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: 0, r: -3 })).toBe(false);

    // Target to South -> Rear arc (180°)
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: 0, r: 3 })).toBe(true);

    // Target to Suroeste -> Rear arc (120°)
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: -2, r: 2 })).toBe(true);

    // Target to Sureste -> Rear arc (120°)
    expect(isTargetInRearArc(attackerPos, attackerFacing, { q: 3, r: 0 })).toBe(true);
  });
});

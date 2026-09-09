import { describe, it, expect } from 'vitest';
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
} from '../dicePrompts';
import { loadMissionState } from '../missionLoader';
import { calculateHitDifficulty } from '../combat';
import mission1Raw from '../../../data/missions/mission1.json';
import { MissionJSON } from '../../../types/game';

const mission1Data = mission1Raw as MissionJSON;


describe('Dice Prompts and Tables Unit Tests', () => {
  it('creates deployment prompt with 1d6 and highlights the correct black spawn point', () => {
    const points = [
      { number: 1, coord: { q: 1, r: 1 }, facing: 2 },
      { number: 2, coord: { q: 2, r: 2 }, facing: 3 },
      { number: 3, coord: { q: 3, r: 3 }, facing: 0 },
    ];

    const prompt = createDeploymentPrompt({
      unitLabel: 'Panzer IV #1',
      spawnType: 'black',
      availablePoints: points,
      occupiedNumbers: [1],
    });

    expect(prompt.diceCount).toBe(1);
    expect(prompt.category).toBe('deployment');
    expect(prompt.tableEntries.length).toBe(6);

    // Roll 2 -> available
    const effectAvailable = prompt.calculateEffect([2], 2);
    expect(effectAvailable.badge).toBe('DESPLIEGUE CONFIRMADO');
    expect(prompt.highlightIndex([2], 2)).toBe(1); // 0-indexed for number 2

    // Roll 1 -> occupied
    const effectOccupied = prompt.calculateEffect([1], 1);
    expect(effectOccupied.badge).toBe('NÚMERO OCUPADO');
  });

  it('creates section dice prompt for Maneuver with variable dice count', () => {
    const prompt = createSectionDicePrompt({
      section: 'maneuver',
      terrain: 'road',
      diceCount: 4,
      explanation: ['Carretera base: 4 dados'],
    });

    expect(prompt.diceCount).toBe(4);
    expect(prompt.category).toBe('operations');

    // Rolls [1, 3, 5, 6] should highlight:
    // 1 -> index 0 (Retroceder)
    // 3 -> index 1 (Girar)
    // 5, 6 -> index 2 (Avanzar)
    const highlighted = prompt.highlightIndex([1, 3, 5, 6], 15);
    expect(highlighted).toContain(0);
    expect(highlighted).toContain(1);
    expect(highlighted).toContain(2);

    const effect = prompt.calculateEffect([1, 3, 5, 6], 15);
    expect(effect.badge).toBe('RESERVA CALCULADA');
    expect(effect.description).toContain('Dados obtenidos: [1, 3, 5, 6]');
  });

  it('creates Sherman gun hit check prompt with 2d6 and difficulty calculation', () => {
    const boardState = loadMissionState(mission1Data, { selectedBlackSpawns: [1, 2] });
    const target = boardState.enemyTanks[0];
    const hitCalc = calculateHitDifficulty(boardState.sherman, target, boardState);
    const diff = hitCalc.totalDifficulty;

    const prompt = createShermanGunHitPrompt(boardState.sherman, target, boardState);
    expect(prompt.diceCount).toBe(2);
    expect(prompt.category).toBe('combat');

    // A roll matching or beating diff should hit
    const hitEffect = prompt.calculateEffect([diff > 6 ? 6 : diff, diff > 6 ? diff - 6 : 0], diff);
    expect(hitEffect.badge).toBe('¡IMPACTO CONFIRMADO!');
    expect(prompt.highlightIndex([6, 6], diff)).toBe(1);

    // Low roll (diff - 1 or 2) should miss
    const missEffect = prompt.calculateEffect([1, 1], 2);
    if (diff > 2) {
      expect(missEffect.badge).toBe('DISPARO FALLADO');
      expect(prompt.highlightIndex([1, 1], 2)).toBe(0);
    }
  });

  it('creates gun damage check prompt for penetration (1d6 >= armor - pen)', () => {
    // Penetration 5, Armor 7 -> threshold = 7 - 5 = 2
    const prompt = createGunDamageCheckPrompt(5, 7, 'PANZER IV #1', 'Frontal');
    expect(prompt.diceCount).toBe(1);

    // Roll 1 < 2 -> bounced
    const bounceEffect = prompt.calculateEffect([1], 1);
    expect(bounceEffect.badge).toBe('PROYECTIL REBOTADO');
    expect(prompt.highlightIndex([1], 1)).toBe(0);

    // Roll 4 >= 2 -> penetrated
    const penEffect = prompt.calculateEffect([4], 4);
    expect(penEffect.badge).toBe('¡PENETRACIÓN EXITOSA!');
    expect(prompt.highlightIndex([4], 4)).toBe(1);
  });

  it('creates German tank damage effect prompt (1d6)', () => {
    const prompt = createGermanTankDamageEffectPrompt('PANZER IV #1');
    expect(prompt.diceCount).toBe(1);

    // Roll 1-4: Damaged
    expect(prompt.calculateEffect([2], 2).badge).toBe('TANQUE DAÑADO');
    expect(prompt.calculateEffect([4], 4).badge).toBe('TANQUE DAÑADO');

    // Roll 5-6: Destroyed
    expect(prompt.calculateEffect([6], 6).badge).toBe('¡OBJETIVO DESTRUIDO!');
    expect(prompt.highlightIndex([6], 6)).toBe(2);
  });

  it('creates fire check prompt taking the lowest die', () => {
    const prompt = createFireCheckPrompt(3);
    expect(prompt.diceCount).toBe(3);
    expect(prompt.category).toBe('fire');

    // Rolls [4, 2, 5] -> lowest is 2 (Comprueba KIA)
    const effect = prompt.calculateEffect([4, 2, 5], 11);
    expect(effect.badge).toBe('COMPRUEBA KIA');
    expect(prompt.highlightIndex([4, 2, 5], 11)).toBe(1); // index 1 is row 2 (Comprueba KIA)

    // Rolls [6, 6, 6] -> lowest is 6 (Inmovilizado)
    expect(prompt.calculateEffect([6, 6, 6], 18).badge).toBe('DAÑO MECÁNICO');
    expect(prompt.highlightIndex([6, 6, 6], 18)).toBe(4); // index 4 is row 6
  });

  it('creates crew casualty prompt (KIA 1d6)', () => {
    const promptHatched = createCrewCasualtyPrompt(true);
    expect(promptHatched.calculateEffect([1], 1).badge).toBe('BAJA EN TRIPULACIÓN');
    expect(promptHatched.calculateEffect([6], 6).badge).toBe('BAJA EN TRIPULACIÓN');

    const promptUnhatched = createCrewCasualtyPrompt(false);
    expect(promptUnhatched.calculateEffect([1], 1).badge).toBe('BAJA EN TRIPULACIÓN');
    // Roll 6 when unhatched means commander safe inside
    expect(promptUnhatched.calculateEffect([6], 6).badge).toBe('¡SIN BAJAS!');
  });


  it('creates Sherman MG prompt vs infantry (2d6)', () => {
    const prompt = createShermanMGPrompt({ q: 1, r: 2 }, 7);
    expect(prompt.diceCount).toBe(2);
    expect(prompt.calculateEffect([4, 4], 8).badge).toBe('¡INFANTERÍA ELIMINADA!');
    expect(prompt.calculateEffect([2, 3], 5).badge).toBe('SIN EFECTO');
  });

  it('creates German AI pool prompt', () => {
    const boardState = loadMissionState(mission1Data, { selectedBlackSpawns: [1, 2] });
    const tank = boardState.enemyTanks[0];
    const prompt = createGermanAIPoolPrompt(tank, 'road', 'ROAD', 4);
    expect(prompt.diceCount).toBe(4);
    expect(prompt.category).toBe('ai');
    expect(prompt.calculateEffect([1, 2, 4, 6], 13).badge).toBe('ORDEN IA ESTABLECIDO');
  });

  it('creates Phase 7 mission event prompt for 2d6', () => {
    const events = mission1Data.endOfTurnEvents || [];
    const prompt = createPhase7EventPrompt(events, 1);
    expect(prompt.diceCount).toBe(2);
    expect(prompt.category).toBe('event');

    // Roll 7
    const effect = prompt.calculateEffect([3, 4], 7);
    expect(effect.badge).toContain('EVENTO:');
    expect(effect.description).toContain('7');
  });
});


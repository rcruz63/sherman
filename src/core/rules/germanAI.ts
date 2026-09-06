/**
 * German Tank Deterministic AI Engine
 */

import { BoardState, EnemyTank, Facing } from '../../types/game';
import { hexDistance, hexNeighbor } from '../hex/math';
import { getClosestDirection } from '../hex/facing';
import { calculateHitDifficulty, resolveDamageCheck, resolveDamageEffect } from './combat';
import { SECTOR_NAMES } from './logUtils';

export interface AIActionResult {
  tankId: string;
  tankType: string;
  actionTaken: string;
  detail: string;
  diceRolls: number[];
}

/**
 * Calculates facing turn towards Sherman according to AI Turning Rules:
 * Rule 1: Directly facing Sherman + front hex blocked -> Turn to accessible hex
 * Rule 2: Sherman in direct rear -> Turn to accessible hex
 * Rule 3: If directly facing Sherman -> Do NOT turn. Otherwise -> Turn by smallest angle towards Sherman.
 */
export function calculateAITurningFacing(
  tank: EnemyTank,
  boardState: BoardState
): Facing {
  const shermanCoord = boardState.sherman.coord;
  const dirToSherman = getClosestDirection(tank.coord, shermanCoord);
  const diff = (dirToSherman - tank.facing + 6) % 6;

  // Rule 3: If directly facing Sherman (diff === 0), do not turn!
  if (diff === 0) {
    return tank.facing;
  }

  // Turning towards Sherman by smallest angle
  if (diff === 1 || diff === 2) {
    return ((tank.facing + 1) % 6) as Facing;
  } else if (diff === 4 || diff === 5) {
    return ((tank.facing + 5) % 6) as Facing;
  } else {
    // Direct rear (diff === 3): Turn left or right (default +1)
    return ((tank.facing + 1) % 6) as Facing;
  }
}

/**
 * Executes German AI Activation for a single enemy tank.
 * Returns detailed logs of actions performed.
 */
export function executeAITankTurn(
  tank: EnemyTank,
  boardState: BoardState,
  presetRolls?: number[]
): AIActionResult {
  if (tank.status === 'destroyed') {
    return {
      tankId: tank.id,
      tankType: tank.type,
      actionTaken: 'NONE',
      detail: `Tanque ${tank.type} impreso destruido no actúa.`,
      diceRolls: [],
    };
  }

  // Determine dice count (4, 3, or 2 based on status / terrain)
  let diceCount = tank.baseDice;
  if (tank.status === 'damaged') diceCount -= 1;

  // Roll and sort dice ascending
  const diceRolls: number[] = presetRolls || [];
  if (diceRolls.length === 0) {
    for (let i = 0; i < diceCount; i++) {
      diceRolls.push(Math.floor(Math.random() * 6) + 1);
    }
  }
  diceRolls.sort((a, b) => a - b);

  const logs: string[] = [];

  // Evaluate AI turning first
  const newFacing = calculateAITurningFacing(tank, boardState);
  if (newFacing !== tank.facing) {
    const oldFacing = tank.facing;
    tank.facing = newFacing;
    logs.push(`Giro IA: Encaramiento cambió de ${oldFacing} a ${newFacing}`);
  }

  // Attempt Attack or Movement per die
  let fired = false;
  diceRolls.forEach((_die) => {
    // Calculate hit difficulty on Sherman
    const hitCalc = calculateHitDifficulty(
      { coord: tank.coord, facing: tank.facing },
      {
        coord: boardState.sherman.coord,
        facing: boardState.sherman.facing,
        size: 4,
        hasSmoke: boardState.sherman.hasSmoke,
        isHullDown: boardState.sherman.isHullDown,
      },
      boardState
    );

    if (hitCalc.hasLOS && !fired) {
      // Primary Action: Fire Main Gun!
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const roll2d6 = d1 + d2;
      const hitSuccess = roll2d6 >= hitCalc.totalDifficulty;

      const mods: string[] = [`Dist ${hitCalc.baseDistance}`, `TAM 4`];
      if (hitCalc.buildingModifier) mods.push('Edificio +1');
      if (hitCalc.treeLineModifier) mods.push(`Arboleda +${hitCalc.treeLineModifier}`);
      if (hitCalc.smokeModifier) mods.push('Humo +1');
      if (hitCalc.hullDownModifier) mods.push('Desenfilada +2');
      if (hitCalc.rearArcModifier) mods.push('Arco Trasero +1');

      const modStr = mods.join(' + ');
      const sectorName = SECTOR_NAMES[hitCalc.impactSector] || hitCalc.impactSector;

      if (hitSuccess) {
        // Hit! Compare PEN vs Sherman Armor on hit sector
        const shermanArmor = boardState.sherman.armor[hitCalc.impactSector];
        const damageRes = resolveDamageCheck(tank.penetration, shermanArmor, roll2d6);

        if (damageRes.result === 'DAMAGED' || damageRes.result === 'DESTROYED') {
          const d1Eff = Math.floor(Math.random() * 6) + 1;
          const d2Eff = Math.floor(Math.random() * 6) + 1;
          const effectRoll = d1Eff + d2Eff;
          const effect = resolveDamageEffect('sherman', effectRoll);

          logs.push(`Disparo a Sherman (Dificultad ${hitCalc.totalDifficulty} [${modStr}]) ➔ Tirada 2d6 = [${d1}, ${d2}] = ${roll2d6} ➔ ¡IMPACTO!`);
          logs.push(`💥 Daño en Sherman: PEN ${tank.penetration} + Dados ${roll2d6} = Total ${damageRes.totalAttack} vs Blindaje ${sectorName} (${shermanArmor}) ➔ ${effect.description} (Tirada 2d6 = [${d1Eff}, ${d2Eff}] = ${effectRoll})`);

          if (effect.outcome === 'TURRET_DAMAGED') boardState.sherman.isTurretDamaged = true;
          if (effect.outcome === 'IMMOBILIZED') boardState.sherman.isImmobilized = true;
          if (effect.outcome === 'FIRE_STARTED') boardState.sherman.fireLevel += 1;
          if (effect.outcome === 'DESTROYED') boardState.sherman.isImmobilized = true;
        } else {
          logs.push(`Disparo a Sherman (Dificultad ${hitCalc.totalDifficulty} [${modStr}]) ➔ Tirada 2d6 = [${d1}, ${d2}] = ${roll2d6} ➔ REBOTADO (PEN ${tank.penetration} vs Blindaje ${sectorName} ${shermanArmor})`);
        }
      } else {
        logs.push(`Disparo a Sherman (Dificultad ${hitCalc.totalDifficulty} [${modStr}]) ➔ Tirada 2d6 = [${d1}, ${d2}] = ${roll2d6} ➔ FALLADO`);
      }
      fired = true;
    } else {
      // Secondary Action: Movement towards Sherman if possible
      const forwardHex = hexNeighbor(tank.coord, tank.facing);
      const forwardTile = boardState.tiles.get(`${forwardHex.q},${forwardHex.r}`);

      if (forwardTile && forwardTile.terrain !== 'water' && forwardTile.terrain !== 'building') {
        tank.coord = forwardHex;
        logs.push(`Movimiento IA: Avanzado a (${forwardHex.q},${forwardHex.r})`);
      } else {
        logs.push(`Mantener posición en (${tank.coord.q},${tank.coord.r})`);
      }
    }
  });

  return {
    tankId: tank.id,
    tankType: tank.type,
    actionTaken: fired ? 'ATTACK' : 'MOVE',
    detail: logs.join(' | '),
    diceRolls,
  };
}

/**
 * Runs activation for all active German tanks sorted by distance to Sherman
 */
export function runAllGermanActivations(boardState: BoardState): AIActionResult[] {
  const activeTanks = [...boardState.enemyTanks].filter((t) => t.status !== 'destroyed');

  // Sort by distance to Sherman ascending
  activeTanks.sort((a, b) => {
    const distA = hexDistance(a.coord, boardState.sherman.coord);
    const distB = hexDistance(b.coord, boardState.sherman.coord);
    return distA - distB;
  });

  return activeTanks.map((tank) => executeAITankTurn(tank, boardState));
}

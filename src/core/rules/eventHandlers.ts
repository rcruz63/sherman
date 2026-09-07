/**
 * Mission End-of-Turn Event Resolvers (Phase 7)
 * Exact implementation of Mike Lambo's "Sherman Solitario"
 */

import {
  BoardState,
  EnemyInfantry,
  EnemyTank,
  EnemyTruck,
  Facing,
} from '../../types/game';
import { checkLOS } from '../hex/los';
import { hexDistance, coordKey } from '../hex/math';
import { getClosestDirection } from '../hex/facing';
import {
  calculateHitDifficulty,
  resolveDamageCheck,
  resolveDamageEffect,
  resolveCrewCasualtyRoll,
  DamageCheckResult,
} from './combat';
import { SECTOR_NAMES } from './logUtils';
import { TANK_STATS } from './missionLoader';

export interface MinesEventResult {
  triggered: boolean;
  affected: boolean;
  detail: string;
  damageResult?: DamageCheckResult;
}

export interface MoveTruckResult {
  triggered: boolean;
  moved: boolean;
  escaped: boolean;
  detail: string;
  truck?: EnemyTruck;
}

export interface SpawnInfantryResult {
  triggered: boolean;
  spawned: boolean;
  detail: string;
  infantry?: EnemyInfantry;
}

export interface SpawnTankResult {
  triggered: boolean;
  spawned: boolean;
  detail: string;
  tank?: EnemyTank;
}

export interface SniperEventResult {
  triggered: boolean;
  killed: boolean;
  detail: string;
}

export interface CommanderOrderResult {
  triggered: boolean;
  executed: boolean;
  actionDone: string;
  detail: string;
}

export interface InfantryAttackResult {
  triggered: boolean;
  attacksCount: number;
  hitsCount: number;
  damageInflicted: boolean;
  detail: string;
}

export interface StukaEventResult {
  triggered: boolean;
  shotDown: boolean;
  hit: boolean;
  damaged: boolean;
  detail: string;
}

/**
 * 1. Infantería Alemana (Aparición / Refuerzos):
 * Lanza 1d6 y coloca en el hexágono con el número rojo coincidente.
 * Si ya tiene infantería o está ocupado por el Sherman, no ocurre evento.
 */
export function handleSpawnInfantryEvent(
  boardState: BoardState,
  presetRoll?: number
): SpawnInfantryResult {
  const roll = presetRoll ?? (Math.floor(Math.random() * 6) + 1);

  // Find tile with matching redSpawnNumber
  let targetTile = Array.from(boardState.tiles.values()).find(
    (tile) => tile.redSpawnNumber === roll
  );

  if (!targetTile) {
    return {
      triggered: true,
      spawned: false,
      detail: `Infantería alemana (Tirada 1d6 = ${roll}): No existe hexágono rojo con el número ${roll} en este mapa.`,
    };
  }

  const { q, r } = targetTile.coord;
  const shermanCoord = boardState.sherman.coord;

  // Check if occupied by Sherman
  if (shermanCoord.q === q && shermanCoord.r === r) {
    return {
      triggered: true,
      spawned: false,
      detail: `Infantería alemana (Tirada 1d6 = ${roll}): Hexágono rojo #${roll} (${q},${r}) ocupado por el Sherman ➔ Refuerzo descartado.`,
    };
  }

  // Check if already has active infantry
  const hasInfantry = boardState.enemyInfantry.some(
    (inf) => inf.status !== 'eliminated' && inf.coord.q === q && inf.coord.r === r
  );
  if (hasInfantry) {
    return {
      triggered: true,
      spawned: false,
      detail: `Infantería alemana (Tirada 1d6 = ${roll}): Hexágono rojo #${roll} (${q},${r}) ya contiene infantería ➔ Refuerzo descartado.`,
    };
  }

  const newInfantry: EnemyInfantry = {
    id: `infantry-spawn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'infantry',
    status: 'active',
    coord: { q, r },
    spawnNumber: roll,
  };
  boardState.enemyInfantry.push(newInfantry);

  return {
    triggered: true,
    spawned: true,
    detail: `Infantería alemana (Tirada 1d6 = ${roll}): ¡Nueva infantería enemiga desplegada en hexágono rojo #${roll} (${q},${r})!`,
    infantry: newInfantry,
  };
}

/**
 * 2. Ataque de Infantería Alemana:
 * Toda la infantería alemana adyacente (distancia 1) ataca.
 * Tirada para impactar a Distancia 1. Si impacta, ¿Daños? con Pen 1.
 */
export function handleInfantryAttackEvent(
  boardState: BoardState,
  presetRolls?: {
    hitRolls?: [number, number][];
    dmgRolls?: number[];
    effectRolls?: number[];
    kiaRolls?: number[];
  }
): InfantryAttackResult {
  const sherman = boardState.sherman;
  const adjacentInfantry = boardState.enemyInfantry.filter(
    (inf) => inf.status !== 'eliminated' && hexDistance(inf.coord, sherman.coord) === 1
  );

  if (adjacentInfantry.length === 0) {
    return {
      triggered: true,
      attacksCount: 0,
      hitsCount: 0,
      damageInflicted: false,
      detail: 'Ataque de infantería: No hay infantería alemana adyacente (distancia 1) al Sherman.',
    };
  }

  const logs: string[] = [];
  let hitsCount = 0;
  let damageInflicted = false;

  adjacentInfantry.forEach((inf, idx) => {
    if (sherman.isDestroyed) return;

    const hitCalc = calculateHitDifficulty(
      { coord: inf.coord, facing: 0 },
      {
        coord: sherman.coord,
        facing: sherman.facing,
        size: 4,
        hasSmoke: sherman.hasSmoke,
        isHullDown: sherman.isHullDown,
      },
      boardState
    );

    const hitPreset = presetRolls?.hitRolls?.[idx];
    const d1 = hitPreset ? hitPreset[0] : Math.floor(Math.random() * 6) + 1;
    const d2 = hitPreset ? hitPreset[1] : Math.floor(Math.random() * 6) + 1;
    const roll2d6 = d1 + d2;
    const hitSuccess = roll2d6 >= hitCalc.totalDifficulty;

    if (!hitSuccess) {
      logs.push(
        `Infantería (${inf.coord.q},${inf.coord.r}) ataca (Dif ${hitCalc.totalDifficulty}) ➔ Tirada 2d6 = [${d1}, ${d2}] = ${roll2d6} ➔ FALLADO`
      );
      return;
    }

    hitsCount++;
    const sectorName = SECTOR_NAMES[hitCalc.impactSector] || hitCalc.impactSector;
    const shermanArmor = sherman.armor[hitCalc.impactSector];
    const dmgPreset = presetRolls?.dmgRolls?.[idx];
    const dDmg = dmgPreset ?? (Math.floor(Math.random() * 6) + 1);

    // Pen 1 vs Blindaje
    const damageRes = resolveDamageCheck(1, shermanArmor, dDmg);

    if (damageRes.result === 'NO_EFFECT') {
      logs.push(
        `Infantería (${inf.coord.q},${inf.coord.r}) ¡IMPACTO! (2d6=${roll2d6}) ➔ ¿Daños? (Pen 1 vs Blindaje ${sectorName} ${shermanArmor}): 1d6=[${dDmg}] < Req ${damageRes.threshold} ➔ REBOTADO`
      );
      return;
    }

    damageInflicted = true;
    const effectPreset = presetRolls?.effectRolls?.[idx];
    const dEff = effectPreset ?? (Math.floor(Math.random() * 6) + 1);
    const effect = resolveDamageEffect('sherman', dEff);
    let desc = effect.description;

    if (effect.outcome === 'DESTROYED') {
      sherman.isDestroyed = true;
      desc = '¡Sherman Destruido!';
    } else if (effect.outcome === 'CREW_CASUALTY') {
      const kiaPreset = presetRolls?.kiaRolls?.[idx];
      const dKia = kiaPreset ?? (Math.floor(Math.random() * 6) + 1);
      const isHatched = sherman.commanderPosition === 'hatched';
      const casualty = resolveCrewCasualtyRoll(dKia, isHatched);
      if (casualty) {
        sherman.crew[casualty.role].status = 'kia';
        desc = `Comprueba KIA (1d6=[${dKia}]) ➔ ${casualty.description}`;
      } else {
        desc = `Comprueba KIA (1d6=[${dKia}]) ➔ Comandante en Interior ➔ ¡Sin bajas!`;
      }
    } else if (effect.outcome === 'DAMAGED_FIRE') {
      sherman.fireLevel += 1;
      desc = `¡Fuego! (+1 Nivel de fuego, total 🔥 ${sherman.fireLevel})`;
    } else if (effect.outcome === 'TURRET_DAMAGED') {
      sherman.isTurretDamaged = true;
      desc = 'Torreta dañada';
    } else if (effect.outcome === 'IMMOBILIZED') {
      sherman.isImmobilized = true;
      if (sherman.isHullDown) {
        sherman.isHullDown = false;
        desc = 'Inmovilizado (pierde Desenfilada)';
      } else {
        desc = 'Inmovilizado';
      }
    }

    logs.push(
      `💥 Infantería (${inf.coord.q},${inf.coord.r}) ¡IMPACTO Y DAÑO! (2d6=${roll2d6}, 1d6 daño=[${dDmg}] >= ${damageRes.threshold}) ➔ Paso 3 (1d6=[${dEff}]): ${desc}`
    );
  });

  return {
    triggered: true,
    attacksCount: adjacentInfantry.length,
    hitsCount,
    damageInflicted,
    detail: `Ataque de infantería adyacente (${adjacentInfantry.length} escuadra(s)): ${logs.join(' | ')}`,
  };
}

/**
 * 3. Francotirador:
 * Si el Comandante está en posición Asomado (Cte = A) y en LOS de cualquier infantería alemana, resulta KIA.
 */
export function handleSniperEvent(boardState: BoardState): SniperEventResult {
  const sherman = boardState.sherman;

  if (sherman.crew.commander.status === 'kia') {
    return {
      triggered: true,
      killed: false,
      detail: 'Francotirador sin efecto: El Comandante ya se encontraba KIA.',
    };
  }

  if (sherman.commanderPosition !== 'hatched') {
    return {
      triggered: true,
      killed: false,
      detail: 'Francotirador sin efecto: El Comandante está a cubierto en el Interior (I).',
    };
  }

  // Check if any active German infantry has LOS to the Sherman
  const sniperWithLOS = boardState.enemyInfantry.find(
    (inf) =>
      inf.status !== 'eliminated' &&
      checkLOS(inf.coord, sherman.coord, boardState).hasLOS
  );

  if (!sniperWithLOS) {
    return {
      triggered: true,
      killed: false,
      detail: 'Francotirador sin efecto: Ninguna infantería alemana tiene Línea de Visión hacia el Sherman.',
    };
  }

  sherman.crew.commander.status = 'kia';
  return {
    triggered: true,
    killed: true,
    detail: `🎯 ¡FRANCOTIRADOR! El Comandante estaba Asomado (A) y en Línea de Visión de la infantería en (${sniperWithLOS.coord.q},${sniperWithLOS.coord.r}) ➔ ¡Comandante KIA!`,
  };
}

/**
 * 4. ¡Minas!:
 * Si el Sherman está en carretera y no está Inmovilizado, impacto automático (Pen 0 vs BL 4).
 * Tirada 1d6 >= 4 causa inmovilización.
 */
export function handleMinesEvent(
  boardState: BoardState,
  presetRoll?: number
): MinesEventResult {
  const sherman = boardState.sherman;
  const tileKey = coordKey(sherman.coord);
  const currentTile = boardState.tiles.get(tileKey);

  const isOnRoad =
    currentTile?.terrain === 'road' ||
    !!currentTile?.isBridge ||
    (currentTile?.roadEdges && currentTile.roadEdges.length > 0);

  if (!isOnRoad) {
    return {
      triggered: true,
      affected: false,
      detail: '¡Minas! sin efecto: El Sherman no se encuentra en una carretera.',
    };
  }

  if (sherman.isImmobilized) {
    return {
      triggered: true,
      affected: false,
      detail: '¡Minas! sin efecto: El Sherman ya se encuentra Inmovilizado.',
    };
  }

  // Automatic hit occurs: Pen 0 vs BL 4 -> 1d6 >= 4
  const dDmg = presetRoll ?? (Math.floor(Math.random() * 6) + 1);
  const targetArmor = 4;
  const damageResult = resolveDamageCheck(0, targetArmor, dDmg);

  if (damageResult.result === 'DAMAGED' || damageResult.result === 'DESTROYED') {
    sherman.isImmobilized = true;
    sherman.isHullDown = false;
    return {
      triggered: true,
      affected: true,
      detail: `💣 ¡MINAS EN CARRETERA! Impacto automático. Tirada 1d6 [${dDmg}] >= Req 4 ➔ ¡Sherman Inmovilizado!`,
      damageResult,
    };
  }

  return {
    triggered: true,
    affected: false,
    detail: `💣 ¡MINAS EN CARRETERA! Impacto automático. Tirada 1d6 [${dDmg}] < Req 4 ➔ El blindaje inferior resiste la explosión sin daños.`,
    damageResult,
  };
}

/**
 * 5. Stuka (Ataque Aéreo):
 * - Si Cte = A, tirada 2d6: con 6+ derriba al Stuka.
 * - Si no lo derriba o Cte está Interior, Stuka impacta con 8+ (2d6).
 * - En caso de impacto: ¿Daños? con Pen 1 / BL 4 (1d6 >= 3).
 * - Si daña: ¿Qué Daños? en tabla del Sherman.
 */
export function handleStukaEvent(
  boardState: BoardState,
  presetRolls?: {
    aaRoll?: [number, number];
    bombRoll?: [number, number];
    dmgRoll?: number;
    effectRoll?: number;
    kiaRoll?: number;
  }
): StukaEventResult {
  const sherman = boardState.sherman;

  // 1. Anti-Air Defense if Commander is hatched and alive
  if (sherman.commanderPosition === 'hatched' && sherman.crew.commander.status === 'active') {
    const d1 = presetRolls?.aaRoll ? presetRolls.aaRoll[0] : Math.floor(Math.random() * 6) + 1;
    const d2 = presetRolls?.aaRoll ? presetRolls.aaRoll[1] : Math.floor(Math.random() * 6) + 1;
    const aaTotal = d1 + d2;

    if (aaTotal >= 6) {
      return {
        triggered: true,
        shotDown: true,
        hit: false,
        damaged: false,
        detail: `🦅 ¡STUKA DERRIBADO! El Comandante Asomado abre fuego antiaéreo con ametralladora (Tirada 2d6 = [${d1}, ${d2}] = ${aaTotal} >= 6) y destruye el Stuka en picado.`,
      };
    }
  }

  // 2. Stuka Bomb Attack: Needs 8+ (2d6) to hit
  const b1 = presetRolls?.bombRoll ? presetRolls.bombRoll[0] : Math.floor(Math.random() * 6) + 1;
  const b2 = presetRolls?.bombRoll ? presetRolls.bombRoll[1] : Math.floor(Math.random() * 6) + 1;
  const bombTotal = b1 + b2;

  if (bombTotal < 8) {
    return {
      triggered: true,
      shotDown: false,
      hit: false,
      damaged: false,
      detail: `Ataque Stuka: El bombardero en picado lanza sus bombas pero fallan el blanco (Tirada 2d6 = [${b1}, ${b2}] = ${bombTotal} < 8).`,
    };
  }

  // 3. Stuka Hit: ¿Daños? Pen 1 vs BL 4 -> 1d6 >= 3
  const dDmg = presetRolls?.dmgRoll ?? (Math.floor(Math.random() * 6) + 1);
  const damageRes = resolveDamageCheck(1, 4, dDmg);

  if (damageRes.result === 'NO_EFFECT') {
    return {
      triggered: true,
      shotDown: false,
      hit: true,
      damaged: false,
      detail: `Bombardeo Stuka: ¡Impacto de bomba! (2d6 = ${bombTotal} >= 8), pero la metralla no penetra el blindaje (1d6 = [${dDmg}] < Req 3).`,
    };
  }

  // 4. Stuka Damage Confirmed: Paso 3 Sherman
  const dEff = presetRolls?.effectRoll ?? (Math.floor(Math.random() * 6) + 1);
  const effect = resolveDamageEffect('sherman', dEff);
  let consequence = effect.description;

  if (effect.outcome === 'DESTROYED') {
    sherman.isDestroyed = true;
    consequence = '¡Sherman Destruido!';
  } else if (effect.outcome === 'CREW_CASUALTY') {
    const dKia = presetRolls?.kiaRoll ?? (Math.floor(Math.random() * 6) + 1);
    const isHatched = sherman.commanderPosition === 'hatched';
    const casualty = resolveCrewCasualtyRoll(dKia, isHatched);
    if (casualty) {
      sherman.crew[casualty.role].status = 'kia';
      consequence = `Comprueba KIA (1d6=[${dKia}]) ➔ ${casualty.description}`;
    } else {
      consequence = `Comprueba KIA (1d6=[${dKia}]) ➔ Comandante en Interior ➔ ¡Sin bajas!`;
    }
  } else if (effect.outcome === 'DAMAGED_FIRE') {
    sherman.fireLevel += 1;
    consequence = `¡Fuego! (+1 Nivel de fuego, total 🔥 ${sherman.fireLevel})`;
  } else if (effect.outcome === 'TURRET_DAMAGED') {
    sherman.isTurretDamaged = true;
    consequence = 'Torreta dañada';
  } else if (effect.outcome === 'IMMOBILIZED') {
    sherman.isImmobilized = true;
    if (sherman.isHullDown) {
      sherman.isHullDown = false;
      consequence = 'Inmovilizado (pierde Desenfilada)';
    } else {
      consequence = 'Inmovilizado';
    }
  }

  return {
    triggered: true,
    shotDown: false,
    hit: true,
    damaged: true,
    detail: `💥 ¡IMPACTO CRÍTICO DE STUKA! (2d6=${bombTotal}, 1d6 daño=[${dDmg}] >= 3) ➔ Paso 3 (1d6=[${dEff}]): ${consequence}`,
  };
}

/**
 * 6. Orden del Comandante:
 * Si el Comandante no está KIA, realiza inmediatamente 1 acción gratuita: CARGAR, REPARAR o EXTINGUIR.
 */
export function handleCommanderOrderEvent(
  boardState: BoardState,
  chosenAction?: 'LOAD' | 'REPAIR' | 'EXTINGUISH'
): CommanderOrderResult {
  const sherman = boardState.sherman;

  if (sherman.crew.commander.status === 'kia') {
    return {
      triggered: true,
      executed: false,
      actionDone: 'NONE',
      detail: 'Orden del Comandante sin efecto: El Comandante ha caído KIA.',
    };
  }

  // Determine action (explicit or auto-priority: Extinguish > Repair Turret > Repair Tracks > Load)
  const action =
    chosenAction ||
    (sherman.fireLevel > 0
      ? 'EXTINGUISH'
      : sherman.isTurretDamaged || sherman.isImmobilized
      ? 'REPAIR'
      : !sherman.isLoaded
      ? 'LOAD'
      : 'LOAD');

  if (action === 'EXTINGUISH') {
    if (sherman.fireLevel > 0) {
      sherman.fireLevel -= 1;
      return {
        triggered: true,
        executed: true,
        actionDone: 'EXTINGUISH',
        detail: `Orden del Comandante: ¡Extinguir! Fuego reducido en 1 (nivel actual: 🔥 ${sherman.fireLevel}).`,
      };
    }
  }

  if (action === 'REPAIR') {
    if (sherman.isTurretDamaged) {
      sherman.isTurretDamaged = false;
      return {
        triggered: true,
        executed: true,
        actionDone: 'REPAIR',
        detail: 'Orden del Comandante: Reparar. ¡Torreta del Sherman reparada con éxito!',
      };
    }
    if (sherman.isImmobilized) {
      sherman.isImmobilized = false;
      return {
        triggered: true,
        executed: true,
        actionDone: 'REPAIR',
        detail: 'Orden del Comandante: Reparar. ¡Orugas reparadas! El Sherman vuelve a estar móvil.',
      };
    }
  }

  if (action === 'LOAD') {
    if (!sherman.isLoaded) {
      sherman.isLoaded = true;
      return {
        triggered: true,
        executed: true,
        actionDone: 'LOAD',
        detail: 'Orden del Comandante: ¡Cargar! Cañón Principal del Sherman cargado.',
      };
    }
  }

  return {
    triggered: true,
    executed: true,
    actionDone: action,
    detail: 'Orden del Comandante: Sherman verificado en óptimas condiciones (sin averías pendientes ni cañón descargado).',
  };
}

/**
 * 7. Fallo Mecánico:
 * El Sherman queda Inmovilizado si no lo estaba.
 */
export function handleMechanicalFailureEvent(boardState: BoardState): {
  triggered: boolean;
  affected: boolean;
  detail: string;
} {
  const sherman = boardState.sherman;

  if (sherman.isImmobilized) {
    return {
      triggered: true,
      affected: false,
      detail: 'Fallo Mecánico sin efecto: El Sherman ya se encontraba Inmovilizado.',
    };
  }

  sherman.isImmobilized = true;
  sherman.isHullDown = false;
  return {
    triggered: true,
    affected: true,
    detail: '⚙️ ¡FALLO MECÁNICO! Rotura en el sistema de transmisión: El Sherman queda Inmovilizado y pierde Desenfilada.',
  };
}

/**
 * 8. Refuerzo de Tanque (Panzer III / Panzer IV):
 * Lanza 1d6 y coloca el tanque en el hexágono con el número negro coincidente que no contenga ya un tanque,
 * encarando hacia el número. No se repite la tirada.
 */
export function handleSpawnTankEvent(
  boardState: BoardState,
  tankType: 'panzerIII' | 'panzerIV',
  presetRoll?: number
): SpawnTankResult {
  const roll = presetRoll ?? (Math.floor(Math.random() * 6) + 1);

  // Find tile with matching blackSpawnNumber
  const targetTile = Array.from(boardState.tiles.values()).find(
    (tile) => tile.blackSpawnNumber === roll
  );

  if (!targetTile) {
    return {
      triggered: true,
      spawned: false,
      detail: `Refuerzo de Tanque (Tirada 1d6 = ${roll}): No existe hexágono negro #${roll} en este mapa.`,
    };
  }

  const { q, r } = targetTile.coord;
  const shermanCoord = boardState.sherman.coord;

  if (shermanCoord.q === q && shermanCoord.r === r) {
    return {
      triggered: true,
      spawned: false,
      detail: `Refuerzo de Tanque (Tirada 1d6 = ${roll}): Hexágono negro #${roll} (${q},${r}) ocupado por el Sherman ➔ Refuerzo cancelado.`,
    };
  }

  const hasTank = boardState.enemyTanks.some(
    (t) => t.status !== 'destroyed' && t.coord.q === q && t.coord.r === r
  );
  if (hasTank) {
    return {
      triggered: true,
      spawned: false,
      detail: `Refuerzo de Tanque (Tirada 1d6 = ${roll}): Hexágono negro #${roll} (${q},${r}) ya contiene un tanque ➔ Refuerzo cancelado.`,
    };
  }

  const facing: Facing = targetTile.blackSpawnFacing ?? 3;
  const stats = TANK_STATS[tankType === 'panzerIV' ? 'PANZER_IV' : 'PANZER_III'];

  const newTank: EnemyTank = {
    id: `${tankType}-spawn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: tankType,
    coord: { q, r },
    facing,
    armor: stats.armor,
    penetration: stats.penetration,
    size: stats.size,
    baseDice: stats.baseDice,
    hasSmoke: false,
    isHullDown: false,
    status: 'operational',
    spawnNumber: roll,
  };

  boardState.enemyTanks.push(newTank);

  return {
    triggered: true,
    spawned: true,
    detail: `🚜 ¡REFUERZO ALEMÁN! (Tirada 1d6 = ${roll}): Aparece un ${tankType.toUpperCase()} en hexágono negro #${roll} (${q},${r}) encarando dirección ${facing}.`,
    tank: newTank,
  };
}

/**
 * Resolves the MOVE_TRUCK event logic for Mission 5:
 * Advances the supply truck 1 step along the road path towards the south.
 * Skips hexes occupied by tanks and triggers defeat if move count reaches 8.
 */
export function handleMoveTruckEvent(boardState: BoardState): MoveTruckResult {
  const truck = boardState.enemyTrucks?.[0];
  if (!truck || truck.status === 'destroyed') {
    return {
      triggered: true,
      moved: false,
      escaped: false,
      detail: 'Evento Mover Camión sin efecto: El camión no está presente o ha sido destruido.',
    };
  }

  let nextIndex = truck.moveIndex + 1;
  if (nextIndex >= truck.roadPath.length) {
    return {
      triggered: true,
      moved: false,
      escaped: true,
      detail: '¡EL CAMIÓN DE SUMINISTROS HA ESCAPADO DEL SECTOR POR EL SUR!',
      truck,
    };
  }

  // Check if destination is blocked by an active enemy tank
  let targetHex = truck.roadPath[nextIndex];
  while (nextIndex < truck.roadPath.length) {
    const isTankOccupied = boardState.enemyTanks.some(
      (t) => t.status !== 'destroyed' && t.coord.q === targetHex.q && t.coord.r === targetHex.r
    );
    if (!isTankOccupied) break;
    nextIndex++;
    if (nextIndex < truck.roadPath.length) {
      targetHex = truck.roadPath[nextIndex];
    }
  }

  truck.facing = getClosestDirection(truck.coord, targetHex);
  truck.moveIndex = nextIndex;
  truck.coord = { ...targetHex };

  const escaped = truck.moveIndex >= (truck.maxMoves - 1) || nextIndex >= truck.roadPath.length;

  return {
    triggered: true,
    moved: true,
    escaped,
    detail: `🚚 El camión avanza por carretera a (${truck.coord.q},${truck.coord.r}) [Paso ${truck.moveIndex + 1}/${truck.maxMoves}].`,
    truck,
  };
}

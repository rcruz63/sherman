import {
  DiceRollPrompt,
  DiceTableEntry,
} from '../../types/dice';
import {
  EnemyTank,
  ShermanState,
  BoardState,
  EventRule,
} from '../../types/game';
import { calculateHitDifficulty, resolveDamageCheck, resolveDamageEffect, resolveCrewCasualtyRoll } from './combat';
import { GERMAN_OPERATIONS_TABLE } from './germanAI';
import { SECTOR_NAMES } from './logUtils';


type PromptConfig = Omit<DiceRollPrompt, 'resolve' | 'reject'>;

/**
 * Prompt for Force Deployment (Tank on Black Number or Infantry on Red Number)
 */
export function createDeploymentPrompt(options: {
  unitLabel: string;
  spawnType: 'black' | 'red';
  availablePoints: Array<{ number: number; coord: { q: number; r: number }; facing?: number }>;
  occupiedNumbers?: number[];
}): PromptConfig {
  const { unitLabel, spawnType, availablePoints, occupiedNumbers = [] } = options;
  const colorName = spawnType === 'black' ? 'Negro' : 'Rojo';

  const entries: DiceTableEntry[] = [1, 2, 3, 4, 5, 6].map((num) => {
    const pt = availablePoints.find((p) => p.number === num);
    const isOccupied = occupiedNumbers.includes(num);

    let desc = 'Punto no asignado en el mapa';
    if (pt) {
      desc = `Hex (${pt.coord.q},${pt.coord.r})${
        pt.facing !== undefined ? ` | Encaramiento: ${pt.facing}` : ''
      }`;
      if (isOccupied) desc += ' (Ocupado - requiere re-tirada)';
    }

    return {
      range: `${num}`,
      title: `Punto ${colorName} #${num}`,
      description: desc,
    };
  });

  return {
    id: `deploy_${Date.now()}`,
    title: `📍 Despliegue de Fuerzas: ${unitLabel}`,
    subtitle: `Lanza 1d6 para determinar el punto de aparición ${colorName.toLowerCase()}`,
    category: 'deployment',
    diceCount: 1,
    tableTitle: `Puntos de Aparición ${colorName}s (1-6)`,
    tableSubtitle: 'Hexágonos y orientaciones según el mapa de misión',
    tableEntries: entries,
    highlightIndex: (rolls) => (rolls[0] ? rolls[0] - 1 : 0),
    calculateEffect: (rolls) => {
      const val = rolls[0] || 1;
      const pt = availablePoints.find((p) => p.number === val);
      const isOccupied = occupiedNumbers.includes(val);

      if (isOccupied) {
        return {
          badge: 'NÚMERO OCUPADO',
          description: `El punto ${colorName} #${val} ya está ocupado.`,
          type: 'warning',
          secondaryDetail: 'Las reglas indican volver a tirar el dado o tomar el siguiente disponible.',
        };
      }

      if (!pt) {
        return {
          badge: 'SIN PUNTO ASIGNADO',
          description: `No hay punto ${colorName} #${val} en este mapa.`,
          type: 'warning',
        };
      }

      return {
        badge: 'DESPLIEGUE CONFIRMADO',
        description: `${unitLabel} aparecerá en Punto ${colorName} #${val} -> Hex (${pt.coord.q},${pt.coord.r})`,
        type: 'success',
        secondaryDetail: pt.facing !== undefined ? `Encaramiento asignado: ${pt.facing}` : undefined,
      };
    },
  };
}

/**
 * Prompt for Sherman Operations Action Dice Pool (Phase 3)
 */
export function createSectionDicePrompt(options: {
  section: 'maneuver' | 'attack' | 'misc';
  terrain: string;
  diceCount: number;
  explanation: string[];
}): PromptConfig {
  const { section, terrain, diceCount, explanation } = options;
  const sectionTitles = {
    maneuver: 'Maniobra',
    attack: 'Ataque',
    misc: 'Varios',
  };

  const sectionEntries: Record<string, DiceTableEntry[]> = {
    maneuver: [
      { range: '1', title: 'Retroceder 1 Hex', description: 'Mover hacia atrás manteniendo encaramiento.' },
      { range: '2-4', title: 'Girar Torreta / Chasis', description: 'Girar 60° a la izquierda o derecha.' },
      { range: '5-6', title: 'Avanzar 1 Hex', description: 'Mover hacia adelante en la dirección de avance.' },
    ],
    attack: [
      { range: '1-2', title: 'Cargar Cañón', description: 'Recargar proyectil del cañón principal.' },
      { range: '3-4', title: 'Ametralladora (MG)', description: 'Disparo de MG contra infantería adyacente.' },
      { range: '5-6', title: 'Disparo de Cañón', description: 'Fuego con el cañón principal (consume munición).' },
    ],
    misc: [
      { range: '1', title: 'DCP / Carga Cañón', description: 'Disparar Cañón o cargar según tripulación.' },
      { range: '2', title: 'Ametralladora (MG)', description: 'Disparar MG a infantería enemiga.' },
      { range: '3', title: 'Giro o Movimiento', description: 'Girar 60° o avanzar 1 hexágono.' },
      { range: '4', title: 'Reparar Avería', description: 'Reparar torreta o reparar oruga.' },
      { range: '5', title: 'Lanzar Humo / Reparar', description: 'Generar pantalla de humo o reparar.' },
      { range: '6', title: 'Extinguir Fuego', description: 'Reducir nivel de fuego en 1.' },
    ],
  };

  return {
    id: `sec_dice_${Date.now()}`,
    title: `🎲 Reserva de Dados: ${sectionTitles[section]}`,
    subtitle: `Terreno Inicial: ${terrain.toUpperCase()} | ${diceCount} dados d6`,
    category: 'operations',
    diceCount,
    tableTitle: `Tabla de Acciones: ${sectionTitles[section]}`,
    tableSubtitle: explanation.join(' | '),
    tableEntries: sectionEntries[section],
    highlightIndex: (rolls) => {
      const indices: number[] = [];
      rolls.forEach((r) => {
        if (section === 'maneuver') {
          if (r === 1 && !indices.includes(0)) indices.push(0);
          else if (r >= 2 && r <= 4 && !indices.includes(1)) indices.push(1);
          else if (r >= 5 && !indices.includes(2)) indices.push(2);
        } else if (section === 'attack') {
          if (r <= 2 && !indices.includes(0)) indices.push(0);
          else if (r <= 4 && !indices.includes(1)) indices.push(1);
          else if (!indices.includes(2)) indices.push(2);
        } else {
          const idx = Math.min(5, Math.max(0, r - 1));
          if (!indices.includes(idx)) indices.push(idx);
        }
      });
      return indices;
    },
    calculateEffect: (rolls) => {
      const sorted = [...rolls].sort((a, b) => a - b);
      return {
        badge: 'RESERVA CALCULADA',
        description: `Dados obtenidos: [${sorted.join(', ')}] (${rolls.length} acciones tácticas disponibles)`,
        type: 'info',
        secondaryDetail: 'Podrás utilizar estos dados individualmente o combinarlos en dobles.',
      };
    },
  };
}

/**
 * Step 1: Sherman Gun Hit Check Prompt (2d6)
 */
export function createShermanGunHitPrompt(
  sherman: ShermanState,
  target: EnemyTank,
  boardState: BoardState
): PromptConfig {
  const hitCalc = calculateHitDifficulty(sherman, target, boardState);
  const diff = hitCalc.totalDifficulty;

  const entries: DiceTableEntry[] = [
    {
      range: `< ${diff}`,
      title: 'Disparo Fallado',
      description: 'El proyectil no impacta al objetivo.',
    },
    {
      range: `>= ${diff}`,
      title: '¡Impacto en el Blanco!',
      description: `Avanza a Paso 2: Chequeo de Daños (Sector: ${SECTOR_NAMES[hitCalc.impactSector] || hitCalc.impactSector}).`,
      isHit: true,
    },
  ];

  return {
    id: `gun_hit_${Date.now()}`,
    title: `🎯 Sherman dispara a ${target.type.toUpperCase()}: Tirada de Impacto`,
    subtitle: `Distancia: ${hitCalc.baseDistance} hex | Sector: ${SECTOR_NAMES[hitCalc.impactSector]} | Dificultad: ${diff}+`,
    category: 'combat',
    diceCount: 2,
    tableTitle: 'Requisito de Impacto de Cañón (2d6)',
    tableSubtitle: `Base Distancia (${hitCalc.baseDistance}) + TAM (${target.size}) + Modificadores = Dif ${diff}`,
    tableEntries: entries,
    highlightIndex: (_rolls, total) => (total >= diff ? 1 : 0),
    calculateEffect: (_rolls, total) => {
      const isSuccess = total >= diff;
      return {
        badge: isSuccess ? '¡IMPACTO CONFIRMADO!' : 'DISPARO FALLADO',
        description: isSuccess
          ? `Tirada 2d6 = ${total} >= Dificultad ${diff}. ¡El disparo acierta!`
          : `Tirada 2d6 = ${total} < Dificultad ${diff}. El proyectil se desvía.`,
        type: isSuccess ? 'success' : 'danger',
        secondaryDetail: isSuccess
          ? `Sector de impacto: ${SECTOR_NAMES[hitCalc.impactSector]} (Blindaje ${target.armor[hitCalc.impactSector]})`
          : undefined,
      };
    },
    confirmLabel: 'Continuar ➔',
  };
}

/**
 * Step 2: Gun Damage Penetration Check Prompt (1d6 >= Target Armor - Gun Penetration)
 */
export function createGunDamageCheckPrompt(
  penetration: number,
  targetArmor: number,
  targetLabel: string,
  sectorName: string
): PromptConfig {
  const damageResSample = resolveDamageCheck(penetration, targetArmor, 1);
  const threshold = damageResSample.threshold;

  const entries: DiceTableEntry[] = [
    {
      range: `< ${threshold}`,
      title: 'Rebotado / Sin Efecto',
      description: 'El blindaje resiste el impacto. El proyectil rebota sin causar daños.',
    },
    {
      range: `>= ${threshold}`,
      title: '¡Penetración / Daño Confirmado!',
      description: 'El proyectil penetra el blindaje enemigo. Avanza a Paso 3: ¿Qué Daños?.',
      isHit: true,
    },
  ];

  return {
    id: `gun_dmg_${Date.now()}`,
    title: `💥 Chequeo de Penetración: ${targetLabel}`,
    subtitle: `Blindaje ${sectorName}: ${targetArmor} | Penetración: ${penetration} | Requisito: 1d6 >= ${threshold}`,
    category: 'combat',
    diceCount: 1,
    tableTitle: 'Paso 2: ¿Daños? (1d6 >= Blindaje - Penetración)',
    tableSubtitle: `Blindaje (${targetArmor}) - Penetración (${penetration}) = Requerido ${threshold}+ (Mínimo 1)`,
    tableEntries: entries,
    highlightIndex: (rolls) => (rolls[0] >= threshold ? 1 : 0),
    calculateEffect: (rolls) => {
      const roll = rolls[0] || 1;
      const pass = roll >= threshold;
      return {
        badge: pass ? '¡PENETRACIÓN EXITOSA!' : 'PROYECTIL REBOTADO',
        description: pass
          ? `Tirada 1d6 = [${roll}] >= Requerido ${threshold}. ¡Impacto penetra el blindaje!`
          : `Tirada 1d6 = [${roll}] < Requerido ${threshold}. El blindaje enemigo absorbe el golpe.`,
        type: pass ? 'success' : 'warning',
      };
    },
  };
}

/**
 * Step 3: What Damage German Tank Prompt (1d6)
 */
export function createGermanTankDamageEffectPrompt(targetLabel: string): PromptConfig {
  const entries: DiceTableEntry[] = [
    {
      range: '1-2',
      title: 'Inmovilizado / Dañado',
      description: 'El tanque sufre daños motrices. Si ya estaba dañado, ¡queda DESTRUIDO!',
    },
    {
      range: '3-4',
      title: 'Torreta Dañada',
      description: 'La torreta queda averiada y el tanque no podrá volver a disparar.',
    },
    {
      range: '5-6',
      title: '¡DESTRUIDO!',
      description: 'El tanque queda totalmente fuera de combate y es eliminado.',
      isHit: true,
    },
  ];

  return {
    id: `german_eff_${Date.now()}`,
    title: `💥 Tabla "¿Qué Daños? Tanque Alemán" (1d6)`,
    subtitle: `Objetivo penetrado: ${targetLabel}`,
    category: 'combat',
    diceCount: 1,
    tableTitle: 'Paso 3: ¿Qué Daños? Tanque Alemán',
    tableSubtitle: 'Lanza 1d6 para resolver la gravedad del daño',
    tableEntries: entries,
    highlightIndex: (rolls) => {
      const val = rolls[0] || 1;
      return val <= 2 ? 0 : val <= 4 ? 1 : 2;
    },
    calculateEffect: (rolls) => {
      const val = rolls[0] || 1;
      const effect = resolveDamageEffect('germanTank', val);

      return {
        badge: effect.outcome === 'DESTROYED' ? '¡OBJETIVO DESTRUIDO!' : effect.outcome === 'TURRET_DAMAGED' ? 'TORRETA DAÑADA' : 'TANQUE DAÑADO',
        description: `Resultado 1d6 = [${val}] -> ${effect.description}`,
        type: effect.outcome === 'DESTROYED' ? 'success' : 'warning',
      };
    },
  };
}

/**
 * Sherman Machine Gun (MG) Attack vs Infantry Prompt (2d6)
 */
export function createShermanMGPrompt(targetHex: { q: number; r: number }, difficulty: number = 7): PromptConfig {
  return {
    id: `mg_hit_${Date.now()}`,
    title: '🔫 Sherman: Fuego de Ametralladora (MG)',
    subtitle: `Infantería enemiga en (${targetHex.q},${targetHex.r}) | Dificultad: ${difficulty}+`,
    category: 'combat',
    diceCount: 2,
    tableTitle: 'Tabla de Disparo de Ametralladora vs Infantería',
    tableSubtitle: `Se lanzan 2d6. Impacto con resultado >= ${difficulty}`,
    tableEntries: [
      { range: `< ${difficulty}`, title: 'Fuego Fallado', description: 'La infantería se resguarda.' },
      { range: `>= ${difficulty}`, title: '¡Infantería Eliminada!', description: 'La unidad de infantería es suprimida y retirada.', isHit: true },
    ],
    highlightIndex: (_rolls, total) => (total >= difficulty ? 1 : 0),
    calculateEffect: (_rolls, total) => {
      const pass = total >= difficulty;
      return {
        badge: pass ? '¡INFANTERÍA ELIMINADA!' : 'SIN EFECTO',
        description: pass
          ? `Tirada 2d6 = ${total} >= ${difficulty}. La infantería enemiga ha sido neutralizada.`
          : `Tirada 2d6 = ${total} < ${difficulty}. Los disparos no logran suprimir a la infantería.`,
        type: pass ? 'success' : 'danger',
      };
    },
  };
}

/**
 * Phase 5: Sherman Fire Check Prompt (N d6 = Fire Level, take minimum)
 */
export function createFireCheckPrompt(fireLevel: number): PromptConfig {
  const entries: DiceTableEntry[] = [
    { range: '1', title: '¡Sherman Destruido!', description: 'El tanque estalla o se incendia por completo. Fin de partida.' },
    { range: '2', title: 'Comprueba KIA', description: 'Tirada de 1d6 en la tabla de bajas de tripulación.' },
    { range: '3-4', title: '+1 Nivel de Fuego', description: 'El fuego se extiende. El nivel de fuego aumenta en 1.' },
    { range: '5', title: 'Torreta Dañada', description: 'El fuego avería el mecanismo de disparo de la torreta.' },
    { range: '6', title: 'Inmovilizado', description: 'El tren de rodaje se bloquea (pierde desenfilada si la tenía).' },
  ];

  return {
    id: `fire_check_${Date.now()}`,
    title: `🔥 Fase 5: Comprobación de Fuego (${fireLevel}d6)`,
    subtitle: `Nivel de Fuego actual: ${fireLevel} | Se toma el resultado MENOR`,
    category: 'fire',
    diceCount: fireLevel,
    tableTitle: 'Tabla Sherman "¿Qué Daños?"',
    tableSubtitle: `Lanza ${fireLevel} dados d6 y consulta el resultado más bajo`,
    tableEntries: entries,
    highlightIndex: (rolls) => {
      const minVal = Math.min(...rolls);
      if (minVal === 1) return 0;
      if (minVal === 2) return 1;
      if (minVal <= 4) return 2;
      if (minVal === 5) return 3;
      return 4;
    },
    calculateEffect: (rolls) => {
      const minVal = Math.min(...rolls);
      const eff = resolveDamageEffect('sherman', minVal);
      return {
        badge: eff.outcome === 'DESTROYED' ? '¡DESTRUIDO!' : eff.outcome === 'CREW_CASUALTY' ? 'COMPRUEBA KIA' : eff.outcome === 'DAMAGED_FIRE' ? '+1 FUEGO' : 'DAÑO MECÁNICO',
        description: `Menor de [${rolls.join(', ')}] = ${minVal} -> ${eff.description}`,
        type: eff.outcome === 'DESTROYED' ? 'danger' : 'warning',
      };
    },
  };
}

/**
 * Crew Casualty Prompt (KIA Check 1d6)
 */
export function createCrewCasualtyPrompt(isCommanderHatched: boolean): PromptConfig {
  const entries: DiceTableEntry[] = [
    { range: '1', title: 'Comandante', description: isCommanderHatched ? '¡Comandante KIA!' : 'Comandante en Interior (¡Sin bajas!)' },
    { range: '2', title: 'Cargador', description: '¡Cargador KIA!' },
    { range: '3', title: 'Artillero', description: '¡Artillero KIA!' },
    { range: '4', title: 'Conductor', description: '¡Conductor KIA!' },
    { range: '5', title: 'Asistente de Conductor', description: '¡Asistente KIA!' },
    { range: '6', title: 'Sin Bajas', description: '¡La tripulación sale ilesa!' },
  ];

  return {
    id: `kia_${Date.now()}`,
    title: '⚠️ Comprobación de Bajas de Tripulación (KIA)',
    subtitle: `Comandante: ${isCommanderHatched ? 'Asomado (A)' : 'Interior (I)'}`,
    category: 'fire',
    diceCount: 1,
    tableTitle: 'Tabla de Bajas de Tripulación (1d6)',
    tableEntries: entries,
    highlightIndex: (rolls) => Math.min(5, Math.max(0, (rolls[0] || 1) - 1)),
    calculateEffect: (rolls) => {
      const roll = rolls[0] || 1;
      const casualty = resolveCrewCasualtyRoll(roll, isCommanderHatched);
      return {
        badge: casualty ? 'BAJA EN TRIPULACIÓN' : '¡SIN BAJAS!',
        description: casualty ? `Dado [${roll}]: ${casualty.description}` : `Dado [${roll}]: ¡Tripulación a salvo!`,
        type: casualty ? 'danger' : 'success',
      };
    },
  };
}

/**
 * German AI Tank Activation Dice Pool (Phase 6)
 */
export function createGermanAIPoolPrompt(
  tank: EnemyTank,
  terrainName: string,
  column: 'ROAD' | 'FIELD' | 'MUD' | 'DAMAGED',
  diceCount: number
): PromptConfig {
  const tableData = GERMAN_OPERATIONS_TABLE[column];
  const entries: DiceTableEntry[] = [1, 2, 3, 4, 5, 6].map((die) => {
    const act = tableData[die];
    return {
      range: `${die}`,
      title: act.primary,
      description: act.secondary ? `Secundaria: ${act.secondary}` : 'Sin secundaria',
    };
  });

  return {
    id: `ai_pool_${Date.now()}`,
    title: `🤖 IA Alemana: ${tank.type.toUpperCase()} #${tank.id}`,
    subtitle: `Terreno: ${terrainName.toUpperCase()} | Columna: ${column} | ${diceCount} dados`,
    category: 'ai',
    diceCount,
    tableTitle: `Tabla de Operaciones Alemanas (${column})`,
    tableSubtitle: 'Las acciones se ordenan y ejecutan de menor a mayor dado',
    tableEntries: entries,
    highlightIndex: (rolls) => {
      const uniq = Array.from(new Set(rolls));
      return uniq.map((r) => r - 1);
    },
    calculateEffect: (rolls) => {
      const sorted = [...rolls].sort((a, b) => a - b);
      const actionNames = sorted.map((d) => tableData[d]?.primary || 'Descartado');
      return {
        badge: 'ORDEN IA ESTABLECIDO',
        description: `Dados: [${sorted.join(', ')}] -> ${actionNames.join(' ➔ ')}`,
        type: 'info',
        secondaryDetail: 'El tanque evaluará cada acción en orden ascendente.',
      };
    },
  };
}

/**
 * Phase 7: End of Turn Mission Event Prompt (2d6)
 */
export function createPhase7EventPrompt(
  events: EventRule[],
  currentTurn: number
): PromptConfig {
  const entries: DiceTableEntry[] = events.map((ev) => {
    const rangeStr = ev.rollMin === ev.rollMax ? `${ev.rollMin}` : `${ev.rollMin}-${ev.rollMax}`;
    return {
      range: rangeStr,
      title: ev.type,
      description: ev.description,
    };
  });

  return {
    id: `p7_event_${Date.now()}`,
    title: `📜 Fase 7: Evento de Fin de Turno ${currentTurn}`,
    subtitle: 'Se lanzan 2d6 y se consulta la tabla de eventos de la misión',
    category: 'event',
    diceCount: 2,
    tableTitle: 'Tabla de Eventos de la Misión (2d6)',
    tableSubtitle: 'El resultado sumado de los dados activa el evento correspondiente',
    tableEntries: entries,
    highlightIndex: (_rolls, total) => {
      const foundIdx = events.findIndex((ev) => total >= ev.rollMin && total <= ev.rollMax);
      return foundIdx >= 0 ? foundIdx : 0;
    },
    calculateEffect: (_rolls, total) => {
      const found = events.find((ev) => total >= ev.rollMin && total <= ev.rollMax);
      return {
        badge: found ? `EVENTO: ${found.type}` : 'SIN EVENTO',
        description: found ? `Total 2d6 = ${total} -> ${found.description}` : `Total 2d6 = ${total} sin evento.`,
        type: 'warning',
      };
    },
  };
}

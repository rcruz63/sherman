/**
 * Log Helper & Structured Detail Formatter for Sherman Solitario
 */

import { LogDetailBreakdown, LogEntry, ModifierItem } from '../../types/game';
import { HitDifficultyBreakdown } from './combat';

export function createLogEntry(
  summary: string,
  options?: {
    type?: LogEntry['type'];
    detail?: string;
    breakdown?: LogDetailBreakdown;
  }
): LogEntry {
  return {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: options?.type || 'info',
    summary,
    detail: options?.detail,
    breakdown: options?.breakdown,
  };
}

export function buildHitModifiersList(hitCalc: HitDifficultyBreakdown): ModifierItem[] {
  const modifiers: ModifierItem[] = [
    { label: 'Distancia', value: hitCalc.baseDistance },
    { label: 'Tamaño (TAM)', value: hitCalc.targetSize },
  ];

  if (hitCalc.buildingModifier) {
    modifiers.push({ label: 'Cobertura Edificio', value: '+1' });
  }
  if (hitCalc.treeLineModifier) {
    modifiers.push({ label: 'Arboleda', value: `+${hitCalc.treeLineModifier}` });
  }
  if (hitCalc.smokeModifier) {
    modifiers.push({ label: 'Humo', value: '+1' });
  }
  if (hitCalc.hullDownModifier) {
    modifiers.push({ label: 'Desenfilada', value: '+2' });
  }
  if (hitCalc.rearArcModifier) {
    modifiers.push({ label: 'Arco Trasero', value: '+1' });
  }

  return modifiers;
}

export const SECTOR_NAMES: Record<string, string> = {
  D: 'Delantero (D)',
  LD: 'Lateral Delantero (LD)',
  LT: 'Lateral Trasero (LT)',
  T: 'Trasero (T)',
};

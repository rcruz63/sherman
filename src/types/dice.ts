export type DiceMode = 'auto' | 'manual';

export interface DiceTableEntry {
  range: string; // e.g. "1", "2-4", "7+", "8", "2d6 >= 7"
  title: string;
  description?: string;
  isHit?: boolean;
}

export interface DiceEffectOutcome {
  badge: string;
  description: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  secondaryDetail?: string;
}

export interface DiceRollPrompt {
  id: string;
  title: string;
  subtitle?: string;
  category?: 'deployment' | 'operations' | 'combat' | 'fire' | 'ai' | 'event';
  diceCount: number; // 1 | 2 | 3 | 4 | 5
  initialRolls?: number[];
  tableTitle: string;
  tableSubtitle?: string;
  tableEntries: DiceTableEntry[];
  highlightIndex: (rolls: number[], total: number) => number | number[];
  calculateEffect: (rolls: number[], total: number) => DiceEffectOutcome;
  resolve: (result: DiceRollResult) => void;
  reject?: (error?: any) => void;
  canCancel?: boolean;
  confirmLabel?: string;
}

export interface DiceRollResult {
  rolls: number[];
  total: number;
}

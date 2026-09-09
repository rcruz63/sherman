import React from 'react';
import { Die3D } from './Die3D';
import { DiceMode } from '../../types/dice';

interface DiceTrayProps {
  diceValues: number[];
  isRolling: boolean;
  mode: DiceMode;
  onDiceValueChange: (index: number, value: number) => void;
  onRollAuto: () => void;
  colorTheme?: 'ivory' | 'red' | 'olive' | 'gold';
}

export const DiceTray: React.FC<DiceTrayProps> = ({
  diceValues,
  isRolling,
  mode,
  onDiceValueChange,
  onRollAuto,
  colorTheme = 'ivory',
}) => {
  const diceCount = diceValues.length;
  const totalSum = diceValues.reduce((sum, v) => sum + (v || 1), 0);

  // Dynamic die sizing based on count and viewport (compact for 1080p fit)
  const dieSize = diceCount <= 2 ? 56 : diceCount === 3 ? 50 : 44;

  return (
    <div className="bg-slate-950/90 rounded-2xl border border-slate-800/80 p-3 sm:p-4 shadow-inner flex flex-col items-center gap-3">
      {/* Dice Container */}
      <div className="w-full flex flex-wrap items-center justify-center gap-3 sm:gap-5 py-1 min-h-[90px]">
        {diceValues.map((val, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1.5 animate-fade-in">
            {/* 3D Die */}
            <div className="relative group">
              <Die3D
                value={val}
                isRolling={isRolling}
                size={dieSize}
                colorTheme={colorTheme}
                onClick={() => {
                  if (mode === 'manual' && !isRolling) {
                    const next = val >= 6 ? 1 : val + 1;
                    onDiceValueChange(idx, next);
                  }
                }}
              />
              {diceCount > 1 && (
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center mt-0.5">
                  Dado {idx + 1}
                </div>
              )}
            </div>

            {/* Manual Value Selector per Die */}
            {mode === 'manual' && (
              <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 shadow-md">
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const isSelected = val === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={isRolling}
                      onClick={() => onDiceValueChange(idx, num)}
                      className={`min-w-[22px] min-h-[26px] px-1 py-0.5 text-[11px] font-black rounded-md transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow scale-105 font-extrabold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`Seleccionar ${num} para el dado ${idx + 1}`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tray Footer & Roll Controls */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        {/* Total Summary */}
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
            {diceCount === 1 ? 'Resultado:' : 'Tirada Total:'}
          </span>
          <div className="flex items-center gap-1 font-mono">
            {diceCount > 1 && (
              <span className="text-slate-400 text-xs">
                [{diceValues.join(' + ')}] =
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black shadow-sm">
              {totalSum}
            </span>
          </div>
        </div>

        {/* Auto Roll Button */}
        {mode === 'auto' && (
          <button
            type="button"
            disabled={isRolling}
            onClick={onRollAuto}
            className="min-h-[36px] px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-amber-900/30 transition transform active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>🎲</span>
            <span>{isRolling ? 'Lanzando...' : 'Lanzar Dados'}</span>
          </button>
        )}

        {/* Manual Mode Tip */}
        {mode === 'manual' && (
          <div className="text-[10px] text-amber-400/90 flex items-center gap-1 font-medium">
            <span>🎲</span>
            <span>Introduce el resultado de tus dados físicos</span>
          </div>
        )}
      </div>
    </div>
  );
};

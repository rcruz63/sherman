import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { DiceTray } from './DiceTray';
import { DiceReferenceTable } from './DiceReferenceTable';
import { DiceMode } from '../../types/dice';

export const DiceRollerModal: React.FC = () => {
  const {
    activeDiceRoll,
    diceModePreference,
    setDiceModePreference,
    resolveActiveDiceRoll,
    cancelActiveDiceRoll,
  } = useGameStore();

  const [diceValues, setDiceValues] = useState<number[]>([1]);
  const [isRolling, setIsRolling] = useState<boolean>(false);

  // Generate random d6 numbers
  const generateRandomRolls = useCallback((count: number): number[] => {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    return rolls;
  }, []);

  // Initialize or re-sync whenever activeDiceRoll changes
  useEffect(() => {
    if (!activeDiceRoll) return;

    const count = activeDiceRoll.diceCount || 1;
    const initial = activeDiceRoll.initialRolls && activeDiceRoll.initialRolls.length === count
      ? [...activeDiceRoll.initialRolls]
      : generateRandomRolls(count);

    setDiceValues(initial);

    // If auto mode, immediately trigger rolling animation on open
    if (diceModePreference === 'auto') {
      setIsRolling(true);
      const timer = setTimeout(() => {
        setIsRolling(false);
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [activeDiceRoll, diceModePreference, generateRandomRolls]);

  // Handle Auto Roll button click
  const handleRollAuto = useCallback(() => {
    if (!activeDiceRoll || isRolling) return;
    setIsRolling(true);
    const newRolls = generateRandomRolls(activeDiceRoll.diceCount || 1);
    setDiceValues(newRolls);

    setTimeout(() => {
      setIsRolling(false);
    }, 1100);
  }, [activeDiceRoll, isRolling, generateRandomRolls]);

  // Handle manual per-die value adjustment
  const handleDiceValueChange = useCallback((index: number, val: number) => {
    setDiceValues((prev) => {
      const copy = [...prev];
      copy[index] = Math.min(6, Math.max(1, val));
      return copy;
    });
  }, []);


  // Switch between auto and manual modes
  const handleModeToggle = (mode: DiceMode) => {
    setDiceModePreference(mode);
    if (mode === 'auto' && !isRolling) {
      handleRollAuto();
    }
  };

  // Confirm roll and apply outcome
  const handleConfirm = () => {
    if (!activeDiceRoll || isRolling) return;
    const total = diceValues.reduce((sum, v) => sum + v, 0);
    resolveActiveDiceRoll({
      rolls: diceValues,
      total,
    });
  };

  if (!activeDiceRoll) return null;

  const totalSum = diceValues.reduce((sum, v) => sum + v, 0);

  // Dynamic calculation of current outcome effect
  const effectOutcome = activeDiceRoll.calculateEffect(diceValues, totalSum);

  // Dynamic highlighted table indices
  const highlighted = activeDiceRoll.highlightIndex(diceValues, totalSum);
  const highlightedIndices = Array.isArray(highlighted) ? highlighted : [highlighted];

  // Theme color for dice based on category
  const themeColor =
    activeDiceRoll.category === 'combat'
      ? 'red'
      : activeDiceRoll.category === 'fire'
      ? 'gold'
      : activeDiceRoll.category === 'ai'
      ? 'olive'
      : 'ivory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-[2px] animate-fade-in select-none pointer-events-auto">
      <div className="bg-slate-900/95 border-2 border-amber-500/40 rounded-2xl p-3.5 sm:p-4 max-w-xl w-full shadow-2xl flex flex-col max-h-[96vh] overflow-hidden space-y-2.5 backdrop-blur-md">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-base text-amber-400 font-bold shrink-0 shadow">
              🎲
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-amber-400 uppercase tracking-wide truncate">
                {activeDiceRoll.title}
              </h2>
              {activeDiceRoll.subtitle && (
                <p className="text-[11px] text-slate-300 truncate">
                  {activeDiceRoll.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Mode Switcher: Auto vs Manual */}
          <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleModeToggle('auto')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                diceModePreference === 'auto'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⚡</span>
              <span>Automático</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle('manual')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                diceModePreference === 'manual'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🎲</span>
              <span>Manual (Físico)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 custom-scrollbar">
          {/* 3D Dice Tray */}
          <DiceTray
            diceValues={diceValues}
            isRolling={isRolling}
            mode={diceModePreference}
            onDiceValueChange={handleDiceValueChange}
            onRollAuto={handleRollAuto}
            colorTheme={themeColor}
          />

          {/* Outcome Effect Banner */}
          <div
            className={`p-2.5 sm:p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
              effectOutcome.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200'
                : effectOutcome.type === 'danger'
                ? 'bg-red-950/80 border-red-500/80 text-red-200'
                : effectOutcome.type === 'warning'
                ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                : 'bg-indigo-950/80 border-indigo-500/80 text-indigo-200'
            }`}
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow ${
                    effectOutcome.type === 'success'
                      ? 'bg-emerald-500 text-slate-950'
                      : effectOutcome.type === 'danger'
                      ? 'bg-red-500 text-white'
                      : effectOutcome.type === 'warning'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-indigo-500 text-white'
                  }`}
                >
                  {effectOutcome.badge}
                </span>
                <span className="text-[11px] font-bold opacity-90">
                  Efecto:
                </span>
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                {effectOutcome.description}
              </div>
              {effectOutcome.secondaryDetail && (
                <div className="text-[10px] opacity-80 truncate">
                  {effectOutcome.secondaryDetail}
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wider opacity-70 block">
                {activeDiceRoll.diceCount === 1 ? 'Dado' : 'Total'}
              </span>
              <span className="text-xl font-black font-mono text-white leading-none">
                {activeDiceRoll.diceCount === 1 ? diceValues[0] : totalSum}
              </span>
            </div>
          </div>

          {/* Reference Table */}
          <DiceReferenceTable
            title={activeDiceRoll.tableTitle}
            subtitle={activeDiceRoll.tableSubtitle}
            entries={activeDiceRoll.tableEntries}
            highlightedIndices={highlightedIndices}
          />
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-800 shrink-0">
          <div>
            {activeDiceRoll.canCancel && (
              <button
                type="button"
                onClick={cancelActiveDiceRoll}
                className="min-h-[38px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={isRolling}
            onClick={handleConfirm}
            className="min-h-[40px] px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-950/40 transition transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span>{activeDiceRoll.confirmLabel || 'Continuar ➔'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

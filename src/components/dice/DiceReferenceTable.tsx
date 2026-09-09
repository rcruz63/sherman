import React from 'react';
import { DiceTableEntry } from '../../types/dice';

interface DiceReferenceTableProps {
  title: string;
  subtitle?: string;
  entries: DiceTableEntry[];
  highlightedIndices: number[];
}

export const DiceReferenceTable: React.FC<DiceReferenceTableProps> = ({
  title,
  subtitle,
  entries,
  highlightedIndices,
}) => {
  return (
    <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-2.5 sm:p-3 space-y-2 shadow-inner">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">📖</span>
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            {title}
          </h4>
        </div>
        {subtitle && (
          <span className="text-[10px] text-slate-400 font-normal">
            {subtitle}
          </span>
        )}
      </div>

      <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {entries.map((entry, idx) => {
          const isHighlighted = highlightedIndices.includes(idx);

          return (
            <div
              key={idx}
              className={`p-1.5 px-2 rounded-lg border text-xs transition-all flex items-center justify-between gap-2.5 ${
                isHighlighted
                  ? 'bg-amber-500/20 border-amber-400 text-amber-100 shadow-sm ring-1 ring-amber-400/50'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              {/* Range Badge & Title */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`min-w-[36px] px-1.5 py-0.5 rounded font-mono text-center font-bold text-[10px] shrink-0 ${
                    isHighlighted
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {entry.range}
                </span>
                <div className="min-w-0">
                  <div className={`font-bold text-xs truncate ${isHighlighted ? 'text-amber-300' : 'text-slate-200'}`}>
                    {entry.title}
                  </div>
                  {entry.description && (
                    <div className="text-[10px] text-slate-400 line-clamp-1">
                      {entry.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              {isHighlighted && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shrink-0 shadow animate-pulse">
                  ▶ Resultado
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

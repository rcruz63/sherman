import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export const CombatLog: React.FC = () => {
  const { combatLog, clearLog } = useGameStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full min-h-[260px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          📜 Registro de Combate (Auditoría)
        </h2>
        <button
          onClick={clearLog}
          className="min-h-[44px] px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition"
        >
          Limpiar Log
        </button>
      </div>

      <div className="flex-1 bg-slate-950 rounded-xl p-3.5 border border-slate-800/80 font-mono text-xs text-slate-300 space-y-2 overflow-y-auto max-h-72">
        {combatLog.map((message, idx) => (
          <div
            key={idx}
            className="border-b border-slate-900/80 pb-1.5 last:border-0 leading-relaxed text-slate-300"
          >
            <span className="text-amber-500 font-bold select-none mr-2">›</span>
            {message}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { LogEntry } from '../../types/game';

export const CombatLog: React.FC = () => {
  const { combatLog, logVerbosity, setLogVerbosity, clearLog } = useGameStore();
  const logEndRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog, logVerbosity, expandedIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full min-h-[280px]">
      {/* Header with Title & Detail Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          📜 Registro de Combate
        </h2>

        <div className="flex items-center gap-2">
          {/* Detail Mode Switcher */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setLogVerbosity('compact')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                logVerbosity === 'compact'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resumido
            </button>
            <button
              onClick={() => setLogVerbosity('detailed')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                logVerbosity === 'detailed'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔍 Detallado (Reglas)
            </button>
          </div>

          <button
            onClick={clearLog}
            className="min-h-[36px] px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Log Entry List */}
      <div className="flex-1 bg-slate-950 rounded-xl p-3.5 border border-slate-800/80 font-mono text-xs text-slate-300 space-y-2 overflow-y-auto max-h-80">
        {combatLog.length === 0 ? (
          <div className="text-slate-500 italic text-center py-6">Sin registros de combate aún.</div>
        ) : (
          combatLog.map((entryOrStr, idx) => {
            const entry: LogEntry =
              typeof entryOrStr === 'string'
                ? { id: `legacy-${idx}`, timestamp: '', type: 'info', summary: entryOrStr }
                : entryOrStr;

            const isExpanded = logVerbosity === 'detailed' || !!expandedIds[entry.id];
            const hasExtraDetails = !!entry.detail || !!entry.breakdown;

            return (
              <div
                key={entry.id || idx}
                className="border-b border-slate-900/80 pb-2 last:border-0 leading-relaxed text-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="text-amber-500 font-bold select-none mr-2">›</span>
                    <span className={entry.type === 'combat' ? 'text-amber-300 font-semibold' : ''}>
                      {entry.summary}
                    </span>
                  </div>

                  {hasExtraDetails && logVerbosity === 'compact' && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition border border-amber-500/20"
                      title="Ver tiradas y modificadores detallados"
                    >
                      {isExpanded ? 'Ocultar' : '🔍 Reglas'}
                    </button>
                  )}
                </div>

                {/* Expanded Mathematical Breakdown Card */}
                {isExpanded && hasExtraDetails && (
                  <div className="mt-2 ml-3 p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] text-slate-300 space-y-1.5 font-mono shadow-inner">
                    {entry.detail && (
                      <div className="text-amber-400 font-medium border-b border-slate-800/60 pb-1">
                        📋 {entry.detail}
                      </div>
                    )}

                    {entry.breakdown && (
                      <div className="space-y-1.5 pt-1 text-slate-400">
                        {entry.breakdown.diceRolls && entry.breakdown.diceRolls.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-slate-500 font-medium">🎲 Tirada Dados:</span>
                            <div className="flex gap-1">
                              {entry.breakdown.diceRolls.map((d, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold border border-amber-500/30"
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                            {entry.breakdown.diceTotal !== undefined && (
                              <span className="text-amber-300 font-bold">= {entry.breakdown.diceTotal}</span>
                            )}
                          </div>
                        )}

                        {entry.breakdown.targetDifficulty !== undefined && (
                          <div>
                            <span className="text-slate-500 font-medium">🎯 Dificultad Objetivo:</span>{' '}
                            <span className="text-emerald-400 font-bold">{entry.breakdown.targetDifficulty}</span>
                          </div>
                        )}

                        {entry.breakdown.modifiers && entry.breakdown.modifiers.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-slate-500 font-medium mr-1">📊 Modificadores:</span>
                            {entry.breakdown.modifiers.map((m, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] border border-slate-700"
                              >
                                {m.label}: <strong className="text-blue-300">{m.value}</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        {entry.breakdown.penetration !== undefined && entry.breakdown.armorValue !== undefined && (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/40 text-slate-300 flex-wrap">
                            <span>
                              🛡️ <strong>PEN {entry.breakdown.penetration}</strong> vs{' '}
                              <strong>Blindaje {entry.breakdown.impactSector || ''} {entry.breakdown.armorValue}</strong>
                            </span>
                            {entry.breakdown.damageEffect && (
                              <span className="text-red-400 font-bold">➔ {entry.breakdown.damageEffect}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { CrewRole } from '../../types/game';

export const ShermanDashboard: React.FC = () => {
  const { boardState, setCommanderPosition, addLogMessage } = useGameStore();

  if (!boardState) return null;
  const sherman = boardState.sherman;

  const toggleCrewStatus = (role: CrewRole) => {
    const current = sherman.crew[role];
    const newStatus = current.status === 'active' ? 'kia' : 'active';
    
    useGameStore.setState((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            crew: {
              ...state.boardState.sherman.crew,
              [role]: { ...current, status: newStatus },
            },
          },
        },
      };
    });

    addLogMessage(`Tripulante ${current.name} actualizado a: ${newStatus === 'kia' ? '☠️ KIA' : '🟢 ACTIVO'}`);
  };

  const toggleStatusFlag = (flag: 'isLoaded' | 'isTurretDamaged' | 'isImmobilized' | 'hasSmoke' | 'isHullDown') => {
    const newValue = !sherman[flag];
    useGameStore.setState((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            [flag]: newValue,
          },
        },
      };
    });
    addLogMessage(`Estado Sherman ${flag} cambiado a: ${newValue ? 'ACTIVADO' : 'DESACTIVADO'}`);
  };

  const adjustFireLevel = (delta: number) => {
    const newLevel = Math.max(0, sherman.fireLevel + delta);
    useGameStore.setState((state) => {
      if (!state.boardState) return state;
      return {
        boardState: {
          ...state.boardState,
          sherman: {
            ...state.boardState.sherman,
            fireLevel: newLevel,
          },
        },
      };
    });
    addLogMessage(`Nivel de fuego Sherman actualizado a: ${newLevel}`);
  };

  const crewRoles: Array<{ role: CrewRole; label: string; icon: string }> = [
    { role: 'commander', label: 'Comandante', icon: '🎖️' },
    { role: 'loader', label: 'Cargador', icon: '📦' },
    { role: 'gunner', label: 'Artillero', icon: '🎯' },
    { role: 'driver', label: 'Conductor', icon: '🕹️' },
    { role: 'assistant', label: 'Asistente', icon: '🔧' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
          🚜 Panel de Control - Sherman M4
        </h2>
        <span className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded-full font-mono">
          ({sherman.coord.q}, {sherman.coord.r}) | Face: {sherman.facing}
        </span>
      </div>

      {/* Crew Panel */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Tripulación (5 Miembros)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {crewRoles.map(({ role, label, icon }) => {
            const member = sherman.crew[role];
            const isAlive = member.status === 'active';
            const isCommander = role === 'commander';

            return (
              <div
                key={role}
                className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                  isAlive
                    ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    : 'bg-red-950/30 border-red-900/50 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                    {icon} {label}
                  </span>
                  <button
                    onClick={() => toggleCrewStatus(role)}
                    className={`min-h-[44px] min-w-[44px] px-3 py-1 rounded-lg text-xs font-bold transition ${
                      isAlive
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 hover:bg-emerald-900'
                        : 'bg-red-900 text-red-100 hover:bg-red-800'
                    }`}
                  >
                    {isAlive ? 'ACTIVO' : '☠️ KIA'}
                  </button>
                </div>

                {isCommander && isAlive && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex gap-2">
                    <button
                      onClick={() => setCommanderPosition('unhatched')}
                      className={`flex-1 min-h-[44px] py-1.5 rounded-lg text-xs font-bold transition ${
                        sherman.commanderPosition === 'unhatched'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      Interior (I)
                    </button>
                    <button
                      onClick={() => setCommanderPosition('hatched')}
                      className={`flex-1 min-h-[44px] py-1.5 rounded-lg text-xs font-bold transition ${
                        sherman.commanderPosition === 'hatched'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      Asomado (A)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cannon Loaded & Fire Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cannon Status */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Cañón Principal</div>
            <div className={`text-base font-bold mt-1 ${sherman.isLoaded ? 'text-amber-400' : 'text-slate-500'}`}>
              {sherman.isLoaded ? '⚡ Cargado' : '⭕ Descargado'}
            </div>
          </div>
          <button
            onClick={() => toggleStatusFlag('isLoaded')}
            className={`min-h-[48px] px-4 py-2 rounded-xl font-bold text-xs transition ${
              sherman.isLoaded
                ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {sherman.isLoaded ? 'Disparar / Vaciar' : 'Cargar Proyectil'}
          </button>
        </div>

        {/* Fire Level */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Nivel de Fuego</div>
            <div className="text-lg font-bold text-red-400 mt-1 flex items-center gap-1">
              🔥 {sherman.fireLevel}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => adjustFireLevel(-1)}
              className="min-h-[48px] min-w-[48px] bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl font-bold text-lg flex items-center justify-center"
              title="Disminuir Fuego"
            >
              −
            </button>
            <button
              onClick={() => adjustFireLevel(1)}
              className="min-h-[48px] min-w-[48px] bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-red-400 rounded-xl font-bold text-lg flex items-center justify-center"
              title="Aumentar Fuego"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Status Chips & Toggles */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Estados del Tanque
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => toggleStatusFlag('isTurretDamaged')}
            className={`min-h-[48px] p-3 rounded-xl border text-xs font-bold transition text-center ${
              sherman.isTurretDamaged
                ? 'bg-red-950 text-red-400 border-red-800'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            💥 Torreta Averiada
          </button>

          <button
            onClick={() => toggleStatusFlag('isImmobilized')}
            className={`min-h-[48px] p-3 rounded-xl border text-xs font-bold transition text-center ${
              sherman.isImmobilized
                ? 'bg-orange-950 text-orange-400 border-orange-800'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            🛑 Inmovilizado
          </button>

          <button
            onClick={() => toggleStatusFlag('hasSmoke')}
            className={`min-h-[48px] p-3 rounded-xl border text-xs font-bold transition text-center ${
              sherman.hasSmoke
                ? 'bg-slate-800 text-slate-200 border-slate-600'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            💨 Humo Pantalla
          </button>

          <button
            onClick={() => toggleStatusFlag('isHullDown')}
            className={`min-h-[48px] p-3 rounded-xl border text-xs font-bold transition text-center ${
              sherman.isHullDown
                ? 'bg-blue-950 text-blue-400 border-blue-800'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            🛡️ Desenfilada
          </button>
        </div>
      </div>
    </div>
  );
};

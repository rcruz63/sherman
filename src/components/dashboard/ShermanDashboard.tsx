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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
          🚜 Panel Sherman M4
        </h2>
        <span className="text-[11px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md font-mono">
          ({sherman.coord.q}, {sherman.coord.r}) | Face: {sherman.facing}
        </span>
      </div>

      {/* Crew Panel - Compact 5-slot grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {crewRoles.map(({ role, label, icon }) => {
          const member = sherman.crew[role];
          const isAlive = member.status === 'active';
          const isCommander = role === 'commander';

          return (
            <div
              key={role}
              className={`p-1.5 rounded-xl border transition flex flex-col justify-between ${
                isCommander ? 'col-span-2 sm:col-span-1' : ''
              } ${
                isAlive
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-red-950/40 border-red-900/60 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold text-slate-300 truncate flex items-center gap-1">
                  <span>{icon}</span>
                  <span className="truncate">{label}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleCrewStatus(role)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black transition cursor-pointer ${
                    isAlive
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/80 hover:bg-emerald-900'
                      : 'bg-red-900 text-white hover:bg-red-800'
                  }`}
                  title={isAlive ? 'Marcar KIA' : 'Revivir (Activo)'}
                >
                  {isAlive ? 'OK' : 'KIA'}
                </button>
              </div>

              {isCommander && isAlive && (
                <div className="flex gap-1 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setCommanderPosition('unhatched')}
                    className={`flex-1 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      sherman.commanderPosition === 'unhatched'
                        ? 'bg-amber-600 text-white font-black shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    title="Interior (Protegido)"
                  >
                    (I)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommanderPosition('hatched')}
                    className={`flex-1 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      sherman.commanderPosition === 'hatched'
                        ? 'bg-amber-600 text-white font-black shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    title="Asomado (+1 Dado Mando)"
                  >
                    (A)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cannon Loaded, Fire Level & Tank Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
        {/* Cannon Status */}
        <button
          type="button"
          onClick={() => toggleStatusFlag('isLoaded')}
          className={`col-span-1 sm:col-span-2 min-h-[36px] px-2.5 py-1 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-1 cursor-pointer ${
            sherman.isLoaded
              ? 'bg-amber-600 border-amber-400 text-white shadow-md'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
          }`}
          title="Alternar estado de carga del cañón"
        >
          <span>Cañón</span>
          <span className="font-extrabold">{sherman.isLoaded ? '⚡ Cargado' : 'Descarg.'}</span>
        </button>

        {/* Fire Level */}
        <div className="col-span-1 sm:col-span-2 min-h-[36px] px-2 py-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-red-400 flex items-center gap-1">
            🔥 {sherman.fireLevel}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => adjustFireLevel(-1)}
              className="w-6 h-6 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded text-xs font-bold flex items-center justify-center cursor-pointer"
              title="Disminuir Fuego"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => adjustFireLevel(1)}
              className="w-6 h-6 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-red-400 rounded text-xs font-bold flex items-center justify-center cursor-pointer"
              title="Aumentar Fuego"
            >
              +
            </button>
          </div>
        </div>

        {/* Status Chips */}
        <div className="col-span-2 sm:col-span-2 grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => toggleStatusFlag('isTurretDamaged')}
            className={`min-h-[36px] p-1 rounded-lg border text-[10px] font-bold transition flex flex-col items-center justify-center cursor-pointer ${
              sherman.isTurretDamaged
                ? 'bg-red-950 text-red-400 border-red-800 shadow'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
            }`}
            title="Torreta Averiada"
          >
            <span>💥</span>
            <span>Torreta</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatusFlag('isImmobilized')}
            className={`min-h-[36px] p-1 rounded-lg border text-[10px] font-bold transition flex flex-col items-center justify-center cursor-pointer ${
              sherman.isImmobilized
                ? 'bg-orange-950 text-orange-400 border-orange-800 shadow'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
            }`}
            title="Inmovilizado"
          >
            <span>🛑</span>
            <span>Inmov</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatusFlag('hasSmoke')}
            className={`min-h-[36px] p-1 rounded-lg border text-[10px] font-bold transition flex flex-col items-center justify-center cursor-pointer ${
              sherman.hasSmoke
                ? 'bg-slate-800 text-slate-200 border-slate-600 shadow'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
            }`}
            title="Humo Activo"
          >
            <span>💨</span>
            <span>Humo</span>
          </button>

          <button
            type="button"
            onClick={() => toggleStatusFlag('isHullDown')}
            className={`min-h-[36px] p-1 rounded-lg border text-[10px] font-bold transition flex flex-col items-center justify-center cursor-pointer ${
              sherman.isHullDown
                ? 'bg-blue-950 text-blue-400 border-blue-800 shadow'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
            }`}
            title="Desenfilada"
          >
            <span>🛡️</span>
            <span>Desenf</span>
          </button>
        </div>
      </div>
    </div>
  );
};

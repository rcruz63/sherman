import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { missions } from '../../data/missions';

export const GameOverModal: React.FC = () => {
  const { gameEndStatus, boardState, loadMission } = useGameStore();

  if (!gameEndStatus || !gameEndStatus.isGameOver || !boardState) {
    return null;
  }

  const isVictory = gameEndStatus.isVictory;
  const currentMissionId = boardState.missionData?.id || 1;

  const handleNextMission = () => {
    const nextMission = missions.find((m) => m.id === currentMissionId + 1) || missions[0];
    loadMission(nextMission);
  };

  const handleRetry = () => {
    const currentMission = missions.find((m) => m.id === currentMissionId) || missions[0];
    loadMission(currentMission);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
        {/* Banner Icon */}
        <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-4xl shadow-xl ${
          isVictory ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400' : 'bg-red-500/20 border-2 border-red-500 text-red-400'
        }`}>
          {isVictory ? '🏆' : '💀'}
        </div>

        {/* Title & Subtitle */}
        <div>
          <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-wide ${
            isVictory ? 'text-amber-400' : 'text-red-500'
          }`}>
            {isVictory ? '¡Misión Cumplida!' : 'Fin de Partida'}
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {boardState.missionData?.title} | Turnos jugados: {boardState.currentTurn}
          </p>
        </div>

        {/* Detailed Message */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
          {gameEndStatus.message}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleRetry}
            className="flex-1 min-h-[48px] px-4 py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold text-xs rounded-2xl border border-slate-700 transition"
          >
            🔄 Reintentar Misión
          </button>

          {isVictory && (
            <button
              onClick={handleNextMission}
              className="flex-1 min-h-[48px] px-4 py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-xs rounded-2xl shadow-lg transition"
            >
              ⏭️ Siguiente Misión
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

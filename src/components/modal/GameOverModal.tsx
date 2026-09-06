import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { missions } from '../../data/missions';

export const GameOverModal: React.FC = () => {
  const {
    gameEndStatus,
    boardState,
    gameMode,
    campaignState,
    loadMission,
    setIntermissionOpen,
    setSaveSlotsModalOpen,
  } = useGameStore();

  if (!gameEndStatus || !gameEndStatus.isGameOver || !boardState) {
    return null;
  }

  const isVictory = gameEndStatus.isVictory;
  const isCampaign = gameMode === 'campaign' && campaignState?.active;
  const isFinalCampaignVictory =
    isVictory && isCampaign && campaignState.currentMissionIndex >= campaignState.missionSequence.length - 1;

  const currentMissionId = boardState.missionData?.id || 1;

  const handleNextMissionSingle = () => {
    const nextMission = missions.find((m) => m.id === currentMissionId + 1) || missions[0];
    loadMission(nextMission);
  };

  const handleRetry = () => {
    const currentMission = missions.find((m) => m.id === currentMissionId) || missions[0];
    loadMission(currentMission);
  };

  const handleCampaignContinue = () => {
    setIntermissionOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
        {/* Banner Icon */}
        <div
          className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-4xl shadow-xl ${
            isVictory
              ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400'
              : 'bg-red-500/20 border-2 border-red-500 text-red-400'
          }`}
        >
          {isFinalCampaignVictory ? '🎖️' : isVictory ? '🏆' : '💀'}
        </div>

        {/* Title & Subtitle */}
        <div>
          <h2
            className={`text-2xl sm:text-3xl font-black uppercase tracking-wide ${
              isVictory ? 'text-amber-400' : 'text-red-500'
            }`}
          >
            {isFinalCampaignVictory
              ? '¡Victoria de Campaña!'
              : isVictory
              ? '¡Misión Cumplida!'
              : 'Fin de Partida'}
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {boardState.missionData?.title} | Turnos jugados: {boardState.currentTurn}
            {isCampaign && ` | Campaña Misión ${campaignState.currentMissionIndex + 1}/${campaignState.missionSequence.length}`}
          </p>
        </div>

        {/* Detailed Message */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
          {gameEndStatus.message}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-2">
          {isVictory && isCampaign && (
            <button
              onClick={handleCampaignContinue}
              className="w-full min-h-[48px] px-4 py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-extrabold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>🎖️</span> Traspaso de Campaña y Recuperación
            </button>
          )}

          {isVictory && !isCampaign && (
            <button
              onClick={handleNextMissionSingle}
              className="w-full min-h-[48px] px-4 py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-xs rounded-2xl shadow-lg transition"
            >
              ⏭️ Siguiente Misión
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold text-xs rounded-2xl border border-slate-700 transition"
            >
              🔄 Reintentar
            </button>

            <button
              onClick={() => {
                setSaveSlotsModalOpen(true);
              }}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-bold text-xs rounded-2xl border border-slate-700 transition"
            >
              📁 Partidas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getShermanCarryOverSummary } from '../../core/rules/campaign';
import { missions } from '../../data/missions';
import { CrewRole } from '../../types/game';

interface CampaignIntermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSlots: () => void;
}

export const CampaignIntermissionModal: React.FC<CampaignIntermissionModalProps> = ({
  isOpen,
  onClose,
  onOpenSlots,
}) => {
  const { boardState, campaignState, advanceCampaignMission, saveCurrentSlot } = useGameStore();

  const [selectedReplacementRole, setSelectedReplacementRole] = useState<CrewRole | undefined>(undefined);

  if (!isOpen || !boardState || !campaignState) return null;

  const carryOver = getShermanCarryOverSummary(boardState.sherman);
  const nextMissionIndex = campaignState.currentMissionIndex + 1;
  const isFinalMission = nextMissionIndex >= campaignState.missionSequence.length;
  const nextMissionId = !isFinalMission ? campaignState.missionSequence[nextMissionIndex] : null;
  const nextMissionData = nextMissionId ? missions.find((m) => m.id === nextMissionId) : null;

  const currentMission = boardState.missionData || missions[0];

  const handleProceed = () => {
    advanceCampaignMission(selectedReplacementRole);
    onClose();
  };

  const handleSaveAndExit = () => {
    saveCurrentSlot();
    onClose();
    onOpenSlots();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-400 font-bold">
              🎖️
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400 uppercase tracking-wide">
                Informe de Misión y Traspaso
              </h2>
              <p className="text-xs text-slate-400">
                Reglamento Pág. 19 | Campaña: Misión {campaignState.currentMissionIndex + 1} de {campaignState.missionSequence.length}
              </p>
            </div>
          </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs">
          {/* Mission Success Box */}
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-slate-200 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-emerald-400 text-sm">
              <span>🏆 ¡Misión {currentMission.id}: {currentMission.title} Superada!</span>
              <span className="text-xs text-slate-300 font-normal">Turnos: {boardState.currentTurn}</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              El Sherman ha cumplido los objetivos marcados para este sector. La tripulación se prepara para la siguiente fase de la campaña.
            </p>
          </div>

          {/* Rule 1: Crew Replacement (Page 19) */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                <span>1.</span> Reemplazo de Tripulación (1 Recluta KIA)
              </h3>
              <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded text-slate-400">
                Regla Oficial Pág. 19
              </span>
            </div>

            {carryOver.kiaCrew.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-emerald-400">
                <span className="text-base">💚</span>
                <span>¡Excelente labor! Todos los 5 miembros de la tripulación han sobrevivido sanos y salvos.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-300 text-xs">
                  Tienes <strong>{carryOver.kiaCrew.length} baja(s)</strong> en la tripulación. Elige a <strong>un (1)</strong> tripulante para recibir un reemplazo y volver a estar activo:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {carryOver.kiaCrew.map((member) => {
                    const isSelected = selectedReplacementRole === member.role;
                    return (
                      <button
                        key={member.role}
                        onClick={() => setSelectedReplacementRole(isSelected ? undefined : member.role)}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow ring-1 ring-amber-500'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">💀</span>
                          <div>
                            <div className="font-bold">{member.name}</div>
                            <div className="text-[10px] text-slate-400 uppercase">{member.role}</div>
                          </div>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 bg-slate-800 rounded">
                          {isSelected ? '✓ Reemplazar' : 'Seleccionar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rule 2 & 3: Damage & Gun Conservation (Page 19) */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="font-extrabold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <span>2 & 3.</span> Conservación de Daños y Estado del Cañón
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Turret */}
              <div className={`p-2.5 rounded-xl border ${
                carryOver.isTurretDamaged
                  ? 'bg-amber-950/40 border-amber-600 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Torreta</div>
                <div className="font-bold text-xs mt-0.5">
                  {carryOver.isTurretDamaged ? '💥 DAÑADA' : '🛡️ Operativa'}
                </div>
              </div>

              {/* Immobilized */}
              <div className={`p-2.5 rounded-xl border ${
                carryOver.isImmobilized
                  ? 'bg-red-950/40 border-red-600 text-red-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Movilidad</div>
                <div className="font-bold text-xs mt-0.5">
                  {carryOver.isImmobilized ? '🛑 INMOVILIZADO' : '🚗 Móvil'}
                </div>
              </div>

              {/* Fire Level */}
              <div className={`p-2.5 rounded-xl border ${
                carryOver.fireLevel > 0
                  ? 'bg-orange-950/40 border-orange-600 text-orange-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Fuego</div>
                <div className="font-bold text-xs mt-0.5">
                  {carryOver.fireLevel > 0 ? `🔥 Nivel ${carryOver.fireLevel}` : '🧯 Sin Fuego'}
                </div>
              </div>

              {/* Main Gun */}
              <div className={`p-2.5 rounded-xl border ${
                carryOver.isLoaded
                  ? 'bg-indigo-950/40 border-indigo-600 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Cañón Principal</div>
                <div className="font-bold text-xs mt-0.5">
                  {carryOver.isLoaded ? '⚡ CARGADO' : '○ Descargado'}
                </div>
              </div>
            </div>
          </div>

          {/* Next Mission Preview */}
          {!isFinalMission && nextMissionData ? (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-amber-400 font-bold">
                <span>Próxima Misión: {nextMissionData.title}</span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                  {nextMissionIndex + 1} de {campaignState.missionSequence.length}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">{nextMissionData.briefing}</p>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-2xl text-amber-300 text-center font-bold">
              🎖️ ¡Esta ha sido la última misión de la campaña! Pulsa el botón para reclamar la Victoria Total.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-800 shrink-0">
          <button
            onClick={handleSaveAndExit}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition"
          >
            💾 Guardar y Salir al Menú
          </button>

          <button
            onClick={handleProceed}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-extrabold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
          >
            <span>{isFinalMission ? '🏆' : '▶️'}</span>
            {isFinalMission ? 'Finalizar Campaña' : 'Comenzar Siguiente Misión'}
          </button>
        </div>
      </div>
    </div>
  );
};

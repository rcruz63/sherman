import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { missions } from '../../data/missions';
import { CampaignType } from '../../types/game';

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewGameModal: React.FC<NewGameModalProps> = ({ isOpen, onClose }) => {
  const { startNewSingleMission, startNewCampaign } = useGameStore();

  const [activeTab, setActiveTab] = useState<'single' | 'campaign'>('single');
  const [selectedMissionId, setSelectedMissionId] = useState<number>(1);
  const [campaignType, setCampaignType] = useState<CampaignType>('sequential');
  const [randomCount, setRandomCount] = useState<number>(5);
  const [selectedCustomMissions, setSelectedCustomMissions] = useState<number[]>([1, 2, 3, 4]);
  const [customSlotName, setCustomSlotName] = useState<string>('');

  if (!isOpen) return null;

  const selectedMissionData = missions.find((m) => m.id === selectedMissionId) || missions[0];

  const handleStart = () => {
    if (activeTab === 'single') {
      const name = customSlotName.trim() || `Misión ${selectedMissionId} - ${selectedMissionData.title}`;
      startNewSingleMission(selectedMissionId, name);
    } else {
      let options: { missionIds?: number[]; count?: number; slotName?: string } = {};
      if (campaignType === 'random') {
        options = { count: randomCount };
      } else if (campaignType === 'custom') {
        if (selectedCustomMissions.length === 0) {
          setSelectedCustomMissions([1, 2]);
          options = { missionIds: [1, 2] };
        } else {
          options = { missionIds: selectedCustomMissions };
        }
      }

      const defaultNames: Record<CampaignType, string> = {
        sequential: 'Campaña Histórica (1-13)',
        custom: `Campaña Personalizada (${(options.missionIds || selectedCustomMissions).length} misiones)`,
        random: `Campaña Aleatoria (${randomCount} misiones)`,
      };

      options.slotName = customSlotName.trim() || defaultNames[campaignType];
      startNewCampaign(campaignType, options);
    }
    onClose();
  };

  const toggleCustomMission = (id: number) => {
    if (selectedCustomMissions.includes(id)) {
      if (selectedCustomMissions.length > 1) {
        setSelectedCustomMissions(selectedCustomMissions.filter((m) => m !== id));
      }
    } else {
      setSelectedCustomMissions([...selectedCustomMissions, id].sort((a, b) => a - b));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-400 font-bold">
              ⚔️
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400 uppercase tracking-wide">Nueva Partida</h2>
              <p className="text-xs text-slate-400">Elige el formato de juego y configura tu sesión</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 my-4 shrink-0">
          <button
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'single'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🎯</span> Misión Suelta
          </button>
          <button
            onClick={() => setActiveTab('campaign')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'campaign'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🎖️</span> Modo Campaña (Reglamento Pág. 19)
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === 'single' ? (
            /* Single Mission Selection */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1.5">
                  Selecciona la Misión:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  {missions.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMissionId(m.id)}
                      className={`p-2 rounded-lg text-left text-xs font-semibold border transition ${
                        selectedMissionId === m.id
                          ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold">Misión {m.id}</div>
                      <div className="text-[10px] text-slate-400 truncate">{m.title}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mission Preview Card */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-amber-400 font-bold">
                  <span>Misión {selectedMissionData.id}: {selectedMissionData.title}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                    {selectedMissionData.enemyDeployment?.tanks?.length ?? 0} Tanques Enemigos
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{selectedMissionData.briefing}</p>
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px]">
                  <span className="text-emerald-400 font-semibold">
                    🏆 Victoria: {selectedMissionData.victoryConditions.requireMapExit ? 'Salida del mapa' : ''}
                    {selectedMissionData.victoryConditions.destroyAllEnemiesOfType ? ` + Destruir ${selectedMissionData.victoryConditions.destroyAllEnemiesOfType.join(', ')}` : ''}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Campaign Mode Selection */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1.5">
                  Tipo de Campaña:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setCampaignType('sequential')}
                    className={`p-3 rounded-2xl text-left border transition ${
                      campaignType === 'sequential'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs">📜 Histórica Completa</div>
                    <div className="text-[10px] text-slate-400 mt-1">13 misiones en orden secuencial (1 al 13).</div>
                  </button>

                  <button
                    onClick={() => setCampaignType('random')}
                    className={`p-3 rounded-2xl text-left border transition ${
                      campaignType === 'random'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs">🎲 Aleatoria</div>
                    <div className="text-[10px] text-slate-400 mt-1">Sorteo aleatorio sin repetir misiones.</div>
                  </button>

                  <button
                    onClick={() => setCampaignType('custom')}
                    className={`p-3 rounded-2xl text-left border transition ${
                      campaignType === 'custom'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs">🛠️ Personalizada</div>
                    <div className="text-[10px] text-slate-400 mt-1">Elige qué misiones encadenar a tu gusto.</div>
                  </button>
                </div>
              </div>

              {/* Campaign Type Specific Config */}
              {campaignType === 'random' && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-slate-300">
                    Número de Misiones en la Campaña: <strong className="text-amber-400">{randomCount}</strong>
                  </label>
                  <div className="flex gap-2">
                    {[3, 4, 5, 7, 10].map((num) => (
                      <button
                        key={num}
                        onClick={() => setRandomCount(num)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                          randomCount === num
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {num} Misiones
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {campaignType === 'custom' && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Selecciona las Misiones a Encadenar ({selectedCustomMissions.length}):</span>
                    <button
                      onClick={() => setSelectedCustomMissions([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Marcar Todas
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                    {missions.map((m) => {
                      const isSelected = selectedCustomMissions.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleCustomMission(m.id)}
                          className={`p-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
                            isSelected
                              ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span>{isSelected ? '☑️' : '◻️'}</span>
                          <span className="truncate">M.{m.id}: {m.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rules Callout (Manual Pág. 19) */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-[11px] text-amber-200/90 space-y-1.5">
                <div className="font-bold flex items-center gap-1 text-amber-400">
                  <span>📜</span> Reglas Oficiales de Traspaso (Manual Pág. 19):
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  <li><strong>Reemplazo de Tripulación:</strong> Puedes reemplazar a 1 tripulante KIA entre misiones.</li>
                  <li><strong>Conservación de Daños:</strong> Se trasladan los daños de Torreta, Inmovilizado y Nivel de Fuego.</li>
                  <li><strong>Estado del Cañón:</strong> Se mantiene si quedó Cargado o Descargado.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Custom Slot Name */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-300 mb-1.5">
              Nombre de la Partida (Opcional):
            </label>
            <input
              type="text"
              placeholder={activeTab === 'single' ? `Misión ${selectedMissionId} - ${selectedMissionData.title}` : 'Nombre de la Campaña'}
              value={customSlotName}
              onChange={(e) => setCustomSlotName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-800 shrink-0 mt-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-extrabold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
          >
            <span>🚀</span> Comenzar Partida
          </button>
        </div>
      </div>
    </div>
  );
};

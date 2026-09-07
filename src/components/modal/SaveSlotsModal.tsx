import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  listSaveSlots,
  exportSlotToJson,
  exportAllSlotsToJson,
  importSlotFromJson,
} from '../../core/storage/gamePersistence';
import { SaveSlotMetadata } from '../../types/game';

interface SaveSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewGame: () => void;
}

export const SaveSlotsModal: React.FC<SaveSlotsModalProps> = ({ isOpen, onClose, onOpenNewGame }) => {
  const { currentSlotId, loadSlot, deleteSlot, renameSlot, duplicateSlot, saveCurrentSlot } = useGameStore();

  const [slots, setSlots] = useState<SaveSlotMetadata[]>([]);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSlots = () => {
    const list = listSaveSlots();
    setSlots(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshSlots();
      setFeedbackMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleLoad = (slotId: string) => {
    const ok = loadSlot(slotId);
    if (ok) {
      onClose();
    }
  };

  const handleDelete = (slotId: string, name: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar la partida "${name}"?`)) {
      deleteSlot(slotId);
      refreshSlots();
      showNotification(`🗑️ Partida "${name}" eliminada.`);
    }
  };

  const handleDuplicate = (slotId: string) => {
    const newId = duplicateSlot(slotId);
    if (newId) {
      refreshSlots();
      showNotification('📋 Partida duplicada exitosamente.');
    }
  };

  const handleStartRename = (slot: SaveSlotMetadata) => {
    setEditingSlotId(slot.id);
    setEditingName(slot.name);
  };

  const handleSaveRename = (slotId: string) => {
    if (editingName.trim()) {
      renameSlot(slotId, editingName.trim());
      setEditingSlotId(null);
      refreshSlots();
      showNotification('✏️ Partida renombrada.');
    }
  };

  const handleExportSingle = (slot: SaveSlotMetadata) => {
    const json = exportSlotToJson(slot.id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sherman_save_${slot.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(`📤 Partida "${slot.name}" descargada en JSON.`);
  };

  const handleExportAll = () => {
    const json = exportAllSlotsToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sherman_backup_todas_las_partidas_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('📦 Copia de seguridad completa descargada.');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importSlotFromJson(content);
        if (result.success) {
          refreshSlots();
          if (result.slotId) {
            loadSlot(result.slotId);
          }
          showNotification('📥 Partida importada y activada con éxito.');
        } else {
          alert(result.error || 'Error al importar archivo.');
        }
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleSaveActiveNow = () => {
    saveCurrentSlot();
    refreshSlots();
    showNotification('💾 Partida actual guardada en el almacenamiento local.');
  };

  const handleHardReset = async () => {
    if (
      window.confirm(
        '¿Deseas restablecer completamente la caché de la aplicación y reiniciar? (Se actualizarán todos los mapas a la última versión y se limpiará el almacenamiento local).'
      )
    ) {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
        }
        localStorage.clear();
        sessionStorage.clear();
      } catch (err) {
        console.error('Error limpiando caché:', err);
      }
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-400 font-bold">
              📁
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-400 uppercase tracking-wide">Gestor de Partidas Guardadas</h2>
              <p className="text-xs text-slate-400">Múltiples slots en almacenamiento local (localStorage / PWA) y copia JSON</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                onClose();
                onOpenNewGame();
              }}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              <span>➕</span> Nueva Partida
            </button>

            <button
              onClick={handleSaveActiveNow}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>💾</span> Guardar Partida Actual
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>📥</span> Importar JSON
            </button>

            {slots.length > 0 && (
              <button
                onClick={handleExportAll}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <span>📦</span> Backup Completo
              </button>
            )}
          </div>
        </div>

        {/* Notification Toast */}
        {feedbackMsg && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-xl text-xs font-semibold animate-fade-in shrink-0 mb-2">
            {feedbackMsg}
          </div>
        )}

        {/* Slots List (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {slots.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-3xl border border-slate-800/80 p-6 space-y-3">
              <div className="text-4xl text-slate-600">📁</div>
              <h3 className="text-sm font-bold text-slate-300">No hay partidas guardadas en este dispositivo</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Inicia una nueva misión o campaña para guardar automáticamente tu progreso en el navegador.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenNewGame();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition shadow"
              >
                Crear Primera Partida
              </button>
            </div>
          ) : (
            slots.map((slot) => {
              const isActive = slot.id === currentSlotId;
              const formattedDate = new Date(slot.updatedAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={slot.id}
                  className={`p-4 rounded-2xl border transition relative ${
                    isActive
                      ? 'bg-slate-950 border-amber-500/70 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Slot Info & Status */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Mode Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            slot.mode === 'campaign'
                              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                              : 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {slot.mode === 'campaign'
                            ? `🎖️ Campaña (${(slot.campaignInfo?.currentMissionIndex ?? 0) + 1}/${slot.campaignInfo?.totalMissions ?? '?'})`
                            : '🎯 Misión Suelta'}
                        </span>

                        {isActive && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ● Activa
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400">{formattedDate}</span>
                      </div>

                      {/* Slot Name (Editable inline) */}
                      {editingSlotId === slot.id ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-slate-900 border border-amber-500 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none flex-1 max-w-xs"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(slot.id)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingSlotId(null)}
                            className="px-2.5 py-1 bg-slate-800 text-slate-400 text-xs rounded-lg"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-200 truncate">{slot.name}</h3>
                          <button
                            onClick={() => handleStartRename(slot)}
                            className="text-slate-500 hover:text-slate-300 text-xs transition"
                            title="Renombrar partida"
                          >
                            ✏️
                          </button>
                        </div>
                      )}

                      {/* Mission and Sherman Dashboard Summary */}
                      <div className="flex items-center gap-2.5 text-xs text-slate-400 flex-wrap pt-0.5">
                        <span className="text-slate-300 font-medium">
                          Misión {slot.missionId}: {slot.missionTitle}
                        </span>
                        <span className="text-slate-600">|</span>
                        <span>Turno {slot.currentTurn}</span>
                        <span className="text-slate-600">|</span>

                        {/* Sherman Mini Badges */}
                        <div className="flex items-center gap-1 text-[11px]">
                          <span
                            title="Tripulantes activos"
                            className="px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 text-emerald-400 font-semibold"
                          >
                            💚 {slot.shermanStatus.crewAliveCount}/5
                          </span>
                          {slot.shermanStatus.isTurretDamaged && (
                            <span
                              title="Torreta Dañada"
                              className="px-1.5 py-0.5 bg-amber-950/60 rounded border border-amber-800 text-amber-400 font-semibold"
                            >
                              💥 Torreta
                            </span>
                          )}
                          {slot.shermanStatus.isImmobilized && (
                            <span
                              title="Inmovilizado"
                              className="px-1.5 py-0.5 bg-red-950/60 rounded border border-red-800 text-red-400 font-semibold"
                            >
                              🛑 Inmóvil
                            </span>
                          )}
                          {slot.shermanStatus.fireLevel > 0 && (
                            <span
                              title={`Fuego nivel ${slot.shermanStatus.fireLevel}`}
                              className="px-1.5 py-0.5 bg-orange-950/60 rounded border border-orange-800 text-orange-400 font-semibold"
                            >
                              🔥 Nivel {slot.shermanStatus.fireLevel}
                            </span>
                          )}
                          <span
                            title={slot.shermanStatus.isLoaded ? 'Cañón cargado' : 'Cañón descargado'}
                            className="px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 text-slate-300 font-semibold"
                          >
                            {slot.shermanStatus.isLoaded ? '⚡ Cargado' : '○ Vacío'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Slot Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                      {!isActive && (
                        <button
                          onClick={() => handleLoad(slot.id)}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition"
                        >
                          Cargar
                        </button>
                      )}

                      <button
                        onClick={() => handleDuplicate(slot.id)}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition"
                        title="Duplicar partida"
                      >
                        📋
                      </button>

                      <button
                        onClick={() => handleExportSingle(slot)}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition"
                        title="Exportar archivo JSON"
                      >
                        📤
                      </button>

                      <button
                        onClick={() => handleDelete(slot.id, slot.name)}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-red-900 text-red-400 hover:text-red-200 text-xs rounded-xl border border-slate-700 transition"
                        title="Eliminar partida"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={handleHardReset}
            className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            title="Desregistra Service Worker, limpia Caché Storage y reinicia con los últimos mapas"
          >
            <span>🔄</span> Forzar Actualización y Limpiar Caché
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

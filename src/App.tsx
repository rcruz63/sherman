import React, { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { HexBoard } from './components/board/HexBoard';
import { ShermanDashboard } from './components/dashboard/ShermanDashboard';
import { PhaseConsole } from './components/controls/PhaseConsole';
import { CombatLog } from './components/log/CombatLog';
import { GameOverModal } from './components/modal/GameOverModal';
import { BoardHex } from './types/game';
import { calculateHitDifficulty } from './core/rules/combat';
import { missions } from './data/missions';
import { saveGameStateToStorage, loadGameStateFromStorage } from './core/storage/gamePersistence';

export const App: React.FC = () => {
  const { boardState, combatLog, loadMission, addLogMessage } = useGameStore();
  const [selectedTile, setSelectedTile] = useState<BoardHex | null>(null);
  const [activeTab, setActiveTab] = useState<'controls' | 'sherman' | 'log'>('controls');
  const [selectedMissionId, setSelectedMissionId] = useState<number>(1);

  useEffect(() => {
    // Try restoring saved game state on startup if present
    const saved = loadGameStateFromStorage();
    if (saved) {
      useGameStore.setState({
        boardState: saved.boardState,
        combatLog: [...saved.combatLog, '📁 Partida guardada restaurada automáticamente.'],
      });
      if (saved.boardState.missionData?.id) {
        setSelectedMissionId(saved.boardState.missionData.id);
      }
    } else {
      const targetMission = missions.find((m) => m.id === selectedMissionId) || missions[0];
      loadMission(targetMission);
    }
  }, [loadMission]);

  // Auto-save game state to localStorage whenever boardState changes
  useEffect(() => {
    if (boardState) {
      saveGameStateToStorage(boardState, combatLog);
    }
  }, [boardState, combatLog]);

  if (!boardState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-400 font-bold">
        Cargando Sherman Solitario PWA...
      </div>
    );
  }

  const primaryTarget = boardState.enemyTanks[0];
  const selectedEnemy = selectedTile
    ? boardState.enemyTanks.find((t) => t.coord.q === selectedTile.coord.q && t.coord.r === selectedTile.coord.r)
    : primaryTarget;

  const targetEnemy = selectedEnemy || primaryTarget;
  const combatAnalysis = targetEnemy
    ? calculateHitDifficulty(boardState.sherman, targetEnemy, boardState)
    : null;

  const handleManualSave = () => {
    if (boardState) {
      const success = saveGameStateToStorage(boardState, combatLog);
      if (success) {
        addLogMessage('💾 Partida guardada manualmente en el almacenamiento local (localStorage).');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans flex flex-col gap-5">
      {/* Game Over Modal Overlay */}
      <GameOverModal />

      {/* Header with Mission Selector & Persistence Buttons */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg">
            🛡️
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-amber-400 tracking-wide">
              Sherman Solitario
            </h1>
            <p className="text-xs text-slate-400">
              Wargame PWA Offline | iPad & PC Standalone
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Mission Selector Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Misión:</label>
            <select
              value={selectedMissionId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedMissionId(id);
                const target = missions.find((m) => m.id === id) || missions[0];
                loadMission(target);
              }}
              className="min-h-[44px] bg-slate-950 border border-slate-700 text-amber-400 font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  Misión {m.id}: {m.title}
                </option>
              ))}
            </select>
          </div>

          <div className="px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300">
            Turno <strong className="text-amber-400">{boardState.currentTurn}</strong> | Fase <strong className="text-amber-400">{boardState.currentPhase}</strong>
          </div>

          <button
            onClick={handleManualSave}
            className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            title="Guardar Estado Actual"
          >
            💾 Guardar
          </button>

          <button
            onClick={() => {
              const targetMission = missions.find((m) => m.id === selectedMissionId) || missions[0];
              loadMission(targetMission);
            }}
            className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            🔄 Reiniciar Misión
          </button>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Interactive Hex Board & Target Combat Inspector (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex-1 min-h-[480px]">
            <HexBoard
              boardState={boardState}
              selectedTile={selectedTile}
              onTileSelect={(tile) => setSelectedTile(tile)}
            />
          </div>

          {/* Tactical Combat Inspector */}
          {targetEnemy && combatAnalysis && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-400">
                  Inspección Táctica ➔ Objetivo: <span className="text-red-400 font-bold">{targetEnemy.type.toUpperCase()} #{targetEnemy.spawnNumber}</span> ({targetEnemy.coord.q},{targetEnemy.coord.r})
                </div>
                <div className="flex gap-3 text-xs text-slate-300 mt-1.5">
                  <span>Dist: <strong>{combatAnalysis.baseDistance} hex</strong></span>
                  <span>LOS: <strong className={combatAnalysis.hasLOS ? 'text-emerald-400' : 'text-red-400'}>{combatAnalysis.hasLOS ? 'Despejada' : 'Bloqueada'}</strong></span>
                  <span>Sector: <strong>{combatAnalysis.impactSector}</strong></span>
                  <span>Dificultad (2d6): <strong className="text-amber-400">{combatAnalysis.totalDifficulty === Infinity ? 'N/A' : combatAnalysis.totalDifficulty}</strong></span>
                </div>
              </div>

              {selectedTile && (
                <button
                  onClick={() => setSelectedTile(null)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg font-medium"
                >
                  Limpiar Selección
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Sherman Controls, Dashboard & Combat Log (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {/* Tab Switcher */}
          <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 min-h-[48px] py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'controls'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎲 Fases y Dados
            </button>
            <button
              onClick={() => setActiveTab('sherman')}
              className={`flex-1 min-h-[48px] py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'sherman'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🚜 Sherman & Tripulación
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`flex-1 min-h-[48px] py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'log'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📜 Log ({useGameStore.getState().combatLog.length})
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1">
            {activeTab === 'controls' && <PhaseConsole />}
            {activeTab === 'sherman' && <ShermanDashboard />}
            {activeTab === 'log' && <CombatLog />}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;

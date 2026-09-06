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

  const primaryTarget = boardState.enemyTanks.find((t) => t.status !== 'destroyed') || boardState.enemyTanks[0];
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

  const currentMission = boardState.missionData || missions[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-5 font-sans flex flex-col gap-4">
      {/* Game Over Modal Overlay */}
      <GameOverModal />

      {/* Header: Mission Title, Briefing, Objectives & Quick Controls */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl">
        {/* Left: Mission Info & Briefing */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg shrink-0">
              🛡️
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold text-amber-400 tracking-wide flex items-center gap-2">
                {currentMission.title}
              </h1>
              <p className="text-xs text-slate-300 line-clamp-2 max-w-3xl">
                {currentMission.briefing}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Victory & Defeat Objectives Always Visible */}
        <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-emerald-400 font-semibold border-r border-slate-800 pr-2.5">
            <span>🏆 Victoria:</span>
            <span className="text-slate-200">Destruir 2 Pz IV + Salida (2,0)</span>
          </div>
          <div className="flex items-center gap-1 text-red-400 font-semibold pl-1">
            <span>💀 Derrota:</span>
            <span className="text-slate-200">Sherman destruido / Tripulación KIA</span>
          </div>
        </div>

        {/* Right: Mission Selector & Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
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

          <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300">
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
            className="min-h-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            🔄 Reiniciar
          </button>
        </div>
      </header>

      {/* Main Screen Unified Layout (No Tabs) */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* Left/Center Area: Hex Board & Tactical Inspector (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4 h-full">
          <div className="w-full h-[540px] lg:h-[620px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
            <HexBoard
              boardState={boardState}
              selectedTile={selectedTile}
              onTileSelect={(tile) => setSelectedTile(tile)}
            />
          </div>

          {/* Tactical Combat Inspector */}
          {targetEnemy && combatAnalysis && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-400">
                  Inspección Táctica ➔ Objetivo: <span className="text-red-400 font-bold">{targetEnemy.type.toUpperCase()} #{targetEnemy.spawnNumber}</span> ({targetEnemy.coord.q},{targetEnemy.coord.r})
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-300 mt-1.5">
                  <span>Distancia: <strong>{combatAnalysis.baseDistance} hex</strong></span>
                  <span>LOS: <strong className={combatAnalysis.hasLOS ? 'text-emerald-400' : 'text-red-400'}>{combatAnalysis.hasLOS ? 'Despejada' : 'Bloqueada'}</strong></span>
                  <span>Sector de Impacto: <strong>{combatAnalysis.impactSector}</strong></span>
                  <span>Dificultad (2d6): <strong className="text-amber-400">{combatAnalysis.totalDifficulty === Infinity ? 'N/A' : combatAnalysis.totalDifficulty}</strong></span>
                </div>
              </div>

              {selectedTile && (
                <button
                  onClick={() => setSelectedTile(null)}
                  className="min-h-[40px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-semibold border border-slate-700"
                >
                  Limpiar Selección
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right Area: Fixed Dashboard, Phase Console & Audit Log (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          {/* Active Phase Console & Action Dice */}
          <PhaseConsole />

          {/* Fixed Sherman Dashboard (Crew cards with Active/KIA toggle, Commander, Statuses) */}
          <ShermanDashboard />

          {/* Exhaustive Mathematical Audit Log */}
          <div className="h-[280px]">
            <CombatLog />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;

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
    <div className="min-h-screen max-h-screen bg-slate-950 text-slate-100 p-2 md:p-4 font-sans flex flex-col gap-3 overflow-hidden">
      {/* Game Over Modal Overlay */}
      <GameOverModal />

      {/* Header: Compact Mission Title, Briefing, Objectives & Quick Controls */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-lg shrink-0">
        {/* Left: Mission Info & Briefing */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow shrink-0">
              🛡️
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-amber-400 tracking-wide truncate">
                {currentMission.title}
              </h1>
              <p className="text-xs text-slate-300 truncate">
                {currentMission.briefing}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Victory & Defeat Objectives Always Visible */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs shrink-0">
          <div className="flex items-center gap-1 text-emerald-400 font-semibold border-r border-slate-800 pr-2.5">
            <span>🏆 Victoria:</span>
            <span className="text-slate-200 font-normal">Destruir 2 Pz IV + Salida (2,0)</span>
          </div>
          <div className="flex items-center gap-1 text-red-400 font-semibold pl-1">
            <span>💀 Derrota:</span>
            <span className="text-slate-200 font-normal">Sherman / Tripulación KIA</span>
          </div>
        </div>

        {/* Right: Mission Selector & Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <select
            value={selectedMissionId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedMissionId(id);
              const target = missions.find((m) => m.id === id) || missions[0];
              loadMission(target);
            }}
            className="min-h-[38px] bg-slate-950 border border-slate-700 text-amber-400 font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                Misión {m.id}: {m.title}
              </option>
            ))}
          </select>

          <div className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300">
            Turno <strong className="text-amber-400">{boardState.currentTurn}</strong> | Fase <strong className="text-amber-400">{boardState.currentPhase}</strong>
          </div>

          <button
            onClick={handleManualSave}
            className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg border border-slate-700 transition"
          >
            💾 Guardar
          </button>

          <button
            onClick={() => {
              const targetMission = missions.find((m) => m.id === selectedMissionId) || missions[0];
              loadMission(targetMission);
            }}
            className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-lg border border-slate-700 transition"
          >
            🔄 Reiniciar
          </button>
        </div>
      </header>

      {/* Main Screen Layout (Dominant HexBoard on Left/Center, Control Sidebar on Right) */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        {/* Dominant Hex Board Container (8 Cols on Desktop / Landscape) */}
        <section className="lg:col-span-8 flex flex-col gap-2 h-full min-h-0">
          <div className="flex-1 w-full min-h-0 rounded-xl overflow-hidden shadow-2xl border border-slate-800 relative bg-slate-950">
            <HexBoard
              boardState={boardState}
              selectedTile={selectedTile}
              onTileSelect={(tile) => setSelectedTile(tile)}
            />
          </div>

          {/* Tactical Combat Inspector */}
          {targetEnemy && combatAnalysis && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-lg flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div>
                <span className="font-semibold uppercase text-slate-400">
                  Objetivo: <strong className="text-red-400">{targetEnemy.type.toUpperCase()} #{targetEnemy.spawnNumber}</strong> ({targetEnemy.coord.q},{targetEnemy.coord.r})
                </span>
                <span className="mx-2 text-slate-600">|</span>
                <span>Dist: <strong>{combatAnalysis.baseDistance} hex</strong></span>
                <span className="mx-2 text-slate-600">|</span>
                <span>LOS: <strong className={combatAnalysis.hasLOS ? 'text-emerald-400' : 'text-red-400'}>{combatAnalysis.hasLOS ? 'Despejada' : 'Bloqueada'}</strong></span>
                <span className="mx-2 text-slate-600">|</span>
                <span>Sector: <strong>{combatAnalysis.impactSector}</strong></span>
                <span className="mx-2 text-slate-600">|</span>
                <span>Dificultad (2d6): <strong className="text-amber-400">{combatAnalysis.totalDifficulty === Infinity ? 'N/A' : combatAnalysis.totalDifficulty}</strong></span>
              </div>

              {selectedTile && (
                <button
                  onClick={() => setSelectedTile(null)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-semibold border border-slate-700"
                >
                  Limpiar Selección
                </button>
              )}
            </div>
          )}
        </section>

        {/* Control Sidebar (4 Cols on Desktop / Landscape) */}
        <section className="lg:col-span-4 flex flex-col gap-3 h-full min-h-0 overflow-y-auto pr-1">
          {/* Active Phase Console & Action Dice */}
          <PhaseConsole />

          {/* Fixed Sherman Dashboard (Crew cards, Commander, Statuses) */}
          <ShermanDashboard />

          {/* Mathematical Audit Log */}
          <div className="h-[220px] shrink-0">
            <CombatLog />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;

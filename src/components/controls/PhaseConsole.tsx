import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TurnPhase } from '../../types/game';
import { calculateShermanDicePool } from '../../core/rules/missionLoader';

export const PhaseConsole: React.FC = () => {
  const {
    boardState,
    setPhase,
    addLogMessage,
    moveShermanForward,
    rotateSherman,
    loadCannon,
    fireMainGunAt,
    toggleSmoke,
    toggleHullDown,
    extinguishFire,
    rescueCrew,
    runPhase1,
    runPhase4,
    runPhase5,
    runPhase6GermanAI,
    runPhase7EndTurn,
  } = useGameStore();

  const [rolledDice, setRolledDice] = useState<number[]>([]);
  const [executionOrder, setExecutionOrder] = useState<'MAV' | 'AMV'>('MAV');

  if (!boardState) return null;
  const currentPhase = boardState.currentPhase;
  const sherman = boardState.sherman;

  const phasesList: Array<{ id: TurnPhase; title: string; desc: string }> = [
    { id: TurnPhase.SHERMAN_SMOKE_CLEANUP, title: 'Fase 1: Limpieza Humo Sherman', desc: 'Resetear humo del Sherman.' },
    { id: TurnPhase.COMMANDER_ASSIGNMENT, title: 'Fase 2: Posición Comandante', desc: 'Asignar Interior (I) o Asomado (A).' },
    { id: TurnPhase.SHERMAN_OPERATIONS, title: 'Fase 3: Operaciones Sherman', desc: 'Tirar dados y ejecutar acciones.' },
    { id: TurnPhase.GERMAN_SMOKE_CLEANUP, title: 'Fase 4: Limpieza Humo Alemán', desc: 'Resetear humo enemigo.' },
    { id: TurnPhase.FIRE_CHECK, title: 'Fase 5: Comprobación de Fuego', desc: 'Comprobar daños por fuego.' },
    { id: TurnPhase.GERMAN_OPERATIONS, title: 'Fase 6: Operaciones Alemanas', desc: 'IA de tanques alemanes.' },
    { id: TurnPhase.END_TURN_EVENTS, title: 'Fase 7: Eventos Fin de Turno', desc: 'Tirada 2d6 en tabla de misión.' },
  ];

  // Current tile terrain
  const shermanTileKey = `${sherman.coord.q},${sherman.coord.r}`;
  const currentTile = boardState.tiles.get(shermanTileKey);
  const currentTerrain = currentTile?.terrain || 'field';

  // Calculate dice pool
  const dicePoolConfig = boardState.missionData?.shermanDicePool;
  const dicePool = dicePoolConfig
    ? calculateShermanDicePool(currentTerrain, dicePoolConfig)
    : { maneuver: 1, attack: 2, misc: 2, total: 5 };

  const handleRollDice = () => {
    const diceCount = dicePool.total;
    const rolls: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    rolls.sort((a, b) => a - b);
    setRolledDice(rolls);
    addLogMessage(`🎲 Tirada de dados Sherman en ${currentTerrain.toUpperCase()}: [${rolls.join(', ')}]`);
  };

  const nextPhase = () => {
    const next = currentPhase >= 7 ? 1 : ((currentPhase + 1) as TurnPhase);
    setPhase(next);
    addLogMessage(`Avanzado a: ${phasesList.find((p) => p.id === next)?.title}`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
          🎲 Consola de Fases & Operaciones
        </h2>
        <button
          onClick={nextPhase}
          className="min-h-[48px] px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition"
        >
          Siguiente Fase ➔
        </button>
      </div>

      {/* Phase Stepper Selector */}
      <div className="grid grid-cols-7 gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
        {phasesList.map((p) => {
          const isActive = p.id === currentPhase;
          return (
            <button
              key={p.id}
              onClick={() => setPhase(p.id)}
              className={`min-h-[44px] py-2 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-lg font-extrabold'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title={p.desc}
            >
              <span>F{p.id}</span>
            </button>
          );
        })}
      </div>

      {/* Phase 1: Sherman Smoke Cleanup */}
      {currentPhase === TurnPhase.SHERMAN_SMOKE_CLEANUP && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-amber-400">Fase 1: Limpieza de Humo Sherman</div>
            <div className="text-xs text-slate-400 mt-1">Limpia el humo activo sobre la ficha del Sherman.</div>
          </div>
          <button
            onClick={runPhase1}
            className="min-h-[48px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            Ejecutar Fase 1
          </button>
        </div>
      )}

      {/* Phase 2: Commander Assignment */}
      {currentPhase === TurnPhase.COMMANDER_ASSIGNMENT && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="text-sm font-bold text-amber-400">Fase 2: Posición del Comandante</div>
          <div className="text-xs text-slate-400">
            Selecciona la posición operativa del Comandante en el Dashboard o utiliza estos accesos directos:
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => useGameStore.getState().setCommanderPosition('unhatched')}
              className={`flex-1 min-h-[48px] py-2 rounded-xl text-xs font-bold transition ${
                sherman.commanderPosition === 'unhatched'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Interior (I) - Protegido
            </button>
            <button
              onClick={() => useGameStore.getState().setCommanderPosition('hatched')}
              className={`flex-1 min-h-[48px] py-2 rounded-xl text-xs font-bold transition ${
                sherman.commanderPosition === 'hatched'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Asomado (A) - +1 Dado Mando
            </button>
          </div>
        </div>
      )}

      {/* Phase 3: Sherman Operations & Action Buttons */}
      {currentPhase === TurnPhase.SHERMAN_OPERATIONS && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Orden de Ejecución:</span>
              <button
                onClick={() => setExecutionOrder('MAV')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  executionOrder === 'MAV' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                [Maniobra ➔ Ataque ➔ Varios]
              </button>
              <button
                onClick={() => setExecutionOrder('AMV')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  executionOrder === 'AMV' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                [Ataque ➔ Maniobra ➔ Varios]
              </button>
            </div>

            <span className="text-slate-300 font-mono">
              Pool: {dicePool.maneuver}M / {dicePool.attack}A / {dicePool.misc}V ({dicePool.total} dados)
            </span>
          </div>

          {/* Dice Rolling & Result Badges */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleRollDice}
              className="min-h-[48px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
            >
              🎲 Tirar Reserva d6
            </button>

            {rolledDice.length > 0 && (
              <div className="flex gap-2">
                {rolledDice.map((val, idx) => (
                  <span
                    key={idx}
                    className="w-9 h-9 bg-slate-800 border-2 border-amber-500 rounded-xl text-amber-400 font-bold text-base flex items-center justify-center shadow"
                  >
                    {val}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tactical Action Buttons Panel */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Acciones Tácticas Sherman</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                onClick={moveShermanForward}
                disabled={sherman.isImmobilized}
                className="min-h-[48px] p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                🚗 Avanzar 1 Hex
              </button>

              <button
                onClick={() => rotateSherman(-1)}
                className="min-h-[48px] p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                ↺ Girar Izq (-60°)
              </button>

              <button
                onClick={() => rotateSherman(1)}
                className="min-h-[48px] p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                ↻ Girar Der (+60°)
              </button>

              <button
                onClick={loadCannon}
                disabled={sherman.isLoaded}
                className="min-h-[48px] p-2.5 bg-amber-950 hover:bg-amber-900 border border-amber-800 disabled:opacity-50 text-amber-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                ⚡ Cargar Cañón
              </button>

              {boardState.enemyTanks.length > 0 && (
                <button
                  onClick={() => {
                    const activeEnemy = boardState.enemyTanks.find((t) => t.status !== 'destroyed');
                    if (activeEnemy) fireMainGunAt(activeEnemy);
                  }}
                  disabled={!sherman.isLoaded}
                  className="min-h-[48px] p-2.5 bg-red-950 hover:bg-red-900 border border-red-800 disabled:opacity-50 text-red-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1"
                >
                  🎯 Disparar Cañón
                </button>
              )}

              <button
                onClick={toggleSmoke}
                className="min-h-[48px] p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
              >
                💨 Humo
              </button>

              <button
                onClick={toggleHullDown}
                className="min-h-[48px] p-2.5 bg-blue-950 hover:bg-blue-900 border border-blue-800 text-blue-400 rounded-xl text-xs font-bold transition"
              >
                🛡️ Desenfilada
              </button>

              {sherman.fireLevel > 0 && (
                <button
                  onClick={extinguishFire}
                  className="min-h-[48px] p-2.5 bg-red-950 hover:bg-red-900 border border-red-700 text-red-100 rounded-xl text-xs font-bold transition col-span-2 sm:col-span-1"
                >
                  🧯 Extinguir Fuego
                </button>
              )}

              {boardState.missionData?.specialRules?.disabledSherman && (
                <button
                  onClick={rescueCrew}
                  disabled={
                    boardState.missionData.specialRules.disabledSherman.rescued ||
                    sherman.coord.q !== boardState.missionData.specialRules.disabledSherman.hex.q ||
                    sherman.coord.r !== boardState.missionData.specialRules.disabledSherman.hex.r
                  }
                  className="min-h-[48px] p-2.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 disabled:opacity-50 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1"
                >
                  🛟 Rescatar Tripulación
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: German Smoke Cleanup */}
      {currentPhase === TurnPhase.GERMAN_SMOKE_CLEANUP && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-amber-400">Fase 4: Limpieza de Humo Alemán</div>
            <div className="text-xs text-slate-400 mt-1">Resetea el humo de los tanques enemigos.</div>
          </div>
          <button
            onClick={runPhase4}
            className="min-h-[48px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            Ejecutar Fase 4
          </button>
        </div>
      )}

      {/* Phase 5: Fire Check */}
      {currentPhase === TurnPhase.FIRE_CHECK && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-amber-400">Fase 5: Comprobación de Fuego</div>
            <div className="text-xs text-slate-400 mt-1">
              Fuego Sherman actual: 🔥 {sherman.fireLevel}
            </div>
          </div>
          <button
            onClick={runPhase5}
            className="min-h-[48px] px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            Ejecutar Fase 5 Fuego
          </button>
        </div>
      )}

      {/* Phase 6: German AI Operations */}
      {currentPhase === TurnPhase.GERMAN_OPERATIONS && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-red-400">Fase 6: Operaciones IA Alemana</div>
            <div className="text-xs text-slate-400 mt-1">
              Ordena y ejecuta secuencialmente las acciones de los tanques enemigos activos.
            </div>
          </div>
          <button
            onClick={runPhase6GermanAI}
            className="min-h-[48px] px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
          >
            🤖 Resolver IA Alemana
          </button>
        </div>
      )}

      {/* Phase 7: End of Turn Events */}
      {currentPhase === TurnPhase.END_TURN_EVENTS && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-amber-400">Fase 7: Eventos Fin de Turno</div>
            <div className="text-xs text-slate-400 mt-1">
              Resuelve la tirada 2d6 en la tabla de la misión y avanza al siguiente turno.
            </div>
          </div>
          <button
            onClick={() => runPhase7EndTurn()}
            className="min-h-[48px] px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
          >
            🎲 Resolver Evento 2d6
          </button>
        </div>
      )}
    </div>
  );
};

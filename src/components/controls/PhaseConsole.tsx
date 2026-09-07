import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { TurnPhase } from '../../types/game';
import { calculateSectionDice, getAvailableDoubles } from '../../core/rules/shermanOperations';
import { hexDistance } from '../../core/hex/math';
import { calculateHitDifficulty } from '../../core/rules/combat';

export const PhaseConsole: React.FC = () => {
  const {
    boardState,
    selectedTargetId,
    setSelectedTargetId,
    setPhase,
    addLogMessage,
    rescueCrew,
    selectOperationsOrder,
    rollSectionDice,
    executeManeuverForward,
    executeManeuverReverse,
    executeManeuverTurn,
    executeAttackLoad,
    executeAttackFireGun,
    executeAttackFireMG,
    executeMiscAction,
    advanceSection,
    runPhase1,
    runPhase4,
    runPhase5,
    runPhase6GermanAI,
    runPhase7EndTurn,
  } = useGameStore();



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
          {/* If no order chosen yet */}
          {(!boardState.shermanOperations?.order || boardState.shermanOperations?.status === 'order_selection') && (
            <div className="space-y-3">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">
                  Fase 3: Operaciones del Sherman - Elección del Orden de Secciones
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  El tipo de terreno inicial ({boardState.shermanOperations?.phaseStartTerrain?.toUpperCase() || currentTerrain.toUpperCase()}) determina la reserva de dados para todas las secciones. Selecciona el orden de activación para este turno:
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => selectOperationsOrder('MAV')}
                  className="min-h-[52px] p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-md flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-sm font-extrabold">1. MANIOBRA ➔ 2. ATAQUE ➔ 3. VARIOS</span>
                  <span className="text-[10px] text-amber-100 font-normal">Mover primero para posicionar el tanque o buscar cobertura</span>
                </button>
                <button
                  onClick={() => selectOperationsOrder('AMV')}
                  className="min-h-[52px] p-3 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition shadow-md flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-sm font-extrabold">1. ATAQUE ➔ 2. MANIOBRA ➔ 3. VARIOS</span>
                  <span className="text-[10px] text-red-100 font-normal">Disparar antes de mover o cambiar encaramiento</span>
                </button>
              </div>
            </div>
          )}

          {/* If order is chosen, show active section */}
          {boardState.shermanOperations?.order && boardState.shermanOperations?.status !== 'order_selection' && (
            <div className="space-y-4">
              {/* Section progress tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                <div className="flex gap-2 font-mono">
                  {(boardState.shermanOperations.order === 'MAV'
                    ? [
                        { key: 'maneuver', label: '1. Maniobra' },
                        { key: 'attack', label: '2. Ataque' },
                        { key: 'misc', label: '3. Varios' },
                      ]
                    : [
                        { key: 'attack', label: '1. Ataque' },
                        { key: 'maneuver', label: '2. Maniobra' },
                        { key: 'misc', label: '3. Varios' },
                      ]
                  ).map((sec, idx) => {
                    const isCurrent = boardState.shermanOperations?.sectionIndex === idx;
                    const isPast = (boardState.shermanOperations?.sectionIndex ?? 0) > idx;
                    return (
                      <span
                        key={sec.key}
                        className={`px-2.5 py-1 rounded-md font-bold ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                            : isPast
                            ? 'bg-slate-800 text-slate-400 line-through'
                            : 'bg-slate-900 text-slate-500'
                        }`}
                      >
                        {sec.label}
                      </span>
                    );
                  })}
                </div>
                <span className="text-slate-400 text-[11px]">
                  Terreno Inicial: <strong className="text-amber-400 uppercase">{boardState.shermanOperations.phaseStartTerrain}</strong>
                </span>
              </div>

              {/* If Phase Completed */}
              {boardState.shermanOperations.status === 'phase_completed' && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 text-center space-y-3">
                  <div className="text-emerald-400 font-bold text-sm">
                    ✅ ¡Todas las Secciones de Operaciones del Sherman han concluido!
                  </div>
                  <p className="text-xs text-slate-300">
                    Puedes avanzar a la siguiente fase del turno (Fase 4: Limpieza de Humo Alemán).
                  </p>
                  <button
                    onClick={nextPhase}
                    className="min-h-[48px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
                  >
                    Avanzar a Fase 4 (Humo Alemán) ➔
                  </button>
                </div>
              )}

              {/* Active Section Execution */}
              {boardState.shermanOperations.currentSection && boardState.shermanOperations.status !== 'phase_completed' && (
                (() => {
                  const section = boardState.shermanOperations.currentSection;
                  const diceInfo = calculateSectionDice(
                    section,
                    boardState.shermanOperations.phaseStartTerrain,
                    sherman,
                    boardState.missionData?.shermanDicePool
                  );
                  const availableDice = boardState.shermanOperations.availableDice;
                  const rolledDice = boardState.shermanOperations.rolledDice;
                  const hasRolled = boardState.shermanOperations.status === 'rolled';
                  const isImmobilizedSection = diceInfo.isImmobilized;
                  const doubles = getAvailableDoubles(section, availableDice, sherman);

                  // Count individual dice values
                  const countOf = (val: number) => availableDice.filter((d) => d === val).length;

                  // Target finders
                  const activeTanks = boardState.enemyTanks.filter((t) => t.status !== 'destroyed');
                  const chosenTarget =
                    activeTanks.find((t) => t.id === selectedTargetId) ||
                    activeTanks.find((t) => calculateHitDifficulty(sherman, t, boardState).hasLOS) ||
                    activeTanks[0];
                  const chosenTargetCalc = chosenTarget ? calculateHitDifficulty(sherman, chosenTarget, boardState) : null;
                  const adjacentInfantry = boardState.enemyInfantry.filter(
                    (inf) => inf.status !== 'eliminated' && hexDistance(sherman.coord, inf.coord) === 1
                  );

                  return (
                    <div className="space-y-4">
                      {/* Section Info Banner */}
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-amber-400">
                            {section === 'maneuver'
                              ? '🚗 SECCIÓN: MANIOBRA'
                              : section === 'attack'
                              ? '🎯 SECCIÓN: ATAQUE'
                              : '⚙️ SECCIÓN: VARIOS'}
                          </h4>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {diceInfo.explanation.join(' | ')}
                          </div>
                        </div>

                        {!hasRolled && !isImmobilizedSection && (
                          <button
                            onClick={() => rollSectionDice()}
                            className="min-h-[48px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
                          >
                            🎲 Tirar {diceInfo.totalDice} Dados d6
                          </button>
                        )}
                      </div>

                      {/* Immobilized Warning in Maneuver */}
                      {isImmobilizedSection && (
                        <div className="bg-amber-950/60 border border-amber-800 p-4 rounded-xl text-amber-300 text-xs space-y-2">
                          <p className="font-bold">⚠️ El Sherman se encuentra Inmovilizado.</p>
                          <p>Las reglas establecen que se debe saltar la sección de Maniobra si el tanque está inmovilizado.</p>
                          <button
                            onClick={advanceSection}
                            className="min-h-[44px] px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition"
                          >
                            Saltar Maniobra y Continuar ➔
                          </button>
                        </div>
                      )}

                      {/* Dice Tray (once rolled) */}
                      {hasRolled && (
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-semibold uppercase tracking-wider">
                              Dados Disponibles ({availableDice.length} restantes de {rolledDice.length}):
                            </span>
                            {availableDice.length === 0 && (
                              <span className="text-emerald-400 font-bold">¡Todos los dados han sido utilizados!</span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            {rolledDice.map((val, idx) => {
                              const isSpent = !availableDice.includes(val);
                              let actionLabel = '';
                              if (section === 'maneuver') {
                                if (val === 1) actionLabel = 'Retroceder';
                                else if (val <= 4) actionLabel = 'Girar';
                                else actionLabel = 'Mover';
                              } else if (section === 'attack') {
                                if (val <= 2) actionLabel = 'Cargar';
                                else if (val <= 4) actionLabel = 'MG Inf';
                                else actionLabel = 'Cañón';
                              } else if (section === 'misc') {
                                if (val === 1) actionLabel = 'DCP/Carga';
                                else if (val === 2) actionLabel = 'MG';
                                else if (val === 3) actionLabel = 'Giro/Mover';
                                else if (val === 4) actionLabel = 'Reparar';
                                else if (val === 5) actionLabel = 'Humo/Rep';
                                else if (val === 6) actionLabel = 'Extinguir';
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl border-2 transition ${
                                    isSpent
                                      ? 'bg-slate-950 border-slate-800 text-slate-600 opacity-40'
                                      : 'bg-slate-800 border-amber-500 text-amber-400 shadow-md'
                                  }`}
                                >
                                  <span className="text-lg font-extrabold leading-none">{val}</span>
                                  <span className="text-[9px] font-bold text-slate-300 mt-1 uppercase tracking-tighter text-center line-clamp-1">
                                    {actionLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Doubles Panel if available */}
                          {doubles.length > 0 && (
                            <div className="pt-2 border-t border-slate-800 space-y-1.5">
                              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                                ⚡ Opciones de Dobles Disponibles (descartan 2 dados iguales):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {doubles.map((dOpt, dIdx) => (
                                  <button
                                    key={dIdx}
                                    disabled={!dOpt.allowed}
                                    onClick={() => {
                                      if (dOpt.actionKey === 'double_move') {
                                        executeManeuverForward({ type: 'double', value: dOpt.value });
                                      } else if (dOpt.actionKey === 'double_turn_left') {
                                        executeManeuverTurn(-1, { type: 'double', value: dOpt.value });
                                      } else if (dOpt.actionKey === 'double_turn_right' || dOpt.actionKey === 'double_turn') {
                                        executeManeuverTurn(1, { type: 'double', value: dOpt.value });
                                      } else if (dOpt.actionKey === 'double_load') {
                                        executeAttackLoad({ type: 'double', value: dOpt.value });
                                      } else if (dOpt.actionKey === 'double_dcp') {
                                        if (chosenTarget) {
                                          executeAttackFireGun(chosenTarget, { type: 'double', value: dOpt.value });
                                        }
                                      } else if (dOpt.actionKey === 'double_hull_down') {
                                        executeMiscAction('hull_down', { type: 'double', value: dOpt.value });
                                      }
                                    }}
                                    className="min-h-[40px] px-3 py-1.5 bg-amber-950 hover:bg-amber-900 border border-amber-700 disabled:opacity-40 text-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                                    title={dOpt.requirementText}
                                  >
                                    <span>{dOpt.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tactical Action Buttons for MANEUVER */}
                      {hasRolled && section === 'maneuver' && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Acciones de Maniobra
                          </h5>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <button
                              onClick={() => executeManeuverForward()}
                              disabled={sherman.isImmobilized || (!availableDice.includes(5) && !availableDice.includes(6))}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>🚗 Avanzar 1 Hex</span>
                              <span className="text-[10px] text-amber-400 font-normal">
                                Dado 5 o 6 ({countOf(5) + countOf(6)} disp.)
                              </span>
                            </button>

                            <button
                              onClick={() => executeManeuverReverse()}
                              disabled={sherman.isImmobilized || !availableDice.includes(1)}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>🔙 Retroceder 1 Hex</span>
                              <span className="text-[10px] text-amber-400 font-normal">
                                Dado 1 ({countOf(1)} disp.)
                              </span>
                            </button>

                            <button
                              onClick={() => executeManeuverTurn(-1)}
                              disabled={!availableDice.includes(2) && !availableDice.includes(3) && !availableDice.includes(4)}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>↺ Girar Izq (-60°)</span>
                              <span className="text-[10px] text-amber-400 font-normal">
                                Dado 2, 3 o 4 ({countOf(2) + countOf(3) + countOf(4)} disp.)
                              </span>
                            </button>

                            <button
                              onClick={() => executeManeuverTurn(1)}
                              disabled={!availableDice.includes(2) && !availableDice.includes(3) && !availableDice.includes(4)}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>↻ Girar Der (+60°)</span>
                              <span className="text-[10px] text-amber-400 font-normal">
                                Dado 2, 3 o 4 ({countOf(2) + countOf(3) + countOf(4)} disp.)
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tactical Action Buttons for ATTACK */}
                      {hasRolled && section === 'attack' && (
                        <div className="space-y-3">
                          {/* Target Selector Banner */}
                          {activeTanks.length > 0 && (
                            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400 font-semibold uppercase tracking-wider">
                                  🎯 Objetivo Seleccionado para Disparar:
                                </span>
                                {chosenTarget && chosenTargetCalc && (
                                  <span className={chosenTargetCalc.hasLOS ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                    {chosenTargetCalc.hasLOS
                                      ? `LOS Despejada (Dif: ${chosenTargetCalc.totalDifficulty}+)`
                                      : `LOS Bloqueada (${chosenTargetCalc.losReason || 'Obstáculo'})`}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {activeTanks.map((tank) => {
                                  const calc = calculateHitDifficulty(sherman, tank, boardState);
                                  const isSelected = chosenTarget?.id === tank.id;
                                  return (
                                    <button
                                      key={tank.id}
                                      onClick={() => setSelectedTargetId(tank.id)}
                                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${
                                        isSelected
                                          ? 'bg-amber-600 text-white border-amber-400 shadow-md ring-2 ring-amber-500/50'
                                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                      }`}
                                    >
                                      <span>🎯 {tank.type.toUpperCase()} #{tank.spawnNumber || ''} ({tank.coord.q},{tank.coord.r})</span>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                          calc.hasLOS
                                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                            : 'bg-red-950 text-red-300 border border-red-800'
                                        }`}
                                      >
                                        {calc.hasLOS ? `Dif ${calc.totalDifficulty}+` : '❌ Sin LOS'}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Acciones de Ataque
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <button
                              onClick={() => executeAttackLoad()}
                              disabled={sherman.isLoaded || (!availableDice.includes(1) && !availableDice.includes(2))}
                              className="min-h-[48px] p-2.5 bg-amber-950 hover:bg-amber-900 border border-amber-800 disabled:opacity-40 text-amber-400 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>⚡ Cargar Cañón</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Dado 1 o 2 ({countOf(1) + countOf(2)} disp.) {sherman.isLoaded ? '(Ya cargado)' : ''}
                              </span>
                            </button>

                            <button
                              onClick={() => {
                                if (chosenTarget) executeAttackFireGun(chosenTarget);
                              }}
                              disabled={
                                !sherman.isLoaded ||
                                sherman.isTurretDamaged ||
                                !chosenTarget ||
                                !chosenTargetCalc?.hasLOS ||
                                (!availableDice.includes(5) && !availableDice.includes(6))
                              }
                              className="min-h-[48px] p-2.5 bg-red-950 hover:bg-red-900 border border-red-800 disabled:opacity-40 text-red-400 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>
                                🎯 Disparar a {chosenTarget ? `${chosenTarget.type.toUpperCase()} #${chosenTarget.spawnNumber || ''}` : 'Objetivo'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Dado 5 o 6 ({countOf(5) + countOf(6)} disp.) {
                                  sherman.isTurretDamaged
                                    ? '(Torreta averiada)'
                                    : !sherman.isLoaded
                                    ? '(Descargado)'
                                    : !chosenTarget
                                    ? '(Sin enemigo)'
                                    : !chosenTargetCalc?.hasLOS
                                    ? '(Sin visión)'
                                    : `(Dif ${chosenTargetCalc.totalDifficulty}+)`
                                }
                              </span>
                            </button>

                            <button
                              onClick={() => {
                                if (adjacentInfantry[0]) executeAttackFireMG(adjacentInfantry[0]);
                              }}
                              disabled={adjacentInfantry.length === 0 || (!availableDice.includes(3) && !availableDice.includes(4))}
                              className="min-h-[48px] p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>🔫 Disparar MG (7+ Infantería)</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Dado 3 o 4 ({countOf(3) + countOf(4)} disp.) {adjacentInfantry.length === 0 ? '(Sin inf. adyacente)' : ''}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tactical Action Buttons for MISC */}
                      {hasRolled && section === 'misc' && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Acciones de Varios
                          </h5>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {/* Die 1 options */}
                            <button
                              onClick={() => executeMiscAction('load', { type: 'single', value: 1 })}
                              disabled={!availableDice.includes(1) || sherman.isLoaded || sherman.crew.loader.status !== 'active'}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>⚡ Cargar (Cargador)</span>
                              <span className="text-[10px] text-amber-400 font-normal">Dado 1 ({countOf(1)} disp.)</span>
                            </button>

                            <button
                              onClick={() => {
                                if (chosenTarget) {
                                  executeMiscAction('dcp', { type: 'single', value: 1 }, { targetTank: chosenTarget });
                                }
                              }}
                              disabled={
                                !availableDice.includes(1) ||
                                !sherman.isLoaded ||
                                sherman.isTurretDamaged ||
                                sherman.crew.gunner.status !== 'active' ||
                                !chosenTarget ||
                                !chosenTargetCalc?.hasLOS
                              }
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>🎯 DCP (Artillero)</span>
                              <span className="text-[10px] text-amber-400 font-normal">
                                Dado 1 ({countOf(1)} disp.) {chosenTarget ? `➔ ${chosenTarget.type.toUpperCase()}` : ''}
                              </span>
                            </button>

                            {/* Die 2: MG */}
                            <button
                              onClick={() => {
                                if (adjacentInfantry[0]) {
                                  executeMiscAction('mg', { type: 'single', value: 2 }, { targetInfantry: adjacentInfantry[0] });
                                }
                              }}
                              disabled={!availableDice.includes(2) || adjacentInfantry.length === 0 || sherman.crew.assistant.status !== 'active'}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>🔫 MG (Asistente 7+)</span>
                              <span className="text-[10px] text-amber-400 font-normal">Dado 2 ({countOf(2)} disp.)</span>
                            </button>

                            {/* Die 3: Move or Turn */}
                            <button
                              onClick={() => executeMiscAction('move', { type: 'single', value: 3 })}
                              disabled={!availableDice.includes(3) || sherman.isImmobilized || sherman.crew.driver.status !== 'active'}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>🚗 Mover (Conductor)</span>
                              <span className="text-[10px] text-amber-400 font-normal">Dado 3 ({countOf(3)} disp.)</span>
                            </button>

                            <button
                              onClick={() => executeMiscAction('turn', { type: 'single', value: 3 }, { turnDelta: -1 })}
                              disabled={!availableDice.includes(3) || sherman.crew.driver.status !== 'active'}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>↺ Girar Izq (Conductor)</span>
                              <span className="text-[10px] text-amber-400 font-normal">Dado 3 ({countOf(3)} disp.)</span>
                            </button>

                            <button
                              onClick={() => executeMiscAction('turn', { type: 'single', value: 3 }, { turnDelta: 1 })}
                              disabled={!availableDice.includes(3) || sherman.crew.driver.status !== 'active'}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>↻ Girar Der (Conductor)</span>
                              <span className="text-[10px] text-amber-400 font-normal">Dado 3 ({countOf(3)} disp.)</span>
                            </button>

                            {/* Die 4 or 5: Repair */}
                            <button
                              onClick={() => {
                                const valToUse = availableDice.includes(4) ? 4 : 5;
                                executeMiscAction('repair', { type: 'single', value: valToUse });
                              }}
                              disabled={(!availableDice.includes(4) && !availableDice.includes(5)) || (!sherman.isTurretDamaged && !sherman.isImmobilized)}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>🔧 Reparar Daño</span>
                              <span className="text-[10px] text-amber-400 font-normal">
                                Dado 4 o 5 ({countOf(4) + countOf(5)} disp.)
                              </span>
                            </button>

                            {/* Die 5: Smoke */}
                            <button
                              onClick={() => executeMiscAction('smoke', { type: 'single', value: 5 })}
                              disabled={!availableDice.includes(5) || sherman.hasSmoke}
                              className="min-h-[48px] p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                            >
                              <span>💨 Humo Pantalla</span>
                              <span className="text-[10px] text-amber-400 font-normal">Dado 5 ({countOf(5)} disp.)</span>
                            </button>

                              {/* Die 6: Extinguish */}
                              <button
                                onClick={() => executeMiscAction('extinguish', { type: 'single', value: 6 })}
                                disabled={!availableDice.includes(6) || sherman.fireLevel <= 0}
                                className="min-h-[48px] p-2 bg-red-950 hover:bg-red-900 border border-red-800 disabled:opacity-40 text-red-200 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                              >
                                <span>🧯 Extinguir Fuego</span>
                                <span className="text-[10px] text-amber-400 font-normal">Dado 6 ({countOf(6)} disp.)</span>
                              </button>

                              {boardState.missionData?.specialRules?.disabledSherman && (
                                <button
                                  onClick={rescueCrew}
                                  disabled={
                                    boardState.missionData.specialRules.disabledSherman.rescued ||
                                    sherman.coord.q !== boardState.missionData.specialRules.disabledSherman.hex.q ||
                                    sherman.coord.r !== boardState.missionData.specialRules.disabledSherman.hex.r
                                  }
                                  className="min-h-[48px] p-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 disabled:opacity-50 text-emerald-300 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5"
                                >
                                  <span>🛟 Rescatar Sherman</span>
                                  <span className="text-[10px] text-emerald-400 font-normal">Objetivo Misión</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Advance / Finish Section Button */}
                        {hasRolled && (
                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                              Puedes finalizar en cualquier momento si no deseas usar más dados.
                            </span>
                            <button
                              onClick={advanceSection}
                              className="min-h-[44px] px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition"
                            >
                              Finalizar {section === 'maneuver' ? 'Maniobra' : section === 'attack' ? 'Ataque' : 'Varios'} y Continuar ➔
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        )}

      {/* Phase 4: German Smoke Cleanup */}
      {currentPhase === TurnPhase.GERMAN_SMOKE_CLEANUP && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-amber-400">Fase 4: Eliminar el Humo Alemán</div>
            <div className="text-xs text-slate-400 mt-1">
              Elimina los marcadores de humo de todos los tanques alemanes (las defensas de humo solo duran 1 turno).
            </div>
          </div>
          <button
            onClick={runPhase4}
            className="min-h-[48px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0"
          >
            <span>💨</span>
            <span>Ejecutar Fase 4</span>
          </button>
        </div>
      )}

      {/* Phase 5: Fire Check */}
      {currentPhase === TurnPhase.FIRE_CHECK && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <span>Fase 5: Comprobación del Nivel de Fuego</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${sherman.fireLevel > 0 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-slate-800 text-slate-400'}`}>
                  🔥 Fuego: {sherman.fireLevel}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {sherman.fireLevel > 0
                  ? `Se lanza 1d6 por nivel de fuego (${sherman.fireLevel}d6) y se toma la tirada MÁS BAJA en la tabla ¿Qué Daños?.`
                  : 'Nivel de fuego = 0. Esta fase se omite automáticamente y se avanza a la Fase 6.'}
              </div>
            </div>
            <button
              onClick={runPhase5}
              className={`min-h-[48px] px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition shrink-0 flex items-center justify-center gap-2 ${
                sherman.fireLevel > 0
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {sherman.fireLevel > 0 ? (
                <>
                  <span>🎲</span>
                  <span>Tirar {sherman.fireLevel}d6 y Resolver Fuego</span>
                </>
              ) : (
                <>
                  <span>Continuar a Fase 6 (Operaciones Alemanas)</span>
                  <span>➔</span>
                </>
              )}
            </button>
          </div>

          {sherman.fireLevel > 0 && (
            <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 text-[11px] space-y-1.5">
              <div className="font-semibold text-slate-300">
                Tabla Sherman "¿Qué Daños?" (resultado menor de los {sherman.fireLevel}d6):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center text-slate-300">
                <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                  <span className="text-red-400 font-bold block">1: Destruido</span>
                  <span className="text-[10px] text-slate-500">Fin de partida</span>
                </div>
                <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                  <span className="text-amber-400 font-bold block">2: Comprueba KIA</span>
                  <span className="text-[10px] text-slate-500">Tirada 1d6 bajas</span>
                </div>
                <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                  <span className="text-orange-400 font-bold block">3-4: +1 Fuego</span>
                  <span className="text-[10px] text-slate-500">El fuego se extiende</span>
                </div>
                <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                  <span className="text-yellow-400 font-bold block">5: Torreta Dañada</span>
                  <span className="text-[10px] text-slate-500">Impide disparar</span>
                </div>
                <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                  <span className="text-purple-400 font-bold block">6: Inmovilizado</span>
                  <span className="text-[10px] text-slate-500">Pierde desenfilada</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 6: German AI Operations */}
      {currentPhase === TurnPhase.GERMAN_OPERATIONS && (() => {
        const activeTanks = [...boardState.enemyTanks]
          .filter((t) => t.status !== 'destroyed')
          .sort((a, b) => {
            const distA = hexDistance(a.coord, sherman.coord);
            const distB = hexDistance(b.coord, sherman.coord);
            return distA - distB;
          });

        return (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-red-400 flex items-center gap-2">
                  <span>Fase 6: Operaciones de Tanques Alemanes</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-950 text-red-400 border border-red-800">
                    {activeTanks.length} activo(s)
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Activación en orden de proximidad al Sherman. Cada tanque tira dados según su terreno/daño y resuelve sus acciones en orden ascendente (Acción 1 &gt; Acción 2).
                </div>
              </div>
              <button
                onClick={runPhase6GermanAI}
                className="min-h-[48px] px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/40 transition flex items-center justify-center gap-2 shrink-0"
              >
                <span>🤖</span>
                <span>Resolver Operaciones Alemanas</span>
              </button>
            </div>

            {activeTanks.length > 0 ? (
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="text-[11px] font-semibold text-slate-400">
                  Orden de Activación (más cercano primero):
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeTanks.map((tank, idx) => {
                    const dist = hexDistance(tank.coord, sherman.coord);
                    const tile = boardState.tiles.get(`${tank.coord.q},${tank.coord.r}`);
                    const terrainName = tile?.terrain === 'road' ? 'Carretera (4d)' : tile?.terrain === 'mud' ? 'Barro (3d)' : 'Campo (4d)';
                    const statusText = tank.status === 'damaged' ? 'Dañado (2d)' : terrainName;

                    return (
                      <div
                        key={tank.id}
                        className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2"
                      >
                        <span className="font-bold text-amber-400">#{idx + 1}</span>
                        <span className="text-slate-200 font-semibold">{tank.type.toUpperCase()}</span>
                        <span className="text-slate-400">Dist: <strong className="text-slate-200">{dist}</strong></span>
                        <span className="text-slate-500">|</span>
                        <span className="text-amber-300/90 text-[11px]">{statusText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">
                No hay tanques alemanes activos en el mapa.
              </div>
            )}
          </div>
        );
      })()}

      {/* Phase 7: End of Turn Events */}
      {currentPhase === TurnPhase.END_TURN_EVENTS && (() => {
        const events = boardState.missionData?.endOfTurnEvents || [];

        return (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <span>Fase 7: Eventos de Fin de Turno</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800">
                    Turno {boardState.currentTurn}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Se lanzan 2d6 para determinar qué evento de la misión ocurre antes de avanzar al siguiente turno.
                </div>
              </div>
              <button
                onClick={() => runPhase7EndTurn()}
                className="min-h-[48px] px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-950/40 transition flex items-center justify-center gap-2 shrink-0"
              >
                <span>🎲</span>
                <span>Lanzar 2d6 y Resolver Evento</span>
              </button>
            </div>

            {events.length > 0 && (
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="text-[11px] font-semibold text-slate-400">
                  Tabla de Eventos de la Misión (Tirada 2d6):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pt-1">
                  {events.map((e, idx) => {
                    const range = e.rollMin === e.rollMax ? `${e.rollMin}` : `${e.rollMin}–${e.rollMax}`;
                    return (
                      <div
                        key={idx}
                        className="bg-slate-800/80 p-2 rounded-lg border border-slate-700 flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-amber-400">Dados {range}</span>
                          <span className="font-semibold text-slate-300">{e.type}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 line-clamp-2">{e.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

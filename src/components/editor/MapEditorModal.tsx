import React, { useState } from 'react';
import { Facing, MissionJSON, RawHexConfig, RawTerrainType } from '../../types/game';
import { autoFixMapConfig, validateMapConfig, ValidationResult, INDEX_TO_DIR, OPPOSITE_FACING } from '../../core/hex/mapValidator';
import { hexNeighbor } from '../../core/hex/math';
import { missions } from '../../data/missions';
import { HexBoard } from '../board/HexBoard';
import { loadMissionState } from '../../core/rules/missionLoader';
import { useGameStore } from '../../store/gameStore';

interface MapEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EditorTool = 'terrain' | 'treeline' | 'road' | 'blackSpot' | 'redSpot' | 'entry' | 'exit' | 'bridge';

const EMPTY_MISSION: MissionJSON = {
  id: 2,
  title: "Misión 2 - Escenario Personalizado",
  briefing: "Avanza según las órdenes y elimina a los enemigos.",
  grid: {
    orientation: "flat-topped",
    columns: [
      { col: 0, rows: 5 },
      { col: 1, rows: 6 },
      { col: 2, rows: 7 },
      { col: 3, rows: 7 },
      { col: 4, rows: 6 },
      { col: 5, rows: 5 },
    ]
  },
  victoryConditions: {
    destroyAllEnemiesOfType: ["PANZER_IV"],
    requireMapExit: true,
    exitHex: { q: 2, r: 0, col: 2, row: 0 }
  },
  defeatConditions: {
    shermanDestroyed: true,
    crewAllKIA: true
  },
  playerDeployment: {
    unit: "SHERMAN",
    hex: { col: 3, row: 6 },
    facing: 0,
    initialStatus: {
      loaded: false,
      fireLevel: 0,
      turretDamaged: false,
      immobilized: false,
      smoke: false,
      hullDown: false
    },
    crew: [
      { id: 1, name: "Comandante", position: "INTERIOR", kia: false },
      { id: 2, name: "Cargador", kia: false },
      { id: 3, name: "Artillero", kia: false },
      { id: 4, name: "Conductor", kia: false },
      { id: 5, name: "Asistente Conductor", kia: false }
    ]
  },
  enemyDeployment: {
    tanks: [
      { type: "PANZER_IV", spawnMethod: "RANDOM_UNIQUE_BLACK_NUMBERS", count: 2 }
    ],
    infantry: []
  },
  hexes: Array.from({ length: 36 }).map((_, idx) => {
    const colRanges = [
      { col: 0, rows: 5 },
      { col: 1, rows: 6 },
      { col: 2, rows: 7 },
      { col: 3, rows: 7 },
      { col: 4, rows: 6 },
      { col: 5, rows: 5 },
    ];
    let count = 0;
    for (const range of colRanges) {
      for (let r = 0; r < range.rows; r++) {
        if (count === idx) {
          return { col: range.col, row: r, terrain: "FIELD" };
        }
        count++;
      }
    }
    return { col: 0, row: 0, terrain: "FIELD" };
  }),
  shermanDicePool: missions[0].shermanDicePool,
  endOfTurnEvents: missions[0].endOfTurnEvents
};

export const MapEditorModal: React.FC<MapEditorModalProps> = ({ isOpen, onClose }) => {
  const [selectedMissionId, setSelectedMissionId] = useState<number>(1);
  const [mission, setMission] = useState<MissionJSON>(JSON.parse(JSON.stringify(missions[0])));
  const [activeTool, setActiveTool] = useState<EditorTool>('terrain');
  const [selectedTerrain, setSelectedTerrain] = useState<RawTerrainType>('FIELD');
  const [selectedEdgeDir, setSelectedEdgeDir] = useState<Facing>(1); // NE
  const [selectedSpotNum, setSelectedSpotNum] = useState<number>(1);
  const [selectedSpotFacing, setSelectedSpotFacing] = useState<Facing>(0);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const { loadMission, addLogMessage } = useGameStore();

  if (!isOpen) return null;

  const handleSelectMissionTemplate = (id: number) => {
    setSelectedMissionId(id);
    const target = missions.find((m) => m.id === id) || missions[0];
    setMission(JSON.parse(JSON.stringify(target)));
  };

  const validation: ValidationResult = validateMapConfig(mission);
  const previewState = loadMissionState(mission, { selectedBlackSpawns: [] });
  previewState.enemyTanks = []; // Ensure no dummy tanks hide spot badges in editor!

  const handleTileClick = (tile: { coord: { q: number; r: number } }) => {
    const hexes = mission.hexes || [];
    const updatedMission = JSON.parse(JSON.stringify(mission)) as MissionJSON;

    const targetQ = tile.coord.q;
    const targetR = tile.coord.r;

    if (activeTool === 'entry') {
      updatedMission.hexes = hexes.map((hex) => {
        const isTarget = hex.col === targetQ && hex.row === targetR;
        return {
          ...hex,
          isEntry: isTarget,
          entryFacing: isTarget ? selectedSpotFacing : undefined,
          isExit: isTarget ? false : hex.isExit,
        };
      });
      updatedMission.playerDeployment.hex = { col: targetQ, row: targetR };
      updatedMission.playerDeployment.facing = selectedSpotFacing;
      setMission(updatedMission);
      return;
    }

    if (activeTool === 'exit') {
      const exitFacing = selectedSpotFacing;
      updatedMission.hexes = hexes.map((hex) => {
        const isTarget = hex.col === targetQ && hex.row === targetR;
        return {
          ...hex,
          isExit: isTarget,
          exitFacing: isTarget ? exitFacing : (hex.isExit ? hex.exitFacing : undefined),
          isEntry: isTarget ? false : hex.isEntry,
        };
      });
      updatedMission.victoryConditions.exitHex = { q: targetQ, r: targetR, col: targetQ, row: targetR, facing: exitFacing };
      updatedMission.victoryConditions.exitFacing = exitFacing;
      updatedMission.victoryConditions.requireMapExit = true;
      setMission(updatedMission);
      return;
    }

    if (activeTool === 'redSpot') {
      const clickedHex = hexes.find((h) => h.col === targetQ && h.row === targetR);
      const isSameSpotNumber = clickedHex?.redSpot === selectedSpotNum;

      updatedMission.hexes = hexes.map((hex) => {
        const isTarget = hex.col === targetQ && hex.row === targetR;
        const newHex = { ...hex };

        // Clean up any duplicate of this spot number on any other hex
        if (newHex.redSpot === selectedSpotNum) {
          delete newHex.redSpot;
        }

        if (isTarget) {
          if (isSameSpotNumber) {
            delete newHex.redSpot;
          } else {
            newHex.redSpot = selectedSpotNum;
          }
        }
        return newHex;
      });

      if (!isSameSpotNumber) {
        setSelectedSpotNum((prev) => (prev >= 6 ? 1 : prev + 1));
      }

      setMission(updatedMission);
      return;
    }

    if (activeTool === 'blackSpot') {
      const clickedHex = hexes.find((h) => h.col === targetQ && h.row === targetR);
      const hasThisSpot = clickedHex?.blackSpot?.number === selectedSpotNum;
      const sameFacing = hasThisSpot && clickedHex?.blackSpot?.facing === selectedSpotFacing;

      updatedMission.hexes = hexes.map((hex) => {
        const isTarget = hex.col === targetQ && hex.row === targetR;
        const newHex = { ...hex };

        // Remove previous instance of this spot number elsewhere
        if (!isTarget && newHex.blackSpot?.number === selectedSpotNum) {
          delete newHex.blackSpot;
        }

        if (isTarget) {
          if (sameFacing) {
            delete newHex.blackSpot;
          } else {
            newHex.blackSpot = { number: selectedSpotNum, facing: selectedSpotFacing };
          }
        }
        return newHex;
      });

      if (!hasThisSpot) {
        setSelectedSpotNum((prev) => (prev >= 6 ? 1 : prev + 1));
      }

      setMission(updatedMission);
      return;
    }

    const dirIdx = selectedEdgeDir;
    const dirStr = INDEX_TO_DIR[dirIdx];
    const oppDirStr = INDEX_TO_DIR[OPPOSITE_FACING[dirIdx]];

    const neighborCoord = hexNeighbor({ q: targetQ, r: targetR }, dirIdx);

    // Determine toggled state for treeline or road
    let shouldAddEdge = false;
    const currentHex = hexes.find((h) => h.col === targetQ && h.row === targetR);
    if (activeTool === 'treeline') {
      shouldAddEdge = !currentHex?.treeLines?.includes(dirStr);
    } else if (activeTool === 'road') {
      shouldAddEdge = !currentHex?.roadEdges?.includes(dirStr);
    }

    updatedMission.hexes = hexes.map((hex) => {
      const isTarget = hex.col === targetQ && hex.row === targetR;
      const isNeighbor = hex.col === neighborCoord.q && hex.row === neighborCoord.r;

      if (!isTarget && !isNeighbor) return hex;

      const newHex: RawHexConfig = { ...hex };

      if (isTarget) {
        if (activeTool === 'terrain') {
          newHex.terrain = selectedTerrain;
          if (selectedTerrain === 'BUILDING') {
            newHex.hasBuilding = true;
            newHex.buildingType = 'TOWN';
            if (hex.terrain === 'WATER' || hex.terrain === 'WOODS') {
              newHex.terrain = 'FIELD';
            }
          } else {
            if (selectedTerrain === 'WATER' || selectedTerrain === 'WOODS') {
              newHex.hasBuilding = false;
            }
          }
          if (selectedTerrain !== 'WATER') {
            newHex.isBridge = false;
          }
        } else if (activeTool === 'bridge') {
          newHex.isBridge = !newHex.isBridge;
          if (newHex.isBridge) {
            newHex.terrain = 'WATER';
            newHex.hasBuilding = false;
          }
        } else if (activeTool === 'treeline') {
          const lines = newHex.treeLines ? [...newHex.treeLines] : [];
          if (shouldAddEdge) {
            if (!lines.includes(dirStr)) lines.push(dirStr);
          } else {
            newHex.treeLines = lines.filter((d) => d !== dirStr);
          }
          if (shouldAddEdge) newHex.treeLines = lines;
        } else if (activeTool === 'road') {
          const roads = newHex.roadEdges ? [...newHex.roadEdges] : [];
          if (shouldAddEdge) {
            if (!roads.includes(dirStr)) roads.push(dirStr);
          } else {
            newHex.roadEdges = roads.filter((d) => d !== dirStr);
          }
          if (shouldAddEdge) newHex.roadEdges = roads;
        }
      }

      // Automatic reciprocal update on neighbor hex for roads only (treelines are declared on single edge)
      if (isNeighbor) {
        if (activeTool === 'road') {
          const roads = newHex.roadEdges ? [...newHex.roadEdges] : [];
          if (shouldAddEdge) {
            if (!roads.includes(oppDirStr)) roads.push(oppDirStr);
          } else {
            newHex.roadEdges = roads.filter((d) => d !== oppDirStr);
          }
          if (shouldAddEdge) newHex.roadEdges = roads;
        }
      }

      return newHex;
    });

    setMission(updatedMission);
  };

  const handleAutoFix = () => {
    const fixed = autoFixMapConfig(mission);
    setMission(fixed);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(mission, null, 2));
    setCopiedMessage('¡JSON copiado al portapapeles!');
    setTimeout(() => setCopiedMessage(null), 2500);
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(mission, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mission${mission.id}.json`;
    a.click();
  };

  const handlePlayMission = () => {
    const fixed = autoFixMapConfig(mission);
    loadMission(fixed);
    addLogMessage(`🛠️ Misión ${fixed.id} ("${fixed.title}") cargada en el juego.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-4 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between border-b border-slate-800 pb-3 mb-3 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛠️</span>
          <div>
            <h2 className="text-xl font-bold text-amber-400">Editor de Misiones de Campaña (1 al 13)</h2>
            <p className="text-xs text-slate-400">Crea y edita mapas para la campaña con validación automática y exportación JSON.</p>
          </div>
        </div>

        {/* Campaign Mission Selector Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-semibold text-slate-300">Cargar Plantilla:</label>
          <select
            value={selectedMissionId}
            onChange={(e) => handleSelectMissionTemplate(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-amber-400 text-xs font-bold rounded px-2.5 py-1.5 focus:outline-none"
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                Misión {m.id}: {m.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              const empty = JSON.parse(JSON.stringify(EMPTY_MISSION));
              empty.id = selectedMissionId;
              empty.title = `Misión ${selectedMissionId} - Nuevo Escenario`;
              setMission(empty);
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700"
          >
            🧹 Vaciar Tablero
          </button>
          <button
            onClick={handleAutoFix}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded shadow transition"
          >
            ⚡ Auto-Corregir Red
          </button>
          <button
            onClick={handleCopyJSON}
            className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded shadow"
          >
            📋 Copiar JSON
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded shadow"
          >
            💾 Descargar mission{mission.id}.json
          </button>
          <button
            onClick={handlePlayMission}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded shadow transition"
          >
            ▶ Jugar Misión
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-white text-xs font-bold rounded ml-2"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      {copiedMessage && (
        <div className="bg-emerald-900/80 text-emerald-200 text-xs font-semibold py-1 px-3 rounded mb-2 text-center border border-emerald-700">
          {copiedMessage}
        </div>
      )}

      {/* Mission Metadata Fields */}
      <div className="bg-slate-900 border border-slate-800 p-2 rounded mb-2 grid grid-cols-12 gap-2 text-xs">
        <div className="col-span-2 flex items-center gap-1.5">
          <label className="font-bold text-slate-400">Misión #:</label>
          <input
            type="number"
            min={1}
            max={13}
            value={mission.id}
            onChange={(e) => setMission({ ...mission, id: Number(e.target.value) })}
            className="w-16 bg-slate-950 border border-slate-700 text-amber-400 font-bold px-2 py-1 rounded"
          />
        </div>
        <div className="col-span-4 flex items-center gap-1.5">
          <label className="font-bold text-slate-400">Título:</label>
          <input
            type="text"
            value={mission.title}
            onChange={(e) => setMission({ ...mission, title: e.target.value })}
            className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 px-2 py-1 rounded"
          />
        </div>
        <div className="col-span-6 flex items-center gap-1.5">
          <label className="font-bold text-slate-400">Briefing:</label>
          <input
            type="text"
            value={mission.briefing}
            onChange={(e) => setMission({ ...mission, briefing: e.target.value })}
            className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 px-2 py-1 rounded"
          />
        </div>
      </div>

      {/* Validation Status Banner */}
      <div className={`p-2.5 mb-2 rounded-lg border text-xs flex items-center justify-between ${validation.isValid ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300' : 'bg-rose-950/70 border-rose-700 text-rose-300'}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{validation.isValid ? '✓ MAPA VÁLIDO' : '⚠ ERRORES DE VALIDACIÓN DETECTADOS'}</span>
          <span className="opacity-80">({validation.issues.length} incidencias registradas)</span>
        </div>

        {validation.issues.length > 0 && (
          <div className="flex gap-1 overflow-x-auto max-w-xl">
            {validation.issues.slice(0, 2).map((issue, i) => (
              <span key={i} className="bg-slate-900/80 px-2 py-0.5 rounded text-[10px] truncate border border-slate-700">
                {issue.message}
              </span>
            ))}
            {validation.issues.length > 2 && (
              <span className="bg-slate-900/80 px-2 py-0.5 rounded text-[10px]">+{validation.issues.length - 2} más</span>
            )}
          </div>
        )}
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="col-span-3 bg-slate-900/90 border border-slate-800 rounded-lg p-3 overflow-y-auto space-y-4 text-xs">
          <div>
            <h3 className="font-bold text-amber-400 mb-2 uppercase text-[11px] tracking-wider">Modo de Edición</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'terrain', label: '🌾 Terreno Base' },
                  { id: 'bridge', label: '🌉 Puente' },
                  { id: 'treeline', label: '🌳 Arboleda' },
                  { id: 'road', label: '🛣️ Carretera' },
                  { id: 'blackSpot', label: '🎯 Spot Negro' },
                  { id: 'redSpot', label: '🔴 Spot Rojo' },
                  { id: 'entry', label: '📍 Entrada Sherman' },
                  { id: 'exit', label: '🏁 Salida Misión' },
                ] as const
              ).map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`py-2 px-2 rounded font-bold transition text-left border ${activeTool === tool.id ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtools Config */}
          {activeTool === 'terrain' && (
            <div>
              <h4 className="font-semibold text-slate-300 mb-1.5">Terreno Base del Hexágono:</h4>
              <div className="space-y-1">
                {(
                  [
                    { id: 'FIELD', label: '🌾 Campo (Verde)' },
                    { id: 'MUD', label: '🤎 Barro (Marrón)' },
                    { id: 'WOODS', label: '🌲 Bosque Frondoso (Verde Oscuro)' },
                    { id: 'WATER', label: '🌊 Agua (Impasable)' },
                    { id: 'BUILDING', label: '🏠 Pueblo / Edificio (en Campo/Barro)' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTerrain(t.id)}
                    className={`w-full py-1.5 px-2 rounded text-left font-medium border ${selectedTerrain === t.id ? 'bg-slate-700 border-amber-400 text-amber-300' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'bridge' && (
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-300">Puente sobre Agua:</h4>
              <p className="text-[11px] text-slate-400">
                Haz clic en cualquier hexágono de <b>Agua</b> para añadir un <b>Puente</b>. El puente conserva la carretera sobre el agua y permite el paso a los tanques.
              </p>
            </div>
          )}

          {(activeTool === 'treeline' || activeTool === 'road') && (
            <div>
              <h4 className="font-semibold text-slate-300 mb-1.5">Arista / Dirección:</h4>
              <div className="grid grid-cols-3 gap-1">
                {([0, 1, 2, 3, 4, 5] as Facing[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedEdgeDir(d)}
                    className={`py-1.5 rounded font-mono font-bold text-center border ${selectedEdgeDir === d ? 'bg-amber-600 border-amber-300 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                  >
                    {INDEX_TO_DIR[d]} ({d})
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Haz clic en cualquier hexágono para alternar {activeTool === 'treeline' ? 'la arboleda en esa arista' : 'el tramo de carretera sin cambiar el suelo base'}.
              </p>
            </div>
          )}

          {activeTool === 'blackSpot' && (
            <div className="space-y-2">
              <div>
                <h4 className="font-semibold text-slate-300 mb-1">Número de Spot (1-6):</h4>
                <div className="grid grid-cols-3 gap-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSelectedSpotNum(n)}
                      className={`py-1 rounded font-bold border ${selectedSpotNum === n ? 'bg-zinc-800 border-zinc-200 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      #{n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 mb-1">Encaramiento del Carro:</h4>
                <div className="grid grid-cols-3 gap-1">
                  {([0, 1, 2, 3, 4, 5] as Facing[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setSelectedSpotFacing(f)}
                      className={`py-1 rounded font-mono text-center border ${selectedSpotFacing === f ? 'bg-amber-600 border-amber-300 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      {INDEX_TO_DIR[f]} ({f})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTool === 'redSpot' && (
            <div>
              <h4 className="font-semibold text-slate-300 mb-1">Número de Spot Rojo (1-6):</h4>
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSelectedSpotNum(n)}
                    className={`py-1 rounded font-bold border ${selectedSpotNum === n ? 'bg-rose-700 border-rose-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                  >
                    #{n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'entry' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[11px] font-bold text-amber-400">📍 Entrada del Sherman:</div>
                <div className="text-slate-200 text-xs mt-1">
                  Posición:{' '}
                  <strong className="text-emerald-400">
                    ({(mission.playerDeployment.hex as any)?.col ?? (mission.playerDeployment.hex as any)?.q ?? 0},{' '}
                    {(mission.playerDeployment.hex as any)?.row ?? (mission.playerDeployment.hex as any)?.r ?? 0})
                  </strong>
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5">
                  Orientación: <strong>{mission.playerDeployment.facing !== undefined ? `${INDEX_TO_DIR[mission.playerDeployment.facing]} (${mission.playerDeployment.facing})` : 'Aleatoria (según spot)'}</strong>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 mb-1">Encaramiento Inicial del Sherman:</h4>
                <div className="grid grid-cols-3 gap-1">
                  {([0, 1, 2, 3, 4, 5] as Facing[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setSelectedSpotFacing(f);
                        const updated = JSON.parse(JSON.stringify(mission)) as MissionJSON;
                        updated.playerDeployment.facing = f;
                        setMission(updated);
                      }}
                      className={`py-1.5 rounded font-mono font-bold text-center border ${(mission.playerDeployment.facing ?? 0) === f ? 'bg-amber-600 border-amber-300 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                    >
                      {INDEX_TO_DIR[f]} ({f})
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Haz clic en cualquier casilla del mapa para <b>colocar o mover</b> la Entrada del Sherman a esa posición.
              </p>
            </div>
          )}

          {activeTool === 'exit' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[11px] font-bold text-rose-400">🏁 Salida de la Misión:</div>
                <div className="text-slate-200 text-xs mt-1">
                  Posición:{' '}
                  <strong className="text-emerald-400">
                    {mission.victoryConditions.exitHex
                      ? `(${(mission.victoryConditions.exitHex as any).col ?? (mission.victoryConditions.exitHex as any).q}, ${(mission.victoryConditions.exitHex as any).row ?? (mission.victoryConditions.exitHex as any).r})`
                      : 'No asignada'}
                  </strong>
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5">
                  Dirección de Salida:{' '}
                  <strong>
                    {INDEX_TO_DIR[((mission.victoryConditions.exitFacing ?? (mission.victoryConditions.exitHex as any)?.facing ?? 0) % 6) as Facing]} (
                    {mission.victoryConditions.exitFacing ?? (mission.victoryConditions.exitHex as any)?.facing ?? 0})
                  </strong>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 mb-1">Dirección / Arista de Salida:</h4>
                <div className="grid grid-cols-3 gap-1">
                  {([0, 1, 2, 3, 4, 5] as Facing[]).map((f) => {
                    const currentExitFacing = mission.victoryConditions.exitFacing ?? (mission.victoryConditions.exitHex as any)?.facing ?? 0;
                    return (
                      <button
                        key={f}
                        onClick={() => {
                          setSelectedSpotFacing(f);
                          const updated = JSON.parse(JSON.stringify(mission)) as MissionJSON;
                          updated.victoryConditions.exitFacing = f;
                          if (updated.victoryConditions.exitHex) {
                            (updated.victoryConditions.exitHex as any).facing = f;
                          }
                          if (updated.hexes) {
                            updated.hexes = updated.hexes.map((h) =>
                              h.isExit ? { ...h, exitFacing: f } : h
                            );
                          }
                          setMission(updated);
                        }}
                        className={`py-1.5 rounded font-mono font-bold text-center border ${
                          currentExitFacing === f
                            ? 'bg-rose-700 border-rose-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {INDEX_TO_DIR[f]} ({f})
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Haz clic en cualquier casilla del mapa para <b>colocar o mover</b> la casilla de Salida (flecha roja) hacia esa posición.
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">💡 Flujo de Trabajo:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Selecciona la plantilla (Misión 1 a 13).</li>
              <li>Pinta terreno base, carreteras, puentes y pueblos.</li>
              <li>Presiona <b>⚡ Auto-Corregir Red</b>.</li>
              <li>Descarga <b>mission{mission.id}.json</b>.</li>
            </ul>
          </div>
        </div>

        {/* Right Canvas / Map Display */}
        <div className="col-span-9 bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col justify-center items-center overflow-hidden relative">
          <HexBoard
            boardState={previewState}
            onTileSelect={handleTileClick}
          />
        </div>
      </div>
    </div>
  );
};

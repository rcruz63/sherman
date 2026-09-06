import React, { useState } from 'react';
import { Facing, MissionJSON, RawHexConfig, RawTerrainType } from '../../types/game';
import { autoFixMapConfig, validateMapConfig, ValidationResult, INDEX_TO_DIR } from '../../core/hex/mapValidator';
import { mission1Data } from '../../data/missions/mission1';
import { HexBoard } from '../board/HexBoard';
import { loadMissionState } from '../../core/rules/missionLoader';
import { useGameStore } from '../../store/gameStore';

interface MapEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EditorTool = 'terrain' | 'treeline' | 'road' | 'blackSpot' | 'redSpot' | 'entryExit';

const EMPTY_MISSION: MissionJSON = {
  id: 99,
  title: "Escenario Personalizado",
  briefing: "Escenario creado con el Editor de Mapas.",
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
    exitHex: { col: 2, row: 0 }
  },
  defeatConditions: {
    shermanDestroyed: true,
    crewAllKIA: true
  },
  playerDeployment: {
    unit: "SHERMAN",
    hex: { col: 5, row: 4 },
    facing: 5,
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
  shermanDicePool: mission1Data.shermanDicePool,
  endOfTurnEvents: mission1Data.endOfTurnEvents
};

export const MapEditorModal: React.FC<MapEditorModalProps> = ({ isOpen, onClose }) => {
  const [mission, setMission] = useState<MissionJSON>(JSON.parse(JSON.stringify(mission1Data)));
  const [activeTool, setActiveTool] = useState<EditorTool>('terrain');
  const [selectedTerrain, setSelectedTerrain] = useState<RawTerrainType>('FIELD');
  const [selectedEdgeDir, setSelectedEdgeDir] = useState<Facing>(1); // NE
  const [selectedSpotNum, setSelectedSpotNum] = useState<number>(1);
  const [selectedSpotFacing, setSelectedSpotFacing] = useState<Facing>(0);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const { loadMission, addLogMessage } = useGameStore();

  if (!isOpen) return null;

  const validation: ValidationResult = validateMapConfig(mission);
  const previewState = loadMissionState(mission, { selectedBlackSpawns: [1, 2] });

  const handleTileClick = (tile: { coord: { q: number; r: number } }) => {
    const hexes = mission.hexes || [];
    const updatedHexes = hexes.map((hex) => {
      if (hex.col !== tile.coord.q || hex.row !== tile.coord.r) return hex;

      const newHex: RawHexConfig = { ...hex };

      if (activeTool === 'terrain') {
        newHex.terrain = selectedTerrain;
        if (selectedTerrain === 'BUILDING') {
          newHex.hasBuilding = true;
          newHex.buildingType = 'TOWN';
        } else if (selectedTerrain !== 'ROAD') {
          newHex.hasBuilding = false;
        }
      } else if (activeTool === 'treeline') {
        const dirStr = INDEX_TO_DIR[selectedEdgeDir];
        const lines = newHex.treeLines ? [...newHex.treeLines] : [];
        if (lines.includes(dirStr)) {
          newHex.treeLines = lines.filter((d) => d !== dirStr);
        } else {
          newHex.treeLines = [...lines, dirStr];
        }
      } else if (activeTool === 'road') {
        const dirStr = INDEX_TO_DIR[selectedEdgeDir];
        const roads = newHex.roadEdges ? [...newHex.roadEdges] : [];
        if (roads.includes(dirStr)) {
          newHex.roadEdges = roads.filter((d) => d !== dirStr);
        } else {
          newHex.roadEdges = [...roads, dirStr];
          if (newHex.terrain !== 'BUILDING') {
            newHex.terrain = 'ROAD';
          }
        }
      } else if (activeTool === 'blackSpot') {
        if (newHex.blackSpot?.number === selectedSpotNum) {
          delete newHex.blackSpot;
        } else {
          newHex.blackSpot = { number: selectedSpotNum, facing: selectedSpotFacing };
        }
      } else if (activeTool === 'redSpot') {
        if (newHex.redSpot === selectedSpotNum) {
          delete newHex.redSpot;
        } else {
          newHex.redSpot = selectedSpotNum;
        }
      } else if (activeTool === 'entryExit') {
        if (!newHex.isEntry && !newHex.isExit) {
          newHex.isEntry = true;
        } else if (newHex.isEntry) {
          newHex.isEntry = false;
          newHex.isExit = true;
        } else {
          newHex.isExit = false;
        }
      }

      return newHex;
    });

    setMission({ ...mission, hexes: updatedHexes });
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
    a.download = `mision_personalizada_${Date.now()}.json`;
    a.click();
  };

  const handlePlayMission = () => {
    const fixed = autoFixMapConfig(mission);
    loadMission(fixed);
    addLogMessage(`🛠️ Escenario personalizado cargado en el juego.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-4 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛠️</span>
          <div>
            <h2 className="text-xl font-bold text-amber-400">Editor de Escenarios & Validador de Mapas</h2>
            <p className="text-xs text-slate-400">Diseña, edita y valida tableros hexagonales en tiempo real.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMission(JSON.parse(JSON.stringify(EMPTY_MISSION)))}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700"
          >
            🧹 Vaciar Tablero
          </button>
          <button
            onClick={() => setMission(JSON.parse(JSON.stringify(mission1Data)))}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700"
          >
            🏰 Cargar Misión 1
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
            💾 Descargar
          </button>
          <button
            onClick={handlePlayMission}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded shadow transition"
          >
            ▶ Jugar Mapa
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

      {/* Validation Status Banner */}
      <div className={`p-2.5 mb-3 rounded-lg border text-xs flex items-center justify-between ${validation.isValid ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300' : 'bg-rose-950/70 border-rose-700 text-rose-300'}`}>
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
                  { id: 'terrain', label: '🌾 Terreno' },
                  { id: 'treeline', label: '🌳 Arboleda' },
                  { id: 'road', label: '🛣️ Carretera' },
                  { id: 'blackSpot', label: '🎯 Spot Negro' },
                  { id: 'redSpot', label: '🔴 Spot Rojo' },
                  { id: 'entryExit', label: '🚪 Entr/Sal' },
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
              <h4 className="font-semibold text-slate-300 mb-1.5">Tipo de Terreno:</h4>
              <div className="space-y-1">
                {(
                  [
                    { id: 'FIELD', label: '🌾 Campo (Verde)' },
                    { id: 'ROAD', label: '🛣️ Carretera (Gris)' },
                    { id: 'MUD', label: '🤎 Barro (Marrón)' },
                    { id: 'WOODS', label: '🌲 Bosque (Verde Oscuro)' },
                    { id: 'BUILDING', label: '🏠 Pueblo / Edificio' },
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
                Haz clic en cualquier hexágono para alternar {activeTool === 'treeline' ? 'la arboleda en esa arista' : 'la conexión de carretera'}.
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

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">💡 Consejos:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Haz clic en un hexágono para aplicar el cambio.</li>
              <li>Usa <b>⚡ Auto-Corregir</b> para sincronizar automáticamente las arboledas compartidas.</li>
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

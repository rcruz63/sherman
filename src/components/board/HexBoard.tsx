import React, { useState, useRef } from 'react';
import { BoardHex, BoardState } from '../../types/game';
import { HexTileSvg } from './HexTileSvg';
import { EnemyTankTokenSvg, ShermanTokenSvg } from './UnitTokenSvg';
import { getHexCenter } from './hexSvgUtils';

interface HexBoardProps {
  boardState: BoardState;
  onTileSelect?: (tile: BoardHex) => void;
  selectedTile?: BoardHex | null;
}

export const HexBoard: React.FC<HexBoardProps> = ({
  boardState,
  onTileSelect,
  selectedTile,
}) => {
  const hexRadius = 46;
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute map bounding box
  const tilesArray = Array.from(boardState.tiles.values());
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  tilesArray.forEach((t) => {
    const center = getHexCenter(t.coord, hexRadius);
    if (center.x < minX) minX = center.x;
    if (center.x > maxX) maxX = center.x;
    if (center.y < minY) minY = center.y;
    if (center.y > maxY) maxY = center.y;
  });

  const padding = hexRadius * 0.95;
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const viewBoxWidth = maxX - minX + padding * 2;
  const viewBoxHeight = maxY - minY + padding * 2;

  // Mouse Drag / Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.5), 2.5));
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2.5));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="map-container relative w-full h-full min-h-[480px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl select-none touch-none flex flex-col justify-center items-center">
      {/* Floating Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-lg">
        <button
          onClick={zoomIn}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-lg font-bold text-lg transition min-h-[44px] min-w-[44px]"
          title="Zoom In (+)"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-lg font-bold text-lg transition min-h-[44px] min-w-[44px]"
          title="Zoom Out (-)"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-amber-400 rounded-lg font-semibold text-xs transition min-h-[44px] min-w-[44px]"
          title="Reset View"
        >
          1:1
        </button>
      </div>

      {/* Interactive Map Canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Hex Grid Tiles */}
          {tilesArray.map((tile) => (
            <HexTileSvg
              key={`${tile.coord.q},${tile.coord.r}`}
              tile={tile}
              radius={hexRadius}
              isSelected={selectedTile?.coord.q === tile.coord.q && selectedTile?.coord.r === tile.coord.r}
              onTileClick={(t) => onTileSelect?.(t)}
            />
          ))}

          {/* Enemy Tanks */}
          {boardState.enemyTanks.map((tank) => (
            <EnemyTankTokenSvg
              key={tank.id}
              coord={tank.coord}
              facing={tank.facing}
              radius={hexRadius}
              type={tank.type}
              spawnNumber={tank.spawnNumber}
              status={tank.status}
              hasSmoke={tank.hasSmoke}
              isHullDown={tank.isHullDown}
            />
          ))}

          {/* Player Sherman Tank */}
          {boardState.sherman && (
            <ShermanTokenSvg
              coord={boardState.sherman.coord}
              facing={boardState.sherman.facing}
              radius={hexRadius}
              isLoaded={boardState.sherman.isLoaded}
              fireLevel={boardState.sherman.fireLevel}
              hasSmoke={boardState.sherman.hasSmoke}
              isHullDown={boardState.sherman.isHullDown}
              isImmobilized={boardState.sherman.isImmobilized}
              isTurretDamaged={boardState.sherman.isTurretDamaged}
            />
          )}
        </g>
      </svg>
    </div>
  );
};

export default HexBoard;

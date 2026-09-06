import React from 'react';
import { BoardHex } from '../../types/game';
import { cornersToPolygonPoints, getFacingAngleDegrees, getHexCenter, getHexCorners, getHexEdgeEndpoints } from './hexSvgUtils';

interface HexTileSvgProps {
  tile: BoardHex;
  radius: number;
  isSelected?: boolean;
  onTileClick?: (tile: BoardHex) => void;
}

const TERRAIN_STYLES: Record<string, { fill: string; stroke: string; label: string }> = {
  field: { fill: '#1b3822', stroke: '#2e5a36', label: 'Campo' },
  road: { fill: '#27272a', stroke: '#52525b', label: 'Carretera' },
  mud: { fill: '#451a03', stroke: '#78350f', label: 'Barro' },
  woods: { fill: '#064e3b', stroke: '#059669', label: 'Bosque' },
  building: { fill: '#7f1d1d', stroke: '#dc2626', label: 'Edificio' },
  water: { fill: '#1e3a8a', stroke: '#3b82f6', label: 'Agua' },
};

export const HexTileSvg: React.FC<HexTileSvgProps> = ({
  tile,
  radius,
  isSelected,
  onTileClick,
}) => {
  const center = getHexCenter(tile.coord, radius);
  const corners = getHexCorners(center, radius);
  const pointsStr = cornersToPolygonPoints(corners);

  const terrainStyle = TERRAIN_STYLES[tile.terrain] || TERRAIN_STYLES.field;

  return (
    <g
      className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
      onClick={() => onTileClick?.(tile)}
    >
      {/* Base Hexagon Polygon */}
      <polygon
        points={pointsStr}
        fill={terrainStyle.fill}
        stroke={isSelected ? '#f59e0b' : terrainStyle.stroke}
        strokeWidth={isSelected ? 3.5 : 1.5}
      />

      {/* Road Center Paths & Dashed Centerline */}
      {tile.terrain === 'road' && (
        <g opacity={0.6}>
          {tile.roadEdges && tile.roadEdges.length > 0 ? (
            tile.roadEdges.map((dir) => {
              const { p1, p2 } = getHexEdgeEndpoints(corners, dir);
              const edgeMidX = (p1.x + p2.x) / 2;
              const edgeMidY = (p1.y + p2.y) / 2;
              return (
                <line
                  key={dir}
                  x1={center.x}
                  y1={center.y}
                  x2={edgeMidX}
                  y2={edgeMidY}
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="4,3"
                />
              );
            })
          ) : (
            <circle cx={center.x} cy={center.y} r={radius * 0.2} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3,3" />
          )}
        </g>
      )}

      {/* Terrain Icon / Texture Decoration */}
      {tile.terrain === 'woods' && (
        <g opacity={0.7} transform={`translate(${center.x}, ${center.y})`}>
          <circle cx={-8} cy={-4} r={8} fill="#10b981" />
          <circle cx={8} cy={-4} r={8} fill="#059669" />
          <circle cx={0} cy={-12} r={9} fill="#34d399" />
          <path d="M 0 -3 L -2 8 L 2 8 Z" fill="#022c22" />
        </g>
      )}

      {/* Building Silhouette (Houses / Town) */}
      {(tile.hasBuilding || tile.terrain === 'building') && (
        <g transform={`translate(${center.x}, ${center.y - 4})`}>
          {/* Main House */}
          <path d="M -12 6 L 0 -6 L 12 6 L 12 14 L -12 14 Z" fill="#b91c1c" stroke="#fca5a5" strokeWidth={1} />
          {/* Chimney */}
          <rect x={5} y={-4} width={3} height={6} fill="#7f1d1d" />
          {/* Door & Windows */}
          <rect x={-3} y={8} width={6} height={6} fill="#450a0a" />
          <rect x={-8} y={4} width={3} height={3} fill="#fef08a" />
          <rect x={5} y={4} width={3} height={3} fill="#fef08a" />
        </g>
      )}

      {/* Edge Treelines */}
      {tile.edges.map((edge, idx) => {
        if (edge !== 'treeline') return null;
        const { p1, p2 } = getHexEdgeEndpoints(corners, idx as any);
        return (
          <line
            key={idx}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#10b981"
            strokeWidth={6}
            strokeLinecap="round"
          />
        );
      })}

      {/* Black Spot Badge (Tanks) with Facing Arrow */}
      {tile.blackSpawnNumber !== undefined && (
        <g transform={`translate(${center.x - (tile.hasBuilding ? 16 : 0)}, ${center.y + (tile.hasBuilding ? 14 : 0)})`}>
          <circle cx={0} cy={0} r={11} fill="#09090b" stroke="#f4f4f5" strokeWidth={1.5} />
          <text x={0} y={4} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
            {tile.blackSpawnNumber}
          </text>
          {/* Facing Arrow Indicator */}
          {tile.blackSpawnFacing !== undefined && (
            <g transform={`rotate(${getFacingAngleDegrees(tile.blackSpawnFacing)})`}>
              <polygon points="0,-16 -4,-11 4,-11" fill="#facc15" stroke="#000000" strokeWidth={0.5} />
            </g>
          )}
        </g>
      )}

      {/* Red Spot Badge (Infantry) */}
      {tile.redSpawnNumber !== undefined && (
        <g transform={`translate(${center.x + (tile.hasBuilding ? 16 : 0)}, ${center.y + (tile.hasBuilding ? 14 : 0)})`}>
          <circle cx={0} cy={0} r={11} fill="#b91c1c" stroke="#fca5a5" strokeWidth={1.5} />
          <text x={0} y={4} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
            {tile.redSpawnNumber}
          </text>
        </g>
      )}

      {/* Entry Arrow Badge (Sherman Entry at 5,4) */}
      {tile.isEntryHex && (
        <g transform={`translate(${center.x}, ${center.y + radius * 0.45})`}>
          <rect x={-22} y={-8} width={44} height={16} rx={4} fill="#475569" stroke="#94a3b8" strokeWidth={1} opacity={0.95} />
          <text x={0} y={3} textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="bold">
            ENTRADA ➔
          </text>
        </g>
      )}

      {/* Exit Arrow Badge (Mission Exit at 2,0) */}
      {tile.isExitHex && (
        <g transform={`translate(${center.x}, ${center.y - radius * 0.45})`}>
          <rect x={-22} y={-8} width={44} height={16} rx={4} fill="#dc2626" stroke="#fca5a5" strokeWidth={1} opacity={0.95} />
          <text x={0} y={3} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
            ⬆ SALIDA
          </text>
        </g>
      )}

      {/* Column, Row Coordinate Label */}
      <text
        x={center.x}
        y={center.y - radius * 0.58}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="9"
        className="select-none font-mono opacity-80 pointer-events-none"
      >
        ({tile.coord.q},{tile.coord.r})
      </text>
    </g>
  );
};

export default HexTileSvg;

import React from 'react';
import { BoardHex } from '../../types/game';
import { cornersToPolygonPoints, getHexCenter, getHexCorners, getHexEdgeEndpoints } from './hexSvgUtils';

interface HexTileSvgProps {
  tile: BoardHex;
  radius: number;
  isSelected?: boolean;
  onTileClick?: (tile: BoardHex) => void;
}

const TERRAIN_STYLES: Record<string, { fill: string; stroke: string; label: string }> = {
  field: { fill: '#1b2a1e', stroke: '#2e4533', label: 'Campo' },
  road: { fill: '#334155', stroke: '#64748b', label: 'Carretera' },
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

      {/* Terrain Icon / Pattern Decoration */}
      {tile.terrain === 'woods' && (
        <g opacity={0.65} transform={`translate(${center.x}, ${center.y})`}>
          <circle cx={-6} cy={-4} r={7} fill="#10b981" />
          <circle cx={6} cy={-4} r={7} fill="#059669" />
          <circle cx={0} cy={-10} r={8} fill="#34d399" />
        </g>
      )}

      {tile.terrain === 'building' && (
        <g opacity={0.7} transform={`translate(${center.x - 8}, ${center.y - 8})`}>
          <path d="M 0 8 L 8 0 L 16 8 L 16 16 L 0 16 Z" fill="#ef4444" />
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
            strokeWidth={5}
            strokeLinecap="round"
          />
        );
      })}

      {/* Exit Marker */}
      {tile.isExitHex && (
        <g transform={`translate(${center.x}, ${center.y - 18})`}>
          <rect x={-18} y={-10} width={36} height={16} rx={4} fill="#059669" opacity={0.9} />
          <text x={0} y={2} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
            SALIDA
          </text>
        </g>
      )}

      {/* Black Spawn Number Badge (Tanks) */}
      {tile.blackSpawnNumber !== undefined && (
        <g transform={`translate(${center.x - 14}, ${center.y + 12})`}>
          <circle cx={0} cy={0} r={10} fill="#09090b" stroke="#a1a1aa" strokeWidth={1.5} />
          <text x={0} y={3.5} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
            {tile.blackSpawnNumber}
          </text>
        </g>
      )}

      {/* Red Spawn Number Badge (Infantry) */}
      {tile.redSpawnNumber !== undefined && (
        <g transform={`translate(${center.x + 14}, ${center.y + 12})`}>
          <circle cx={0} cy={0} r={10} fill="#991b1b" stroke="#fca5a5" strokeWidth={1.5} />
          <text x={0} y={3.5} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
            {tile.redSpawnNumber}
          </text>
        </g>
      )}

      {/* Axial Coordinates Label */}
      <text
        x={center.x}
        y={center.y - radius * 0.55}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="10"
        className="select-none font-mono opacity-80 pointer-events-none"
      >
        {tile.coord.q},{tile.coord.r}
      </text>
    </g>
  );
};

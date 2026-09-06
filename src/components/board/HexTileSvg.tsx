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

      {/* Water Waves Decoration */}
      {tile.terrain === 'water' && (
        <g opacity={0.6} transform={`translate(${center.x}, ${center.y})`}>
          <path d="M -16 -8 Q -8 -14 0 -8 Q 8 -2 16 -8" stroke="#60a5fa" strokeWidth={1.5} fill="none" />
          <path d="M -12 2 Q -4 -4 4 2 Q 12 8 20 2" stroke="#93c5fd" strokeWidth={1.5} fill="none" />
          <path d="M -18 12 Q -10 6 -2 12 Q 6 18 14 12" stroke="#60a5fa" strokeWidth={1.5} fill="none" />
        </g>
      )}

      {/* Bridge Support Structures over Water */}
      {tile.isBridge && (
        <g transform={`translate(${center.x}, ${center.y})`}>
          <rect x={-18} y={-14} width={36} height={5} rx={1} fill="#78350f" stroke="#451a03" strokeWidth={1} />
          <rect x={-18} y={9} width={36} height={5} rx={1} fill="#78350f" stroke="#451a03" strokeWidth={1} />
        </g>
      )}

      {/* Road Center Paths & Dashed Centerline (renders on road terrain and buildings with roads) */}
      {(tile.terrain === 'road' || tile.isBridge || (tile.roadEdges && tile.roadEdges.length > 0)) && (
        <g opacity={0.9}>
          {tile.roadEdges && tile.roadEdges.length > 0 ? (
            tile.roadEdges.map((dir) => {
              const { p1, p2 } = getHexEdgeEndpoints(corners, dir);
              const edgeMidX = (p1.x + p2.x) / 2;
              const edgeMidY = (p1.y + p2.y) / 2;
              return (
                <g key={dir}>
                  {/* Dark Asphalt Road Bed */}
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={edgeMidX}
                    y2={edgeMidY}
                    stroke="#27272a"
                    strokeWidth={10}
                    strokeLinecap="round"
                  />
                  {/* Yellow Dashed Centerline */}
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={edgeMidX}
                    y2={edgeMidY}
                    stroke="#fbbf24"
                    strokeWidth={2.5}
                    strokeDasharray="4,3"
                    strokeLinecap="round"
                  />
                </g>
              );
            })
          ) : (
            <circle cx={center.x} cy={center.y} r={radius * 0.2} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3,3" />
          )}
        </g>
      )}

      {/* Prominent Full WOODS Forest Interior Decoration */}
      {tile.terrain === 'woods' && (
        <g transform={`translate(${center.x}, ${center.y})`}>
          {/* Tree Trunks */}
          <rect x={-2} y={-4} width={4} height={14} fill="#451a03" />
          <rect x={-14} y={2} width={3} height={10} fill="#451a03" />
          <rect x={10} y={2} width={3} height={10} fill="#451a03" />
          <rect x={-10} y={10} width={3} height={8} fill="#451a03" />
          <rect x={6} y={10} width={3} height={8} fill="#451a03" />

          {/* Lush 3D Tree Crowns */}
          <circle cx={0} cy={-4} r={11} fill="#047857" stroke="#022c22" strokeWidth={0.75} />
          <circle cx={-12} cy={2} r={9} fill="#059669" stroke="#022c22" strokeWidth={0.75} />
          <circle cx={12} cy={2} r={9} fill="#10b981" stroke="#022c22" strokeWidth={0.75} />
          <circle cx={0} cy={-13} r={8} fill="#34d399" stroke="#022c22" strokeWidth={0.75} />
          <circle cx={-8} cy={10} r={8} fill="#065f46" stroke="#022c22" strokeWidth={0.75} />
          <circle cx={8} cy={10} r={8} fill="#047857" stroke="#022c22" strokeWidth={0.75} />
        </g>
      )}

      {/* Village / Town Top-Down Hipped Rooftops with Garden Trees */}
      {(tile.hasBuilding || tile.terrain === 'building') && (
        <g transform={`translate(${center.x}, ${center.y})`}>
          {/* Main House Roof 1 */}
          <g transform="translate(-6, -5) rotate(-12)">
            <rect x={-8} y={-6} width={16} height={12} rx={1} fill="#9a3412" stroke="#451a03" strokeWidth={0.5} />
            <path d="M -8 -6 L -2 0 L -8 6 M 8 -6 L 2 0 L 8 6 M -2 0 L 2 0" stroke="#7c2d12" strokeWidth={0.75} fill="none" />
            <polygon points="-8,-6 -2,0 2,0 8,-6" fill="#c2410c" opacity={0.7} />
            <polygon points="-8,6 -2,0 2,0 8,6" fill="#7c2d12" opacity={0.7} />
          </g>

          {/* House Roof 2 */}
          <g transform="translate(8, -6) rotate(18)">
            <rect x={-6} y={-7} width={12} height={14} rx={1} fill="#b45309" stroke="#451a03" strokeWidth={0.5} />
            <path d="M -6 -7 L 0 -2 L 6 -7 M -6 7 L 0 2 L 6 7 M 0 -2 L 0 2" stroke="#78350f" strokeWidth={0.75} fill="none" />
            <polygon points="-6,-7 0,-2 6,-7" fill="#d97706" opacity={0.7} />
            <polygon points="-6,7 0,2 6,7" fill="#78350f" opacity={0.7} />
          </g>

          {/* House Roof 3 */}
          <g transform="translate(-4, 7) rotate(6)">
            <rect x={-6} y={-4} width={12} height={8} rx={1} fill="#7c2d12" stroke="#451a03" strokeWidth={0.5} />
            <path d="M -6 -4 L -1 0 L -6 4 M 6 -4 L 1 0 L 6 4 M -1 0 L 1 0" stroke="#451a03" strokeWidth={0.5} fill="none" />
            <polygon points="-6,-4 -1,0 1,0 6,-4" fill="#9a3412" opacity={0.7} />
          </g>

          {/* Small Garden Trees & Hedges */}
          <circle cx={4} cy={6} r={3.5} fill="#10b981" stroke="#065f46" strokeWidth={0.5} />
          <circle cx={-13} cy={2} r={3.0} fill="#059669" stroke="#065f46" strokeWidth={0.5} />
          <circle cx={14} cy={5} r={2.5} fill="#34d399" stroke="#065f46" strokeWidth={0.5} />
        </g>
      )}

      {/* Edge Treelines: Neat 3D green sphere clusters */}
      {tile.edges.map((edge, idx) => {
        if (edge !== 'treeline') return null;
        const { p1, p2 } = getHexEdgeEndpoints(corners, idx as any);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const nx = -dy / (len || 1);
        const ny = dx / (len || 1);

        const numBushes = 4;
        const bushNodes = [];

        for (let i = 0; i <= numBushes; i++) {
          const t = i / numBushes;
          const cx = p1.x + t * dx;
          const cy = p1.y + t * dy;

          const offsetDist = Math.sin(t * Math.PI) * 1.5;
          const bx = cx + nx * offsetDist;
          const by = cy + ny * offsetDist;

          const r1 = 4.0 + (i % 2) * 1.0;
          const colors = ['#047857', '#059669', '#10b981', '#065f46'];
          const c1 = colors[i % colors.length];

          bushNodes.push(
            <circle key={i} cx={bx} cy={by} r={r1} fill={c1} stroke="#022c22" strokeWidth={0.5} opacity={0.95} />
          );
        }

        return (
          <g key={idx}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#022c22" strokeWidth={7} strokeLinecap="round" opacity={0.8} />
            {bushNodes}
          </g>
        );
      })}

      {/* Black Spot Badge (Tanks) with Facing Arrow */}
      {tile.blackSpawnNumber !== undefined && (
        <g transform={`translate(${center.x - (tile.hasBuilding ? 16 : 0)}, ${center.y + (tile.hasBuilding ? 14 : 0)})`}>
          <circle cx={0} cy={0} r={11} fill="#09090b" stroke="#f4f4f5" strokeWidth={1.5} />
          <text x={0} y={4} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
            {tile.blackSpawnNumber}
          </text>
          {/* Facing Arrow Indicator pointing to edge */}
          {tile.blackSpawnFacing !== undefined && (
            <g transform={`rotate(${getFacingAngleDegrees(tile.blackSpawnFacing)})`}>
              <polygon points="16,0 11,-4 11,4" fill="#facc15" stroke="#000000" strokeWidth={0.5} />
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

import React from 'react';
import { Facing } from '../../types/game';
import { getFacingAngleDegrees, getHexCenter } from './hexSvgUtils';
import { AxialCoord } from '../../types/game';

interface ShermanTokenProps {
  coord: AxialCoord;
  facing: Facing;
  radius: number;
  isLoaded?: boolean;
  fireLevel?: number;
  hasSmoke?: boolean;
  isHullDown?: boolean;
  isImmobilized?: boolean;
  isTurretDamaged?: boolean;
  onClick?: () => void;
}

interface EnemyTankTokenProps {
  coord: AxialCoord;
  facing: Facing;
  radius: number;
  type: string;
  spawnNumber?: number;
  status: 'operational' | 'damaged' | 'destroyed';
  hasSmoke?: boolean;
  isHullDown?: boolean;
  onClick?: () => void;
}

export const ShermanTokenSvg: React.FC<ShermanTokenProps> = ({
  coord,
  facing,
  radius,
  isLoaded,
  fireLevel = 0,
  hasSmoke,
  isHullDown,
  isImmobilized,
  isTurretDamaged,
  onClick,
}) => {
  const center = getHexCenter(coord, radius);
  const rotationDeg = getFacingAngleDegrees(facing);

  return (
    <g
      className="cursor-pointer transition-transform duration-300 hover:scale-105"
      transform={`translate(${center.x}, ${center.y})`}
      onClick={onClick}
    >
      {/* Smoke Cloud Overlay */}
      {hasSmoke && (
        <circle cx={0} cy={0} r={radius * 0.75} fill="#94a3b8" opacity={0.65} filter="blur(2px)" />
      )}

      {/* Tank Body Group rotated according to facing */}
      <g transform={`rotate(${rotationDeg})`}>
        {/* Tank Tracks */}
        <rect x={-14} y={-14} width={28} height={6} rx={2} fill="#1e293b" />
        <rect x={-14} y={8} width={28} height={6} rx={2} fill="#1e293b" />

        {/* Chassis */}
        <rect x={-12} y={-10} width={24} height={20} rx={3} fill="#4d7c0f" stroke="#a3e635" strokeWidth={1.5} />

        {/* Turret */}
        <circle cx={0} cy={0} r={8} fill="#365314" stroke="#84cc16" strokeWidth={1.5} />

        {/* Main Cannon Barrel */}
        <rect x={0} y={-2.5} width={18} height={5} rx={1} fill="#eab308" stroke="#ca8a04" strokeWidth={1} />

        {/* Facing Arrow Indicator */}
        <polygon points="18,0 14,-5 14,5" fill="#f59e0b" />
      </g>

      {/* Label Badge */}
      <rect x={-22} y={-24} width={44} height={14} rx={4} fill="#0f172a" stroke="#84cc16" strokeWidth={1} opacity={0.9} />
      <text x={0} y={-14} textAnchor="middle" fill="#a3e635" fontSize="9" fontWeight="bold">
        SHERMAN
      </text>

      {/* Status Badges */}
      <g transform="translate(0, 22)" className="text-[10px]">
        {fireLevel > 0 && (
          <text x={-14} y={0} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">
            🔥{fireLevel}
          </text>
        )}
        {isLoaded && (
          <text x={14} y={0} textAnchor="middle" fill="#eab308" fontSize="12" fontWeight="bold">
            ⚡
          </text>
        )}
        {isHullDown && (
          <text x={0} y={0} textAnchor="middle" fill="#3b82f6" fontSize="12" fontWeight="bold">
            🛡️
          </text>
        )}
      </g>

      {isTurretDamaged && (
        <circle cx={-12} cy={-12} r={4} fill="#ef4444" stroke="#ffffff" strokeWidth={1} />
      )}
      {isImmobilized && (
        <circle cx={12} cy={-12} r={4} fill="#f97316" stroke="#ffffff" strokeWidth={1} />
      )}
    </g>
  );
};

export const EnemyTankTokenSvg: React.FC<EnemyTankTokenProps> = ({
  coord,
  facing,
  radius,
  type,
  spawnNumber,
  status,
  hasSmoke,
  isHullDown,
  onClick,
}) => {
  const center = getHexCenter(coord, radius);
  const rotationDeg = getFacingAngleDegrees(facing);

  const isDestroyed = status === 'destroyed';
  const isDamaged = status === 'damaged';

  return (
    <g
      className="cursor-pointer transition-transform duration-300 hover:scale-105"
      transform={`translate(${center.x}, ${center.y})`}
      onClick={onClick}
    >
      {/* Smoke Cloud */}
      {hasSmoke && (
        <circle cx={0} cy={0} r={radius * 0.7} fill="#94a3b8" opacity={0.6} />
      )}

      {/* Destroyed Wreck Overlay */}
      {isDestroyed ? (
        <g>
          <circle cx={0} cy={0} r={16} fill="#451a03" stroke="#78350f" strokeWidth={2} />
          <text x={0} y={4} textAnchor="middle" fill="#ef4444" fontSize="16">
            💥
          </text>
        </g>
      ) : (
        /* Tank Body Group rotated according to facing */
        <g transform={`rotate(${rotationDeg})`}>
          {/* Tracks */}
          <rect x={-13} y={-13} width={26} height={5} rx={1.5} fill="#0f172a" />
          <rect x={-13} y={8} width={26} height={5} rx={1.5} fill="#0f172a" />

          {/* Body */}
          <rect
            x={-11}
            y={-9}
            width={22}
            height={18}
            rx={2}
            fill={isDamaged ? '#78350f' : '#991b1b'}
            stroke={isDamaged ? '#f97316' : '#fca5a5'}
            strokeWidth={1.5}
          />

          {/* Turret */}
          <circle cx={0} cy={0} r={7} fill="#450a0a" stroke="#ef4444" strokeWidth={1.5} />

          {/* Cannon */}
          <rect x={0} y={-2} width={16} height={4} rx={1} fill="#dc2626" />

          {/* Facing Arrow */}
          <polygon points="16,0 12,-4 12,4" fill="#ef4444" />
        </g>
      )}

      {/* Label Badge */}
      <rect x={-20} y={-24} width={40} height={14} rx={4} fill="#0f172a" stroke="#ef4444" strokeWidth={1} opacity={0.9} />
      <text x={0} y={-14} textAnchor="middle" fill="#fca5a5" fontSize="8" fontWeight="bold">
        {type === 'panzerIV' ? `Pz IV #${spawnNumber || ''}` : type}
      </text>

      {isHullDown && !isDestroyed && (
        <text x={0} y={22} textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">
          🛡️
        </text>
      )}
    </g>
  );
};

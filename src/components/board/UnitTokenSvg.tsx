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

  const normalizedType = type.toLowerCase();
  const isTiger = normalizedType.includes('tiger');
  const isPanzerIII = normalizedType.includes('panzeriii') || normalizedType === 'panzer_iii';

  // Display names and badge configuration
  let displayName = 'PANZER IV';
  let badgeWidth = 56;
  let badgeStroke = '#ef4444';
  let badgeTextColor = '#fca5a5';

  if (isTiger) {
    displayName = spawnNumber ? `TIGER I #${spawnNumber}` : 'TIGER I';
    badgeWidth = spawnNumber ? 54 : 46;
    badgeStroke = '#f59e0b';
    badgeTextColor = '#fde68a';
  } else if (isPanzerIII) {
    displayName = spawnNumber ? `PANZER III #${spawnNumber}` : 'PANZER III';
    badgeWidth = spawnNumber ? 64 : 56;
    badgeStroke = '#38bdf8';
    badgeTextColor = '#bae6fd';
  } else {
    displayName = spawnNumber ? `PANZER IV #${spawnNumber}` : 'PANZER IV';
    badgeWidth = spawnNumber ? 60 : 54;
    badgeStroke = '#ef4444';
    badgeTextColor = '#fca5a5';
  }

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
          {isTiger ? (
            /* ========================================================
               TIGER I - HEAVY TANK (Robust, wide, 88mm + double muzzle brake)
               ======================================================== */
            <g>
              {/* Heavy Tracks with tread notches */}
              <rect x={-17} y={-16} width={34} height={7} rx={2} fill="#18181b" stroke="#3f3f46" strokeWidth={0.8} />
              <line x1={-11} y1={-16} x2={-11} y2={-9} stroke="#52525b" strokeWidth={0.8} />
              <line x1={-5} y1={-16} x2={-5} y2={-9} stroke="#52525b" strokeWidth={0.8} />
              <line x1={1} y1={-16} x2={1} y2={-9} stroke="#52525b" strokeWidth={0.8} />
              <line x1={7} y1={-16} x2={7} y2={-9} stroke="#52525b" strokeWidth={0.8} />
              <line x1={13} y1={-16} x2={13} y2={-9} stroke="#52525b" strokeWidth={0.8} />

              <rect x={-17} y={9} width={34} height={7} rx={2} fill="#18181b" stroke="#3f3f46" strokeWidth={0.8} />
              <line x1={-11} y1={9} x2={-11} y2={16} stroke="#52525b" strokeWidth={0.8} />
              <line x1={-5} y1={9} x2={-5} y2={16} stroke="#52525b" strokeWidth={0.8} />
              <line x1={1} y1={9} x2={1} y2={16} stroke="#52525b" strokeWidth={0.8} />
              <line x1={7} y1={9} x2={7} y2={16} stroke="#52525b" strokeWidth={0.8} />
              <line x1={13} y1={9} x2={13} y2={16} stroke="#52525b" strokeWidth={0.8} />

              {/* Robust Boxy Hull */}
              <rect
                x={-15}
                y={-11.5}
                width={30}
                height={23}
                rx={2.5}
                fill={isDamaged ? '#78350f' : '#881337'}
                stroke={isDamaged ? '#f97316' : '#fda4af'}
                strokeWidth={1.8}
              />
              {/* Front Glacis Plate Divider */}
              <line x1={9} y1={-11.5} x2={9} y2={11.5} stroke={isDamaged ? '#ea580c' : '#fb7185'} strokeWidth={1} />
              {/* Rear Exhaust Vents */}
              <rect x={-14} y={-7} width={4.5} height={14} rx={1} fill="#4c0519" opacity={0.8} />

              {/* Heavy Horseshoe Turret */}
              <circle cx={0.5} cy={0} r={9.5} fill="#4c0519" stroke="#f43f5e" strokeWidth={1.8} />
              {/* Commander Cupola */}
              <circle cx={-2} cy={-5} r={3.2} fill="#18181b" stroke="#f43f5e" strokeWidth={1} />

              {/* 8.8 cm KwK 36 Heavy Cannon with Double-Baffle Muzzle Brake */}
              <rect x={6.5} y={-4} width={4} height={8} rx={1} fill="#e11d48" />
              <rect x={10.5} y={-2.5} width={15.5} height={5} rx={0.8} fill="#e11d48" stroke="#be123c" strokeWidth={0.5} />
              {/* Double Muzzle Brake */}
              <rect x={24} y={-4.5} width={4.5} height={9} rx={1} fill="#9f1239" stroke="#f43f5e" strokeWidth={1} />

              {/* Heavy Facing Arrow */}
              <polygon points="29.5,0 25.5,-4 25.5,4" fill="#fbbf24" />
            </g>
          ) : isPanzerIII ? (
            /* ========================================================
               PANZER III - LIGHT/MEDIUM TANK (Light, compact, 50mm gun)
               ======================================================== */
            <g>
              {/* Sleek Light Tracks */}
              <rect x={-11} y={-11} width={22} height={4.5} rx={1.5} fill="#0f172a" />
              <rect x={-11} y={6.5} width={22} height={4.5} rx={1.5} fill="#0f172a" />

              {/* Compact Hull */}
              <rect
                x={-9.5}
                y={-8}
                width={19}
                height={16}
                rx={2}
                fill={isDamaged ? '#78350f' : '#991b1b'}
                stroke={isDamaged ? '#f97316' : '#fca5a5'}
                strokeWidth={1.2}
              />
              {/* Rear Engine Deck */}
              <rect x={-8.5} y={-5} width={3.5} height={10} rx={0.5} fill="#450a0a" opacity={0.8} />

              {/* Compact Turret */}
              <circle cx={-0.5} cy={0} r={6} fill="#450a0a" stroke="#ef4444" strokeWidth={1.3} />
              {/* Small Cupola */}
              <circle cx={-2} cy={-2.5} r={2} fill="#0f172a" stroke="#ef4444" strokeWidth={0.8} />

              {/* 5.0 cm KwK 39 Slender Cannon */}
              <rect x={3.5} y={-2.5} width={3} height={5} rx={0.5} fill="#dc2626" />
              <rect x={6.5} y={-1.5} width={9.5} height={3} rx={0.5} fill="#dc2626" />

              {/* Facing Arrow */}
              <polygon points="17,0 13.5,-3 13.5,3" fill="#ef4444" />
            </g>
          ) : (
            /* ========================================================
               PANZER IV - STANDARD MEDIUM TANK (Matches Sherman scale, 75mm)
               ======================================================== */
            <g>
              {/* Standard Medium Tracks */}
              <rect x={-14} y={-13} width={28} height={5.5} rx={1.8} fill="#0f172a" stroke="#334155" strokeWidth={0.5} />
              <rect x={-14} y={7.5} width={28} height={5.5} rx={1.8} fill="#0f172a" stroke="#334155" strokeWidth={0.5} />

              {/* Standard Chassis (24x19, same proportion as Sherman 24x20) */}
              <rect
                x={-12}
                y={-9.5}
                width={24}
                height={19}
                rx={2.5}
                fill={isDamaged ? '#78350f' : '#991b1b'}
                stroke={isDamaged ? '#f97316' : '#fca5a5'}
                strokeWidth={1.5}
              />
              {/* Front Plate Accent */}
              <line x1={7.5} y1={-9.5} x2={7.5} y2={9.5} stroke={isDamaged ? '#ea580c' : '#fca5a5'} strokeWidth={0.8} opacity={0.6} />

              {/* Medium Turret with Cupola */}
              <circle cx={-0.5} cy={0} r={7.5} fill="#450a0a" stroke="#ef4444" strokeWidth={1.5} />
              <circle cx={-2.5} cy={-3.5} r={2.5} fill="#0f172a" stroke="#ef4444" strokeWidth={0.8} />

              {/* 7.5 cm KwK 40 Cannon with Muzzle Brake */}
              <rect x={4.5} y={-3} width={3.5} height={6} rx={0.6} fill="#dc2626" />
              <rect x={8} y={-2} width={12} height={4} rx={0.6} fill="#dc2626" />
              <rect x={18.5} y={-3} width={2.5} height={6} rx={0.6} fill="#7f1d1d" stroke="#ef4444" strokeWidth={0.6} />

              {/* Facing Arrow */}
              <polygon points="22.5,0 18.5,-3.8 18.5,3.8" fill="#ef4444" />
            </g>
          )}
        </g>
      )}

      {/* Label Badge with Tank Name */}
      <rect
        x={-badgeWidth / 2}
        y={-24}
        width={badgeWidth}
        height={13.5}
        rx={3.5}
        fill="#0f172a"
        stroke={badgeStroke}
        strokeWidth={1}
        opacity={0.92}
      />
      <text
        x={0}
        y={-14.5}
        textAnchor="middle"
        fill={badgeTextColor}
        fontSize={isPanzerIII && spawnNumber ? 6.8 : 7.2}
        fontWeight="bold"
        letterSpacing="0.2px"
      >
        {displayName}
      </text>

      {isHullDown && !isDestroyed && (
        <text x={0} y={22} textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">
          🛡️
        </text>
      )}
    </g>
  );
};

export interface EnemyInfantryTokenProps {
  coord: AxialCoord;
  radius: number;
  spawnNumber?: number;
  status: 'active' | 'eliminated';
  isObjective?: boolean;
  onClick?: () => void;
}

export const EnemyInfantryTokenSvg: React.FC<EnemyInfantryTokenProps> = ({
  coord,
  radius,
  spawnNumber,
  status,
  isObjective,
  onClick,
}) => {
  const center = getHexCenter(coord, radius);
  const isEliminated = status === 'eliminated';

  return (
    <g
      className="cursor-pointer transition-transform duration-300 hover:scale-105"
      transform={`translate(${center.x}, ${center.y})`}
      onClick={onClick}
    >
      {isEliminated ? (
        <g>
          <circle cx={0} cy={0} r={12} fill="#3f1d1d" stroke="#7f1d1d" strokeWidth={1.5} opacity={0.6} />
          <text x={0} y={4} textAnchor="middle" fill="#ef4444" fontSize="12">
            ☠️
          </text>
        </g>
      ) : (
        <g>
          {/* Soldier Silhouette Token */}
          <circle cx={0} cy={0} r={14} fill="#881337" stroke="#f43f5e" strokeWidth={1.5} />
          <text x={0} y={4} textAnchor="middle" fill="#ffe4e6" fontSize="13">
            💂
          </text>
          {/* Label Badge */}
          <rect x={-18} y={-22} width={36} height={12} rx={3} fill="#0f172a" stroke="#f43f5e" strokeWidth={1} opacity={0.9} />
          <text x={0} y={-13} textAnchor="middle" fill="#fecdd3" fontSize="8" fontWeight="bold">
            {isObjective ? 'OBJ INF' : `INF #${spawnNumber || ''}`}
          </text>
        </g>
      )}
    </g>
  );
};

export interface EnemyTruckTokenProps {
  coord: AxialCoord;
  facing: Facing;
  radius: number;
  status: 'operational' | 'damaged' | 'destroyed';
  onClick?: () => void;
}

export const EnemyTruckTokenSvg: React.FC<EnemyTruckTokenProps> = ({
  coord,
  facing,
  radius,
  status,
  onClick,
}) => {
  const center = getHexCenter(coord, radius);
  const rotationDeg = getFacingAngleDegrees(facing);
  const isDestroyed = status === 'destroyed';

  return (
    <g
      className="cursor-pointer transition-transform duration-300 hover:scale-105"
      transform={`translate(${center.x}, ${center.y})`}
      onClick={onClick}
    >
      {isDestroyed ? (
        <g>
          <circle cx={0} cy={0} r={14} fill="#451a03" stroke="#78350f" strokeWidth={1.5} />
          <text x={0} y={4} textAnchor="middle" fill="#ef4444" fontSize="14">
            💥
          </text>
        </g>
      ) : (
        <g transform={`rotate(${rotationDeg})`}>
          <rect x={-12} y={-8} width={24} height={16} rx={2} fill="#713f12" stroke="#eab308" strokeWidth={1.5} />
          <rect x={-10} y={-6} width={10} height={12} rx={1} fill="#854d0e" />
          <polygon points="12,0 8,-4 8,4" fill="#eab308" />
        </g>
      )}
      <rect x={-18} y={-22} width={36} height={12} rx={3} fill="#0f172a" stroke="#eab308" strokeWidth={1} opacity={0.9} />
      <text x={0} y={-13} textAnchor="middle" fill="#fef08a" fontSize="8" fontWeight="bold">
        CAMIÓN
      </text>
    </g>
  );
};


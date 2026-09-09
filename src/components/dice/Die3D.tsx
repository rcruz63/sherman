import React, { useMemo } from 'react';

interface Die3DProps {
  value: number; // 1 to 6
  isRolling?: boolean;
  size?: number; // In pixels, default 64
  colorTheme?: 'ivory' | 'red' | 'olive' | 'gold';
  onClick?: () => void;
  className?: string;
}

// 3D rotation angles to bring face N to the front
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

export const Die3D: React.FC<Die3DProps> = ({
  value,
  isRolling = false,
  size = 64,
  colorTheme = 'ivory',
  onClick,
  className = '',
}) => {
  const half = size / 2;
  const clampedVal = Math.min(6, Math.max(1, Math.round(value || 1)));

  // Random spin offsets generated per roll session
  const spinOffset = useMemo(() => {
    return {
      x: (Math.floor(Math.random() * 3) + 2) * 360,
      y: (Math.floor(Math.random() * 3) + 2) * 360,
    };
  }, [isRolling]);

  const targetRotation = FACE_ROTATIONS[clampedVal] || { x: 0, y: 0 };
  const currentX = isRolling ? targetRotation.x + spinOffset.x : targetRotation.x;
  const currentY = isRolling ? targetRotation.y + spinOffset.y : targetRotation.y;

  // Theme palettes
  const themeClasses = useMemo(() => {
    switch (colorTheme) {
      case 'red':
        return {
          faceBg: 'bg-gradient-to-br from-red-600 via-red-700 to-red-900 border border-red-500/70',
          pipBg: 'bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]',
          dieShadow: 'shadow-[0_12px_24px_rgba(153,27,27,0.4)]',
        };
      case 'olive':
        return {
          faceBg: 'bg-gradient-to-br from-emerald-800 via-stone-800 to-stone-900 border border-emerald-600/60',
          pipBg: 'bg-amber-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]',
          dieShadow: 'shadow-[0_12px_24px_rgba(6,78,59,0.4)]',
        };
      case 'gold':
        return {
          faceBg: 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 border border-amber-300/80',
          pipBg: 'bg-slate-950 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]',
          dieShadow: 'shadow-[0_12px_24px_rgba(245,158,11,0.4)]',
        };
      case 'ivory':
      default:
        return {
          faceBg: 'bg-gradient-to-br from-amber-50 via-slate-100 to-stone-300 border border-stone-300/90',
          pipBg: 'bg-stone-900 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.6)]',
          dieShadow: 'shadow-[0_12px_24px_rgba(0,0,0,0.5)]',
        };
    }
  }, [colorTheme]);

  // Standard 6-face pip positions
  const renderPips = (faceNum: number) => {
    const pipSize = Math.max(7, Math.round(size * 0.18));
    const pipClass = `rounded-full ${themeClasses.pipBg}`;

    switch (faceNum) {
      case 1:
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div style={{ width: pipSize * 1.3, height: pipSize * 1.3 }} className={`${pipClass} bg-red-600 shadow-md`} />
          </div>
        );
      case 2:
        return (
          <div className="w-full h-full p-2.5 flex flex-col justify-between">
            <div className="flex justify-end">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-start">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="w-full h-full p-2.5 flex flex-col justify-between">
            <div className="flex justify-end">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-center">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-start">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="w-full h-full p-2.5 flex flex-col justify-between">
            <div className="flex justify-between">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-between">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="w-full h-full p-2.5 flex flex-col justify-between">
            <div className="flex justify-between">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-center">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-between">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="w-full h-full p-2.5 flex flex-col justify-between">
            <div className="flex justify-between">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-between">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
            <div className="flex justify-between">
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
              <div style={{ width: pipSize, height: pipSize }} className={pipClass} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const faceCommon = `dice-face rounded-2xl ${themeClasses.faceBg} select-none overflow-hidden`;

  return (
    <div
      onClick={onClick}
      className={`dice-scene flex items-center justify-center cursor-pointer ${className}`}
      style={{ width: size + 16, height: size + 16 }}
      title={`Dado: ${clampedVal}`}
    >
      <div
        className={`dice-cube ${isRolling ? 'dice-rolling' : ''}`}
        style={{
          width: size,
          height: size,
          transform: `rotateX(${currentX}deg) rotateY(${currentY}deg)`,
        }}
      >
        {/* Face 1: Front */}
        <div
          className={faceCommon}
          style={{ transform: `rotateY(0deg) translateZ(${half}px)` }}
        >
          {renderPips(1)}
        </div>

        {/* Face 6: Back */}
        <div
          className={faceCommon}
          style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
        >
          {renderPips(6)}
        </div>

        {/* Face 2: Right */}
        <div
          className={faceCommon}
          style={{ transform: `rotateY(90deg) translateZ(${half}px)` }}
        >
          {renderPips(2)}
        </div>

        {/* Face 5: Left */}
        <div
          className={faceCommon}
          style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }}
        >
          {renderPips(5)}
        </div>

        {/* Face 3: Top */}
        <div
          className={faceCommon}
          style={{ transform: `rotateX(90deg) translateZ(${half}px)` }}
        >
          {renderPips(3)}
        </div>

        {/* Face 4: Bottom */}
        <div
          className={faceCommon}
          style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }}
        >
          {renderPips(4)}
        </div>
      </div>
    </div>
  );
};

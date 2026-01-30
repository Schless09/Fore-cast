'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PickedByTooltipProps {
  selectionCount: number;
  percentage: number;
  totalRosters: number;
  pickedByUsers: string[];
}

export function PickedByTooltip({ 
  selectionCount, 
  percentage, 
  totalRosters,
  pickedByUsers 
}: PickedByTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const colorClass = 
    selectionCount >= totalRosters * 0.75 ? 'text-casino-gold' :
    selectionCount >= totalRosters * 0.5 ? 'text-casino-green' :
    'text-casino-text';

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    });
    setIsVisible(true);
  };

  return (
    <>
      <span 
        className={`font-semibold cursor-pointer ${colorClass}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
      >
        {selectionCount}
      </span>
      <span className="text-casino-gray text-xs ml-1">
        ({percentage}%)
      </span>
      {mounted && isVisible && pickedByUsers.length > 0 && createPortal(
        <div 
          className="fixed z-[9999] px-3 py-2 bg-gray-900 border border-yellow-500/30 rounded-lg shadow-xl max-h-48 overflow-y-auto"
          style={{
            top: coords.y,
            left: coords.x,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-xs text-gray-400 mb-1 font-medium">Picked by:</div>
          <div className="flex flex-col gap-0.5">
            {pickedByUsers.map((username) => (
              <span key={username} className="text-sm text-white whitespace-nowrap">
                {username}
              </span>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

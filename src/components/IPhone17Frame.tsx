'use client';

import Image from 'next/image';
import { useState } from 'react';

interface IPhone17FrameProps {
  src: string;
  alt: string;
  className?: string;
  scale?: number;
  showReflection?: boolean;
  animate?: boolean;
}

export function IPhone17Frame({ 
  src, 
  alt, 
  className = '',
  scale = 0.55,
  showReflection = true,
  animate = true
}: IPhone17FrameProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className={`relative flex items-center justify-center min-h-[360px] ${className}`}>
      {/* Glow effect on hover */}
      <div 
        className={`absolute inset-0 transition-opacity duration-700 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[600px] bg-casino-gold/20 rounded-full blur-[100px]" />
      </div>

      <div 
        className={`relative ${animate ? 'transition-transform duration-700 ease-out' : ''} ${
          isHovered && animate ? 'scale-105 -translate-y-2' : ''
        }`}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Floating animation keyframes */}
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(1deg); }
          }
          
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }

          .float-animation {
            animation: float 6s ease-in-out infinite;
          }

          .shimmer {
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(255, 255, 255, 0.1) 50%,
              transparent 100%
            );
            background-size: 1000px 100%;
            animation: shimmer 3s infinite;
          }
        `}</style>

        {/* Phone Body */}
        <div className={`relative w-[400px] h-[868px] bg-gradient-to-b from-gray-900 via-black to-gray-950 rounded-[55px] shadow-2xl border-[12px] border-gray-900 overflow-hidden ${animate ? 'float-animation' : ''}`}>
          {/* Metallic edge highlights */}
          <div className="absolute inset-0 rounded-[55px] overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gray-600/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
            <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-gray-600/50 to-transparent" />
            <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-gray-600/50 to-transparent" />
          </div>

          {/* Dynamic Island */}
          <div className="absolute top-[2px] left-1/2 -translate-x-1/2 w-[110px] h-[32px] bg-black rounded-[18px] z-20 shadow-lg border border-gray-800/50">
            {/* Camera lens */}
            <div className="absolute top-1/2 left-[20%] -translate-y-1/2 w-[10px] h-[10px] bg-gradient-radial from-gray-700 to-gray-900 rounded-full">
              <div className="absolute top-[2px] left-[2px] w-[3px] h-[3px] bg-blue-400/30 rounded-full blur-[1px]" />
            </div>
            {/* Face ID sensors */}
            <div className="absolute top-1/2 right-[25%] -translate-y-1/2 flex gap-1">
              <div className="w-[4px] h-[4px] bg-red-500/20 rounded-full" />
              <div className="w-[4px] h-[4px] bg-red-500/20 rounded-full" />
            </div>
          </div>

          {/* Screen Content */}
          <div className="relative w-full h-full bg-black overflow-hidden">
            <Image
              src={src}
              alt={alt}
              width={800}
              height={1736}
              sizes="560px"
              quality={95}
              className="w-full h-full object-cover object-top"
              priority
            />
          </div>

          {/* Enhanced Screen Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/[0.03] pointer-events-none" />
          
          {/* Shimmer effect on hover */}
          {isHovered && (
            <div className="absolute inset-0 shimmer pointer-events-none" />
          )}

          {/* Screen edge highlight */}
          <div className="absolute inset-[2px] rounded-[48px] border border-white/[0.02] pointer-events-none" />
        </div>

        {/* Titanium Side Buttons with enhanced detail */}
        {/* Action Button */}
        <div className="absolute left-[-2px] top-[150px] w-[2px] h-[35px] bg-gradient-to-r from-gray-600 via-gray-700 to-gray-800 rounded-l-sm shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-l-sm" />
        </div>
        
        {/* Volume Buttons */}
        <div className="absolute left-[-2px] top-[200px] w-[2px] h-[28px] bg-gradient-to-r from-gray-600 via-gray-700 to-gray-800 rounded-l-sm shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-l-sm" />
        </div>
        <div className="absolute left-[-2px] top-[238px] w-[2px] h-[28px] bg-gradient-to-r from-gray-600 via-gray-700 to-gray-800 rounded-l-sm shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-l-sm" />
        </div>
        
        {/* Power Button */}
        <div className="absolute right-[-2px] top-[215px] w-[2px] h-[55px] bg-gradient-to-l from-gray-600 via-gray-700 to-gray-800 rounded-r-sm shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-r-sm" />
        </div>
        
        {/* Titanium Frame Highlight */}
        <div className="absolute inset-0 rounded-[55px] border border-gray-600/20 pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" />
      </div>

      {/* Reflection effect */}
      {showReflection && (
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[220px] h-[100px] opacity-20 blur-2xl"
          style={{ 
            transform: `translateX(-50%) scale(${scale})`,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)'
          }}
        />
      )}
    </div>
  );
}
'use client';

import { useEffect, useRef } from 'react';

interface ScoreGaugeProps {
  score: number;
  tier: string;
  animated?: boolean;
}

/**
 * @title Radial Score Gauge Component
 * @notice Beautiful animated gauge for credit score display
 * @dev Pure SVG implementation with smooth animations
 */
export function ScoreGauge({ score, tier, animated = true }: ScoreGaugeProps) {
  const circleRef = useRef<SVGCircleElement>(null);

  // Calculate gauge properties
  const size = 280;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Score is 0-100, gauge shows 0-180 degrees (semicircle filling upward)
  // Add safety check for undefined/null score
  const safeScore = score ?? 0;
  const percentage = Math.min(Math.max(safeScore, 0), 100);
  const offset = circumference - (percentage / 100) * (circumference * 0.5);

  // Get tier colors
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Platinum': return { primary: '#a78bfa', secondary: '#7c3aed', glow: 'rgba(167, 139, 250, 0.3)' };
      case 'Gold': return { primary: '#facc15', secondary: '#eab308', glow: 'rgba(250, 204, 21, 0.3)' };
      case 'Silver': return { primary: '#94a3b8', secondary: '#64748b', glow: 'rgba(148, 163, 184, 0.3)' };
      case 'Bronze': return { primary: '#fb923c', secondary: '#f97316', glow: 'rgba(251, 146, 60, 0.3)' };
      default: return { primary: '#737373', secondary: '#525252', glow: 'rgba(115, 115, 115, 0.3)' };
    }
  };

  const colors = getTierColor(tier);

  // Animate gauge on mount
  useEffect(() => {
    if (animated && circleRef.current) {
      circleRef.current.style.strokeDashoffset = `${circumference}`;

      requestAnimationFrame(() => {
        if (circleRef.current) {
          circleRef.current.style.transition = 'stroke-dashoffset 2s ease-out';
          circleRef.current.style.strokeDashoffset = `${offset}`;
        }
      });
    }
  }, [score, animated, circumference, offset]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-40"
        style={{
          background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          transform: 'scale(1.2)'
        }}
      />

      {/* SVG Gauge */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle (track) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#262626"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.5} ${circumference * 0.5}`}
        />

        {/* Progress circle */}
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#gradient-${tier})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.5} ${circumference * 0.5}`}
          strokeDashoffset={animated ? circumference : offset}
          style={{
            filter: `drop-shadow(0 0 8px ${colors.glow})`
          }}
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.secondary} />
            <stop offset="100%" stopColor={colors.primary} />
          </linearGradient>
        </defs>

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = -90 + (tick / 100) * 180;
          const radians = (angle * Math.PI) / 180;
          const x1 = size / 2 + (radius - strokeWidth / 2 - 5) * Math.cos(radians);
          const y1 = size / 2 + (radius - strokeWidth / 2 - 5) * Math.sin(radians);
          const x2 = size / 2 + (radius - strokeWidth / 2 - 12) * Math.cos(radians);
          const y2 = size / 2 + (radius - strokeWidth / 2 - 12) * Math.sin(radians);

          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#525252"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="text-7xl font-bold mb-1 transition-all duration-1000"
          style={{ color: colors.primary }}
        >
          {safeScore}
        </div>
        <div className="text-sm text-neutral-400 mb-2">/ 100</div>
        <div
          className="px-4 py-1.5 rounded-full text-sm font-semibold border"
          style={{
            color: colors.primary,
            backgroundColor: `${colors.glow}`,
            borderColor: colors.primary + '40'
          }}
        >
          {tier}
        </div>
      </div>

      {/* Score labels */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {/* 0 label (bottom left) */}
          <div className="absolute bottom-4 left-8 text-xs text-neutral-500 font-medium">
            0
          </div>
          {/* 50 label (bottom) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-neutral-500 font-medium">
            50
          </div>
          {/* 100 label (bottom right) */}
          <div className="absolute bottom-4 right-8 text-xs text-neutral-500 font-medium">
            100
          </div>
        </div>
      </div>
    </div>
  );
}

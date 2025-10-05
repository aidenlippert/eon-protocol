'use client';

import { useEffect, useState } from 'react';

interface ScoreGaugeProps {
  score: number;
  tier: string;
  animated?: boolean;
}

/**
 * @title Simple Vertical Score Gauge
 * @notice Clean vertical progress bar for credit score display
 */
export function ScoreGauge({ score, tier, animated = true }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const safeScore = score ?? 0;

  // Animate score counter
  useEffect(() => {
    if (!animated) {
      setDisplayScore(safeScore);
      return;
    }

    let currentScore = 0;
    const increment = safeScore / 50; // 50 steps
    const timer = setInterval(() => {
      currentScore += increment;
      if (currentScore >= safeScore) {
        setDisplayScore(safeScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(currentScore));
      }
    }, 20);

    return () => clearInterval(timer);
  }, [safeScore, animated]);

  // Get tier colors
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Platinum': return { primary: '#a78bfa', bg: 'bg-violet-500/20', border: 'border-violet-500' };
      case 'Gold': return { primary: '#facc15', bg: 'bg-yellow-400/20', border: 'border-yellow-400' };
      case 'Silver': return { primary: '#94a3b8', bg: 'bg-slate-400/20', border: 'border-slate-400' };
      case 'Bronze': return { primary: '#fb923c', bg: 'bg-orange-400/20', border: 'border-orange-400' };
      default: return { primary: '#737373', bg: 'bg-neutral-500/20', border: 'border-neutral-500' };
    }
  };

  const colors = getTierColor(tier);
  const percentage = Math.min(Math.max(displayScore, 0), 100);

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-8">
      {/* Score Number */}
      <div className="text-center">
        <div
          className="text-8xl font-bold mb-2 tabular-nums"
          style={{ color: colors.primary }}
        >
          {Math.round(displayScore)}
        </div>
        <div className="text-neutral-400 text-lg">out of 100</div>
      </div>

      {/* Vertical Progress Bar */}
      <div className="relative w-24 h-64 bg-neutral-800/50 rounded-full overflow-hidden border-2 border-neutral-700">
        {/* Fill */}
        <div
          className={`absolute bottom-0 left-0 right-0 ${colors.bg} border-t-2 ${colors.border} transition-all duration-1000 ease-out`}
          style={{
            height: `${percentage}%`,
            backgroundColor: `${colors.primary}20`,
            boxShadow: `0 0 20px ${colors.primary}40`
          }}
        >
          {/* Glow effect */}
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              background: `linear-gradient(to top, ${colors.primary}40, transparent)`
            }}
          />
        </div>

        {/* Score markers */}
        {[0, 25, 50, 75, 100].map((mark) => (
          <div
            key={mark}
            className="absolute left-0 right-0 h-0.5 bg-neutral-600"
            style={{ bottom: `${mark}%` }}
          >
            <span className="absolute -left-10 -top-2 text-xs text-neutral-500">
              {mark}
            </span>
          </div>
        ))}
      </div>

      {/* Tier Badge */}
      <div
        className="px-6 py-2 rounded-full text-lg font-semibold border-2 backdrop-blur-sm"
        style={{
          color: colors.primary,
          backgroundColor: `${colors.primary}15`,
          borderColor: colors.primary,
          boxShadow: `0 0 20px ${colors.primary}30`
        }}
      >
        {tier} Tier
      </div>
    </div>
  );
}

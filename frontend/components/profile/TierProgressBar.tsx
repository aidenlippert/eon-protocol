'use client';

import { motion } from 'framer-motion';
import { colors } from '@/lib/design-tokens';
import { TrendingUp } from 'lucide-react';

interface TierProgressBarProps {
  currentScore: number;
  currentTier: string;
}

/**
 * @title TierProgressBar Component
 * @notice Shows progress to next tier with points needed
 * @dev Implements gradient progress bar from UI_WIREFRAME.md
 */
export function TierProgressBar({ currentScore, currentTier }: TierProgressBarProps) {
  const tiers = [
    { name: 'Bronze', threshold: 0, color: '#fb923c' },
    { name: 'Silver', threshold: 600, color: '#94a3b8' },
    { name: 'Gold', threshold: 750, color: '#facc15' },
    { name: 'Platinum', threshold: 900, color: '#a78bfa' },
  ];

  const currentTierIndex = tiers.findIndex((t) => t.name === currentTier);
  const nextTier = tiers[currentTierIndex + 1];

  if (!nextTier) {
    // Already at max tier
    return (
      <div
        className="p-6 rounded-xl border"
        style={{
          background: colors.bg.glass,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(40px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-400 to-purple-500 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Congratulations! 🎉</h3>
            <p className="text-sm text-white/60">You've reached the highest tier</p>
          </div>
        </div>
      </div>
    );
  }

  const pointsNeeded = nextTier.threshold - currentScore;
  const currentTierThreshold = tiers[currentTierIndex].threshold;
  const tierRange = nextTier.threshold - currentTierThreshold;
  const progressInTier = currentScore - currentTierThreshold;
  const progressPercentage = (progressInTier / tierRange) * 100;

  return (
    <div
      className="p-6 rounded-xl border"
      style={{
        background: colors.bg.glass,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${nextTier.color}, ${nextTier.color}DD)`,
            }}
          >
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Next Tier: {nextTier.name}</h3>
            <p className="text-sm text-white/60">{pointsNeeded} points to go</p>
          </div>
        </div>

        <motion.div
          className="text-right"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.3 }}
        >
          <div className="text-2xl font-bold" style={{ color: nextTier.color }}>
            +{pointsNeeded}
          </div>
          <div className="text-xs text-white/50">points</div>
        </motion.div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full"
            style={{
              background: `linear-gradient(90deg, ${colors.accent.purple}, ${nextTier.color})`,
              boxShadow: `0 0 10px ${nextTier.color}`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>

        {/* Progress Labels */}
        <div className="flex justify-between mt-2 text-xs text-white/50">
          <span>{currentTier}</span>
          <span>{Math.round(progressPercentage)}%</span>
          <span>{nextTier.name}</span>
        </div>
      </div>

      {/* Benefit Preview */}
      <motion.div
        className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-xs text-white/60">
          <span className="font-semibold" style={{ color: nextTier.color }}>
            {nextTier.name} benefits:
          </span>{' '}
          Lower interest rates, higher borrow limits, and priority access to new features
        </p>
      </motion.div>
    </div>
  );
}

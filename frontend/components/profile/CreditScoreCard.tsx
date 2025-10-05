'use client';

import { motion } from 'framer-motion';
import { colors, typography } from '@/lib/design-tokens';
import { Award } from 'lucide-react';

interface CreditScoreCardProps {
  score: number;
  tier: string;
  animated?: boolean;
}

/**
 * @title CreditScoreCard Component
 * @notice Animated credit score display with tier badge
 * @dev Implements counter animation and gradient gauge from UI_WIREFRAME.md
 */
export function CreditScoreCard({ score, tier, animated = true }: CreditScoreCardProps) {
  const percentage = Math.min(Math.max(score / 10, 0), 100);

  const tierColors = {
    Bronze: { gradient: 'from-orange-500 to-orange-600', text: '#fb923c' },
    Silver: { gradient: 'from-slate-400 to-slate-500', text: '#94a3b8' },
    Gold: { gradient: 'from-yellow-400 to-yellow-500', text: '#facc15' },
    Platinum: { gradient: 'from-purple-400 to-purple-500', text: '#a78bfa' },
  };

  const tierConfig = tierColors[tier as keyof typeof tierColors] || tierColors.Bronze;

  return (
    <div
      className="relative p-8 rounded-2xl border overflow-hidden"
      style={{
        background: colors.bg.glass,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {/* Animated Background Gradient */}
      <motion.div
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`,
        }}
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-white/90">Your Credit Score</h2>

          {/* Tier Badge */}
          <motion.div
            className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${tierConfig.gradient}`}
            initial={animated ? { scale: 0, rotate: -180 } : {}}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
          >
            <Award className="h-4 w-4 text-white" />
            <span className="text-sm font-bold text-white">{tier}</span>
          </motion.div>
        </div>

        {/* Score Display */}
        <div className="text-center mb-8">
          <motion.div
            className="text-8xl font-bold mb-2"
            style={{ color: tierConfig.text, fontFamily: typography.fontFamily.sans }}
            initial={animated ? { opacity: 0, y: 20 } : {}}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {animated ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2 }}
              >
                <Counter from={0} to={score} duration={2} />
              </motion.span>
            ) : (
              score
            )}
          </motion.div>

          <motion.p
            className="text-white/60 text-lg"
            initial={animated ? { opacity: 0 } : {}}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            out of 1000
          </motion.p>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${tierConfig.gradient}`}
              initial={animated ? { width: 0 } : { width: `${percentage}%` }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
              style={{
                boxShadow: `0 0 20px ${tierConfig.text}`,
              }}
            />
          </div>

          {/* Percentage Label */}
          <motion.div
            className="mt-2 text-right text-sm text-white/60"
            initial={animated ? { opacity: 0 } : {}}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {Math.round(percentage)}% creditworthy
          </motion.div>
        </div>

        {/* Score Info */}
        <motion.div
          className="mt-6 pt-6 border-t border-white/10 text-center text-sm text-white/50"
          initial={animated ? { opacity: 0 } : {}}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          Based on 5 on-chain factors
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Counter animation component
 */
function Counter({ from, to, duration }: { from: number; to: number; duration: number }) {
  const [count, setCount] = React.useState(from);

  React.useEffect(() => {
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / (duration * 1000);

      if (progress < 1) {
        setCount(Math.floor(from + (to - from) * easeOutCubic(progress)));
        requestAnimationFrame(animate);
      } else {
        setCount(to);
      }
    };

    requestAnimationFrame(animate);
  }, [from, to, duration]);

  return <>{count}</>;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Import React for useState/useEffect
import React from 'react';

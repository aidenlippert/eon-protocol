'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import confetti from 'canvas-confetti';
import { colors, borderRadius, animation } from '@/lib/design-tokens';

interface SmartButtonProps {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  showConfetti?: boolean;
}

/**
 * @title SmartButton Component
 * @notice Interactive button with idle/loading/success states and confetti
 * @dev Foundation component reused across 6+ dashboard locations
 */
export function SmartButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  showConfetti = false,
}: SmartButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleClick = async () => {
    if (disabled || state === 'loading') return;

    setState('loading');

    try {
      await onClick?.();
      setState('success');

      // Trigger confetti if enabled
      if (showConfetti) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: [colors.accent.purple, colors.accent.blue, '#FFFFFF'],
        });
      }

      // Reset to idle after 2 seconds
      setTimeout(() => setState('idle'), 2000);
    } catch (error) {
      console.error('[SmartButton] Error:', error);
      setState('idle');
    }
  };

  // Size configurations
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  // Variant configurations
  const variantClasses = {
    primary: `
      bg-gradient-to-r from-[${colors.accent.purple}] to-[${colors.accent.blue}]
      text-white
      hover:shadow-[0_0_30px_rgba(185,92,255,0.4)]
    `,
    secondary: `
      bg-white/5
      text-white
      border border-white/10
      hover:bg-white/10
    `,
    outline: `
      bg-transparent
      text-white
      border border-white/20
      hover:border-white/40
      hover:bg-white/5
    `,
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={`
        relative
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        rounded-xl
        font-semibold
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        overflow-hidden
        ${className}
      `}
      whileHover={state === 'idle' ? { scale: 1.02 } : {}}
      whileTap={state === 'idle' ? { scale: 0.98 } : {}}
      style={
        variant === 'primary'
          ? {
              background: state === 'success'
                ? colors.status.success
                : colors.accent.gradient,
            }
          : {}
      }
    >
      {/* Glow effect on hover (idle state only) */}
      {state === 'idle' && variant === 'primary' && (
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: colors.accent.gradientHover,
          }}
        />
      )}

      {/* Content */}
      <div className="relative flex items-center justify-center gap-2">
        {/* Loading spinner */}
        {state === 'loading' && (
          <motion.div
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}

        {/* Success checkmark */}
        {state === 'success' && (
          <motion.svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </motion.svg>
        )}

        {/* Button text */}
        <span className={state === 'loading' ? 'opacity-70' : ''}>
          {state === 'success' ? 'Success!' : children}
        </span>
      </div>

      {/* Shimmer effect for primary variant */}
      {variant === 'primary' && state === 'idle' && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: 'linear',
          }}
        />
      )}
    </motion.button>
  );
}

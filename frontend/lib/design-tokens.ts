/**
 * @title Design System Tokens
 * @notice Centralized design tokens for EON Protocol credit dashboard
 * @dev Based on UI_WIREFRAME.md specifications
 */

export const colors = {
  bg: {
    primary: '#0A0A0B',
    secondary: '#141416',
    glass: 'rgba(20, 20, 22, 0.7)',
    card: 'rgba(26, 26, 28, 0.8)',
  },
  accent: {
    gradient: 'linear-gradient(135deg, #B95CFF 0%, #5AA9FF 100%)',
    gradientHover: 'linear-gradient(135deg, #C76DFF 0%, #6BB9FF 100%)',
    purple: '#B95CFF',
    blue: '#5AA9FF',
  },
  tier: {
    bronze: '#fb923c',
    silver: '#94a3b8',
    gold: '#facc15',
    platinum: '#a78bfa',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.6)',
    muted: 'rgba(255, 255, 255, 0.4)',
  },
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: 'var(--font-geist-sans)',
    mono: 'var(--font-geist-mono)',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '8xl': '6rem',    // 96px (score display)
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

export const borderRadius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  full: '9999px',  // pill shape
} as const;

export const animation = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const glassmorphism = {
  blur: 'backdrop-blur-xl',
  bg: 'bg-white/[0.02]',
  border: 'border border-white/10',
  shadow: 'shadow-2xl',
} as const;

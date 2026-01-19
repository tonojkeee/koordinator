/**
 * Design System - Effects Tokens
 * 
 * Современные визуальные эффекты для создания интерактивности и глубины.
 * Минималистичный подход без перегрузки интерфейса.
 */

export const effects = {
  // Transitions - плавные переходы
  transition: {
    fast: 'transition-all duration-150 ease-out',
    normal: 'transition-all duration-200 ease-out',
    slow: 'transition-all duration-300 ease-out',
    colors: 'transition-colors duration-200 ease-out',
    transform: 'transition-transform duration-200 ease-out',
  },
  
  // Hover effects - интерактивность
  hover: {
    lift: 'hover:-translate-y-0.5 hover:shadow-md',
    scale: 'hover:scale-105',
    glow: 'hover:ring-2 hover:ring-indigo-500/20',
    brighten: 'hover:brightness-110',
  },
  
  // Active states
  active: {
    scale: 'active:scale-95',
    press: 'active:translate-y-0.5',
  },
  
  // Backdrop effects - минимальные
  backdrop: {
    blur: 'backdrop-blur-sm',
    overlay: 'bg-slate-900/20',
  },
  
  // Border radius - современные скругления
  radius: {
    none: 'rounded-none',
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    full: 'rounded-full',
  },
  
  // Animations
  animate: {
    fadeIn: 'animate-in fade-in duration-300',
    slideIn: 'animate-in slide-in-from-bottom-4 duration-300',
    scaleIn: 'animate-in zoom-in-95 duration-200',
    spin: 'animate-spin',
    pulse: 'animate-pulse',
  },
} as const;

export type EffectsToken = typeof effects;
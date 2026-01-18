/**
 * Design System - Typography Tokens
 * 
 * Стандартизированные типографические стили для всего приложения.
 */

export const typography = {
  heading: {
    primary: 'text-xl font-black text-slate-900 leading-none tracking-tight',
    secondary: 'text-lg font-bold text-slate-800',
  },
  subheading: 'text-[10px] font-bold text-slate-400 uppercase tracking-widest',
  body: {
    primary: 'text-sm font-medium text-slate-900',
    secondary: 'text-sm text-slate-700',
    tertiary: 'text-sm text-slate-500',
    muted: 'text-xs text-slate-400',
  },
} as const;

export type TypographyToken = typeof typography;

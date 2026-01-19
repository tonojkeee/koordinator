/**
 * Design System - Typography Tokens
 * 
 * Современная типографическая система с четкой иерархией и улучшенной читаемостью.
 * Основана на принципах современного веб-дизайна.
 */

export const typography = {
  // Display - для больших заголовков
  display: {
    large: 'text-4xl font-black text-slate-900 leading-tight tracking-tight',
    medium: 'text-3xl font-black text-slate-900 leading-tight tracking-tight',
    small: 'text-2xl font-black text-slate-900 leading-tight tracking-tight',
  },
  
  // Headings - четкая иерархия
  heading: {
    h1: 'text-2xl font-bold text-slate-900 leading-tight tracking-tight',
    h2: 'text-xl font-bold text-slate-900 leading-tight tracking-tight',
    h3: 'text-lg font-semibold text-slate-900 leading-tight',
    h4: 'text-base font-semibold text-slate-900 leading-tight',
    h5: 'text-sm font-semibold text-slate-900 leading-tight',
    h6: 'text-xs font-semibold text-slate-900 leading-tight',
  },
  
  // Body text - улучшенная читаемость
  body: {
    large: 'text-base font-normal text-slate-700 leading-relaxed',
    medium: 'text-sm font-normal text-slate-700 leading-relaxed',
    small: 'text-xs font-normal text-slate-600 leading-relaxed',
  },
  
  // Labels и UI элементы
  label: {
    large: 'text-sm font-medium text-slate-900',
    medium: 'text-xs font-medium text-slate-900',
    small: 'text-xs font-medium text-slate-700',
  },
  
  // Caption и вспомогательный текст
  caption: {
    large: 'text-xs font-normal text-slate-500',
    medium: 'text-xs font-normal text-slate-400',
    small: 'text-[10px] font-normal text-slate-400',
  },
  
  // Overline - для категорий и меток
  overline: 'text-[10px] font-bold text-slate-500 uppercase tracking-wider',
  
  // Legacy support - постепенно заменить
  subheading: 'text-[10px] font-bold text-slate-400 uppercase tracking-widest',
} as const;

export type TypographyToken = typeof typography;

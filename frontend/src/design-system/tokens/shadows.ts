/**
 * Design System - Shadow Tokens
 * 
 * Современная система теней для создания глубины и иерархии.
 * Основана на принципах Material Design с адаптацией под современные тренды.
 */

export const shadows = {
  // Elevation system - от 0 до 5 уровней
  elevation: {
    0: 'shadow-none',
    1: 'shadow-sm', // Subtle shadow для карточек
    2: 'shadow-md', // Medium shadow для модальных окон
    3: 'shadow-lg', // Large shadow для dropdown
    4: 'shadow-xl', // Extra large для floating elements
    5: 'shadow-2xl', // Maximum для overlays
  },
  
  // Colored shadows для акцентов
  colored: {
    primary: 'shadow-lg shadow-indigo-500/15',
    success: 'shadow-lg shadow-emerald-500/15',
    warning: 'shadow-lg shadow-amber-500/15',
    danger: 'shadow-lg shadow-red-500/15',
    info: 'shadow-lg shadow-blue-500/15',
  },
  
  // Focus rings для accessibility
  focus: {
    primary: 'ring-2 ring-indigo-500/20 ring-offset-2',
    danger: 'ring-2 ring-red-500/20 ring-offset-2',
    success: 'ring-2 ring-emerald-500/20 ring-offset-2',
  },
  
  // Legacy support - постепенно заменить
  glass: 'shadow-xl shadow-slate-900/5',
  card: 'shadow-sm border border-slate-100',
  cardHover: 'hover:shadow-md hover:border-slate-200',
  button: {
    primary: 'shadow-sm',
    danger: 'shadow-sm',
  },
  modal: 'shadow-2xl shadow-slate-900/25',
  selected: 'ring-2 ring-indigo-500/20',
} as const;

export type ShadowToken = typeof shadows;

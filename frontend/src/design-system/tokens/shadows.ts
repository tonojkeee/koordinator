/**
 * Design System - Shadow Tokens
 * 
 * Определения теней для компонентов с glass effect и другими стилями.
 */

export const shadows = {
  glass: 'shadow-2xl shadow-slate-200/50',
  card: 'shadow-lg shadow-indigo-500/5',
  cardHover: 'hover:shadow-lg hover:shadow-indigo-500/5',
  button: {
    primary: 'shadow-lg shadow-indigo-600/30',
    danger: 'shadow-lg shadow-rose-600/30',
  },
  modal: 'shadow-2xl',
  selected: 'shadow-md shadow-indigo-100',
} as const;

export type ShadowToken = typeof shadows;

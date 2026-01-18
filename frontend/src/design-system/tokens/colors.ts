/**
 * Design System - Color Tokens
 * 
 * Централизованная цветовая палитра для всего приложения.
 * Основана на Tailwind CSS цветах для согласованности.
 */

export const colors = {
  // Primary palette (indigo)
  primary: {
    50: 'indigo-50',
    100: 'indigo-100',
    500: 'indigo-500',
    600: 'indigo-600',
    700: 'indigo-700',
  },
  
  // Neutral palette (slate)
  neutral: {
    50: 'slate-50',
    100: 'slate-100',
    200: 'slate-200',
    400: 'slate-400',
    500: 'slate-500',
    700: 'slate-700',
    900: 'slate-900',
  },
  
  // Semantic colors
  success: {
    500: 'green-500',
    600: 'green-600',
  },
  warning: {
    500: 'amber-500',
    600: 'amber-600',
  },
  danger: {
    500: 'rose-500',
    600: 'rose-600',
  },
  info: {
    500: 'blue-500',
    600: 'blue-600',
  },
} as const;

export type ColorToken = typeof colors;

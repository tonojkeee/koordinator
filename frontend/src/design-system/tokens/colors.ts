/**
 * Design System - Color Tokens
 * 
 * Современная цветовая палитра с улучшенным контрастом и читаемостью.
 * Основана на принципах Material Design 3 и современных UI трендах.
 */

export const colors = {
  // Primary palette - более насыщенный и современный
  primary: {
    25: 'slate-25',
    50: 'indigo-50',
    100: 'indigo-100',
    200: 'indigo-200',
    300: 'indigo-300',
    400: 'indigo-400',
    500: 'indigo-500',
    600: 'indigo-600',
    700: 'indigo-700',
    800: 'indigo-800',
    900: 'indigo-900',
    950: 'indigo-950',
  },
  
  // Neutral palette - расширенная для лучшей иерархии
  neutral: {
    0: 'white',
    25: 'slate-25',
    50: 'slate-50',
    100: 'slate-100',
    200: 'slate-200',
    300: 'slate-300',
    400: 'slate-400',
    500: 'slate-500',
    600: 'slate-600',
    700: 'slate-700',
    800: 'slate-800',
    900: 'slate-900',
    950: 'slate-950',
  },
  
  // Surface colors для современного layering
  surface: {
    primary: 'white',
    secondary: 'slate-50',
    tertiary: 'slate-100',
    elevated: 'white',
    overlay: 'slate-900/10',
  },
  
  // Semantic colors с улучшенной палитрой
  success: {
    50: 'emerald-50',
    100: 'emerald-100',
    500: 'emerald-500',
    600: 'emerald-600',
    700: 'emerald-700',
  },
  warning: {
    50: 'amber-50',
    100: 'amber-100',
    500: 'amber-500',
    600: 'amber-600',
    700: 'amber-700',
  },
  danger: {
    50: 'red-50',
    100: 'red-100',
    500: 'red-500',
    600: 'red-600',
    700: 'red-700',
  },
  info: {
    50: 'blue-50',
    100: 'blue-100',
    500: 'blue-500',
    600: 'blue-600',
    700: 'blue-700',
  },
} as const;

export type ColorToken = typeof colors;

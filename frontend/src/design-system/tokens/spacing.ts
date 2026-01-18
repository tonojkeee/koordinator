/**
 * Design System - Spacing Tokens
 * 
 * Стандартные значения отступов для согласованности layout.
 */

export const spacing = {
  padding: {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  },
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
  margin: {
    xs: 'm-1',
    sm: 'm-2',
    md: 'm-4',
    lg: 'm-6',
    xl: 'm-8',
  },
} as const;

export type SpacingToken = typeof spacing;

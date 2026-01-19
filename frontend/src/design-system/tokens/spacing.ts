/**
 * Design System - Spacing Tokens
 * 
 * Современная система отступов основанная на 4px grid для идеального выравнивания.
 * Использует принципы 8-point grid system для согласованности.
 */

export const spacing = {
  // Padding - более гибкая система
  padding: {
    none: 'p-0',
    xs: 'p-2',     // 8px
    sm: 'p-3',     // 12px
    md: 'p-4',     // 16px
    lg: 'p-6',     // 24px
    xl: 'p-8',     // 32px
    '2xl': 'p-12', // 48px
    '3xl': 'p-16', // 64px
  },
  
  // Gap - для flexbox и grid
  gap: {
    none: 'gap-0',
    xs: 'gap-1',   // 4px
    sm: 'gap-2',   // 8px
    md: 'gap-4',   // 16px
    lg: 'gap-6',   // 24px
    xl: 'gap-8',   // 32px
    '2xl': 'gap-12', // 48px
  },
  
  // Margin - редко используется, но нужен
  margin: {
    none: 'm-0',
    xs: 'm-1',     // 4px
    sm: 'm-2',     // 8px
    md: 'm-4',     // 16px
    lg: 'm-6',     // 24px
    xl: 'm-8',     // 32px
    '2xl': 'm-12', // 48px
  },
  
  // Space - для stack layouts
  space: {
    xs: 'space-y-1',   // 4px
    sm: 'space-y-2',   // 8px
    md: 'space-y-4',   // 16px
    lg: 'space-y-6',   // 24px
    xl: 'space-y-8',   // 32px
    '2xl': 'space-y-12', // 48px
  },
  
  // Container padding для разных breakpoints
  container: {
    mobile: 'px-4',    // 16px на мобильных
    tablet: 'px-6',    // 24px на планшетах
    desktop: 'px-8',   // 32px на десктопе
  },
} as const;

export type SpacingToken = typeof spacing;

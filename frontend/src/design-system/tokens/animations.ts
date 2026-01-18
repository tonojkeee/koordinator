/**
 * Design System - Animation Tokens
 * 
 * Единая система анимаций для плавных переходов и взаимодействий.
 */

export const animations = {
  fadeIn: 'animate-in fade-in duration-300',
  slideIn: 'animate-in slide-in-from-bottom-4 duration-500',
  zoomIn: 'animate-in zoom-in-95 duration-300',
  hoverLift: 'hover:-translate-y-0.5 transition-transform duration-200',
  scalePress: 'active:scale-95 transition-transform',
  scalePressSubtle: 'active:scale-[0.98] transition-transform',
} as const;

export type AnimationToken = typeof animations;

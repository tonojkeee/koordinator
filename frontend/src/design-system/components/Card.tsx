/**
 * Design System - Card Component
 * 
 * Современный компонент карточки с минималистичным дизайном и четкой иерархией.
 * Основан на принципах современного UI/UX дизайна.
 * 
 * @example
 * <Card>
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </Card>
 * 
 * @example
 * <Card selected hoverable padding="lg">
 *   Selected card with hover effect
 * </Card>
 */

import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../utils/cn';

const cardVariants = cva(
  // Base styles - современный минималистичный подход
  'bg-white border rounded-xl transition-all duration-200 ease-out',
  {
    variants: {
      selected: {
        true: 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20',
        false: 'border-slate-200 hover:border-slate-300',
      },
      hoverable: {
        true: 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]',
        false: '',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
      variant: {
        default: 'shadow-sm',
        elevated: 'shadow-md',
        outlined: 'border-2',
        ghost: 'border-0 shadow-none bg-transparent',
      },
    },
    defaultVariants: {
      selected: false,
      hoverable: true,
      padding: 'md',
      variant: 'default',
    },
  }
);

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
}

export const Card = React.memo<CardProps>(({
  selected,
  hoverable,
  padding,
  variant,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        cardVariants({ selected, hoverable, padding, variant }),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

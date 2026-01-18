/**
 * Design System - Card Component
 * 
 * Компонент карточки для отображения элементов в grid или list режиме.
 * Поддерживает различные состояния (selected, hoverable) и варианты padding.
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
  // Base styles
  'bg-white border rounded-xl transition-all',
  {
    variants: {
      selected: {
        true: 'bg-indigo-50 border-indigo-500 shadow-md shadow-indigo-100 ring-4 ring-indigo-500/5',
        false: 'border-slate-200/60',
      },
      hoverable: {
        true: 'cursor-pointer hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-100',
        false: '',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      selected: false,
      hoverable: true,
      padding: 'md',
    },
  }
);

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.memo<CardProps>(({
  selected,
  hoverable,
  padding,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        cardVariants({ selected, hoverable, padding }),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

/**
 * Design System - Button Component
 * 
 * Универсальный компонент кнопки с поддержкой различных вариантов,
 * размеров, иконок и состояния загрузки.
 * 
 * @example
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Click me
 * </Button>
 * 
 * @example
 * <Button variant="danger" icon={<TrashIcon />} loading>
 *   Delete
 * </Button>
 */

import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../utils/cn';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 hover:-translate-y-0.5 active:scale-95',
        secondary: 'bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 hover:border-slate-300 active:scale-95',
        danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 hover:-translate-y-0.5 active:scale-95',
        ghost: 'hover:bg-slate-100 text-slate-700 active:scale-95',
      },
      size: {
        sm: 'px-3 h-8 text-xs',
        md: 'px-4 h-9 text-xs',
        lg: 'px-6 h-11 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.memo<ButtonProps>(({
  variant,
  size,
  icon,
  iconPosition = 'left',
  loading,
  fullWidth,
  children,
  className,
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        fullWidth && 'w-full',
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  );
});

Button.displayName = 'Button';

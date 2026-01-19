/**
 * Design System - Button Component
 * 
 * Современный компонент кнопки с минималистичным дизайном и четкой иерархией.
 * Основан на принципах современного UI/UX дизайна.
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
  // Base styles - современный минималистичный подход
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md focus:ring-indigo-500/20 active:scale-95',
        secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md focus:ring-slate-500/20 active:scale-95',
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md focus:ring-red-500/20 active:scale-95',
        ghost: 'hover:bg-slate-100 text-slate-700 focus:ring-slate-500/20 active:scale-95',
        outline: 'border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50 focus:ring-slate-500/20 active:scale-95',
      },
      size: {
        sm: 'px-3 h-8 text-sm',
        md: 'px-4 h-10 text-sm',
        lg: 'px-6 h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
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

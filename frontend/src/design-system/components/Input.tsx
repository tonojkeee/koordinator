/**
 * Design System - Input Component
 * 
 * Современный компонент поля ввода с минималистичным дизайном и четкой иерархией.
 * Основан на принципах современного UI/UX дизайна.
 * 
 * @example
 * <Input
 *   label="Email"
 *   placeholder="Enter your email"
 *   type="email"
 *   leftIcon={<MailIcon />}
 * />
 * 
 * @example
 * <Input
 *   label="Password"
 *   type="password"
 *   error="Password is required"
 * />
 */

import React from 'react';
import { cn } from '../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = React.memo<InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  id,
  ...props
}) => {
  // Generate unique ID if not provided
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className={cn('space-y-2', fullWidth && 'w-full')}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}
        
        <input
          id={inputId}
          className={cn(
            'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl',
            'font-normal text-slate-900 placeholder:text-slate-400',
            'transition-all duration-200 ease-out outline-none',
            'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
            'hover:border-slate-300',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm font-medium text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

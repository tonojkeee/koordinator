/**
 * Design System - Input Component
 * 
 * Компонент поля ввода с поддержкой различных состояний,
 * иконок, label, error и helper text.
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
  const inputId = id || React.useId();

  return (
    <div className={cn('space-y-1.5', fullWidth && 'w-full')}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-700"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}
        
        <input
          id={inputId}
          className={cn(
            'w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl',
            'font-medium text-slate-900 placeholder:text-slate-400',
            'transition-all outline-none',
            'focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-100',
            !error && 'border-slate-100',
            leftIcon && 'pl-12',
            rightIcon && 'pr-12',
            className
          )}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

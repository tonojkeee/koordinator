/**
 * Design System - TextArea Component
 * 
 * Компонент многострочного поля ввода, расширяющий стилизацию Input
 * для текстовых областей.
 * 
 * @example
 * <TextArea
 *   label="Description"
 *   placeholder="Enter description"
 *   rows={4}
 * />
 * 
 * @example
 * <TextArea
 *   label="Comments"
 *   error="Comment is required"
 *   helperText="Maximum 500 characters"
 * />
 */

import React from 'react';
import { cn } from '../utils/cn';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const TextArea = React.memo<TextAreaProps>(({
  label,
  error,
  helperText,
  fullWidth,
  className,
  id,
  rows = 4,
  ...props
}) => {
  // Generate unique ID if not provided
  const generatedId = React.useId();
  const textareaId = id || generatedId;

  return (
    <div className={cn('space-y-1.5', fullWidth && 'w-full')}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-bold text-slate-700"
        >
          {label}
        </label>
      )}
      
      <textarea
        id={textareaId}
        rows={rows}
        className={cn(
          'w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl',
          'font-medium text-slate-900 placeholder:text-slate-400',
          'transition-all outline-none resize-y',
          'focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100',
          error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-100',
          !error && 'border-slate-100',
          className
        )}
        {...props}
      />
      
      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

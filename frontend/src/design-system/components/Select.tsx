/**
 * Design System - Select Component
 * 
 * Компонент выпадающего списка с единым стилем,
 * соответствующим дизайн-системе.
 * 
 * @example
 * <Select
 *   label="Country"
 *   options={[
 *     { value: 'us', label: 'United States' },
 *     { value: 'uk', label: 'United Kingdom' }
 *   ]}
 * />
 * 
 * @example
 * <Select
 *   label="Priority"
 *   error="Priority is required"
 *   placeholder="Select priority"
 * />
 */

import React from 'react';
import { cn } from '../utils/cn';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select = React.memo<SelectProps>(({
  label,
  error,
  helperText,
  options = [],
  placeholder,
  fullWidth,
  className,
  id,
  ...props
}) => {
  // Generate unique ID if not provided
  const generatedId = React.useId();
  const selectId = id || generatedId;

  return (
    <div className={cn('space-y-1.5', fullWidth && 'w-full')}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-slate-700"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl appearance-none',
            'font-medium text-slate-900',
            'transition-all outline-none cursor-pointer',
            'focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-100',
            !error && 'border-slate-100',
            // Style for placeholder state
            !props.value && 'text-slate-400',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="text-slate-900"
            >
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <ChevronDown className="w-5 h-5" />
        </div>
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

Select.displayName = 'Select';

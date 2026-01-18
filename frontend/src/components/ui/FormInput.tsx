import React from 'react';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'compact';
}

const variantClasses = {
  default: 'h-12',
  compact: 'h-10',
};

/**
 * FormInput - Reusable form input component with consistent styling.
 * 
 * Features:
 * - Label with uppercase styling
 * - Error state with message
 * - Helper text
 * - Focus ring
 * - Multiple variants
 * 
 * @example
 * <FormInput
 *   label="Document Title"
 *   value={title}
 *   onChange={(e) => setTitle(e.target.value)}
 *   placeholder="Enter title..."
 *   required
 *   error={errors.title}
 * />
 */
export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  helperText,
  variant = 'default',
  className = '',
  required,
  ...props
}) => {
  return (
    <div className="w-full">
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      <input
        className={`
          w-full ${variantClasses[variant]} px-4
          bg-slate-50 border
          ${error ? 'border-rose-500' : 'border-slate-100'}
          rounded-2xl text-sm font-medium
          focus:outline-none focus:ring-4
          ${error ? 'focus:ring-rose-500/10 focus:border-rose-500' : 'focus:ring-indigo-500/10 focus:border-indigo-500'}
          transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-xs text-rose-500 font-medium mt-1 px-1">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-slate-400 font-medium mt-1 px-1">
          {helperText}
        </p>
      )}
    </div>
  );
};

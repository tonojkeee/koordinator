import React from 'react';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
  minHeight?: string;
}

/**
 * FormTextarea - Reusable form textarea component with consistent styling.
 * 
 * Features:
 * - Label with uppercase styling
 * - Error state with message
 * - Helper text
 * - Focus ring
 * - Configurable min height
 * 
 * @example
 * <FormTextarea
 *   label="Description"
 *   value={description}
 *   onChange={(e) => setDescription(e.target.value)}
 *   placeholder="Enter description..."
 *   minHeight="min-h-[120px]"
 *   required
 * />
 */
export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  error,
  helperText,
  minHeight = 'min-h-[100px]',
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
      <textarea
        className={`
          w-full px-4 py-3
          bg-slate-50 border
          ${error ? 'border-rose-500' : 'border-slate-100'}
          rounded-2xl text-sm font-medium
          focus:outline-none focus:ring-4
          ${error ? 'focus:ring-rose-500/10 focus:border-rose-500' : 'focus:ring-indigo-500/10 focus:border-indigo-500'}
          transition-all
          ${minHeight}
          resize-none
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

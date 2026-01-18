import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/20',
  secondary: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
  destructive: 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-lg shadow-rose-600/20',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

const sizeClasses = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

/**
 * Button - Reusable button component with consistent styling.
 * 
 * Features:
 * - Multiple variants (primary, secondary, destructive, ghost)
 * - Multiple sizes (sm, md, lg)
 * - Loading state with spinner
 * - Optional icon
 * - Disabled state
 * 
 * @example
 * <Button
 *   variant="primary"
 *   size="md"
 *   loading={isPending}
 *   icon={<Upload />}
 *   onClick={handleSubmit}
 * >
 *   Upload
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        rounded-xl font-bold transition-all
        disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : icon ? (
        <span className="flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

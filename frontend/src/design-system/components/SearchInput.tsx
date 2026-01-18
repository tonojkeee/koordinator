/**
 * Design System - SearchInput Component
 * 
 * Компонент поиска с иконкой, glass effect фоном и кнопкой очистки.
 * Используется в Header компонентах для быстрого поиска.
 * 
 * @example
 * <SearchInput
 *   placeholder="Поиск документов..."
 *   value={searchValue}
 *   onChange={(e) => setSearchValue(e.target.value)}
 *   onClear={() => setSearchValue('')}
 * />
 * 
 * Requirements: 3.1-3.5, 16.2
 */

import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils/cn';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Callback вызываемый при нажатии на кнопку очистки
   */
  onClear?: () => void;
}

export const SearchInput = React.memo<SearchInputProps>(({
  value,
  onChange,
  onClear,
  placeholder = 'Поиск...',
  className,
  ...props
}) => {
  return (
    <div className={cn('relative group w-full sm:w-80', className)}>
      {/* Search Icon - абсолютное позиционирование слева */}
      <Search 
        className={cn(
          'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4',
          'text-slate-400 transition-colors',
          'group-focus-within:text-indigo-500'
        )}
      />
      
      {/* Input Field с glass effect */}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          // Base styling - responsive width (Requirements 11.2)
          'w-full h-9 pl-11 pr-10',
          // Glass effect background
          'bg-white/50 border border-slate-200/50 rounded-xl',
          // Typography
          'text-xs font-medium text-slate-900 placeholder:text-slate-400',
          // Transitions
          'transition-all outline-none',
          // Focus state enhancement (Requirement 3.3)
          'focus:bg-white focus:shadow-md focus:border-indigo-100 focus:ring-4 focus:ring-indigo-100'
        )}
        {...props}
      />
      
      {/* Clear Button - показывается только при наличии значения */}
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'p-1 hover:bg-slate-100 rounded transition-colors'
          )}
          aria-label="Clear search"
        >
          <X className="w-3 h-3 text-slate-400" />
        </button>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

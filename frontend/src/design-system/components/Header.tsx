/**
 * Design System - Header Component
 * 
 * Основной компонент шапки модуля с двухуровневой структурой:
 * - Верхний уровень: иконка, заголовок, поиск, действия
 * - Нижний уровень: навигация по вкладкам
 * 
 * Использует glass effect стилизацию и sticky позиционирование.
 * 
 * @example
 * <Header
 *   title="Электронная доска"
 *   subtitle="Документы"
 *   icon={<FileTextIcon />}
 *   iconColor="indigo"
 *   searchPlaceholder="Поиск документов..."
 *   searchValue={search}
 *   onSearchChange={(e) => setSearch(e.target.value)}
 *   tabs={[
 *     { id: 'all', label: 'Все', badge: 10 },
 *     { id: 'recent', label: 'Недавние' },
 *   ]}
 *   activeTab="all"
 *   onTabChange={setActiveTab}
 *   actions={
 *     <Button variant="primary" icon={<PlusIcon />}>
 *       Добавить
 *     </Button>
 *   }
 * />
 * 
 * Requirements: 1.1-1.6, 16.1
 */

import React from 'react';
import { cn } from '../utils/cn';
import { HeaderIcon, type HeaderIconColor } from './HeaderIcon';
import { SearchInput } from './SearchInput';
import { TabNavigation, type TabItem } from './TabNavigation';

export interface HeaderProps {
  /**
   * Основной заголовок модуля
   */
  title: string;
  
  /**
   * Подзаголовок (опционально)
   */
  subtitle?: string;
  
  /**
   * React элемент иконки модуля
   */
  icon: React.ReactNode;
  
  /**
   * Цветовая схема иконки
   * @default 'indigo'
   */
  iconColor?: HeaderIconColor;
  
  /**
   * Действия в правой части header (кнопки, меню и т.д.)
   */
  actions?: React.ReactNode;
  
  /**
   * Placeholder для поля поиска
   */
  searchPlaceholder?: string;
  
  /**
   * Значение поля поиска
   */
  searchValue?: string;
  
  /**
   * Обработчик изменения значения поиска
   */
  onSearchChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  
  /**
   * Обработчик очистки поля поиска
   */
  onSearchClear?: () => void;
  
  /**
   * Массив вкладок для нижнего уровня
   */
  tabs?: TabItem[];
  
  /**
   * ID активной вкладки
   */
  activeTab?: string;
  
  /**
   * Обработчик переключения вкладок
   */
  onTabChange?: (tabId: string) => void;
  
  /**
   * Дополнительные CSS классы
   */
  className?: string;
  
  /**
   * Использовать sticky позиционирование
   * @default true
   */
  sticky?: boolean;
}

export const Header = React.memo<HeaderProps>(({
  title,
  subtitle,
  icon,
  iconColor = 'indigo',
  actions,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSearchClear,
  tabs,
  activeTab,
  onTabChange,
  className,
  sticky = true,
}) => {
  return (
    <header
      className={cn(
        // Glass effect styling (Requirements 1.1)
        'bg-white/80 backdrop-blur-xl border border-white/60',
        // Rounded corners and shadow (Requirements 1.2)
        'rounded-2xl shadow-2xl shadow-slate-200/50',
        // Padding and spacing - responsive (Requirements 11.1)
        'p-4 sm:p-6 space-y-3 sm:space-y-4',
        // Sticky positioning (Requirements 1.3)
        sticky && 'sticky top-0 z-40',
        className
      )}
    >
      {/* Upper Level: Icon + Title + Search + Actions (Requirements 1.4) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        {/* Icon + Title Section - always visible */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
          {/* Module Icon (Requirements 1.5, 1.6) */}
          <HeaderIcon icon={icon} color={iconColor} />
          
          {/* Title Section */}
          <div className="flex-1 min-w-0">
            {subtitle && (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-in fade-in slide-in-from-left-1 duration-300">
                {subtitle}
              </div>
            )}
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-none tracking-tight truncate">
              {title}
            </h1>
          </div>
        </div>
        
        {/* Search Input (optional) - full width on mobile, fixed width on desktop */}
        {onSearchChange && (
          <div className="w-full sm:w-auto order-3 sm:order-2">
            <SearchInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange}
              onClear={onSearchClear}
            />
          </div>
        )}
        
        {/* Actions (optional) - hidden on mobile if search is present */}
        {actions && (
          <div className={cn(
            "flex items-center gap-2 order-2 sm:order-3",
            onSearchChange && "hidden sm:flex"
          )}>
            {actions}
          </div>
        )}
      </div>
      
      {/* Lower Level: Tab Navigation (optional) */}
      {tabs && tabs.length > 0 && (
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </header>
  );
});

Header.displayName = 'Header';

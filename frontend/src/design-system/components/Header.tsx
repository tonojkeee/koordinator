/**
 * Design System - Header Component
 * 
 * Современный компонент заголовка страницы с минималистичным дизайном.
 * Основан на принципах современного UI/UX дизайна.
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
 */

import React, { useEffect, useState } from 'react';
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
   * Дополнительные элементы в области табов (справа от табов)
   */
  tabsActions?: React.ReactNode;
  
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

/**
 * Анимированный заголовок с fade-эффектом при изменении
 */
const AnimatedTitle: React.FC<{ title: string; className?: string }> = ({ title, className }) => {
  const [displayTitle, setDisplayTitle] = useState(title);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (title !== displayTitle) {
      setIsAnimating(true);
      
      // Fade out
      const fadeOutTimer = setTimeout(() => {
        setDisplayTitle(title);
        // Fade in
        const fadeInTimer = setTimeout(() => {
          setIsAnimating(false);
        }, 150);
        return () => clearTimeout(fadeInTimer);
      }, 150);
      
      return () => clearTimeout(fadeOutTimer);
    }
  }, [title, displayTitle]);

  // Синхронизируем displayTitle с title при первом рендере
  useEffect(() => {
    setDisplayTitle(title);
  }, []);

  return (
    <h1 
      className={cn(
        'text-xl font-semibold text-slate-900 leading-tight truncate transition-all duration-300 ease-in-out',
        isAnimating && 'opacity-0 transform translate-y-1',
        !isAnimating && 'opacity-100 transform translate-y-0',
        className
      )}
    >
      {displayTitle}
    </h1>
  );
};

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
  tabsActions,
  className,
  sticky = true,
}) => {
  return (
    <header
      className={cn(
        // Современный минималистичный дизайн
        'bg-white border border-slate-200 rounded-xl shadow-sm',
        // Padding и spacing
        'p-6 space-y-4',
        // Sticky positioning
        sticky && 'sticky top-0 z-40',
        className
      )}
    >
      {/* Upper Level: Icon + Title + Search + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon + Title Section */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Module Icon */}
          <HeaderIcon icon={icon} color={iconColor} />
          
          {/* Title Section */}
          <div className="flex-1 min-w-0">
            <AnimatedTitle title={title} />
            {subtitle && (
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        
        {/* Search Input */}
        {onSearchChange && (
          <div className="w-full sm:w-80">
            <SearchInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange}
              onClear={onSearchClear}
            />
          </div>
        )}
        
        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      
      {/* Lower Level: Tab Navigation */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center justify-between">
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
          {tabsActions && (
            <div className="flex items-center">
              {tabsActions}
            </div>
          )}
        </div>
      )}
    </header>
  );
});

Header.displayName = 'Header';

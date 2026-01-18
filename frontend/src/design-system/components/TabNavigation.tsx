/**
 * Design System - TabNavigation Component
 * 
 * Компонент навигации по вкладкам с поддержкой иконок, badge,
 * активного/неактивного состояния и горизонтальной прокрутки на мобильных устройствах.
 * 
 * @example
 * <TabNavigation
 *   tabs={[
 *     { id: 'all', label: 'Все', badge: 10 },
 *     { id: 'active', label: 'Активные', icon: <CheckIcon /> },
 *   ]}
 *   activeTab="all"
 *   onTabChange={(tabId) => console.log(tabId)}
 * />
 */

import React from 'react';
import { cn } from '../utils/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

export interface TabNavigationProps {
  tabs: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export const TabNavigation = React.memo<TabNavigationProps>(({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50',
        // Horizontal scroll on mobile (Requirements 11.3)
        'overflow-x-auto scrollbar-hide',
        // Snap scrolling for better mobile UX
        'snap-x snap-mandatory',
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold',
              'transition-all duration-200 whitespace-nowrap',
              // Snap alignment for mobile scrolling
              'snap-start',
              // Responsive sizing - slightly smaller on mobile
              'min-w-fit',
              isActive && 'bg-white text-indigo-600 shadow-md',
              !isActive && 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            )}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
                )}
                aria-label={`${tab.badge} items`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

TabNavigation.displayName = 'TabNavigation';

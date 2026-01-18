/**
 * Design System - HeaderIcon Component
 * 
 * Вспомогательный компонент для отображения иконки модуля в Header.
 * Предоставляет обертку с цветным фоном, тенью и hover анимацией.
 * 
 * @example
 * <HeaderIcon icon={<MailIcon />} color="indigo" />
 * 
 * @example
 * <HeaderIcon icon={<FolderIcon />} color="amber" />
 * 
 * Requirements: 1.5, 1.6
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const headerIconVariants = cva(
  // Base styles - padding, rounded corners, shadow, hover animation
  'p-2.5 rounded-xl shadow-lg transition-transform duration-300 hover:scale-105 text-white',
  {
    variants: {
      color: {
        indigo: 'bg-indigo-600 shadow-indigo-200',
        amber: 'bg-amber-600 shadow-amber-200',
        rose: 'bg-rose-600 shadow-rose-200',
        green: 'bg-green-600 shadow-green-200',
        blue: 'bg-blue-600 shadow-blue-200',
      },
    },
    defaultVariants: {
      color: 'indigo',
    },
  }
);

export type HeaderIconColor = 'indigo' | 'amber' | 'rose' | 'green' | 'blue';

export interface HeaderIconProps extends VariantProps<typeof headerIconVariants> {
  /**
   * React элемент иконки (обычно из lucide-react)
   */
  icon: React.ReactNode;
  
  /**
   * Цветовая схема иконки
   * @default 'indigo'
   */
  color?: HeaderIconColor;
  
  /**
   * Дополнительные CSS классы
   */
  className?: string;
}

export const HeaderIcon = React.memo<HeaderIconProps>(({
  icon,
  color = 'indigo',
  className,
}) => {
  return (
    <div
      className={cn(headerIconVariants({ color }), className)}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
});

HeaderIcon.displayName = 'HeaderIcon';

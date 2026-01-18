/**
 * Design System - Class Names Utility
 * 
 * Утилита для объединения CSS классов с поддержкой условной логики
 * и автоматическим разрешением конфликтов Tailwind CSS.
 * 
 * Использует:
 * - clsx: для условного объединения классов
 * - tailwind-merge: для разрешения конфликтов Tailwind классов
 * 
 * @example
 * cn('px-4 py-2', 'bg-blue-500', { 'text-white': true, 'hidden': false })
 * // => 'px-4 py-2 bg-blue-500 text-white'
 * 
 * @example
 * cn('px-2 py-1', 'px-4') // tailwind-merge разрешит конфликт
 * // => 'py-1 px-4'
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

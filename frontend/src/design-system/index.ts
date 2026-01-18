/**
 * Design System - Main Entry Point
 * 
 * Централизованный экспорт всех элементов дизайн-системы:
 * - Токены (цвета, типографика, анимации, тени, отступы)
 * - Утилиты (cn helper)
 * - Компоненты (будут добавлены в следующих задачах)
 * 
 * @example
 * import { cn, colors, typography } from '@/design-system';
 */

// Токены
export * from './tokens';

// Утилиты
export * from './utils';

// Компоненты
export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';

export { Input } from './components/Input';
export type { InputProps } from './components/Input';

export { TextArea } from './components/TextArea';
export type { TextAreaProps } from './components/TextArea';

export { Select } from './components/Select';
export type { SelectProps, SelectOption } from './components/Select';

export { SearchInput } from './components/SearchInput';
export type { SearchInputProps } from './components/SearchInput';

export { Card } from './components/Card';
export type { CardProps } from './components/Card';

export { TabNavigation } from './components/TabNavigation';
export type { TabNavigationProps, TabItem } from './components/TabNavigation';

export { Modal } from './components/Modal';
export type { ModalProps, ModalSize } from './components/Modal';

export { Header } from './components/Header';
export type { HeaderProps } from './components/Header';

export { HeaderIcon } from './components/HeaderIcon';
export type { HeaderIconProps, HeaderIconColor } from './components/HeaderIcon';

export { DesignSystemErrorBoundary } from './components/ErrorBoundary';
export { default as ErrorBoundary } from './components/ErrorBoundary';

export { Avatar } from './components/Avatar';
export type { AvatarProps, AvatarSize, AvatarStatus } from './components/Avatar';

export { ToastProvider } from './components/Toast';
export type { Toast, ToastContextType } from './components/ToastContext';
export { ToastContext, useToast } from './components/ToastContext';

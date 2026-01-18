/**
 * Design System - Modal Component
 * 
 * Компонент модального окна с overlay, backdrop blur и анимациями.
 * Поддерживает различные размеры, focus trap и keyboard navigation.
 * 
 * @example
 * <Modal isOpen={isOpen} onClose={handleClose} title="Confirm Action">
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 * 
 * @example
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Create New Item"
 *   size="lg"
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={handleClose}>Cancel</Button>
 *       <Button variant="primary" onClick={handleSubmit}>Create</Button>
 *     </>
 *   }
 * >
 *   <form>...</form>
 * </Modal>
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

// Responsive size adjustments for mobile devices (Requirements 11.5)
const responsiveSizeClasses: Record<ModalSize, string> = {
  sm: 'w-full sm:max-w-md',
  md: 'w-full sm:max-w-lg',
  lg: 'w-full sm:max-w-2xl',
  xl: 'w-full sm:max-w-4xl',
};

export const Modal = React.memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before modal opened
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Add event listener for Escape key
    document.addEventListener('keydown', handleKeyDown);

    // Focus the modal container
    if (modalRef.current) {
      modalRef.current.focus();
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      // Remove event listener
      document.removeEventListener('keydown', handleKeyDown);

      // Restore body scroll
      document.body.style.overflow = '';

      // Return focus to the element that had it before modal opened
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  // Focus trap: keep focus within modal
  const handleTabKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300",
        // Responsive padding (Requirements 11.5)
        "p-2 sm:p-4"
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={cn(
          'bg-white rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-300',
          // Use responsive size classes
          responsiveSizeClasses[size],
          // Responsive max height to prevent overflow on mobile
          'max-h-[90vh] sm:max-h-[85vh] overflow-y-auto',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleTabKey}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
            {title && (
              typeof title === 'string' ? (
                <h2
                  id="modal-title"
                  className="text-base sm:text-lg font-black text-slate-900"
                >
                  {title}
                </h2>
              ) : (
                <div id="modal-title" className="flex-1">
                  {title}
                </div>
              )
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close modal"
                type="button"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal in a portal to avoid z-index issues
  return createPortal(modalContent, document.body);
});

Modal.displayName = 'Modal';

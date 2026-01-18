/**
 * Design System - Toast Component
 *
 * Компонент для отображения уведомлений с различными типами,
 * анимациями и поддержкой действий.
 *
 * @example
 * const { addToast } = useToast();
 *
 * addToast({
 *   type: 'success',
 *   title: 'Success',
 *   message: 'Operation completed',
 * });
 */

import React, { useState, useCallback } from 'react';
import { X, Trash2, MessageSquare, Bell } from 'lucide-react';
import { ToastContext, type Toast } from './ToastContext';
import { cn } from '../utils/cn';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);

    const duration = toast.duration || 5000;
    if (duration !== Infinity) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-md">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  };

  const iconMap = {
    info: <Bell size={20} />,
    success: <MessageSquare size={20} />,
    warning: <Bell size={20} />,
    error: <X size={20} />,
    deleted: <Trash2 size={20} />,
  };

  const colorMap = {
    info: 'from-blue-500 to-indigo-600',
    success: 'from-emerald-500 to-green-600',
    warning: 'from-amber-500 to-orange-600',
    error: 'from-rose-500 to-red-600',
    deleted: 'from-rose-500 to-pink-600',
  };

  const bgColorMap = {
    info: 'bg-white/80 border-indigo-200/50 text-indigo-900',
    success: 'bg-white/80 border-emerald-200/50 text-emerald-900',
    warning: 'bg-white/80 border-amber-200/50 text-amber-900',
    error: 'bg-white/80 border-rose-200/50 text-rose-900',
    deleted: 'bg-white/80 border-rose-200/50 text-rose-900',
  };

  return (
    <div
      className={cn(
        bgColorMap[toast.type],
        'backdrop-blur-xl border shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
        'rounded-[2rem] overflow-hidden transition-all-custom',
        isExiting ? 'opacity-0 scale-90 translate-y-4' : 'animate-in slide-in-from-bottom-4 fade-in zoom-in-95',
        toast.onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : '',
        'ring-1 ring-white/60'
      )}
      style={isExiting ? { transitionDuration: '300ms' } : {}}
      onClick={(e) => {
        if (toast.onClick && !(e.target as HTMLElement).closest('button')) {
          toast.onClick();
          handleClose();
        }
      }}
    >
      <div className="flex items-center gap-4 p-4 pl-5">
        <div className={cn(
          'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white shrink-0 shadow-lg shadow-black/5',
          colorMap[toast.type]
        )}>
          {iconMap[toast.type]}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <h4 className="font-bold text-sm tracking-tight">{toast.title}</h4>
          {toast.message && (
            <p className="text-current text-xs font-medium opacity-80 mt-0.5 leading-relaxed">
              {toast.message}
            </p>
          )}
        </div>
        {toast.action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.action?.onClick();
              handleClose();
            }}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-black/5 text-current opacity-60 hover:opacity-100 transition-all mr-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

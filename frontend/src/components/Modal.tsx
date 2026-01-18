import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-fade-in"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-white/40 rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in pointer-events-auto ring-1 ring-white/50"
            >
                <div className="px-8 py-6 border-b border-slate-100/50 flex items-center justify-between bg-white/40 backdrop-blur-sm">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2.5 bg-slate-100/50 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all-custom duration-300 hover:scale-105 active:scale-95"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-8">
                    {children}
                </div>
            </div>
        </div>
    );

    const target = document.getElementById('modal-root');
    return target ? createPortal(modalContent, target) : modalContent;
};

export default Modal;

import { create } from 'zustand';

interface DocumentViewerState {
    isOpen: boolean;
    url: string | null;
    title: string | null;
    filename: string | null;
    mimeType: string | null;
    open: (url: string, title?: string, filename?: string, mimeType?: string) => void;
    close: () => void;
}

export const useDocumentViewer = create<DocumentViewerState>((set) => ({
    isOpen: false,
    url: null,
    title: null,
    filename: null,
    mimeType: null,
    open: (url: string, title?: string, filename?: string, mimeType?: string) => {
        set({ isOpen: true, url, title: title || 'Просмотр документа', filename: filename || null, mimeType: mimeType || null });
    },
    close: () => set({ isOpen: false, url: null, title: null, filename: null, mimeType: null }),
}));

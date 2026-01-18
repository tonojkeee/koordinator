import { useCallback, useRef, useEffect } from 'react';

import { type ContextMenuItem } from '../types';

// Global reference to the current context menu callback
// This ensures only the component that triggered the menu handles the command
let currentContextMenuCallback: ((id: string) => void) | null = null;
let isListenerRegistered = false;

export const useContextMenu = (items: ContextMenuItem[], onCommand: (id: string) => void) => {
    // Use ref to always have the latest callback without re-registering listeners
    const callbackRef = useRef(onCommand);

    useEffect(() => {
        callbackRef.current = onCommand;
    }, [onCommand]);

    // Register global listener only once
    useEffect(() => {
        if (!window.electron) return;
        if (isListenerRegistered) return;

        isListenerRegistered = true;

        window.electron.onContextMenuCommand((commandId: string) => {
            if (currentContextMenuCallback) {
                currentContextMenuCallback(commandId);
                currentContextMenuCallback = null;
            }
        });

        return () => {
            // Don't unregister - keep it for the lifetime of the app
        };
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!window.electron) return;

        e.preventDefault();
        e.stopPropagation();

        // Set THIS component's callback as the current one
        currentContextMenuCallback = (id: string) => callbackRef.current(id);

        window.electron.showContextMenu(items);
    }, [items]);

    return handleContextMenu;
};

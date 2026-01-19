import { create } from 'zustand';

interface ConnectionState {
    isConnected: boolean;
    isOffline: boolean;
    setIsConnected: (connected: boolean) => void;
    setIsOffline: (offline: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set): ConnectionState => ({
    isConnected: false,
    isOffline: !navigator.onLine,
    setIsConnected: (connected: boolean): void => set({ isConnected: connected }),
    setIsOffline: (offline: boolean): void => set({ isOffline: offline }),
}));

// Setup window listeners for network status with cleanup on unmount
let cleanupHandlers: (() => void) | null = null;

export const setupConnectionListeners = (): void => {
    // Remove previous handlers
    if (cleanupHandlers) {
        cleanupHandlers();
    }
    
    const handleOnline = (): void => useConnectionStore.getState().setIsOffline(false);
    const handleOffline = (): void => useConnectionStore.getState().setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Return cleanup function
    cleanupHandlers = (): void => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
};

// Call setup when store is created
setupConnectionListeners();

// Optional: export cleanup for use in useEffect cleanup
export const cleanupConnectionListeners = (): void => {
    if (cleanupHandlers) {
        cleanupHandlers();
    }
};

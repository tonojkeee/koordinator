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

// Setup window listeners for network status
if (typeof window !== 'undefined') {
    window.addEventListener('online', (): void => useConnectionStore.getState().setIsOffline(false));
    window.addEventListener('offline', (): void => useConnectionStore.getState().setIsOffline(true));
}

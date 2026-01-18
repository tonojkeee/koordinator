import { create } from 'zustand';

interface ConfigState {
    showSetup: boolean;
    serverUrl: string | null;
    setShowSetup: (show: boolean) => void;
    setServerUrl: (url: string) => void;
}

export const useConfigStore = create<ConfigState>((set): ConfigState => ({
    showSetup: false,
    serverUrl: null,
    setShowSetup: (show: boolean): void => set({ showSetup: show }),
    setServerUrl: (url: string): void => set({ serverUrl: url }),
}));

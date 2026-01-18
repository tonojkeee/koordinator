import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    setAuth: (user: User, token: string, refreshToken: string) => void;
    updateUser: (user: User) => void;
    clearAuth: () => void;
    isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set): AuthState => ({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            setAuth: (user: User, token: string, refreshToken: string): void => {
                set({ user, token, refreshToken, isAuthenticated: true });
            },
            updateUser: (user: User): void => {
                set({ user });
            },
            clearAuth: (): void => {
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
            },
        }),
        {
            name: 'auth-storage',
            // Persist everything except isAuthenticated which is derived
            partialize: (state): Partial<AuthState> => ({
                user: state.user,
                token: state.token,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated
            }),
        }
    )
);

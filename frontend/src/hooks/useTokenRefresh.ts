import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/client';

/**
 * Hook для автоматического обновления токена перед истечением
 * Обновляет токен за 30 минут до истечения (access token живет 8 часов)
 */
export const useTokenRefresh = () => {
    const { token, refreshToken, setAuth, clearAuth } = useAuthStore();
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRefreshingRef = useRef(false);

    useEffect(() => {
        // Если нет токенов, ничего не делаем
        if (!token || !refreshToken) {
            return;
        }

        const refreshAccessToken = async () => {
            // Предотвращаем множественные одновременные обновления
            if (isRefreshingRef.current) {
                return;
            }

            isRefreshingRef.current = true;

            try {
                const response = await api.post('/auth/refresh', {
                    refresh_token: refreshToken
                });

                const { access_token, refresh_token } = response.data;

                // Получаем текущего пользователя
                const currentUser = useAuthStore.getState().user;
                if (currentUser) {
                    setAuth(currentUser, access_token, refresh_token);
                }

                console.log('Token refreshed successfully');
            } catch (error) {
                console.error('Failed to refresh token:', error);
                // Если не удалось обновить токен, выходим из системы
                clearAuth();
                window.location.href = '/login';
            } finally {
                isRefreshingRef.current = false;
            }
        };

        // Обновляем токен за 30 минут до истечения (8 часов - 30 минут = 7.5 часов)
        const REFRESH_INTERVAL = 7.5 * 60 * 60 * 1000; // 7.5 часов в миллисекундах

        // Запускаем первое обновление через 7.5 часов
        refreshTimerRef.current = setTimeout(() => {
            refreshAccessToken();
            
            // Затем обновляем каждые 7.5 часов
            refreshTimerRef.current = setInterval(refreshAccessToken, REFRESH_INTERVAL);
        }, REFRESH_INTERVAL);

        // Cleanup при размонтировании
        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                clearInterval(refreshTimerRef.current);
            }
        };
    }, [token, refreshToken, setAuth, clearAuth]);
};

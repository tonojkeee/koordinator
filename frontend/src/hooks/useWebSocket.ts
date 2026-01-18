import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../api/client';

interface UseWebSocketOptions {
    onMessage?: (data: unknown) => void;
}

// Global connection registry to prevent duplicate connections in StrictMode
const connectionRegistry = new Map<string, { socket: WebSocket; refCount: number }>();

export const useWebSocket = (channelId: number | undefined, token: string | null, options: UseWebSocketOptions = {}) => {
    const [isConnected, setIsConnected] = useState(false);
    const connectionKeyRef = useRef<string | null>(null);
    const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Store callback in ref to avoid re-creating WebSocket on callback changes
    const onMessageRef = useRef(options.onMessage);

    // Update ref when callback changes
    useEffect(() => {
        onMessageRef.current = options.onMessage;
    }, [options.onMessage]);

    useEffect(() => {
        if (!channelId || !token) {
            return;
        }

        const connectionKey = `channel-${channelId}`;
        connectionKeyRef.current = connectionKey;

        const handleMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ping') return;
                if (onMessageRef.current) {
                    onMessageRef.current(data);
                }
            } catch (error) {
                console.error('❌ Failed to parse message:', error);
            }
        };

        const connect = () => {
            if (!channelId || !token) return;

            // Clear any pending cleanup for this connection
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
                cleanupTimeoutRef.current = null;
            }

            // Check if we already have an active or connecting connection
            const existing = connectionRegistry.get(connectionKey);
            if (existing && (existing.socket.readyState === WebSocket.OPEN || existing.socket.readyState === WebSocket.CONNECTING)) {
                existing.refCount++;
                setIsConnected(existing.socket.readyState === WebSocket.OPEN);
                existing.socket.onmessage = handleMessage;
                return;
            }

            const apiBase = api.defaults.baseURL || import.meta.env.VITE_API_URL || '';
            let wsBase = '';

            if (apiBase.startsWith('http')) {
                wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '');
            } else {
                // If apiBase is relative or missing, try window.location
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host.includes('5173') || window.location.host.includes('3000')
                    ? window.location.hostname + ':5100'
                    : window.location.host;
                wsBase = `${protocol}//${host}`;
            }

            const wsUrl = `${wsBase}/api/chat/ws/${channelId}?token=${token}`;
            const socket = new WebSocket(wsUrl);

            connectionRegistry.set(connectionKey, { socket, refCount: (existing?.refCount || 0) + 1 });

            socket.onopen = () => {
                setIsConnected(true);
                reconnectAttemptRef.current = 0;
            };

            socket.onmessage = handleMessage;

            socket.onclose = (event) => {
                setIsConnected(false);
                connectionRegistry.delete(connectionKey);

                if (token && event.code !== 1000 && event.code !== 1001) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
                    console.log(`📡 WebSocket channel ${channelId} closed. Reconnecting in ${delay}ms...`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptRef.current++;
                        connect();
                    }, delay);
                }
            };

            socket.onerror = (error) => {
                console.error(`❌ WebSocket error in channel ${channelId}:`, error);
            };
        };

        connect();

        const handleOnline = () => {
            if (!isConnected) {
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                reconnectAttemptRef.current = 0;
                connect();
            }
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
            const conn = connectionRegistry.get(connectionKey);
            if (conn) {
                conn.refCount--;
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }

                cleanupTimeoutRef.current = setTimeout(() => {
                    const currentConn = connectionRegistry.get(connectionKey);
                    if (currentConn && currentConn.refCount <= 0) {
                        if (currentConn.socket.readyState === WebSocket.OPEN ||
                            currentConn.socket.readyState === WebSocket.CONNECTING) {
                            currentConn.socket.close(1000, 'Normal Closure');
                        }
                        connectionRegistry.delete(connectionKey);
                    }
                }, 500);
            }
        };
    }, [channelId, token, isConnected]);

    const sendMessage = useCallback((content: string | { content: string; parent_id?: number }) => {
        if (!connectionKeyRef.current) return;
        const conn = connectionRegistry.get(connectionKeyRef.current);
        if (conn && conn.socket.readyState === WebSocket.OPEN) {
            if (typeof content === 'string') {
                conn.socket.send(JSON.stringify({ content }));
            } else {
                conn.socket.send(JSON.stringify(content));
            }
        } else {
            console.error('WebSocket is not connected');
        }
    }, []);

    const sendTyping = useCallback((isTyping: boolean) => {
        if (!connectionKeyRef.current) return;
        const conn = connectionRegistry.get(connectionKeyRef.current);
        if (conn && conn.socket.readyState === WebSocket.OPEN) {
            conn.socket.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
        }
    }, []);

    return { isConnected, sendMessage, sendTyping };
};

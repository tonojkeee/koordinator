import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useConnectionStore } from '../store/useConnectionStore';
import api from '../api/client';

interface GlobalWebSocketOptions {
    onChannelCreated?: (data: unknown) => void;
    onMessageReceived?: (data: unknown) => void;
    onChannelDeleted?: (data: unknown) => void;
    onDocumentShared?: (data: unknown) => void;
    onUserPresence?: (data: { user_id: number; status: 'online' | 'offline' }) => void;
    onTaskAssigned?: (data: { task_id: number; title: string; issuer_name: string }) => void;
    onTaskReturned?: (data: { task_id: number; title: string; sender_name: string }) => void;
    onTaskSubmitted?: (data: { task_id: number; title: string; sender_name: string }) => void;
    onTaskConfirmed?: (data: { task_id: number; title: string; sender_name: string }) => void;
}

// Singleton connection for global WebSocket to prevent duplicates in StrictMode
let globalConnection: { socket: WebSocket; refCount: number } | null = null;
let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

export const useGlobalWebSocket = (token: string | null, options: GlobalWebSocketOptions = {}) => {
    const [isConnected, setIsConnected] = useState(false);

    const onChannelCreatedRef = useRef(options.onChannelCreated);
    const onMessageReceivedRef = useRef(options.onMessageReceived);
    const onChannelDeletedRef = useRef(options.onChannelDeleted);
    const onDocumentSharedRef = useRef(options.onDocumentShared);
    const onUserPresenceRef = useRef(options.onUserPresence);
    const onTaskAssignedRef = useRef(options.onTaskAssigned);
    const onTaskReturnedRef = useRef(options.onTaskReturned);
    const onTaskSubmittedRef = useRef(options.onTaskSubmitted);
    const onTaskConfirmedRef = useRef(options.onTaskConfirmed);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        onChannelCreatedRef.current = options.onChannelCreated;
        onMessageReceivedRef.current = options.onMessageReceived;
        onChannelDeletedRef.current = options.onChannelDeleted;
        onDocumentSharedRef.current = options.onDocumentShared;
        onUserPresenceRef.current = options.onUserPresence;
        onTaskAssignedRef.current = options.onTaskAssigned;
        onTaskReturnedRef.current = options.onTaskReturned;
        onTaskSubmittedRef.current = options.onTaskSubmitted;
        onTaskConfirmedRef.current = options.onTaskConfirmed;
    }, [options.onChannelCreated, options.onMessageReceived, options.onChannelDeleted, options.onDocumentShared, options.onUserPresence, options.onTaskAssigned, options.onTaskReturned, options.onTaskSubmitted, options.onTaskConfirmed]);

    useEffect(() => {
        if (!token) {
            return;
        }

        // Clear any pending cleanup
        if (cleanupTimeout) {
            clearTimeout(cleanupTimeout);
            cleanupTimeout = null;
        }

        const handleMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ping') return;

                if (data.type === 'channel_created' && onChannelCreatedRef.current) {
                    onChannelCreatedRef.current(data);
                } else if ((data.type === 'new_message' || data.type === 'message_received') && onMessageReceivedRef.current) {
                    onMessageReceivedRef.current(data);
                } else if (data.type === 'channel_deleted' && onChannelDeletedRef.current) {
                    onChannelDeletedRef.current(data);
                } else if (data.type === 'document_shared' && onDocumentSharedRef.current) {
                    onDocumentSharedRef.current(data);
                } else if (data.type === 'user_presence' && onUserPresenceRef.current) {
                    onUserPresenceRef.current(data);
                } else if (data.type === 'new_task' && onTaskAssignedRef.current) {
                    onTaskAssignedRef.current(data);
                } else if (data.type === 'task_returned' && onTaskReturnedRef.current) {
                    onTaskReturnedRef.current(data);
                } else if (data.type === 'task_submitted' && onTaskSubmittedRef.current) {
                    onTaskSubmittedRef.current(data);
                } else if (data.type === 'task_confirmed' && onTaskConfirmedRef.current) {
                    onTaskConfirmedRef.current(data);
                }
            } catch (error) {
                console.error('❌ Failed to parse WebSocket message:', error);
            }
        };

        const connect = () => {
            if (!token) return;

            // If already connected or connecting, just increment refCount
            if (globalConnection && (globalConnection.socket.readyState === WebSocket.OPEN || globalConnection.socket.readyState === WebSocket.CONNECTING)) {
                globalConnection.refCount++;
                setIsConnected(globalConnection.socket.readyState === WebSocket.OPEN);
                globalConnection.socket.onmessage = handleMessage;
                return;
            }

            // Derive WS URL from API base URL to ensure consistency
            const apiBase = api.defaults.baseURL || import.meta.env.VITE_API_URL || '';
            const wsBase = apiBase.replace(/^http/, 'ws').replace('/api', '');
            const wsUrl = `${wsBase}/api/chat/ws/user?token=${token}`;
            const socket = new WebSocket(wsUrl);

            globalConnection = { socket, refCount: (globalConnection?.refCount || 0) + 1 };

            socket.onopen = () => {
                console.log('✅ Global WebSocket connected');
                setIsConnected(true);
                useConnectionStore.getState().setIsConnected(true);
                reconnectAttemptRef.current = 0;
            };

            socket.onmessage = handleMessage;

            socket.onclose = (event) => {
                console.log(`📡 Global WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
                setIsConnected(false);
                useConnectionStore.getState().setIsConnected(false);

                // Important: Clear the global reference if it's THIS socket that closed
                if (globalConnection?.socket === socket) {
                    globalConnection = null;
                }

                // Check for Policy Violation (Invalid Token/Auth)
                if (event.code === 1008) {
                    console.error('❌ Global WebSocket Authentication Failed. Logging out.');
                    useAuthStore.getState().clearAuth();
                    return;
                }

                // Exponential backoff reconnection (max 30s)
                if (token && event.code !== 1000 && event.code !== 1001) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
                    console.log(`📡 Global WebSocket closed. Reconnecting in ${delay}ms... (Attempt ${reconnectAttemptRef.current + 1})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptRef.current++;
                        connect();
                    }, delay);
                }
            };

            socket.onerror = (error) => {
                console.error('❌ Global WebSocket error:', error);
            };
        };

        connect();

        const handleOnline = () => {
            console.log('🌐 Network back online, forcing WebSocket reconnection...');
            // Force reset of current connection to ensure a fresh start
            if (globalConnection) {
                if (globalConnection.socket.readyState === WebSocket.OPEN ||
                    globalConnection.socket.readyState === WebSocket.CONNECTING) {
                    globalConnection.socket.close(4000, 'Network state change');
                }
                globalConnection = null;
            }
            reconnectAttemptRef.current = 0;
            connect();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
            if (globalConnection) {
                globalConnection.refCount--;
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }

                cleanupTimeout = setTimeout(() => {
                    if (globalConnection && globalConnection.refCount <= 0) {
                        if (globalConnection.socket.readyState === WebSocket.OPEN ||
                            globalConnection.socket.readyState === WebSocket.CONNECTING) {
                            globalConnection.socket.close(1000, 'Normal Closure');
                        }
                        globalConnection = null;
                    }
                }, 500);
            }
        };
    }, [token, isConnected]);

    return { isConnected };
};

import React, { useCallback, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useUnreadStore } from '../../store/useUnreadStore';
import { useConnectionStore } from '../../store/useConnectionStore';
import { LogOut, MessageCircle, Shield, HelpCircle, FileText, Archive, Book, ClipboardList, Mail } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTasksIssued } from '../../features/tasks/tasksApi';
import { useGlobalWebSocket } from '../../hooks/useGlobalWebSocket';
import { useToast } from '../../design-system';
import api from '../../api/client';
import type { Channel } from '../../types';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../design-system';
import { playNotificationSound } from '../../utils/sound';
import DocumentViewer from '../../features/board/components/DocumentViewer';
import { useDocumentViewer } from '../../features/board/store/useDocumentViewer';
import { sendSystemNotification } from '../../services/notificationService';
import packageJson from '../../../package.json';

const MainLayout: React.FC = () => {
    const { t } = useTranslation();
    const { user, token, clearAuth } = useAuthStore();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const openViewer = useDocumentViewer(state => state.open);
    const { addUnread, unreadCounts, syncUnreads, unreadDocs, addDocUnread, clearDocUnread, tasksUnreadCount, setTasksUnread, tasksReviewCount, setTasksReview } = useUnreadStore();
    const { isConnected, isOffline } = useConnectionStore();

    const getFullUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = (import.meta.env.VITE_API_URL || api.defaults.baseURL || '').replace('/api', '');
        return `${baseUrl}${path}`;
    };

    // Fetch channels to get initial unread counts
    const { data: channels } = useQuery<Channel[]>({
        queryKey: ['channels'],
        queryFn: async () => {
            const res = await api.get('/chat/channels');
            return res.data;
        },
        enabled: !!token,
    });

    // Sync backend unread counts to store
    useEffect(() => {
        if (channels && Array.isArray(channels)) {
            const counts: Record<number, number> = {};
            channels.forEach(c => {
                counts[c.id] = c.unread_count;
            });
            syncUnreads(counts);
        }
    }, [channels, syncUnreads]);

    // Clear document unread when visiting the board
    useEffect(() => {
        if (location.pathname === '/board') {
            clearDocUnread();
        }
    }, [location.pathname, clearDocUnread]);

    // Fetch received tasks for badge count
    const { data: tasks } = useQuery<unknown[]>({
        queryKey: ['tasks', 'received'],
        queryFn: async () => {
            const res = await api.get('/tasks/received');
            return res.data;
        },
        enabled: !!token,
    });

    // Update unread count based on active tasks
    useEffect(() => {
        if (Array.isArray(tasks)) {
            // Count active tasks (IN_PROGRESS, OVERDUE)
            const activeCount = (tasks as { status: string }[]).filter((t) =>
                t.status === 'in_progress' || t.status === 'overdue'
            ).length;
            setTasksUnread(activeCount);
        }
    }, [tasks, setTasksUnread]);

    // We need to fetch ISSUED tasks to know how many are on review
    const { data: issuedTasks } = useTasksIssued();

    useEffect(() => {
        if (Array.isArray(issuedTasks)) {
            const reviews = issuedTasks.filter(t => t.status === 'on_review').length;
            setTasksReview(reviews);
        }
    }, [issuedTasks, setTasksReview]);

    const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

    const onChannelCreated = useCallback((data: unknown) => {
        const { channel } = data as { channel: Channel };
        queryClient.invalidateQueries({ queryKey: ['channels'] });
        if (channel && !channel.is_direct) {
            addToast({
                type: 'success',
                title: t('chat.new_space'),
                message: t('chat.new_space_created', { name: channel.display_name || channel.name }),
                duration: 4000
            });

            if (user?.notify_browser) {
                sendSystemNotification(t('chat.new_space'), {
                    body: t('chat.new_space_created', { name: channel.display_name || channel.name }),
                    icon: '/favicon.ico',
                    tag: `channel-${channel.id}`,
                });
            }
        }
    }, [queryClient, addToast, user?.notify_browser, t]);

    const onMessageReceived = useCallback((data: unknown) => {
        const msgData = data as {
            channel_id: number;
            is_mentioned?: boolean;
            message?: {
                document_id?: number;
                sender_name?: string;
                content?: string;
            };
        };
        // Ensure channelId is a number
        const channelId = Number(msgData.channel_id);
        const currentChannelId = location.pathname.match(/\/chat\/(\d+)/)?.[1];
        const currentChannelIdNum = currentChannelId ? Number(currentChannelId) : null;

        // Strict comparison
        if (!currentChannelIdNum || currentChannelIdNum !== channelId) {
            addUnread(channelId);

            // Invalidate to fetch latest channel order/metadata
            queryClient.invalidateQueries({ queryKey: ['channels'] });

            const channel = Array.isArray(channels) ? channels.find(c => c.id === channelId) : undefined;
            const isMuted = channel?.mute_until ? new Date(channel.mute_until) > new Date() : false;

            if (user?.notify_sound && !isMuted) {
                playNotificationSound();
            }

            const shouldNotify = user?.notify_browser !== false;
            const isDocumentShare = !!msgData.message?.document_id;

            if (isDocumentShare && msgData.message?.document_id) {
                addDocUnread(msgData.message.document_id, channelId);
            }

            if (shouldNotify && !isDocumentShare && !isMuted) {
                const senderName = msgData.message?.sender_name || 'Someone';
                const content = msgData.message?.content || 'New message';
                const isMentioned = msgData.is_mentioned;

                const title = isMentioned
                    ? t('chat.mentioned_by', { name: senderName })
                    : senderName;

                if (isMentioned) {
                    addToast({
                        type: 'info',
                        title: title,
                        message: content,
                        duration: 5000,
                        onClick: () => navigate(`/chat/${channelId}`)
                    });
                }

                sendSystemNotification(title, {
                    body: content,
                    icon: '/favicon.ico',
                    tag: `message-${channelId}`,
                });
            }
        }
    }, [addUnread, location.pathname, user?.notify_browser, user?.notify_sound, queryClient, addDocUnread, channels, t, navigate, addToast]);

    const onChannelDeleted = useCallback((data: unknown) => {
        const { channel_id, deleted_by, is_direct, channel_name } = data as { channel_id: number; deleted_by: { full_name?: string; username: string } | null; is_direct: boolean; channel_name: string };
        const currentChannelId = location.pathname.match(/\/chat\/(\d+)/)?.[1];
        queryClient.invalidateQueries({ queryKey: ['channels'] });

        const { clearUnread } = useUnreadStore.getState();
        clearUnread(channel_id);

        if (currentChannelId && parseInt(currentChannelId) === channel_id) {
            navigate('/');
        }

        const deletedByName = deleted_by?.full_name || deleted_by?.username || t('common.unknown');
        addToast({
            type: 'deleted',
            title: t('chat.chat_deleted'),
            message: is_direct
                ? t('chat.direct_chat_deleted_by', { name: deletedByName })
                : t('chat.channel_deleted_by', { name: deletedByName, channel: '' }),
            duration: 6000
        });

        if (user?.notify_browser) {
            sendSystemNotification(t('chat.chat_deleted'), {
                body: is_direct
                    ? t('chat.direct_chat_deleted_by', { name: deletedByName })
                    : t('chat.channel_deleted_by', { name: deletedByName, channel: channel_name }),
                icon: '/favicon.ico',
                tag: `channel-deleted-${channel_id}`,
            });
        }
    }, [location.pathname, queryClient, navigate, addToast, user?.notify_browser, t]);

    const onDocumentShared = useCallback((data: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sharedData = data as any;
        queryClient.invalidateQueries({ queryKey: ['documents', 'received'] });

        const fileUrl = getFullUrl(sharedData.file_path);

        addToast({
            type: 'success',
            title: t('common.new_document'),
            message: t('common.document_shared_by', { owner: sharedData.owner_name, title: sharedData.title }),
            duration: 10000,
            onClick: () => {
                if (fileUrl) {
                    openViewer(fileUrl, sharedData.title);
                }
            }
        });

        const channelId = sharedData.channel_id;
        const currentChannelId = location.pathname.match(/\/chat\/(\d+)/)?.[1];
        const isViewingChannel = currentChannelId && parseInt(currentChannelId) === channelId;

        if (location.pathname !== '/board' && !isViewingChannel) {
            addDocUnread(sharedData.document_id, channelId);
        }

        const shouldNotify = user?.notify_browser !== false;

        if (shouldNotify) {
            sendSystemNotification(t('common.new_document'), {
                body: t('common.document_shared_by', { owner: sharedData.owner_name, title: sharedData.title }),
                icon: '/favicon.ico',
                tag: `doc-${sharedData.id}`,
            });
        }
    }, [queryClient, addToast, openViewer, user?.notify_browser, t, addDocUnread, location.pathname]);

    const onUserPresence = useCallback((data: { user_id: number; status: 'online' | 'offline' }) => {
        const delta = data.status === 'online' ? 1 : -1;

        // Update channel_members cache for ALL channels using predicate
        queryClient.getQueriesData<Array<{ id: number; is_online?: boolean; last_seen?: string }>>({ queryKey: ['channel_members'] }).forEach(([queryKey, queryData]) => {
            if (queryData && Array.isArray(queryData)) {
                const updated = queryData.map(m =>
                    m.id === data.user_id
                        ? { ...m, is_online: data.status === 'online', last_seen: data.status === 'offline' ? new Date().toISOString() : m.last_seen }
                        : m
                );
                queryClient.setQueryData(queryKey, updated);
            }
        });

        // Update channels cache for DM other_user.is_online
        queryClient.setQueryData<Channel[]>(['channels'], (old) => {
            if (!old) return old;
            return old.map(c => {
                if (c.is_direct && c.other_user?.id === data.user_id) {
                    return {
                        ...c,
                        other_user: {
                            ...c.other_user,
                            is_online: data.status === 'online',
                            last_seen: data.status === 'offline' ? new Date().toISOString() : c.other_user.last_seen
                        }
                    };
                }
                return c;
            });
        });

        // Update current channel online_count directly in cache
        queryClient.setQueriesData({ queryKey: ['channel'] }, (old: unknown) => {
            if (!old || typeof old !== 'object') return old;
            const channel = old as Channel;
            // Only update if this user is a member (we'll check against channel_members)
            const membersCache = queryClient.getQueryData<Array<{ id: number }>>(['channel_members', String(channel.id)]);
            const isMember = membersCache?.some(m => m.id === data.user_id);
            if (isMember) {
                const newCount = Math.max(0, (channel.online_count || 0) + delta);
                return { ...channel, online_count: newCount };
            }
            return old;
        });
    }, [queryClient]);

    const onTaskAssigned = useCallback((data: { task_id: number; title: string; issuer_name: string }) => {
        // Invalidate received tasks to show new task immediately
        queryClient.invalidateQueries({ queryKey: ['tasks', 'received'] });

        if (user?.notify_sound) {
            playNotificationSound();
        }

        const title = t('tasks.new_task', 'Новое указание');
        const message = t('tasks.new_task_assigned', { title: data.title, issuer: data.issuer_name, defaultValue: `Получено новое указание: "${data.title}" от ${data.issuer_name}` });

        addToast({
            type: 'info',
            title: title,
            message: message,
            duration: 6000,
            onClick: () => navigate(`/tasks?tab=received&taskId=${data.task_id}`)
        });

        if (user?.notify_browser) {
            sendSystemNotification(title, {
                body: message,
                icon: '/favicon.ico',
                tag: `task-${data.task_id}`,
            });
        }
    }, [queryClient, user?.notify_sound, user?.notify_browser, t, addToast, navigate]);

    const onTaskReturned = useCallback((data: { task_id: number; title: string; sender_name: string }) => {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'received'] });

        if (user?.notify_sound) playNotificationSound();

        const title = t('tasks.returned', 'Указание возвращено');
        const message = t('tasks.task_returned_desc', { title: data.title, sender: data.sender_name, defaultValue: `Указание "${data.title}" возвращено на доработку: ${data.sender_name}` });

        addToast({
            type: 'warning',
            title: title,
            message: message,
            duration: 6000,
            onClick: () => navigate(`/tasks?tab=received&taskId=${data.task_id}`)
        });

        if (user?.notify_browser) {
            sendSystemNotification(title, {
                body: message,
                icon: '/favicon.ico',
                tag: `task-returned-${data.task_id}`,
            });
        }
    }, [queryClient, user?.notify_sound, user?.notify_browser, t, addToast, navigate]);

    const onTaskSubmitted = useCallback((data: { task_id: number; title: string; sender_name: string }) => {
        // Invalidate issues tasks for issuer
        queryClient.invalidateQueries({ queryKey: ['tasks', 'issued'] });

        if (user?.notify_sound) playNotificationSound();

        const title = t('tasks.submitted', 'Отчет об исполнении');
        const message = t('tasks.task_submitted_desc', { title: data.title, sender: data.sender_name, defaultValue: `Получен отчет по указанию "${data.title}" от ${data.sender_name}` });

        addToast({
            type: 'success',
            title: title,
            message: message,
            duration: 6000,
            onClick: () => navigate(`/tasks?tab=issued&taskId=${data.task_id}`)
        });

        if (user?.notify_browser) {
            sendSystemNotification(title, {
                body: message,
                icon: '/favicon.ico',
                tag: `task-submitted-${data.task_id}`,
            });
        }
    }, [queryClient, user?.notify_sound, user?.notify_browser, t, addToast, navigate]);

    const onTaskConfirmed = useCallback((data: { task_id: number; title: string; sender_name: string }) => {
        // Invalidate received tasks for assignee
        queryClient.invalidateQueries({ queryKey: ['tasks', 'received'] });

        if (user?.notify_sound) playNotificationSound();

        const title = t('tasks.confirmed', 'Указание принято');
        const message = t('tasks.task_confirmed_desc', { title: data.title, sender: data.sender_name, defaultValue: `Указание "${data.title}" принято и перенесено в архив` });

        addToast({
            type: 'success',
            title: title,
            message: message,
            duration: 6000,
            onClick: () => navigate(`/tasks?tab=completed&taskId=${data.task_id}`)
        });

        if (user?.notify_browser) {
            sendSystemNotification(title, {
                body: message,
                icon: '/favicon.ico',
                tag: `task-confirmed-${data.task_id}`,
            });
        }
    }, [queryClient, user?.notify_sound, user?.notify_browser, t, addToast, navigate]);

    useGlobalWebSocket(token, {
        onChannelCreated,
        onMessageReceived,
        onChannelDeleted,
        onDocumentShared,
        onUserPresence,
        onTaskAssigned,
        onTaskReturned,
        onTaskSubmitted,
        onTaskConfirmed
    });

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Connection status notifications
    const wasOfflineRef = useRef(isOffline);
    const wasConnectedRef = useRef(isConnected);

    useEffect(() => {
        if (isOffline && !wasOfflineRef.current) {
            addToast({
                type: 'error',
                title: t('common.offline_mode', 'Оффлайн-режим'),
                message: t('common.no_internet_desc', 'Проверьте подключение к интернету'),
                duration: 5000
            });
        } else if (!isOffline && wasOfflineRef.current) {
            addToast({
                type: 'success',
                title: t('common.online', 'В сети'),
                message: t('common.internet_restored', 'Подключение к интернету восстановлено'),
                duration: 3000
            });
        }
        wasOfflineRef.current = isOffline;
    }, [isOffline, addToast, t]);

    useEffect(() => {
        if (!isOffline) {
            if (!isConnected && wasConnectedRef.current) {
                addToast({
                    type: 'warning',
                    title: t('common.reconnecting', 'Подключение...'),
                    message: t('common.connection_lost_desc', 'Связь с сервером прервана, пытаемся восстановить...'),
                    duration: 4000
                });
            } else if (isConnected && !wasConnectedRef.current) {
                addToast({
                    type: 'success',
                    title: t('common.connected', 'Подключено'),
                    message: t('common.server_sync_complete', 'Связь с сервером восстановлена'),
                    duration: 3000
                });
            }
        }
        wasConnectedRef.current = isConnected;
    }, [isConnected, isOffline, addToast, t]);

    const handleLogout = () => {
        clearAuth();
        navigate('/login');
    };
 
    // Fetch public system settings (for system notice)
    const { data: systemSettings } = useQuery<Record<string, string>>({
        queryKey: ['public-settings'],
        queryFn: async () => (await api.get('/admin/public-settings')).data,
        enabled: !!token,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const systemNotice = systemSettings?.system_notice;

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-outfit overflow-hidden">
            {/* Connectivity Banner */}
            {isOffline ? (
                <div className="bg-amber-500 text-white px-4 py-1.5 text-center text-xs font-black tracking-[0.15em] uppercase shadow-lg border-b border-white/10 z-[101] animate-in slide-in-from-top-full duration-500 flex items-center justify-center gap-3">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span>{t('common.offline_mode', 'ОФФЛАЙН-РЕЖИМ')}</span>
                </div>
            ) : !isConnected ? (
                <div className="bg-indigo-600 text-white px-4 py-1.5 text-center text-xs font-black tracking-[0.15em] uppercase shadow-lg border-b border-white/10 z-[101] animate-in slide-in-from-top-full duration-500 flex items-center justify-center gap-3">
                    <div className="w-2 h-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('common.reconnecting', 'ПОДКЛЮЧЕНИЕ...')}</span>
                </div>
            ) : null}

            {/* System Notice Banner */}
            {systemNotice && (
                <div className="bg-gradient-to-r from-red-500/90 to-rose-600/90 backdrop-blur-md text-white px-4 py-1.5 text-center text-xs font-bold tracking-wide shadow-lg border-b border-white/10 z-[100] animate-in slide-in-from-top-full duration-500 whitespace-nowrap overflow-hidden text-ellipsis">
                    {systemNotice}
                </div>
            )}

            <div className="flex flex-1 min-h-0 p-2 gap-2">
                {/* Sidebar - Professional Clean Design */}
                <aside className="group relative flex flex-col bg-slate-900/95 backdrop-blur-xl text-white z-50 rounded-3xl shadow-xl py-6 overflow-hidden transition-all duration-300 ease-out w-20 hover:w-64 border border-slate-700/50">
                    {/* Subtle Background Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-800/30 to-transparent pointer-events-none" />
                    
                    {/* Logo Section */}
                    <div className="flex justify-center mb-8 relative z-10">
                        <div className="relative group/logo cursor-pointer">
                            {/* Always rotating elegant ring */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-60 group-hover/logo:opacity-100 transition-opacity duration-500">
                                <div
                                    className="w-[60px] h-[60px] rounded-2xl animate-spin-slow border border-indigo-500/20 group-hover/logo:border-indigo-500/40"
                                    style={{
                                        background: 'conic-gradient(from 0deg, transparent, rgba(99,102,241,0.2), transparent)',
                                        animationDuration: '10s'
                                    }}
                                />
                            </div>

                            {/* Always pulsing subtle glow */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-500/8 animate-pulse group-hover/logo:bg-indigo-500/15 transition-colors duration-500" />
                            </div>

                            {/* Logo Container */}
                            <div className="relative w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center p-3 shadow-lg border border-slate-700 group-hover/logo:border-indigo-500/50 transition-all duration-500 group-hover/logo:scale-105 group-hover/logo:shadow-indigo-500/20">
                                {/* Inner subtle glow */}
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
                                
                                <img
                                    src="/icon.png"
                                    alt="GIS Coordinator"
                                    className="w-full h-full object-contain drop-shadow-sm group-hover/logo:drop-shadow-md transition-all duration-500 group-hover/logo:brightness-110"
                                />
                            </div>

                            {/* Always visible bottom accent that enhances on hover */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent rounded-full group-hover/logo:w-12 group-hover/logo:via-indigo-500/60 transition-all duration-500" />
                        </div>
                    </div>

                    {/* Navigation Section */}
                    <nav className="flex-1 flex flex-col space-y-1 px-3 relative z-10">
                        {/* Main Navigation */}
                        <SidebarItem
                            to="/chat"
                            icon={<MessageCircle size={20} />}
                            title={t('sidebar.chats')}
                            badge={totalUnread}
                        />
                        <SidebarItem
                            to="/email"
                            icon={<Mail size={20} />}
                            title={t('email.title', 'Почта')}
                        />
                        <SidebarItem 
                            to="/company" 
                            icon={<Book size={20} />} 
                            title={t('company.title', 'Справочник')} 
                        />
                        <SidebarItem
                            to="/tasks"
                            icon={<ClipboardList size={20} />}
                            title={t('tasks.title', 'Указания')}
                            badge={tasksUnreadCount}
                            warningBadge={tasksReviewCount}
                        />

                        {/* Simple Divider */}
                        <div className="h-px bg-slate-700/50 my-4" />

                        {/* Documents */}
                        <SidebarItem
                            to="/board"
                            icon={<FileText size={20} />}
                            title={t('board.title')}
                            badge={unreadDocs.length}
                        />
                        <SidebarItem 
                            to="/archive" 
                            icon={<Archive size={20} />} 
                            title={t('sidebar.archive')} 
                        />
                        <SidebarItem
                            to="/zsspd"
                            icon={<Shield size={20} className="text-amber-400" />}
                            title={t('zsspd.title')}
                        />

                        {/* Simple Divider */}
                        <div className="h-px bg-slate-700/50 my-4" />

                        {/* System */}
                        <SidebarItem 
                            to="/help" 
                            icon={<HelpCircle size={20} />} 
                            title={t('help.title')} 
                        />
                        {user?.role === 'admin' && (
                            <SidebarItem 
                                to="/admin" 
                                icon={<Shield size={20} />} 
                                title={t('admin.dashboard')} 
                            />
                        )}
                    </nav>

                    {/* Bottom Section */}
                    <div className="mt-auto flex flex-col space-y-2 px-3 relative z-10">
                        {/* Simple Divider */}
                        <div className="h-px bg-slate-700/50 mb-3" />
                        
                        {/* Profile */}
                        <Link
                            to="/settings"
                            className="group/profile relative flex items-center p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-300"
                            title={user?.full_name || user?.username || ''}
                        >
                            {/* Avatar - Absolutely positioned for perfect centering */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:left-3 group-hover:translate-x-0 group-hover/profile:scale-105">
                                <Avatar
                                    src={user?.avatar_url}
                                    name={user?.full_name || user?.username || ''}
                                    size="sm"
                                    className="ring-2 ring-slate-700 group-hover/profile:ring-indigo-500/50 transition-all duration-300"
                                />
                            </div>
                            
                            {/* Invisible spacer */}
                            <div className="w-5 h-5 opacity-0"></div>
                            
                            {/* Label */}
                            <span className="absolute left-12 top-1/2 -translate-y-1/2 text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300">
                                {user?.full_name || user?.username || ''}
                            </span>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="group/logout relative flex items-center p-3 rounded-xl text-slate-400 hover:text-white hover:bg-red-500/10 transition-all duration-300"
                        >
                            {/* Icon - Absolutely positioned */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:left-3 group-hover:translate-x-0 group-hover/logout:scale-105">
                                <LogOut size={20} />
                            </div>
                            
                            {/* Invisible spacer */}
                            <div className="w-5 h-5 opacity-0"></div>
                            
                            {/* Label */}
                            <span className="absolute left-12 top-1/2 -translate-y-1/2 text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300">
                                {t('sidebar.logout')}
                            </span>
                        </button>
                    </div>

                    {/* Version Info */}
                    <div className="flex justify-center pt-4 pb-2 relative z-10">
                        <span className="text-xs text-slate-500 font-medium">
                            v{packageJson.version}
                        </span>
                    </div>
                </aside>

                <main className="flex-1 relative flex overflow-hidden bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-white/40 to-rose-50/40 -z-10" />
                    <Outlet />
                </main>

                <DocumentViewer />
            </div>
        </div>
    );
};

interface SidebarItemProps {
    to: string;
    icon: React.ReactNode;
    title: string;
    badge?: number;
    warningBadge?: number;
}

const SidebarItem = ({ to, icon, title, badge, warningBadge }: SidebarItemProps) => {
    const location = useLocation();
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    const showBadge = badge !== undefined && badge > 0;
    const showWarningBadge = warningBadge !== undefined && warningBadge > 0;

    return (
        <Link
            to={to}
            className={`group/item relative flex items-center p-3 rounded-xl transition-all duration-200 ${
                isActive
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-indigo-600/90'
            }`}
        >
            {/* Active indicator */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
            )}

            {/* Icon - Absolutely positioned for perfect centering and smooth animation */}
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all duration-200 group-hover:left-3 group-hover:translate-x-0 ${
                isActive ? 'scale-105' : 'group-hover/item:scale-105'
            }`}>
                {icon}
            </div>

            {/* Invisible spacer to maintain height */}
            <div className="w-5 h-5 opacity-0"></div>

            {/* Label - Shows on sidebar hover */}
            <span className="absolute left-12 top-1/2 -translate-y-1/2 text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200">
                {title}
            </span>

            {/* Badges */}
            {showBadge && (
                <div className="absolute top-1 right-1 group-hover:right-auto group-hover:left-6 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg ring-2 ring-slate-900 z-20 transition-all duration-200">
                    {badge > 99 ? '99+' : badge}
                </div>
            )}

            {showWarningBadge && (
                <div className="absolute bottom-1 right-1 group-hover:right-auto group-hover:left-6 min-w-[18px] h-[18px] bg-amber-500 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-900 shadow-lg ring-2 ring-slate-900 z-20 transition-all duration-200">
                    {warningBadge > 99 ? '99+' : warningBadge}
                </div>
            )}

            {/* Tooltip - Only shows in collapsed state */}
            <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl opacity-0 group-hover/item:opacity-100 group-hover:opacity-0 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 shadow-xl border border-slate-700">
                {title}
                {showBadge && <span className="ml-2 text-red-400">({badge})</span>}
                {showWarningBadge && <span className="ml-2 text-amber-400">({warningBadge})</span>}
            </div>
        </Link>
    );
};

export default MainLayout;

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import type { Channel } from '../../types';
import { AxiosError } from 'axios';
import { Plus, Hash, Loader2, Trash2, Layers, MessageSquare, Pin, BellOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { useUnreadStore } from '../../store/useUnreadStore';
import { abbreviateRank } from '../../utils/formatters';
import { Modal, Input, TextArea, Button } from '../../design-system';
import Avatar from '../design-system';
import MuteModal from './MuteModal';


const ChannelSidebar: React.FC = () => {
    const { t } = useTranslation();
    const { channelId } = useParams();
    const navigate = useNavigate();
    const currentUser = useAuthStore((state) => state.user);
    const { unreadCounts, clearUnread } = useUnreadStore();

    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [newChannel, setNewChannel] = useState({ name: '', description: '' });
    const [muteModalChannelId, setMuteModalChannelId] = useState<number | null>(null);

    // Clear unread when user opens a channel
    useEffect(() => {
        if (channelId) {
            clearUnread(Number(channelId));
        }
    }, [channelId, clearUnread]);

    // Note: Global WebSocket for channel_created events is handled in MainLayout

    const { data: channels, isLoading } = useQuery<Channel[]>({
        queryKey: ['channels'],
        queryFn: async () => {
            const res = await api.get('/chat/channels');
            return res.data;
        },
    });

    const [extraChannel, setExtraChannel] = useState<Channel | null>(null);

    // If current channel is not in the list (e.g. empty DM), fetch it separately
    useEffect(() => {
        if (channelId && channels && Array.isArray(channels) && !channels.some(c => c.id === Number(channelId))) {
            api.get(`/chat/channels/${channelId}`)
                .then(res => setExtraChannel(res.data))
                .catch(() => setExtraChannel(null));
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setExtraChannel(null);
        }
    }, [channelId, channels]);

    const getUnreadDisplay = (channel: Channel) => {
        const count = unreadCounts[channel.id] || 0;
        if (count <= 0 || Number(channelId) === channel.id) return null;
        return count > 99 ? '99+' : count;
    };

    const createChannelMutation = useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const res = await api.post('/chat/channels', data);
            return res.data;
        },
        onSuccess: (newChannel) => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            setIsCreating(false);
            setNewChannel({ name: '', description: '' });
            navigate(`/chat/${newChannel.id}`);
        },
    });

    const deleteChannelMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/chat/channels/${id}`);
        },
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });

            // Remove cached data for the deleted channel to prevent stale data if ID is reused
            queryClient.removeQueries({ queryKey: ['messages', String(deletedId)] });
            queryClient.removeQueries({ queryKey: ['channel', String(deletedId)] });
            queryClient.removeQueries({ queryKey: ['channel_members', String(deletedId)] });

            if (Number(channelId) === deletedId) {
                navigate('/');
            }
        },
        onError: (error: unknown) => {
            const err = error as AxiosError<{ detail: string }>;
            alert(t('common.error') + ': ' + (err.response?.data?.detail || err.message));
        }
    });

    const togglePinMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await api.post(`/chat/channels/${id}/pin`);
            return { id, is_pinned: res.data.is_pinned };
        },
        onMutate: async (id: number) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['channels'] });

            // Snapshot the previous value
            const previousChannels = queryClient.getQueryData<Channel[]>(['channels']);

            // Optimistically update to the new value
            queryClient.setQueryData<Channel[]>(['channels'], (old) => {
                if (!old) return [];
                return old.map(c =>
                    c.id === id ? { ...c, is_pinned: !c.is_pinned } : c
                );
            });

            // Also update extraChannel state if it's the one being pinned
            if (extraChannel && extraChannel.id === id) {
                setExtraChannel(prev => prev ? { ...prev, is_pinned: !prev.is_pinned } : null);
            }

            return { previousChannels };
        },
        onError: (_err, _id, context: unknown) => {
            // Rollback if something went wrong
            const ctx = context as { previousChannels: Channel[] };
            if (ctx?.previousChannels) {
                queryClient.setQueryData(['channels'], ctx.previousChannels);
            }
        },
        onSettled: () => {
            // Always refetch after error or success to make sure we're in sync with the server
            queryClient.invalidateQueries({ queryKey: ['channels'] });
        }
    });

    const muteMutation = useMutation({
        mutationFn: async ({ channelId, muteUntil }: { channelId: number; muteUntil: string | null }) => {
            const { data } = await api.post(`/chat/channels/${channelId}/mute`, null, {
                params: { mute_until: muteUntil }
            });
            return data;
        },
        onSuccess: (_data, variables) => {
            queryClient.setQueryData(['channels'], (old: Channel[] | undefined) => {
                if (!old) return old;
                return old.map(c => c.id === variables.channelId ? { ...c, mute_until: variables.muteUntil } : c);
            });
            setMuteModalChannelId(null);
        }
    });

    const handleMute = (duration: '1h' | '8h' | '24h' | 'forever' | null) => {
        if (!muteModalChannelId) return;

        let muteUntil: string | null = null;
        if (duration) {
            const date = new Date();
            switch (duration) {
                case '1h': date.setHours(date.getHours() + 1); break;
                case '8h': date.setHours(date.getHours() + 8); break;
                case '24h': date.setHours(date.getHours() + 24); break;
                case 'forever': date.setFullYear(date.getFullYear() + 100); break;
            }
            muteUntil = date.toISOString();
        }

        muteMutation.mutate({ channelId: muteModalChannelId, muteUntil });
    };

    const handleCreateChannel = (e: React.FormEvent) => {
        e.preventDefault();
        if (newChannel.name.trim()) {
            createChannelMutation.mutate({
                name: newChannel.name.trim(),
                description: newChannel.description.trim() || undefined
            } as { name: string; description?: string });
        }
    };

    const channelsList = Array.isArray(channels) ? channels : [];
    const pinnedChannels = channelsList.filter(c => c.is_pinned);
    const publicChannels = channelsList.filter(c => !c.is_direct && !c.is_pinned);
    if (extraChannel && !extraChannel.is_direct && !publicChannels.some(c => c.id === extraChannel.id) && !extraChannel.is_pinned) {
        publicChannels.push(extraChannel);
    }

    const directChannels = channelsList.filter(c => c.is_direct && !c.is_pinned);
    if (extraChannel && extraChannel.is_direct && !directChannels.some(c => c.id === extraChannel.id) && !extraChannel.is_pinned) {
        directChannels.push(extraChannel);
    }

    // Sort extraChannel into pinned if needed
    if (extraChannel && extraChannel.is_pinned && !pinnedChannels.some(c => c.id === extraChannel.id)) {
        pinnedChannels.push(extraChannel);
    }

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (window.confirm(t('chat.deleteConfirm'))) {
            deleteChannelMutation.mutate(id);
        }
    };

    const handlePin = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        togglePinMutation.mutate(id);
    };

    return (
        <div className="w-80 flex flex-col bg-white/40 backdrop-blur-3xl shadow-[4px_0_40px_-10px_rgba(0,0,0,0.05)] shrink-0 z-20 border-r border-white/60 space-y-2">
            <div className="p-8 flex justify-between items-center shrink-0">
                <h2 className="font-black text-2xl text-slate-900 tracking-tight uppercase leading-none">{t('chat.channels')}</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="w-11 h-11 flex items-center justify-center bg-white/60 hover:bg-white rounded-[1.25rem] text-indigo-600 transition-all duration-500 shadow-sm hover:shadow-xl border border-white/50 hover:border-indigo-100/50 group active:scale-90"
                    title={t('chat.createChannel')}
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-12 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-8 space-y-4">
                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                        <p className="text-sm font-medium text-slate-400">{t('common.loadingChannels')}</p>
                    </div>
                ) : (
                    <>
                        {/* Pinned Channels */}
                        {pinnedChannels.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2 px-2 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">
                                    <Pin size={12} className="text-indigo-400" />
                                    <span>{t('chat.fileNotification.pinned') || 'Закрепленные'}</span>
                                </div>
                                <div className="space-y-1">
                                    {pinnedChannels.map((channel) => {
                                        const unread = getUnreadDisplay(channel);
                                        const isActive = Number(channelId) === channel.id;
                                        return (
                                            <button
                                                key={channel.id}
                                                onClick={() => navigate(`/chat/${channel.id}`)}
                                                className={`w-full group relative flex items-center justify-between px-3 py-3 rounded-2xl transition-all duration-500 ${isActive
                                                    ? 'bg-white shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-50/50 text-indigo-600 transform -translate-y-0.5'
                                                    : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600 hover:translate-x-1'
                                                    }`}
                                            >
                                                {isActive && (
                                                    <div className="absolute left-1 top-4 bottom-4 w-1.5 bg-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.4)]" />
                                                )}
                                                <div className="flex items-center space-x-3 truncate">
                                                    <div className="relative shrink-0 ml-1.5">
                                                        {channel.is_direct ? (
                                                            <Avatar
                                                                src={channel.other_user?.avatar_url}
                                                                name={channel.other_user ? (channel.other_user.full_name || channel.other_user.username) : 'DM'}
                                                                size="sm"
                                                                status={channel.other_user?.is_online ? 'online' : undefined}
                                                                className={`shadow-md transition-all duration-500 ${isActive ? 'scale-110 ring-2 ring-indigo-50' : 'grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105'}`}
                                                            />
                                                        ) : (
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-indigo-600 text-white scale-[1.08] shadow-lg shadow-indigo-200' : 'bg-white/80 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 scale-100 group-hover:scale-[1.04] shadow-sm'}`}>
                                                                <Hash size={16} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-start truncate overflow-hidden min-w-0">
                                                        <span className={`truncate w-full text-left font-black text-sm tracking-tight ${unread ? 'text-slate-900' : (isActive ? 'text-indigo-600' : 'text-slate-700')}`}>
                                                            {channel.is_direct ? (channel.other_user?.full_name?.split(' ')[0] || channel.other_user?.username || channel.name) : channel.name}
                                                        </span>
                                                        {channel.last_message ? (
                                                            <span className={`text-[10px] uppercase font-black tracking-wider truncate text-left w-full mt-0.5 ${unread ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-500'}`}>
                                                                {channel.last_message.content}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300 uppercase font-black tracking-widest truncate text-left w-full mt-0.5 opacity-50">
                                                                {t('chat.noMessages')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center pl-2 shrink-0">
                                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all mr-1">
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); setMuteModalChannelId(channel.id); }}
                                                            className={`p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer ${channel.mute_until && new Date(channel.mute_until) > new Date() ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-500'}`}
                                                            title={t('chat.notifications.muteTitle')}
                                                        >
                                                            <BellOff size={14} fill={channel.mute_until && new Date(channel.mute_until) > new Date() ? 'currentColor' : 'none'} />
                                                        </div>
                                                        <div
                                                            onClick={(e) => handlePin(e, channel.id)}
                                                            className="p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer text-indigo-500 bg-indigo-50"
                                                            title={t('chat.unpin')}
                                                        >
                                                            <Pin size={14} fill="currentColor" />
                                                        </div>
                                                    </div>
                                                    {unread && (
                                                        <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-rose-500/30 animate-in zoom-in duration-200">
                                                            {unread}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {/* Public Channels */}
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <Layers size={12} className="text-slate-300" />
                                <span>{t('chat.publicSpace')}</span>
                            </div>
                            <div className="space-y-1">
                                {publicChannels?.map((channel) => {
                                    const unread = getUnreadDisplay(channel);
                                    const isActive = Number(channelId) === channel.id;
                                    return (
                                        <button
                                            key={channel.id}
                                            onClick={() => navigate(`/chat/${channel.id}`)}
                                            className={`w-full group relative flex items-center justify-between px-3 py-3 rounded-2xl transition-all duration-500 ${isActive
                                                ? 'bg-white shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-50/50 text-indigo-600 transform -translate-y-0.5'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600 hover:translate-x-1'
                                                }`}
                                        >
                                            {isActive && (
                                                <div className="absolute left-1 top-4 bottom-4 w-1.5 bg-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.4)]" />
                                            )}
                                            <div className="flex items-center space-x-3 truncate">
                                                <div className="relative shrink-0 ml-1.5">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-indigo-600 text-white scale-[1.08] shadow-lg shadow-indigo-200' : 'bg-white/80 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 scale-100 group-hover:scale-[1.04] shadow-sm'}`}>
                                                        <Hash size={16} />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-start truncate overflow-hidden min-w-0">
                                                    <span className={`truncate w-full text-left font-black text-sm tracking-tight ${unread ? 'text-slate-900' : (isActive ? 'text-indigo-600' : 'text-slate-700')}`}>
                                                        {channel.name}
                                                    </span>
                                                    {channel.last_message ? (
                                                        <span className={`text-[10px] uppercase font-black tracking-wider truncate text-left w-full mt-0.5 ${unread ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-500'}`}>
                                                            {channel.last_message.content}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 uppercase font-black tracking-widest truncate text-left w-full mt-0.5 opacity-50">
                                                            {t('chat.noMessages')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center pl-2 shrink-0">
                                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all mr-1">
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); setMuteModalChannelId(channel.id); }}
                                                        className={`p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer ${channel.mute_until && new Date(channel.mute_until) > new Date() ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-500'}`}
                                                        title={t('chat.notifications.muteTitle')}
                                                    >
                                                        <BellOff size={14} fill={channel.mute_until && new Date(channel.mute_until) > new Date() ? 'currentColor' : 'none'} />
                                                    </div>
                                                    <div
                                                        onClick={(e) => handlePin(e, channel.id)}
                                                        className={`p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer ${channel.is_pinned ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-500'}`}
                                                        title={channel.is_pinned ? t('chat.unpin') : t('chat.pin')}
                                                    >
                                                        {channel.is_pinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
                                                    </div>
                                                    {(channel.created_by === currentUser?.id || currentUser?.role === 'admin') && (
                                                        <div
                                                            onClick={(e) => handleDelete(e, channel.id)}
                                                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                                                            title={t('chat.deleteChat')}
                                                        >
                                                            <Trash2 size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                                {unread && (
                                                    <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-rose-500/30 animate-in zoom-in duration-200">
                                                        {unread}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Direct Messages */}
                        {directChannels && directChannels.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    <MessageSquare size={12} className="text-slate-300" />
                                    <span>{t('chat.directMessages')}</span>
                                </div>
                                <div className="space-y-1">
                                    {directChannels.map((channel) => {
                                        const unread = getUnreadDisplay(channel);
                                        const isActive = Number(channelId) === channel.id;
                                        return (
                                            <button
                                                key={channel.id}
                                                onClick={() => navigate(`/chat/${channel.id}`)}
                                                className={`w-full group relative flex items-center justify-between px-3 py-3 rounded-2xl transition-all duration-500 ${isActive
                                                    ? 'bg-white shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-50/50 text-indigo-600 transform -translate-y-0.5'
                                                    : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600 hover:translate-x-1'
                                                    }`}
                                            >
                                                {isActive && (
                                                    <div className="absolute left-1 top-4 bottom-4 w-1.5 bg-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.4)]" />
                                                )}
                                                <div className="flex items-center space-x-3 truncate">
                                                    <div className="relative shrink-0 ml-1.5">
                                                        <Avatar
                                                            src={channel.other_user?.avatar_url}
                                                            name={channel.other_user ? (channel.other_user.full_name || channel.other_user.username) : 'DM'}
                                                            size="sm"
                                                            status={channel.other_user?.is_online ? 'online' : undefined}
                                                            className={`shadow-md transition-all duration-500 ${isActive ? 'scale-110 ring-2 ring-indigo-50' : 'grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105'}`}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col items-start truncate overflow-hidden min-w-0">
                                                        <span className={`truncate w-full text-left font-black text-sm tracking-tight ${unread ? 'text-slate-900' : (isActive ? 'text-indigo-600' : 'text-slate-700')}`}>
                                                            {channel.other_user?.rank && <span className="text-slate-400 mr-1 font-bold">{abbreviateRank(channel.other_user.rank)}</span>}
                                                            {(channel.other_user?.full_name || channel.other_user?.username || channel.name).split(' ')[0]}
                                                        </span>
                                                        {channel.last_message ? (
                                                            <span className={`text-[10px] uppercase font-black tracking-wider truncate text-left w-full mt-0.5 ${unread ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-500'}`}>
                                                                {channel.last_message.content}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300 uppercase font-black tracking-widest truncate text-left w-full mt-0.5 opacity-50">
                                                                {t('chat.noMessages')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center pl-2 shrink-0">
                                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all mr-1">
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); setMuteModalChannelId(channel.id); }}
                                                            className={`p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer ${channel.mute_until && new Date(channel.mute_until) > new Date() ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-500'}`}
                                                            title={t('chat.notifications.muteTitle')}
                                                        >
                                                            <BellOff size={14} fill={channel.mute_until && new Date(channel.mute_until) > new Date() ? 'currentColor' : 'none'} />
                                                        </div>
                                                        <div
                                                            onClick={(e) => handlePin(e, channel.id)}
                                                            className={`p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer ${channel.is_pinned ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-500'}`}
                                                            title={channel.is_pinned ? t('chat.unpin') : t('chat.pin')}
                                                        >
                                                            {channel.is_pinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
                                                        </div>
                                                        {(channel.created_by === currentUser?.id || currentUser?.role === 'admin') && (
                                                            <div
                                                                onClick={(e) => handleDelete(e, channel.id)}
                                                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                                                                title={t('chat.deleteChat')}
                                                            >
                                                                <Trash2 size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {unread && (
                                                        <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full shadow-sm animate-in zoom-in duration-200">
                                                            {unread}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create Channel Modal */}
            <Modal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                title={t('chat.createChannel')}
            >
                <form onSubmit={handleCreateChannel} className="space-y-6">
                    <div className="space-y-4">
                        <Input
                            label={t('chat.newChannelLabel')}
                            placeholder={t('chat.channelNamePlaceholder')}
                            value={newChannel.name}
                            onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                            required
                            autoFocus
                        />
                        
                        <TextArea
                            label={t('admin.unitDesc') || 'Description'}
                            placeholder={t('chat.channel_desc_placeholder')}
                            value={newChannel.description}
                            onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                            rows={4}
                        />
                    </div>

                    <div className="flex space-x-4 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            fullWidth
                            onClick={() => setIsCreating(false)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={createChannelMutation.isPending || !newChannel.name.trim()}
                        >
                            {createChannelMutation.isPending ? (
                                <Loader2 className="animate-spin mx-auto" size={20} />
                            ) : (
                                t('common.create')
                            )}
                        </Button>
                    </div>
                </form>
            </Modal>
            <MuteModal
                isOpen={!!muteModalChannelId}
                onClose={() => setMuteModalChannelId(null)}
                onMute={handleMute}
            />
        </div>
    );
};

export default React.memo(ChannelSidebar);

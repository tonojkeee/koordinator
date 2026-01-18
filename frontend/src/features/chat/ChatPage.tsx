import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, startTransition } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import api from '../../api/client';
import type { Message, Channel, User } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useUnreadStore } from '../../store/useUnreadStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Send, MessageSquare, Smile, Trash2, Users, X, Hash, Bell, BellOff, Info, Plus, Crown, Check, CheckCheck, FileText } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';


import SendDocumentModal from '../board/components/SendDocumentModal';
import { useTranslation } from 'react-i18next';
import ChannelSidebar from './ChannelSidebar';

import ParticipantsList from './ParticipantsList';
import { Avatar } from '../../design-system';
import MuteModal from './MuteModal';
import { formatDate, renderMessageContent } from './utils';
import { formatName } from '../../utils/formatters';

import { type Reaction } from '../../types';

// Design System imports
import { Button } from '../../design-system/components/Button';
import { animations } from '../../design-system/tokens/animations';

type WebSocketMessage =
    | { type: 'typing'; user_id: number; full_name: string; username: string; is_typing: boolean }
    | { type: 'reaction_added'; message_id: number; reaction: Reaction }
    | { type: 'reaction_removed'; message_id: number; user_id: number; emoji: string }
    | { type: 'presence'; online_count: number }
    | { type: 'message_deleted'; message_id: number }
    | { type: 'read_receipt'; channel_id: number; user_id: number; last_read_id: number }
    | { type: 'user_presence'; user_id: number; status: 'online' | 'offline' }
    | (Message & { type: 'new_message' })
    | (Message & { type?: never });

// Lazy load removed - using direct import
// const EmojiPickerComponent = React.lazy(() => import('emoji-picker-react'));

// Skeleton loader for messages - imported from components
import { MessageSkeleton } from './components';

interface MessageInputProps {
    isConnected: boolean;
    sendMessage: (content: string | { content: string; parent_id?: number }) => void;
    sendTyping: (is_typing: boolean) => void;
    activeThread: Message | null;
    setActiveThread: (msg: Message | null) => void;
    setIsSendModalOpen: (open: boolean) => void;
    handleReactionClick: (messageId: number, emoji: string) => void;
    channelId?: string;
    typingUsers?: Record<number, { name: string, timestamp: number }>;
}

export interface MessageInputHandle {
    handleMention: (username: string) => void;
    openForReaction: (msgId: number) => void;
}

const MessageInput = React.forwardRef<MessageInputHandle, MessageInputProps>((
    {
        isConnected,
        sendMessage,
        sendTyping,
        activeThread,
        setActiveThread,
        setIsSendModalOpen,
        handleReactionClick,
        typingUsers = {}
    }, ref) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const [inputMessage, setInputMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [reactionTargetId, setReactionTargetId] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentRef = useRef<boolean>(false);

    React.useImperativeHandle(ref, () => ({
        handleMention: (username: string) => {
            setInputMessage(prev => {
                const prefix = prev.endsWith(' ') ? '' : (prev.length > 0 ? ' ' : '');
                return prev + prefix + '@' + username + ' ';
            });
            inputRef.current?.focus();
        },
        openForReaction: (msgId: number) => {
            setReactionTargetId(msgId);
            setShowEmojiPicker(true);
        }
    }));

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputMessage(e.target.value);

        if (!lastTypingSentRef.current) {
            sendTyping(true);
            lastTypingSentRef.current = true;
        }

        if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

        typingDebounceRef.current = setTimeout(() => {
            sendTyping(false);
            lastTypingSentRef.current = false;
        }, 3000);
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (inputMessage.trim() && isConnected) {
            if (activeThread) {
                sendMessage({ content: inputMessage.trim(), parent_id: activeThread.id });
            } else {
                sendMessage(inputMessage.trim());
            }
            setInputMessage('');
            setActiveThread(null);
            sendTyping(false);
            lastTypingSentRef.current = false;
        }
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        if (reactionTargetId) {
            handleReactionClick(reactionTargetId, emojiData.emoji);
            setShowEmojiPicker(false);
            setReactionTargetId(null);
        } else {
            setInputMessage(prev => prev + emojiData.emoji);
            setShowEmojiPicker(false);
            inputRef.current?.focus();
        }
    };

    // Click outside handler for emoji picker
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    return (
        <div className="px-4 md:px-8 pb-4 md:pb-6 pt-2 z-30 shrink-0">
            <div className={`relative max-w-4xl mx-auto transition-all`}>
                {/* Typing Indicator - Outside overflow-hidden container to prevent clipping */}
                {Object.keys(typingUsers).length > 0 && (
                    <div className={`absolute bottom-full left-4 mb-3 z-50 pointer-events-none ${animations.slideIn}`}>
                        <div className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl shadow-lg shadow-indigo-500/10 border border-slate-200/50 flex items-center space-x-2.5">
                            <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                {(Object.values(typingUsers) as { name: string }[]).map(u => u.name).join(', ')} {t('chat.typing')}
                            </span>
                        </div>
                    </div>
                )}

                <div className={`relative flex flex-col bg-white/70 backdrop-blur-3xl rounded-3xl border border-white/40 shadow-xl shadow-indigo-500/10 transition-all duration-700 overflow-hidden ring-1 ring-white/50 group focus-within:shadow-2xl focus-within:shadow-indigo-500/20 focus-within:-translate-y-0.5`}>
                    {activeThread && (
                        <div className={`bg-indigo-50/50 backdrop-blur-md px-4 py-3 border-b border-indigo-100/30 flex items-center justify-between ${animations.slideIn}`}>
                            <div className="flex items-center space-x-3 overflow-hidden flex-1 min-w-0">
                                <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider leading-none mb-1">
                                        {t('chat.replying_to')} {activeThread.username}
                                    </p>
                                    <p className="text-xs text-slate-600 truncate font-medium">
                                        {activeThread.content}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveThread(null)}
                                className="shrink-0 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white/50 rounded-lg transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex items-center p-2 md:p-2.5 space-x-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSendModalOpen(true)}
                            icon={<Plus size={18} />}
                            title={t('chat.send_file')}
                            className="shrink-0"
                        />

                        <input
                            ref={inputRef}
                            type="text"
                            value={inputMessage}
                            onChange={handleInputChange}
                            placeholder={t('chat.inputPlaceholder')}
                            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 px-2 h-10"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();

                                    const enterToSend = user?.preferences?.enter_to_send ?? true;
                                    if (enterToSend) {
                                        handleSendMessage();
                                    } else {
                                        setInputMessage(prev => prev + '\n');
                                    }
                                } else if (e.key === 'Enter' && e.shiftKey) {
                                    // Shift+Enter rules
                                    const enterToSend = user?.preferences?.enter_to_send ?? true;
                                    if (!enterToSend) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                    // if enterToSend is true, Shift+Enter does new line (default behavior)
                                }
                            }}
                        />

                        <div className="flex items-center space-x-1 shrink-0">
                            <div className="relative">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setReactionTargetId(null);
                                        setShowEmojiPicker(!showEmojiPicker);
                                    }}
                                    icon={<Smile size={18} />}
                                    className={showEmojiPicker ? 'text-indigo-600 bg-indigo-50' : ''}
                                />
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={!inputMessage.trim() || !isConnected}
                                icon={<Send size={18} />}
                                className={`shadow-lg ${inputMessage.trim() && isConnected
                                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700'
                                    : 'grayscale opacity-50'
                                    }`}
                            />
                        </div>
                    </form>
                </div>

                {showEmojiPicker && (
                    <div ref={emojiPickerRef} className={`absolute bottom-full right-0 mb-4 z-[100] origin-bottom-right pr-2 ${animations.zoomIn}`}>
                        <div className="shadow-2xl shadow-indigo-500/20 rounded-[2rem] overflow-hidden border border-white/80 ring-4 ring-white/40 backdrop-blur-xl bg-white/60">
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                theme={Theme.LIGHT}
                                emojiStyle={EmojiStyle.NATIVE}
                                lazyLoadEmojis={true}
                                searchPlaceholder={t('common.search') || 'Search...'}
                                previewConfig={{ showPreview: false }}
                                width={320}
                                height={400}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

const ChatPage: React.FC = () => {
    const { t } = useTranslation();

    const queryClient = useQueryClient();
    const { channelId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { token, user } = useAuthStore();
    const { clearUnread } = useUnreadStore();

    const [messages, setMessages] = useState<Message[]>([]);
    const messageInputRef = useRef<{ handleMention: (username: string) => void, openForReaction: (msgId: number) => void } | null>(null);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Record<number, { name: string, timestamp: number }>>({});
    const typingTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    const [isDragging, setIsDragging] = useState(false);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    const dragCounter = useRef(0);
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const prevScrollHeightRef = useRef<number>(0);
    const isFetchingMoreRef = useRef<boolean>(false);
    const isInitialLoadRef = useRef<boolean>(true);
    const [highlightDocId, setHighlightDocId] = useState<number | null>(null);
    const [showParticipants, setShowParticipants] = useState(true);
    const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
    const [activeThread, setActiveThread] = useState<Message | null>(null);



    const handleMention = (username: string) => {
        messageInputRef.current?.handleMention(username);
    };



    // Fetch channel details
    const { data: channel } = useQuery<Channel>({
        queryKey: ['channel', channelId],
        queryFn: async () => {
            if (!channelId) return null;
            const res = await api.get(`/chat/channels/${channelId}`);
            return res.data;
        },
        enabled: !!channelId,
    });

    // Mute Mutation
    const muteMutation = useMutation({
        mutationFn: async ({ channelId, muteUntil }: { channelId: number; muteUntil: string | null }) => {
            const { data } = await api.post(`/chat/channels/${channelId}/mute`, null, {
                params: { mute_until: muteUntil }
            });
            return data;
        },
        onSuccess: (_data, variables) => {
            queryClient.setQueryData(['channel', variables.channelId.toString()], (old: Channel | undefined) => {
                if (!old) return old;
                return { ...old, mute_until: variables.muteUntil };
            });
            setIsMuteModalOpen(false);
        }
    });

    const isMuted = React.useMemo(() => {
        if (!channel?.mute_until) return false;
        return new Date(channel.mute_until) > new Date();
    }, [channel?.mute_until]);

    const handleMute = (duration: '1h' | '8h' | '24h' | 'forever' | null) => {
        if (!channelId) return;

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

        muteMutation.mutate({ channelId: parseInt(channelId), muteUntil });
    };

    // Freeze last_read_message_id when channel loads to keep separator stable
    const [initialLastReadId, setInitialLastReadId] = useState<number | null>(null);
    useEffect(() => {
        if (channel && channel.id === Number(channelId)) {
            setTimeout(() => {
                setInitialLastReadId(prev => (prev === null ? channel.last_read_message_id : prev));
            }, 0);
        }
    }, [channel, channelId]);

    // Reset state when channelId changes
    const prevChannelIdRef = useRef(channelId);
    useLayoutEffect(() => {
        if (prevChannelIdRef.current !== channelId) {
            startTransition(() => {
                setMessages([]);
                setInitialLastReadId(null);
                setActiveThread(null);
                setShowParticipants(true);
                isInitialLoadRef.current = true;
                prevChannelIdRef.current = channelId;
            });
        }
    }, [channelId]);

    // Fetch channel members
    const { data: members } = useQuery<User[]>({
        queryKey: ['channel_members', channelId],
        queryFn: async () => {
            if (!channelId) return [];
            const res = await api.get(`/chat/channels/${channelId}/members`);
            return res.data;
        },
        enabled: !!channelId,
    });

    // Fetch online user IDs for DM status
    const { data: onlineData } = useQuery<{ online_user_ids: number[] }>({
        queryKey: ['users', 'online'],
        queryFn: async () => {
            const res = await api.get('/auth/users/online');
            return res.data;
        },
        refetchInterval: 30000,
        enabled: channel?.is_direct === true,
    });
    const onlineUserIds = new Set(onlineData?.online_user_ids || []);

    // Helper to format last seen time
    const formatLastSeen = (lastSeen: string | null | undefined) => {
        if (!lastSeen) return t('chat.offline');
        const date = new Date(lastSeen);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('chat.justNow');
        if (diffMins < 60) return t('chat.minsAgo', { count: diffMins });
        if (diffHours < 24) return t('chat.hoursAgo', { count: diffHours });
        if (diffDays < 7) return t('chat.daysAgo', { count: diffDays });
        return date.toLocaleDateString('ru-RU');
    };

    // Get DM partner online status
    const dmPartner = channel?.other_user;
    const isDmPartnerOnline = dmPartner ? onlineUserIds.has(dmPartner.id) : false;


    // Mark as read mutation
    const markReadMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.post(`/chat/channels/${id}/read`);
        },
        onSuccess: () => {
            if (channelId) {
                clearUnread(Number(channelId));
                // Invalidate both channel list AND current channel data
                queryClient.invalidateQueries({ queryKey: ['channels'] });
                queryClient.invalidateQueries({ queryKey: ['channel', channelId] });
            }
        }
    });

    // Delete message mutation
    const deleteMessageMutation = useMutation({
        mutationFn: async (messageId: number) => {
            return api.delete(`/chat/messages/${messageId}`);
        }
    });

    const handleDeleteMessage = (messageId: number) => {
        if (window.confirm(t('chat.confirm_delete') || 'Удалить это сообщение?')) {
            deleteMessageMutation.mutate(messageId);
        }
    };

    const markAsRead = useCallback(() => {
        // Only mark as read if channel is loaded and has unread messages, and not already marking
        if (channelId && channel && channel.unread_count > 0 && !markReadMutation.isPending) {
            markReadMutation.mutate(Number(channelId));
        }
    }, [channelId, channel, markReadMutation]);

    // Mark as read when opening channel or when channel data updates
    useEffect(() => {
        if (channelId && channel) {
            markAsRead();
        }
    }, [channelId, channel, markAsRead]);

    // Fetch message history with infinite scroll
    const {
        data: historyData,
        isLoading: isHistoryLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['messages', channelId],
        queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
            if (!channelId) return [];
            const offset = (pageParam as number) * 50;
            const res = await api.get(`/chat/channels/${channelId}/messages?limit=50&offset=${offset}`);
            return res.data as Message[];
        },
        getNextPageParam: (lastPage, allPages) => {
            // If last page has fewer than 50 messages, we've reached the end
            return lastPage.length === 50 ? allPages.length : undefined;
        },
        initialPageParam: 0,
        enabled: !!channelId,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (historyData?.pages) {
            setTimeout(() => {
                setMessages((prev) => {
                    // Flatten all pages
                    const allHistory = historyData.pages.flat();
                    // Combine (history messages + any newer messages in state)
                    const combined = [...allHistory, ...prev];
                    // Filter out duplicates and sort by ID
                    const unique = Array.from(new Map(combined.map(m => [m.id, m])).values())
                        .sort((a, b) => a.id - b.id);
                    return unique;
                });
            }, 0);
        }
    }, [historyData?.pages]);

    // Restore scroll position when loading more messages
    React.useLayoutEffect(() => {
        if (isFetchingMoreRef.current && messageContainerRef.current) {
            const container = messageContainerRef.current;
            const newScrollHeight = container.scrollHeight;
            const diff = newScrollHeight - prevScrollHeightRef.current;

            if (diff > 0) {
                container.scrollTop = diff;
            }
            isFetchingMoreRef.current = false;
        }
    }, [messages.length, isHistoryLoading, isFetchingNextPage]);

    // Robust initial scroll to bottom
    useEffect(() => {
        if (messages.length > 0 && isInitialLoadRef.current && !searchParams.get('docId')) {
            const container = messageContainerRef.current;
            if (!container) return;

            // Function to force scroll to bottom
            const scrollToBottom = () => {
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            };

            // Attempt immediate scroll
            scrollToBottom();

            // Handle dynamic content loading
            const resizeObserver = new ResizeObserver(() => {
                if (isInitialLoadRef.current) {
                    scrollToBottom();
                }
            });
            resizeObserver.observe(container);

            // One reliable delayed check instead of multiple
            const timeout = setTimeout(() => {
                scrollToBottom();
                isInitialLoadRef.current = false;
                resizeObserver.disconnect();
            }, 600);

            return () => {
                resizeObserver.disconnect();
                clearTimeout(timeout);
            };
        }
    }, [messages.length, searchParams]);



    // Scroll handler for infinite loading
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;

        // If scrolled to top and has more pages
        if (container.scrollTop < 50 && hasNextPage && !isFetchingNextPage) {
            prevScrollHeightRef.current = container.scrollHeight;
            isFetchingMoreRef.current = true;
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    useEffect(() => {
        if (historyData) {
            // Check for document highlight parameter
            const docId = searchParams.get('docId');
            if (docId) {
                const docIdNum = Number(docId);
                setTimeout(() => setHighlightDocId(docIdNum), 0);

                // Scroll to message with this document after a delay
                setTimeout(() => {
                    const messageElement = document.querySelector(`[data-doc-id="${docIdNum}"]`);
                    if (messageElement) {
                        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);

                // Remove highlight after animation completes
                setTimeout(() => {
                    setHighlightDocId(null);
                    setSearchParams({});
                }, 2700);
            }
        }
    }, [historyData, searchParams, setSearchParams]);

    // Handle new messages from WebSocket
    const onMessage = useCallback((inputData: unknown) => {
        const data = inputData as WebSocketMessage;
        if (data.type === 'typing') {
            const { user_id, full_name, username, is_typing } = data;
            if (user_id === user?.id) return;

            setTypingUsers(prev => {
                const newTyping = { ...prev };
                if (is_typing) {
                    newTyping[user_id] = { name: full_name || username, timestamp: Date.now() };

                    // Clear existing timeout if any
                    if (typingTimeoutRef.current[user_id]) {
                        clearTimeout(typingTimeoutRef.current[user_id]);
                    }

                    // Auto-remove after 5 seconds of inactivity
                    typingTimeoutRef.current[user_id] = setTimeout(() => {
                        setTypingUsers(p => {
                            const updated = { ...p };
                            delete updated[user_id];
                            return updated;
                        });
                    }, 5000);
                } else {
                    delete newTyping[user_id];
                    if (typingTimeoutRef.current[user_id]) {
                        clearTimeout(typingTimeoutRef.current[user_id]);
                    }
                }
                return newTyping;
            });
            return;
        }

        if (data.type === 'read_receipt') {
            if (channelId && Number(channelId) === data.channel_id) {
                queryClient.setQueryData<Channel>(['channel', channelId], (old) => {
                    if (!old) return old;
                    // Only update if the new last_read_id is greater than current others_read_id
                    const newId = Math.max(old.others_read_id || 0, data.last_read_id);
                    return { ...old, others_read_id: newId };
                });
            }
            return;
        }

        if (data.type === 'user_presence') {
            queryClient.setQueriesData({ queryKey: ['channel_members'] }, (old: unknown) => {
                if (!old || !Array.isArray(old)) return old;
                return old.map((m: User) =>
                    m.id === data.user_id ? { ...m, is_online: data.status === 'online', last_seen: data.status === 'offline' ? new Date().toISOString() : m.last_seen } : m
                );
            });
            return;
        }

        if (data.type === 'reaction_added') {
            setMessages((prev) => prev.map(m => {
                if (m.id === data.message_id) {
                    const reactions = m.reactions || [];
                    if (reactions.some(r => r.user_id === data.reaction.user_id && r.emoji === data.reaction.emoji)) return m;
                    return { ...m, reactions: [...reactions, data.reaction] };
                }
                return m;
            }));
            return;
        }

        if (data.type === 'reaction_removed') {
            setMessages((prev) => prev.map(m => {
                if (m.id === data.message_id) {
                    return {
                        ...m,
                        reactions: (m.reactions || []).filter(r => !(r.user_id === data.user_id && r.emoji === data.emoji))
                    };
                }
                return m;
            }));
            return;
        }

        if (data.type === 'presence') {
            // Update online_count in real-time
            queryClient.setQueryData<Channel>(['channel', channelId], (old) => {
                if (!old) return old;
                return { ...old, online_count: data.online_count };
            });
            return;
        }

        // Handle message deletion
        if (data.type === 'message_deleted') {
            setMessages((prev) => prev.filter(m => m.id !== data.message_id));
            return;
        }

        if (data.type === 'new_message' || !data.type) {
            const message: Message = data;

            // If it's a reply (has parent_id)
            if (message.parent_id) {
                // Update the parent message's reply_count (optional, but good for data consistency)
                setMessages((prev) => prev.map(m => {
                    if (m.id === message.parent_id) {
                        return { ...m, reply_count: (m.reply_count || 0) + 1 };
                    }
                    return m;
                }));
            }

            setMessages((prev) => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
            });

            // If we are in this channel AND we are NOT the sender, mark as read
            const isFromAlternativeSource = message.user_id !== user?.id;

            if (channelId && Number(channelId) === message.channel_id && isFromAlternativeSource) {
                markReadMutation.mutate(Number(channelId));
            }

            // Scroll to bottom with animation
            setTimeout(() => {
                const container = document.getElementById('message-container');
                if (container) {
                    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                }
            }, 10);
            return;
        }
    }, [channelId, user?.id, markReadMutation, queryClient]);

    const { isConnected, sendMessage, sendTyping } = useWebSocket(
        channelId ? Number(channelId) : undefined,
        token,
        { onMessage }
    );





    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Only trigger for files
        if (e.dataTransfer.types.includes('Files')) {
            dragCounter.current++;
            if (dragCounter.current === 1) {
                setIsDragging(true);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Necessary to allow drop
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.types.includes('Files')) {
            dragCounter.current--;
            if (dragCounter.current <= 0) {
                dragCounter.current = 0;
                setIsDragging(false);
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        dragCounter.current = 0;
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            setDroppedFile(files[0]);
            setIsSendModalOpen(true);
        }
    };



    const handleReactionClick = async (messageId: number, emoji: string) => {
        const message = messages.find(m => m.id === messageId);
        if (!message) return;

        const hasMyReaction = message.reactions?.some(r => r.user_id === user?.id && r.emoji === emoji);

        try {
            if (hasMyReaction) {
                await api.delete(`/chat/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`);
            } else {
                await api.post(`/chat/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`);
            }
        } catch (error) {
            console.error('Error toggling reaction', error);
        }
    };

    const groupReactions = (reactions: Reaction[]) => {
        if (!reactions) return [];
        const groups: { [emoji: string]: { emoji: string; count: number; users: string[]; avatars: (string | null)[]; hasMine: boolean } } = {};

        reactions.forEach(r => {
            if (!groups[r.emoji]) {
                groups[r.emoji] = { emoji: r.emoji, count: 0, users: [], avatars: [], hasMine: false };
            }
            groups[r.emoji].count++;
            groups[r.emoji].users.push(r.username);
            groups[r.emoji].avatars.push(r.avatar_url || null);
            if (r.user_id === user?.id) {
                groups[r.emoji].hasMine = true;
            }
        });

        return Object.values(groups);
    };

    return (
        <div
            className="flex-1 flex overflow-hidden bg-slate-50/50 animate-in fade-in duration-300"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <ChannelSidebar />

            {/* ThreadView Removed */}

            <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-[100] bg-indigo-600/10 backdrop-blur-[2px] border-4 border-dashed border-indigo-500/50 m-4 rounded-[2.5rem] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                        <div className="bg-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center space-y-4">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center animate-bounce">
                                <Plus size={32} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">{t('chat.send_file_title')}</h3>
                                <p className="text-slate-500 font-medium">{t('chat.send_file_subtitle')}</p>
                            </div>
                        </div>
                    </div>
                )}
                {channelId ? (
                    <div className="flex-1 flex flex-col h-full transition-opacity duration-300" style={{ opacity: isHistoryLoading && messages.length === 0 ? 0.5 : 1 }}>
                        {/* Header - Compact Design */}
                        <div className="shrink-0 border-b border-slate-200/50 bg-white/40 backdrop-blur-xl">
                            <div className="flex items-center justify-between px-6 py-3">
                                {/* Left: Icon + Title */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
                                        {channel?.is_direct && channel.other_user ? (
                                            <span className="text-sm font-black uppercase">
                                                {channel.other_user.full_name
                                                    ? channel.other_user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
                                                    : channel.other_user.username.slice(0, 2)
                                                }
                                            </span>
                                        ) : (
                                            <Hash size={20} />
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-base font-black text-slate-900 truncate">
                                            {channel?.is_direct && channel.other_user
                                                ? formatName(channel.other_user.full_name, channel.other_user.username)
                                                : channel?.display_name || channel?.name || `${t('chat.channel')} ${channelId}`
                                            }
                                        </h2>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                                channel?.is_direct 
                                                    ? (isDmPartnerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300')
                                                    : (isConnected ? 'bg-emerald-500' : 'bg-rose-500')
                                            }`} />
                                            <span className="font-bold">
                                                {channel?.is_direct
                                                    ? (isDmPartnerOnline ? t('chat.online') : formatLastSeen(dmPartner?.last_seen))
                                                    : t('chat.channelStatus', {
                                                        count: channel?.members_count || 0,
                                                        label: t('common.participants', { count: channel?.members_count || 0 }),
                                                        online: channel?.online_count || 0
                                                    })
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Action Buttons */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setIsMuteModalOpen(true)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                                            isMuted
                                                ? 'text-rose-500 hover:bg-rose-50'
                                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                        title={isMuted ? t('chat.notifications.unmute') : t('chat.notifications.mute')}
                                    >
                                        {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
                                    </button>

                                    <button 
                                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                    >
                                        <Info size={18} />
                                    </button>

                                    {channel && !channel.is_direct && (
                                        <button
                                            onClick={() => setShowParticipants(!showParticipants)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                                                showParticipants
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                            }`}
                                            title={t('chat.participants') || 'Participants'}
                                        >
                                            <Users size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <SendDocumentModal
                            isOpen={isSendModalOpen}
                            onClose={() => {
                                setIsSendModalOpen(false);
                                setDroppedFile(null);
                            }}
                            recipientIds={
                                channel?.is_direct
                                    ? (channel.other_user ? [channel.other_user.id] : [])
                                    : (members || []).filter(m => m.id !== user?.id).map(m => m.id)
                            }
                            recipientNames={
                                channel?.is_direct
                                    ? (channel.other_user ? [formatName(channel.other_user.full_name, channel.other_user.username)] : [])
                                    : (members || []).filter(m => m.id !== user?.id).map(m => formatName(m.full_name, m.username))
                            }
                            channelName={!channel?.is_direct ? (channel?.display_name || channel?.name) : undefined}
                            channelId={channelId ? parseInt(channelId) : undefined}
                            preSelectedFile={droppedFile}
                        />

                        {/* Mute Modal */}
                        <MuteModal
                            isOpen={isMuteModalOpen}
                            onClose={() => setIsMuteModalOpen(false)}
                            onMute={handleMute}
                        />



                        <div className="flex-1 flex overflow-hidden">
                            <div className="flex-1 flex flex-col min-w-0 relative">
                                {/* Messages Area */}
                                <div
                                    id="message-container"
                                    ref={messageContainerRef}
                                    onScroll={handleScroll}
                                    className="flex-1 flex flex-col overflow-y-auto px-8 py-6 space-y-1 relative"
                                >

                                    {isFetchingNextPage && (
                                        <div className="flex justify-center py-2 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-slate-50/80 to-transparent p-2">
                                            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                                        </div>
                                    )}

                                    {/* Messages Content */}
                                    <div className="flex flex-col space-y-1 mt-auto">
                                        {isHistoryLoading && messages.length === 0 ? (
                                            <MessageSkeleton />
                                        ) : messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-[60vh] opacity-40 animate-in fade-in duration-500">
                                                <div className="p-12 bg-white rounded-[3rem] shadow-xl border border-slate-100 mb-6">
                                                    <MessageSquare size={64} className="text-slate-200" />
                                                </div>
                                                <p className="text-xl font-bold text-slate-600">{t('chat.noMessagesYet')}</p>
                                                <p className="text-base text-slate-400 mt-2">{t('chat.beFirst')}</p>
                                            </div>
                                        ) : (
                                            messages.map((msg, index) => {
                                                const isSent = msg.user_id === user?.id;
                                                const prevMsg = index > 0 ? messages[index - 1] : null;
                                                const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

                                                // Date Separator Logic
                                                const msgDate = new Date(msg.created_at).toDateString();
                                                const prevMsgDate = prevMsg ? new Date(prevMsg.created_at).toDateString() : null;
                                                const showDateSeparator = msgDate !== prevMsgDate;

                                                // Unread Separator Logic
                                                const lastReadId = initialLastReadId || 0;
                                                const showUnreadSeparator = lastReadId > 0 &&
                                                    msg.id > lastReadId &&
                                                    (prevMsg ? prevMsg.id <= lastReadId : true) &&
                                                    !isSent;

                                                // Grouping Logic
                                                const isFirstInGroup = !prevMsg || prevMsg.user_id !== msg.user_id || showDateSeparator || showUnreadSeparator;
                                                const isLastInGroup = !nextMsg || nextMsg.user_id !== msg.user_id || (nextMsg && new Date(nextMsg.created_at).toDateString() !== msgDate);

                                                const msgGroupClass = isFirstInGroup && isLastInGroup ? 'msg-single' : isFirstInGroup ? 'msg-first' : isLastInGroup ? 'msg-last' : 'msg-middle';

                                                return (
                                                    <React.Fragment key={msg.id}>
                                                        {showDateSeparator && (
                                                            <div className={`date-separator ${animations.fadeIn}`}>
                                                                <span className="date-label">{formatDate(msg.created_at, t)}</span>
                                                            </div>
                                                        )}

                                                        {showUnreadSeparator && (
                                                            <div className={`flex items-center my-8 ${animations.fadeIn}`}>
                                                                <div className="flex-1 border-t border-rose-200/60" />
                                                                <div className="mx-4 flex items-center space-x-2 px-3 py-1 bg-rose-50/50 rounded-full border border-rose-100">
                                                                    <Bell size={12} className="text-rose-500" />
                                                                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{t('chat.newMessages') || 'New Messages'}</span>
                                                                </div>
                                                                <div className="flex-1 border-t border-rose-200/60" />
                                                            </div>
                                                        )}

                                                        <div className={`${isFirstInGroup ? 'mt-7' : 'mt-[2px]'} ${animations.fadeIn}`}>
                                                            <div className={`flex items-end group flex-row gap-2 w-full`}>
                                                                {/* Avatar Column */}
                                                                <div className="flex flex-col items-center shrink-0 w-10">
                                                                    {isLastInGroup ? (
                                                                        <Avatar
                                                                            src={isSent ? user?.avatar_url : msg.avatar_url}
                                                                            name={isSent ? formatName(user?.full_name || '', user?.username || '') : formatName(msg.full_name, msg.username || '')}
                                                                            size="md"
                                                                            className="shadow-sm border border-slate-200/50 relative z-10"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-10" />
                                                                    )}
                                                                </div>

                                                                {/* Content Column */}
                                                                <div className={`flex flex-col items-start min-w-0 flex-1 relative`}>
                                                                    {isFirstInGroup && (
                                                                        <div className={`message-metadata flex-row px-1 mb-1.5`}>
                                                                            {!isSent && msg.rank && (
                                                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                                                                                    {msg.rank}
                                                                                </span>
                                                                            )}
                                                                            <span className={`font-bold text-[13px] tracking-tight ${isSent ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                                                                {isSent ? t('chat.you') : formatName(msg.full_name, msg.username)}
                                                                            </span>
                                                                            {((isSent && user?.role === 'admin') || (!isSent && msg.role === 'admin')) && (
                                                                                <div className="text-indigo-400" title={t('admin.roleAdmin')}>
                                                                                    <Crown size={10} fill="currentColor" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    <div
                                                                        id={`message-${msg.id}`}
                                                                        className={`message-bubble group/message relative ${isSent ? 'message-sent' : 'message-received'} ${msgGroupClass} flex flex-col ${msg.document_id && highlightDocId === msg.document_id ? 'message-highlight' : ''}`}
                                                                        {...(msg.document_id ? { 'data-doc-id': msg.document_id } : {})}
                                                                        style={{ fontSize: user?.preferences?.font_size === 'small' ? '0.85rem' : user?.preferences?.font_size === 'large' ? '1.1rem' : undefined }}
                                                                    >
                                                                        {/* Nested Reply Block */}
                                                                        {msg.parent && (
                                                                            <div
                                                                                className="reply-block"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const el = document.getElementById(`message-${msg.parent!.id}`);
                                                                                    if (el) {
                                                                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                        el.classList.add('bg-indigo-50/80');
                                                                                        el.classList.add('ring-2');
                                                                                        el.classList.add('ring-indigo-400/50');
                                                                                        setTimeout(() => {
                                                                                            el.classList.remove('bg-indigo-50/80');
                                                                                            el.classList.remove('ring-2');
                                                                                            el.classList.remove('ring-indigo-400/50');
                                                                                        }, 1500);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <span className="reply-user">{msg.parent.username}</span>
                                                                                <span className="reply-content">{renderMessageContent(msg.parent.content, msg.parent.username === user?.username)}</span>
                                                                            </div>
                                                                        )}

                                                                        {/* msg.document_id && (msg.file_path || msg.is_document_deleted === true) && (
                                                                            <ChatAttachmentItem
                                                                                msg={msg}
                                                                                isSent={isSent}
                                                                                onView={() => openDocViewer(getFullUrl(`/board/documents/${msg.document_id}/view?token=${token}`, true), msg.document_title || '', msg.file_path || '')}
                                                                                onDownload={() => {
                                                                                    const url = getFullUrl(`/board/documents/${msg.document_id}/download?token=${token}`, true);
                                                                                    const link = document.createElement('a');
                                                                                    link.href = url;
                                                                                    link.download = msg.document_title || 'download';
                                                                                    document.body.appendChild(link);
                                                                                    link.click();
                                                                                    document.body.removeChild(link);
                                                                                }}
                                                                                getFileConfig={getFileConfig}
                                                                                token={token}
                                                                                getFullUrl={getFullUrl}
                                                                            />
                                                                        )} */}

                                                                        <div className="flex flex-col relative">
                                                                            {msg.content && (!msg.document_id || (!msg.content.startsWith('📎 Отправил файл:') && !msg.content.startsWith('📎 Поделился файлом:'))) && (
                                                                                <p className={`leading-relaxed whitespace-pre-wrap break-words pr-14 ${isSent ? 'text-white' : 'text-slate-900'} ${msg.document_id ? 'mt-2 text-[13px] opacity-90' : ''}`}>
                                                                                    {renderMessageContent(msg.content, isSent)}
                                                                                </p>
                                                                            )}

                                                                            <div className={`flex items-center justify-end space-x-1 self-end mt-1 -mb-1 ${isSent ? 'text-white/60' : 'text-slate-400'}`}>
                                                                                <span className="text-[10px] tabular-nums font-medium">
                                                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                                {isSent && (
                                                                                    msg.id <= (channel?.others_read_id || 0) ? (
                                                                                        <CheckCheck size={13} className={`ml-0.5 ${isSent ? 'text-indigo-200' : 'text-indigo-500'}`} />
                                                                                    ) : (
                                                                                        <Check size={13} className="ml-0.5" />
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Message Actions (Reaction + Delete) */}
                                                                        <div className="absolute top-0 left-full ml-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveThread(msg);
                                                                                }}
                                                                                className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-90"
                                                                                title={t('chat.reply') || 'Reply'}
                                                                            >
                                                                                <MessageSquare size={14} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    messageInputRef.current?.openForReaction(msg.id);
                                                                                }}
                                                                                className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-90"
                                                                                title={t('chat.reactions.add')}
                                                                            >
                                                                                <Smile size={14} />
                                                                            </button>
                                                                            {(msg.user_id === user?.id || user?.role === 'admin') && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteMessage(msg.id);
                                                                                    }}
                                                                                    className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-400 hover:text-red-600 hover:border-red-200 transition-all active:scale-90"
                                                                                    title={t('common.delete') || 'Delete'}
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                </div>
                                                            </div>

                                                            {/* Reactions - Telegram style (below message bubble) */}
                                                            {msg.reactions && msg.reactions.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1 ml-12">
                                                                    {groupReactions(msg.reactions).map(group => (
                                                                        <button
                                                                            key={group.emoji}
                                                                            onClick={() => handleReactionClick(msg.id, group.emoji)}
                                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-bold transition-all backdrop-blur-sm ${
                                                                                group.hasMine
                                                                                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-600'
                                                                                    : 'bg-white/80 text-slate-700 border border-slate-200/50 hover:bg-white hover:border-indigo-200 shadow-sm'
                                                                            }`}
                                                                            title={group.users.join(', ')}
                                                                        >
                                                                            <span className="text-base leading-none">{group.emoji}</span>
                                                                            <span className={`tabular-nums ${group.hasMine ? 'text-white' : 'text-slate-600'}`}>
                                                                                {group.count}
                                                                            </span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>


                                {/* Input Area Wrapper - Unified "Chat Island" */}
                                <MessageInput
                                    ref={messageInputRef}
                                    isConnected={isConnected}
                                    sendMessage={sendMessage}
                                    sendTyping={sendTyping}
                                    activeThread={activeThread}
                                    setActiveThread={setActiveThread}
                                    setIsSendModalOpen={setIsSendModalOpen}
                                    handleReactionClick={handleReactionClick}
                                    typingUsers={typingUsers}
                                />
                            </div>

                            {showParticipants && channelId && channel && !channel.is_direct && (
                                <ParticipantsList
                                    channelId={Number(channelId)}
                                    onMention={handleMention}
                                    className="w-80 shrink-0 transition-all duration-300"
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center animate-in bg-gradient-to-br from-indigo-50/20 via-white to-purple-50/20 backdrop-blur-3xl p-8 overflow-y-auto">
                        <div className="relative mb-16 group">
                            {/* Animated glow */}
                            <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full scale-150 animate-pulse pointer-events-none" />
                            <div className="absolute inset-0 bg-purple-500/20 blur-[100px] rounded-full scale-110 animate-pulse [animation-delay:-2s] pointer-events-none" />

                            <div className="relative">
                                <div className="w-52 h-52 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 rounded-3xl shadow-[0_32px_80px_-16px_rgba(79,70,229,0.4)] flex items-center justify-center group-hover:scale-105 group-hover:-rotate-3 transition-all duration-1000 ring-4 ring-white/10">
                                    <MessageSquare className="w-24 h-24 text-white drop-shadow-2xl" />
                                </div>
                                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-700 delay-100 ring-4 ring-indigo-50/50">
                                    <div className="w-18 h-18 bg-indigo-50 rounded-3xl flex items-center justify-center">
                                        <Send className="w-10 h-10 text-indigo-600 animate-bounce" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-center space-y-8 max-w-3xl mb-20 px-4">
                            <h2 className="text-6xl md:text-7xl font-black tracking-tighter text-slate-900 leading-[0.95] [text-wrap:balance]">
                                {t('chat.welcomeTitle').split(' ').map((word, i, arr) => (
                                    <React.Fragment key={i}>
                                        {['координатор', 'взаимодействие', 'система', 'гис'].includes(word.toLowerCase().replace(/[«»]/g, '')) ? (
                                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 drop-shadow-sm">
                                                {word}
                                            </span>
                                        ) : word}
                                        {i < arr.length - 1 ? ' ' : ''}
                                    </React.Fragment>
                                ))}
                            </h2>
                            <p className="text-xl text-slate-500 font-bold leading-relaxed max-w-xl mx-auto opacity-70">
                                {t('chat.welcomeDescription')}
                            </p>
                        </div>

                        {/* Quick Tips / Actions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-3xl px-4 animate-in delay-500">
                            <div className="p-10 rounded-3xl bg-white/40 border border-white shadow-2xl shadow-indigo-500/5 backdrop-blur-3xl hover:bg-white hover:scale-[1.02] hover:-translate-y-1 hover:shadow-indigo-500/10 transition-all duration-700 group/tip flex flex-col items-center sm:items-start text-center sm:text-left ring-1 ring-white/50">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover/tip:scale-110 group-hover/tip:rotate-6 transition-transform duration-700 shadow-sm border border-indigo-100/50">
                                    <Hash size={32} />
                                </div>
                                <h3 className="font-black text-slate-900 text-xl mb-3 tracking-tight">Командные каналы</h3>
                                <p className="text-base text-slate-400 font-bold leading-relaxed">Находите нужные пространства для общения в боковой панели слева.</p>
                            </div>
                            <div className="p-10 rounded-3xl bg-white/40 border border-white shadow-2xl shadow-purple-500/5 backdrop-blur-3xl hover:bg-white hover:scale-[1.02] hover:-translate-y-1 hover:shadow-purple-500/10 transition-all duration-700 group/tip flex flex-col items-center sm:items-start text-center sm:text-left ring-1 ring-white/50">
                                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover/tip:scale-110 group-hover/tip:-rotate-6 transition-transform duration-700 shadow-sm border border-purple-100/50">
                                    <FileText size={32} />
                                </div>
                                <h3 className="font-black text-slate-900 text-xl mb-3 tracking-tight">Обмен документами</h3>
                                <p className="text-base text-slate-400 font-bold leading-relaxed">Делитесь файлами и просматривайте их прямо внутри чатов.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};



export default ChatPage;

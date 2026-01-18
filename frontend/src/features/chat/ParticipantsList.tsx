import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { Avatar } from '../../design-system';
import { Loader2, Search, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { abbreviateRank, formatName } from '../../utils/formatters';

interface UserBasicInfo {
    id: number;
    username: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
    rank?: string;
    is_online?: boolean;
    last_seen?: string;
}

interface ParticipantsListProps {
    channelId: number;
    onMention: (username: string) => void;
    className?: string;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ channelId, onMention, className = '' }) => {
    const { t } = useTranslation();
    const [search, setSearch] = React.useState('');
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    const { data: members, isLoading } = useQuery<UserBasicInfo[]>({
        queryKey: ['channel_members', String(channelId)],
        queryFn: async () => {
            const res = await api.get(`/chat/channels/${channelId}/members`);
            return res.data;
        },
        enabled: !!channelId,
    });

    const createDmMutation = useMutation({
        mutationFn: async (targetUserId: number) => {
            const res = await api.post(`/chat/direct/${targetUserId}`);
            return res.data;
        },
        onSuccess: (channel) => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            navigate(`/chat/${channel.id}`);
        },
        onError: (error) => {
            console.error('Failed to create DM', error);
        }
    });

    const handleMessage = (e: React.MouseEvent, targetUserId: number) => {
        e.stopPropagation(); // Prevent onMention from triggering if we wrap the row
        createDmMutation.mutate(targetUserId);
    };

    const filteredMembers = React.useMemo(() => {
        if (!members) return [];
        if (!search.trim()) return members;
        const lowerSearch = search.toLowerCase();
        return members.filter(m =>
            m.username.toLowerCase().includes(lowerSearch) ||
            (m.full_name && m.full_name.toLowerCase().includes(lowerSearch))
        );
    }, [members, search]);

    if (isLoading) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 h-full ${className}`}>
                <Loader2 className="animate-spin text-indigo-600 mb-2" size={24} />
                <p className="text-xs text-slate-400">{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-slate-50/5 backdrop-blur-xl border-l border-white/40 shadow-[-4px_0_24px_-8px_rgba(0,0,0,0.08)] ${className}`}>
            <div className="p-6 border-b border-white/10">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center justify-between">
                    {t('chat.selectUsers') || 'Participants'}
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold shadow-sm">{members?.length || 0}</span>
                </h3>
                <div className="relative group">
                    <input
                        type="text"
                        placeholder={t('common.search') || 'Поиск...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-white/40 border border-white/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold placeholder:text-slate-400 group-hover:bg-white/60 shadow-sm"
                    />
                    <Search className="absolute left-3.5 top-3 text-slate-400 group-hover:text-indigo-500 transition-colors" size={16} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {filteredMembers.map(member => (
                    <div
                        key={member.id}
                        onClick={() => onMention(member.username)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/60 hover:shadow-sm transition-all group cursor-pointer border border-transparent hover:border-white/50"
                    >
                        <div className="flex items-center space-x-3 min-w-0">
                            <div className="relative">
                                <Avatar
                                    src={member.avatar_url}
                                    name={member.full_name || member.username}
                                    size="sm"
                                    status={member.is_online ? 'online' : undefined}
                                    className="shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-500 ring-2 ring-transparent group-hover:ring-white"
                                />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[13px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors flex items-center whitespace-pre-wrap break-words leading-tight">
                                    {member.rank && <span className="text-slate-400 mr-1 font-bold">{abbreviateRank(member.rank)}</span>}
                                    {formatName(member.full_name, member.username)}
                                </span>
                                <div className="flex items-center space-x-2 min-w-0 mt-0.5">
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider opacity-60 truncate">@{member.username}</span>
                                    {member.is_online ? (
                                        <div className="flex items-center">
                                            <div className="w-1 h-1 bg-emerald-500 rounded-full mr-1" />
                                            <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">{t('chat.online')}</span>
                                        </div>
                                    ) : member.last_seen && (
                                        <span className="text-[9px] text-slate-400 shrink-0 truncate font-bold uppercase tracking-wider">
                                            {new Date(member.last_seen).toLocaleDateString() === new Date().toLocaleDateString()
                                                ? new Date(member.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : new Date(member.last_seen).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                            }
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {member.id !== user?.id && (
                            <button
                                onClick={(e) => handleMessage(e, member.id)}
                                disabled={createDmMutation.isPending}
                                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all opacity-0 group-hover:opacity-100 shadow-xl shadow-indigo-500/10 border border-transparent hover:border-indigo-100/50"
                                title={t('chat.sendMessage') || 'Сообщение'}
                            >
                                <MessageSquare size={18} />
                            </button>
                        )}
                    </div>
                ))}

                {filteredMembers.length === 0 && (
                    <div className="p-8 text-center flex flex-col items-center opacity-50">
                        <Search size={32} className="text-slate-300 mb-2" />
                        <p className="text-slate-400 text-xs font-semibold">{t('common.noResults')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(ParticipantsList);

import React, { useState } from 'react';
import type { User } from '../../types';
import { Search, Building2, Phone, MessageSquare, Loader2, Mail, CheckSquare, Square, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Avatar from '../design-system';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';

import UserProfileModal from './components/UserProfileModal';

interface CompanyEmployeesProps {
    users: User[];
    isLoading: boolean;
    selectedUserIds: number[];
    onToggleSelection: (id: number) => void;
    onStartDM: (id: number) => void;
    isDMPending: boolean;
    pendingDMUserId?: unknown;
    currentUser: User | null;
}

const CompanyEmployees: React.FC<CompanyEmployeesProps> = ({
    users,
    isLoading,
    selectedUserIds,
    onToggleSelection,
    onStartDM,
    isDMPending,
    pendingDMUserId,
    currentUser
}) => {
    const { t } = useTranslation();
    const [itemsPerPage] = useState(24);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    const handleViewUser = (e: React.MouseEvent, user: User) => {
        e.stopPropagation();
        setViewingUser(user);
    };

    const { data: onlineData } = useQuery<{ online_user_ids: number[] }>({
        queryKey: ['users', 'online'],
        queryFn: async () => {
            const res = await api.get('/auth/users/online');
            return res.data;
        },
        refetchInterval: 30000,
    });
    const onlineUserIds = new Set(onlineData?.online_user_ids || []);

    // Helper: Group Users by Unit
    const groupedUsers = users.reduce((groups, user) => {
        const unitName = user.unit_name || t('users.no_department', 'Без подразделения');
        if (!groups[unitName]) {
            groups[unitName] = [];
        }
        groups[unitName].push(user);
        return groups;
    }, {} as Record<string, User[]>);

    // Helper: Sort Groups and Users within Groups
    const sortedGroupKeys = Object.keys(groupedUsers).sort((a, b) => {
        if (a === t('users.no_department', 'Без подразделения')) return 1;
        if (b === t('users.no_department', 'Без подразделения')) return -1;
        return a.localeCompare(b);
    });

    sortedGroupKeys.forEach(key => {
        groupedUsers[key].sort((a, b) => (a.full_name || a.username).localeCompare(b.full_name || b.username));
    });

    const flatSortedUsers = sortedGroupKeys.reduce((acc, unit) => {
        return [...acc, ...groupedUsers[unit]];
    }, [] as User[]);

    const totalPages = Math.ceil(flatSortedUsers.length / itemsPerPage);
    const paginatedUsers = flatSortedUsers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page if users content changes drastically
    React.useEffect(() => {
        setCurrentPage(1);
    }, [users.length]);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* List Header Labels */}
                {users.length > 0 && !isLoading && (
                    <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/50">
                        <div className="max-w-7xl mx-auto hidden lg:grid lg:grid-cols-[40px_2fr_1.2fr_1fr_0.8fr_40px] xl:grid-cols-[40px_2.5fr_1.2fr_1fr_1fr_1fr_40px] gap-4 px-8 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <div className="flex justify-center shrink-0">#</div>
                            <div>{t('common.fullName') || 'Сотрудник'}</div>
                            <div>{t('common.email') || 'Email'}</div>
                            <div>{t('common.phoneNumber') || 'Телефон'}</div>
                            <div>{t('common.cabinet') || 'Кабинет'}</div>
                            <div className="hidden xl:block">{t('common.birthDate') || 'День рождения'}</div>
                            <div className="text-center">{t('common.actions') || 'Чат'}</div>
                        </div>
                    </div>
                )}

                <div className="px-4 lg:px-8 py-4">
                    {isLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                            <Loader2 className="animate-spin mb-4" size={32} />
                            <p className="text-[10px] font-bold uppercase tracking-widest leading-none">{t('users.syncDirectory')}</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                            <Search size={48} className="opacity-20 mb-4" />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('users.noUsersFound')}</p>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto pb-10 space-y-1">
                            <div className="space-y-1">
                                {paginatedUsers.map((user, index) => {
                                    const currentUnit = user.unit_name || t('users.no_department', 'Без подразделения');
                                    const prevUser = index > 0 ? paginatedUsers[index - 1] : null;
                                    const prevUnit = prevUser?.unit_name || t('users.no_department', 'Без подразделения');
                                    const showHeader = index === 0 || currentUnit !== prevUnit;

                                    return (
                                        <React.Fragment key={user.id}>
                                            {showHeader && (
                                                <div className="pt-4 pb-2 px-6 flex items-center space-x-2">
                                                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                                                    <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                        {currentUnit}
                                                    </h3>
                                                    <div className="h-px flex-1 bg-slate-200" />
                                                </div>
                                            )}

                                            <div
                                                onClick={() => onToggleSelection(user.id)}
                                                className={`group flex flex-col lg:grid lg:grid-cols-[40px_2fr_1.2fr_1fr_0.8fr_40px] xl:grid-cols-[40px_2.5fr_1.2fr_1fr_1fr_1fr_40px] items-center gap-4 px-4 lg:px-6 py-2.5 rounded-lg transition-all border cursor-pointer ${selectedUserIds.includes(user.id)
                                                    ? 'bg-indigo-50 border-indigo-200'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                            >
                                                {/* Selection Checkbox */}
                                                <div className="hidden lg:flex justify-center items-center">
                                                    {currentUser?.id !== user.id && (
                                                        <div className={`transition-all duration-200 ${selectedUserIds.includes(user.id) ? 'scale-110' : 'scale-100 group-hover:scale-105 opacity-40 group-hover:opacity-100'}`}>
                                                            {selectedUserIds.includes(user.id) ? (
                                                                <div className="text-indigo-600 bg-white shadow-sm rounded-lg p-1 border border-indigo-100">
                                                                    <CheckSquare size={18} />
                                                                </div>
                                                            ) : (
                                                                <div className="text-slate-300 bg-slate-50 rounded-lg p-1 border border-slate-100">
                                                                    <Square size={18} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Identity */}
                                                <div
                                                    className="flex items-center space-x-4 w-full min-w-0 cursor-pointer group/identity"
                                                    onClick={(e) => handleViewUser(e, user)}
                                                >
                                                    <Avatar
                                                        src={user.avatar_url}
                                                        name={user.full_name || user.username}
                                                        size="md"
                                                        status={onlineUserIds.has(user.id) ? 'online' : 'offline'}
                                                        className="shrink-0 shadow-sm group-hover/identity:ring-2 group-hover/identity:ring-indigo-500/50 transition-all"
                                                    />
                                                    <div className="flex flex-col justify-center min-w-0 gap-1 py-1">
                                                        <div className="flex items-center space-x-1.5 min-w-0">
                                                            {user.rank && (
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight shrink-0">
                                                                    {user.rank}
                                                                </span>
                                                            )}
                                                            <span className="text-sm font-bold text-slate-800 break-words leading-tight group-hover/identity:text-indigo-600 transition-colors" title={user.full_name || user.username}>
                                                                {user.full_name}
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] font-bold text-indigo-500/80 uppercase tracking-wider leading-none">
                                                            @{user.username}
                                                        </span>
                                                        {user.position && (
                                                            <span className="text-xs font-medium text-slate-500/90 italic line-clamp-1 leading-none" title={user.position}>
                                                                {user.position}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Meta Fields */}
                                                <div className="hidden lg:flex items-center space-x-2 min-w-0">
                                                    <Mail size={13} className="text-slate-400 shrink-0" />
                                                    <span className="text-xs text-slate-700 truncate" title={user.email}>{user.email}</span>
                                                </div>
                                                <div className="hidden lg:flex items-center space-x-2 min-w-0">
                                                    <Phone size={13} className="text-slate-400 shrink-0" />
                                                    <span className="text-xs text-slate-700 truncate">{user.phone_number || '—'}</span>
                                                </div>
                                                <div className="hidden lg:flex items-center space-x-2 min-w-0">
                                                    <Building2 size={13} className="text-slate-400 shrink-0" />
                                                    <span className="text-xs text-slate-700 truncate">
                                                        {user.cabinet ? `Каб. ${user.cabinet}` : '—'}
                                                    </span>
                                                </div>
                                                <div className="hidden xl:flex items-center space-x-2 min-w-0">
                                                    <Calendar size={13} className="text-slate-400 shrink-0" />
                                                    <span className="text-xs text-slate-700 truncate">
                                                        {user.birth_date ? new Date(user.birth_date).toLocaleDateString('ru-RU') : '—'}
                                                    </span>
                                                </div>

                                                {/* DM Button */}
                                                <div className="flex justify-center w-full lg:w-auto mt-2 lg:mt-0">
                                                    {currentUser?.id !== user.id ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onStartDM(user.id);
                                                            }}
                                                            disabled={isDMPending}
                                                            className={`p-2 rounded-lg transition-all flex items-center justify-center ${pendingDMUserId === user.id
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600'
                                                                }`}
                                                            title={t('users.writeMessage')}
                                                        >
                                                            {isDMPending && pendingDMUserId === user.id ? (
                                                                <Loader2 size={15} className="animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <MessageSquare size={15} />
                                                                    <span className="lg:hidden text-xs font-semibold ml-2">{t('users.writeMessage')}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <div className="bg-slate-100 text-slate-400 w-full lg:w-9 h-9 rounded-lg flex items-center justify-center">
                                                            <span className="text-[9px] font-bold uppercase">ВЫ</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-center space-x-2 py-4 border-t border-slate-200">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all text-xs font-medium"
                                    >
                                        {t('common.back') || 'Назад'}
                                    </button>
                                    <div className="flex items-center space-x-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${currentPage === page
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all text-xs font-medium"
                                    >
                                        {t('common.next') || 'Далее'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <UserProfileModal
                isOpen={!!viewingUser}
                onClose={() => setViewingUser(null)}
                user={viewingUser}
                onStartDM={onStartDM}
                currentUser={currentUser}
            />
        </div>
    );
};

export default CompanyEmployees;

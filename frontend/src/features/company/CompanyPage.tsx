import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, FileUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import CompanyEmployees from './CompanyEmployees';
import api from '../../api/client';
import type { User, Unit } from '../../types';
import SendDocumentModal from '../board/components/SendDocumentModal';
import { useAuthStore } from '../../store/useAuthStore';
import { AxiosError } from 'axios';
import { Header, Button } from '../../design-system';

const CompanyPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.user);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [selectedUnitId, setSelectedUnitId] = useState<string>('all');

    // --- Data Fetching ---
    const { data: units, isLoading: unitsLoading } = useQuery<Unit[]>({
        queryKey: ['units'],
        queryFn: async () => {
            const res = await api.get('/auth/units');
            return res.data;
        },
    });

    const { data: users, isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/auth/users');
            return res.data;
        },
    });

    const isLoading = unitsLoading || usersLoading;

    // --- Filtering ---
    const filteredUsers = useMemo(() => {
        if (!users) return [];
        const query = searchQuery.toLowerCase();
        
        return users.filter((user) => {
            // Text search filter
            const matchesSearch = 
                user.username.toLowerCase().includes(query) ||
                (user.full_name?.toLowerCase().includes(query)) ||
                (user.unit_name?.toLowerCase().includes(query)) ||
                (user.rank?.toLowerCase().includes(query)) ||
                (user.position?.toLowerCase().includes(query));
            
            // Unit filter
            const matchesUnit = selectedUnitId === 'all' || 
                (selectedUnitId === 'none' && !user.unit_id) ||
                user.unit_id?.toString() === selectedUnitId;
            
            return matchesSearch && matchesUnit;
        });
    }, [users, searchQuery, selectedUnitId]);

    // --- Mutations ---
    const startDMMutation = useMutation({
        mutationFn: async (userId: number) => {
            const res = await api.post(`/chat/direct/${userId}`);
            return res.data;
        },
        onSuccess: (channel) => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            navigate(`/chat/${channel.id}`);
        },
        onError: (error: unknown) => {
            console.error('Failed to start DM:', error);
            const err = error as AxiosError<{ detail: string }>;
            alert(t('common.error') + ': ' + (err.response?.data?.detail || err.message));
        }
    });

    // --- Handlers ---
    const handleStartDM = (userId: number) => {
        startDMMutation.mutate(userId);
    };

    const toggleUserSelection = (userId: number) => {
        if (currentUser?.id === userId) return;
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // Unit filter options
    const unitOptions = [
        { value: 'all', label: t('company.all_units', 'Все подразделения') },
        { value: 'none', label: t('company.no_unit', 'Без подразделения') },
        ...(units || []).map(unit => ({
            value: unit.id.toString(),
            label: unit.name
        }))
    ];

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden animate-in fade-in duration-300">
            {/* Header with Design System */}
            <div className="px-6 pt-4 pb-2 shrink-0 z-20 sticky top-0 pointer-events-none">
                <Header
                    title={t('company.subtitle', 'Личного состава')}
                    subtitle={t('company.title', 'Справочник')}
                    icon={<Users size={20} />}
                    iconColor="indigo"
                    searchPlaceholder={t('users.searchPlaceholder', 'Поиск по ФИО, должности, званию...')}
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    onSearchClear={() => setSearchQuery('')}
                    actions={
                        <div className="flex items-center gap-3">
                            {/* Unit Filter - Compact */}
                            <select
                                value={selectedUnitId}
                                onChange={(e) => setSelectedUnitId(e.target.value)}
                                className="h-10 px-3 pr-8 bg-white/50 border border-slate-200/50 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm hover:bg-white"
                            >
                                {unitOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            
                            {/* Send Document Button */}
                            {selectedUserIds.length > 0 && (
                                <Button
                                    variant="primary"
                                    size="md"
                                    icon={<FileUp size={18} />}
                                    onClick={() => setIsSendModalOpen(true)}
                                >
                                    {t('board.send_document') || 'Отправить'} ({selectedUserIds.length})
                                </Button>
                            )}
                        </div>
                    }
                    sticky={false}
                    className="pointer-events-auto"
                />
            </div>

            {/* Content - Employee List with smooth transition */}
            <div className="flex-1 overflow-hidden relative">
                <div 
                    key={selectedUnitId}
                    className="h-full w-full animate-in fade-in duration-300"
                >
                    <CompanyEmployees
                        users={filteredUsers}
                        isLoading={isLoading}
                        selectedUserIds={selectedUserIds}
                        onToggleSelection={toggleUserSelection}
                        onStartDM={handleStartDM}
                        isDMPending={startDMMutation.isPending}
                        pendingDMUserId={startDMMutation.variables}
                        currentUser={currentUser}
                    />
                </div>
            </div>

            <SendDocumentModal
                isOpen={isSendModalOpen}
                onClose={() => {
                    setIsSendModalOpen(false);
                    setSelectedUserIds([]);
                }}
                recipientIds={selectedUserIds}
                recipientNames={users?.filter(u => selectedUserIds.includes(u.id)).map(u => u.full_name || u.username) || []}
            />
        </div>
    );
};

export default CompanyPage;

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import {
    ClipboardList, Plus, ListTodo, Send, CheckCircle2, Search
} from 'lucide-react';
import {
    useTasksReceived, useTasksIssued, useTasksCompleted,
    useConfirmTask, useDeleteTask
} from './tasksApi';
import TaskCard from './components/TaskCard';
import CreateTaskModal from './components/CreateTaskModal';
import type { Task } from './types';
import { Button, TabNavigation, Header } from '../../design-system';

const TasksPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);

    // Initialize tab from URL or default to 'received'
    const initialTab = (searchParams.get('tab') as 'received' | 'issued' | 'completed') || 'received';
    const [activeTab, setActiveTabRaw] = useState<'received' | 'issued' | 'completed'>(initialTab);

    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // View Mode from preferences
    const viewMode = user?.preferences?.tasks_view || 'list';

    // Sync state with URL
    const setActiveTab = (tab: 'received' | 'issued' | 'completed') => {
        setActiveTabRaw(tab);
        setSearchParams(prev => {
            prev.set('tab', tab);
            return prev;
        });
    };

    // Update tab if URL changes externally (e.g. navigation)
    useEffect(() => {
        const tab = searchParams.get('tab') as 'received' | 'issued' | 'completed';
        if (tab && tab !== activeTab) {
            setTimeout(() => setActiveTabRaw(tab), 0);
        }
    }, [searchParams, activeTab]);

    const highlightTaskId = searchParams.get('taskId') ? Number(searchParams.get('taskId')) : null;

    // Data Fetching
    const { data: receivedTasks, isLoading: isReceivedLoading } = useTasksReceived();
    const { data: issuedTasks, isLoading: isIssuedLoading } = useTasksIssued();
    const { data: completedTasks, isLoading: isCompletedLoading } = useTasksCompleted();

    // Mutations
    const confirmMutation = useConfirmTask();
    const deleteMutation = useDeleteTask();

    const [completedFilter, setCompletedFilter] = useState<'my_execution' | 'my_orders'>('my_execution');

    // Filtering
    const getFilteredTasks = useCallback((tasks: Task[] | undefined) => {
        if (!tasks) return [];
        let filtered = tasks;

        // Apply Completed Sub-filter
        if (activeTab === 'completed' && user) {
            if (completedFilter === 'my_execution') {
                filtered = filtered.filter(t => t.assignee_id === user.id);
            } else {
                filtered = filtered.filter(t => t.issuer_id === user.id);
            }
        }

        if (!searchQuery) return filtered;
        const lowerQuery = searchQuery.toLowerCase();
        return filtered.filter(task =>
            task.title.toLowerCase().includes(lowerQuery) ||
            task.description.toLowerCase().includes(lowerQuery) ||
            task.issuer?.full_name.toLowerCase().includes(lowerQuery) ||
            task.assignee?.full_name.toLowerCase().includes(lowerQuery)
        );
    }, [activeTab, user, completedFilter, searchQuery]);

    const currentTasks = useMemo(() => {
        switch (activeTab) {
            case 'received': return getFilteredTasks(receivedTasks);
            case 'issued': return getFilteredTasks(issuedTasks);
            case 'completed': return getFilteredTasks(completedTasks);
            default: return [];
        }
    }, [activeTab, receivedTasks, issuedTasks, completedTasks, getFilteredTasks]);

    const isLoading =
        (activeTab === 'received' && isReceivedLoading) ||
        (activeTab === 'issued' && isIssuedLoading) ||
        (activeTab === 'completed' && isCompletedLoading);

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-6 pt-4 pb-2 shrink-0 z-20 sticky top-0 pointer-events-none">
                <Header
                    title={t(`tasks.subtitle.${activeTab}`)}
                    subtitle={t('tasks.title')}
                    icon={<ClipboardList size={20} />}
                    iconColor="indigo"
                    searchPlaceholder={t('tasks.search_placeholder')}
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    onSearchClear={() => setSearchQuery('')}
                    tabs={[
                        {
                            id: 'received',
                            label: t('tasks.tabs.received'),
                            icon: <ListTodo size={13} />,
                            badge: receivedTasks?.length || 0,
                        },
                        {
                            id: 'issued',
                            label: t('tasks.tabs.issued'),
                            icon: <Send size={13} />,
                            badge: issuedTasks?.length || 0,
                        },
                        {
                            id: 'completed',
                            label: t('tasks.tabs.completed'),
                            icon: <CheckCircle2 size={13} />,
                            badge: completedTasks?.length || 0,
                        },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(tabId) => setActiveTab(tabId as 'received' | 'issued' | 'completed')}
                    actions={
                        <Button
                            variant="primary"
                            size="md"
                            icon={<Plus size={18} />}
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <span className="hidden sm:inline">{t('tasks.create_button')}</span>
                        </Button>
                    }
                    tabsActions={
                        activeTab === 'completed' ? (
                            <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => setCompletedFilter('my_execution')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${completedFilter === 'my_execution'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {t('tasks.filter.my_execution')}
                                </button>
                                <button
                                    onClick={() => setCompletedFilter('my_orders')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${completedFilter === 'my_orders'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {t('tasks.filter.my_orders')}
                                </button>
                            </div>
                        ) : undefined
                    }
                    sticky={false}
                    className="pointer-events-auto"
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {isLoading ? (
                    <div className="flex justify-center pt-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : currentTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                        <CheckCircle2 size={48} className="mb-4 text-slate-300" />
                        <p className="text-sm font-semibold">{t('tasks.empty.title')}</p>
                    </div>
                ) : (
                    <div
                        key={activeTab}
                        className={`grid gap-4 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${viewMode === 'board'
                                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                                : 'grid-cols-1'
                            }`}
                    >
                        {currentTasks.map((task: Task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                variant={activeTab}
                                onConfirm={(id) => confirmMutation.mutate(id)}
                                onDelete={(id) => deleteMutation.mutate(id)}
                                highlighted={highlightTaskId === task.id}
                                currentUserId={user?.id || 0}
                            />
                        ))}
                    </div>
                )}
            </div>

            <CreateTaskModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
};

export default TasksPage;

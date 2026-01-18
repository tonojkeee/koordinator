import React, { useState } from 'react';
import { Send, User, Users, Calendar, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../../api/client';
import { useCreateTask } from '../tasksApi';
import { TaskPriority } from '../types';
import type { User as IUser, Unit } from '../../../types';
import { formatName, abbreviateRank } from '../../../utils/formatters';
import { Modal, Button } from '../../../design-system';

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const createTaskMutation = useCreateTask();

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('18:00');

    const [targetType, setTargetType] = useState<'user' | 'unit'>('user');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
    const [userFilterUnitId, setUserFilterUnitId] = useState<number | null>(null);

    // Fetch Data
    const { data: users } = useQuery<IUser[]>({
        queryKey: ['users'],
        queryFn: async () => (await api.get('/auth/users')).data,
        enabled: isOpen,
    });

    const { data: units } = useQuery<Unit[]>({
        queryKey: ['units'],
        queryFn: async () => (await api.get('/auth/units')).data,
        enabled: isOpen,
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!title || !description || !deadlineDate || (!selectedUserId && !selectedUnitId)) return;

        const deadline = new Date(`${deadlineDate}T${deadlineTime}`).toISOString();

        createTaskMutation.mutate({
            title,
            description,
            priority,
            deadline,
            assignee_id: targetType === 'user' ? selectedUserId : null,
            unit_id: targetType === 'unit' ? selectedUnitId : null,
        }, {
            onSuccess: () => {
                // Reset form
                setTitle('');
                setDescription('');
                setSelectedUserId(null);
                setSelectedUnitId(null);
                setUserFilterUnitId(null);
                onClose();
            }
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('tasks.create_modal.title')}
            size="lg"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1 sm:flex-none"
                    >
                        {t('tasks.create_modal.cancel_button')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!title || !description || !deadlineDate || (!selectedUserId && !selectedUnitId) || createTaskMutation.isPending}
                        icon={<Send size={16} />}
                        iconPosition="right"
                        className="flex-1 sm:flex-none"
                    >
                        {createTaskMutation.isPending ? t('tasks.create_modal.submitting') : t('tasks.create_modal.submit_button')}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                {/* 1. Target Selection */}
                <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('tasks.create_modal.assignee_label')}</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl w-fit mb-3">
                            <button
                                onClick={() => setTargetType('user')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${targetType === 'user' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <User size={14} />
                                {t('tasks.create_modal.assignee_user')}
                            </button>
                            <button
                                onClick={() => setTargetType('unit')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${targetType === 'unit' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Users size={14} />
                                {t('tasks.create_modal.assignee_unit')}
                            </button>
                        </div>

                        {targetType === 'user' ? (
                            <div className="space-y-3">
                                {/* Unit Filter for User Selection */}
                                <select
                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700"
                                    value={userFilterUnitId || ''}
                                    onChange={(e) => {
                                        setUserFilterUnitId(Number(e.target.value));
                                        setSelectedUserId(null); // Reset user when unit changes
                                    }}
                                >
                                    <option value="">{t('tasks.create_modal.select_unit')}</option>
                                    {units?.map(unit => (
                                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                                    ))}
                                </select>

                                {/* Filtered User Select */}
                                <select
                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={selectedUserId || ''}
                                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                                    disabled={!userFilterUnitId}
                                >
                                    <option value="">
                                        {userFilterUnitId
                                            ? t('tasks.create_modal.select_user')
                                            : t('tasks.create_modal.select_user_first')
                                        }
                                    </option>
                                    {users
                                        ?.filter(u => userFilterUnitId ? u.unit_id === userFilterUnitId : false)
                                        .map(user => {
                                            const rank = abbreviateRank(user.rank);
                                            const name = formatName(user.full_name, user.username);
                                            const position = user.position || 'Без должности';
                                            const label = rank ? `${rank} ${name} (${position})` : `${name} (${position})`;

                                            return (
                                                <option key={user.id} value={user.id}>
                                                    {label}
                                                </option>
                                            );
                                        })
                                    }
                                </select>
                            </div>
                        ) : (
                            <select
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                value={selectedUnitId || ''}
                                onChange={(e) => setSelectedUnitId(Number(e.target.value))}
                            >
                                <option value="">{t('tasks.create_modal.select_unit_target')}</option>
                                {units?.map(unit => (
                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                ))}
                            </select>
                        )}
                        {targetType === 'unit' && (
                            <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                <AlertCircle size={12} />
                                {t('tasks.create_modal.unit_warning')}
                            </p>
                        )}
                    </div>

                    {/* 2. Task Details */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('tasks.create_modal.details_label')}</label>
                        <input
                            type="text"
                            placeholder={t('tasks.create_modal.title_placeholder')}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <textarea
                            placeholder={t('tasks.create_modal.description_placeholder')}
                            className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* 3. Deadlines & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                <Calendar size={12} /> {t('tasks.create_modal.deadline_label')}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={deadlineDate}
                                    onChange={(e) => setDeadlineDate(e.target.value)}
                                />
                                <input
                                    type="time"
                                    className="w-24 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={deadlineTime}
                                    onChange={(e) => setDeadlineTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('tasks.create_modal.priority_label')}</label>
                            <div className="flex gap-2 pt-0.5">
                                <button
                                    onClick={() => setPriority(TaskPriority.MEDIUM)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${priority === TaskPriority.MEDIUM ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {t('tasks.create_modal.priority_medium')}
                                </button>
                                <button
                                    onClick={() => setPriority(TaskPriority.HIGH)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${priority === TaskPriority.HIGH ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {t('tasks.create_modal.priority_high')}
                                </button>
                            </div>
                        </div>
                    </div>
            </div>
        </Modal>
    );
};

export default CreateTaskModal;

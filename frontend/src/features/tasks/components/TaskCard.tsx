import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Clock, CheckCircle2, User,
    CornerDownRight, FileText, XCircle, Trash2,
    CornerUpLeft, UserCheck
} from 'lucide-react';
import type { Task } from '../types';
import { TaskPriority, TaskStatus } from '../types';
import TaskReportModal from './TaskReportModal';
import TaskReturnModal from './TaskReturnModal';
import { formatName, abbreviateRank } from '../../../utils/formatters';
import { Card } from '../../../design-system';

interface TaskCardProps {
    task: Task;
    variant: 'received' | 'issued' | 'completed';
    onConfirm?: (taskId: number) => void;
    onReject?: (taskId: number) => void;
    onDelete?: (taskId: number) => void;
    highlighted?: boolean;
    currentUserId: number;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, variant, onConfirm, onDelete, highlighted, currentUserId }) => {
    const { t } = useTranslation();
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (highlighted && cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlighted]);

    const isOverdue = task.status === TaskStatus.OVERDUE;
    const isCompleted = task.status === TaskStatus.COMPLETED;
    const isOnReview = task.status === TaskStatus.ON_REVIEW;

    const isIssuer = task.issuer_id === currentUserId;
    const isAssignee = task.assignee_id === currentUserId;

    // Status badges logic - using design system color palette
    const getStatusColor = () => {
        switch (task.status) {
            case TaskStatus.COMPLETED: 
                // Success color (green) - Requirements 10.4
                return 'bg-green-100 text-green-700 border-green-200';
            case TaskStatus.OVERDUE: 
                // Danger color (rose) - Requirements 10.6
                return 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse';
            case TaskStatus.ON_REVIEW: 
                // Warning color (amber) - Requirements 10.5
                return 'bg-amber-100 text-amber-700 border-amber-200';
            default: 
                // Neutral color (slate) - Requirements 10.2
                return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getPriorityColor = () => {
        // High priority uses danger color (rose), medium uses info color (blue)
        // Requirements 10.6, 10.7
        return task.priority === TaskPriority.HIGH
            ? 'bg-rose-50 text-rose-600 border-rose-100'
            : 'bg-blue-50 text-blue-600 border-blue-100';
    };

    // Date formatting
    const formatDate = (dateStr: string) => {
        try {
            // Treat naive strings from backend as UTC by appending Z if missing
            const isoString = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
            return new Intl.DateTimeFormat('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(isoString));
        } catch {
            return dateStr;
        }
    };

    const handleDelete = () => {
        if (window.confirm(t('tasks.card.delete_confirm'))) {
            onDelete?.(task.id);
        }
    };

    return (
        <div ref={cardRef}>
            <Card
                selected={highlighted}
                hoverable={!isCompleted}
                padding="lg"
                className={`
                    relative transition-all duration-500 group
                    ${isCompleted ? 'opacity-80 hover:opacity-100' : ''}
                    ${isOverdue && !isCompleted ? 'ring-2 ring-rose-500/20' : ''}
                `}
            >
            {/* Header: Title + Priority + Status */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1 pr-4">
                    <h3 className={`text-sm font-bold leading-tight ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {task.title}
                    </h3>
                </div>
                <div className="flex gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold border ${getPriorityColor()}`}>
                        {task.priority === TaskPriority.HIGH ? t('tasks.priority.high') : t('tasks.priority.medium')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold border ${getStatusColor()}`}>
                        {isOnReview ? t('tasks.status.on_review') :
                            isOverdue ? t('tasks.status.overdue') :
                                isCompleted ? t('tasks.status.completed') : t('tasks.status.in_progress')}
                    </span>
                </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 mb-4 line-clamp-6 whitespace-pre-wrap">
                {task.description}
            </p>

            {/* Report Section (if on review or completed) */}
            {task.completion_report && (
                <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-xs font-bold text-slate-500 uppercase tracking-wide">
                        <FileText size={12} />
                        {t('tasks.card.report_label')}
                    </div>
                    <p className="text-xs text-slate-700 italic whitespace-pre-wrap break-words">
                        "{task.completion_report}"
                    </p>
                </div>
            )}

            {/* Return Reason Display (Only if in_progress and has reason) */}
            {task.status === TaskStatus.IN_PROGRESS && task.return_reason && (
                <div className="mb-4 bg-rose-50 p-3 rounded-xl border border-rose-100">
                    <div className="flex items-center gap-2 mb-1 text-xs font-bold text-rose-600 uppercase tracking-wide">
                        <CornerUpLeft size={12} />
                        {t('tasks.card.return_label')}
                    </div>
                    <p className="text-xs text-slate-700 italic whitespace-pre-wrap break-words">
                        "{task.return_reason}"
                    </p>
                </div>
            )}

            {/* Meta Info: Dates & Persons */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-4">
                    {/* Person */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-indigo-100/50 text-indigo-600 flex items-center justify-center">
                            {isIssuer ? <User size={12} /> : <UserCheck size={12} />}
                        </div>
                        <span className="font-medium truncate max-w-[200px]" title={variant === 'received' ? task.issuer?.full_name : task.assignee?.full_name}>
                            {(() => {
                                const user = variant === 'received' ? task.issuer : task.assignee;
                                if (!user) return variant === 'received' ? 'Постановщик' : 'Исполнитель';

                                const name = formatName(user.full_name, user.username);
                                const rank = abbreviateRank(user.rank);

                                return rank ? `${rank} ${name}` : name;
                            })()}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {isCompleted && task.completed_at ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-50 border border-green-100 text-green-700">
                            <CheckCircle2 size={12} />
                            <span className="font-bold text-[10px]">
                                {formatDate(task.completed_at)}
                            </span>
                        </div>
                    ) : (
                        <>
                            <Clock size={12} className={isOverdue ? 'text-rose-500' : ''} />
                            <span className={`font-semibold ${isOverdue ? 'text-rose-600' : ''}`}>
                                {formatDate(task.deadline)}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Actions Footer */}
            {!isCompleted && (
                <div className="mt-4 flex justify-end gap-2 items-center">
                    {/* For Assignee: Report Button */}
                    {isAssignee && (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.OVERDUE) && (
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                        >
                            <CornerDownRight size={14} />
                            {t('tasks.card.report_button')}
                        </button>
                    )}

                    {/* For Issuer: Confirm/Reject */}
                    {isIssuer && task.status === TaskStatus.ON_REVIEW && (
                        <>
                            <button
                                onClick={() => setIsReturnModalOpen(true)}
                                className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                <XCircle size={14} />
                                {t('tasks.card.return_button')}
                            </button>
                            <button
                                onClick={() => onConfirm?.(task.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-green-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                {t('tasks.card.accept_button')}
                            </button>
                        </>
                    )}

                    {/* Delete: Variant 'issued' allows deletion if we want strictly issuer control */}
                    {/* Logic: Only issuer can delete. And passed onDelete handler must exist. */}
                    {isIssuer && onDelete && (
                        <button
                            onClick={handleDelete}
                            className="ml-auto bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5"
                            title={t('tasks.card.delete_button')}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Modals */}
            <TaskReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                taskId={task.id}
            />
            <TaskReturnModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                taskId={task.id}
            />
        </Card>
        </div>
    );
};

export default TaskCard;

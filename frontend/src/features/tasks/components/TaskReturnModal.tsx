import React, { useState } from 'react';
import { CornerUpLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRejectTask } from '../tasksApi';
import { Modal, Button } from '../../../design-system';

interface TaskReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId: number;
}

const TaskReturnModal: React.FC<TaskReturnModalProps> = ({ isOpen, onClose, taskId }) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const rejectTaskMutation = useRejectTask();

    const handleSubmit = () => {
        if (!reason.trim()) return;

        rejectTaskMutation.mutate({ taskId, reason }, {
            onSuccess: () => {
                setReason('');
                onClose();
            }
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('tasks.return_modal.title')}
            size="md"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1 sm:flex-none"
                    >
                        {t('tasks.return_modal.cancel_button')}
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleSubmit}
                        disabled={!reason.trim() || rejectTaskMutation.isPending}
                        icon={<CornerUpLeft size={14} />}
                        iconPosition="right"
                        className="flex-1 sm:flex-none"
                    >
                        {rejectTaskMutation.isPending ? t('tasks.return_modal.submitting') : t('tasks.return_modal.submit_button')}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-slate-600">{t('tasks.return_modal.description')}</p>
                <textarea
                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                    placeholder={t('tasks.return_modal.placeholder')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    autoFocus
                />
            </div>
        </Modal>
    );
};

export default TaskReturnModal;

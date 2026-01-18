import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReportTask } from '../tasksApi';
import { Modal, Button } from '../../../design-system';

interface TaskReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId: number;
}

const TaskReportModal: React.FC<TaskReportModalProps> = ({ isOpen, onClose, taskId }) => {
    const { t } = useTranslation();
    const [reportText, setReportText] = useState('');
    const reportTaskMutation = useReportTask();

    const handleSubmit = () => {
        if (!reportText.trim()) return;

        reportTaskMutation.mutate({ taskId, report: { report_text: reportText } }, {
            onSuccess: () => {
                setReportText('');
                onClose();
            }
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('tasks.report_modal.title')}
            size="md"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1 sm:flex-none"
                    >
                        {t('tasks.report_modal.cancel_button')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!reportText.trim() || reportTaskMutation.isPending}
                        icon={<Send size={14} />}
                        iconPosition="right"
                        className="flex-1 sm:flex-none"
                    >
                        {reportTaskMutation.isPending ? t('tasks.report_modal.submitting') : t('tasks.report_modal.submit_button')}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-slate-600">{t('tasks.report_modal.description')}</p>
                <textarea
                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                    placeholder={t('tasks.report_modal.placeholder')}
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    autoFocus
                />
            </div>
        </Modal>
    );
};

export default TaskReportModal;

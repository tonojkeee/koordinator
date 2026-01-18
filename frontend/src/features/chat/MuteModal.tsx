import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../design-system/components/Modal';
import { Button } from '../../design-system/components/Button';

interface MuteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMute: (duration: '1h' | '8h' | '24h' | 'forever' | null) => void;
}

const MuteModal: React.FC<MuteModalProps> = ({ isOpen, onClose, onMute }) => {
    const { t } = useTranslation();

    const handleMute = (duration: '1h' | '8h' | '24h' | 'forever' | null) => {
        onMute(duration);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('chat.notifications.muteTitle')}
            size="sm"
        >
            <div className="flex flex-col space-y-2">
                {[
                    { label: t('chat.notifications.1h'), value: '1h' },
                    { label: t('chat.notifications.8h'), value: '8h' },
                    { label: t('chat.notifications.24h'), value: '24h' },
                    { label: t('chat.notifications.forever'), value: 'forever' },
                ].map((option) => (
                    <button
                        key={option.value}
                        onClick={() => handleMute(option.value as '1h' | '8h' | '24h' | 'forever')}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-indigo-50 text-slate-700 font-bold transition-all active:scale-95 border border-slate-100 hover:border-indigo-200"
                    >
                        {option.label}
                    </button>
                ))}
                
                <div className="h-px bg-slate-200 my-2" />
                
                <Button
                    variant="danger"
                    fullWidth
                    onClick={() => handleMute(null)}
                >
                    {t('chat.notifications.unmute')}
                </Button>
            </div>
        </Modal>
    );
};

export default MuteModal;

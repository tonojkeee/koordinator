import React, { useState } from 'react';
import { Modal, Button } from '../../../design-system';
import { useTranslation } from 'react-i18next';

interface CreateFolderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ isOpen, onClose, onCreate }) => {
    const { t } = useTranslation();
    const [folderName, setFolderName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (folderName.trim()) {
            onCreate(folderName);
            setFolderName('');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('email.create_folder_modal.title')}
            size="sm"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        fullWidth
                    >
                        {t('email.create_folder_modal.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!folderName.trim()}
                        fullWidth
                    >
                        {t('email.create_folder_modal.create')}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                        {t('email.create_folder_modal.name_placeholder')}
                    </label>
                    <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        placeholder={t('email.create_folder_modal.name_placeholder')}
                        className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40 transition-all placeholder:text-slate-400 placeholder:font-medium"
                        autoFocus
                    />
                </div>
            </form>
        </Modal>
    );
};

export default CreateFolderModal;

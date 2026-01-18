import React, { useState, useRef, useLayoutEffect, startTransition } from 'react';
import { Upload, File } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUploadAndShare } from '../boardApi';
import { useToast } from '../../../design-system';
import { Modal } from '../../../design-system/components/Modal';
import { Input } from '../../../design-system/components/Input';
import { TextArea } from '../../../design-system/components/TextArea';
import { Button } from '../../../design-system/components/Button';

interface SendDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipientIds: number[];
    recipientNames: string[];
    channelName?: string;
    channelId?: number;
    preSelectedFile?: File | null;
}

const SendDocumentModal: React.FC<SendDocumentModalProps> = ({ isOpen, onClose, recipientIds, recipientNames, channelName, channelId, preSelectedFile }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const { mutate: uploadAndShare, isPending } = useUploadAndShare();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        if (preSelectedFile) {
            startTransition(() => {
                setFile(preSelectedFile);
                setTitle(prev => prev || preSelectedFile.name.split('.').slice(0, -1).join('.'));
            });
        }
    }, [preSelectedFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (!title) {
                setTitle(selectedFile.name.split('.').slice(0, -1).join('.'));
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const hasValidRecipients = channelId ? true : recipientIds.length > 0;

        if (!file || !title || !hasValidRecipients) {
            return;
        }

        uploadAndShare({ title, description, file, recipientIds, channelId }, {
            onSuccess: () => {
                addToast({
                    type: 'success',
                    title: t('board.send_modal.success_title'),
                    message: t('board.send_modal.success_message')
                });
                onClose();
                resetForm();
            },
            onError: () => {
                addToast({
                    type: 'error',
                    title: t('board.send_modal.error_title'),
                    message: t('board.send_modal.error_message')
                });
            }
        });
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('board.send_modal.title')}
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-sm text-slate-500 font-medium -mt-2">
                    {t('board.send_modal.to')}: {channelName ? `${t('board.send_modal.to_all')} ${channelName}` : recipientNames.join(', ')}
                </p>

                <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                        file
                            ? 'border-indigo-500 bg-indigo-50/30'
                            : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                    }`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    {file ? (
                        <div className="flex flex-col items-center">
                            <div className="w-14 h-14 bg-white rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center text-indigo-600 mb-3">
                                <File size={28} />
                            </div>
                            <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{file.name}</span>
                        </div>
                    ) : (
                        <>
                            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 mb-3">
                                <Upload size={28} />
                            </div>
                            <p className="text-sm font-bold text-slate-700">{t('board.send_modal.select_file')}</p>
                        </>
                    )}
                </div>

                <Input
                    label={t('board.upload_modal.name_label')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('board.upload_modal.name_placeholder')}
                    required
                    fullWidth
                />

                <TextArea
                    label={t('board.send_modal.comment_label')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('board.send_modal.comment_placeholder')}
                    rows={4}
                    fullWidth
                />

                <div className="flex gap-3 pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        fullWidth
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isPending || !file || !title}
                        loading={isPending}
                        icon={!isPending && <Upload size={18} />}
                        fullWidth
                    >
                        {t('board.send_modal.send')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default SendDocumentModal;

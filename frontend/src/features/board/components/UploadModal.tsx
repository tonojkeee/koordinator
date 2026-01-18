import React, { useState, useRef } from 'react';
import { X, Upload, File, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUploadDocument } from '../boardApi';
import { useToast } from '../../../design-system';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const { mutate: uploadDoc, isPending } = useUploadDocument();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (!title) {
                // Auto-fill title with filename without extension
                setTitle(selectedFile.name.split('.').slice(0, -1).join('.'));
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) return;

        uploadDoc({ title, description, file }, {
            onSuccess: () => {
                addToast({
                    type: 'success',
                    title: t('board.upload_modal.success_title'),
                    message: t('board.upload_modal.success_message'),
                });
                onClose();
                resetForm();
            },
            onError: () => {
                addToast({
                    type: 'error',
                    title: t('board.upload_modal.error_title'),
                    message: t('board.upload_modal.error_message'),
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/40 ring-1 ring-white/50">
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100/50">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{t('board.upload_modal.title')}</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('board.upload_modal.subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="space-y-5">
                        {/* Dropzone/File Input */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${file
                                ? 'border-indigo-500 bg-indigo-50/50'
                                : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
                                }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex flex-col items-center animate-in zoom-in">
                                    <div className="w-14 h-14 bg-white rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center text-indigo-600 mb-3">
                                        <File size={28} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-900">{file.name}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 mb-3 group-hover:text-indigo-500 transition-colors shadow-inner">
                                        <Upload size={28} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-900">{t('board.upload_modal.click_to_select')}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-60">{t('board.upload_modal.allowed_formats')}</p>
                                </>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">{t('board.upload_modal.name_label')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full h-11 px-4 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/40 transition-all"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('board.upload_modal.name_placeholder')}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">{t('board.upload_modal.description_label')}</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/40 transition-all min-h-[90px] resize-none"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('board.upload_modal.description_placeholder')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-11 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || !file || !title}
                            className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 hovered:scale-[1.02]"
                        >
                            {isPending ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Upload size={18} />
                                    <span>{t('board.upload')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UploadModal;

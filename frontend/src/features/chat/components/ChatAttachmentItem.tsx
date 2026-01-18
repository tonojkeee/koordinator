import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileX, Download, Eye
} from 'lucide-react';
import type { ContextMenuItem } from '../../../types';
import { useContextMenu } from '../../../hooks/useContextMenu';
import api from '../../../api/client';
import { useConfigStore } from '../../../store/useConfigStore';

const getFullUrlLocal = (path: string, token: string | null): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const { serverUrl } = useConfigStore.getState();
    const baseUrl = (serverUrl || import.meta.env.VITE_API_URL || api.defaults.baseURL || '').replace(/\/api$/, '');
    const finalPath = path.startsWith('/api') ? path : path.startsWith('/board') ? `/api${path}` : path;
    return `${baseUrl}${finalPath}${token ? (finalPath.includes('?') ? `&token=${token}` : `?token=${token}`) : ''}`;
};

 interface ChatAttachmentItemProps {
    msg: import('../../../types').Message;
    isSent: boolean;
    onView: () => void;
    onDownload: () => void;
    getFileConfig: (filename: string) => { icon: React.ReactNode; color: string; label: string };
    token: string | null;
}

export const ChatAttachmentItem: React.FC<ChatAttachmentItemProps> = ({
    msg,
    isSent,
    onView,
    onDownload,
    getFileConfig,
    token
}) => {
    const { t } = useTranslation();
    const config = getFileConfig(msg.file_path || '');
    const fileExt = (msg.file_path?.split('.').pop() || 'file').toUpperCase();
    const isDeleted = msg.is_document_deleted;

    const menuItems: ContextMenuItem[] = isDeleted ? [] : [
        { id: 'view', label: t('common.view') },
        { id: 'download', label: t('common.download') },
    ];

    const handleContextMenu = useContextMenu(menuItems, (id) => {
        if (id === 'view') onView();
        if (id === 'download') onDownload();
    });

    const isElectron = window.electron !== undefined;

    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const isImage = msg.file_path && imageExtensions.includes(fileExt.toLowerCase());
    const imageUrl = isImage ? getFullUrlLocal(`/board/documents/${msg.document_id}/view`, token) : null;

    if (isDeleted) {
        return (
            <div className="mt-2 w-full max-w-sm group/attach select-none">
                <div className={`flex items-center space-x-3.5 p-3 rounded-2xl border transition-all duration-300 ${isSent
                    ? 'bg-black/10 border-white/10 hover:bg-black/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isSent ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                        <FileX size={22} className="opacity-60" />
                    </div>
                    <div className="flex-1 min-w-0 pr-1">
                        <h4 className={`text-[13px] font-bold tracking-tight ${isSent ? 'text-white' : 'text-slate-700'}`}>
                            {t('chat.document_deleted')}
                        </h4>
                        <div className="flex items-center space-x-2 mt-0.5">
                            <span className={`text-[10px] font-black tracking-[0.1em] uppercase ${isSent ? 'text-indigo-200/50' : 'text-slate-400'}`}>
                                {t('common.unavailable')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isImage && imageUrl) {
        return (
            <div
                onClick={onView}
                onContextMenu={handleContextMenu}
                className={`mt-2 ${isSent ? 'ml-auto' : ''} w-full max-w-sm group/attach cursor-pointer`}
            >
                <div className={`rounded-xl overflow-hidden transition-all duration-300`}>
                    <img
                        src={imageUrl}
                        alt={msg.document_title || 'Image'}
                        className="w-full h-auto max-h-48 object-cover"
                        loading="lazy"
                    />
                    <div className={`px-2.5 py-1.5 flex items-center justify-between ${isSent
                        ? 'bg-white/10 backdrop-blur-sm'
                        : 'bg-slate-50'
                        }`}>
                        <div className="flex-1 min-w-0">
                            <h4 className={`text-[11px] font-bold truncate ${isSent ? 'text-white' : 'text-slate-900'}`}>
                                {msg.document_title || t('chat.fileNotification.document')}
                            </h4>
                        </div>
                        <div className="flex items-center space-x-1 ml-2 shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isSent
                                    ? 'text-white hover:bg-white/20'
                                    : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                title={t('chat.fileNotification.download')}
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={isElectron ? onDownload : onView}
            onContextMenu={handleContextMenu}
            className={`mt-2 ${isSent ? 'ml-auto' : ''} w-full max-w-sm group/attach cursor-pointer`}
        >
            <div className={`flex items-center space-x-4 p-3.5 rounded-2xl border transition-all duration-300 ${isSent
                ? 'bg-white/10 border-white/10 hover:bg-white/15'
                : 'bg-white border-slate-100 hover:border-indigo-100'
                }`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isSent ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                    {config.icon}
                </div>

                <div className="flex-1 min-w-0 pr-1">
                    <h4 className={`text-[13px] font-bold truncate transition-colors ${isSent ? 'text-white' : 'text-slate-900 group-hover/attach:text-indigo-600'
                        }`}>
                        {msg.document_title || t('chat.fileNotification.document')}
                    </h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                        <span className={`text-[10px] font-black tracking-wider uppercase ${isSent ? 'text-indigo-200' : 'text-indigo-500'}`}>
                            {fileExt}
                        </span>
                        <span className={`w-1 h-1 rounded-full opacity-30 ${isSent ? 'bg-white' : 'bg-slate-400'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-tight opacity-50 truncate max-w-[100px] ${isSent ? 'text-white' : 'text-slate-500'}`}>
                            {config.label}
                        </span>
                    </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                    <button
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onView(); }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isSent
                            ? 'bg-white/10 text-white hover:bg-white/25 active:scale-90'
                            : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95'
                            }`}
                        title={t('chat.fileNotification.view')}
                    >
                        <Eye size={17} />
                    </button>
                    <button
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            const url = getFullUrlLocal(`/board/documents/${msg.document_id}/download`, token);
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', msg.document_title || 'download');
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isSent
                            ? 'bg-white/10 text-white hover:bg-white/25 active:scale-90'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-700 active:scale-95'
                            }`}
                        title={t('chat.fileNotification.download')}
                    >
                        <Download size={17} />
                    </button>
                </div>
            </div>
        </div>
    );
};

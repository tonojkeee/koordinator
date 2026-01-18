import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Trash2, User, Calendar, Eye, MessageSquare } from 'lucide-react';
import type { Document, DocumentShare } from '../types';
import type { ContextMenuItem } from '../../../types';
import { useDeleteDocument } from '../boardApi';
import { useTranslation } from 'react-i18next';
import { useDocumentViewer } from '../store/useDocumentViewer';
import { useAuthStore } from '../../../store/useAuthStore';
import { useConfigStore } from '../../../store/useConfigStore';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/client';

interface DocumentListProps {
    documents?: Document[];
    shares?: DocumentShare[];
    type: 'owned' | 'received';
}

const DocumentList: React.FC<DocumentListProps> = ({ documents, shares, type }) => {
    const { t } = useTranslation();
    const { token } = useAuthStore();
    const { mutate: deleteDoc } = useDeleteDocument();
    const openViewer = useDocumentViewer(state => state.open);
    const [hoveredDocId, setHoveredDocId] = useState<number | null>(null);

    const getFullUrl = (path: string, isApi = false) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = (import.meta.env.VITE_API_URL || api.defaults.baseURL || '').replace('/api', '');
        const finalPath = isApi ? `/api${path}` : path;
        return `${baseUrl}${finalPath}`;
    };

    const handleDelete = useCallback((id: number) => {
        if (window.confirm(t('board.list.delete_confirm'))) {
            deleteDoc(id);
        }
    }, [deleteDoc, t]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && hoveredDocId && type === 'owned') {
                handleDelete(hoveredDocId);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hoveredDocId, type, handleDelete]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in">
            {type === 'owned' ? (
                documents?.map((doc) => (
                    <DocumentListItem
                        key={doc.id}
                        doc={doc}
                        type="owned"
                        onView={() => openViewer(getFullUrl(`/board/documents/${doc.id}/view?token=${token}`, true), doc.title, doc.file_path)}
                        onDownload={() => {
                            const url = getFullUrl(`/board/documents/${doc.id}/download?token=${token}`, true);
                            window.location.href = url;
                        }}
                        onDelete={() => handleDelete(doc.id)}
                        onMouseEnter={() => setHoveredDocId(doc.id)}
                        onMouseLeave={() => setHoveredDocId(null)}
                    />
                ))
            ) : (
                shares?.map((share) => (
                    <DocumentListItem
                        key={share.id}
                        doc={share.document}
                        share={share}
                        type="received"
                        onView={() => openViewer(getFullUrl(`/board/documents/${share.document.id}/view?token=${token}`, true), share.document.title, share.document.file_path)}
                        onDownload={() => {
                            const url = getFullUrl(`/board/documents/${share.document.id}/download?token=${token}`, true);
                            window.location.href = url;
                        }}
                        onMouseEnter={() => setHoveredDocId(share.document.id)}
                        onMouseLeave={() => setHoveredDocId(null)}
                    />
                ))
            )}
        </div>
    );
};

interface ChannelInfoProps {
    share?: DocumentShare;
    docId: number;
}

const ChannelInfo: React.FC<ChannelInfoProps> = ({ share, docId }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    if (!share?.channels || share.channels.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 mt-1">
            {share.channels.map(c => (
                <button
                    key={c.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/chat/${c.id}?docId=${docId}`);
                    }}
                    className="flex items-center text-[10px] text-slate-500 font-medium hover:text-indigo-600 transition-colors group text-left"
                >
                    <MessageSquare size={10} className="mr-1 opacity-50 group-hover:opacity-100" />
                    <span className="opacity-70 mr-1">{t('board.list.in_chat')}:</span>
                    <span className="text-indigo-600 truncate max-w-[150px] underline decoration-dotted">{c.name}</span>
                </button>
            ))}
        </div>
    );
};

interface DocumentListItemProps {
    doc: Document;
    type: 'owned' | 'received';
    onView: () => void;
    onDownload: () => void;
    onDelete?: () => void;
    share?: DocumentShare;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

const DocumentListItem: React.FC<DocumentListItemProps> = ({
    doc,
    type,
    onView,
    onDownload,
    onDelete,
    share,
    onMouseEnter,
    onMouseLeave
}) => {
    const { t } = useTranslation();
    const { token } = useAuthStore();
    const isElectron = window.electron !== undefined;
    const { serverUrl } = useConfigStore();

    const getFullUrl = (path: string, isApi = false) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = (serverUrl || import.meta.env.VITE_API_URL || api.defaults.baseURL || '').replace(/\/api$/, '');
        const finalPath = isApi ? `/api${path}` : path;
        return `${baseUrl}${finalPath}`;
    };

    const menuItems: ContextMenuItem[] = [
        { id: 'view', label: t('board.list.view') },
        { id: 'download', label: t('board.list.download') },
    ];

    if (isElectron) {
        menuItems.push({ id: 'copy-path', label: t('board.copy_path') });
    }

    if (type === 'owned') {
        const separator: ContextMenuItem = { id: 'sep1', type: 'separator', label: '' };
        menuItems.push(separator);
        menuItems.push({ id: 'delete', label: t('board.list.delete') });
    }

    const handleContextMenu = useContextMenu(menuItems, (id) => {
        if (id === 'view') onView();
        if (id === 'download') onDownload();
        if (id === 'delete') onDelete?.();
        if (id === 'copy-path' && isElectron) {
            window.electron?.copyToClipboard(doc.file_path);
        }
    });

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => doc.file_path.toLowerCase().endsWith(`.${ext}`));

    const viewUrl = getFullUrl(`/board/documents/${doc.id}/view?token=${token}`, true);

    return (
        <div
            onClick={isElectron ? onDownload : onView}
            onContextMenu={handleContextMenu}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className="group bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 cursor-pointer flex flex-col h-full"
        >
            <div className="relative mb-2.5 rounded-lg overflow-hidden aspect-[3/2] bg-slate-50 border border-slate-100 group-hover:border-indigo-100 transition-colors">
                {isImage ? (
                    <img
                        src={viewUrl}
                        alt={doc.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).onerror = null;
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center');
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-200 group-hover:text-indigo-600 transition-colors">
                        <FileText size={32} />
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-1.5">
                    <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2" title={doc.title}>{doc.title}</h3>
                    {type === 'owned' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0 ml-2"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>

                {type === 'received' && (
                    <div className="mt-auto pt-2 border-t border-slate-50 space-y-1">
                        <div className="flex items-center justify-between text-[9px]">
                            <div className="flex items-center text-slate-500">
                                <User size={10} className="mr-1 opacity-50" />
                                <span className="font-semibold text-slate-700">{doc.owner?.full_name || doc.owner?.username}</span>
                            </div>
                            <span className="text-slate-400">{share && new Date(share.created_at).toLocaleDateString()}</span>
                        </div>
                        <ChannelInfo share={share} docId={doc.id} />
                    </div>
                )}

                {type === 'owned' && (
                    <div className="mt-auto pt-2 flex items-center text-[10px] text-slate-400">
                        <Calendar size={12} className="mr-1.5 opacity-50" />
                        {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                )}
            </div>

            <div className="mt-3 flex space-x-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onView(); }}
                    className="flex-1 flex items-center justify-center space-x-2 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-all"
                >
                    <Eye size={14} />
                    <span>{t('board.list.view')}</span>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDownload(); }}
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all border border-slate-100"
                >
                    <Download size={14} />
                </button>
            </div>
        </div>
    );
};

export default DocumentList;

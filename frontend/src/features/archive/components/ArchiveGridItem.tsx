import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Folder as FolderIcon,
    Trash2,
    Clock,
    User as UserIcon
} from 'lucide-react';
import type { ContextMenuItem } from '../../../types';
import { useContextMenu } from '../../../hooks/useContextMenu';
import type { ArchiveFolder, ArchiveFile } from '../types';
import { formatDate, formatSize } from '../utils';
import api from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { useConfigStore } from '../../../store/useConfigStore';

interface ArchiveFolderCardProps {
    folder: ArchiveFolder;
    index: number;
    isSelected: boolean;
    selectionCount: number;
    onNavigate: (folder: ArchiveFolder) => void;
    onClick: (e: React.MouseEvent, index: number) => void;
    onDelete: (folder: ArchiveFolder) => void;
    onCopy: (items: { id: number, type: 'file' | 'folder' }[]) => void;
    onCut: (items: { id: number, type: 'file' | 'folder' }[]) => void;
    onPaste: () => void;
    clipboard: { action: 'copy' | 'cut'; items: { id: number; type: 'file' | 'folder' }[] } | null;
    selectedItems: { id: number; type: 'file' | 'folder' }[];
    currentUserId: number | undefined;
    userRole: string | undefined;
    userUnitId: number | null | undefined;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onRename?: (item: { id: number; type: 'file' | 'folder'; name: string }) => void;
    onProperties?: (item: ArchiveFolder | ArchiveFile) => void;
}

export const ArchiveFolderCard: React.FC<ArchiveFolderCardProps> = ({
    folder,
    index,
    isSelected,
    selectionCount,
    onNavigate,
    onClick,
    onDelete,
    onCopy,
    onCut,
    onPaste,
    clipboard,
    selectedItems,
    currentUserId,
    userRole,
    userUnitId,
    onMouseEnter,
    onMouseLeave,
    onRename,
    onProperties
}) => {
    const { t } = useTranslation();
    const canDelete = userRole === 'admin' || (userUnitId != null && userUnitId === folder.unit_id) || currentUserId === folder.owner_id;

    const menuItems: ContextMenuItem[] = [
        { id: 'open', label: t('archive.open') },
        { id: 'sep1', type: 'separator', label: '' } as ContextMenuItem,
        { id: 'cut', label: (isSelected && selectionCount > 1) ? t('archive.cut_items', { count: selectionCount }) : t('archive.cut_action') },
        { id: 'copy', label: (isSelected && selectionCount > 1) ? t('archive.copy_items', { count: selectionCount }) : t('archive.copy') },
        ...(clipboard ? [{ id: 'paste', label: t('archive.paste_items', { count: clipboard.items.length }) }] : []),
        { id: 'sep2', type: 'separator', label: '' } as ContextMenuItem,
        { id: 'rename', label: t('archive.rename'), enabled: selectionCount <= 1 },
        { id: 'delete', label: (isSelected && selectionCount > 1) ? t('archive.delete_items', { count: selectionCount }) : t('archive.delete') },
        { id: 'sep3', type: 'separator', label: '' } as ContextMenuItem,
        { id: 'properties', label: t('archive.properties'), enabled: selectionCount <= 1 }
    ].filter(item => {
        if (item.id === 'delete') return canDelete;
        return true;
    });

    const handleContextMenu = useContextMenu(menuItems, (id) => {
        if (id === 'open') onNavigate(folder);
        if (id === 'copy') onCopy(isSelected && selectionCount > 1 ? selectedItems : [{ id: folder.id, type: 'folder' }]);
        if (id === 'cut') onCut(isSelected && selectionCount > 1 ? selectedItems : [{ id: folder.id, type: 'folder' }]);
        if (id === 'paste') onPaste();
        if (id === 'delete') onDelete(folder);
        if (id === 'rename' && onRename) onRename({ id: folder.id, type: 'folder', name: folder.name });
        if (id === 'properties' && onProperties) onProperties(folder);
    });

    return (
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => onClick(e, index)}
            onDoubleClick={(e) => { e.stopPropagation(); onNavigate(folder); }}
            onContextMenu={handleContextMenu}
            className={`group rounded-xl border p-4 transition-all duration-300 cursor-pointer relative flex flex-col justify-between min-h-[120px] ${isSelected
                ? 'bg-indigo-50 border-indigo-500 shadow-md shadow-indigo-100 ring-4 ring-indigo-500/5'
                : 'bg-white border-slate-200/60 hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-100'
                }`}
        >
            {canDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                    title={t('archive.delete')}
                >
                    <Trash2 size={14} />
                </button>
            )}
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 group-hover:bg-amber-100 transition-colors">
                        <FolderIcon size={24} fill="currentColor" fillOpacity={0.2} />
                    </div>
                </div>
                <h3 className="font-bold text-slate-900 truncate pr-2" title={folder.name}>
                    {folder.name}
                </h3>
            </div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mt-4 pt-4 border-t border-slate-50">
                <div className="flex items-center space-x-1">
                    <UserIcon size={10} />
                    <span className="truncate max-w-[80px]">{folder.owner_name}</span>
                </div>
                <div className="flex items-center space-x-1">
                    <Clock size={10} />
                    <span>{formatDate(folder.created_at, t)}</span>
                </div>
            </div>
        </div>
    );
};

interface ArchiveFileCardProps {
    file: ArchiveFile;
    index: number;
    isSelected: boolean;
    selectionCount: number;
    onView: () => void;
    onDownload: () => void;
    onOpenNative?: () => void;
    onClick: (e: React.MouseEvent, index: number) => void;
    onDelete: (file: ArchiveFile) => void;
    onCopy: (items: { id: number, type: 'file' | 'folder' }[]) => void;
    onCut: (items: { id: number, type: 'file' | 'folder' }[]) => void;
    onPaste: () => void;
    clipboard: { action: 'copy' | 'cut'; items: { id: number; type: 'file' | 'folder' }[] } | null;
    selectedItems: { id: number, type: 'file' | 'folder' }[];
    currentUserId: number | undefined;
    userRole: string | undefined;
    userUnitId: number | null | undefined;
    getFileIcon: (mime?: string) => React.ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onRename?: (item: { id: number; type: 'file' | 'folder'; name: string }) => void;
    onProperties?: (item: ArchiveFolder | ArchiveFile) => void;
}

export const ArchiveFileCard: React.FC<ArchiveFileCardProps> = ({
    file,
    index,
    isSelected,
    selectionCount,
    onView,
    onDownload,
    onOpenNative,
    onClick,
    onDelete,
    onCopy,
    onCut,
    onPaste,
    clipboard,
    selectedItems,
    currentUserId,
    userRole,
    userUnitId,
    getFileIcon,
    onMouseEnter,
    onMouseLeave,
    onRename,
    onProperties
}) => {
    const { t } = useTranslation();
    const canDelete = userRole === 'admin' || (file.unit_id != null && userUnitId === file.unit_id) || currentUserId === file.owner_id;
    const isElectron = (window as unknown as { electron: unknown }).electron !== undefined;

    const delLabel = (isSelected && selectionCount > 1) ? t('archive.delete_items', { count: selectionCount }) : t('archive.delete');
    const copyLabel = (isSelected && selectionCount > 1) ? t('archive.copy_items', { count: selectionCount }) : t('archive.copy');
    const cutLabel = (isSelected && selectionCount > 1) ? t('archive.cut_items', { count: selectionCount }) : t('archive.cut_action');

    const menuItems: ContextMenuItem[] = [
        { id: 'view', label: t('archive.open') },
        ...(isElectron ? [{ id: 'open-native', label: 'Открыть в системе' }] : []),
        { id: 'download', label: t('archive.download') },
        { id: 'sep1', type: 'separator', label: '' } as ContextMenuItem,
        { id: 'cut', label: cutLabel },
        { id: 'copy', label: copyLabel },
        ...(clipboard ? [{ id: 'paste', label: t('archive.paste_items', { count: clipboard.items.length }) }] : []),
        { id: 'sep2', type: 'separator', label: '' } as ContextMenuItem,
        { id: 'rename', label: t('archive.rename'), enabled: selectionCount <= 1 },
        { id: 'delete', label: delLabel },
        { id: 'sep3', type: 'separator', label: '' } as ContextMenuItem,
        ...(isElectron ? [{ id: 'copy-path', label: t('archive.copy_path') }] : []),
        { id: 'properties', label: t('archive.properties'), enabled: selectionCount <= 1 }
    ];

    const filteredItems = menuItems.filter(item => {
        if (item.id === 'delete') return canDelete;
        return true;
    });

    const handleContextMenu = useContextMenu(filteredItems, (id) => {
        if (id === 'view') onView();
        if (id === 'download') onDownload();
        if (id === 'open-native' && onOpenNative) onOpenNative();
        if (id === 'copy') onCopy(isSelected && selectionCount > 1 ? selectedItems : [{ id: file.id, type: 'file' }]);
        if (id === 'cut') onCut(isSelected && selectionCount > 1 ? selectedItems : [{ id: file.id, type: 'file' }]);
        if (id === 'paste') onPaste();
        if (id === 'delete') onDelete(file);
        if (id === 'rename' && onRename) onRename({ id: file.id, type: 'file', name: file.title });
        if (id === 'properties' && onProperties) onProperties(file);
        if (id === 'copy-path' && isElectron) {
            window.electron!.copyToClipboard(file.file_path);
        }
    });

    return (
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => onClick(e, index)}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (!isElectron) {
                    onView();
                } else if (onOpenNative) {
                    onOpenNative();
                } else {
                    onDownload();
                }
            }}
            onContextMenu={handleContextMenu}
            className={`group rounded-xl border p-4 transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[120px] ${isSelected
                ? 'bg-indigo-50 border-indigo-500 shadow-md shadow-indigo-100 ring-4 ring-indigo-500/5'
                : 'bg-white border-slate-200/60 hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-100'
                }`}
        >
            {canDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(file); }}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                    title={t('archive.delete')}
                >
                    <Trash2 size={14} />
                </button>
            )}
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-50 transition-colors overflow-hidden shrink-0">
                        {file.mime_type?.startsWith('image/') ? (
                            <img
                                src={`${useConfigStore.getState().serverUrl || api.defaults.baseURL}/archive/files/${file.id}/view?token=${useAuthStore.getState().token}`}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            getFileIcon(file.mime_type)
                        )}
                    </div>
                </div>

                <h3 className="font-bold text-slate-900 truncate pr-2 group-hover:text-indigo-600 transition-colors" title={file.title}>
                    {file.title}
                </h3>
            </div>

            <div className="flex flex-col space-y-2 mt-4 pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <div className="flex items-center space-x-1">
                        <UserIcon size={10} />
                        <span className="truncate max-w-[80px]">{file.owner_name}</span>
                    </div>
                    <span>{formatSize(file.file_size)}</span>
                </div>
                <div className="flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <Clock size={10} />
                    <span>{formatDate(file.created_at, t)}</span>
                </div>
            </div>
        </div>
    );
};

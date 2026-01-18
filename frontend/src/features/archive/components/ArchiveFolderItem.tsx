import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileIcon,
    Folder as FolderIcon
} from 'lucide-react';
import type { ContextMenuItem } from '../../../types';
import { useContextMenu } from '../../../hooks/useContextMenu';
import type { ArchiveFolder } from '../types';
import { formatDate } from '../utils';

interface ArchiveFolderItemProps {
    folder: ArchiveFolder;
    index: number;
    isSelected: boolean;
    selectionCount: number;
    onNavigate: (folder: ArchiveFolder) => void;
    onClick: (e: React.MouseEvent, type: 'file' | 'folder', item: { type: 'file' | 'folder'; data: ArchiveFolder | ArchiveFile }, index: number) => void;
    onDelete: (folder: ArchiveFolder) => void;
    onCopy: (items: { id: number; type: 'file' | 'folder' }[]) => void;
    onCut: (items: { id: number; type: 'file' | 'folder' }[]) => void;
    onPaste: () => void;
    clipboard: { action: 'copy' | 'cut'; items: { id: number; type: 'file' | 'folder' }[] } | null;
    selectedItems: { id: number; type: 'file' | 'folder' }[];
    currentUserId: number | undefined;
    userRole: string | undefined;
    userUnitId: number | null | undefined;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onRename?: (item: { id: number; type: 'file' | 'folder'; name: string }) => void;
    onProperties?: (item: { id: number; type: 'file' | 'folder' }) => void;
}

export const ArchiveFolderItem: React.FC<ArchiveFolderItemProps> = ({
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
        if (id === 'properties' && onProperties) onProperties({ id: folder.id, type: 'folder' });
    });

    return (
        <div
            className={`grid grid-cols-12 gap-2 px-4 py-1 border-b border-slate-100/60 transition-colors cursor-pointer group items-center ${isSelected ? 'bg-indigo-50/50 hover:bg-indigo-100/30' : 'hover:bg-slate-50/30'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => onClick(e, 'folder', index)}
            onDoubleClick={(e) => { e.stopPropagation(); onNavigate(folder); }}
            onContextMenu={handleContextMenu}
        >
            <div className="col-span-6 flex items-center space-x-3 min-w-0">
                <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors shrink-0">
                    <FolderIcon size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900 transition-colors">{folder.name}</span>
            </div>
            <div className="col-span-2 flex items-center text-xs text-slate-400 font-medium">
                —
            </div>
            <div className="col-span-3 flex items-center text-xs text-slate-400 font-medium">
                {formatDate(folder.created_at, t)}
            </div>
            <div className="col-span-1 flex items-center justify-end">
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
                    className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
};

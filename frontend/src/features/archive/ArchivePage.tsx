import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Search,
    Plus,
    Clock,
    User as UserIcon,
    Building2,
    ClipboardList,
    Trash2,
    LayoutGrid,
    List,
    ChevronRight,
    Home,
    FolderPlus,
    Upload,
    ArrowUp,
    Edit2,
    Info,
    X,
    HardDrive,
    FileIcon,
    Image as ImageIcon
} from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfigStore } from '../../store/useConfigStore';
import { useToast } from '../design-system';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { useDocumentViewer } from '../board/store/useDocumentViewer';
import { formatDate, formatSize } from './utils';
import type { ArchiveFolder, ArchiveFile, ArchiveItem } from './types';
import { ArchiveFolderListRow, ArchiveFileListRow } from './components/ArchiveListRow';


const RenameModal: React.FC<{
    folder: ArchiveFolder;
    index: number;
    isSelected: boolean;
    selectionCount: number;
    onNavigate: (folder: ArchiveFolder) => void;
    onClick: (e: React.MouseEvent, type: 'file' | 'folder', item: ArchiveItem, index: number) => void;
    onDelete: (folder: ArchiveFolder) => void;
    onCopy: (items: { id: number, type: 'file' | 'folder' }[]) => void;
    onCut: (items: { id: number, type: 'file' | 'folder' }[]) => void;
    onPaste: () => void;
    clipboard: { action: 'copy' | 'cut'; items: { id: number; type: 'file' | 'folder' }[] } | null;
    selectedItems: { id: number, type: 'file' | 'folder' }[];
    currentUserId: number | undefined;
    userRole: string | undefined;
    userUnitId: number | null | undefined;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onRename?: (folder: ArchiveFolder) => void;
    onProperties?: (folder: ArchiveFolder) => void;
}> = ({ folder, index, isSelected, selectionCount, onNavigate, onClick, onDelete, onCopy, onCut, onPaste, clipboard, selectedItems, currentUserId, userRole, userUnitId, onMouseEnter, onMouseLeave, onRename, onProperties }) => {
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
        if (id === 'rename' && onRename) onRename(folder);
        if (id === 'properties' && onProperties) onProperties(folder);
    });

    return (
        <div
            className={`grid grid-cols-12 gap-2 px-4 py-1 border-b border-slate-100/60 transition-colors cursor-pointer group items-center ${isSelected ? 'bg-indigo-50/50 hover:bg-indigo-100/30' : 'hover:bg-slate-50/30'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => onClick(e, 'folder', folder, index)}
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
                {/* Format folder content count like 'X объектов' */}
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

const ArchiveFileListRow: React.FC<{
    file: ArchiveFile;
    index: number;
    isSelected: boolean;
    selectionCount: number;
    onView: () => void;
    onDownload: () => void;
    onOpenNative?: () => void;
    onClick: (e: React.MouseEvent, type: 'file' | 'folder', item: ArchiveItem, index: number) => void;
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
    onRename?: (file: ArchiveFile) => void;
    onProperties?: (file: ArchiveFile) => void;
}> = ({ file, index, isSelected, selectionCount, onView, onDownload, onOpenNative, onClick, onDelete, onCopy, onCut, onPaste, clipboard, selectedItems, currentUserId, userRole, userUnitId, getFileIcon, onMouseEnter, onMouseLeave, onRename, onProperties }) => {
    const { t } = useTranslation();
    const canDelete = userRole === 'admin' || (userUnitId != null && userUnitId === file.unit_id) || currentUserId === file.owner_id;
    const isElectron = window.electron !== undefined;

    const menuItems: ContextMenuItem[] = [
        { id: 'view', label: t('archive.open') },
        ...(isElectron ? [{ id: 'open-native', label: 'Открыть в системе' }] : []),
        { id: 'download', label: t('archive.download') },
        { id: 'sep1', type: 'separator', label: '' } as ContextMenuItem,
        { id: 'cut', label: (isSelected && selectionCount > 1) ? t('archive.cut_items', { count: selectionCount }) : t('archive.cut_action') },
        { id: 'copy', label: (isSelected && selectionCount > 1) ? t('archive.copy_items', { count: selectionCount }) : t('archive.copy') },
        ...(clipboard ? [{ id: 'paste', label: t('archive.paste_items', { count: clipboard.items.length }) }] : []),
        { id: 'sep2', type: 'separator', label: '' } as ContextMenuItem,
        { id: 'rename', label: t('archive.rename'), enabled: selectionCount <= 1 },
        { id: 'delete', label: (isSelected && selectionCount > 1) ? t('archive.delete_items', { count: selectionCount }) : t('archive.delete') },
        { id: 'sep3', type: 'separator', label: '' } as ContextMenuItem,
        ...(isElectron ? [{ id: 'copy-path', label: t('archive.copy_path') }] : []),
        { id: 'properties', label: t('archive.properties'), enabled: selectionCount <= 1 }
    ];

    const handleContextMenu = useContextMenu(menuItems.filter(item => item.id !== 'delete' || canDelete), (id) => {
        if (id === 'view') onView();
        if (id === 'download') onDownload();
        if (id === 'open-native' && onOpenNative) onOpenNative();
        if (id === 'copy') onCopy(isSelected && selectionCount > 1 ? selectedItems : [{ id: file.id, type: 'file' }]);
        if (id === 'cut') onCut(isSelected && selectionCount > 1 ? selectedItems : [{ id: file.id, type: 'file' }]);
        if (id === 'paste') onPaste();
        if (id === 'delete') onDelete(file);
        if (id === 'rename' && onRename) onRename(file);
        if (id === 'properties' && onProperties) onProperties(file);
        if (id === 'copy-path' && isElectron) {
            window.electron!.copyToClipboard(file.file_path);
        }
    });

    return (
        <div
            className={`grid grid-cols-12 gap-2 px-4 py-1 border-b border-slate-100/60 transition-colors cursor-pointer group items-center ${isSelected ? 'bg-indigo-50/50 hover:bg-indigo-100/30' : 'hover:bg-slate-50/30'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={(e) => onClick(e, 'file', file, index)}
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
        >
            <div className="col-span-6 flex items-center space-x-3 min-w-0">
                <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0">
                    {getFileIcon(file.mime_type)}
                </div>
                <span className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900 transition-colors">{file.title}</span>
            </div>
            <div className="col-span-2 flex items-center text-xs text-slate-400 font-medium italic">
                {formatSize(file.file_size)}
            </div>
            <div className="col-span-3 flex items-center text-xs text-slate-400 font-medium">
                {formatDate(file.created_at, t)}
            </div>
            <div className="col-span-1 flex items-center justify-end">
                {canDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(file); }}
                        className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
        </div>
    );
};

// --- Rename Modal ---
const RenameModal: React.FC<{
    item: { id: number; type: 'file' | 'folder'; name: string };
    onClose: () => void;
    onSuccess: (id: number, type: 'file' | 'folder', newName: string) => void;
}> = ({ item, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [name, setName] = useState(item.name);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && name !== item.name) {
            onSuccess(item.id, item.type, name.trim());
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
                <h3 className="text-xl font-bold text-slate-900 mb-5 flex items-center">
                    <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mr-3">
                        <Edit2 size={18} />
                    </div>
                    {t('archive.rename')}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                            {t('archive.newName')}
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white transition-all outline-none font-medium"
                            placeholder={t('archive.enterName')}
                        />
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={!name.trim() || name === item.name}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                        >
                            {t('common.save')}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 active:scale-[0.98] transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Properties Modal ---
const PropertiesModal: React.FC<{
    item: ArchiveFolder | ArchiveFile;
    type: 'file' | 'folder';
    onClose: () => void;
}> = ({ item, type, onClose }) => {
    const { t } = useTranslation();
    const isFolder = type === 'folder';
    const folder = item as ArchiveFolder;
    const file = item as ArchiveFile;

    const details = [
        { label: t('archive.name'), value: isFolder ? folder.name : file.title },
        { label: t('archive.type'), value: isFolder ? t('archive.folder') : (file.mime_type || t('archive.unknownType')) },
        { label: t('archive.size'), value: isFolder ? '—' : formatSize(file.file_size) },
        { label: t('archive.created'), value: formatDate(isFolder ? folder.created_at : file.created_at, t) },
        { label: t('archive.owner'), value: (isFolder ? folder.owner_name : file.owner_name) || '—' },
        ...(isFolder ? [] : [{ label: t('archive.path'), value: file.file_path }])
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center">
                        <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mr-3">
                            <Info size={18} />
                        </div>
                        {t('archive.properties')}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-3.5">
                    {details.map((detail, idx) => (
                        <div key={idx} className="flex flex-col space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{detail.label}</span>
                            <span className="text-slate-700 text-sm font-medium break-all">{detail.value}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-8">
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ArchiveFolderItem: React.FC<{
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
    selectedItems: { id: number, type: 'file' | 'folder' }[];
    currentUserId: number | undefined;
    userRole: string | undefined;
    userUnitId: number | null | undefined;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onRename?: (folder: ArchiveFolder) => void;
    onProperties?: (folder: ArchiveFolder) => void;
}> = ({ folder, index, isSelected, selectionCount, onNavigate, onClick, onDelete, onCopy, onCut, onPaste, clipboard, selectedItems, currentUserId, userRole, userUnitId, onMouseEnter, onMouseLeave, onRename, onProperties }) => {
    const { t } = useTranslation();
    // Delete permission: admin OR same unit OR owner
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
        if (id === 'rename' && onRename) onRename(folder);
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
            {/* Delete button - visible on hover if user can delete */}
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

const ArchiveFileItem: React.FC<{
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
    onRename?: (file: ArchiveFile) => void;
    onProperties?: (file: ArchiveFile) => void;
}> = ({ file, index, isSelected, selectionCount, onView, onDownload, onOpenNative, onClick, onDelete, onCopy, onCut, onPaste, clipboard, selectedItems, currentUserId, userRole, userUnitId, getFileIcon, onMouseEnter, onMouseLeave, onRename, onProperties }) => {
    const { t } = useTranslation();
    // Delete permission: admin OR same unit OR owner
    const canDelete = userRole === 'admin' || (userUnitId != null && userUnitId === file.unit_id) || currentUserId === file.owner_id;

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
        if (id === 'rename' && onRename) onRename(file);
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
            {/* Delete button - visible on hover if user can delete */}
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
        </div >
    );
};

// --- Subcomponents ---

const CreateFolderModal: React.FC<{
    parentId: number | null,
    unitId: number | null,
    isPrivate: boolean,
    onClose: () => void,
    onSuccess: () => void
}> = ({ parentId, unitId, isPrivate, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        setIsLoading(true);
        try {
            await api.post('/archive/folders', {
                name,
                parent_id: parentId,
                unit_id: unitId,
                is_private: isPrivate
            });
            addToast({ type: 'success', title: t('common.success'), message: t('archive.folderCreated') || 'Папка создана' });
            onSuccess();
        } catch {
            addToast({ type: 'error', title: t('common.error'), message: t('archive.errorCreatingFolder') || 'Ошибка создания' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-6 py-6">
                    <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 mx-auto mb-4">
                        <FolderPlus size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6 text-center">
                        {t('archive.createFolder') || 'Новая папка'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-500/20 text-slate-900 font-bold text-center placeholder:text-slate-300 transition-all underline-offset-4"
                            placeholder={t('archive.folderNamePlaceholder')}
                            required
                        />
                        <div className="flex space-x-3 mt-8">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !name}
                                className="flex-1 px-6 py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-amber-200"
                            >
                                {isLoading ? '...' : t('common.create')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const UploadArchiveModal: React.FC<{
    onClose: () => void,
    onSuccess: () => void,
    initialFile?: File | null,
    folderId: number | null,
    unitId: number | null,
    isPrivate: boolean
}> = ({ onClose, onSuccess, initialFile, folderId, unitId, isPrivate }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();

    // Check for folder upload data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const folderData = (window as unknown as Window & { __folderUploadData: any }).__folderUploadData;
    const isFolder = !!folderData;

    const [file, setFile] = useState<File | null>(initialFile || null);
    const [title, setTitle] = useState(initialFile?.name || '');
    const [description, setDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (!title) setTitle(selectedFile.name);
        }
    };

    const uploadSingleFile = async (fileToUpload: File, fileTitle: string, fileDesc: string) => {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('title', fileTitle);
        formData.append('description', fileDesc);
        formData.append('is_private', isPrivate.toString());
        if (folderId) {
            formData.append('folder_id', folderId.toString());
        }
        if (unitId) {
            formData.append('unit_id', unitId.toString());
        }

        await api.post('/archive/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    };

    const createFolder = async (name: string, parentId: number | null): Promise<number> => {
        const response = await api.post('/archive/folders', {
            name,
            parent_id: parentId,
            unit_id: unitId,
            is_private: isPrivate
        });
        return response.data.id;
    };

    const uploadFolder = async () => {
        if (!folderData) return;

        const { files, folderName } = folderData;
        const folderMap = new Map<string, number | null>();

        // Create the root folder first (the dragged folder itself)
        const rootFolderId = await createFolder(folderName, folderId);
        folderMap.set('', rootFolderId);

        setUploadProgress({ current: 0, total: files.length });

        for (let i = 0; i < files.length; i++) {
            const { file, relativePath } = files[i];
            const pathParts = relativePath.split('/');
            const fileName = pathParts.pop()!;
            const folderPath = pathParts.join('/');

            // Create subfolders if they don't exist
            if (folderPath && !folderMap.has(folderPath)) {
                let currentPath = '';
                for (const part of pathParts) {
                    const prevPath = currentPath;
                    currentPath = currentPath ? `${currentPath}/${part}` : part;

                    if (!folderMap.has(currentPath)) {
                        const parentFolderId = folderMap.get(prevPath) || rootFolderId;
                        const newFolderId = await createFolder(part, parentFolderId);
                        folderMap.set(currentPath, newFolderId);
                    }
                }
            }

            // Upload file to its folder
            const targetFolderId = folderMap.get(folderPath) || rootFolderId;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', fileName);
            formData.append('description', `Из папки: ${folderName}`);
            formData.append('is_private', isPrivate.toString());
            if (targetFolderId) {
                formData.append('folder_id', targetFolderId.toString());
            }
            if (unitId) {
                formData.append('unit_id', unitId.toString());
            }

            await api.post('/archive/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUploadProgress({ current: i + 1, total: files.length });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isFolder) {
            if (!folderData) return;
        } else {
            if (!file || !title) return;
        }

        setIsUploading(true);
        try {
            if (isFolder) {
                await uploadFolder();
                addToast({
                    type: 'success',
                    title: t('common.success'),
                    message: `Папка "${folderData.folderName}" успешно загружена`
                });
            } else {
                await uploadSingleFile(file!, title, description);
                addToast({
                    type: 'success',
                    title: t('common.success'),
                    message: t('archive.uploadModal.successMessage') || 'Файл успешно добавлен'
                });
            }

            // Clear folder data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as unknown as Window & { __folderUploadData: any }).__folderUploadData;
            onSuccess();
        } catch {
            addToast({
                type: 'error',
                title: t('common.error'),
                message: t('archive.uploadModal.errorMessage') || 'Ошибка загрузки'
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                {isFolder ? `Загрузка папки` : t('archive.uploadModal.title')}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                {isFolder ? `${folderData.files.length} файлов` : t('archive.uploadModal.subtitle')}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                            <Plus className="rotate-45" size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {isFolder ? (
                            <>
                                {/* Folder info */}
                                <div className="bg-amber-50 rounded-xl p-5 border-2 border-amber-100">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <FolderIcon size={20} className="text-amber-500" />
                                        <span className="font-bold text-slate-900">{folderData.folderName}</span>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Будет создана структура папок с {folderData.files.length} файлами
                                    </p>
                                </div>

                                {/* Progress */}
                                {isUploading && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium text-slate-600">
                                            <span>Загрузка...</span>
                                            <span>{uploadProgress.current} / {uploadProgress.total}</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-indigo-600 h-full transition-all duration-300"
                                                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('archive.uploadModal.fileLabel')}</label>
                                    <label className="block w-full cursor-pointer group">
                                        <div className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${file ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}>
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${file ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                                                <Plus size={24} />
                                            </div>
                                            <span className={`text-sm text-center font-bold ${file ? 'text-indigo-600' : 'text-slate-500 group-hover:text-indigo-600'}`}>
                                                {file ? file.name : t('archive.uploadModal.dropzone')}
                                            </span>
                                            {file && <span className="text-[10px] text-indigo-400 mt-1">{formatSize(file.size)}</span>}
                                            <input type="file" className="hidden" onChange={handleFileChange} />
                                        </div>
                                    </label>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('archive.uploadModal.nameLabel')}</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full h-11 px-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/10 text-slate-900 font-bold placeholder:text-slate-300 transition-all text-sm"
                                        placeholder={t('archive.uploadModal.name_placeholder') || "Название..."}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('archive.uploadModal.descLabel')}</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/10 text-slate-900 font-medium placeholder:text-slate-300 transition-all min-h-[90px] resize-none text-sm"
                                        placeholder={t('archive.uploadModal.descLabel') || "Описание..."}
                                    />
                                </div>
                            </>
                        )}

                        <div className="flex space-x-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isUploading}
                                className="flex-1 h-11 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50 text-sm"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={(!file && !isFolder) || (!title && !isFolder) || isUploading}
                                className="flex-[2] h-11 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center text-sm"
                            >
                                {isUploading ? 'Загрузка...' : (isFolder ? 'Загрузить папку' : t('archive.uploadModal.submit'))}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
const ArchivePage: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const { addToast, updateToast, removeToast } = useToast();
    const openViewer = useDocumentViewer(state => state.open);
    const [selectedItems, setSelectedItems] = useState<{ id: number, type: 'file' | 'folder' }[]>([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [currentUnitId, setCurrentUnitId] = useState<number | null>(null);
    const [path, setPath] = useState<{ id: number | null, unitId?: number | null, name: string }[]>([{ id: null, name: 'Root' }]);
    const [clipboard, setClipboard] = useState<{
        action: 'copy' | 'cut';
        items: { id: number, type: 'file' | 'folder' }[];
    } | null>(null);
    const clipboardRef = React.useRef(clipboard);
    React.useEffect(() => { clipboardRef.current = clipboard; }, [clipboard]);

    const clearSelection = useCallback(() => {
        setSelectedItems([]);
        setLastSelectedIndex(null);
    }, []);

    const navigateToFolder = useCallback((folder: ArchiveFolder | null) => {
        if (!folder) {
            setCurrentFolderId(null);
            setCurrentUnitId(null);
            setPath([{ id: null, name: 'Root' }]);
        } else {
            setCurrentFolderId(folder.id);
            setCurrentUnitId(folder.unit_id || null);

            // Build path from folder and its parents if available
            // This is a simplified version, usually you'd fetch the full path or have it in the folder object
            setPath(prev => {
                const index = prev.findIndex(p => p.id === folder.id);
                if (index !== -1) return prev.slice(0, index + 1);
                return [...prev, { id: folder.id, name: folder.name, unitId: folder.unit_id }];
            });
        }
        setSelectedItems([]);
    }, []); // Note: dependencies might need refinement based on exact logic


    // Tabs state
    const [activeTab, setActiveTab] = useState<'global' | 'mine'>('global');
    const [searchQuery, setSearchQuery] = useState('');

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [hoveredItem, setHoveredItem] = useState<{ type: 'file' | 'folder', item: ArchiveItem } | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{
        isOpen: boolean;
        items: { id: number, type: 'file' | 'folder', name: string }[];
    }>({ isOpen: false, items: [] });
    const [isDragging, setIsDragging] = useState(false);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    const dragCounter = React.useRef(0);
    const [renameState, setRenameState] = useState<{ isOpen: boolean; item: { id: number; type: 'file' | 'folder'; name: string } | null }>({ isOpen: false, item: null });
    const [propertiesState, setPropertiesState] = useState<{ isOpen: boolean; item: ArchiveItem | null; type: 'file' | 'folder' | null }>({ isOpen: false, item: null, type: null });

    // Fetch all units for global view
    const { data: units, isLoading: isUnitsLoading } = useQuery<Unit[]>({
        queryKey: ['auth', 'units'],
        queryFn: async () => {
            const res = await api.get('/auth/units');
            return res.data;
        }
    });

    // Fetch current user info to avoid stale data
    const { data: profile } = useQuery<User>({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            const res = await api.get('/auth/me');
            return res.data;
        },
        staleTime: 1000 * 60 * 5 // 5 minutes
    });

    const activeUser = profile || user;

    useEffect(() => {
        const search = searchParams.get('search');
        const upload = searchParams.get('upload');

        if (search === 'true' || upload === 'true') {
            const timer = setTimeout(() => {
                if (search === 'true') {
                    searchInputRef.current?.focus();
                }
                if (upload === 'true') {
                    setIsUploadModalOpen(true);
                }

                // Clear params after handling
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('search');
                newParams.delete('upload');
                setSearchParams(newParams, { replace: true });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [searchParams, setSearchParams]);

    const canInteract = useMemo(() => {
        if (!activeUser) return false;

        // Never allow interaction at the root of "All Departments" tab
        if (activeTab === 'global' && currentUnitId === null) return false;

        if (activeUser.role === 'admin') return true;
        if (activeTab === 'mine') return true;

        const curUnitId = String(currentUnitId);
        const userUnitId = activeUser.unit_id != null ? String(activeUser.unit_id) : null;

        if (curUnitId && userUnitId && curUnitId === userUnitId) return true;

        // Fallback: check by Name (safety measure for ID inconsistencies)
        const currentUnitName = units?.find(u => String(u.id) === curUnitId)?.name;
        if (currentUnitName && activeUser.unit_name &&
            currentUnitName.trim().toLowerCase() === activeUser.unit_name.trim().toLowerCase()) {
            return true;
        }

        return false;
    }, [activeUser, activeTab, currentUnitId, units]);

    const handleOpenNative = useCallback(async (file: ArchiveFile) => {
        if (!window.electron) return;
        const baseUrl = api.defaults.baseURL || '';
        const previewUrl = `${baseUrl}/archive/files/${file.id}/view?token=${useAuthStore.getState().token}`;
        const toastId = addToast({ type: 'info', title: 'Открытие...', message: `Запуск ${file.title} в системе`, duration: 2000 });
        const result = await window.electron.openInNativeApp(previewUrl, file.title, file.id);
        if (!result.success) {
            updateToast(toastId, { type: 'error', title: 'Ошибка', message: result.error || 'Не удалось открыть файл' });
        }
    }, [addToast, updateToast]);

    // Handle "Edit-in-Place" file modifications
    useEffect(() => {
        if (!window.electron?.onFileModified) return;

        window.electron.onFileModified(async (data) => {
            const { fileId, filePath, fileName } = data;

            addToast({
                type: 'info',
                title: 'Файл изменен',
                message: `Хотите сохранить изменения в ${fileName}?`,
                duration: 10000,
                action: {
                    label: 'Загрузить',
                    onClick: async () => {
                        try {
                            const fileResult = await window.electron!.readFile(filePath);
                            if (fileResult.success) {
                                // Re-upload the file
                                const fileData = typeof fileResult.data === 'string' ? fileResult.data : '';
                                const binaryString = atob(fileData);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                const blob = new Blob([bytes], { type: 'application/octet-stream' });

                                const formData = new FormData();
                                formData.append('file', blob, fileName);
                                formData.append('file_id', fileId.toString());

                                await api.post('/archive/files/update-content', formData, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                });

                                addToast({ type: 'success', title: 'Обновлено', message: `Файл ${fileName} успешно сохранен`, duration: 3000 });
                                queryClient.invalidateQueries({ queryKey: ['archive'] });
                            }
                        } catch (error) {
                            console.error('Error auto-syncing file:', error);
                            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось сохранить изменения', duration: 5000 });
                        }
                    }
                }
            });
        });
    }, [addToast, queryClient]);


    const performBatchUpload = useCallback(async (items: DataTransferItemList) => {
        if (!canInteract) return;

        const progressId = addToast({
            type: 'info',
            title: t('archive.uploading') || 'Загрузка...',
            message: 'Обработка данных...',
            duration: Infinity
        });

        const processDirectoryEntry = async (entry: FileSystemDirectoryEntry, path: string = ''): Promise<Array<{ file: File; relativePath: string }>> => {
            const files: Array<{ file: File; relativePath: string }> = [];
            const reader = entry.createReader();

            const readEntries = (): Promise<FileSystemEntry[]> => {
                return new Promise((resolve, reject) => {
                    reader.readEntries(resolve, reject);
                });
            };

            const entries = await readEntries();

            for (const entryItem of entries) {
                const fullPath = path ? `${path}/${entryItem.name}` : entryItem.name;

                if (entryItem.isFile) {
                    const fileEntry = entryItem as FileSystemFileEntry;
                    const file = await new Promise<File>((resolve, reject) => {
                        fileEntry.file(resolve, reject);
                    });
                    files.push({ file, relativePath: fullPath });
                } else if (entryItem.isDirectory) {
                    const dirEntry = entryItem as FileSystemDirectoryEntry;
                    const subFiles = await processDirectoryEntry(dirEntry, fullPath);
                    files.push(...subFiles);
                }
            }

            return files;
        };

        const uploadFile = async (file: File, title: string, description: string, folderId: number | null) => {
            const isElectron = window.electron !== undefined;
            let blob: Blob;

            if (isElectron && 'path' in file) {
                // In Electron, use IPC to read file from filesystem
                const filePath = (file as File & { path: string }).path;
                const result = await window.electron!.readFile(filePath);
                if (!result.success) {
                    throw new Error(`Не удалось прочитать файл: ${result.error}`);
                }
                // Convert base64 back to ArrayBuffer
                const binaryString = atob(result.data as string);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                blob = new Blob([bytes], { type: file.type || 'application/octet-stream' });
            } else {
                // In browser, use FileReader
                const readFileAsArrayBuffer = (f: File): Promise<ArrayBuffer> => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as ArrayBuffer);
                        reader.onerror = () => reject(reader.error);
                        reader.readAsArrayBuffer(f);
                    });
                };
                const arrayBuffer = await readFileAsArrayBuffer(file);
                blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
            }

            const formData = new FormData();
            formData.append('file', blob, file.name);
            formData.append('title', title);
            formData.append('description', description);
            formData.append('is_private', (activeTab === 'mine').toString());
            if (folderId) formData.append('folder_id', folderId.toString());
            const unitId = activeTab === 'mine' ? user?.unit_id : currentUnitId;
            if (unitId) formData.append('unit_id', unitId.toString());

            await api.post('/archive/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        };

        const createRemoteFolder = async (name: string, parentId: number | null): Promise<number> => {
            const unitId = activeTab === 'mine' ? user?.unit_id : currentUnitId;
            const res = await api.post('/archive/folders', {
                name,
                parent_id: parentId,
                unit_id: unitId,
                is_private: activeTab === 'mine'
            });
            return res.data.id;
        };

        const processAndUploadFolder = async (entry: FileSystemDirectoryEntry, parentFolderId: number | null, onProgress: (msg: string) => void) => {
            const remoteFolderId = await createRemoteFolder(entry.name, parentFolderId);
            const filesWithPaths = await processDirectoryEntry(entry);

            const folderMap = new Map<string, number>();
            folderMap.set('', remoteFolderId);

            for (let i = 0; i < filesWithPaths.length; i++) {
                const { file, relativePath } = filesWithPaths[i];
                onProgress(`Загрузка (${i + 1}/${filesWithPaths.length}): ${entry.name}/${relativePath}`);

                const pathParts = relativePath.split('/');
                const fileName = pathParts.pop()!;
                const folderPath = pathParts.join('/');

                let currentRemoteParentId = remoteFolderId;

                if (folderPath) {
                    let pathAccumulator = '';
                    for (const part of pathParts) {
                        const prevPath = pathAccumulator;
                        pathAccumulator = pathAccumulator ? `${pathAccumulator}/${part}` : part;

                        if (!folderMap.has(pathAccumulator)) {
                            const pId = folderMap.get(prevPath) || remoteFolderId;
                            const newId = await createRemoteFolder(part, pId);
                            folderMap.set(pathAccumulator, newId);
                        }
                    }
                    currentRemoteParentId = folderMap.get(folderPath) || remoteFolderId;
                }

                await uploadFile(file, fileName, `Загружено через структуру папок: ${entry.name}`, currentRemoteParentId);
            }
        };

        try {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;

                if (entry?.isDirectory) {
                    updateToast(progressId, { message: `Загрузка папки: ${entry.name}` });
                    await processAndUploadFolder(entry as FileSystemDirectoryEntry, currentFolderId, (msg) => updateToast(progressId, { message: msg }));
                } else {
                    const file = item.getAsFile();
                    if (file) {
                        updateToast(progressId, { message: `Загрузка файла: ${file.name}` });
                        await uploadFile(file, file.name, 'Загружено через импорт', currentFolderId);
                    }
                }
            }

            removeToast(progressId);
            addToast({ type: 'success', title: t('common.success'), message: t('archive.upload_success') });
            addToast({ type: 'success', title: t('common.success'), message: t('archive.upload_success') });
            queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
        } catch {
            removeToast(progressId);
            addToast({ type: 'error', title: t('common.error'), message: t('archive.upload_error') });
        }
    }, [canInteract, addToast, updateToast, removeToast, t, activeTab, currentFolderId, currentUnitId, user?.unit_id, queryClient]);



    // Content query
    const { data: content, isLoading: isContentLoading } = useQuery<ArchiveContent>({
        queryKey: ['archive', 'contents', currentFolderId, currentUnitId, activeTab],
        queryFn: async () => {
            const params: Record<string, unknown> = { parent_id: currentFolderId };

            if (activeTab === 'mine') {
                params.unit_id = user?.unit_id;
                params.is_private = true;
            } else if (currentUnitId) {
                params.unit_id = currentUnitId;
                params.is_private = false;
            } else {
                return { folders: [], files: [] };
            }

            const res = await api.get('/archive/contents', { params });
            return res.data;
        },
        enabled: activeTab === 'mine' || !!currentUnitId
    });

    const isLoading = isUnitsLoading || (isContentLoading && (activeTab === 'mine' || !!currentUnitId));

    const filteredData = useMemo<FilteredData>(() => {
        if (activeTab === 'global' && !currentUnitId) {
            if (!units) return { units: [] };
            const q = searchQuery.toLowerCase();
            return {
                units: units
                    .filter(u => u.name.toLowerCase().includes(q))
                    .sort((a, b) => a.name.localeCompare(b.name))
            };
        }

        if (!content) return { folders: [], files: [] };
        const q = searchQuery.toLowerCase();
        const folders = content.folders.filter(f => f.name.toLowerCase().includes(q));
        const files = content.files.filter(f =>
            f.title.toLowerCase().includes(q) ||
            f.description?.toLowerCase().includes(q) ||
            f.owner_name?.toLowerCase().includes(q)
        );

        const sortFolders = (items: ArchiveFolder[]): ArchiveFolder[] => {
            return [...items].sort((a, b) => {
                let valA, valB;
                const { key, direction } = sortConfig;

                if (key === 'name') {
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                } else if (key === 'date') {
                    valA = new Date(a.created_at).getTime();
                    valB = new Date(b.created_at).getTime();
                } else if (key === 'size') {
                    valA = 0;
                    valB = 0;
                } else if (key === 'type') {
                    valA = 'folder';
                    valB = 'folder';
                } else if (key === 'owner') {
                    valA = (a.owner_name || '').toLowerCase();
                    valB = (b.owner_name || '').toLowerCase();
                } else {
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                }

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        };

        const sortFiles = (items: ArchiveFile[]): ArchiveFile[] => {
            return [...items].sort((a, b) => {
                let valA, valB;
                const { key, direction } = sortConfig;

                if (key === 'name') {
                    valA = a.title.toLowerCase();
                    valB = b.title.toLowerCase();
                } else if (key === 'date') {
                    valA = new Date(a.created_at).getTime();
                    valB = new Date(b.created_at).getTime();
                } else if (key === 'size') {
                    valA = a.file_size || 0;
                    valB = b.file_size || 0;
                } else if (key === 'type') {
                    valA = (a.mime_type || '').toLowerCase();
                    valB = (b.mime_type || '').toLowerCase();
                } else if (key === 'owner') {
                    valA = (a.owner_name || '').toLowerCase();
                    valB = (b.owner_name || '').toLowerCase();
                } else {
                    valA = a.title.toLowerCase();
                    valB = b.title.toLowerCase();
                }

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        };

        return {
            folders: sortFolders(folders),
            files: sortFiles(files)
        };
    }, [content, searchQuery, sortConfig, activeTab, currentUnitId, units]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const isCtrl = e.ctrlKey || e.metaKey;

            // Delete key
            if (e.key === 'Delete' && (hoveredItem || selectedItems.length > 0) && canInteract) {
                const itemsToDelete = selectedItems.length > 0
                    ? selectedItems.map(si => {
                        const items = [...(content?.folders || []), ...(content?.files || [])];
                        // Narrowing to avoid Unit
                        const it = items.find(x => x.id === si.id && (('file_path' in x ? 'file' : 'folder') === si.type)) as ArchiveFolder | ArchiveFile | undefined;
                        const name = it && ('name' in it ? it.name : it.title);
                        return { id: si.id, type: si.type, name: name || 'Unknown' };
                    })
                    : hoveredItem ? [{
                        id: hoveredItem.item.id,
                        type: hoveredItem.type,
                        name: ('name' in hoveredItem.item ? (hoveredItem.item as ArchiveFolder | Unit).name : (hoveredItem.item as ArchiveFile).title)
                    }] : [];

                if (itemsToDelete.length > 0) {
                    setDeleteConfirm({
                        isOpen: true,
                        items: itemsToDelete
                    });
                }
            }

            // Ctrl+C - Copy
            if (isCtrl && e.key === 'c' && selectedItems.length > 0) {
                e.preventDefault();
                setClipboard({ action: 'copy', items: [...selectedItems] });
                addToast({ type: 'info', title: t('archive.copied'), message: t('archive.buffer_items', { count: selectedItems.length }) });
            }

            // Ctrl+X - Cut
            if (isCtrl && e.key === 'x' && selectedItems.length > 0 && canInteract) {
                e.preventDefault();
                setClipboard({ action: 'cut', items: [...selectedItems] });
                addToast({ type: 'info', title: t('archive.cut'), message: t('archive.buffer_items', { count: selectedItems.length }) });
            }

            // F2 - Rename
            if (e.key === 'F2') {
                if (selectedItems.length === 1 && canInteract) {
                    const si = selectedItems[0];
                    const items = [...(filteredData.folders || []), ...(filteredData.files || [])];
                    const found = items.find(it => it.id === si.id && (si.type === 'folder' ? !('file_path' in it) : 'file_path' in it));
                    if (found) {
                        setRenameState({ isOpen: true, item: { id: si.id, type: si.type, name: 'name' in found ? found.name : found.title } });
                    }
                }
            }

            // Alt+Enter - Properties
            if (e.altKey && e.key === 'Enter') {
                if (selectedItems.length === 1) {
                    const si = selectedItems[0];
                    const items = [...(filteredData.folders || []), ...(filteredData.files || [])];
                    const found = items.find(it => it.id === si.id && (si.type === 'folder' ? !('file_path' in it) : 'file_path' in it));
                    if (found) {
                        e.preventDefault();
                        setPropertiesState({ isOpen: true, item: found as ArchiveFolder | ArchiveFile, type: si.type });
                    }
                }
            }

            // Enter - Open/View
            if (e.key === 'Enter' && !e.altKey && selectedItems.length === 1) {
                const si = selectedItems[0];
                if (si.type === 'folder') {
                    const folder = (filteredData.folders || []).find(f => f.id === si.id);
                    if (folder) navigateToFolder(folder);
                } else {
                    const file = (filteredData.files || []).find(f => f.id === si.id);
                    if (file) {
                        const previewUrl = `${api.defaults.baseURL}/archive/files/${file.id}/view?token=${useAuthStore.getState().token}`;
                        if (window.electron) {
                            handleOpenNative(file);
                        } else {
                            openViewer(previewUrl, file.title, file.file_path, file.mime_type);
                        }
                    }
                }
            }

            // Ctrl+A - Select All
            if (isCtrl && e.key === 'a') {
                e.preventDefault();
                const all = [
                    ...(filteredData.folders || []).map(f => ({ id: f.id, type: 'folder' as const })),
                    ...(filteredData.files || []).map(f => ({ id: f.id, type: 'file' as const }))
                ];
                setSelectedItems(all);
            }

            // Esc - Clear Selection
            if (e.key === 'Escape') {
                clearSelection();
            }
        };

        const handlePaste = async (e: ClipboardEvent) => {
            if (!canInteract) return;

            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Check if we have internal clipboard items - paste those first
            const currentClipboard = clipboardRef.current;
            if (currentClipboard && currentClipboard.items.length > 0) {
                e.preventDefault();
                const toastId = addToast({ type: 'info', title: t('archive.pasting'), message: t('archive.processing'), duration: Infinity });
                try {
                    const payload = {
                        action: currentClipboard.action === 'cut' ? 'move' : 'copy',
                        item_ids: currentClipboard.items.map(i => i.id),
                        item_types: currentClipboard.items.map(i => i.type),
                        target_folder_id: currentFolderId,
                        target_unit_id: activeTab === 'mine' ? activeUser?.unit_id : currentUnitId,
                        is_private: activeTab === 'mine'
                    };
                    await api.post('/archive/batch-action', payload);
                    queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
                    updateToast(toastId, { type: 'success', title: t('common.success'), message: t('archive.paste_success'), duration: 3000 });
                    if (currentClipboard.action === 'cut') {
                        setClipboard(null);
                    }
                } catch {
                    updateToast(toastId, { type: 'error', title: t('common.error'), message: t('archive.paste_error'), duration: 4000 });
                }
                return;
            }

            // Otherwise, try to upload files from system clipboard
            // First try Electron's native clipboard API for multi-file support
            const isElectron = window.electron !== undefined;
            if (isElectron) {
                try {
                    const result = await window.electron!.getClipboardFilePaths();
                    if (result.success && result.paths.length > 0) {
                        e.preventDefault();

                        const toastId = addToast({
                            type: 'info',
                            title: t('archive.uploading') || t('common.loading'),
                            message: t('archive.found_clipboard', { count: result.paths.length }),
                            duration: Infinity
                        });

                        try {
                            // Helper to get MIME type from filename
                            const getMimeType = (filename: string): string => {
                                const ext = filename.toLowerCase().split('.').pop();
                                const mimeTypes: Record<string, string> = {
                                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                                    'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
                                    'bmp': 'image/bmp', 'ico': 'image/x-icon',
                                    'pdf': 'application/pdf', 'doc': 'application/msword',
                                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                    'xls': 'application/vnd.ms-excel',
                                    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                    'ppt': 'application/vnd.ms-powerpoint',
                                    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                                    'txt': 'text/plain', 'csv': 'text/csv', 'json': 'application/json',
                                    'xml': 'application/xml', 'html': 'text/html', 'css': 'text/css',
                                    'js': 'application/javascript', 'ts': 'text/typescript',
                                    'zip': 'application/zip', 'rar': 'application/x-rar-compressed',
                                    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'mp4': 'video/mp4',
                                    'webm': 'video/webm', 'avi': 'video/x-msvideo'
                                };
                                return mimeTypes[ext || ''] || 'application/octet-stream';
                            };

                            // Helper function to upload a single file
                            const uploadSingleFile = async (fileData: string, fileName: string, folderId: number | null) => {
                                const binaryString = atob(fileData);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let j = 0; j < binaryString.length; j++) {
                                    bytes[j] = binaryString.charCodeAt(j);
                                }
                                const blob = new Blob([bytes], { type: getMimeType(fileName) });

                                const formData = new FormData();
                                formData.append('file', blob, fileName);
                                formData.append('title', fileName);
                                formData.append('description', t('archive.clipboard_upload'));
                                formData.append('is_private', (activeTab === 'mine').toString());
                                if (folderId) formData.append('folder_id', folderId.toString());
                                const unitId = activeTab === 'mine' ? activeUser?.unit_id : currentUnitId;
                                if (unitId) formData.append('unit_id', unitId.toString());

                                await api.post('/archive/upload', formData, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                });
                            };

                            // Helper to create remote folder
                            const createRemoteFolder = async (name: string, parentId: number | null): Promise<number> => {
                                const unitId = activeTab === 'mine' ? activeUser?.unit_id : currentUnitId;
                                const res = await api.post('/archive/folders', {
                                    name,
                                    parent_id: parentId,
                                    unit_id: unitId,
                                    is_private: activeTab === 'mine'
                                });
                                return res.data.id;
                            };

                            let totalFiles = 0;
                            let uploadedFiles = 0;

                            for (let i = 0; i < result.paths.length; i++) {
                                const clipPath = result.paths[i];
                                const checkResult = await window.electron!.readFile(clipPath);

                                if (checkResult.isDirectory) {
                                    // It's a directory - read contents and upload recursively
                                    const dirResult = await window.electron!.readDir(clipPath);
                                    if (dirResult.success) {
                                        const rootFolderId = await createRemoteFolder(dirResult.dirName, currentFolderId);
                                        const folderMap = new Map<string, number>();
                                        folderMap.set('', rootFolderId);

                                        totalFiles += dirResult.files.length;

                                        for (const fileInfo of dirResult.files) {
                                            updateToast(toastId, {
                                                message: `Загрузка (${++uploadedFiles}/${totalFiles}): ${fileInfo.relativePath}`
                                            });

                                            // Create parent folders if needed
                                            const pathParts = fileInfo.relativePath.split('/');
                                            const fileName = pathParts.pop()!;
                                            const folderPath = pathParts.join('/');

                                            let targetFolderId = rootFolderId;
                                            if (folderPath) {
                                                let pathAccumulator = '';
                                                for (const part of pathParts) {
                                                    const prevPath = pathAccumulator;
                                                    pathAccumulator = pathAccumulator ? `${pathAccumulator}/${part}` : part;

                                                    if (!folderMap.has(pathAccumulator)) {
                                                        const parentId = folderMap.get(prevPath) || rootFolderId;
                                                        const newId = await createRemoteFolder(part, parentId);
                                                        folderMap.set(pathAccumulator, newId);
                                                    }
                                                }
                                                targetFolderId = folderMap.get(folderPath) || rootFolderId;
                                            }

                                            // Read and upload the file
                                            const fileReadResult = await window.electron!.readFile(fileInfo.fullPath);
                                            if (fileReadResult.success) {
                                                await uploadSingleFile(fileReadResult.data as string, fileName, targetFolderId);
                                            }
                                        }
                                    }
                                } else if (checkResult.success) {
                                    // It's a file - upload directly
                                    totalFiles++;
                                    uploadedFiles++;
                                    const fileName = clipPath.split('/').pop() || 'file';
                                    updateToast(toastId, { message: `Загрузка: ${fileName}` });
                                    await uploadSingleFile(checkResult.data as string, fileName, currentFolderId);
                                }
                            }

                            removeToast(toastId);
                            addToast({ type: 'success', title: t('common.success'), message: t('archive.uploaded_count', { count: uploadedFiles }) });
                            queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
                        } catch (err: unknown) {
                            const error = err as Error;
                            removeToast(toastId);
                            addToast({ type: 'error', title: t('common.error'), message: `Ошибка: ${error.message || t('archive.unknown_error')}` });
                        }
                        return;
                    }
                } catch {
                    // console.error('Error getting clipboard files:', err);
                }
            }

            // Fallback to standard ClipboardEvent items
            const items = e.clipboardData?.items;
            if (items && items.length > 0) {
                e.preventDefault();
                await performBatchUpload(items);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('paste', handlePaste);
        };
    }, [hoveredItem, canInteract, activeUser, performBatchUpload, selectedItems, clipboard, content, filteredData, currentFolderId, activeTab, currentUnitId, queryClient, t, addToast, updateToast, removeToast, clearSelection, handleOpenNative, navigateToFolder]);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        if (!canInteract) return;

        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            await performBatchUpload(items);
        }

        e.dataTransfer.clearData();
    };

    const getFileIcon = (mimeType?: string) => {
        if (!mimeType) return <FileIcon size={24} />;
        if (mimeType.includes('image')) return <ImageIcon size={24} />;
        if (mimeType.includes('pdf')) return <FileText size={24} />;
        if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('json')) return <FileCode size={24} />;
        return <FileText size={24} />;
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };


    const navigateToUnit = (unit: Unit) => {
        setCurrentUnitId(unit.id);
        setCurrentFolderId(null);
        setPath([{ id: null, unitId: null, name: 'Root' }, { id: null, unitId: unit.id, name: unit.name }]);
        setSearchQuery('');
        setSelectedItems([]);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Esc - Clear Selection
            if (e.key === 'Escape') {
                clearSelection();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearSelection]);


    const handleBreadcrumbClick = (p: { id: number | null, unitId?: number | null, name: string }, i: number) => {
        if (p.unitId !== undefined && p.id === null) {
            if (p.unitId === null) {
                setCurrentUnitId(null);
                setCurrentFolderId(null);
                setPath([{ id: null, unitId: null, name: 'Root' }]);
            } else {
                setCurrentUnitId(p.unitId);
                setCurrentFolderId(null);
                setPath(path.slice(0, i + 1));
            }
        } else {
            if (p.unitId != null) {
                setCurrentUnitId(p.unitId);
            }
            navigateToFolder(p.id === null ? null : { id: p.id, name: p.name, unit_id: p.unitId || 0, owner_id: 0, created_at: '' } as ArchiveFolder);
        }
        setSearchQuery('');
        setSelectedItems([]);
    };

    const deleteFile = (file: ArchiveFile) => {
        const isSelected = selectedItems.find(i => i.id === file.id && i.type === 'file');
        const items = isSelected ? selectedItems.map(si => {
            const allItems = [...(filteredData.folders || []), ...(filteredData.files || [])];
            const it = allItems.find(x => x.id === si.id && (('file_path' in x ? 'file' : 'folder') === si.type));
            const name = it && ('name' in it ? it.name : it.title);
            return { id: si.id, type: si.type, name: name || 'Unknown' };
        }) as { id: number; type: 'file' | 'folder'; name: string }[] : [{ id: file.id, type: 'file' as const, name: file.title }];

        setDeleteConfirm({ isOpen: true, items });
    };

    const deleteFolder = (folder: ArchiveFolder) => {
        const isSelected = selectedItems.find(i => i.id === folder.id && i.type === 'folder');
        const items = isSelected ? selectedItems.map(si => {
            const allItems = [...(filteredData.folders || []), ...(filteredData.files || [])];
            const it = allItems.find(x => x.id === si.id && (('file_path' in x ? 'file' : 'folder') === si.type));
            const name = it && ('name' in it ? it.name : it.title);
            return { id: si.id, type: si.type, name: name || 'Unknown' };
        }) as { id: number; type: 'file' | 'folder'; name: string }[] : [{ id: folder.id, type: 'folder' as const, name: folder.name }];

        setDeleteConfirm({ isOpen: true, items });
    };

    const confirmDelete = async () => {
        const { items } = deleteConfirm;
        try {
            for (const item of items) {
                if (item.type === 'file') {
                    await api.delete(`/archive/files/${item.id}`);
                } else {
                    await api.delete(`/archive/folders/${item.id}`);
                }
            }
            queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
            setSelectedItems([]);
            addToast({
                type: 'success',
                title: t('common.success'),
                message: items.length > 1 ? t('archive.items_deleted', { count: items.length }) : (items[0].type === 'file' ? t('archive.fileDeleted') : t('archive.folderDeleted'))
            });
            setDeleteConfirm({ ...deleteConfirm, isOpen: false });
        } catch {
            addToast({ type: 'error', title: t('common.error'), message: t('archive.errorDeleting') });
        }
    };

    const handleCopy = (items: { id: number, type: 'file' | 'folder' }[]) => {
        setClipboard({ action: 'copy', items });
        addToast({ type: 'info', title: t('archive.copied'), message: t('archive.buffer_items', { count: items.length }) });
    };

    const handleCut = (items: { id: number, type: 'file' | 'folder' }[]) => {
        setClipboard({ action: 'cut', items });
        addToast({ type: 'info', title: t('archive.cut'), message: t('archive.buffer_items', { count: items.length }) });
    };

    const handlePasteItems = async () => {
        if (!clipboard || !canInteract) return;

        const toastId = addToast({ type: 'info', title: t('archive.pasting'), message: t('archive.please_wait'), duration: Infinity });
        try {
            await api.post('/archive/batch-action', {
                action: clipboard.action === 'cut' ? 'move' : 'copy',
                item_ids: clipboard.items.map(i => i.id),
                item_types: clipboard.items.map(i => i.type),
                target_folder_id: currentFolderId,
                target_unit_id: activeTab === 'mine' ? activeUser?.unit_id : currentUnitId,
                is_private: activeTab === 'mine'
            });

            queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
            updateToast(toastId, { type: 'success', title: t('common.success'), message: 'Элементы успешно вставлены', duration: 3000 });

            if (clipboard.action === 'cut') {
                setClipboard(null);
            }
        } catch {
            updateToast(toastId, { type: 'error', title: t('common.error'), message: 'Ошибка при вставке элементов', duration: 4000 });
        }
    };

    const handleTabChange = (tab: 'global' | 'mine') => {
        setActiveTab(tab);
        setCurrentFolderId(null);
        setCurrentUnitId(tab === 'mine' ? activeUser?.unit_id || null : null);
        setPath([{ id: null, unitId: tab === 'global' ? null : undefined, name: 'Root' }]);
        setSearchQuery('');
        setSelectedItems([]);
        setLastSelectedIndex(null);
    };

    const handleItemClick = (e: React.MouseEvent, type: 'file' | 'folder', item: ArchiveItem, index: number) => {
        e.stopPropagation();
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if (isShift && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            const items = [...(filteredData.folders || []), ...(filteredData.files || [])];
            const range = items.slice(start, end + 1).map((it: ArchiveItem) => {
                const isFolder = !('file_path' in it);
                return { id: it.id, type: (isFolder ? 'folder' : 'file') as 'folder' | 'file' };
            });
            setSelectedItems(range);
        } else if (isCtrl) {
            setSelectedItems(prev => {
                const exists = prev.find(i => i.id === item.id && i.type === type);
                if (exists) return prev.filter(i => !(i.id === item.id && i.type === type));
                return [...prev, { id: item.id, type }];
            });
            setLastSelectedIndex(index);
        } else {
            setSelectedItems([{ id: item.id, type }]);
            setLastSelectedIndex(index);
        }
    };



    const backgroundMenuItems: ContextMenuItem[] = useMemo(() => [
        { id: 'new-folder', label: t('archive.newFolder') },
        { id: 'upload', label: t('archive.upload') },
        ...(clipboard ? [{ id: 'paste', label: `Вставить (${clipboard.items.length})` }] : [])
    ], [t, clipboard]);

    const handleBackgroundContextMenu = useContextMenu(backgroundMenuItems, (id: string) => {
        if (id === 'new-folder') setIsFolderModalOpen(true);
        if (id === 'upload') setIsUploadModalOpen(true);
        if (id === 'paste') handlePasteItems();
    });

    const handleRename = async (id: number, type: 'file' | 'folder', newName: string) => {
        try {
            if (type === 'file') {
                await api.patch(`/archive/files/${id}`, { title: newName });
            } else {
                await api.patch(`/archive/folders/${id}`, { name: newName });
            }
            queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
            setRenameState({ isOpen: false, item: null });
            addToast({ type: 'success', title: t('common.success'), message: t('archive.renamed') || 'Переименовано' });
        } catch {
            addToast({ type: 'error', title: t('common.error'), message: t('archive.errorRenaming') || 'Ошибка при переименовании' });
        }
    };

    const renderSortIcon = (key: string) => {
        if (sortConfig.key !== key) return null;
        return (
            <ArrowUp
                size={12}
                className={`ml-1 transition-transform duration-200 ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
            />
        );
    };

    return (
        <div
            className="flex-1 flex flex-col h-full bg-slate-50/50 relative animate-in fade-in duration-300"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag and Drop Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-indigo-600/10 backdrop-blur-[2px] border-4 border-dashed border-indigo-500/50 m-4 rounded-3xl animate-in fade-in duration-200">
                    <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center space-y-3 transform animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Plus size={32} className="animate-bounce" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('archive.dropzone.release')}</h3>
                            <p className="text-xs text-slate-500 font-medium">{t('archive.dropzone.tip')}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Tiered Glass Header */}
            <header className="px-6 pt-4 pb-2 shrink-0 z-20 sticky top-0 pointer-events-none">
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-4 rounded-2xl shadow-2xl shadow-slate-200/50 pointer-events-auto transition-all duration-300 flex flex-col gap-4">

                    {/* Top Tier: Identity & Global Actions */}
                    <div className="flex items-center justify-between gap-4">
                        {/* Identity */}
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 hover:scale-105 transition-transform duration-300">
                                <ArchiveIcon size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight">
                                    {t('archive.title') || 'Архив'}
                                </h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-0.5">
                                    {activeTab === 'mine'
                                        ? (user?.unit_name || t('archive.myDepartment'))
                                        : (currentUnitId && units?.find(u => u.id === currentUnitId)?.name || t('archive.allDepartments'))}
                                </p>
                            </div>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative group w-80 hidden md:block">
                                <div className="absolute inset-0 bg-indigo-500/5 rounded-xl blur-md group-hover:bg-indigo-500/10 transition-colors" />
                                <div className="relative flex items-center gap-2 bg-white/50 border border-slate-200/50 rounded-xl p-0.5 transition-all focus-within:bg-white focus-within:shadow-md focus-within:border-indigo-100 focus-within:ring-4 focus-within:ring-indigo-100">
                                    <Search className="ml-2.5 text-slate-400" size={16} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder={t('archive.searchPlaceholder') || "Поиск..."}
                                        className="w-full bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400 font-bold text-sm h-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* View Toggle */}
                            <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/50 h-9 items-center">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <LayoutGrid size={16} />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <List size={16} />
                                </button>
                            </div>

                            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

                            {/* Primary Actions */}
                            {canInteract && (
                                <>
                                    <button
                                        onClick={() => setIsFolderModalOpen(true)}
                                        className="h-9 w-9 flex items-center justify-center bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 transition-all shadow-sm group"
                                        title={t('archive.createFolder')}
                                    >
                                        <FolderPlus size={18} className="group-hover:text-amber-500 transition-colors" />
                                    </button>

                                    <button
                                        onClick={() => setIsUploadModalOpen(true)}
                                        className="flex items-center gap-2 px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 hover:-translate-y-0.5"
                                    >
                                        <Plus size={18} />
                                        <span className="hidden sm:inline">{t('archive.upload')}</span>
                                    </button>

                                    {clipboard && (
                                        <button
                                            onClick={handlePasteItems}
                                            className="h-9 w-9 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                                            title={`Вставить (${clipboard.items.length})`}
                                        >
                                            <ClipboardList size={18} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Bottom Tier: Context Navigation */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-[-8px]">
                        {/* Tabs (Left Balanced) */}
                        <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
                            {[
                                { id: 'global', icon: Globe, label: t('archive.allDepartments') },
                                { id: 'mine', icon: Building2, label: t('archive.myDepartment') }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id as 'global' | 'mine')}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab === tab.id
                                        ? 'bg-white text-indigo-600 shadow-md'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                        }`}
                                >
                                    <tab.icon size={13} />
                                    <div className="w-px h-3 bg-current opacity-20" />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Breadcrumbs (Right Balanced) */}
                        <div className="flex items-center gap-2 bg-slate-50/50 p-1 rounded-xl border border-slate-200/50 max-w-xl overflow-hidden">
                            <button
                                onClick={() => {
                                    if (path.length > 1) {
                                        const parentPath = path[path.length - 2];
                                        handleBreadcrumbClick(parentPath, path.length - 2);
                                    }
                                }}
                                disabled={path.length <= 1}
                                className={`h-7 w-7 flex items-center justify-center rounded-lg transition-all ${path.length <= 1
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'bg-white text-slate-600 hover:text-indigo-600 shadow-sm'
                                    }`}
                            >
                                <ArrowUp size={13} />
                            </button>

                            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide mask-fade-right px-1.5">
                                {path.map((p, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <ChevronRight size={10} className="text-slate-300 shrink-0" />}
                                        <button
                                            onClick={() => handleBreadcrumbClick(p, i)}
                                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-xs font-bold shrink-0 ${i === path.length - 1
                                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                                                : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                                                }`}
                                        >
                                            {i === 0 ? <Home size={11} className="opacity-70" /> : <FolderIcon size={11} className="text-amber-400" />}
                                            <span>{i === 0 ? (activeTab === 'global' ? 'Все' : 'Мой') : p.name}</span>
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div
                className="flex-1 overflow-y-auto px-6 py-6"
                onClick={clearSelection}
                onContextMenu={handleBackgroundContextMenu}
            >
                <div className="min-h-full flex flex-col">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 8].map(i => (
                                <div key={i} className="h-40 bg-white/60 rounded-3xl border border-slate-200/50" />
                            ))}
                        </div>
                    ) : (
                        <div
                            key={`${activeTab}-${currentUnitId || 'root'}-${currentFolderId || 'root'}-${viewMode}`}
                            className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                        >
                            {/* NEW: Root Dashboard (Drives View) */}
                            {(!currentFolderId && !currentUnitId && activeTab === 'global' && path.length === 1) ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto w-full pt-10 px-4">
                                    {/* Drive 1: General Archive */}
                                    <div
                                        onClick={() => {
                                            setPath([{ id: null, name: 'Root' }, { id: null, unitId: null, name: t('archive.allDepartments') }]);
                                        }}
                                        className="group bg-white rounded-2xl border border-slate-200/60 p-8 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-500 cursor-pointer flex flex-col items-center text-center space-y-5 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500/20 group-hover:bg-indigo-600 transition-colors" />
                                        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:scale-110 group-hover:rotate-3">
                                            <HardDrive size={40} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors mb-2">
                                                {t('archive.allDepartments')}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
                                                Общий сетевой диск для обмена файлами между всеми отделами компании.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                            <span>Открыть диск</span>
                                            <ChevronRight size={12} />
                                        </div>
                                    </div>

                                    {/* Drive 2: Department Archive */}
                                    <div
                                        onClick={() => {
                                            handleTabChange('mine');
                                        }}
                                        className="group bg-white rounded-2xl border border-slate-200/60 p-8 hover:shadow-2xl hover:shadow-amber-500/10 hover:border-amber-200 transition-all duration-500 cursor-pointer flex flex-col items-center text-center space-y-5 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500/20 group-hover:bg-amber-600 transition-colors" />
                                        <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:scale-110 group-hover:-rotate-3">
                                            <HardDrive size={40} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 group-hover:text-amber-600 transition-colors mb-2">
                                                {t('archive.myDepartment')}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
                                                Персональный диск вашего отдела. Доступен только сотрудникам вашего подразделения.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                            <span>Открыть диск</span>
                                            <ChevronRight size={12} />
                                        </div>
                                    </div>
                                </div>
                            ) : (activeTab === 'global' && !currentUnitId && path.length > 1) ? (
                                /* List of Units */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredData.units?.map((unit: Unit) => (
                                        <div
                                            key={unit.id}
                                            onMouseEnter={() => setHoveredItem({ type: 'folder', item: unit })}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            onClick={() => navigateToUnit(unit)}
                                            className={`group bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-100 transition-all duration-300 cursor-pointer relative flex flex-col items-center text-center space-y-3 ${activeUser?.unit_id && unit.id === activeUser.unit_id ? 'ring-2 ring-indigo-500/20 bg-indigo-50/30' : ''}`}
                                        >
                                            <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                                                <Building2 size={28} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm">
                                                    {unit.name}
                                                </h3>
                                                <p className="text-[10px] text-slate-400 font-medium line-clamp-2 mt-1">
                                                    {unit.description || t('archive.departmentArchive')}
                                                </p>
                                            </div>
                                            {activeUser?.unit_id && unit.id === activeUser.unit_id && (
                                                <div className="absolute top-2 right-2 flex flex-col items-end">
                                                    <div className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg mb-0.5 shadow-sm border border-indigo-200/50">
                                                        {t('archive.yourWorkspace')}
                                                    </div>
                                                    <span className="text-[9px] font-medium text-slate-400/80 pr-1">
                                                        {t('archive.fullAccess')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (activeTab === 'mine' && !activeUser?.unit_id) ? (
                                <div className="flex-1 flex flex-col items-center justify-center w-full bg-white/40 rounded-2xl border-2 border-dashed border-red-200/60 animate-in zoom-in-95 duration-300">
                                    <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center text-red-400 mb-6 shadow-inner">
                                        <Building2 size={40} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-3 text-center">{t('archive.noUnitTitle')}</h3>
                                    <p className="text-slate-500 font-medium text-center max-w-sm mb-8 leading-relaxed">
                                        {t('archive.noUnitDesc')}
                                    </p>
                                    <div className="px-6 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 text-sm text-slate-600">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                            <Building2 size={16} />
                                        </div>
                                        <span>{t('archive.contact_admin')}</span>
                                    </div>
                                </div>
                            ) : (filteredData.folders?.length === 0 && filteredData.files?.length === 0) ? (
                                <div className="flex-1 flex flex-col items-center justify-center w-full bg-white/40 rounded-2xl border-2 border-dashed border-slate-200/60 animate-in zoom-in-95 duration-300">
                                    <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 shadow-inner">
                                        <ArchiveIcon size={40} />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 mb-2">{t('archive.emptyTitle')}</h3>
                                    <p className="text-xs text-slate-500 font-medium text-center max-w-sm mb-8 leading-relaxed">
                                        {t('archive.emptyDesc')}
                                    </p>
                                    {canInteract && (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setIsFolderModalOpen(true)}
                                                className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
                                            >
                                                <FolderPlus size={18} />
                                                <span>{t('archive.createFolder') || 'Создать папку'}</span>
                                            </button>
                                            <button
                                                onClick={() => setIsUploadModalOpen(true)}
                                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-2 text-sm"
                                            >
                                                <Upload size={18} />
                                                <span>{t('archive.upload') || 'Загрузить'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* View based on toggle */
                                viewMode === 'list' ? (
                                    <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden animate-in fade-in duration-300" onClick={(e) => e.stopPropagation()}>
                                        {/* Minimalist Explorer Header */}
                                        <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-slate-50 border-b border-slate-200/60 text-[10px] font-black text-slate-400 uppercase tracking-widest select-none items-center">
                                            <div
                                                className="col-span-6 flex items-center cursor-pointer hover:text-indigo-600 transition-colors"
                                                onClick={() => handleSort('name')}
                                            >
                                                {t('archive.listHeader.name')}
                                                {renderSortIcon('name')}
                                            </div>
                                            <div
                                                className="col-span-2 flex items-center cursor-pointer hover:text-indigo-600 transition-colors"
                                                onClick={() => handleSort('size')}
                                            >
                                                {t('archive.listHeader.size')}
                                                {renderSortIcon('size')}
                                            </div>
                                            <div
                                                className="col-span-3 flex items-center cursor-pointer hover:text-indigo-600 transition-colors"
                                                onClick={() => handleSort('date')}
                                            >
                                                {t('archive.listHeader.date')}
                                                {renderSortIcon('date')}
                                            </div>
                                            <div className="col-span-1 text-right">
                                                {/* Actions */}
                                            </div>
                                        </div>

                                        {filteredData.folders?.map((folder, index) => (
                                            <ArchiveFolderListRow
                                                key={`folder-${folder.id}`}
                                                folder={folder}
                                                index={index}
                                                isSelected={!!selectedItems.find(i => i.id === folder.id && i.type === 'folder')}
                                                selectionCount={selectedItems.length}
                                                onNavigate={navigateToFolder}
                                                onClick={handleItemClick}
                                                onDelete={deleteFolder}
                                                onCopy={handleCopy}
                                                onCut={handleCut}
                                                onPaste={handlePasteItems}
                                                clipboard={clipboard}
                                                selectedItems={selectedItems}
                                                currentUserId={activeUser?.id}
                                                userRole={activeUser?.role}
                                                userUnitId={activeUser?.unit_id}
                                                onMouseEnter={() => setHoveredItem({ type: 'folder', item: folder })}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                onRename={(f) => setRenameState({ isOpen: true, item: { id: f.id, type: 'folder', name: f.name } })}
                                                onProperties={(f) => setPropertiesState({ isOpen: true, item: f, type: 'folder' })}
                                            />
                                        ))}

                                        {filteredData.files?.map((file, index) => {
                                            const absoluteIndex = index + (filteredData.folders?.length || 0);
                                            return (
                                                <ArchiveFileListRow
                                                    key={`file-${file.id}`}
                                                    file={file}
                                                    index={absoluteIndex}
                                                    isSelected={!!selectedItems.find(i => i.id === file.id && i.type === 'file')}
                                                    selectionCount={selectedItems.length}
                                                    onView={() => {
                                                        const previewUrl = `${api.defaults.baseURL}/archive/files/${file.id}/view?token=${useAuthStore.getState().token}`;
                                                        openViewer(previewUrl, file.title, file.file_path, file.mime_type);
                                                    }}
                                                    onDownload={() => {
                                                        const previewUrl = `${api.defaults.baseURL}/archive/files/${file.id}/view?token=${useAuthStore.getState().token}`;
                                                        window.location.href = `${previewUrl}&download=1`;
                                                    }}
                                                    onOpenNative={() => handleOpenNative(file)}
                                                    onClick={handleItemClick}
                                                    onDelete={deleteFile}
                                                    onCopy={handleCopy}
                                                    onCut={handleCut}
                                                    onPaste={handlePasteItems}
                                                    clipboard={clipboard}
                                                    selectedItems={selectedItems}
                                                    currentUserId={activeUser?.id}
                                                    userRole={activeUser?.role}
                                                    userUnitId={activeUser?.unit_id}
                                                    getFileIcon={getFileIcon}
                                                    onMouseEnter={() => setHoveredItem({ type: 'file', item: file })}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                    onRename={(f) => setRenameState({ isOpen: true, item: { id: f.id, type: 'file', name: f.title } })}
                                                    onProperties={(f) => setPropertiesState({ isOpen: true, item: f, type: 'file' })}
                                                />
                                            );
                                        })}

                                        {/* Empty state inside table */}
                                        {filteredData.folders?.length === 0 && filteredData.files?.length === 0 && (
                                            <div className="px-6 py-12 text-center text-slate-400">
                                                <ArchiveIcon size={32} className="mx-auto mb-3 opacity-30" />
                                                <p className="text-sm font-medium">{t('archive.noFilesOrFolders')}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 animate-in fade-in duration-300">
                                        {filteredData.folders?.map((folder, index) => (
                                            <ArchiveFolderItem
                                                key={`folder-${folder.id}`}
                                                index={index}
                                                isSelected={!!selectedItems.find(i => i.id === folder.id && i.type === 'folder')}
                                                selectionCount={selectedItems.length}
                                                folder={folder}
                                                onNavigate={navigateToFolder}
                                                onClick={(e, idx) => handleItemClick(e, 'folder', folder, idx)}
                                                onDelete={deleteFolder}
                                                onCopy={handleCopy}
                                                onCut={handleCut}
                                                onPaste={handlePasteItems}
                                                clipboard={clipboard}
                                                selectedItems={selectedItems}
                                                currentUserId={activeUser?.id}
                                                userRole={activeUser?.role}
                                                userUnitId={activeUser?.unit_id}
                                                onMouseEnter={() => setHoveredItem({ type: 'folder', item: folder })}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                onRename={(f) => setRenameState({ isOpen: true, item: { id: f.id, type: 'folder', name: f.name } })}
                                                onProperties={(f) => setPropertiesState({ isOpen: true, item: f, type: 'folder' })}
                                            />
                                        ))}
                                        {filteredData.files?.map((file, index) => (
                                            <ArchiveFileItem
                                                key={`file-${file.id}`}
                                                index={index + (filteredData.folders?.length || 0)}
                                                isSelected={!!selectedItems.find(i => i.id === file.id && i.type === 'file')}
                                                selectionCount={selectedItems.length}
                                                file={file}
                                                onView={() => {
                                                    const previewUrl = `${api.defaults.baseURL}/archive/files/${file.id}/view?token=${useAuthStore.getState().token}`;
                                                    openViewer(previewUrl, file.title, file.file_path, file.mime_type);
                                                }}
                                                onDownload={() => {
                                                    const previewUrl = `${api.defaults.baseURL}/archive/files/${file.id}/view?token=${useAuthStore.getState().token}`;
                                                    window.location.href = `${previewUrl}&download=1`;
                                                }}
                                                onOpenNative={() => handleOpenNative(file)}
                                                onClick={(e, idx) => handleItemClick(e, 'file', file, idx)}
                                                onDelete={deleteFile}
                                                onCopy={handleCopy}
                                                onCut={handleCut}
                                                onPaste={handlePasteItems}
                                                clipboard={clipboard}
                                                selectedItems={selectedItems}
                                                currentUserId={activeUser?.id}
                                                userRole={activeUser?.role}
                                                userUnitId={activeUser?.unit_id}
                                                getFileIcon={getFileIcon}
                                                onMouseEnter={() => setHoveredItem({ type: 'file', item: file })}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                onRename={(f) => setRenameState({ isOpen: true, item: { id: f.id, type: 'file', name: f.title } })}
                                                onProperties={(f) => setPropertiesState({ isOpen: true, item: f, type: 'file' })}
                                            />
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* Modals */}
                {
                    isUploadModalOpen && (
                        <UploadArchiveModal
                            initialFile={droppedFile}
                            folderId={currentFolderId}
                            unitId={currentUnitId || activeUser?.unit_id || null}
                            isPrivate={activeTab === 'mine'}
                            onClose={() => {
                                setIsUploadModalOpen(false);
                                setDroppedFile(null);
                            }}
                            onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
                                setIsUploadModalOpen(false);
                                setDroppedFile(null);
                            }}
                        />
                    )
                }

                {
                    isFolderModalOpen && (
                        <CreateFolderModal
                            parentId={currentFolderId}
                            unitId={currentUnitId || activeUser?.unit_id || null}
                            isPrivate={activeTab === 'mine'}
                            onClose={() => setIsFolderModalOpen(false)}
                            onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['archive', 'contents'] });
                                setIsFolderModalOpen(false);
                            }}
                        />
                    )
                }

                {
                    deleteConfirm.isOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })} />
                            <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
                                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6 mx-auto">
                                    <Trash2 size={32} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 text-center mb-2">
                                    {deleteConfirm.items.length > 1 ? `Удалить ${deleteConfirm.items.length} элементов?` : t('archive.deleteConfirmTitle')}
                                </h3>
                                <p className="text-slate-500 font-medium text-center mb-8">
                                    {deleteConfirm.items.length > 1
                                        ? `Вы уверены, что хотите безвозвратно удалить выбранные элементы (${deleteConfirm.items.length} шт.)?`
                                        : deleteConfirm.items[0]?.type === 'file'
                                            ? t('archive.deleteFileText')
                                            : t('archive.deleteFolderText')}
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={confirmDelete}
                                        className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-red-200"
                                    >
                                        {t('common.delete')}
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 active:scale-[0.98] transition-all"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {renameState.isOpen && renameState.item && (
                    <RenameModal
                        item={renameState.item}
                        onClose={() => setRenameState({ isOpen: false, item: null })}
                        onSuccess={handleRename}
                    />
                )}

                {propertiesState.isOpen && propertiesState.item && propertiesState.type && (
                    <PropertiesModal
                        item={propertiesState.item as ArchiveFolder | ArchiveFile}
                        type={propertiesState.type}
                        onClose={() => setPropertiesState({ isOpen: false, item: null, type: null })}
                    />
                )}
            </div>
        </div>
    );
};

export default ArchivePage;

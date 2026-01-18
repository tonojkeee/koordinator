export interface ArchiveFolder {
    id: number;
    name: string;
    parent_id?: number | null;
    unit_id: number;
    owner_id: number;
    owner_name?: string;
    created_at: string;
}

export interface ArchiveFile {
    id: number;
    title: string;
    description?: string;
    file_path: string;
    file_size?: number;
    mime_type?: string;
    owner_id: number;
    owner_name?: string;
    unit_id?: number;
    unit_name?: string;
    created_at: string;
}

export interface ArchiveItem {
    type: 'folder' | 'file';
    data: ArchiveFolder | ArchiveFile;
}

export interface ArchiveContent {
    folders: ArchiveFolder[];
    files: ArchiveFile[];
}

export type Unit = import('../../types').Unit;

export interface FilteredData {
    units?: Unit[];
    folders?: ArchiveFolder[];
    files?: ArchiveFile[];
}

export interface UserPreferences {
    start_page?: string;
    enter_to_send?: boolean;
    font_size?: 'small' | 'medium' | 'large';
    tasks_view?: 'list' | 'board';
    [key: string]: unknown;
}

export interface User {
    id: number;
    username: string;
    email: string;
    role: 'admin' | 'user' | 'operator';
    full_name: string | null;
    cabinet: string | null;
    rank: string | null;
    position: string | null;
    birth_date: string | null;
    phone_number: string | null;
    unit_id: number | null;
    unit_name: string | null;
    unit?: Unit | null;
    avatar_url: string | null;
    notify_browser: boolean;
    notify_sound: boolean;
    notify_email: boolean;
    is_active: boolean;
    status: string;
    created_at: string;
    last_seen?: string | null;
    session_start?: string | null;
    preferences?: UserPreferences;
}

export interface Reaction {
    emoji: string;
    user_id: number;
    username: string;
    avatar_url?: string | null;
}

export interface ContextMenuItem {
    id: string;
    label: string;
    type?: 'normal' | 'separator' | 'checkbox' | 'radio';
    enabled?: boolean;
}

export interface NotificationOptions {
    body?: string;
    icon?: string;
    tag?: string;
    data?: unknown;
}

export interface Channel {
    id: number;
    name: string;
    display_name?: string;
    other_user?: {
        id: number;
        username: string;
        full_name: string | null;
        rank?: string | null;
        avatar_url?: string | null;
        last_seen?: string | null;
        is_online?: boolean;
    };
    description: string | null;
    is_direct: boolean;
    members_count: number;
    online_count: number;
    unread_count: number;
    is_pinned: boolean;
    mute_until?: string | null;
    last_read_message_id: number | null;
    others_read_id?: number | null;
    last_message?: {
        id: number;
        content: string;
        sender_name: string;
        created_at: string;
    };
    created_by: number;
    created_at: string;
}

export interface Message {
    id: number;
    channel_id: number;
    user_id: number;
    username: string;
    full_name: string | null;
    avatar_url?: string | null;
    rank?: string | null;
    role?: 'admin' | 'user' | string | null;
    content: string;
    document_id?: number;
    document_title?: string;
    file_path?: string;
    file_size?: number;
    is_document_deleted?: boolean;
    reactions?: Reaction[];
    created_at: string;
    parent_id?: number;
    parent?: {
        id: number;
        content: string;
        username: string;
        full_name?: string | null;
    };
    reply_count?: number;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
}
export interface Unit {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
}


export interface AuditLog {
    id: number;
    user: User;
    action: string;
    target_type: string;
    target_id: string | null;
    details: string | null;
    timestamp: string;
}

export interface SystemSetting {
    key: string;
    value: string;
    type: 'str' | 'int' | 'bool' | 'json';
    group: string;
    description?: string;
    is_public: boolean;
}


export interface ElectronAPI {
    onContextMenuCommand: (callback: (commandId: string) => void) => () => void;
    showContextMenu: (items: ContextMenuItem[]) => void;
    openArchiveFolder: () => void;
    readFile: (path: string) => Promise<{ success: boolean; data: string | Uint8Array; error?: string; isDirectory?: boolean }>;
    readDir: (path: string) => Promise<{ success: boolean; dirName: string; files: { relativePath: string; fullPath: string }[] }>;
    getClipboardFilePaths: () => Promise<{ success: boolean; paths: string[] }>;
    setAutoLaunch: (enable: boolean) => void;
    openInNativeApp: (url: string, fileName: string, fileId?: number) => Promise<{ success: boolean; error?: string }>;
    onFileModified: (callback: (data: { fileId: number; filePath: string; fileName: string }) => void) => () => void;
    copyToClipboard: (text: string) => void;
    sendNotification: (title: string, body?: string, icon?: string, data?: unknown) => void;
    focusWindow: () => void;
    onTriggerSearch: (callback: () => void) => () => void;
    onTriggerUpload: (callback: () => void) => () => void;
    onNotificationClicked: (callback: (data: Record<string, unknown>) => void) => () => void;
    onOpenUrl: (callback: (url: string) => void) => () => void;

    // Config Store
    getAppConfig: () => Promise<{ serverUrl: string; downloadPath: string }>;
    saveAppConfig: (config: { serverUrl?: string; downloadPath?: string }) => Promise<boolean>;

    // mDNS Discovery
    discoverServers: () => Promise<{ id: string; name: string; url: string; version: string }[]>;
    onServersDiscovered: (callback: (servers: { id: string; name: string; url: string; version: string }[]) => void) => () => void;
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}

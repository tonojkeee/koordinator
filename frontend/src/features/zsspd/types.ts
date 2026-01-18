export const ZsspdDirection = {
    INCOMING: 'INCOMING',
    OUTGOING: 'OUTGOING'
} as const;

export type ZsspdDirection = typeof ZsspdDirection[keyof typeof ZsspdDirection];

export const ZsspdStatus = {
    DRAFT: 'DRAFT',
    READY: 'READY',
    EXPORTED: 'EXPORTED',
    SENT: 'SENT',
    RECEIVED: 'RECEIVED',
    DISTRIBUTED: 'DISTRIBUTED',
    ARCHIVED: 'ARCHIVED'
} as const;

export type ZsspdStatus = typeof ZsspdStatus[keyof typeof ZsspdStatus];

export interface ZsspdFile {
    id: number;
    filename: string;
    file_size: number;
    created_at: string;
}

export interface ZsspdUserBasic {
    id: number;
    username: string;
    full_name?: string;
    rank?: string;
    position?: string;
    avatar_url?: string;
}

export interface ZsspdPackage {
    id: number;
    direction: ZsspdDirection;
    status: ZsspdStatus;
    external_sender?: string;
    external_recipient?: string;
    outgoing_number?: string;
    subject?: string;
    created_by: number;
    operator_id?: number;
    created_at: string;
    updated_at: string;
    files: ZsspdFile[];
    creator?: ZsspdUserBasic;
}

export interface ZsspdPackageCreate {
    direction: ZsspdDirection;
    external_recipient?: string;
    outgoing_number?: string;
    subject?: string;
}

export interface ZsspdPackageUpdate {
    status?: ZsspdStatus;
    subject?: string;
    external_recipient?: string;
    outgoing_number?: string;
}

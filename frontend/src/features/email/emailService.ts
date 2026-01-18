import api from '../../api/client';
import type { User } from '../../types';

export interface EmailAttachment {
    id: number;
    filename: string;
    content_type: string;
    file_size: number;
    file_path: string;
}

export interface EmailFolder {
    id: number;
    name: string;
    user_id: number;
    parent_id?: number | null;
}

export interface EmailMessage {
    id: number;
    subject: string;
    from_address: string;
    to_address: string;
    cc_address?: string;
    bcc_address?: string;
    body_text?: string;
    body_html?: string;
    received_at: string;
    is_read: boolean;
    is_sent: boolean;
    is_draft: boolean;
    is_archived: boolean;
    is_deleted: boolean;
    is_starred: boolean;
    is_important: boolean;
    folder_id?: number | null;
    attachments: EmailAttachment[];
}

export interface EmailMessageList {
    id: number;
    subject: string;
    from_address: string;
    to_address: string;
    received_at: string;
    is_read: boolean;
    is_sent: boolean;
    is_starred: boolean;
    is_important: boolean;
    has_attachments: boolean;
    folder_id?: number | null;
}

export interface EmailAccount {
    id: number;
    email_address: string;
}

export interface SendEmailData {
    to_address: string;
    subject: string;
    body_text?: string;
    body_html?: string;
    cc_address?: string;
    bcc_address?: string;
    attachments?: File[];
}

export interface EmailMessageUpdate {
    is_read?: boolean;
    is_starred?: boolean;
    is_important?: boolean;
    is_archived?: boolean;
    is_deleted?: boolean;
    folder_id?: number | string | null; // string for system folders like 'trash'
}

export const emailService = {
    getAccount: async (): Promise<EmailAccount> => {
        const response = await api.get('/email/account');
        return response.data;
    },

    getMessages: async (folder: string = 'inbox', skip: number = 0, limit: number = 50): Promise<EmailMessageList[]> => {
        const response = await api.get('/email/messages', {
            params: { folder, skip, limit },
        });
        return response.data;
    },

    getMessage: async (id: number): Promise<EmailMessage> => {
        const response = await api.get(`/email/messages/${id}`);
        return response.data;
    },

    sendEmail: async (data: SendEmailData): Promise<EmailMessage> => {
        const formData = new FormData();
        formData.append('to_address', data.to_address);
        formData.append('subject', data.subject);
        if (data.body_text) formData.append('body_text', data.body_text);
        if (data.body_html) formData.append('body_html', data.body_html);
        if (data.cc_address) formData.append('cc_address', data.cc_address);
        if (data.bcc_address) formData.append('bcc_address', data.bcc_address);

        if (data.attachments) {
            data.attachments.forEach(file => {
                formData.append('attachments', file);
            });
        }

        const response = await api.post('/email/send', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    updateMessage: async (id: number, updates: EmailMessageUpdate): Promise<EmailMessage> => {
        const response = await api.patch(`/email/messages/${id}`, updates);
        return response.data;
    },

    deleteMessage: async (id: number): Promise<void> => {
        await api.delete(`/email/messages/${id}`);
    },

    getFolders: async (): Promise<EmailFolder[]> => {
        const response = await api.get('/email/folders');
        return response.data;
    },

    createFolder: async (name: string, parentId?: number): Promise<EmailFolder> => {
        const response = await api.post('/email/folders', { name, parent_id: parentId });
        return response.data;
    },

    deleteFolder: async (id: number): Promise<void> => {
        await api.delete(`/email/folders/${id}`);
    },

    getAddressBook: async (): Promise<User[]> => {
        const response = await api.get('/auth/users');
        return response.data;
    },
};

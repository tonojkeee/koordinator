import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import type { Document, DocumentShare } from './types';

export const useDocumentsOwned = () => {
    return useQuery<Document[]>({
        queryKey: ['documents', 'owned'],
        queryFn: async () => {
            const res = await api.get('/board/documents/owned');
            return res.data;
        }
    });
};

export const useDocumentsReceived = () => {
    return useQuery<DocumentShare[]>({
        queryKey: ['documents', 'received'],
        queryFn: async () => {
            const res = await api.get('/board/documents/received');
            return res.data;
        }
    });
};

export const useUploadDocument = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ title, description, file }: { title: string; description?: string; file: File }) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(`/board/documents?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description || '')}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', 'owned'] });
        },
    });
};

export const useShareDocument = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ docId, recipientId }: { docId: number; recipientId: number }) => {
            const res = await api.post(`/board/documents/${docId}/share`, { recipient_id: recipientId });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', 'received'] });
        },
    });
};

export const useDeleteDocument = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (docId: number) => {
            await api.delete(`/board/documents/${docId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', 'owned'] });
        },
    });
};

export const useUploadAndShare = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ title, description, file, recipientIds, channelId }: { title: string; description?: string; file: File; recipientIds: number[]; channelId?: number }) => {
            const formData = new FormData();
            formData.append('file', file);
            const rIds = recipientIds.join(',');
            let url = `/board/documents/upload-and-share?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description || '')}&recipient_ids=${rIds}`;
            if (channelId) url += `&channel_id=${channelId}`;

            const res = await api.post(url, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents', 'owned'] });
        },
    });
};

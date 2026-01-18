import api from '../../api/client';
import type { ZsspdPackage, ZsspdPackageCreate, ZsspdPackageUpdate } from './types';

export const zsspdService = {
    getOutgoingPackages: async (skip = 0, limit = 100) => {
        const response = await api.get<ZsspdPackage[]>('/zsspd/outgoing', {
            params: { skip, limit }
        });
        return response.data;
    },

    createOutgoingPackage: async (data: ZsspdPackageCreate) => {
        const response = await api.post<ZsspdPackage>('/zsspd/outgoing', data);
        return response.data;
    },

    updatePackage: async (id: number, data: ZsspdPackageUpdate) => {
        const response = await api.put<ZsspdPackage>(`/zsspd/packages/${id}`, data);
        return response.data;
    },

    uploadFile: async (packageId: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post(`/zsspd/packages/${packageId}/files`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getDetails: async (id: number) => {
        const response = await api.get<ZsspdPackage>(`/zsspd/packages/${id}`);
        return response.data;
    }
};

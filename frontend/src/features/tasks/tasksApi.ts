import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import type { Task, TaskCreate, TaskReport } from './types';

// Fetch received tasks
export const useTasksReceived = () => {
    return useQuery<Task[]>({
        queryKey: ['tasks', 'received'],
        queryFn: async () => {
            const { data } = await api.get('/tasks/received');
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

// Fetch issued tasks
export const useTasksIssued = () => {
    return useQuery<Task[]>({
        queryKey: ['tasks', 'issued'],
        queryFn: async () => {
            const { data } = await api.get('/tasks/issued');
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

// Fetch completed tasks
export const useTasksCompleted = () => {
    return useQuery<Task[]>({
        queryKey: ['tasks', 'completed'],
        queryFn: async () => {
            const { data } = await api.get('/tasks/completed');
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

// Create Task Mutation
export const useCreateTask = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (task: TaskCreate) => {
            const { data } = await api.post('/tasks/', task);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', 'issued'] });
        },
    });
};

// Report Task Mutation
export const useReportTask = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ taskId, report }: { taskId: number; report: TaskReport }) => {
            const { data } = await api.post(`/tasks/${taskId}/report`, report);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', 'received'] });
        },
    });
};

// Confirm Task Mutation
export const useConfirmTask = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (taskId: number) => {
            const { data } = await api.post(`/tasks/${taskId}/confirm`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
};

// Reject Task Mutation
export const useRejectTask = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ taskId, reason }: { taskId: number; reason: string }) => {
            const { data } = await api.post(`/tasks/${taskId}/reject`, { reason });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
};

// Delete Task Mutation
export const useDeleteTask = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (taskId: number) => {
            await api.delete(`/tasks/${taskId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
};

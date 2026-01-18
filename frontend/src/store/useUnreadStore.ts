import { create } from 'zustand';

interface UnreadState {
    // channel_id -> unread count
    unreadCounts: Record<number, number>;
    // unread documents with their source channels
    unreadDocs: { docId: number, channelId: number }[];

    // Add unread message to a channel
    addUnread: (channelId: number) => void;
    // Clear unread for a channel (when user opens it)
    clearUnread: (channelId: number) => void;
    // Sync all unread counts (from backend)
    syncUnreads: (counts: Record<number, number>) => void;
    // Set specific unread count for a channel
    setUnread: (channelId: number, count: number) => void;
    // Get total unread count
    getTotalUnread: () => number;

    // Document specific
    addDocUnread: (docId: number, channelId: number) => void;
    clearDocUnread: () => void;
    setDocUnread: (count: number) => void;

    // Task specific
    tasksUnreadCount: number;
    addTaskUnread: () => void;
    clearTaskUnread: () => void;
    setTasksUnread: (count: number) => void;

    tasksReviewCount: number;
    addTaskReview: () => void;
    clearTaskReview: () => void;
    setTasksReview: (count: number) => void;
}

export const useUnreadStore = create<UnreadState>((set, get): UnreadState => ({
    unreadCounts: {},
    unreadDocs: [],
    tasksUnreadCount: 0,
    tasksReviewCount: 0,

    addUnread: (channelId: number): void => {
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [channelId]: (state.unreadCounts[channelId] || 0) + 1
            }
        }));
    },

    clearUnread: (channelId: number): void => {
        set((state) => {
            const newCounts = { ...state.unreadCounts };
            delete newCounts[channelId];

            // Sync: Also clear unread documents for this channel
            const newUnreadDocs = state.unreadDocs.filter(d => d.channelId !== channelId);

            return {
                unreadCounts: newCounts,
                unreadDocs: newUnreadDocs
            };
        });
    },

    syncUnreads: (counts: Record<number, number>): void => {
        set({ unreadCounts: counts });
    },

    setUnread: (channelId: number, count: number): void => {
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [channelId]: count
            }
        }));
    },

    getTotalUnread: (): number => {
        const { unreadCounts } = get();
        return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    },

    addDocUnread: (docId: number, channelId: number): void => {
        set((state) => {
            // Prevent duplicates
            if (state.unreadDocs.some(d => d.docId === docId)) return state;
            return { unreadDocs: [...state.unreadDocs, { docId, channelId }] };
        });
    },

    clearDocUnread: (): void => {
        set({ unreadDocs: [] });
    },

    setDocUnread: (count: number): void => {
        // This is a fallback if we don't have IDs, we just fake an array
        set({ unreadDocs: Array(count).fill({ docId: -1, channelId: -1 }) });
    },

    addTaskUnread: (): void => set(state => ({ tasksUnreadCount: state.tasksUnreadCount + 1 })),
    clearTaskUnread: (): void => set({ tasksUnreadCount: 0 }),
    setTasksUnread: (count: number): void => set({ tasksUnreadCount: count }),

    addTaskReview: (): void => set(state => ({ tasksReviewCount: state.tasksReviewCount + 1 })),
    clearTaskReview: (): void => set({ tasksReviewCount: 0 }),
    setTasksReview: (count: number): void => set({ tasksReviewCount: count }),
}));

export const TaskStatus = {
    IN_PROGRESS: 'in_progress',
    ON_REVIEW: 'on_review',
    COMPLETED: 'completed',
    OVERDUE: 'overdue'
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskPriority = {
    MEDIUM: 'medium',
    HIGH: 'high'
} as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];


export interface Task {
    id: number;
    issuer_id: number;
    assignee_id: number;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    deadline: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    completion_report?: string;
    return_reason?: string;

    // Expanded details
    issuer?: {
        id: number;
        full_name: string;
        username: string;
        avatar_url?: string;
        unit_name?: string;
        rank?: string;
    };
    assignee?: {
        id: number;
        full_name: string;
        username: string;
        avatar_url?: string;
        unit_name?: string;
        rank?: string;
    };
}

export interface TaskCreate {
    title: string;
    description: string;
    priority: TaskPriority;
    deadline: string;
    assignee_id?: number | null;
    unit_id?: number | null;
}

export interface TaskReport {
    report_text: string;
}

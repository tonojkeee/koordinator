export interface Document {
    id: number;
    title: string;
    description: string | null;
    file_path: string;
    owner_id: number;
    created_at: string;
    owner?: {
        id: number;
        username: string;
        full_name: string | null;
        avatar_url: string | null;
    };
}

export interface DocumentShare {
    id: number;
    document_id: number;
    recipient_id: number;
    created_at: string;
    document: Document;
    recipient: {
        id: number;
        username: string;
        full_name: string | null;
    };
    channels?: {
        id: number;
        name: string;
    }[];
}

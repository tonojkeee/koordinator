export const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatActivityDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Только что';
    if (diffInHours < 24) return `${diffInHours} ч. назад`;
    if (diffInHours < 48) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export const formatDuration = (start: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return '<1 мин';
    if (diffInMinutes < 60) return `${diffInMinutes} мин`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} ч`;
    return `${Math.floor(diffInMinutes / 1440)} д`;
};

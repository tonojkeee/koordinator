const notificationSound = new Audio('/sounds/notification.mp3');

export const playNotificationSound = (): void => {
    try {
        notificationSound.currentTime = 0;
        notificationSound.play().catch((err: unknown): void => console.warn('Audio play failed', err));
    } catch (error) {
        console.error('Failed to play notification sound', error);
    }
};

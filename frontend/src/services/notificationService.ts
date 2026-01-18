/**
 * Service to handle system notifications (Web/Electron)
 */

import type { NotificationOptions } from '../types';

export const sendSystemNotification = (title: string, options?: NotificationOptions) => {
    // Check if we are in Electron
    const isElectron = !!window.electron;

    if (isElectron) {
        // Use Electron bridge
        window.electron!.sendNotification(title, options?.body, options?.icon, options?.data);
    } else {
        // Check for standard Web Notification API
        if (!("Notification" in window)) {
            console.warn("This browser does not support desktop notification");
            return;
        }

        if (Notification.permission === "granted") {
            try {
                new Notification(title, options);
            } catch (e) {
                console.error('❌ Error creating notification:', e);
            }
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    new Notification(title, options);
                }
            });
        }
    }
};

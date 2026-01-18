const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    sendNotification: (title, body, icon, data) => {
        ipcRenderer.send('show-notification', { title, body, icon, data });
    },
    focusWindow: () => {
        ipcRenderer.send('focus-window');
    },
    onTriggerSearch: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('trigger-search', listener);
        return () => ipcRenderer.removeListener('trigger-search', listener);
    },
    onTriggerUpload: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('trigger-upload', listener);
        return () => ipcRenderer.removeListener('trigger-upload', listener);
    },
    onNotificationClicked: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('notification-clicked', listener);
        return () => ipcRenderer.removeListener('notification-clicked', listener);
    },
    openArchiveFolder: () => {
        ipcRenderer.send('open-archive-folder');
    },
    showItemInFolder: (path) => {
        ipcRenderer.send('show-item-in-folder', path);
    },
    showContextMenu: (items) => {
        ipcRenderer.send('show-context-menu', items);
    },
    onContextMenuCommand: (callback) => {
        const listener = (event, commandId) => callback(commandId);
        ipcRenderer.on('context-menu-command', listener);
        return () => ipcRenderer.removeListener('context-menu-command', listener);
    },
    removeContextMenuListener: () => {
        ipcRenderer.removeAllListeners('context-menu-command');
    },
    onOpenUrl: (callback) => {
        const listener = (event, url) => callback(url);
        ipcRenderer.on('open-url', listener);
        return () => ipcRenderer.removeListener('open-url', listener);
    },
    copyToClipboard: (text) => {
        clipboard.writeText(text);
    },
    setAutoLaunch: (enable) => {
        ipcRenderer.send('set-auto-launch', enable);
    },
    // Read file from filesystem (for drag&drop support)
    readFile: (filePath) => {
        return ipcRenderer.invoke('read-file', filePath);
    },
    // Read directory recursively
    readDir: (dirPath) => {
        return ipcRenderer.invoke('read-dir', dirPath);
    },
    // Get file paths from system clipboard (for multi-file paste support)
    getClipboardFilePaths: () => {
        return ipcRenderer.invoke('get-clipboard-files');
    },
    // Open file in native OS application
    openInNativeApp: (url, fileName, fileId) => {
        return ipcRenderer.invoke('open-in-native-app', { url, fileName, fileId });
    },
    // Listen for file changes (Edit-in-Place)
    onFileModified: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('file-modified', listener);
        return () => ipcRenderer.removeListener('file-modified', listener);
    },
    // Config Store
    getAppConfig: () => {
        return ipcRenderer.invoke('get-app-config');
    },
    saveAppConfig: (config) => {
        return ipcRenderer.invoke('save-app-config', config);
    },
    // mDNS Discovery
    discoverServers: () => {
        return ipcRenderer.invoke('discover-servers');
    },
    onServersDiscovered: (callback) => {
        const listener = (event, servers) => callback(servers);
        ipcRenderer.on('servers-discovered', listener);
        return () => ipcRenderer.removeListener('servers-discovered', listener);
    }
});

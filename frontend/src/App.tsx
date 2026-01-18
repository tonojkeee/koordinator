import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from './store/useAuthStore';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import { ToastProvider } from './design-system';
import { useDocumentViewer } from './features/board/store/useDocumentViewer';
import { useTokenRefresh } from './hooks/useTokenRefresh';

// Features
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import ChatPage from './features/chat/ChatPage';
import CompanyPage from './features/company/CompanyPage';
import SettingsPage from './features/settings/SettingsPage';
import AdminDashboard from './features/admin/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import HelpPage from './features/help/HelpPage';
import BoardPage from './features/board/BoardPage';
import TasksPage from './features/tasks/TasksPage';
import ArchivePage from './features/archive/ArchivePage';
import EmailPage from './features/email/EmailPage';
import ZsspdPage from './features/zsspd/ZsspdPage';

const StartPageRedirect = () => {
  const { user } = useAuthStore();
  const startPage = user?.preferences?.start_page || 'chat';

  // Map preference to path
  const pathMap: Record<string, string> = {
    chat: '/chat',
    company: '/company',
    board: '/board',
    tasks: '/tasks',
    archive: '/archive',
    email: '/email',
    zsspd: '/zsspd',
    // Fallback for previously saved paths
    '/': '/chat',
    '/company': '/company',
    '/board': '/board',
    '/tasks': '/tasks',
    '/archive': '/archive',
    '/email': '/email',
    '/zsspd': '/zsspd'
  };

  const targetPath = pathMap[startPage] || '/chat';
  return <Navigate to={targetPath} replace />;
};

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      refetchOnWindowFocus: true,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});


function AppContent() {
  const navigate = useNavigate();
  const closeViewer = useDocumentViewer(state => state.close);

  const { user, token, updateUser } = useAuthStore();
  
  // Автоматическое обновление токена
  useTokenRefresh();

  useEffect(() => {
    // Refresh user profile on app load to ensure latest data (like auto-generated email)
    // is synced even if old data was persisted in localStorage
    if (token && user) {
      api.get('/auth/me')
        .then(res => {
          updateUser(res.data);
        })
        .catch(err => {
          console.error('Failed to refresh user profile:', err);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, updateUser]); // Only run on mount or if token changes

  useEffect(() => {
    // Fetch public config
    api.get('/auth/config').then(res => {
      const config = res.data;
      if (config.app_name) {
        document.title = config.app_name;
      }
    }).catch(err => console.error('Failed to fetch config:', err));
  }, []);

  useEffect(() => {
    const electron = window.electron;
    if (electron) {
      // Handle deep links (gis-coordinator://...)
      const PROTOCOL = 'gis-coordinator';
      const cleanupOpenUrl = electron.onOpenUrl((url: string) => {
        const path = url.replace(`${PROTOCOL}://`, '/');
        navigate(path);
      });

      // System Tray / Global Shortcut: Quick Search
      const cleanupTriggerSearch = electron.onTriggerSearch(() => {
        // Navigate to archive or global search
        navigate('/archive?search=true');
      });

      // System Tray: Quick Upload
      const cleanupTriggerUpload = electron.onTriggerUpload(() => {
        navigate('/archive?upload=true');
      });

      // System Notification Clicked
      const cleanupNotificationClicked = electron.onNotificationClicked((data: Record<string, unknown>) => {
        if (data && typeof data.url === 'string') {
          navigate(data.url);
        } else {
          electron.focusWindow();
        }
      });

      // Global keyboard shortcuts (local to app window)
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeViewer();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (cleanupOpenUrl) cleanupOpenUrl();
        if (cleanupTriggerSearch) cleanupTriggerSearch();
        if (cleanupTriggerUpload) cleanupTriggerUpload();
        if (cleanupNotificationClicked) cleanupNotificationClicked();
      };
    }
  }, [navigate, closeViewer]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<StartPageRedirect />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:channelId" element={<ChatPage />} />
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/teams" element={<Navigate to="/company" replace />} />
          <Route path="/users" element={<Navigate to="/company" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/zsspd" element={<ZsspdPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { useState } from 'react';
import ConnectionSetup from './components/ConnectionSetup';
import api, { setBaseUrl } from './api/client';

import { useConfigStore } from './store/useConfigStore';

function App() {
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const { showSetup, setShowSetup, setServerUrl } = useConfigStore();

  useEffect(() => {
    const initConfig = async () => {
      if (window.electron) {
        try {
          const config = await window.electron.getAppConfig();
          if (config && config.serverUrl) {
            setBaseUrl(config.serverUrl);
            setServerUrl(config.serverUrl);
            setShowSetup(false);
          } else {
            setShowSetup(true);
          }
        } catch (e) {
          console.error('Failed to load config', e);
          setShowSetup(true);
        }
      }
      setIsConfigLoaded(true);
    };

    initConfig();
  }, [setServerUrl, setShowSetup]);

  const handleConfigured = (url: string) => {
    setBaseUrl(url);
    setServerUrl(url);
    setShowSetup(false);
  };

  if (!isConfigLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  if (showSetup) {
    return (
      <ToastProvider>
        <ConnectionSetup
          onConfigured={handleConfigured}
          initialUrl={api.defaults.baseURL}
        />
      </ToastProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <ToastProvider>
        <Router>
          <AppContent />
        </Router>
      </ToastProvider>
    </PersistQueryClientProvider>
  );
}

export default App;


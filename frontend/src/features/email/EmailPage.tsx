import React, { useCallback, useEffect, useState } from 'react';
import { emailService, type EmailAccount, type EmailFolder, type EmailMessage, type EmailMessageList, type FolderStats } from './emailService';
import EmailList from './components/EmailList';
import EmailDetails from './components/EmailDetails';
import EmailComposer from './components/EmailComposer';
import AddressBookModal from './components/AddressBookModal';
import CreateFolderModal from './components/CreateFolderModal';
import { Inbox, Send, Archive, Trash2, Plus, Mail, RefreshCw, Book, Folder, Star, AlertCircle, Search } from 'lucide-react';
import { Button, Card, Header } from '../../design-system';
import { useToast } from '../../design-system';
import { useTranslation } from 'react-i18next';

const EmailPage: React.FC = () => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [account, setAccount] = useState<EmailAccount | null>(null);
    const [emails, setEmails] = useState<EmailMessageList[]>([]);
    const [customFolders, setCustomFolders] = useState<EmailFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('inbox');
    const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [composerData, setComposerData] = useState<{ to?: string, subject?: string, body?: string }>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState<FolderStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMarkRead, setLoadingMarkRead] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // System folders configuration
    const systemFolders = [
        { id: 'inbox', name: t('email.inbox'), icon: Inbox, unread_count: stats?.unread || 0 },
        { id: 'sent', name: t('email.sent'), icon: Send, unread_count: 0 },
        { id: 'important', name: t('email.important'), icon: AlertCircle, unread_count: 0 },
        { id: 'starred', name: t('email.starred'), icon: Star, unread_count: 0 },
        { id: 'archived', name: t('email.archived'), icon: Archive, unread_count: 0 },
        { id: 'trash', name: t('email.trash'), icon: Trash2, unread_count: 0 }
    ];

    // Initialize Account and Folders
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const acc = await emailService.getAccount();
                setAccount(acc);
                await Promise.all([fetchFolders(), fetchStats()]);
            } catch {
                addToast({ type: 'error', title: 'Ошибка загрузки', message: 'Не удалось загрузить почтовый аккаунт' });
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const fetchEmails = useCallback(async () => {
        setLoading(true);
        try {
            const msgs = await emailService.getMessages(selectedFolder);
            setEmails(msgs || []);
        } catch (err) {
            console.error(err);
            setEmails([]);
        } finally {
            setLoading(false);
        }
    }, [selectedFolder]);

    // Fetch stats when folder changes
    useEffect(() => {
        const loadStats = async () => {
            try {
                const s = await emailService.getStats();
                setStats(s);
            } catch (err) {
                console.error(err);
            }
        };
        loadStats();
    }, [selectedFolder]);

        // Fetch Emails when folder changes
    useEffect(() => {
        fetchEmails();
        setSelectedEmailId(null);
    }, [selectedFolder]);

    const fetchFolders = async () => {
        try {
            const f = await emailService.getFolders();
            setCustomFolders(f || []);
        } catch {
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить папки' });
        }
    };

    const fetchStats = async () => {
        try {
            const stats = await emailService.getStats();
            setStats(stats);
            setUnreadCount(stats?.unread || 0);
        } catch (err) {
            console.error(err);
            setStats(null);
            setUnreadCount(0);
        }
    };

    const handleCreateFolder = async (name: string) => {
        try {
            await emailService.createFolder(name);
            await fetchFolders();
            setIsCreateFolderOpen(false);
            addToast({ type: 'success', title: 'Успех', message: `Папка "${name}" создана` });
        } catch (err) {
            console.error('Error creating folder:', err);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось создать папку' });
        }
    };

    const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm(t('email.delete_folder_confirm'))) {
            try {
                await emailService.deleteFolder(id);
                await fetchFolders();
                if (selectedFolder === id.toString()) setSelectedFolder('inbox');
                addToast({ type: 'success', title: 'Успех', message: 'Папка удалена' });
            } catch (err) {
                console.error('Error deleting folder:', err);
                addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось удалить папку' });
            }
        }
    };

    const handleAddressBookSelect = (email: string) => {
        setComposerData({ to: email });
        setIsAddressBookOpen(false);
        setIsComposerOpen(true);
    };

    const handleReply = (email: EmailMessageList | EmailMessage) => {
        const replySubject = email.subject.toLowerCase().startsWith('re:') ? email.subject : `Re: ${email.subject}`;
        const replyBody = `\n\n--- Пересылаемое сообщение ---\nОт: ${email.from_address}\nКому: ${email.to_address}\nДата: ${new Date(email.received_at).toLocaleString('ru-RU')}\nТема: ${email.subject}\n\n`;
        setComposerData({
            to: email.from_address,
            subject: replySubject,
            body: replyBody
        });
        setIsComposerOpen(true);
    };

    const handleForward = (email: EmailMessageList | EmailMessage) => {
        const fwdSubject = email.subject.toLowerCase().startsWith('fwd:') ? email.subject : `Fwd: ${email.subject}`;
        const fwdBody = `\n\n--- Пересылаемое сообщение ---\nОт: ${email.from_address}\nКому: ${email.to_address}\nДата: ${new Date(email.received_at).toLocaleString('ru-RU')}\nТема: ${email.subject}\n\n`;
        setComposerData({
            subject: fwdSubject,
            body: fwdBody
        });
        setIsComposerOpen(true);
    };

    const handleDeleteMessage = async (id: number) => {
        try {
            if (selectedFolder === 'trash') {
                await emailService.deleteMessage(id);
            } else {
                await emailService.updateMessage(id, { is_deleted: true });
            }
            fetchEmails();
            if (selectedEmailId === id) setSelectedEmailId(null);
        } catch (err) {
            console.error(err);
        }
    };

    const currentFolderTitle = [...systemFolders, ...customFolders.map(f => ({ id: f.id.toString(), name: f.name, icon: Folder }))].find(f => f.id === selectedFolder)?.name || t('email.folders');
    const currentFolderIcon = [...systemFolders, ...customFolders.map(f => ({ id: f.id.toString(), name: f.name, icon: Folder }))].find(f => f.id === selectedFolder)?.icon || Mail;

    return (
        <div className="flex h-full w-full bg-slate-50 overflow-hidden min-h-0">
            {/* Sidebar - современный минималистичный дизайн */}
            <div className="w-80 flex-shrink-0 flex flex-col p-6 gap-6 bg-white border-r border-slate-200">
                {/* Header Action */}
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={<Plus size={18} />}
                    onClick={() => { setComposerData({}); setIsComposerOpen(true); }}
                >
                    {t('email.new_message')}
                </Button>

                {/* Account Info Card */}
                <Card variant="outlined" padding="md">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Mail size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('email.account')}</div>
                            <div className="text-sm font-semibold text-slate-900 truncate">{account?.email_address || t('email.loading')}</div>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            fullWidth
                            icon={<Book size={16} />}
                            onClick={() => setIsAddressBookOpen(true)}
                        >
                            {t('email.address_book')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            fullWidth
                            icon={<RefreshCw size={16} className={loading ? "animate-spin" : ""} />}
                            onClick={() => fetchEmails()}
                        >
                            {t('email.refresh')}
                        </Button>
                    </div>
                </Card>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto space-y-6">
                    {/* System Folders */}
                    <div>
                        <div className="px-2 mb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t('email.folders')}</div>
                        <div className="space-y-1">
                            {systemFolders.map((folder) => {
                                const isActive = selectedFolder === folder.id;
                                const hasUnread = folder.unread_count > 0;
                                return (
                                    <button
                                        key={folder.id}
                                        onClick={() => setSelectedFolder(folder.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
                                            }`}
                                    >
                                        <folder.icon size={18} />
                                        <span className="flex-1 text-left truncate">{folder.name}</span>
                                        {hasUnread && (
                                            <span className="bg-red-500 text-white text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center">
                                                {folder.unread_count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Folders */}
                    <div>
                        <div className="px-2 mb-3 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('email.personal')}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Plus size={14} />}
                                onClick={() => setIsCreateFolderOpen(true)}
                            />
                        </div>
                        <div className="space-y-1">
                            {customFolders.map((folder) => {
                                const isActive = selectedFolder === folder.id.toString();
                                return (
                                    <div key={folder.id} className="relative group">
                                        <button
                                            onClick={() => setSelectedFolder(folder.id.toString())}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-amber-500 text-white shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-amber-500'
                                            }`}
                                        >
                                            <Folder size={18} />
                                            <span className="flex-1 text-left truncate">{folder.name}</span>
                                        </button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={<Trash2 size={14} />}
                                            onClick={(e) => handleDeleteFolder(e, folder.id)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Mark All Read Button */}
                    {(unreadCount > 0) && (
                        <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            icon={<RefreshCw size={16} className={loadingMarkRead ? "animate-spin" : ""} />}
                            onClick={async () => {
                                setLoadingMarkRead(true);
                                try {
                                    await emailService.markAllAsRead();
                                    await fetchStats();
                                    await fetchEmails();
                                    addToast({ type: 'success', title: 'Уведомления', message: 'Все письма отмечены как прочитанные' });
                                } catch (err) {
                                    console.error(err);
                                    addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось отметить письма как прочитанные' });
                                } finally {
                                    setLoadingMarkRead(false);
                                }
                            }}
                            disabled={loadingMarkRead}
                        >
                            {t('email.mark_all_read')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 p-6 flex flex-col gap-6 overflow-hidden">
                {/* Header */}
                <Header
                    icon={React.createElement(currentFolderIcon, { size: 20 })}
                    title={currentFolderTitle}
                    subtitle={t('email.title')}
                    searchPlaceholder={t('email.search_placeholder')}
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Email List Section */}
                <Card 
                    variant="default" 
                    padding="none"
                    className={`flex flex-col overflow-hidden transition-all duration-500 ${selectedEmailId ? 'h-[40%]' : 'flex-1'}`}
                >
                    {/* List Header */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <p className="text-sm font-medium text-slate-600">
                            {emails.length === 1 ? t('email.messages_count', { count: emails.length }) : t('email.messages_count_plural', { count: emails.length })}
                        </p>
                    </div>

                    {/* The List Component */}
                    <div className="flex-1 overflow-auto">
                        <EmailList
                            emails={emails.filter(e =>
                                (e.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (e.from_address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (e.to_address || '').toLowerCase().includes(searchQuery.toLowerCase())
                            )}
                            onSelectEmail={setSelectedEmailId}
                            selectedEmailId={selectedEmailId}
                            onToggleStar={async (e, id, current) => {
                                e.stopPropagation();
                                try {
                                    await emailService.updateMessage(id, { is_starred: !current });
                                    fetchEmails();
                                    fetchStats(); // Обновляем статистику
                                } catch (err) { console.error(err); }
                            }}
                            onToggleRead={async (e, id, current) => {
                                e.stopPropagation();
                                try {
                                    await emailService.updateMessage(id, { is_read: !current });
                                    await fetchEmails();
                                    await fetchStats(); // Обновляем статистику
                                } catch (err) { console.error(err); }
                            }}
                            onDelete={async (e, id) => {
                                e.stopPropagation();
                                if (selectedFolder === 'trash') {
                                    if (confirm(t('email.delete_forever'))) {
                                        handleDeleteMessage(id);
                                    }
                                } else {
                                    handleDeleteMessage(id);
                                }
                            }}
                        />
                    </div>
                </Card>

                {/* Email Details Section - Only visible when email is selected */}
                {selectedEmailId ? (
                    <Card variant="default" padding="none" className="flex-1 overflow-hidden min-h-0">
                        <EmailDetails
                            emailId={selectedEmailId}
                            customFolders={customFolders}
                            onEmailUpdate={fetchEmails}
                            onStatsUpdate={fetchStats}
                            onReply={handleReply}
                            onForward={handleForward}
                            onDelete={handleDeleteMessage}
                        />
                    </Card>
                ) : (
                    <Card variant="default" className="flex-1 overflow-hidden min-h-0 flex items-center justify-center">
                        <div className="text-center p-8">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail size={32} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('email.select_message')}</h3>
                            <p className="text-slate-500">{t('email.select_message_description')}</p>
                        </div>
                    </Card>
                )}
            </div>

            {/* Modals */}
            {isComposerOpen && (
                <EmailComposer
                    onClose={() => setIsComposerOpen(false)}
                    initialTo={composerData.to}
                    initialSubject={composerData.subject}
                    initialBody={composerData.body}
                    onSent={fetchEmails}
                />
            )}

            {isAddressBookOpen && (
                <AddressBookModal
                    onClose={() => setIsAddressBookOpen(false)}
                    onSelectUser={handleAddressBookSelect}
                />
            )}

            {isCreateFolderOpen && (
                <CreateFolderModal
                    isOpen={isCreateFolderOpen}
                    onClose={() => setIsCreateFolderOpen(false)}
                    onCreate={handleCreateFolder}
                />
            )}
        </div>
    );
};

export default EmailPage;

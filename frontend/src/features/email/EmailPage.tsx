import React, { useCallback, useEffect, useState } from 'react';
import { emailService, type EmailAccount, type EmailFolder, type EmailMessage, type EmailMessageList } from './emailService';
import EmailList from './components/EmailList';
import EmailDetails from './components/EmailDetails';
import EmailComposer from './components/EmailComposer';
import AddressBookModal from './components/AddressBookModal';
import CreateFolderModal from './components/CreateFolderModal';
import { Inbox, Send, Archive, Trash2, Plus, Mail, RefreshCw, Book, Folder, Star, AlertCircle, Search } from 'lucide-react';
import { Button } from '../../design-system';
import { useTranslation } from 'react-i18next';

const EmailPage: React.FC = () => {
    const { t } = useTranslation();
    const [account, setAccount] = useState<EmailAccount | null>(null);
    const [emails, setEmails] = useState<EmailMessageList[]>([]);
    const [customFolders, setCustomFolders] = useState<EmailFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('inbox');
    const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [composerData, setComposerData] = useState<{ to?: string, subject?: string, body?: string }>({});
    const [searchQuery, setSearchQuery] = useState('');

    // Initialize Account and Folders
    useEffect(() => {
        const init = async () => {
            try {
                const acc = await emailService.getAccount();
                setAccount(acc);
                fetchFolders();
            } catch (err) {
                console.error("Could not load email account", err);
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

    // Fetch Emails when folder changes
    useEffect(() => {
        fetchEmails();
        setSelectedEmailId(null);
    }, [fetchEmails]);

    const fetchFolders = async () => {
        try {
            const f = await emailService.getFolders();
            setCustomFolders(f || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateFolder = async (name: string) => {
        try {
            await emailService.createFolder(name);
            fetchFolders();
            setIsCreateFolderOpen(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm(t('email.delete_folder_confirm'))) {
            try {
                await emailService.deleteFolder(id);
                fetchFolders();
                if (selectedFolder === id.toString()) setSelectedFolder('inbox');
            } catch (err) {
                console.error(err);
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

    const systemFolders = [
        { id: 'inbox', name: t('email.inbox'), icon: Inbox },
        { id: 'sent', name: t('email.sent'), icon: Send },
        { id: 'important', name: t('email.important'), icon: AlertCircle },
        { id: 'starred', name: t('email.starred'), icon: Star },
        { id: 'archive', name: t('email.archive'), icon: Archive },
        { id: 'trash', name: t('email.trash'), icon: Trash2 }
    ];

    const currentFolderTitle = [...systemFolders, ...customFolders.map(f => ({ id: f.id.toString(), name: f.name, icon: Folder }))].find(f => f.id === selectedFolder)?.name || t('email.folders');
    const currentFolderIcon = [...systemFolders, ...customFolders.map(f => ({ id: f.id.toString(), name: f.name, icon: Folder }))].find(f => f.id === selectedFolder)?.icon || Mail;

    return (
        <div className="flex-1 h-full w-full bg-slate-50 flex items-stretch overflow-hidden animate-in fade-in duration-300">
            {/* Sidebar with glass effect (Requirements 14.3) */}
            <div className="w-80 flex-shrink-0 flex flex-col pt-6 pb-6 pl-6 pr-2 gap-8 bg-white/80 backdrop-blur-xl border-r border-white/60 shadow-xl shadow-slate-200/50">
                {/* Header Action */}
                <div className="px-2">
                    <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        icon={<Plus size={18} />}
                        onClick={() => { setComposerData({}); setIsComposerOpen(true); }}
                        className="uppercase tracking-wider group"
                    >
                        <span>{t('email.new_message')}</span>
                    </Button>
                </div>

                {/* Info Card with glass effect */}
                <div className="mx-2 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100/60 shadow-lg shadow-slate-200/30">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                            <Mail size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('email.account')}</div>
                            <div className="text-sm font-bold text-slate-900 truncate">{account?.email_address || t('email.loading')}</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAddressBookOpen(true)}
                        className="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95"
                    >
                        <Book size={14} />
                        {t('email.address_book')}
                    </button>
                    <button
                        onClick={() => fetchEmails()}
                        className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-indigo-600 hover:bg-indigo-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95"
                    >
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                        {t('email.refresh')}
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-8">
                    {/* System Folders */}
                    <div>
                        <div className="px-4 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('email.folders')}</div>
                        <div className="space-y-1">
                            {systemFolders.map((folder) => {
                                const isActive = selectedFolder === folder.id;
                                return (
                                    <button
                                        key={folder.id}
                                        onClick={() => setSelectedFolder(folder.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 group ${isActive
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                            : 'text-slate-500 hover:bg-white/90 hover:backdrop-blur-sm hover:text-indigo-600 hover:shadow-sm'
                                            }`}
                                    >
                                        <folder.icon size={18} />
                                        <span>{folder.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Folders */}
                    <div>
                        <div className="px-4 mb-2 flex items-center justify-between group">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('email.personal')}</span>
                            <button
                                onClick={() => setIsCreateFolderOpen(true)}
                                className="text-slate-400 hover:text-indigo-600 transition-colors p-1 hover:bg-white/50 rounded-lg"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {customFolders.map((folder) => {
                                const isActive = selectedFolder === folder.id.toString();
                                return (
                                    <div key={folder.id} className="relative group">
                                        <button
                                            onClick={() => setSelectedFolder(folder.id.toString())}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isActive
                                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                                : 'text-slate-500 hover:bg-white/90 hover:backdrop-blur-sm hover:text-amber-500 hover:shadow-sm'
                                                }`}
                                        >
                                            <Folder size={18} />
                                            <span className="truncate flex-1 text-left">{folder.name}</span>
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteFolder(e, folder.id)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                            {customFolders.length === 0 && (
                                <div className="px-4 py-3 text-xs text-slate-400 italic">{t('email.no_messages')}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden min-w-0">
                {/* Header Component from Design System */}
                <div>
                    <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl shadow-slate-200/50 p-4 sm:p-6 space-y-3 sm:space-y-4">
                        {/* Upper Level: Icon + Title + Search */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                            {/* Icon + Title Section */}
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                                <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 hover:scale-105 transition-transform duration-300">
                                    {React.createElement(currentFolderIcon, { size: 20 })}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {t('email.title')}
                                    </div>
                                    <h1 
                                        key={currentFolderTitle}
                                        className="text-lg sm:text-xl font-black text-slate-900 leading-none tracking-tight truncate animate-in fade-in slide-in-from-left-1 duration-300"
                                    >
                                        {currentFolderTitle}
                                    </h1>
                                </div>
                            </div>
                            
                            {/* Search Input */}
                            <div className="w-full sm:w-auto order-3 sm:order-2">
                                <div className="relative group w-full sm:w-80">
                                    <div className="absolute inset-0 bg-indigo-500/5 rounded-xl blur-md group-hover:bg-indigo-500/10 transition-colors" />
                                    <div className="relative flex items-center gap-2 bg-white/50 border border-slate-200/50 rounded-xl p-0.5 transition-all focus-within:bg-white focus-within:shadow-md focus-within:border-indigo-100 focus-within:ring-4 focus-within:ring-indigo-100">
                                        <Search className="ml-2.5 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder={t('email.search_placeholder')}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400 font-bold text-sm h-8"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Email List Section */}
                <div className={`flex flex-col bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden transition-all duration-500 ${selectedEmailId ? 'h-[40%]' : 'flex-1'}`}>
                    {/* List Header */}
                    <div className="px-8 py-5 border-b border-slate-100 bg-white z-10 flex justify-between items-center sticky top-0">
                        <div className="flex items-baseline gap-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {emails.length === 1 ? t('email.messages_count', { count: emails.length }) : t('email.messages_count_plural', { count: emails.length })}
                            </p>
                        </div>
                    </div>

                    {/* The List Component */}
                    <div className="flex-1 overflow-auto custom-scrollbar">
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
                </div>

                {/* Email Details Section - Only visible when email is selected */}
                {selectedEmailId && (
                    <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-indigo-500/10 overflow-hidden min-h-0">
                        <EmailDetails
                            emailId={selectedEmailId}
                            customFolders={customFolders}
                            onEmailUpdate={fetchEmails}
                            onReply={handleReply}
                            onForward={handleForward}
                            onDelete={handleDeleteMessage}
                        />
                    </div>
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

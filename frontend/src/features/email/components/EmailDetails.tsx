import React, { useEffect, useState, useRef } from 'react';
import { emailService, type EmailMessage, type EmailFolder, type EmailMessageUpdate } from '../emailService';
import { Paperclip, Clock, Download, Star, AlertCircle, Folder, Trash2, FolderInput, Reply, Forward, Printer, FileText } from 'lucide-react';
import { Avatar } from '../../../design-system';
import DOMPurify from 'dompurify';

interface EmailDetailsProps {
    emailId: number;
    customFolders: EmailFolder[];
    onEmailUpdate: () => void;
    onReply: (email: EmailMessage) => void;
    onForward: (email: EmailMessage) => void;
    onDelete: (id: number) => void;
}

const EmailDetails: React.FC<EmailDetailsProps> = ({ emailId, customFolders, onEmailUpdate, onReply, onForward, onDelete }) => {
    const [email, setEmail] = useState<EmailMessage | null>(null);
    const [loading, setLoading] = useState(false);
    const [isMoveDropdownOpen, setIsMoveDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchEmail = async () => {
            setLoading(true);
            try {
                const data = await emailService.getMessage(emailId);
                setEmail(data);
            } catch (error) {
                console.error("Failed to load email", error);
            } finally {
                setLoading(false);
            }
        };

        if (emailId) {
            fetchEmail();
        }
    }, [emailId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsMoveDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const updateEmail = async (updates: EmailMessageUpdate) => {
        if (!email) return;
        try {
            const updated = await emailService.updateMessage(email.id, updates);
            setEmail(updated);
            onEmailUpdate();
        } catch (error) {
            console.error("Failed to update email", error);
        }
    };

    const handleMoveToFolder = async (folderId: number | null) => {
        await updateEmail({ folder_id: folderId });
        setIsMoveDropdownOpen(false);
    };

    const handleDelete = async () => {
        if (confirm('Удалить письмо?')) {
            onDelete(emailId);
        }
    };

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin" />
                <div className="text-xs font-black text-slate-300 uppercase tracking-widest animate-pulse">Загрузка...</div>
            </div>
        </div>
    );

    if (!email) return null;

    // Format Date
    const dateObj = new Date(email.received_at);
    const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            {/* Toolbar */}
            <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10 sticky top-0">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => email && onReply(email)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Ответить"
                    >
                        <Reply size={20} />
                    </button>
                    <button
                        onClick={() => email && onForward(email)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Переслать"
                    >
                        <Forward size={20} />
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1" />
                    <button
                        onClick={() => email && updateEmail({ is_starred: !email.is_starred })}
                        className={`p-2 rounded-xl transition-all ${email?.is_starred ? 'bg-amber-50 text-amber-500' : 'text-slate-400 hover:bg-slate-50'}`}
                        title="Пометить"
                    >
                        <Star size={20} fill={email?.is_starred ? "currentColor" : "none"} />
                    </button>
                    <button
                        onClick={() => email && updateEmail({ is_important: !email.is_important })}
                        className={`p-2 rounded-xl transition-all ${email?.is_important ? 'bg-rose-50 text-rose-500' : 'text-slate-400 hover:bg-slate-50'}`}
                        title="Важное"
                    >
                        <AlertCircle size={20} />
                    </button>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsMoveDropdownOpen(!isMoveDropdownOpen)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Переместить"
                        >
                            <FolderInput size={20} />
                        </button>

                        {isMoveDropdownOpen && (
                            <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Переместить в</div>
                                <div className="max-h-60 overflow-y-auto py-1">
                                    <button
                                        onClick={() => handleMoveToFolder(null)}
                                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                                    >
                                        <Folder size={16} />
                                        <span>Входящие</span>
                                    </button>
                                    {customFolders.map(folder => (
                                        <button
                                            key={folder.id}
                                            onClick={() => handleMoveToFolder(folder.id)}
                                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                                        >
                                            <Folder size={16} />
                                            <span>{folder.name}</span>
                                        </button>
                                    ))}
                                    <div className="border-t border-slate-100 my-1" />
                                    <button
                                        onClick={() => handleMoveToFolder(null)} // Should map to trash logic
                                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        <span>Корзина</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-px h-6 bg-slate-100 mx-2" />

                    <button
                        onClick={handleDelete}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Удалить"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all" title="Печать">
                        <Printer size={20} />
                    </button>
                </div>
            </div>

            {/* Email Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                {/* Header Info */}
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-slate-900 leading-tight mb-6">{email.subject || '(Без темы)'}</h1>

                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar name={email.from_address} size="lg" className="shadow-lg shadow-indigo-100" />
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-base font-black text-slate-900">{email.from_address}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-tight">
                                    Кому: <span className="text-slate-600">{email.to_address}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">{dateStr}</div>
                            <div className="text-xs font-bold text-slate-400 flex items-center justify-end gap-1.5">
                                <Clock size={12} />
                                {timeStr}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100/50 mb-8 min-h-[200px]">
                    {email.body_html ? (
                        <div dangerouslySetInnerHTML={{ 
                            __html: DOMPurify.sanitize(email.body_html, {
                                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'div', 'span'],
                                ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
                                ALLOW_DATA_ATTR: false
                            })
                        }} />
                    ) : (
                        <div className="whitespace-pre-wrap">{email.body_text || '(Нет содержимого)'}</div>
                    )}
                </div>

                {/* Attachments */}
                {email.attachments && email.attachments.length > 0 && (
                    <div className="border-t border-slate-100 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Paperclip className="text-slate-400" size={16} />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                {email.attachments.length} {email.attachments.length === 1 ? 'вложение' : 'вложения'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {email.attachments.map(att => (
                                <div key={att.id} className="group flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 border border-slate-100 text-slate-400 group-hover:text-indigo-600 transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{att.filename}</div>
                                        <div className="text-[10px] font-bold text-slate-400">{Math.round(att.file_size / 1024)} KB</div>
                                    </div>
                                    <a
                                        href={`/api/email/attachments/${att.id}/download?token=${localStorage.getItem('token')}`} // Example placeholder URL
                                        className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        title="Скачать"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Download size={18} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailDetails;

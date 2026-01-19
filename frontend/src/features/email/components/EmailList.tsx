import React from 'react';
import { Paperclip, Star, Trash2, AlertCircle, Mail } from 'lucide-react';
import type { EmailMessageList } from '../emailService';
import { Card } from '../../../design-system';

interface EmailListProps {
    emails: EmailMessageList[];
    onSelectEmail: (id: number) => void;
    selectedEmailId: number | null;
    onToggleStar: (e: React.MouseEvent, id: number, current: boolean) => void;
    onToggleRead: (e: React.MouseEvent, id: number, current: boolean) => void;
    onDelete: (e: React.MouseEvent, id: number) => void;
}

const EmailList: React.FC<EmailListProps> = ({ emails, onSelectEmail, selectedEmailId, onToggleStar, onToggleRead, onDelete }) => {

    // Sort emails by date desc
    const sortedEmails = [...emails].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

    if (emails.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-full">
                <div className="text-xs font-black uppercase tracking-widest opacity-60">Нет писем</div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col min-w-[600px]">
            {/* Table Header */}
            <div className="flex items-center px-4 py-2 border-b border-slate-100/60 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                <div className="w-8 shrink-0"></div> {/* Star space */}
                <div className="w-6 shrink-0 mr-2"></div> {/* Attachment space */}
                <div className="flex-1 min-w-0 mr-4">Тема</div>
                <div className="w-48 shrink-0 mr-4">Корреспондент</div>
                <div className="w-32 shrink-0 text-right">Дата</div>
                <div className="w-8 shrink-0 ml-2"></div> {/* Read status space */}
                <div className="w-10 shrink-0 ml-2"></div> {/* Delete space */}
            </div>

            {/* List Rows using Card component */}
            <div className="flex-1 p-2 space-y-2">
                {sortedEmails.map(email => {
                    const isSelected = selectedEmailId === email.id;
                    const isUnread = !email.is_read;
                    const dateObj = new Date(email.received_at);

                    // Format Date: 12.01.2024, 15:30
                    const dateStr = dateObj.toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    return (
                        <Card
                            key={email.id}
                            selected={isSelected}
                            hoverable
                            padding="sm"
                            onClick={() => onSelectEmail(email.id)}
                            className="group"
                        >
                            <div className="flex items-center">
                                {/* Star Icon */}
                                <button
                                    onClick={(e) => onToggleStar(e, email.id, email.is_starred)}
                                    className={`w-8 shrink-0 flex items-center justify-start transition-colors ${email.is_starred ? 'text-amber-400' : 'text-slate-200 hover:text-slate-400'
                                        }`}
                                >
                                    <Star size={14} fill={email.is_starred ? "currentColor" : "none"} />
                                </button>

                                {/* Attachment Icon */}
                                <div className="w-6 shrink-0 mr-2 flex items-center justify-center">
                                    {email.has_attachments && (
                                        <Paperclip size={14} className="text-slate-300" />
                                    )}
                                </div>

                                {/* Subject */}
                                <div className={`flex-1 min-w-0 mr-4 text-sm truncate ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                                    {email.subject || '(Без темы)'}
                                    {email.is_important && (
                                        <AlertCircle size={14} className="inline-block ml-2 text-rose-400 -mt-1" />
                                    )}
                                </div>

                                {/* Sender */}
                                <div className={`w-48 shrink-0 mr-4 text-sm truncate ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-500'}`}>
                                    {email.from_address}
                                </div>

                                {/* Date */}
                                <div className="w-32 shrink-0 text-[11px] font-bold text-slate-400 text-right tabular-nums">
                                    {dateStr}
                                </div>

                                {/* Read Status Toggle */}
                                <div className="w-8 shrink-0 ml-2 flex justify-center">
                                    <button
                                        onClick={(e) => onToggleRead(e, email.id, email.is_read)}
                                        className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${!email.is_read ? 'text-blue-500 hover:bg-blue-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
                                        title={email.is_read ? "Отметить как непрочитанное" : "Отметить как прочитанное"}
                                    >
                                        <Mail size={14} fill={!email.is_read ? "currentColor" : "none"} />
                                    </button>
                                </div>

                                {/* Delete Action */}
                                <div className="w-10 shrink-0 ml-2 flex justify-end">
                                    <button
                                        onClick={(e) => onDelete(e, email.id)}
                                        className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default EmailList;

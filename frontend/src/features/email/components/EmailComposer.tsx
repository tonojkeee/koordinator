import React, { useState, useRef, useEffect } from 'react';
import { emailService, type SendEmailData } from '../emailService';
import type { User } from '../../../types';
import { X, Send, Paperclip, FileText, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/client';
import { Modal, Input, Button, TextArea } from '../../../design-system';
import { useTranslation } from 'react-i18next';

interface EmailComposerProps {
    onClose: () => void;
    onSent: () => void;
    initialTo?: string;
    initialSubject?: string;
    initialBody?: string;
}

const EmailComposer: React.FC<EmailComposerProps> = ({ onClose, onSent, initialTo, initialSubject, initialBody }) => {
    const { t } = useTranslation();
    // Form State
    const [subject, setSubject] = useState(initialSubject || '');
    const [body, setBody] = useState(initialBody || '');
    const [recipientInput, setRecipientInput] = useState('');
    const [recipients, setRecipients] = useState<string[]>(initialTo ? [initialTo] : []);
    const [files, setFiles] = useState<File[]>([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Fetch settings for limits
    const { data: settings } = useQuery({
        queryKey: ['public-settings'],
        queryFn: async () => (await api.get('/admin/public-settings')).data,
        staleTime: 5 * 60 * 1000,
    });

    const maxTotalSizeMb = settings?.email_max_total_attachment_size_mb ? parseInt(settings.email_max_total_attachment_size_mb) : 50;
    const maxTotalSizeBytes = maxTotalSizeMb * 1024 * 1024;

    // Initial load of address book for autocomplete
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const users = await emailService.getAddressBook();
                setAllUsers(users);
            } catch (err) {
                console.error("Failed to load users for autocomplete", err);
            }
        };
        loadUsers();
    }, []);

    // Handle outside click for suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter suggestions
    useEffect(() => {
        if (recipientInput.trim().length > 0) {
            const lower = recipientInput.toLowerCase();
            const matches = allUsers.filter(u =>
                (u.email && u.email.toLowerCase().includes(lower)) ||
                (u.full_name && u.full_name.toLowerCase().includes(lower)) ||
                (u.username && u.username.toLowerCase().includes(lower))
            ).slice(0, 5);
            setSuggestions(matches);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [recipientInput, allUsers]);

    const addRecipient = (email: string) => {
        if (email && !recipients.includes(email)) {
            setRecipients([...recipients, email]);
        }
        setRecipientInput('');
        setShowSuggestions(false);
    };

    const removeRecipient = (email: string) => {
        setRecipients(recipients.filter(r => r !== email));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (['Enter', ',', 'Tab'].includes(e.key)) {
            e.preventDefault();
            if (recipientInput.trim()) {
                // Simple email validation could go here
                addRecipient(recipientInput.trim());
            }
        } else if (e.key === 'Backspace' && !recipientInput && recipients.length > 0) {
            removeRecipient(recipients[recipients.length - 1]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);

            // Calculate total size including current files
            const currentTotal = files.reduce((acc, f) => acc + f.size, 0);
            const newTotal = newFiles.reduce((acc, f) => acc + f.size, 0);

            if (currentTotal + newTotal > maxTotalSizeBytes) {
                alert(t('email.compose.size_limit', { size: maxTotalSizeMb }));
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            setFiles(prev => [...prev, ...newFiles]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (recipients.length === 0) {
            alert(t('email.compose.at_least_one_recipient'));
            return;
        }

        setLoading(true);
        try {
            // Send to ALL recipients (simple loop for now, or backend handles list)
            // The service expects a single string for to_address, usually comma separated
            const emailData: SendEmailData = {
                to_address: recipients.join(', '),
                subject,
                body_text: body,
                attachments: files
            };

            await emailService.sendEmail(emailData);
            onSent();
            onClose();
        } catch (error) {
            console.error("Error sending email:", error);
            alert(t('email.compose.send_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={t('email.compose.title')}
            size="xl"
            closeOnOverlayClick={false}
            footer={
                <>
                    <div className="flex items-center gap-6 flex-1">
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 group"
                            title={t('email.compose.attach')}
                        >
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-indigo-200">
                                <Paperclip size={20} className="group-hover:rotate-45 transition-transform duration-300" />
                            </div>
                            <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors uppercase tracking-wide">{t('email.compose.attach')}</span>
                        </button>

                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                            {files.length > 0 && (
                                <span className={totalSize > maxTotalSizeBytes ? "text-rose-500" : "text-slate-400"}>
                                    {(totalSize / (1024 * 1024)).toFixed(2)} MB / {maxTotalSizeMb} MB
                                </span>
                            )}
                        </div>
                    </div>

                    <Button
                        variant="secondary"
                        onClick={onClose}
                    >
                        {t('email.compose.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={loading || recipients.length === 0}
                        loading={loading}
                        icon={<Send size={16} />}
                        iconPosition="right"
                        onClick={handleSubmit}
                    >
                        {loading ? t('email.compose.sending') : t('email.compose.send')}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Recipients */}
                <div className="relative group z-20">
                    <label className="text-[10px] uppercase font-black text-slate-400 mb-2 block tracking-widest ml-1">{t('email.compose.recipients')}</label>
                    <div
                        className="w-full min-h-[56px] px-3 py-2 bg-white border-2 border-slate-100 focus-within:border-indigo-100 rounded-2xl shadow-sm focus-within:shadow-xl focus-within:shadow-indigo-500/5 transition-all flex flex-wrap gap-2 items-center cursor-text"
                        onClick={() => document.getElementById('recipient-input')?.focus()}
                    >
                        {recipients.map(email => (
                            <div key={email} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold ring-1 ring-indigo-500/10 animate-in fade-in zoom-in duration-200">
                                <span className="truncate max-w-[200px]">{email}</span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeRecipient(email); }}
                                    className="text-indigo-400 hover:text-indigo-600 rounded-full hover:bg-indigo-100 p-0.5 transition-colors"
                                >
                                    <X size={12} strokeWidth={3} />
                                </button>
                            </div>
                        ))}
                        <input
                            id="recipient-input"
                            type="text"
                            className="flex-1 bg-transparent min-w-[150px] outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium h-8"
                            placeholder={recipients.length === 0 ? t('email.compose.recipients_placeholder') : ""}
                            value={recipientInput}
                            onChange={e => setRecipientInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div ref={suggestionsRef} className="absolute left-0 right-0 top-full mt-2 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
                            {suggestions.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => user.email && addRecipient(user.email)}
                                    className="w-full text-left px-5 py-3 hover:bg-indigo-50/50 flex items-center justify-between group/item transition-colors border-b border-slate-50 last:border-0"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 group-hover/item:bg-indigo-100 group-hover/item:text-indigo-600 flex items-center justify-center font-black text-xs transition-colors">
                                            {user.full_name?.[0] || user.username[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800 group-hover/item:text-indigo-900 transition-colors">{user.full_name || user.username}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover/item:text-indigo-400 transition-colors">{user.email}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Subject */}
                <Input
                    label={t('email.compose.subject')}
                    placeholder={t('email.compose.subject_placeholder')}
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    fullWidth
                />

                {/* Body */}
                <TextArea
                    label={t('email.compose.message')}
                    placeholder={t('email.compose.message_placeholder')}
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={10}
                    fullWidth
                />

                {/* Files List */}
                {files.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                        {files.map((file, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white pl-4 pr-2 py-2.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 hover:-translate-y-0.5 transition-all duration-300 group animate-in fade-in slide-in-from-bottom duration-200" style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                    <FileText size={16} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{file.name}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{(file.size / 1024).toFixed(0)} KB</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFile(i)}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors ml-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default EmailComposer;

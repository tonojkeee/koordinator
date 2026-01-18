import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Clock,
    FileText,
    AtSign,
    Hash,
    Upload,
    X,
    CheckCircle2,
    ChevronRight,
    FileUp
} from 'lucide-react';
import { ZsspdDirection, ZsspdStatus } from '../types';
import type { ZsspdPackage, ZsspdPackageCreate } from '../types';
import type { User } from '../../../types';
import { useToast } from '../../../design-system';
import PackageDetailsModal from './PackageDetailsModal';
import api from '../../../api/client';
import { zsspdService } from '../zsspdService';
import { useAuthStore } from '../../../store/useAuthStore';
import { Avatar } from '../../../design-system';
import { formatName, abbreviateRank } from '../../../utils/formatters';

interface OutgoingTabProps {
    isModalOpen: boolean;
    onClose: () => void;
}

const OutgoingTab: React.FC<OutgoingTabProps> = ({ isModalOpen, onClose }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    const [subject, setSubject] = useState('');
    const [recipient, setRecipient] = useState('');
    const [outgoingNumber, setOutgoingNumber] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<ZsspdPackage | null>(null);
    const { user } = useAuthStore();
    const isOperator = (user?.role as string) === 'operator' || user?.role === 'admin';

    const [showSuggestions, setShowSuggestions] = useState(false);

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/auth/users');
            return res.data;
        }
    });

    const filteredUsers = recipient
        ? (users || []).filter((u: User) =>
            u.username.toLowerCase().includes(recipient.toLowerCase()) ||
            (u.full_name && u.full_name.toLowerCase().includes(recipient.toLowerCase())) ||
            (u.email && u.email.toLowerCase().includes(recipient.toLowerCase()))
        ).slice(0, 5)
        : [];

    const { data: packages, isLoading } = useQuery({
        queryKey: ['zsspd', 'outgoing'],
        queryFn: () => zsspdService.getOutgoingPackages()
    });

    const createMutation = useMutation({
        mutationFn: (data: ZsspdPackageCreate) => zsspdService.createOutgoingPackage(data),
        onSuccess: async (newPackage) => {
            for (const file of files) {
                await zsspdService.uploadFile(newPackage.id, file);
            }
            await zsspdService.updatePackage(newPackage.id, { status: ZsspdStatus.READY });
            queryClient.invalidateQueries({ queryKey: ['zsspd', 'outgoing'] });
            onClose();
            resetForm();
            addToast({
                type: 'success',
                title: t('common.success'),
                message: t('zsspd.package_created', 'Заявка успешно создана и готова к отправке'),
            });
        },
        onError: () => {
            addToast({
                type: 'error',
                title: t('common.error'),
                message: t('zsspd.create_error', 'Не удалось создать заявку'),
            });
        }
    });

    const resetForm = () => {
        setSubject('');
        setRecipient('');
        setOutgoingNumber('');
        setFiles([]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!outgoingNumber || !recipient) return;
        createMutation.mutate({
            direction: ZsspdDirection.OUTGOING,
            subject,
            external_recipient: recipient,
            outgoing_number: outgoingNumber
        });
    };

    const getStatusInfo = (status: ZsspdStatus) => {
        switch (status) {
            case ZsspdStatus.SENT:
                return { icon: <CheckCircle2 className="w-4 h-4" />, bg: 'bg-emerald-100', text: 'text-emerald-600' };
            case ZsspdStatus.READY:
                return { icon: <CheckCircle2 className="w-4 h-4" />, bg: 'bg-amber-100', text: 'text-amber-600' };
            case ZsspdStatus.DRAFT:
                return { icon: <Clock className="w-4 h-4" />, bg: 'bg-slate-100', text: 'text-slate-600' };
            default:
                return { icon: <Clock className="w-4 h-4" />, bg: 'bg-slate-100', text: 'text-slate-600' };
        }
    };

    return (
        <div className="w-full">
            {/* List Header Labels */}
            {packages && packages.length > 0 && !isLoading && (
                <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
                    <div className="grid grid-cols-[1fr_1.1fr_1.6fr_2fr_2.2fr_1fr_70px] gap-4 px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <div>{t('zsspd.status')}</div>
                        <div>{t('zsspd.number')}</div>
                        {isOperator && <div>{t('zsspd.author')}</div>}
                        <div>{t('zsspd.subject')}</div>
                        <div>{t('zsspd.recipient')}</div>
                        <div>{t('zsspd.date')}</div>
                        <div className="text-right">{t('zsspd.actions')}</div>
                    </div>
                </div>
            )}

            {/* Packages List */}
            <div className="bg-white overflow-hidden">
                <div className="divide-y divide-slate-100">
                    {isLoading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="grid grid-cols-[1fr_1.1fr_1.6fr_2fr_2.2fr_1fr_70px] gap-4 px-6 py-4 animate-pulse">
                                <div className="h-6 bg-slate-100 rounded-lg" />
                                <div className="h-6 bg-slate-100 rounded-lg" />
                                {isOperator && <div className="h-6 bg-slate-100 rounded-lg" />}
                                <div className="h-6 bg-slate-100 rounded-lg" />
                                <div className="h-6 bg-slate-100 rounded-lg" />
                                <div className="h-6 bg-slate-100 rounded-lg" />
                                <div className="h-6 bg-slate-100 rounded-lg ml-auto" />
                            </div>
                        ))
                    ) : packages?.length === 0 ? (
                        <div className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-slate-50 rounded-xl mb-4">
                                    <FileText className="w-10 h-10 text-slate-300" />
                                </div>
                                <p className="text-slate-400 font-bold">{t('zsspd.no_outgoing', 'Исходящих заявок пока нет')}</p>
                            </div>
                        </div>
                    ) : (
                        packages?.map((pkg) => {
                            const statusInfo = getStatusInfo(pkg.status);
                            return (
                                <div
                                    key={pkg.id}
                                    onClick={() => setSelectedPackage(pkg)}
                                    className="group grid grid-cols-[1fr_1.1fr_1.6fr_2fr_2.2fr_1fr_70px] gap-4 px-6 py-3.5 items-center transition-all border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                                >
                                    {/* Status */}
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-1.5 rounded-lg ${statusInfo.bg}`}>
                                            {statusInfo.icon}
                                        </div>
                                        <span className={`text-sm font-bold ${statusInfo.text}`}>
                                            {t(`zsspd.statuses.${pkg.status}`)}
                                        </span>
                                    </div>

                                    {/* Number */}
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-white transition-colors border border-slate-200">
                                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{pkg.outgoing_number}</span>
                                    </div>

                                    {/* Author */}
                                    {isOperator && <div className="flex items-center gap-3 min-w-0">
                                        <Avatar
                                            src={pkg.creator?.avatar_url}
                                            name={formatName(pkg.creator?.full_name, pkg.creator?.username || '?')}
                                            size="md"
                                            className="shrink-0 shadow-sm"
                                        />
                                        <div className="flex flex-col justify-center min-w-0 gap-0.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {pkg.creator?.rank && (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight shrink-0">
                                                        {abbreviateRank(pkg.creator.rank)}
                                                    </span>
                                                )}
                                                <span className="text-sm font-bold text-slate-800 break-words leading-tight" title={pkg.creator?.full_name}>
                                                    {pkg.creator ? formatName(pkg.creator.full_name, pkg.creator.username) : t('common.unknown')}
                                                </span>
                                            </div>
                                            {pkg.creator?.username && (
                                                <span className="text-[11px] font-bold text-indigo-500/80 uppercase tracking-wider leading-none">
                                                    @{pkg.creator.username}
                                                </span>
                                            )}
                                        </div>
                                    </div>}

                                    {/* Subject */}
                                    <div className="min-w-0">
                                        <span className="text-sm font-semibold text-slate-700 truncate block" title={pkg.subject}>{pkg.subject}</span>
                                    </div>

                                    {/* Recipient */}
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="p-1.5 bg-indigo-50 rounded-lg border border-indigo-100 shrink-0">
                                            <AtSign className="w-3.5 h-3.5 text-indigo-400" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 truncate" title={pkg.external_recipient}>{pkg.external_recipient}</span>
                                    </div>

                                    {/* Date */}
                                    <div className="text-sm font-medium text-slate-600">
                                        {new Date(pkg.created_at).toLocaleDateString('ru-RU')}
                                    </div>

                                    {/* Actions */}
                                    <div className="text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedPackage(pkg); }}
                                            className="p-2 rounded-lg transition-all inline-flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600"
                                            title={t('common.view')}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
                    <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-white/20 p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 rounded-xl">
                                    <FileUp className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('zsspd.new_package')}</h2>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.outgoing_number')}</label>
                                    <div className="relative group">
                                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            required
                                            value={outgoingNumber}
                                            onChange={e => setOutgoingNumber(e.target.value)}
                                            placeholder={t('zsspd.outgoing_number_placeholder')}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.recipient')}</label>
                                    <div className="relative group">
                                        <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            required
                                            value={recipient}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            onChange={e => setRecipient(e.target.value)}
                                            placeholder={t('zsspd.recipient_placeholder')}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                        />

                                        {showSuggestions && filteredUsers.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {filteredUsers.map((u: User) => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setRecipient(u.email || `${u.username}@40919.com`);
                                                            setShowSuggestions(false);
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                                                    >
                                                        <Avatar src={u.avatar_url} name={u.full_name || u.username} size="sm" />
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-sm font-bold text-slate-700">{u.full_name || u.username}</span>
                                                            <span className="text-xs text-slate-400 truncate">{u.email || `${u.username}@40919.com`}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.subject')}</label>
                                <input
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder={t('zsspd.subject_placeholder')}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.files')}</label>
                                <div className="relative">
                                    <label className={`
                                        flex flex-col items-center justify-center w-full min-h-[100px] px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all
                                        ${files.length > 0 ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'}
                                    `}>
                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                            <Upload className={`w-6 h-6 ${files.length > 0 ? 'text-indigo-400' : 'text-slate-300'}`} />
                                            <p className="text-sm font-bold text-slate-500">{t('zsspd.drop_files')}</p>
                                        </div>
                                        <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                    </label>
                                </div>

                                {files.length > 0 && (
                                    <div className="mt-3 space-y-2 max-h-32 overflow-auto">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg group hover:bg-white border border-transparent hover:border-slate-100 transition-all">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                                    <span className="text-xs font-bold text-slate-600 truncate">{file.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                                                </div>
                                                <button type="button" onClick={() => removeFile(idx)} className="p-1 hover:bg-rose-100 rounded-lg text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-3 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    disabled={createMutation.isPending || !outgoingNumber || !recipient || files.length === 0}
                                    type="submit"
                                    className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {createMutation.isPending ? t('common.loading') : t('zsspd.create_package')}
                                    {!createMutation.isPending && <ChevronRight className="w-4 h-4" />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Package Details Modal */}
            {selectedPackage && (
                <PackageDetailsModal
                    package={selectedPackage}
                    onClose={() => setSelectedPackage(null)}
                />
            )}
        </div>
    );
};

export default OutgoingTab;

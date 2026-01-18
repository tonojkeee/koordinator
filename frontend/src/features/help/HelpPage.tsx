import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import type { User } from '../../types';
import { HelpCircle, MessageSquare, Shield, LifeBuoy, Mail, Loader2, Headset, FileText, CheckCircle, ClipboardList, Building2, Archive } from 'lucide-react';
import { Modal } from '../../design-system';
import packageJson from '../../../package.json';

const HelpPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isSupportOpen, setIsSupportOpen] = useState(false);

    const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);

    // Fetch users to find admins
    const { data: users } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/auth/users');
            return res.data;
        },
    });

    const admins = React.useMemo(() => users?.filter(u => u.role === 'admin') || [], [users]);

    // Set default selected admin when list loads
    React.useEffect(() => {
        if (admins.length > 0 && !selectedAdminId) {
            setSelectedAdminId(admins[0].id);
        }
    }, [admins, selectedAdminId]);

    const startDMMutation = useMutation({
        mutationFn: async (userId: number) => {
            const res = await api.post(`/chat/direct/${userId}`);
            return res.data;
        },
        onSuccess: (channel) => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            navigate(`/chat/${channel.id}`);
        },
    });

    const categories = [
        {
            icon: <MessageSquare size={24} className="text-indigo-500" />,
            title: t('help.categories.chat.title'),
            desc: t('help.categories.chat.desc'),
            gradient: 'from-indigo-50 to-white'
        },
        {
            icon: <ClipboardList size={24} className="text-violet-500" />,
            title: t('tasks.title', 'Указания'),
            desc: t('help.categories.tasks.desc', 'Управление поручениями и контроль исполнения. Выдача задач подчиненным, отслеживание статусов и формирование отчетов о проделанной работе.'),
            gradient: 'from-violet-50 to-white'
        },
        {
            icon: <Building2 className="text-emerald-500" size={24} />,
            title: t('company.title', 'Воинская часть'),
            desc: t('help.categories.teams.desc'),
            gradient: 'from-emerald-50 to-white'
        },
        {
            icon: <FileText size={24} className="text-blue-500" />,
            title: t('help.categories.board.title'),
            desc: t('help.categories.board.desc'),
            gradient: 'from-blue-50 to-white'
        },
        {
            icon: <Archive className="text-teal-500" size={24} />,
            title: t('help.categories.archive.title'),
            desc: t('help.categories.archive.desc'),
            gradient: 'from-teal-50 to-white'
        },
        {
            icon: <Shield size={24} className="text-amber-500" />,
            title: t('help.categories.security.title'),
            desc: t('help.categories.security.desc'),
            gradient: 'from-amber-50 to-white'
        }
    ];

    // Import Building2 manually if not available in common imports, but looking at code it might be missing

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 md:p-12 animate-in fade-in duration-500">
            <div className="max-w-6xl mx-auto space-y-16">
                {/* Header Section */}
                <header className="relative py-12 px-8 lg:px-16 bg-slate-900 rounded-3xl text-white overflow-hidden shadow-2xl shadow-slate-900/20">
                    <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
                        <div className="space-y-6 text-center md:text-left max-w-2xl">
                            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-500/20 border border-indigo-400/30 rounded-full backdrop-blur-md">
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">
                                    Центр поддержки
                                </span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">
                                Как мы можем <span className="text-indigo-400">помочь?</span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium leading-relaxed">
                                {t('help.description')}
                            </p>
                        </div>
                        <div className="shrink-0">
                            <div className="w-32 h-32 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 flex items-center justify-center shadow-inner relative group">
                                <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl blur-xl group-hover:bg-indigo-500/20 transition-all duration-500" />
                                <HelpCircle size={48} className="text-indigo-400 relative z-10" />
                            </div>
                        </div>
                    </div>
                    {/* Abstract background shapes */}
                    <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px]" />
                    <div className="absolute -bottom-24 -left-12 w-96 h-96 bg-rose-600/10 rounded-full blur-[120px]" />
                </header>

                {/* Categories Section */}
                <section className="space-y-8">
                    <div className="flex items-center justify-between px-4">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                            Популярные разделы
                        </h2>
                        <div className="h-px flex-1 bg-slate-200 mx-8 hidden md:block" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {categories.map((cat, idx) => (
                            <div
                                key={idx}
                                className="group relative p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-2 transition-all duration-500 animate-in fade-in"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-50/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 border border-slate-100 group-hover:scale-110 group-hover:bg-white group-hover:shadow-lg transition-all duration-500">
                                        {cat.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors">
                                        {cat.title}
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        {cat.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* IT Support Hero */}
                <section className="relative p-12 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50 skew-x-12 translate-x-32 group-hover:translate-x-24 transition-transform duration-700" />

                    <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
                        <div className="lg:w-1/2 space-y-8">
                            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30">
                                <Headset size={36} />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-black text-slate-900 tracking-tight">
                                    {t('chat.it_support_center')}
                                </h3>
                                <p className="text-slate-500 text-lg font-medium leading-relaxed">
                                    {t('help.supportDesc')}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsSupportOpen(true)}
                                className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-2xl shadow-slate-900/20 hover:bg-indigo-600 hover:shadow-indigo-600/30 transition-all active:scale-95 flex items-center space-x-3"
                            >
                                <MessageSquare size={20} />
                                <span>Связаться с техподдержкой</span>
                            </button>
                        </div>

                        <div className="lg:w-1/2 grid grid-cols-2 gap-4">
                            <div className="p-6 bg-indigo-50 rounded-3xl space-y-2 border border-indigo-100">
                                <LifeBuoy className="text-indigo-600" size={24} />
                                <h4 className="font-bold text-slate-900">24/7 Помощь</h4>
                                <p className="text-xs text-slate-500 font-medium">Мы всегда на связи для решения ваших вопросов</p>
                            </div>
                            <div className="p-6 bg-emerald-50 rounded-3xl space-y-2 border border-emerald-100 translate-y-6">
                                <CheckCircle size={24} className="text-emerald-600" />
                                <h4 className="font-bold text-slate-900">Защита</h4>
                                <p className="text-xs text-slate-500 font-medium">Ваши данные надежно защищены протоколами ГИС</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Version Footer */}
                <footer className="pt-8 pb-16 flex flex-col items-center space-y-6">
                    <div className="flex items-center space-x-4">
                        <div className="h-px w-12 bg-slate-200" />
                        <span className="text-[10px] font-black uppercase tracking-[1em] text-slate-400 pl-4">
                            Coordinator
                        </span>
                        <div className="h-px w-12 bg-slate-200" />
                    </div>

                    <div className="flex flex-col items-center space-y-2">
                        <p className="text-sm font-bold text-slate-900">
                            Версия {packageJson.version} — Специальное издание
                        </p>
                        <p className="text-xs text-slate-400 font-medium">
                            © 2026 ГИС Координатор. Все права защищены.
                        </p>
                    </div>
                </footer>
            </div>


            {/* Support Modal */}
            <Modal
                isOpen={isSupportOpen}
                onClose={() => setIsSupportOpen(false)}
                title={t('help.supportModal.title')}
            >
                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-1 gap-6">
                        {/* Chat with Admin */}
                        <div className="p-8 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-3xl flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-indigo-100/50 rounded-3xl flex items-center justify-center text-indigo-600 mb-2">
                                <Headset size={32} />
                            </div>

                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900">{t('help.supportModal.chatWithAdmin')}</h3>
                                <p className="text-sm text-slate-500">{t('help.contact.select_admin')}</p>
                            </div>

                            <div className="w-full max-w-xs space-y-3">
                                {admins.length > 0 ? (
                                    <>
                                        <select
                                            value={selectedAdminId || ''}
                                            onChange={(e) => setSelectedAdminId(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-700 font-medium appearance-none"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                                        >
                                            {admins.map(admin => (
                                                <option key={admin.id} value={admin.id}>
                                                    {admin.full_name || admin.username}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => selectedAdminId && startDMMutation.mutate(selectedAdminId)}
                                            disabled={!selectedAdminId || startDMMutation.isPending}
                                            className="w-full py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                        >
                                            {startDMMutation.isPending ? (
                                                <Loader2 className="animate-spin" size={20} />
                                            ) : (
                                                <MessageSquare size={20} />
                                            )}
                                            <span>{t('common.write')}</span>
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-slate-400 font-medium py-2">
                                        {t('help.supportModal.adminUnavailable')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Email Support */}
                        <a
                            href={`mailto:${t('help.supportModal.emailAddress')}`}
                            className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl hover:bg-slate-900 hover:border-slate-900 hover:text-white transition-all duration-300 group"
                        >
                            <div className="w-16 h-16 bg-white rounded-3xl shadow-md flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Mail className="text-slate-600" size={32} />
                            </div>
                            <span className="text-sm font-black uppercase tracking-widest">
                                {t('help.supportModal.emailSupport')}
                            </span>
                            <span className="text-[10px] mt-1 opacity-60 font-medium">{t('help.supportModal.emailAddress')}</span>
                        </a>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default HelpPage;

import React, { useState, useEffect } from 'react';
import type { TFunction } from 'i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import {
    Users, Building2, Shield, Trash2,
    BarChart2, Activity, HardDrive,
    Search, XCircle, Pencil, Key, Save, User as UserIcon, Settings, Sliders, MessageSquare, Database
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { ClipboardList, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../design-system';
import { Avatar } from '../../design-system';
import type { User, Unit, AuditLog, SystemSetting } from '../../types';
import type { Task } from '../tasks/types';
import { Header } from '../../design-system';
import { formatBytes, formatActivityDate, formatChartDate, formatDuration } from './utils';
import { StatCard } from './components/StatCard';

// Types for Stats
interface OverviewStats {
    total_users: number;
    online_users: number;
    messages_today: number;
    total_files: number;
    total_storage_size: number;
    tasks_total: number;
    tasks_completed: number;
    tasks_in_progress: number;
    tasks_on_review: number;
    tasks_overdue: number;
}

interface ActivityStat {
    date: string;
    messages: number;
    new_users: number;
    new_tasks: number;
}

interface StorageStat {
    name: string;
    value: number;
    count: number;
    color: string;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatActivityDate = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
};

const formatChartDate = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
        });
    } catch {
        return dateStr;
    }
};

const formatDuration = (start: Date) => {
    const diff = Math.max(0, new Date().getTime() - start.getTime());
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

interface UnitStat {
    name: string;
    value: number;
}

interface TaskUnitStat {
    name: string;
    total: number;
    completed: number;
}



interface ActivityLogEvent {
    id: string;
    type: 'new_user' | 'new_document' | 'system' | 'new_task_event';
    user: string;
    description: string;
    timestamp: string;
}

interface SystemHealth {
    uptime: string;
    cpu_load: number;
    ram_usage: number;
    status: string;
}

interface EditUserModalProps {
    user: User;
    units: Unit[];
    onClose: () => void;
    onSave: (id: number, data: Partial<User>) => void;
    onResetPassword: (id: number, pass: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}

const EditUserModal = ({ user, units, onClose, onSave, onResetPassword, t }: EditUserModalProps) => {
    const [formData, setFormData] = useState({ ...user });
    const [showPassword, setShowPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [activeSection, setActiveSection] = useState<'personal' | 'org' | 'security'>('personal');

    const inputClasses = "w-full bg-slate-50/50 border border-slate-200/50 rounded-2xl px-5 py-3.5 font-semibold text-slate-700 placeholder:text-slate-300 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500/30 focus:bg-white transition-all duration-300 outline-none shadow-sm";
    const labelClasses = "text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 ml-1 block";

    return (
        <div className="flex flex-col h-full max-h-[90vh] bg-white/95 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
            <div className="p-10 border-b border-slate-100/60 flex justify-between items-center bg-white/40 sticky top-0 z-20">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-full blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                        <Avatar src={user.avatar_url} name={user.full_name || user.username} size="lg" className="relative border-4 border-white shadow-xl" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{t('admin.editUser')}</h2>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50/50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                @{user.username}
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="group relative w-12 h-12 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-2xl transition-all duration-300 active:scale-90"
                >
                    <XCircle size={28} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
            </div>

            <div className="px-10 flex gap-10 bg-white/40 border-b border-slate-100/60 sticky top-[113px] z-10">
                {[
                    { id: 'personal', label: t('admin.personalInfo'), icon: UserIcon },
                    { id: 'org', label: t('admin.organization'), icon: Building2 },
                    { id: 'security', label: t('admin.security'), icon: Key }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id as 'personal' | 'org' | 'security')}
                        className={`py-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] transition-all relative group ${activeSection === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <tab.icon size={16} className={`${activeSection === tab.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                        {tab.label}
                        {activeSection === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-t-full shadow-[0_-4px_10px_rgba(79,70,229,0.3)]" />
                        )}
                    </button>
                ))}
            </div>

            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                {activeSection === 'personal' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="md:col-span-2">
                            <label className={labelClasses}>{t('admin.rank')}</label>
                            <input
                                className={inputClasses}
                                placeholder={t('admin.rankPlaceholder')}
                                value={formData.rank || ''}
                                onChange={e => setFormData({ ...formData, rank: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>{t('common.username')}</label>
                            <input
                                className={inputClasses}
                                placeholder={t('common.username')}
                                value={formData.username || ''}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>{t('common.fullName')}</label>
                            <input
                                className={inputClasses}
                                placeholder={t('settings.name_placeholder')}
                                value={formData.full_name || ''}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>{t('common.email')}</label>
                            <div className="bg-slate-50/50 border border-slate-200/50 rounded-2xl px-5 py-3.5 font-semibold text-slate-400 flex items-center justify-between">
                                <span>{formData.email}</span>
                                <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/50">Системный</span>
                            </div>
                        </div>
                        <div>
                            <label className={labelClasses}>{t('common.phoneNumber')}</label>
                            <input
                                className={inputClasses}
                                placeholder="+7 (999) 000-00-00"
                                value={formData.phone_number || ''}
                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>{t('common.birthDate')}</label>
                            <input
                                type="date"
                                className={inputClasses}
                                value={formData.birth_date ? new Date(formData.birth_date).toISOString().split('T')[0] : ''}
                                onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {activeSection === 'org' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div>
                            <label className={labelClasses}>{t('common.unit')}</label>
                            <select
                                className={inputClasses}
                                value={formData.unit_id || ''}
                                onChange={e => setFormData({ ...formData, unit_id: Number(e.target.value) || null })}
                            >
                                <option value="">{t('admin.noUnit')}</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>{t('admin.role')}</label>
                            <select
                                className={inputClasses}
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value as 'user' | 'admin' | 'operator' })}
                            >
                                <option value="user">{t('admin.roleUser')}</option>
                                <option value="operator">{t('admin.roleOperator')}</option>
                                <option value="admin">{t('admin.roleAdmin')}</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>{t('common.cabinet')}</label>
                            <input
                                className={inputClasses}
                                placeholder="404"
                                value={formData.cabinet || ''}
                                onChange={e => setFormData({ ...formData, cabinet: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>{t('common.position')}</label>
                            <input
                                className={inputClasses}
                                placeholder={t('common.position')}
                                value={formData.position || ''}
                                onChange={e => setFormData({ ...formData, position: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <label className={labelClasses}>{t('admin.accountStatus')}</label>
                                <select
                                    className={inputClasses}
                                    value={formData.status || 'active'}
                                    onChange={e => {
                                        const newStatus = e.target.value;
                                        const isActive = !['blocked', 'terminated'].includes(newStatus);
                                        setFormData({ ...formData, status: newStatus, is_active: isActive });
                                    }}
                                >
                                    <option value="active">{t('admin.statusActive')}</option>
                                    <option value="on_leave">{t('admin.statusOnLeave')}</option>
                                    <option value="away">{t('admin.statusAway')}</option>
                                    <option value="blocked">{t('admin.statusBlocked')}</option>
                                    <option value="terminated">{t('admin.statusTerminated')}</option>
                                </select>
                            </div>
                            <div className={`p-4 rounded-2xl border transition-all flex items-center gap-3 ${formData.is_active ? 'bg-green-50/50 border-green-100 text-green-700' : 'bg-rose-50/50 border-rose-100 text-rose-700'
                                }`}>
                                <div className={`w-2 h-2 rounded-full ${formData.is_active ? 'bg-green-600 animate-pulse' : 'bg-rose-600'}`} />
                                <span className="text-xs font-black uppercase tracking-widest">
                                    {formData.is_active ? t('admin.accessAllowed') : t('admin.accessDenied')}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'security' && (
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <Key className="text-rose-600" size={16} />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t('admin.security')}</h3>
                            </div>
                            {!showPassword && (
                                <button
                                    onClick={() => setShowPassword(true)}
                                    className="text-xs font-black text-rose-600 bg-rose-50 px-4 py-2 rounded-xl"
                                >
                                    {t('admin.initReset')}
                                </button>
                            )}
                        </div>

                        {showPassword && (
                            <div className="flex flex-col gap-6">
                                <input
                                    type="text"
                                    className={inputClasses}
                                    placeholder={t('admin.newPassword')}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { if (newPassword.length >= 6) onResetPassword(user.id, newPassword); }}
                                        className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase"
                                    >
                                        {t('admin.updatePassword')}
                                    </button>
                                    <button onClick={() => setShowPassword(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase">
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-8 bg-white border-t border-slate-100 flex justify-end gap-4 sticky bottom-0 z-10">
                <button onClick={onClose} className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">
                    {t('common.cancel')}
                </button>
                <button
                    onClick={() => onSave(user.id, formData)}
                    className="flex items-center gap-2.5 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 group"
                >
                    <Save size={18} className="group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
};

interface OverviewTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    stats: OverviewStats | undefined;
    activityData: ActivityStat[] | undefined;
    storageData: StorageStat[] | undefined;
    unitStats: UnitStat[] | undefined;
    recentActivity: ActivityLogEvent[] | undefined;
    systemHealth?: SystemHealth;
    onViewLogs: () => void;
}

const LogsModal = ({ onClose, t }: { onClose: () => void; t: TFunction }) => {
    const { data: logs, isLoading } = useQuery<AuditLog[]>({
        queryKey: ['admin-logs'],
        queryFn: async () => (await api.get('/admin/logs')).data,
        refetchInterval: 10000
    });

    return (
        <div className="flex flex-col h-full max-h-[85vh] bg-white/95 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-10 border-b border-slate-100/60 flex justify-between items-center bg-white/40 sticky top-0 z-20">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-100/50">
                        <Activity size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{t('admin.systemStatus.logs')}</h2>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.auditLog')}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="group relative w-12 h-12 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-2xl transition-all duration-300 active:scale-90"
                >
                    <XCircle size={28} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/20">
                <div className="space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-6">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin" />
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                            </div>
                            <span className="text-slate-400 font-black text-xs uppercase tracking-widest animate-pulse">{t('common.loading')}</span>
                        </div>
                    ) : logs && logs.length > 0 ? logs.map((log) => (
                        <div key={log.id} className="bg-white/70 backdrop-blur-md p-6 rounded-[2rem] border border-white shadow-sm flex gap-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
                            <Avatar src={log.user.avatar_url} name={log.user.full_name || log.user.username} size="md" className="border-2 border-white shadow-lg group-hover:scale-110 transition-transform duration-500" />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-base font-black text-slate-900">
                                        {log.user.full_name || log.user.username}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        {formatActivityDate(log.timestamp)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm ${log.action.includes('delete') ? 'bg-rose-500 text-white' :
                                        log.action.includes('create') ? 'bg-emerald-500 text-white' :
                                            'bg-indigo-600 text-white'
                                        }`}>
                                        {t(`admin.auditLogActions.${log.action}`, log.action)}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100/50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                        {t(`admin.auditLogTargets.${log.target_type}`, log.target_type)} {log.target_id ? `#${log.target_id}` : ''}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-slate-600 bg-slate-50/40 p-4 rounded-2xl border border-slate-100/60 leading-relaxed italic">
                                    {log.details}
                                </p>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-32">
                            <div className="inline-flex p-8 bg-slate-100 rounded-full mb-6 text-slate-300">
                                <Activity size={64} />
                            </div>
                            <p className="text-slate-400 font-bold text-lg uppercase tracking-widest">{t('common.nothing_found')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const OverviewTab = ({ t, stats, activityData, storageData, unitStats, recentActivity, systemHealth, onViewLogs }: OverviewTabProps) => (
    <div className="space-y-6 animate-in transition-all-custom">
        {/* Top Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t('admin.totalUsers')} value={stats?.total_users || 0} icon={<Users />} color="indigo" subValue={t('admin.totalAccounts')} trend="+12%" t={t} />
            <StatCard title={t('admin.onlineNow')} value={stats?.online_users || 0} icon={<Activity />} color="emerald" isLive={true} t={t} />
            <StatCard title={t('admin.messagesToday')} value={stats?.messages_today || 0} icon={<BarChart2 />} color="violet" trend="+40%" t={t} />
            <StatCard title={t('admin.storageUsed')} value={formatBytes(stats?.total_storage_size || 0)} icon={<HardDrive />} color="amber" subValue={`${stats?.total_files || 0} ${t('admin.files')}`} t={t} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Trend Chart */}
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-2xl p-6 rounded-3xl border border-white shadow-[0_20px_40px_rgba(0,0,0,0.02)] transition-all-custom group">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 leading-none tracking-tight mb-1">{t('admin.activityTrend')}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('admin.last30Days')}</p>
                    </div>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <AreaChart data={(activityData || [])}>
                            <defs>
                                <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                dy={10}
                                tickFormatter={formatChartDate}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '16px', border: '1px solid #eef2ff', fontWeight: 900, fontSize: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }}
                                cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '5 5' }}
                                labelFormatter={formatActivityDate}
                                formatter={(value: number | string | undefined) => [value, t('admin.messagesToday')]}
                            />
                            <Area type="monotone" dataKey="messages" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorMessages)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Storage Breakdown Pie Chart */}
            <div className="bg-white/70 backdrop-blur-2xl p-6 rounded-3xl border border-white shadow-[0_20px_40px_rgba(0,0,0,0.02)] transition-all-custom relative overflow-hidden">
                <div className="absolute top-6 left-6">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('admin.storageUsage')}</h3>
                </div>
                <div className="h-64 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={(storageData || []).map(item => ({ ...item, name: t(`admin.storageTypes.${item.name}`, item.name) }))}
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={8}
                                dataKey="value"
                            >
                                {(storageData || []).map((entry: StorageStat, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, color: '#1e293b', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                formatter={(value: number | string | undefined) => [typeof value === 'number' ? formatBytes(value) : (value || ''), t('admin.size')]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="pb-3">{t('admin.type')}</th>
                            <th className="pb-3 text-right">{t('admin.size')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {(storageData || []).map((item: StorageStat) => (
                            <tr key={item.name} className="group/item">
                                <td className="py-2.5 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">
                                        {t(`admin.storageTypes.${item.name}`, item.name)}
                                    </span>
                                </td>
                                <td className="py-2.5 text-right font-black text-slate-900 text-[11px]">{formatBytes(item.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity Feed */}
            <div className="bg-white/70 backdrop-blur-2xl p-6 rounded-3xl border border-white shadow-[0_20px_40px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('admin.recentActivity')}</h3>
                    <button
                        onClick={onViewLogs}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] hover:text-indigo-400 transition-colors bg-indigo-50 px-3 py-2 rounded-xl"
                    >
                        {t('admin.viewAllLogs')}
                    </button>
                </div>
                <div className="space-y-3">
                    {(recentActivity || []).map((activity: ActivityLogEvent) => (
                        <div key={activity.id} className="flex items-center gap-4 p-3 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-50 group">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activity.type === 'new_user' ? 'bg-indigo-50 text-indigo-600' :
                                activity.type === 'new_task_event' ? 'bg-amber-50 text-amber-600' :
                                    'bg-emerald-50 text-emerald-600'
                                }`}>
                                {activity.type === 'new_user' ? <Users size={18} /> :
                                    activity.type === 'new_task_event' ? <ClipboardList size={18} /> :
                                        <HardDrive size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">
                                    {t(`admin.activityLog.${activity.type}`, activity.description)}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400">{activity.user}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                                    <span className="text-[10px] font-bold text-slate-300">{formatActivityDate(activity.timestamp)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {!recentActivity?.length && (
                        <div className="text-center py-10">
                            <p className="text-slate-300 font-black text-xs uppercase tracking-widest">{t('common.nothing_found')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Unit Distribution & System Health */}
            <div className="space-y-6">
                <div className="bg-white/70 backdrop-blur-2xl p-6 rounded-3xl border border-white shadow-[0_20px_40px_rgba(0,0,0,0.02)]">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight mb-6">{t('admin.unitDistribution')}</h3>
                    <div className="space-y-4">
                        {unitStats?.map((unit: UnitStat) => (
                            <div key={unit.name}>
                                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    <span>{unit.name}</span>
                                    <span className="text-slate-900">{unit.value}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                                        style={{ width: `${unit.value}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-3xl shadow-xl shadow-indigo-100 text-white relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        < Shield size={120} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-lg font-black tracking-tight mb-4 uppercase">{t('admin.systemHealth')}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3">
                                <p className="text-[10px] uppercase font-black opacity-60 mb-1">{t('admin.uptime')}</p>
                                <p className="text-base font-black tracking-tight">{systemHealth?.uptime || '99.9%'}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3">
                                <p className="text-[10px] uppercase font-black opacity-60 mb-1">{t('admin.systemHealth')}</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                    <span className="text-base font-black tracking-tight uppercase">{t('admin.systemStatus.optimal')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

interface UsersTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredUsers: User[];
    setEditingUser: (user: User | null) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteUserMutation: any; // Keep any for mutation for now as it's complex, or use UseMutationResult
}

const UsersTab = ({
    t, searchQuery, setSearchQuery,
    filteredUsers, setEditingUser, deleteUserMutation
}: UsersTabProps) => (
    <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] border border-white shadow-[0_25px_60px_rgba(0,0,0,0.03)] overflow-hidden animate-in transition-all-custom">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/30">
            <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder={t('admin.searchUsers')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-14 pr-6 py-4 bg-slate-100/50 border-none rounded-2xl text-sm font-black focus:ring-8 focus:ring-indigo-500/5 w-80 transition-all placeholder:text-slate-300"
                />
            </div>
            <div className="flex items-center gap-4">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {filteredUsers.length} {t('admin.totalUsers')}
                </span>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/10 border-b border-slate-100/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.user')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('common.unit')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">{t('admin.role')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.status')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/40">
                    {filteredUsers.map((user: User) => (
                        <tr key={user.id} className="hover:bg-indigo-50/20 transition-all duration-200 group border-b border-slate-100/30">
                            <td className="px-6 py-3">
                                <div className="flex items-center gap-4">
                                    <Avatar src={user.avatar_url} name={user.full_name || user.username} size="sm" className="border-2 border-white shadow-sm group-hover:scale-105 transition-transform duration-300" />
                                    <div className="min-w-0">
                                        <div className="font-black text-slate-900 text-sm leading-tight truncate group-hover:text-indigo-600 transition-colors">{user.full_name || user.username}</div>
                                        <div className="text-[10px] font-bold text-slate-400 truncate tracking-tight">@{user.username}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-3">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-slate-700 leading-none mb-0.5">
                                        {user.unit_name || user.unit?.name || t('admin.noUnit')}
                                    </span>
                                    {user.position && (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {user.position}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-3 text-center">
                                <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : user.role === 'operator' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                    {user.role === 'admin' ? t('admin.roleAdmin') : user.role === 'operator' ? t('admin.roleOperator') : t('admin.roleUser')}
                                </span>
                            </td>
                            <td className="px-6 py-3">
                                <div className="flex flex-col gap-1">
                                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${user.status === 'active' ? 'text-green-600 bg-green-50 border-green-100' :
                                        user.status === 'on_leave' ? 'text-amber-600 bg-amber-50 border-amber-100' :
                                            user.status === 'away' ? 'text-slate-500 bg-slate-50 border-slate-200' :
                                                'text-rose-600 bg-rose-50 border-rose-100'
                                        }`}>
                                        <span className={`w-1 h-1 rounded-full ${user.status === 'active' ? 'bg-green-500' :
                                            user.status === 'on_leave' ? 'bg-amber-500' :
                                                user.status === 'away' ? 'bg-slate-400' :
                                                    'bg-rose-500'
                                            }`} />
                                        {t(`admin.status${user.status.charAt(0).toUpperCase() + user.status.slice(1)}`)}
                                    </span>
                                    {!user.is_active && (
                                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest pl-2 flex items-center gap-1">
                                            <Shield size={8} />
                                            {t('admin.accessDenied')}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setEditingUser(user)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-hover"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => { if (window.confirm(t('admin.deleteConfirm'))) deleteUserMutation.mutate(user.id); }}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all shadow-hover"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

interface EditUnitModalProps {
    unit: Partial<Unit>;
    onClose: () => void;
    onSave: (data: Partial<Unit>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}

const EditUnitModal = ({ unit, onClose, onSave, t }: EditUnitModalProps) => {
    const [formData, setFormData] = useState({ name: unit.name || '', description: unit.description || '' });
    const isEdit = !!unit.id;
    const inputClasses = "w-full bg-slate-50/50 border border-slate-200/50 rounded-2xl px-5 py-3.5 font-semibold text-slate-700 placeholder:text-slate-300 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500/30 focus:bg-white transition-all duration-300 outline-none shadow-sm";
    const labelClasses = "text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 ml-1 block";

    return (
        <div className="flex flex-col h-full max-h-[90vh] bg-white/95 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
            <div className="p-10 border-b border-slate-100/60 flex justify-between items-center bg-white/40 sticky top-0 z-20">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-100/50">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{isEdit ? t('admin.editUnit') : t('admin.addUnit')}</h2>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{isEdit ? `#${unit.id}` : t('admin.newUnitDesc')}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="group relative w-12 h-12 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-2xl transition-all duration-300 active:scale-90"
                >
                    <XCircle size={28} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
            </div>

            <div className="p-10 flex-1 overflow-y-auto bg-slate-50/20 custom-scrollbar">
                <div className="space-y-8">
                    <div className="group">
                        <label className={labelClasses}>{t('common.name')}</label>
                        <input className={inputClasses} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t('common.name')} />
                    </div>
                    <div className="group">
                        <label className={labelClasses}>{t('common.description')}</label>
                        <textarea className={`${inputClasses} min-h-[160px] resize-none leading-relaxed`} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder={t('common.description')} />
                    </div>
                </div>
            </div>

            <div className="p-10 bg-white/40 border-t border-slate-100/60 flex justify-end gap-6">
                <button onClick={onClose} className="px-8 py-4 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] hover:text-slate-600 transition-colors">{t('common.cancel')}</button>
                <button
                    onClick={() => onSave(formData)}
                    disabled={!formData.name}
                    className="px-10 py-4 bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100/50 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                >
                    {isEdit ? t('common.save') : t('common.create')}
                </button>
            </div>
        </div>
    );
};

interface UnitsTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    units: Unit[] | undefined;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    setEditingUnit: (unit: Partial<Unit> | null) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteUnitMutation: any;
}

const UnitsTab = ({ t, units, searchQuery, setSearchQuery, setEditingUnit, deleteUnitMutation }: UnitsTabProps) => {
    const filteredUnits = units?.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.description?.toLowerCase().includes(searchQuery.toLowerCase())) || [];

    return (
        <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] border border-white shadow-[0_25px_60px_rgba(0,0,0,0.03)] overflow-hidden animate-in transition-all-custom">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/30">
                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder={t('admin.searchUnits')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-14 pr-6 py-4 bg-slate-100/50 border-none rounded-2xl text-sm font-black focus:ring-8 focus:ring-indigo-500/5 w-80 transition-all placeholder:text-slate-300"
                    />
                </div>
                <button
                    onClick={() => setEditingUnit({})}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-indigo-700 shadow-xl shadow-indigo-100/50 transition-all hover:-translate-y-1 active:scale-95"
                >
                    <Building2 size={18} />
                    {t('admin.addUnit')}
                </button>
            </div>

            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/10 border-b border-slate-100/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.unitName')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.unitDesc')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/30">
                    {filteredUnits.length > 0 ? filteredUnits.map((unit: Unit) => (
                        <tr key={unit.id} className="hover:bg-indigo-50/20 transition-all duration-200 group border-b border-slate-100/30">
                            <td className="px-6 py-3">
                                <span className="font-black text-slate-900 text-sm group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{unit.name}</span>
                            </td>
                            <td className="px-6 py-3">
                                <span className="text-[11px] font-bold text-slate-500 leading-tight block max-w-sm">{unit.description || '-'}</span>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setEditingUnit(unit)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-hover"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => { if (window.confirm(t('admin.deleteUnitConfirm'))) deleteUnitMutation.mutate(unit.id); }}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all shadow-hover"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={3} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <Building2 size={48} className="text-slate-100" />
                                <span className="text-slate-300 font-black text-[10px] uppercase tracking-widest">{t('admin.noUnitsFound')}</span>
                            </div>
                        </td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

interface SessionsTabProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    sessions: User[] | undefined;
    isLoading: boolean;
}

interface TasksTabProps {
    t: TFunction;
    stats: OverviewStats | undefined;
    taskUnitStats: TaskUnitStat[] | undefined;
    allTasks: (Task & { assignee?: User, issuer?: User })[] | undefined;
    isLoading: boolean;
    onDeleteTask: (taskId: number) => void;
}

const TasksTab = ({ t, stats, taskUnitStats, allTasks, isLoading, onDeleteTask }: TasksTabProps) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTasks = allTasks?.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assignee?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.issuer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const taskStatusData = [
        { name: t('admin.tasksCompleted'), value: stats?.tasks_completed || 0, color: '#10b981' },
        { name: t('admin.tasksInProgress'), value: stats?.tasks_in_progress || 0, color: '#6366f1' },
        { name: t('admin.tasksOnReview'), value: stats?.tasks_on_review || 0, color: '#f59e0b' },
        { name: t('admin.tasksOverdue'), value: stats?.tasks_overdue || 0, color: '#ef4444' },
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-6 animate-in transition-all-custom">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title={t('admin.tasksTotal')} value={stats?.tasks_total || 0} icon={<ClipboardList />} color="indigo" t={t} />
                <StatCard title={t('admin.tasksCompleted')} value={stats?.tasks_completed || 0} icon={<CheckCircle2 />} color="emerald" t={t} />
                <StatCard title={t('admin.tasksInProgress')} value={stats?.tasks_in_progress || 0} icon={<Clock />} color="violet" t={t} />
                <StatCard title={t('admin.tasksOnReview')} value={stats?.tasks_on_review || 0} icon={<RefreshCw />} color="amber" t={t} />
                <StatCard title={t('admin.tasksOverdue')} value={stats?.tasks_overdue || 0} icon={<AlertCircle />} color="rose" t={t} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/70 backdrop-blur-2xl p-6 rounded-3xl border border-white shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 mb-6">{t('admin.tasksByStatus')}</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                                <Pie
                                    data={taskStatusData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {taskStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-2xl p-6 rounded-3xl border border-white shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 mb-6">{t('admin.tasksByUnit')}</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={taskUnitStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} name={t('admin.tasksTotal')} />
                                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name={t('admin.tasksCompleted')} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] border border-white shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/30">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder={t('common.search_placeholder')}
                            className="pl-14 pr-6 py-4 bg-slate-100/50 border-none rounded-2xl text-sm font-black w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left order-collapse">
                        <thead>
                            <tr className="bg-slate-50/30 border-b border-slate-100/60">
                                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('common.name')}</th>
                                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.issuer')}</th>
                                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.assignee')}</th>
                                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.status')}</th>
                                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.deadline')}</th>
                                <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40">
                            {isLoading ? (
                                <tr><td colSpan={6} className="px-10 py-20 text-center"><RefreshCw className="animate-spin mx-auto text-indigo-500" /></td></tr>
                            ) : filteredTasks.map((task) => (
                                <tr key={task.id} className="hover:bg-indigo-50/30 transition-all duration-300 group">
                                    <td className="px-10 py-6 font-black text-slate-900">{task.title}</td>
                                    <td className="px-10 py-6 text-sm font-bold text-slate-600">{task.issuer?.full_name || task.issuer?.username}</td>
                                    <td className="px-10 py-6 text-sm font-bold text-slate-600">{task.assignee?.full_name || task.assignee?.username}</td>
                                    <td className="px-10 py-6">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${task.status === 'completed' ? 'bg-green-50 text-green-600 border border-green-100' :
                                            task.status === 'overdue' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                                task.status === 'on_review' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                    'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                            }`}>
                                            {t(`tasks.status.${task.status}`, task.status)}
                                        </span>
                                    </td>
                                    <td className="px-10 py-6 text-sm font-bold text-slate-500">{new Date(task.deadline).toLocaleDateString()}</td>
                                    <td className="px-10 py-6 text-right">
                                        <button
                                            onClick={() => { if (window.confirm(t('admin.deleteTaskConfirm'))) onDeleteTask(task.id); }}
                                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const SessionsTab = ({ t, sessions, isLoading }: SessionsTabProps) => (
    <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] border border-white shadow-[0_25px_60px_rgba(0,0,0,0.03)] overflow-hidden animate-in transition-all-custom">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/30">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
                {t('admin.activeSessions')}
                <span className="px-4 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-emerald-100 animate-pulse">
                    {sessions?.length || 0} {t('common.online').toUpperCase()}
                </span>
            </h3>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/10 border-b border-slate-100/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.user')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('common.unit')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('admin.sessionDuration')}</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">{t('admin.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/30">
                    {isLoading ? (
                        <tr><td colSpan={4} className="px-6 py-12 text-center">
                            <div className="animate-spin inline-block w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full" />
                        </td></tr>
                    ) : sessions && sessions.length > 0 ? sessions.map((user) => (
                        <tr key={user.id} className="hover:bg-indigo-50/20 transition-all duration-200 group border-b border-slate-100/30">
                            <td className="px-6 py-3">
                                <div className="flex items-center gap-4">
                                    <Avatar src={user.avatar_url || undefined} name={user.full_name || user.username} size="sm" className="border-2 border-white shadow-sm group-hover:scale-105 transition-transform duration-300" />
                                    <div className="min-w-0">
                                        <div className="font-black text-slate-900 text-sm leading-tight truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user.full_name || user.username}</div>
                                        <div className="text-[10px] font-bold text-slate-400 truncate tracking-tight">@{user.username}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-3">
                                <span className="text-[10px] font-black text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/50 uppercase tracking-tighter shadow-sm">
                                    {user.unit_name || user.unit?.name || t('admin.noUnit')}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-[11px] font-bold text-slate-500">
                                <span className="flex items-center gap-1.5 text-indigo-600">
                                    <Clock size={12} strokeWidth={3} />
                                    {formatDuration(new Date(user.session_start || user.last_seen || new Date()))}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <button className="px-4 py-1.5 bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95">
                                    {t('common.delete')}
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={4} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <Activity size={48} className="text-slate-100" />
                                <span className="text-slate-300 font-black text-[10px] uppercase tracking-widest">{t('admin.noActiveSessions')}</span>
                            </div>
                        </td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const DatabaseSettingsTab = ({ t }: { t: any }) => {
    const { addToast } = useToast();
    const [config, setConfig] = useState<any>({
        type: 'sqlite',
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'teamchat'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const { data } = await api.get('/admin/database/config');
            setConfig({
                ...data,
                // Ensure defaults if missing
                port: data.port || 3306,
                type: data.type || 'sqlite'
            });
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: t('common.error'), message: t('admin.database.loadFailed') });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        try {
            await api.post('/admin/database/test', config);
            addToast({ type: 'success', title: t('common.success'), message: t('admin.database.connectionSuccess') });
        } catch (error: any) {
            addToast({
                type: 'error',
                title: t('common.error'),
                message: error.response?.data?.detail || t('admin.database.connectionFailed')
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!confirm(t('admin.database.restartConfirm'))) return;

        setIsSaving(true);
        try {
            await api.post('/admin/database/save', config);
            addToast({ type: 'success', title: t('common.saved'), message: t('admin.database.restartNote') });
        } catch (error: any) {
            addToast({
                type: 'error',
                title: t('common.error'),
                message: error.response?.data?.detail || t('admin.database.saveFailed')
            });
        } finally {
            setIsSaving(false);
        }
    };

    const inputClasses = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none";
    const labelClasses = "block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 ml-1";

    if (isLoading) return <div className="p-10 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" /></div>;

    return (
        <div className="bg-white/70 backdrop-blur-md p-8 rounded-[2rem] border border-white shadow-[0_25px_60px_rgba(0,0,0,0.02)] max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                    <div className="w-5 h-5"><Database size={20} /></div>
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 leading-none tracking-tight">{t('admin.database.title')}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">{t('admin.database.desc')}</p>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className={labelClasses}>{t('admin.database.engine')}</label>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setConfig({ ...config, type: 'sqlite' })}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${config.type === 'sqlite'
                                ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700'
                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                }`}
                        >
                            <span className="font-black text-lg">SQLite</span>
                            <span className="text-[10px] uppercase font-bold opacity-60">{t('admin.database.embedded')}</span>
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, type: 'mysql' })}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${config.type === 'mysql'
                                ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700'
                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                }`}
                        >
                            <span className="font-black text-lg">MySQL</span>
                            <span className="text-[10px] uppercase font-bold opacity-60">{t('admin.database.external')}</span>
                        </button>
                    </div>
                </div>

                {config.type === 'mysql' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className={labelClasses}>{t('admin.database.host')}</label>
                                <input
                                    className={inputClasses}
                                    value={config.host || ''}
                                    onChange={e => setConfig({ ...config, host: e.target.value })}
                                    placeholder="localhost"
                                />
                            </div>
                            <div>
                                <label className={labelClasses}>{t('admin.database.port')}</label>
                                <input
                                    type="number"
                                    className={inputClasses}
                                    value={config.port || ''}
                                    onChange={e => setConfig({ ...config, port: parseInt(e.target.value) || 3306 })}
                                    placeholder="3306"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>{t('admin.database.username')}</label>
                                <input
                                    className={inputClasses}
                                    value={config.user || ''}
                                    onChange={e => setConfig({ ...config, user: e.target.value })}
                                    placeholder="root"
                                />
                            </div>
                            <div>
                                <label className={labelClasses}>{t('admin.database.password')}</label>
                                <input
                                    type="password"
                                    className={inputClasses}
                                    value={config.password || ''}
                                    onChange={e => setConfig({ ...config, password: e.target.value })}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClasses}>{t('admin.database.dbName')}</label>
                            <input
                                className={inputClasses}
                                value={config.database || ''}
                                onChange={e => setConfig({ ...config, database: e.target.value })}
                                placeholder="teamchat_db"
                            />
                        </div>
                    </div>
                )}

                {config.type === 'sqlite' && (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 font-medium">
                        {t('admin.database.sqliteDesc')}
                    </div>
                )}

                <div className="pt-6 border-t border-slate-100 flex gap-4">
                    <button
                        onClick={handleTest}
                        disabled={isTesting || config.type === 'sqlite'}
                        className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isTesting ? t('admin.database.testing') : t('admin.database.testConnection')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {isSaving ? t('admin.database.saving') : t('admin.database.saveRestart')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AppSettingsTab = ({ t, visibleGroup }: { t: any, visibleGroup?: string }) => {
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery<SystemSetting[]>({
        queryKey: ['system-settings'],
        queryFn: async () => (await api.get('/admin/settings')).data
    });

    const updateMutation = useMutation({
        mutationFn: async ({ key, value }: { key: string, value: any }) => {
            return api.patch(`/admin/settings/${key}`, { value });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-settings'] });
            addToast({ type: 'success', title: 'Сохранено', message: 'Настройка обновлена' });
        }
    });

    const groups = React.useMemo(() => {
        if (!settings) return {};
        // Order: general, security, chat, email
        const order = ['general', 'security', 'chat', 'email'];
        const grouped = settings.reduce((acc, setting) => {
            if (!acc[setting.group]) acc[setting.group] = [];
            acc[setting.group].push(setting);
            return acc;
        }, {} as Record<string, SystemSetting[]>);

        // Sort keys by order if present, else append
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });

        const sortedGroups: Record<string, SystemSetting[]> = {};
        sortedKeys.forEach(k => {
            if (!visibleGroup || k === visibleGroup) {
                sortedGroups[k] = grouped[k];
            }
        });
        return sortedGroups;
    }, [settings, visibleGroup]);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center py-32">
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin" />
            <span className="mt-4 text-slate-400 font-black text-xs uppercase tracking-widest animate-pulse">{t('common.loading')}</span>
        </div>
    );

    return (
        <div className="space-y-8 animate-in transition-all-custom">
            {Object.entries(groups).map(([group, groupSettings]) => (
                <div key={group} className="bg-white/70 backdrop-blur-md p-8 rounded-[2rem] border border-white shadow-[0_25px_60px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-4 mb-8">
                        <div className={`p-3 rounded-2xl ${group === 'general' ? 'bg-indigo-50 text-indigo-600' :
                            group === 'security' ? 'bg-rose-50 text-rose-600' :
                                group === 'chat' ? 'bg-teal-50 text-teal-600' :
                                    group === 'email' ? 'bg-violet-50 text-violet-600' :
                                        'bg-slate-100 text-slate-600'
                            }`}>
                            {group === 'general' ? <Sliders size={20} /> :
                                group === 'security' ? <Shield size={20} /> :
                                    group === 'chat' ? <MessageSquare size={20} /> :
                                        <Settings size={20} />}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 leading-none tracking-tight capitalize">
                            {t(`settings.groups.${group}`, group)}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
                        {groupSettings.map(setting => (
                            <SettingField
                                key={setting.key}
                                setting={setting}
                                onUpdate={(val) => updateMutation.mutate({ key: setting.key, value: val })}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const SettingField = ({ setting, onUpdate, t }: { setting: SystemSetting, onUpdate: (val: any) => void, t: any }) => {
    // Parse initial value carefully
    const parseVal = (s: SystemSetting) => {
        if (s.type === 'bool') return s.value.toLowerCase() === 'true';
        if (s.type === 'int') return parseInt(s.value as string) || 0;
        return s.value;
    };

    const [val, setVal] = useState(parseVal(setting));
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setVal(parseVal(setting));
        setIsDirty(false);
    }, [setting]);

    const handleChange = (newVal: any) => {
        setVal(newVal);
        setIsDirty(true);
        // Auto-save bools immediately
        if (setting.type === 'bool') {
            onUpdate(newVal);
            setIsDirty(false); // Reset dirty since we saved
        }
    };

    const handleBlur = () => {
        if (isDirty && setting.type !== 'bool') {
            onUpdate(val);
            setIsDirty(false);
        }
    };

    return (
        <div className="group">
            <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">
                    {setting.description || setting.key}
                </label>
                {setting.is_public && (
                    <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50 uppercase tracking-wider">Public</span>
                )}
            </div>

            {setting.type === 'bool' ? (
                <button
                    onClick={() => handleChange(!val)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${val
                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                >
                    <span className="text-sm font-bold">{val ? t('common.enabled') : t('common.disabled')}</span>
                    <div className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${val ? 'bg-indigo-500' : 'bg-slate-300'} flex items-center`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${val ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </button>
            ) : (
                <div className="relative">
                    <input
                        type={setting.type === 'int' ? 'number' : 'text'}
                        value={val as string}
                        onChange={(e) => handleChange(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
                        className={`w-full bg-slate-50 border rounded-2xl px-5 py-4 font-bold text-slate-700 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all outline-none ${isDirty ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
                            }`}
                    />
                    {isDirty && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 animate-pulse">
                            <Save size={16} />
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

const AdminDashboard: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingUnit, setEditingUnit] = useState<Partial<Unit> | null>(null);
    const [isLogsOpen, setIsLogsOpen] = useState(false);

    const { data: stats } = useQuery<OverviewStats>({ queryKey: ['admin-stats'], queryFn: async () => (await api.get('/admin/stats/overview')).data });
    const { data: activityData } = useQuery<ActivityStat[]>({ queryKey: ['admin-activity'], queryFn: async () => (await api.get('/admin/stats/activity')).data });
    const { data: storageData } = useQuery<StorageStat[]>({ queryKey: ['admin-storage'], queryFn: async () => (await api.get('/admin/stats/storage')).data });
    const { data: unitStats } = useQuery<UnitStat[]>({ queryKey: ['admin-unit-stats'], queryFn: async () => (await api.get('/admin/stats/units')).data });
    const { data: recentActivity } = useQuery<ActivityLogEvent[]>({ queryKey: ['admin-recent-activity'], queryFn: async () => (await api.get('/admin/activity')).data });
    const { data: systemHealth } = useQuery<SystemHealth>({
        queryKey: ['admin-system-health'],
        queryFn: async () => (await api.get('/admin/stats/health')).data,
        refetchInterval: 30000 // Poll every 30 seconds
    });

    const { data: users } = useQuery<User[]>({ queryKey: ['admin-users'], queryFn: async () => (await api.get('/auth/users')).data });
    const { data: units } = useQuery<Unit[]>({ queryKey: ['admin-units'], queryFn: async () => (await api.get('/auth/units')).data });
    const { data: activeSessions, isLoading: isLoadingSessions } = useQuery<User[]>({ queryKey: ['admin-sessions'], queryFn: async () => (await api.get('/admin/active-sessions')).data, refetchInterval: 30000 });
    const { data: taskUnitStats } = useQuery<TaskUnitStat[]>({ queryKey: ['admin-task-unit-stats'], queryFn: async () => (await api.get('/admin/stats/tasks/units')).data, enabled: activeTab === 'tasks' });
    const { data: allTasks, isLoading: isLoadingTasks } = useQuery<(Task & { assignee?: User, issuer?: User })[]>({ queryKey: ['admin-all-tasks'], queryFn: async () => (await api.get('/admin/tasks')).data, enabled: activeTab === 'tasks' });

    const createUnitMutation = useMutation({
        mutationFn: (data: Partial<Unit>) => api.post('/auth/units', data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-units'] }); addToast({ type: 'success', title: t('common.success'), message: t('admin.unitCreated') }); setEditingUnit(null); }
    });
    const updateUnitMutation = useMutation({
        mutationFn: ({ unitId, data }: { unitId: number; data: Partial<Unit> }) => api.patch(`/auth/units/${unitId}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-units'] }); addToast({ type: 'success', title: t('common.success'), message: t('admin.unitUpdated') }); setEditingUnit(null); }
    });
    const deleteUnitMutation = useMutation({
        mutationFn: (unitId: number) => api.delete(`/auth/units/${unitId}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-units'] }); addToast({ type: 'success', title: t('common.success'), message: t('admin.unitDeleted') }); }
    });

    const deleteUserMutation = useMutation({
        mutationFn: (userId: number) => api.delete(`/auth/users/${userId}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); addToast({ type: 'success', title: t('common.deleted'), message: t('admin.userDeleted') }); }
    });
    const updateUserMutation = useMutation({
        mutationFn: ({ userId, data }: { userId: number; data: Partial<User> }) => api.patch(`/auth/users/${userId}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); addToast({ type: 'success', title: t('common.saved'), message: t('admin.userUpdated') }); setEditingUser(null); }
    });
    const resetPasswordMutation = useMutation({
        mutationFn: ({ userId, password }: { userId: number; password: string }) => api.post(`/auth/users/${userId}/password`, { new_password: password }),
        onSuccess: () => { addToast({ type: 'success', title: t('common.success'), message: t('admin.passwordUpdated') }); }
    });
    const deleteTaskMutation = useMutation({
        mutationFn: (taskId: number) => api.delete(`/tasks/${taskId}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-all-tasks'] }); queryClient.invalidateQueries({ queryKey: ['admin-stats'] }); addToast({ type: 'success', title: t('common.deleted'), message: t('tasks.deleted') }); }
    });

    const filteredUsers = users?.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    }) || [];

    return (
        <div className="flex-1 flex flex-col bg-slate-50/40 overflow-hidden h-screen font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <div className="px-6 pt-4 pb-2 shrink-0 z-30 sticky top-0 pointer-events-none">
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-4 rounded-2xl shadow-2xl shadow-slate-200/50 pointer-events-auto transition-all duration-300 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 hover:scale-105 transition-transform duration-300">
                                <Shield size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight">
                                    {t('admin.dashboard')}
                                </h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-0.5">
                                    {t('admin.systemControl')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-[-8px]">
                        <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
                            {[
                                { id: 'overview', icon: Activity, label: t('admin.overview') },
                                { id: 'units', icon: Building2, label: t('admin.units') },
                                { id: 'users', icon: Users, label: t('admin.users') },
                                { id: 'tasks', icon: ClipboardList, label: t('admin.tasks') },
                                { id: 'sessions', icon: BarChart2, label: t('admin.sessions') },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab === tab.id
                                        ? 'bg-white text-indigo-600 shadow-md'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                        }`}
                                >
                                    <tab.icon size={13} />
                                    <div className="w-px h-3 bg-current opacity-20" />
                                    <span>{tab.label}</span>
                                </button>
                            ))}

                            {/* Settings Dropdown */}
                            <div className="relative group z-50">
                                <button
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab.startsWith('settings')
                                        ? 'bg-white text-indigo-600 shadow-md'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                        }`}
                                >
                                    <Sliders size={13} />
                                    <div className="w-px h-3 bg-current opacity-20" />
                                    <span>{t('admin.settings')}</span>
                                </button>

                                <div className="absolute top-full right-0 mt-2 w-48 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0">
                                    {[
                                        { id: 'general', label: t('settings.groups.general'), icon: Sliders },
                                        { id: 'security', label: t('settings.groups.security'), icon: Shield },
                                        { id: 'chat', label: t('settings.groups.chat'), icon: MessageSquare },
                                        { id: 'email', label: t('settings.groups.email'), icon: Settings },
                                        { id: 'database', label: t('settings.groups.database'), icon: Database }
                                    ].map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => setActiveTab(`settings_${sub.id}`)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === `settings_${sub.id}`
                                                ? 'bg-indigo-50 text-indigo-600'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                        >
                                            <div className={`p-1.5 rounded-lg ${activeTab === `settings_${sub.id}` ? 'bg-white shadow-sm' : 'bg-slate-100'
                                                }`}>
                                                <sub.icon size={12} />
                                            </div>
                                            {sub.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto pb-20">
                    {activeTab === 'overview' && (
                        <OverviewTab
                            t={t}
                            stats={stats}
                            activityData={activityData}
                            storageData={storageData}
                            unitStats={unitStats}
                            recentActivity={recentActivity}
                            systemHealth={systemHealth}
                            onViewLogs={() => setIsLogsOpen(true)}
                        />
                    )}
                    {activeTab === 'users' && <UsersTab t={t} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filteredUsers={filteredUsers} setEditingUser={setEditingUser} deleteUserMutation={deleteUserMutation} />}
                    {activeTab === 'tasks' && <TasksTab t={t} stats={stats} taskUnitStats={taskUnitStats} allTasks={allTasks} isLoading={isLoadingTasks} onDeleteTask={(id) => deleteTaskMutation.mutate(id)} />}
                    {activeTab === 'units' && <UnitsTab t={t} units={units} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setEditingUnit={setEditingUnit} deleteUnitMutation={deleteUnitMutation} />}
                    {activeTab === 'sessions' && <SessionsTab t={t} sessions={activeSessions} isLoading={isLoadingSessions} />}
                    {activeTab === 'settings_database' && <DatabaseSettingsTab t={t} />}
                    {activeTab.startsWith('settings') && activeTab !== 'settings_database' && <AppSettingsTab t={t} visibleGroup={activeTab.split('_')[1]} />}
                </div>
            </main>

            {editingUser && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-in fade-in duration-500">
                    <div className="bg-transparent w-full max-w-2xl max-h-[95vh] outline-none transform scale-100" onClick={e => e.stopPropagation()}>
                        <EditUserModal user={editingUser} units={units || []} onClose={() => setEditingUser(null)} onSave={(id: number, data: Partial<User>) => updateUserMutation.mutate({ userId: id, data })} onResetPassword={(id: number, pass: string) => resetPasswordMutation.mutate({ userId: id, password: pass })} t={t} />
                    </div>
                </div>
            )}
            {editingUnit && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-in fade-in duration-500">
                    <div className="bg-transparent w-full max-w-lg max-h-[95vh] outline-none" onClick={e => e.stopPropagation()}>
                        <EditUnitModal unit={editingUnit} onClose={() => setEditingUnit(null)} onSave={(data: Partial<Unit>) => { if (editingUnit.id) updateUnitMutation.mutate({ unitId: editingUnit.id as number, data }); else createUnitMutation.mutate(data); }} t={t} />
                    </div>
                </div>
            )}
            {isLogsOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-in fade-in duration-500">
                    <div className="bg-transparent w-full max-w-3xl max-h-[90vh] overflow-hidden outline-none" onClick={e => e.stopPropagation()}>
                        <LogsModal onClose={() => setIsLogsOpen(false)} t={t} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;

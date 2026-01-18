import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { User, Bell, Lock, Eye, Shield, Briefcase, Calendar, Server, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import api from '../../api/client';
import { AxiosError } from 'axios';
import { useToast } from '../../components/ToastContext';

import Avatar from '../../components/Avatar';
import { Header, Modal, Input, Button } from '../../design-system';

const SettingsPage: React.FC = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const { addToast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [activeSection, setActiveSection] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState({
        full_name: user?.full_name || '',
        phone_number: user?.phone_number || '',
        cabinet: user?.cabinet || '',
        rank: user?.rank || '',
        position: user?.position || '',
        birth_date: user?.birth_date ? new Date(user.birth_date).toISOString().split('T')[0] : '',
    });

    React.useEffect(() => {
        if (user) {
            setFormData({
                full_name: user.full_name || '',
                phone_number: user.phone_number || '',
                cabinet: user.cabinet || '',
                rank: user.rank || '',
                position: user.position || '',
                birth_date: user.birth_date ? new Date(user.birth_date).toISOString().split('T')[0] : '',
            });
        }
    }, [user]);

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/auth/users/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data;
        },
        onSuccess: (updatedUser) => {
            updateUser(updatedUser);
            addToast({
                type: 'success',
                title: t('settings.profileUpdated'),
                message: t('settings.photoUpdated'),
                duration: 4000
            });
        },
        onError: (error: unknown) => {
            const err = error as AxiosError<{ detail: string }>;
            addToast({
                type: 'error',
                title: t('common.error'),
                message: err.response?.data?.detail || t('settings.errorPhoto'),
            });
        }
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (data: Partial<typeof formData> & { notify_browser?: boolean; notify_sound?: boolean; notify_email?: boolean; preferences?: Record<string, unknown> }) => {
            const res = await api.patch('/auth/me', data);
            return res.data;
        },
        onSuccess: (updatedUser) => {
            updateUser(updatedUser);
            addToast({
                type: 'success',
                title: t('settings.settingsUpdated'),
                message: t('settings.changesSaved'),
            });
            // Only close if it was a form submission (full profile update), not a toggle
            if (Object.keys(updatedUser).some(k => ['full_name', 'cabinet'].includes(k)) && activeSection === 'account') {
                setActiveSection(null);
            }
        },
        onError: (error: unknown) => {
            const err = error as AxiosError<{ detail: string }>;
            addToast({
                type: 'error',
                title: t('common.error'),
                message: err.response?.data?.detail || t('settings.errorSettings'),
            });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadMutation.mutate(file);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(formData);
    };

    const sections = [
        {
            id: 'general',
            title: t('settings.general') || 'Общие',
            icon: Eye,
            desc: t('settings.generalDesc') || 'Внешний вид и поведение',
            onClick: () => setActiveSection('general')
        },
        {
            id: 'account',
            title: t('settings.account'),
            icon: User,
            desc: t('settings.accountDesc'),
            onClick: () => setActiveSection('account')
        },
        { id: 'notifications', title: t('settings.notifications'), icon: Bell, desc: t('settings.notificationsDesc'), onClick: () => setActiveSection('notifications') },
        { id: 'privacy', title: t('settings.privacy'), icon: Lock, desc: t('settings.privacyDesc'), onClick: () => setActiveSection('privacy') },
        { id: 'permissions', title: t('settings.permissions'), icon: Shield, desc: t('settings.permissionsDesc') },
        { id: 'permissions', title: t('settings.permissions'), icon: Shield, desc: t('settings.permissionsDesc') },
        ...(window.electron ? [{
            id: 'system',
            title: t('settings.system_integration'),
            icon: Server,
            desc: t('settings.system_integration_desc'),
            onClick: () => setActiveSection('system')
        }] : []),
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 animate-in fade-in duration-300">
            {/* Header with Design System */}
            <div className="px-6 pt-4 pb-2 shrink-0 z-20 sticky top-0 pointer-events-none">
                <Header
                    title={t('settings.title')}
                    subtitle={t('settings.subtitle', 'Персонализация')}
                    icon={<SettingsIcon size={20} />}
                    iconColor="indigo"
                    sticky={false}
                    className="pointer-events-auto"
                />
            </div>


            <div className="p-8 max-w-4xl">
                <div className="flex items-center space-x-6 mb-12 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                    />
                    <div
                        className="relative group cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Avatar
                            src={user?.avatar_url}
                            name={user?.full_name || user?.username || ''}
                            size="xl"
                            className="shadow-xl shadow-indigo-200"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black uppercase text-white tracking-widest">{t('settings.change')}</span>
                        </div>
                        {uploadMutation.isPending && (
                            <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{user?.full_name || user?.username}</h2>
                        <p className="text-gray-600">{user?.email}</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 text-sm text-indigo-600 font-medium hover:text-indigo-700 active:scale-95 transition-transform"
                        >
                            {t('settings.changePhoto')}
                        </button>
                    </div>

                </div>

                <div className="space-y-4">
                    {sections.map((section) => (
                        <div
                            key={section.id}
                            onClick={section.onClick}
                            className="flex items-center p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
                        >
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                                <section.icon size={20} />
                            </div>
                            <div className="ml-4 flex-1">
                                <h3 className="font-bold text-gray-900">{section.title}</h3>
                                <p className="text-sm text-gray-500">{section.desc}</p>
                            </div>
                            <div className="text-gray-300">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Account Settings Modal */}
            {activeSection === 'account' && (
                <Modal
                    isOpen={true}
                    onClose={() => setActiveSection(null)}
                    title={t('settings.account')}
                    size="md"
                    footer={
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => setActiveSection(null)}
                                fullWidth
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleFormSubmit}
                                loading={updateProfileMutation.isPending}
                                fullWidth
                            >
                                {updateProfileMutation.isPending ? t('settings.saving') : t('common.save')}
                            </Button>
                        </>
                    }
                >
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <Input
                            label={t('common.fullName')}
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder={t('settings.name_placeholder')}
                            fullWidth
                        />
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                            <div className="px-5 py-3 bg-gray-50 border border-gray-100 rounded-xl font-medium text-gray-500 shadow-sm cursor-not-allowed flex items-center justify-between">
                                <span>{user?.email}</span>
                                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest bg-indigo-50 px-2 py-0.5 rounded">{t('settings.email_system')}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1.5 px-1 font-medium">{t('settings.email_system_desc')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={t('common.cabinet')}
                                value={formData.cabinet}
                                onChange={(e) => setFormData({ ...formData, cabinet: e.target.value })}
                                placeholder="301"
                            />
                            <div className="col-span-2">
                                <Input
                                    label={t('common.rank') || 'Rank'}
                                    value={formData.rank}
                                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                                    placeholder={t('settings.rank_placeholder') || 'Lieutenant'}
                                    fullWidth
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    label={t('common.phoneNumber')}
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    placeholder="+7..."
                                    fullWidth
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    label={t('common.position') || 'Должность'}
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    placeholder={t('common.position') || 'Напр. Программист'}
                                    leftIcon={<Briefcase size={16} />}
                                    fullWidth
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    label={t('common.birthDate') || 'Дата рождения'}
                                    type="date"
                                    value={formData.birth_date}
                                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                    leftIcon={<Calendar size={16} />}
                                    fullWidth
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}
            {/* Notification Settings Modal */}
            {
                activeSection === 'notifications' && (
                    <Modal
                        isOpen={true}
                        onClose={() => setActiveSection(null)}
                        title={
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                    <Bell size={24} />
                                </div>
                                <span>{t('settings.notifications')}</span>
                            </div>
                        }
                        size="md"
                    >
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-900">{t('settings.browser_notifications.title')}</h3>
                                    <p className="text-sm text-gray-500">{t('settings.browser_notifications.desc')}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={user?.notify_browser ?? true}
                                        onChange={(e) => updateProfileMutation.mutate({ notify_browser: e.target.checked })}
                                        disabled={updateProfileMutation.isPending}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-900">{t('settings.sound_notifications.title')}</h3>
                                    <p className="text-sm text-gray-500">{t('settings.sound_notifications.desc')}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={user?.notify_sound ?? true}
                                        onChange={(e) => updateProfileMutation.mutate({ notify_sound: e.target.checked })}
                                        disabled={updateProfileMutation.isPending}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-900">{t('settings.email_notifications.title')}</h3>
                                    <p className="text-sm text-gray-500">{t('settings.email_notifications.desc')}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={user?.notify_email ?? false}
                                        onChange={(e) => updateProfileMutation.mutate({ notify_email: e.target.checked })}
                                        disabled={updateProfileMutation.isPending}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                    </Modal>
                )
            }

            {/* Privacy & Security Modal */}
            {
                activeSection === 'privacy' && (
                    <Modal
                        isOpen={true}
                        onClose={() => setActiveSection(null)}
                        title={
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                                    <Shield size={24} />
                                </div>
                                <span>{t('settings.privacy')}</span>
                            </div>
                        }
                        size="md"
                    >
                        <div className="space-y-6">
                            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex items-start gap-3">
                                <Lock className="text-orange-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <h3 className="font-bold text-orange-900 text-sm">{t('settings.security_title')}</h3>
                                    <p className="text-xs text-orange-700/80 mt-1 leading-relaxed">
                                        {t('settings.security_desc')}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setActiveSection('change-password')}
                                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-white border border-gray-200 hover:border-indigo-200 hover:shadow-md rounded-xl transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-500 group-hover:text-indigo-600 transition-colors shadow-sm">
                                        <Lock size={20} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{t('settings.change_password')}</h3>
                                        <p className="text-xs text-gray-500">{t('settings.update_password_desc')}</p>
                                    </div>
                                </div>
                                <div className="text-gray-300 group-hover:text-indigo-400 transition-colors">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </Modal>
                )
            }

            {/* System Settings Modal */}


            {/* General Settings Modal */}
            {activeSection === 'general' && (
                <Modal
                    isOpen={true}
                    onClose={() => setActiveSection(null)}
                    title={
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                <Eye size={24} />
                            </div>
                            <span>{t('settings.general') || 'Общие настройки'}</span>
                        </div>
                    }
                    size="md"
                >
                    <div className="space-y-6">
                        {/* Start Page */}
                        <div>
                            <h3 className="font-bold text-gray-900 mb-2">{t('settings.start_page')}</h3>
                            <select
                                value={user?.preferences?.start_page || 'chat'}
                                onChange={(e) => updateProfileMutation.mutate({ preferences: { ...user?.preferences, start_page: e.target.value } })}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                            >
                                <option value="chat">{t('settings.start_page_chat')}</option>
                                <option value="company">{t('settings.start_page_company')}</option>
                                <option value="board">{t('settings.start_page_board')}</option>
                                <option value="tasks">{t('settings.start_page_tasks')}</option>
                                <option value="archive">{t('settings.start_page_archive')}</option>
                                <option value="email">{t('settings.start_page_email')}</option>
                            </select>
                        </div>

                        {/* Chat Settings */}
                        <div>
                            <h3 className="font-bold text-gray-900 mb-3">{t('settings.chat_settings')}</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-700">{t('settings.enter_to_send')}</p>
                                        <p className="text-xs text-gray-500">{t('settings.enter_to_send_desc')}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={user?.preferences?.enter_to_send ?? true}
                                            onChange={(e) => updateProfileMutation.mutate({ preferences: { ...user?.preferences, enter_to_send: e.target.checked } })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div>
                                    <p className="font-medium text-gray-700 mb-2">{t('settings.font_size')}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['small', 'medium', 'large'].map((size) => (
                                            <button
                                                key={size}
                                                onClick={() => updateProfileMutation.mutate({ preferences: { ...user?.preferences, font_size: size } })}
                                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${(user?.preferences?.font_size || 'medium') === size
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-500/20'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {size === 'small' ? t('settings.font_size_small') : size === 'medium' ? t('settings.font_size_medium') : t('settings.font_size_large')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tasks Settings */}
                        <div>
                            <h3 className="font-bold text-gray-900 mb-2">{t('settings.tasks_settings')}</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-700">{t('settings.tasks_view')}</p>
                                </div>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => updateProfileMutation.mutate({ preferences: { ...user?.preferences, tasks_view: 'list' } })}
                                        className={`px-3 py-1 text-sm rounded-md transition-all ${(user?.preferences?.tasks_view || 'list') === 'list'
                                            ? 'bg-white shadow text-gray-900 font-medium'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {t('settings.tasks_view_list')}
                                    </button>
                                    <button
                                        onClick={() => updateProfileMutation.mutate({ preferences: { ...user?.preferences, tasks_view: 'board' } })}
                                        className={`px-3 py-1 text-sm rounded-md transition-all ${(user?.preferences?.tasks_view) === 'board'
                                            ? 'bg-white shadow text-gray-900 font-medium'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {t('settings.tasks_view_board')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Change Password Modal */}
            {
                activeSection === 'change-password' && (
                    <ChangePasswordModal onClose={() => setActiveSection('privacy')} />
                )
            }
        </div >
    );
};

const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [passwordData, setPasswordData] = React.useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });

    const changePasswordMutation = useMutation({
        mutationFn: async (data: typeof passwordData) => {
            const res = await api.post('/auth/change-password', {
                current_password: data.current_password,
                new_password: data.new_password
            });
            return res.data;
        },
        onSuccess: () => {
            addToast({
                type: 'success',
                title: t('common.success'),
                message: t('password.success'),
                duration: 4000
            });
            onClose();
        },
        onError: (error: unknown) => {
            const err = error as AxiosError<{ detail: string }>;
            addToast({
                type: 'error',
                title: t('common.error'),
                message: err.response?.data?.detail || t('password.error'),
                duration: 4000
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            addToast({
                type: 'error',
                title: t('common.error'),
                message: t('password.mismatch'),
                duration: 4000
            });
            return;
        }
        if (passwordData.new_password.length < 6) {
            addToast({
                type: 'error',
                title: t('common.error'),
                message: t('password.tooShort'),
                duration: 4000
            });
            return;
        }
        changePasswordMutation.mutate(passwordData);
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                        <Lock size={24} />
                    </div>
                    <span>{t('password.title')}</span>
                </div>
            }
            size="md"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        fullWidth
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={changePasswordMutation.isPending}
                        fullWidth
                    >
                        {changePasswordMutation.isPending ? t('settings.saving') : t('settings.change')}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    type="password"
                    label={t('password.current')}
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    placeholder="••••••••"
                    required
                    fullWidth
                />
                <Input
                    type="password"
                    label={t('password.new')}
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    placeholder="••••••••"
                    required
                    fullWidth
                />
                <Input
                    type="password"
                    label={t('password.confirm')}
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    placeholder="••••••••"
                    required
                    fullWidth
                />
            </form>
        </Modal>
    );
};


export default SettingsPage;

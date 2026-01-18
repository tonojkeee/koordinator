import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Mail, Phone, Building2, Calendar, MessageSquare, Briefcase } from 'lucide-react';
import type { User } from '../../../types';
import Avatar from '../../../components/Avatar';
import { useTranslation } from 'react-i18next';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onStartDM: (id: number) => void;
    currentUser: User | null;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen,
    onClose,
    user,
    onStartDM,
    currentUser
}) => {
    const { t } = useTranslation();

    if (!user) return null;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-0 text-left align-middle shadow-2xl transition-all border border-slate-200">
                                {/* Header with Gradient Background */}
                                <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                                    <button
                                        onClick={onClose}
                                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Avatar & Identity */}
                                <div className="px-6 -mt-16 text-center relative z-10">
                                    <div className="inline-block p-1 bg-white rounded-full shadow-lg">
                                        <Avatar
                                            src={user.avatar_url}
                                            name={user.full_name || user.username}
                                            size="xl"
                                            className="w-32 h-32 text-3xl ring-4 ring-white"
                                        />
                                    </div>

                                    <div className="mt-4 space-y-1">
                                        {user.rank && (
                                            <div className="text-xs font-black text-indigo-500 uppercase tracking-widest">
                                                {user.rank}
                                            </div>
                                        )}
                                        <Dialog.Title as="h3" className="text-2xl font-bold text-slate-900">
                                            {user.full_name || user.username}
                                        </Dialog.Title>
                                        <div className="text-sm font-medium text-slate-500">
                                            @{user.username}
                                        </div>
                                    </div>

                                    {currentUser?.id !== user.id && (
                                        <div className="mt-6">
                                            <button
                                                onClick={() => {
                                                    onStartDM(user.id);
                                                    onClose();
                                                }}
                                                className="inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 active:scale-95 w-full"
                                            >
                                                <MessageSquare size={18} className="mr-2" />
                                                {t('users.writeMessage', 'Написать сообщение')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Details Grid */}
                                <div className="p-6 mt-2 space-y-6">
                                    {/* Service Info */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                                            {t('company.service')}
                                        </h4>
                                        <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100/50">
                                            {user.unit_name && (
                                                <div className="flex items-start space-x-3">
                                                    <Building2 size={18} className="text-slate-400 mt-0.5 shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-semibold text-slate-500 uppercase">{t('company.unit')}</div>
                                                        <div className="text-sm font-medium text-slate-900">{user.unit_name}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {user.position && (
                                                <div className="flex items-start space-x-3">
                                                    <Briefcase size={18} className="text-slate-400 mt-0.5 shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-semibold text-slate-500 uppercase">{t('company.position')}</div>
                                                        <div className="text-sm font-medium text-slate-900">{user.position}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact Info */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                                            {t('company.contacts')}
                                        </h4>
                                        <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100/50">
                                            <div className="flex items-center space-x-3">
                                                <Mail size={18} className="text-slate-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold text-slate-500 uppercase">Email</div>
                                                    <div className="text-sm font-medium text-slate-900 truncate" title={user.email}>{user.email}</div>
                                                </div>
                                            </div>

                                            {user.phone_number && (
                                                <div className="flex items-center space-x-3">
                                                    <Phone size={18} className="text-slate-400 shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-semibold text-slate-500 uppercase">{t('company.phone')}</div>
                                                        <div className="text-sm font-medium text-slate-900 font-mono">{user.phone_number}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {user.cabinet && (
                                                <div className="flex items-center space-x-3">
                                                    <Building2 size={18} className="text-slate-400 shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-semibold text-slate-500 uppercase">{t('company.cabinet')}</div>
                                                        <div className="text-sm font-medium text-slate-900">{user.cabinet}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Personal Info */}
                                    {user.birth_date && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                                                {t('company.personal')}
                                            </h4>
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/50">
                                                <div className="flex items-center space-x-3">
                                                    <Calendar size={18} className="text-slate-400 shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-xs font-semibold text-slate-500 uppercase">{t('company.birth_date')}</div>
                                                        <div className="text-sm font-medium text-slate-900">
                                                            {new Date(user.birth_date).toLocaleDateString('ru-RU', {
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default UserProfileModal;

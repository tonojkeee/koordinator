import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    X,
    FileText,
    AtSign,
    Clock,
    CheckCircle2,
    ExternalLink,
    Download
} from 'lucide-react';
import type { ZsspdPackage } from '../types';
import { ZsspdStatus } from '../types';
import { useAuthStore } from '../../../store/useAuthStore';

interface PackageDetailsModalProps {
    package: ZsspdPackage;
    onClose: () => void;
}

const PackageDetailsModal: React.FC<PackageDetailsModalProps> = ({ package: pkg, onClose }) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const isOperator = user?.role === 'operator' || user?.role === 'admin';

    const getStatusIcon = (status: ZsspdStatus) => {
        switch (status) {
            case ZsspdStatus.DRAFT: return <Clock className="w-5 h-5 text-slate-400" />;
            case ZsspdStatus.READY: return <CheckCircle2 className="w-5 h-5 text-amber-500" />;
            case ZsspdStatus.SENT: return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            default: return <Clock className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusColor = (status: ZsspdStatus) => {
        switch (status) {
            case ZsspdStatus.SENT: return 'bg-green-50 text-green-700 border-green-100';
            case ZsspdStatus.READY: return 'bg-amber-50 text-amber-700 border-amber-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl border ${getStatusColor(pkg.status)}`}>
                            {getStatusIcon(pkg.status)}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                {t('zsspd.package_details', 'Детали пакета')}
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {pkg.outgoing_number || t('zsspd.no_number')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.subject')}</label>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-sm font-bold text-slate-700">{pkg.subject || t('zsspd.no_subject')}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.status')}</label>
                            <div className={`p-4 rounded-2xl border flex items-center gap-2 ${getStatusColor(pkg.status)} shadow-sm`}>
                                {getStatusIcon(pkg.status)}
                                <span className="text-sm font-black capitalize">{t(`zsspd.statuses.${pkg.status}`)}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.recipient')}</label>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-50 rounded-lg">
                                    <AtSign className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <span className="text-sm font-bold text-slate-600 truncate">{pkg.external_recipient}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('zsspd.date')}</label>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <div className="p-1.5 bg-slate-200/50 rounded-lg">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <span className="text-sm font-bold text-slate-600">
                                    {new Date(pkg.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Files Section */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" />
                            {t('zsspd.files')} ({pkg.files?.length || 0})
                        </h3>
                        <div className="bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden shadow-inner">
                            {pkg.files && pkg.files.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {pkg.files.map((file) => (
                                        <div key={file.id} className="p-4 flex items-center justify-between hover:bg-white transition-colors group">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:border-indigo-100 group-hover:bg-indigo-50/30 transition-colors">
                                                    <FileText className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-sm font-bold text-slate-700 truncate">{file.filename}</span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {(file.file_size / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            </div>
                                            <button className="p-2 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-95 group/btn border border-transparent hover:border-indigo-100 shadow-sm opacity-0 group-hover:opacity-100">
                                                <Download className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400">
                                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm font-bold">{t('zsspd.no_files', 'Файлы отсутствуют')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 bg-white hover:bg-slate-100 text-slate-600 rounded-[1.25rem] font-black uppercase tracking-widest text-xs transition-all border border-slate-200 shadow-sm active:scale-95"
                    >
                        {t('common.close')}
                    </button>
                    {pkg.status === ZsspdStatus.READY && isOperator && (
                        <button
                            className="flex-[2] px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.25rem] font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 group"
                        >
                            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            {t('zsspd.export_ready', 'Экспорт для экспедитора')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PackageDetailsModal;

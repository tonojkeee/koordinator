import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Search, Loader2, Download } from 'lucide-react';
import { useDocumentsOwned, useDocumentsReceived } from './boardApi';
import type { Document, DocumentShare } from './types';
import DocumentList from './components/DocumentList';
import UploadModal from './components/UploadModal';

const BoardPage: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'owned' | 'received'>('owned');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: ownedDocs, isLoading: ownedLoading } = useDocumentsOwned();
    const { data: receivedDocs, isLoading: receivedLoading } = useDocumentsReceived();

    const isLoading = activeTab === 'owned' ? ownedLoading : receivedLoading;
    const currentDocs = activeTab === 'owned'
        ? ownedDocs?.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : receivedDocs?.filter(s => s.document.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden animate-in">
            {/* Header */}
            <header className="px-6 pt-4 pb-2 shrink-0 z-20 sticky top-0 pointer-events-none">
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-4 rounded-2xl shadow-2xl shadow-slate-200/50 pointer-events-auto transition-all duration-300 flex flex-col gap-4">

                    {/* Top Tier: Identity & Global Actions */}
                    <div className="flex items-center justify-between gap-4">
                        {/* Identity */}
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 hover:scale-105 transition-transform duration-300">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight">
                                    {t('board.title')}
                                </h1>
                                <p
                                    key={activeTab}
                                    className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-0.5 animate-in fade-in slide-in-from-left-1 duration-300"
                                >
                                    {activeTab === 'owned' ? t('board.my_documents') : t('board.received_documents')}
                                </p>
                            </div>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative group w-80 hidden md:block">
                                <div className="absolute inset-0 bg-indigo-500/5 rounded-xl blur-md group-hover:bg-indigo-500/10 transition-colors" />
                                <div className="relative flex items-center gap-2 bg-white/50 border border-slate-200/50 rounded-xl p-0.5 transition-all focus-within:bg-white focus-within:shadow-md focus-within:border-indigo-100 focus-within:ring-4 focus-within:ring-indigo-100">
                                    <Search className="ml-2.5 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder={t('board.search_placeholder')}
                                        className="w-full bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400 font-bold text-sm h-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Primary Actions */}
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="flex items-center gap-2 px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 hover:-translate-y-0.5 group"
                            >
                                <Upload size={18} />
                                <span className="hidden sm:inline">{t('board.upload')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Bottom Tier: Context Navigation */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-[-8px]">
                        {/* Tabs (Left Balanced) */}
                        <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
                            <button
                                onClick={() => setActiveTab('owned')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab === 'owned'
                                    ? 'bg-white text-indigo-600 shadow-md'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                <FileText size={13} />
                                <div className="w-px h-3 bg-current opacity-20" />
                                <span>{t('board.my_documents')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('received')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab === 'received'
                                    ? 'bg-white text-indigo-600 shadow-md'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                <Download size={13} />
                                <div className="w-px h-3 bg-current opacity-20" />
                                <span>{t('board.received_documents')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
                        <p className="font-bold text-slate-400 uppercase tracking-widest text-xs animate-pulse">{t('common.loading')}</p>
                    </div>
                ) : (
                    <div
                        key={activeTab}
                        className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                    >
                        <DocumentList
                            documents={activeTab === 'owned' ? (currentDocs as Document[]) : undefined}
                            type={activeTab}
                            shares={activeTab === 'received' ? (currentDocs as DocumentShare[]) : undefined}
                        />
                    </div>
                )}

                {!isLoading && currentDocs?.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-6 animate-in slide-in-from-bottom-4">
                        <div className="w-24 h-24 rounded-[2rem] bg-slate-50 flex items-center justify-center border border-slate-100">
                            <FileText size={48} className="opacity-20 text-slate-400" />
                        </div>
                        <p className="font-bold uppercase tracking-widest text-sm opacity-60">
                            {t('board.no_documents')}
                        </p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <UploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
        </div>
    );
};
export default BoardPage;

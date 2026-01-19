import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Search, Loader2, Download } from 'lucide-react';
import { useDocumentsOwned, useDocumentsReceived } from './boardApi';
import type { Document, DocumentShare } from './types';
import DocumentList from './components/DocumentList';
import UploadModal from './components/UploadModal';
import { Header, Button } from '../../design-system';

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
            <div className="px-6 pt-4 pb-2 shrink-0 z-20 sticky top-0 pointer-events-none">
                <Header
                    title={activeTab === 'owned' ? t('board.my_documents') : t('board.received_documents')}
                    subtitle={t('board.title')}
                    icon={<FileText size={20} />}
                    iconColor="indigo"
                    searchPlaceholder={t('board.search_placeholder', 'Поиск документов...')}
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    onSearchClear={() => setSearchQuery('')}
                    tabs={[
                        { id: 'owned', label: t('board.my_documents'), badge: ownedDocs?.length },
                        { id: 'received', label: t('board.received_documents'), badge: receivedDocs?.length }
                    ]}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    actions={
                        <Button
                            variant="primary"
                            icon={<Upload size={16} />}
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            {t('board.upload')}
                        </Button>
                    }
                    sticky={false}
                    className="pointer-events-auto"
                />
            </div>

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

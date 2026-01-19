import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Package,
    ArrowUpRight,
    ArrowDownLeft,
    Archive,
    Plus
} from 'lucide-react';
import OutgoingTab from './components/OutgoingTab';
import { Header, Button } from '../../design-system';

const ZsspdPage: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming' | 'archive'>('outgoing');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const tabs = [
        { id: 'outgoing', label: t('zsspd.outgoing'), icon: ArrowUpRight },
        { id: 'incoming', label: t('zsspd.incoming'), icon: ArrowDownLeft },
        { id: 'archive', label: t('zsspd.archive'), icon: Archive },
    ] as const;

    return (
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden animate-in">
            {/* Header with Design System */}
            <div className="px-6 pt-4 pb-2 shrink-0 z-20 sticky top-0 pointer-events-none">
                <Header
                    title={activeTab === 'outgoing' ? t('zsspd.outgoing') : activeTab === 'incoming' ? t('zsspd.incoming') : t('zsspd.archive')}
                    subtitle={t('zsspd.title')}
                    icon={<Package size={20} />}
                    iconColor="indigo"
                    tabs={tabs.map(tab => ({
                        id: tab.id,
                        label: tab.label,
                        icon: <tab.icon size={13} />
                    }))}
                    activeTab={activeTab}
                    onTabChange={(tabId) => setActiveTab(tabId as 'outgoing' | 'incoming' | 'archive')}
                    actions={
                        activeTab === 'outgoing' && (
                            <Button
                                variant="primary"
                                size="md"
                                icon={<Plus size={18} />}
                                onClick={() => setIsCreateModalOpen(true)}
                            >
                                <span className="hidden sm:inline">{t('zsspd.new_package')}</span>
                            </Button>
                        )
                    }
                    sticky={false}
                    className="pointer-events-auto"
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
                <div className="w-full">
                    {activeTab === 'outgoing' && (
                        <OutgoingTab
                            isModalOpen={isCreateModalOpen}
                            onClose={() => setIsCreateModalOpen(false)}
                        />
                    )}
                    {activeTab === 'incoming' && (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-slate-200 outline outline-4 outline-slate-50 -outline-offset-1">
                            <ArrowDownLeft className="w-16 h-16 text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-400">
                                {t('zsspd.incoming_empty', 'Входящих пакетов пока нет')}
                            </h3>
                        </div>
                    )}
                    {activeTab === 'archive' && (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-slate-200 outline outline-4 outline-slate-50 -outline-offset-1">
                            <Archive className="w-16 h-16 text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-400">
                                {t('zsspd.archive_empty', 'Архив пуст')}
                            </h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ZsspdPage;

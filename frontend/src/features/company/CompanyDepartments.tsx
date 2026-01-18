import React, { useState } from 'react';
import type { User, Unit } from '../../types';
import { Building2, Users, ArrowRight, Loader2, Search, ArrowLeft, Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CompanyDepartmentsProps {
    units: Unit[];
    allUsers: User[];
    isLoading: boolean;
}

const CompanyDepartments: React.FC<CompanyDepartmentsProps> = ({ units, allUsers, isLoading }) => {
    const { t } = useTranslation();
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

    const getUnitMembers = (unitName: string) => {
        return allUsers?.filter(u => u.unit_name === unitName) || [];
    };

    if (selectedUnit) {
        const members = getUnitMembers(selectedUnit.name);
        return (
            <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Detail Header - Simplified */}
                <header className="px-6 py-4 bg-white/40 border-b border-slate-200/50 flex items-center justify-between shrink-0 z-10">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setSelectedUnit(null)}
                            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-md transition-all active:scale-95"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center space-x-3">
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{selectedUnit.name}</h1>
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                    {members.length} {t('common.participants')}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium line-clamp-1">{selectedUnit.description || t('teams.unit_details_placeholder')}</p>
                        </div>
                    </div>
                </header>

                {/* Detail Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in">
                        {members.map((member, index) => (
                            <div
                                key={member.id}
                                className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 relative overflow-hidden"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className="flex items-start space-x-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-xl shadow-indigo-600/20 transform group-hover:scale-110 transition-transform">
                                        {member.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-bold text-slate-900 leading-tight mb-1 truncate">
                                            {member.full_name || member.username}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                                            @{member.username}
                                        </p>

                                        <div className="space-y-2">
                                            <div className="flex items-center text-slate-500 text-xs">
                                                <Mail className="mr-2 text-slate-300 shrink-0" size={14} />
                                                <span className="truncate">{member.email}</span>
                                            </div>
                                            {member.phone_number && (
                                                <div className="flex items-center text-slate-500 text-xs">
                                                    <Phone className="mr-2 text-slate-300 shrink-0" size={14} />
                                                    <span>{member.phone_number}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {members.length === 0 && (
                            <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-300 space-y-3">
                                <Users size={40} className="opacity-10" />
                                <p className="font-bold uppercase tracking-widest text-[10px]">{t('teams.no_members')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Compact Grid Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-3">
                        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                        <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">{t('common.loading')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {units?.map((unit, index) => {
                            const members = getUnitMembers(unit.name);
                            return (
                                <div
                                    key={unit.id}
                                    onClick={() => setSelectedUnit(unit)}
                                    className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 transform hover:-translate-y-1 animate-in cursor-pointer"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                                            <Building2 size={20} />
                                        </div>
                                        <div className="flex -space-x-2">
                                            {members.slice(0, 3).map((member) => (
                                                <div
                                                    key={member.id}
                                                    className="w-7 h-7 rounded-lg border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm"
                                                >
                                                    {member.username.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            {members.length > 3 && (
                                                <div className="w-7 h-7 rounded-lg border-2 border-white bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                                                    +{members.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors duration-300 truncate mb-1">
                                        {unit.name}
                                    </h3>

                                    <p className="text-[11px] text-slate-400 font-medium line-clamp-1 mb-4">
                                        {unit.description || t('common.no_description')}
                                    </p>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                        <div className="flex items-center text-slate-400 space-x-1">
                                            <Users size={12} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {members.length}
                                            </span>
                                        </div>
                                        <button className="text-slate-300 group-hover:text-indigo-600 transition-colors duration-300">
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {units?.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 space-y-3">
                                <Search size={40} className="opacity-10" />
                                <p className="font-bold uppercase tracking-widest text-[10px]">{t('common.nothing_found')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompanyDepartments;

import React from 'react';
import type { TFunction } from 'i18next';

interface StatCardProps {
    title: string;
    value: string | number;
    subValue?: string | number;
    icon: React.ReactNode;
    color: 'indigo' | 'emerald' | 'violet' | 'amber' | 'rose';
    trend?: string;
    isLive?: boolean;
    t: TFunction;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subValue,
    icon,
    color,
    trend,
    isLive,
    t
}) => {
    const colorStyles = {
        indigo: 'bg-indigo-50/40 border-indigo-100/50 text-indigo-600',
        emerald: 'bg-emerald-50/40 border-emerald-100/50 text-emerald-600',
        violet: 'bg-violet-50/40 border-violet-100/50 text-violet-600',
        amber: 'bg-amber-50/40 border-amber-100/50 text-amber-600',
        rose: 'bg-rose-50/40 border-rose-100/50 text-rose-600',
    };

    const selectedColor = colorStyles[color];

    return (
        <div className="group relative bg-white border p-5 rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 overflow-hidden flex flex-col justify-between h-32">
            {/* Background Accent */}
            <div className={`absolute inset-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.06] ${selectedColor.split(' ')[0]}`} />

            <div className="flex justify-between items-start relative z-10">
                <div className={`p-2.5 rounded-xl border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${selectedColor}`}>
                    <div className="w-5 h-5">{icon}</div>
                </div>
                {trend && (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black px-2.5 py-1 bg-slate-50 text-slate-900 rounded-full border border-slate-100 shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all duration-300">
                            {trend}
                        </span>
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <div className="flex items-end justify-between gap-2 overflow-hidden">
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors duration-300">
                                {value}
                            </span>
                            {isLive && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 animate-pulse shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <span className="text-[8px] font-black uppercase tracking-widest">{t('common.online')}</span>
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors mt-1 truncate">
                            {title}
                        </span>
                    </div>
                    {subValue && (
                        <div className="text-right shrink-0">
                            <span className="text-[9px] font-bold text-slate-300 group-hover:text-slate-400 transition-colors uppercase tracking-tight">
                                {subValue}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

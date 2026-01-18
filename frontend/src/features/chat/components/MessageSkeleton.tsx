import React from 'react';

export const MessageSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4 py-4">
        {[...Array(5)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} items-end space-x-3`}>
                {i % 2 === 0 && <div className="w-8 h-8 bg-slate-200/60 rounded-xl shrink-0" />}
                <div className={`space-y-2 ${i % 2 === 0 ? '' : 'items-end'}`}>
                    <div className={`h-12 bg-slate-200/60 rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
                    {i % 3 === 0 && <div className="h-8 bg-slate-200/40 rounded-xl w-32" />}
                </div>
                {i % 2 !== 0 && <div className="w-8 h-8 bg-slate-200/60 rounded-xl shrink-0" />}
            </div>
        ))}
    </div>
);

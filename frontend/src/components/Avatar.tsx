import React from 'react';
import { useConfigStore } from '../store/useConfigStore';

interface AvatarProps {
    src?: string | null;
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    status?: 'online' | 'offline';
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '', status }) => {
    const sizeClasses = {
        xs: 'w-6 h-6 text-[10px]',
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-20 h-20 text-3xl',
    };

    const statusClasses = {
        xs: 'w-2 h-2 border-2',
        sm: 'w-2.5 h-2.5 border-2',
        md: 'w-3 h-3 border-2',
        lg: 'w-3.5 h-3.5 border-[3px]',
        xl: 'w-5 h-5 border-4',
    };

    const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const { serverUrl } = useConfigStore();
    const host = serverUrl
        ? new URL(serverUrl).hostname
        : (typeof window !== 'undefined' ? window.location.hostname : '');
    const baseUrl = (serverUrl || import.meta.env.VITE_API_URL || `https://${host}:5100/api`).replace(/\/api$/, '');

    return (
        <div className={`relative shrink-0 rounded-full ${sizeClasses[size]} ${className}`}>
            <div className={`w-full h-full rounded-full flex items-center justify-center font-bold overflow-hidden shadow-inner ${!src ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' : 'bg-slate-100'}`}>
                {src ? (
                    <img
                        src={src.startsWith('http') ? src : `${baseUrl}${src}`}
                        alt={name}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                                parent.textContent = initials;
                                parent.classList.add('bg-gradient-to-br', 'from-indigo-500', 'to-indigo-600', 'text-white');
                            }
                        }}
                    />
                ) : (
                    initials
                )}
            </div>

            {status && (
                <div
                    className={`absolute -bottom-0.5 -right-0.5 rounded-full border-white shadow-sm ${statusClasses[size]} ${status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                />
            )}
        </div>
    );
};

export default Avatar;

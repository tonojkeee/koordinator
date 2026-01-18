/**
 * Design System - Avatar Component
 *
 * Компонент аватара с поддержкой изображений, инициалов, статусов
 * и различных размеров.
 *
 * @example
 * <Avatar name="John Doe" size="md" status="online" />
 *
 * @example
 * <Avatar
 *   name="Jane Smith"
 *   src="/avatar.jpg"
 *   size="lg"
 *   status="offline"
 * />
 */

import React from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import { cn } from '../utils/cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
  status?: AvatarStatus;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-3xl',
};

const statusSizeClasses: Record<AvatarSize, string> = {
  xs: 'w-2 h-2 border-2',
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-[3px]',
  xl: 'w-5 h-5 border-4',
};

export const Avatar = React.memo<AvatarProps>(({ 
  src, 
  name, 
  size = 'md', 
  className = '', 
  status 
}) => {
  const { serverUrl } = useConfigStore();
  const host = serverUrl
    ? new URL(serverUrl).hostname
    : (typeof window !== 'undefined' ? window.location.hostname : '');
  const baseUrl = (serverUrl || import.meta.env.VITE_API_URL || `https://${host}:5100/api`).replace(/\/api$/, '');

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const [imageError, setImageError] = React.useState(false);

  return (
    <div className={cn('relative shrink-0 rounded-full', sizeClasses[size], className)}>
      <div className={cn(
        'w-full h-full rounded-full flex items-center justify-center font-bold overflow-hidden shadow-inner',
        !src || imageError ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' : 'bg-slate-100'
      )}>
        {src && !imageError ? (
          <img
            src={src.startsWith('http') ? src : `${baseUrl}${src}`}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
            onError={() => setImageError(true)}
          />
        ) : (
          initials
        )}
      </div>

      {status && (
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full border-white shadow-sm',
            statusSizeClasses[size],
            status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'
          )}
        />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Smile, Send } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
import type { Message } from '../../../types';

export interface MessageInputHandle {
    handleMention: (username: string) => void;
    openForReaction: (msgId: number) => void;
}

interface MessageInputProps {
    isConnected: boolean;
    sendMessage: (content: string | { content: string; parent_id?: number }) => void;
    sendTyping: (is_typing: boolean) => void;
    activeThread: Message | null;
    setActiveThread: (msg: Message | null) => void;
    handleReactionClick: (messageId: number, emoji: string) => void;
    channelId?: string;
    typingUsers?: Record<number, { name: string, timestamp: number }>;
}

export const MessageInput = React.forwardRef<MessageInputHandle, MessageInputProps>(({
    isConnected,
    sendMessage,
    sendTyping,
    activeThread,
    setActiveThread,
    handleReactionClick,
    typingUsers = {}
}, ref) => {
    const { t } = useTranslation();
    const [inputMessage, setInputMessage] = React.useState('');
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const [reactionTargetId, setReactionTargetId] = React.useState<number | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const emojiPickerRef = React.useRef<HTMLDivElement>(null);

    const typingDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentRef = React.useRef<boolean>(false);
    const [currentTime, setCurrentTime] = React.useState(() => Date.now());

    React.useImperativeHandle(ref, () => ({
        handleMention: (username: string) => {
            setInputMessage(prev => {
                const prefix = prev.endsWith(' ') ? '' : (prev.length > 0 ? ' ' : '');
                return prev + prefix + '@' + username + ' ';
            });
            inputRef.current?.focus();
        },
        openForReaction: (msgId: number) => {
            setReactionTargetId(msgId);
            setShowEmojiPicker(true);
        }
    }));

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputMessage(e.target.value);

        if (!lastTypingSentRef.current) {
            sendTyping(true);
            lastTypingSentRef.current = true;
        }

        if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

        typingDebounceRef.current = setTimeout(() => {
            sendTyping(false);
            lastTypingSentRef.current = false;
        }, 3000);
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (inputMessage.trim() && isConnected) {
            if (activeThread) {
                sendMessage({ content: inputMessage.trim(), parent_id: activeThread.id });
            } else {
                sendMessage(inputMessage.trim());
            }
            setInputMessage('');
            setActiveThread(null);
            sendTyping(false);
            lastTypingSentRef.current = false;
        }
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        if (reactionTargetId) {
            handleReactionClick(reactionTargetId, emojiData.emoji);
            setShowEmojiPicker(false);
            setReactionTargetId(null);
        } else {
            setInputMessage(prev => prev + emojiData.emoji);
            setShowEmojiPicker(false);
            inputRef.current?.focus();
        }
    };

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const typingUsersList = React.useMemo(() => {
        return Object.values(typingUsers)
            .filter(u => currentTime - u.timestamp < 3000)
            .slice(0, 3);
    }, [typingUsers, currentTime]);

    return (
        <div className="relative">
            {typingUsersList.length > 0 && (
                <div className="absolute -top-8 left-4 flex items-center space-x-2 text-[10px] text-slate-400 font-medium">
                    <span>{t('chat.typing')}</span>
                    {typingUsersList.map((u, i) => (
                        <span key={i} className="font-semibold text-slate-600">
                            {u.name}
                            {i < typingUsersList.length - 1 && ', '}
                        </span>
                    ))}
                </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputMessage}
                        onChange={handleInputChange}
                        placeholder={t('chat.placeholder')}
                        disabled={!isConnected}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium placeholder:text-slate-400 disabled:opacity-50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                        disabled={!isConnected}
                    >
                        <Smile size={20} />
                    </button>

                    {showEmojiPicker && (
                        <div
                            ref={emojiPickerRef}
                            className="absolute bottom-16 right-0 z-50"
                        >
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                theme={Theme.AUTO}
                                emojiStyle={EmojiStyle.NATIVE}
                                searchPlaceholder={t('chat.searchEmoji')}
                            />
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={!isConnected || !inputMessage.trim()}
                    className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center transition-all hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-indigo-200"
                >
                    <Send size={20} className="translate-x-px" />
                </button>
            </form>
        </div>
    );
});

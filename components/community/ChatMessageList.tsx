import React, { memo } from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';

interface ChatMessageListProps {
    messages: any[];
    userProfile: any;
    activeChannel: any;
    deleteMessage: (id: string) => void;
    openMenuId: string | null;
    setOpenMenuId: (id: string | null) => void;
    bottomRef: React.RefObject<HTMLDivElement>;
    onAvatarClick?: (user: any) => void;
}

const ChatMessageList: React.FC<ChatMessageListProps> = memo(({
    messages,
    userProfile,
    activeChannel,
    deleteMessage,
    openMenuId,
    setOpenMenuId,
    bottomRef,
    onAvatarClick
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" onClick={() => setOpenMenuId(null)}>
            {messages.map((msg, index) => {
                const isMe = msg.sender_id === userProfile?.id;
                const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;

                return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className="w-8 flex-shrink-0">
                            {!isMe && showAvatar && (
                                <div
                                    className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                    title={msg.sender?.full_name}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onAvatarClick && msg.sender) {
                                            onAvatarClick({
                                                id: msg.sender_id,
                                                ...msg.sender
                                            });
                                        }
                                    }}
                                >
                                    {msg.sender?.avatar_url ? (
                                        <img src={msg.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        msg.sender?.full_name?.charAt(0).toUpperCase() || '?'
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[70%] group relative`}>
                            {!isMe && showAvatar && (
                                <div className="text-xs text-gray-500 ml-1 mb-1">{msg.sender?.full_name}</div>
                            )}
                            <div className={`px-4 py-2 rounded-2xl shadow-sm text-sm break-words whitespace-pre-wrap ${isMe
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                                }`}>
                                {msg.content}
                            </div>
                            <div className={`text-[10px] text-gray-400 mt-1 flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(msg.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>

                                {/* Delete Button (Dropdown or Icon) */}
                                {(isMe || userProfile?.role === 'admin' || (userProfile?.role === 'mod' && activeChannel.type === 'team')) && (
                                    <div className="relative">
                                        <button
                                            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === msg.id ? null : msg.id);
                                            }}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {openMenuId === msg.id && (
                                            <div className="absolute bottom-full mb-1 right-0 bg-white shadow-lg border rounded-lg overflow-hidden z-20 min-w-[120px]">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteMessage(msg.id);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    {isMe ? "Thu hồi" : "Xóa tin nhắn"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={bottomRef} />
        </div>
    );
});

export default ChatMessageList;

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MoreVertical, Smile } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface ChatWindowProps {
    onBackMobile?: () => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👋', '🤝', '✅', '❌', '🚗', '⚡', '😃', '😊', '😐', '🆗'];

const ChatWindow: React.FC<ChatWindowProps> = ({ onBackMobile }) => {
    const { activeChannel, messages, sendMessage, onlineUsers, bannedUntil, banUser, deleteMessage, clearHistory } = useChat();
    const { userProfile } = useAuth();

    // Check if banned
    const isBanned = !!bannedUntil;
    const banTime = bannedUntil ? new Date(bannedUntil).toLocaleString('vi-VN') : '';

    const [inputText, setInputText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [showBanModal, setShowBanModal] = useState(false);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);

    // Ban Search States
    const [banSearchTerm, setBanSearchTerm] = useState('');
    const [banUsers, setBanUsers] = useState<any[]>([]);
    const [banLoading, setBanLoading] = useState(false);
    const [banTarget, setBanTarget] = useState<any | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, activeChannel]);

    // Cleanup Ban State on Modal Close
    useEffect(() => {
        if (!showBanModal) {
            setBanSearchTerm('');
            setBanUsers([]);
            setBanTarget(null);
        }
    }, [showBanModal]);

    // Search Effect for Ban User
    useEffect(() => {
        const searchTimeout = setTimeout(async () => {
            if (showBanModal) { // Always fetch initially to show something? Or only on type?
                // Fetch profiles
                setBanLoading(true);
                let query = supabase.from('profiles').select('id, full_name, avatar_url').neq('id', userProfile?.id || '');

                if (banSearchTerm.trim()) {
                    query = query.ilike('full_name', `%${banSearchTerm}%`);
                } else {
                    query = query.limit(10); // Show recent 10 if no search
                }

                let validUserIds: string[] | null = null;

                // Step 1: Filter by Team Channel Members & Managed Users
                if (activeChannel?.type === 'team') {
                    // Get Chat Members
                    const { data: members } = await supabase
                        .from('chat_members')
                        .select('user_id')
                        .eq('channel_id', activeChannel.id);
                    const memberIds = members?.map(m => m.user_id) || [];

                    // IF Mod, also get my employees (Profiles I manage)
                    let employeeIds: string[] = [];
                    if (userProfile?.role === 'mod') {
                        const { data: employees } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('manager_id', userProfile.id);
                        if (employees) employeeIds = employees.map(e => e.id);
                    }

                    // Combine unique IDs
                    validUserIds = Array.from(new Set([...memberIds, ...employeeIds]));
                }

                // Apply ID Filter
                if (validUserIds && validUserIds.length > 0) {
                    query = query.in('id', validUserIds);
                } else if (activeChannel?.type === 'team' && userProfile?.role !== 'admin') {
                    // If non-admin in team channel finds nobody/null, force return empty to be safe
                    // (Logic: validUserIds initialized null. If entered team block, it becomes array. 
                    // If array empty -> query.in('id', []) -> returns nothing. Correct.)
                    // But if validUserIds is empty array, 'in' empty array throws or returns all? 
                    // Supabase .in with empty array usually returns error or all? 
                    // Let's force a impossible ID if empty
                    if (validUserIds && validUserIds.length === 0) query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                }

                const { data, error } = await query;
                if (!error && data) {
                    setBanUsers(data);
                }
                setBanLoading(false);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [banSearchTerm, showBanModal, activeChannel, userProfile?.id]);


    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !activeChannel) return;

        const text = inputText;
        setInputText('');
        await sendMessage(text, activeChannel.id);
        setShowEmoji(false);
        scrollToBottom();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const addEmoji = (emoji: string) => {
        setInputText(prev => prev + emoji);
    };

    const getStatusText = () => {
        if (!activeChannel) return '';

        if (activeChannel.type === 'global') return 'Toàn bộ công ty';
        if (activeChannel.type === 'team') return 'Thành viên';

        // DM Logic
        const meta = activeChannel as any;
        if (meta.otherUserId) {
            if (onlineUsers.has(meta.otherUserId)) return 'Đang hoạt động';
            if (meta.otherUserLastSeen) {
                const date = new Date(meta.otherUserLastSeen);
                const now = new Date();
                const diff = now.getTime() - date.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));

                if (hours < 24) {
                    if (hours === 0) {
                        const minutes = Math.floor(diff / (1000 * 60));
                        if (minutes < 5) return 'Vừa truy cập';
                        return `${minutes} phút trước`;
                    }
                    return `${hours} giờ trước`;
                } else {
                    return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
                }
            }
            return 'Ngoại tuyến';
        }
        return 'Tin nhắn riêng';
    };

    const isOnline = activeChannel?.type === 'dm' && onlineUsers.has((activeChannel as any).otherUserId);

    if (!activeChannel) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 flex-col gap-4 text-gray-400">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <Send className="w-8 h-8 text-gray-400 ml-1" />
                </div>
                <p>Chọn một cuộc hội thoại để bắt đầu</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                    {onBackMobile && (
                        <button onClick={onBackMobile} className="md:hidden text-gray-500">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold overflow-hidden">
                            {activeChannel.type === 'dm' ? (
                                (activeChannel as any).otherUserAvatar ? (
                                    <img src={(activeChannel as any).otherUserAvatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    ((activeChannel as any).otherUserName || '#').charAt(0).toUpperCase()
                                )
                            ) : (
                                activeChannel.name ? activeChannel.name.charAt(0).toUpperCase() : '#'
                            )}
                        </div>
                        {isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">
                            {(activeChannel as any).otherUserName || activeChannel.name || (activeChannel.type === 'global' ? 'Kênh Chung' : (activeChannel.type === 'team' ? 'Team Chat' : 'Tin nhắn riêng'))}
                        </h3>
                        <p className={`text-xs flex items-center gap-1 ${isOnline ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                            {getStatusText()}
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 text-gray-400 relative">
                    {/* Ban Button - Visible to Admin/Mod */}
                    {(userProfile?.role === 'admin' || (userProfile?.role === 'mod' && activeChannel.type === 'team')) && activeChannel.type !== 'dm' && (
                        <button
                            onClick={() => setShowBanModal(true)}
                            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition"
                            title="Cấm chat thành viên"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                    )}

                    {/* Header Actions Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                            className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400 hover:text-gray-600"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>

                        {showHeaderMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowHeaderMenu(false)}></div>
                                <div className="absolute top-full right-0 mt-2 bg-white shadow-xl border rounded-lg overflow-hidden py-1 min-w-[150px] z-20">
                                    {/* Clear History */}
                                    <button
                                        onClick={() => {
                                            clearHistory();
                                            setShowHeaderMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Xóa đoạn chat
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Ban Modal */}
            {showBanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Cấm chat thành viên</h3>
                        <p className="text-sm text-gray-500 mb-4">Tìm và chọn thành viên để cấm chat.</p>

                        <div className="mb-4 space-y-3">
                            {/* Search Input */}
                            <input
                                type="text"
                                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Tìm tên nhân viên..."
                                value={banSearchTerm}
                                onChange={(e) => setBanSearchTerm(e.target.value)}
                            />

                            {/* User List Area */}
                            <div className="h-40 overflow-y-auto border rounded-lg bg-gray-50 p-2 space-y-1">
                                {banLoading ? (
                                    <div className="text-center text-xs text-gray-400 py-2">Đang tìm...</div>
                                ) : banUsers.length === 0 ? (
                                    <div className="text-center text-xs text-gray-400 py-2">Không tìm thấy ai</div>
                                ) : (
                                    banUsers.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => setBanTarget(u)}
                                            className={`w-full text-left p-2 rounded text-sm flex items-center gap-2 ${banTarget?.id === u.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                                                {u.avatar_url ? (
                                                    <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    u.full_name?.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <span className="truncate">{u.full_name}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Selected User Info */}
                        {banTarget && (
                            <div className="mb-4 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-100">
                                Đang chọn: <strong>{banTarget.full_name}</strong>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {[15, 60, 1440, 10080].map(mins => (
                                <button
                                    key={mins}
                                    disabled={!banTarget}
                                    onClick={() => {
                                        if (banTarget) {
                                            banUser(banTarget.id, mins, "Vi phạm nội quy");
                                            setShowBanModal(false);
                                            setBanTarget(null);
                                        }
                                    }}
                                    className="border rounded-lg py-2 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {mins < 60 ? `${mins} phút` : (mins < 1440 ? `${mins / 60} giờ` : `${mins / 1440} ngày`)}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { setShowBanModal(false); setBanTarget(null); }} className="w-full py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">Hủy</button>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.map((msg, index) => {
                    const isMe = msg.sender_id === userProfile?.id;
                    const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;

                    return (
                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                            {/* Avatar */}
                            <div className="w-8 flex-shrink-0">
                                {!isMe && showAvatar && (
                                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600 overflow-hidden" title={msg.sender?.full_name}>
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
                                    {/* Delete Button (Dropdown or Icon) */}
                                    {(isMe || userProfile?.role === 'admin' || (userProfile?.role === 'mod' && activeChannel.type === 'team')) && (
                                        <div className="relative group/menu">
                                            <button
                                                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {/* Hover Menu (Simple CSS based) */}
                                            <div className="absolute bottom-full right-0 mb-1 hidden group-hover/menu:block bg-white shadow-lg border rounded-lg overflow-hidden py-1 min-w-[100px] z-10">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Bạn muốn xóa tin nhắn này?')) {
                                                            deleteMessage(msg.id);
                                                        }
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    Thu hồi
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-200 relative">
                {/* Emoji Picker Popover */}
                {showEmoji && !isBanned && (
                    <div className="absolute bottom-20 left-4 bg-white border border-gray-100 shadow-xl rounded-xl p-3 grid grid-cols-6 gap-2 w-72 animate-in slide-in-from-bottom-2 z-10">
                        {COMMON_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => addEmoji(emoji)}
                                className="text-2xl hover:bg-gray-100 p-2 rounded-lg transition-colors"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {isBanned ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-center text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
                        🚫 Bạn đã bị cấm chat cho đến {banTime}
                    </div>
                ) : (
                    <form onSubmit={handleSend} className="flex gap-2 items-end">
                        <button
                            type="button"
                            onClick={() => setShowEmoji(!showEmoji)}
                            className={`h-11 w-11 flex items-center justify-center rounded-xl transition-all ${showEmoji ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        >
                            <Smile className="w-6 h-6" />
                        </button>

                        <textarea
                            className="flex-1 bg-gray-100 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none max-h-32 min-h-[44px]"
                            rows={1}
                            placeholder="Nhập tin nhắn..."
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={() => setShowEmoji(false)}
                            disabled={isBanned}
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="h-11 w-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none transition-all"
                        >
                            <Send className="w-5 h-5 ml-0.5" />
                        </button>
                    </form>
                )}
            </div>
        </div >
    );
};

export default ChatWindow;

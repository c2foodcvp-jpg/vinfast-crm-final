import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MoreVertical, Smile } from 'lucide-react';
import UserInfoModal from './UserInfoModal';
import ChannelMembersModal from './ChannelMembersModal';
import ChatMessageList from './ChatMessageList';
import { supabase } from '../../supabaseClient';

interface ChatWindowProps {
    onBackMobile?: () => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👋', '🤝', '✅', '❌', '🚗', '⚡', '😃', '😊', '😐', '🆗'];

const ChatWindow: React.FC<ChatWindowProps> = ({ onBackMobile }) => {
    const { activeChannel, messages, sendMessage, onlineUsers, bannedUntil, banUser, deleteMessage, clearHistory, createDM, channels, setActiveChannel, refreshChannels } = useChat();
    const { userProfile } = useAuth();

    // Check if banned
    const isBanned = !!bannedUntil;
    const banTime = bannedUntil ? new Date(bannedUntil).toLocaleString('vi-VN') : '';

    const [inputText, setInputText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [showBanModal, setShowBanModal] = useState(false);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Ban Search States
    const [banSearchTerm, setBanSearchTerm] = useState('');
    const [banUsers, setBanUsers] = useState<any[]>([]);
    const [banLoading, setBanLoading] = useState(false);
    const [banTarget, setBanTarget] = useState<any | null>(null);

    // Team Members Modal State
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [viewMember, setViewMember] = useState<any | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // State to track where the user details were opened from: 'list' | 'chat'
    const [viewMemberSource, setViewMemberSource] = useState<'list' | 'chat'>('list');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, activeChannel]);

    const fetchMembers = async () => {
        if (!activeChannel) return;
        if (activeChannel.type !== 'team' && activeChannel.type !== 'global') {
            setMembers([]);
            return;
        }

        setMembersLoading(true);
        try {
            let data: any[] = [];
            if (activeChannel.type === 'global') {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, last_seen_at, role')
                    .order('full_name');
                if (profiles) data = profiles;
            } else if (activeChannel.type === 'team') {
                const { data: memberData } = await supabase
                    .from('chat_members')
                    .select('user_id')
                    .eq('channel_id', activeChannel.id);
                const memberIds = memberData?.map(m => m.user_id) || [];
                if (memberIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url, last_seen_at, role')
                        .in('id', memberIds)
                        .order('full_name');
                    if (profiles) data = profiles;
                }
            }
            setMembers(data);
        } catch (error) {
            console.error("Error fetching members:", error);
        } finally {
            setMembersLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, [activeChannel]);

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
            if (showBanModal) {
                setBanLoading(true);
                let query = supabase.from('profiles').select('id, full_name, avatar_url').neq('id', userProfile?.id || '');

                if (banSearchTerm.trim()) {
                    query = query.ilike('full_name', `%${banSearchTerm}%`);
                } else {
                    query = query.limit(10);
                }

                let validUserIds: string[] | null = null;

                if (activeChannel?.type === 'team') {
                    const { data: members } = await supabase
                        .from('chat_members')
                        .select('user_id')
                        .eq('channel_id', activeChannel.id);
                    const memberIds = members?.map(m => m.user_id) || [];

                    let employeeIds: string[] = [];
                    if (userProfile?.role === 'mod') {
                        const { data: employees } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('manager_id', userProfile.id);
                        if (employees) employeeIds = employees.map(e => e.id);
                    }

                    validUserIds = Array.from(new Set([...memberIds, ...employeeIds]));
                }

                if (validUserIds && validUserIds.length > 0) {
                    query = query.in('id', validUserIds);
                } else if (activeChannel?.type === 'team' && userProfile?.role !== 'admin') {
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
                <div
                    className={`flex items-center gap-3 ${(activeChannel.type === 'team' || activeChannel.type === 'global') ? 'cursor-pointer hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors group' : ''}`}
                    onClick={() => {
                        if (activeChannel.type === 'team' || activeChannel.type === 'global') setShowMembersModal(true);
                    }}
                    title={(activeChannel.type === 'team' || activeChannel.type === 'global') ? "Click để xem danh sách thành viên" : ""}
                >
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
                                activeChannel.avatar_url ? (
                                    <img src={activeChannel.avatar_url} alt={activeChannel.name} className="w-full h-full object-cover" />
                                ) : (
                                    activeChannel.name ? activeChannel.name.charAt(0).toUpperCase() : '#'
                                )
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
                            <input
                                type="text"
                                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Tìm tên nhân viên..."
                                value={banSearchTerm}
                                onChange={(e) => setBanSearchTerm(e.target.value)}
                            />

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

            {/* Members List Modal */}
            <ChannelMembersModal
                isOpen={showMembersModal}
                onClose={() => setShowMembersModal(false)}
                channelId={activeChannel ? activeChannel.id : ''}
                channelType={activeChannel ? activeChannel.type : 'dm'}
                members={members}
                loading={membersLoading}
                onMembersUpdated={fetchMembers}
                onMemberClick={(member) => {
                    setViewMember(member);
                    setViewMemberSource('list');
                    setShowMembersModal(false); // Close List -> Open Detail (Swap)
                }}
                onLeaveChannel={async () => {
                    if (!activeChannel || !userProfile) return;

                    try {
                        try {
                            await supabase
                                .from('chat_messages')
                                .insert({
                                    channel_id: activeChannel.id,
                                    sender_id: userProfile.id,
                                    content: `${userProfile.full_name || 'Một thành viên'} đã rời khỏi nhóm chat !`,
                                    is_system: true
                                });
                        } catch (msgError) {
                            console.error("Failed to send leave message:", msgError);
                        }

                        const { error } = await supabase
                            .from('chat_members')
                            .delete()
                            .eq('channel_id', activeChannel.id)
                            .eq('user_id', userProfile.id);

                        if (error) throw error;

                        setShowMembersModal(false);
                        setActiveChannel(null);
                        await refreshChannels();

                    } catch (err) {
                        console.error("Error leaving group:", err);
                        alert("Lỗi: Không thể rời nhóm.");
                    }
                }}
            />

            {/* User Info Popup (Stacked on top) */}
            {viewMember && (
                <UserInfoModal
                    userId={viewMember.id}
                    initialUser={viewMember}
                    onClose={() => {
                        setViewMember(null);
                        if (viewMemberSource === 'list') {
                            setShowMembersModal(true); // Close Detail -> Restore List only if came from list
                        }
                    }}
                    onMessage={async (targetId) => {
                        try {
                            setViewMember(null);
                            setShowMembersModal(false);

                            const newChannelId = await createDM(targetId);

                            const exisiting = channels.find(c => c.id === newChannelId);
                            if (exisiting) {
                                setActiveChannel(exisiting);
                            } else {
                                setTimeout(() => {
                                    // Handle switch
                                }, 500);
                            }

                            const { data: chan } = await supabase.from('chat_channels').select('*').eq('id', newChannelId).single();
                            if (chan) {
                                setActiveChannel({
                                    ...chan,
                                    unread_count: 0,
                                });
                            }

                        } catch (error) {
                            console.error("Failed to start chat", error);
                        }
                    }}
                />
            )}

            {/* Messages */}
            <ChatMessageList
                messages={messages}
                userProfile={userProfile}
                activeChannel={activeChannel}
                deleteMessage={deleteMessage}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                bottomRef={messagesEndRef}
                onAvatarClick={(user) => {
                    setViewMember(user);
                    setViewMemberSource('chat');
                }}
            />

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

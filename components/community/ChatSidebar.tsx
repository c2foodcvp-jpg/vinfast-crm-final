import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Hash } from 'lucide-react';
import UserList from './UserList';

const ChatSidebar: React.FC<{ onMobileClose?: () => void }> = ({ onMobileClose }) => {
    const { channels, activeChannel, setActiveChannel, globalChannelId, teamChannelId, createDM, onlineUsers } = useChat();
    // const { userProfile } = useAuth(); // Unused
    const [activeTab, setActiveTab] = useState<'messages' | 'contacts'>('messages');

    const globalChannel = channels.find(c => c.id === globalChannelId);
    const teamChannel = teamChannelId ? channels.find(c => c.id === teamChannelId) : null;
    const dmChannels = channels.filter(c => c.type === 'dm');

    const handleChannelSelect = (channel: any) => {
        setActiveChannel(channel);
        if (onMobileClose) onMobileClose();
        setActiveTab('messages');
    };

    const handleUserSelect = async (userId: string) => {
        try {
            await createDM(userId);
            if (onMobileClose) onMobileClose();
            setActiveTab('messages');
        } catch (error) {
            console.error("Failed to create DM", error);
        }
    };

    const formatTimeStatus = (userId: string | undefined, lastSeen: string | null | undefined) => {
        if (!userId) return '';
        if (onlineUsers.has(userId)) return 'Đang hoạt động';
        if (!lastSeen) return 'Ngoại tuyến';

        const date = new Date(lastSeen);
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
    };

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full md:w-80 flex-shrink-0">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Cộng đồng</h2>
            </div>

            <div className="flex bg-gray-100 p-1 mx-4 mt-4 rounded-lg">
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'messages' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Tin nhắn
                </button>
                <button
                    onClick={() => setActiveTab('contacts')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'contacts' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Danh bạ
                </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-2">
                {activeTab === 'messages' ? (
                    <div className="py-2">
                        <div className="px-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">Công ty</div>
                        {globalChannel && (
                            <button
                                onClick={() => handleChannelSelect(globalChannel)}
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${activeChannel?.id === globalChannel.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Hash className="w-5 h-5" />
                                    </div>
                                    {!!globalChannel.unread_count && globalChannel.unread_count > 0 && (
                                        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                            {globalChannel.unread_count > 9 ? '9+' : globalChannel.unread_count}
                                        </div>
                                    )}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-sm font-bold text-gray-800 truncate">Kênh Chung</div>
                                        {globalChannel.last_message_at && (
                                            <div className="text-[10px] text-gray-400">
                                                {new Date(globalChannel.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`text-xs truncate ${globalChannel.unread_count ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                        {globalChannel.last_message_preview || 'Toàn bộ nhân viên'}
                                    </div>
                                </div>
                            </button>
                        )}

                        <button
                            onClick={() => {
                                if (teamChannel) handleChannelSelect(teamChannel);
                                else alert("Kênh Team chưa được thiết lập. Vui lòng thử lại sau.");
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${activeChannel?.id === teamChannel?.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <Users className="w-5 h-5" />
                                </div>
                                {!!teamChannel?.unread_count && teamChannel.unread_count > 0 && (
                                    <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                        {teamChannel.unread_count > 9 ? '9+' : teamChannel.unread_count}
                                    </div>
                                )}
                            </div>

                            <div className="text-left flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                    <div className="text-sm font-bold text-gray-800">Team của tôi</div>
                                    {teamChannel?.last_message_at && (
                                        <div className="text-[10px] text-gray-400">
                                            {new Date(teamChannel.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                                <div className={`text-xs truncate ${teamChannel?.unread_count ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                    {teamChannel?.last_message_preview || 'Thảo luận nội bộ'}
                                </div>
                            </div>
                        </button>

                        <div className="px-4 py-2 mt-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tin nhắn riêng</div>
                        {dmChannels.length === 0 && (
                            <div className="px-4 py-2 text-sm text-gray-400 italic text-center mt-4">Chưa có tin nhắn nào.</div>
                        )}
                        {dmChannels.map(dm => {
                            const isOnline = dm.otherUserId ? onlineUsers.has(dm.otherUserId) : false;
                            const statusText = formatTimeStatus(dm.otherUserId, dm.otherUserLastSeen);
                            const displayName = dm.otherUserName || dm.name || 'Người dùng';
                            const hasUnread = (dm.unread_count || 0) > 0;

                            return (
                                <button
                                    key={dm.id}
                                    onClick={() => handleChannelSelect(dm)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${activeChannel?.id === dm.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                                >
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm uppercase overflow-hidden border border-blue-200">
                                            {dm.otherUserAvatar ? (
                                                <img src={dm.otherUserAvatar} alt={displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                displayName.charAt(0)
                                            )}
                                        </div>
                                        {isOnline && (
                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                                        )}
                                        {hasUnread && (
                                            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                                                {dm.unread_count! > 9 ? '9+' : dm.unread_count}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-left w-full overflow-hidden flex-1">
                                        <div className="flex justify-between items-baseline">
                                            <div className={`text-sm font-medium truncate ${hasUnread ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>
                                                {displayName}
                                            </div>
                                            {dm.last_message_at && (
                                                <div className={`text-[10px] ${hasUnread ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                                    {new Date(dm.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>

                                        <div className={`text-xs truncate ${hasUnread ? 'font-bold text-gray-900' : (isOnline ? 'text-green-600 font-medium' : 'text-gray-500')}`}>
                                            {hasUnread ? (dm.last_message_preview || 'Tin nhắn mới') : (statusText || dm.last_message_preview || 'Nhấn để xem')}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <UserList onSelectUser={handleUserSelect} />
                )}
            </div>
        </div>
    );
};

export default ChatSidebar;

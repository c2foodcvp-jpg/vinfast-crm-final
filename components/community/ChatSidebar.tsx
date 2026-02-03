import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Hash, Plus } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import UserList from './UserList';
import CreateTeamModal from './CreateTeamModal';

const ChatSidebar: React.FC<{ onMobileClose?: () => void }> = ({ onMobileClose }) => {
    const { channels, activeChannel, setActiveChannel, globalChannelId, createDM, onlineUsers, refreshChannels } = useChat();
    const { isAdmin, isMod } = useAuth();
    const [activeTab, setActiveTab] = useState<'messages' | 'contacts'>('messages');
    const [uploadingChannel, setUploadingChannel] = useState<string | null>(null);
    const [showCreateTeam, setShowCreateTeam] = useState(false);

    const handleChannelAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, channelId: string) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        try {
            setUploadingChannel(channelId);
            const fileExt = file.name.split('.').pop();
            const fileName = `ch-${channelId}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get URL
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            // Update Channel
            const { error: updateError } = await supabase
                .from('chat_channels')
                .update({ avatar_url: data.publicUrl })
                .eq('id', channelId);

            if (updateError) throw updateError;

            // Refresh
            await refreshChannels();

        } catch (error) {
            console.error("Upload failed", error);
            alert("Lỗi tải ảnh");
        } finally {
            setUploadingChannel(null);
        }
    };

    const globalChannel = channels.find(c => c.id === globalChannelId);
    const teamChannels = channels.filter(c => c.type === 'team'); // Get ALL team channels
    const dmChannels = channels.filter(c => c.type === 'dm');

    const handleChannelSelect = (channel: any) => {
        setActiveChannel(channel);
        if (onMobileClose) onMobileClose();
        setActiveTab('messages');
    };

    const handleUserSelect = async (userId: string) => {
        try {
            // 1. Create or Get DM Channel ID
            const channelId = await createDM(userId);

            // 2. Try RPC Fetch (Use V2)
            const { data: chanData } = await supabase.rpc('get_channels_v2');
            let newChan = chanData?.find((c: any) => c.channel_id === channelId);

            // 3. FALLBACK: If RPC didn't return it (consistency delay?), fetch Profile manually
            let channelObj: any = null;

            if (newChan) {
                channelObj = {
                    id: newChan.channel_id,
                    type: newChan.channel_type,
                    name: newChan.channel_name,
                    avatar_url: newChan.channel_avatar_url,
                    last_message_at: newChan.last_message_at,
                    unread_count: 0,
                    // DM Extras
                    otherUserId: newChan.receiver_id,
                    otherUserName: newChan.receiver_name,
                    otherUserLastSeen: newChan.receiver_last_seen,
                    otherUserAvatar: newChan.receiver_avatar
                };
            } else {
                // Manually construct from Profile
                // This ensures UI switches even if Channel list is stale
                const { data: user } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (user) {
                    channelObj = {
                        id: channelId,
                        type: 'dm',
                        name: user.full_name,
                        avatar_url: null, // DMs usually use otherUserAvatar
                        last_message_at: new Date().toISOString(),
                        unread_count: 0,
                        otherUserId: user.id,
                        otherUserName: user.full_name,
                        otherUserAvatar: user.avatar_url,
                        otherUserLastSeen: user.last_seen_at
                    };
                }
            }

            if (channelObj) {
                // 4. Set Active & Switch
                setActiveChannel(channelObj);
                setActiveTab('messages');

                // IMPORTANT: Force view switch
                if (onMobileClose) onMobileClose();
            } else {
                // If even profile fetch failed??
                alert("Không thể tải thông tin cuộc trò chuyện.");
            }

            // 5. Refresh Background
            await refreshChannels();

        } catch (error) {
            console.error("Failed to navigate to chat", error);
            alert("Lỗi: Không thể kết nối trò chuyện. Vui lòng kiểm tra mạng.");
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
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header / Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'messages' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Tin nhắn
                </button>
                <button
                    onClick={() => setActiveTab('contacts')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'contacts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Cộng đồng
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'messages' ? (
                    <div className="divide-y divide-gray-100">
                        {/* Global & Team Channels */}
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Công ty</div>
                        {globalChannel && (
                            <button
                                onClick={() => handleChannelSelect(globalChannel)}
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${activeChannel?.id === globalChannel.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                            >
                                <div className="relative group/avatar">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden border border-indigo-200">
                                        {globalChannel.avatar_url ? (
                                            <img src={globalChannel.avatar_url} alt="Global" className="w-full h-full object-cover" />
                                        ) : (
                                            <Hash className="w-5 h-5" />
                                        )}
                                    </div>

                                    {/* Upload Overlay for Admin */}
                                    {isAdmin && (
                                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-opacity z-20">
                                            {uploadingChannel === globalChannel.id ? (
                                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                            ) : (
                                                <div className="text-white text-[9px] font-bold">SỬA</div>
                                            )}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                disabled={uploadingChannel === globalChannel.id}
                                                onChange={(e) => handleChannelAvatarUpload(e, globalChannel.id)}
                                            />
                                        </label>
                                    )}

                                    {!!globalChannel.unread_count && globalChannel.unread_count > 0 && (
                                        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm z-30">
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

                        <div className="flex items-center justify-between px-4 py-2 mt-2">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nhóm Chat</div>
                            {(isAdmin || isMod) && (
                                <button
                                    onClick={() => setShowCreateTeam(true)}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                                    title="Tạo nhóm mới"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {teamChannels.map(channel => (
                            <button
                                key={channel.id}
                                onClick={() => handleChannelSelect(channel)}
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${activeChannel?.id === channel.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                            >
                                <div className="relative group/avatar">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center overflow-hidden border border-orange-200">
                                        {channel.avatar_url ? (
                                            <img src={channel.avatar_url} alt={channel.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Users className="w-5 h-5" />
                                        )}
                                    </div>

                                    {/* Upload Overlay for Mod/Admin */}
                                    {(isMod || isAdmin) && (
                                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-opacity z-20">
                                            {uploadingChannel === channel.id ? (
                                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                            ) : (
                                                <div className="text-white text-[9px] font-bold">SỬA</div>
                                            )}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                disabled={uploadingChannel === channel.id}
                                                onChange={(e) => handleChannelAvatarUpload(e, channel.id)}
                                            />
                                        </label>
                                    )}

                                    {!!channel.unread_count && channel.unread_count > 0 && (
                                        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm z-30">
                                            {channel.unread_count > 9 ? '9+' : channel.unread_count}
                                        </div>
                                    )}
                                </div>

                                <div className="text-left flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-sm font-bold text-gray-800 truncate">{channel.name || 'Nhóm'}</div>
                                        {channel.last_message_at && (
                                            <div className="text-[10px] text-gray-400">
                                                {new Date(channel.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`text-xs truncate ${channel.unread_count ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                        {channel.last_message_preview || 'Chạm để nhắn tin'}
                                    </div>
                                </div>
                            </button>
                        ))}

                        {teamChannels.length === 0 && (
                            <div className="px-4 py-2 text-sm text-gray-400 italic text-center">Chưa có nhóm nào.</div>
                        )}

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
            {/* Modals */}
            <CreateTeamModal isOpen={showCreateTeam} onClose={() => setShowCreateTeam(false)} />
        </div>
    );
};

export default ChatSidebar;

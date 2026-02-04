import React, { useState, useEffect } from 'react';
import { Users, Search, X, LogOut, UserPlus, Pencil, Save, Trash2 } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import AddMembersModal from './AddMembersModal';
import toast from 'react-hot-toast';

interface ChannelMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    channelId: string;
    channelType: 'team' | 'global' | 'dm';
    onMemberClick: (member: any) => void;
    members: any[];
    loading?: boolean;
    onLeaveChannel?: () => void;
    onMembersUpdated?: () => void;
}

const ChannelMembersModal: React.FC<ChannelMembersModalProps> = ({
    isOpen,
    onClose,
    channelId,
    channelType,
    onMemberClick,
    members = [], // Received from parent
    loading = false,
    onLeaveChannel,
    onMembersUpdated
}) => {
    const { onlineUsers, activeChannel, refreshChannels } = useChat();
    const { userProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    // Rename State
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    // Kick State
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && activeChannel) {
            setEditName(activeChannel.name || '');
            setIsEditingName(false);
        }
    }, [isOpen, activeChannel]);

    // Filter locally
    const filteredMembers = members.filter(m =>
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isManager = channelType === 'team' && (userProfile?.role === 'admin' || userProfile?.role === 'mod');

    const handleSaveName = async () => {
        if (!editName.trim() || !activeChannel) return;
        setIsSavingName(true);
        try {
            const { error } = await supabase
                .from('chat_channels')
                .update({ name: editName.trim() })
                .eq('id', activeChannel.id);

            if (error) throw error;

            toast.success("Đổi tên nhóm thành công");
            setIsEditingName(false);
            refreshChannels();
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi đổi tên nhóm");
        } finally {
            setIsSavingName(false);
        }
    };

    const handleKick = async (memberId: string, memberName: string) => {
        if (!confirm(`Bạn có chắc muốn mời ${memberName} ra khỏi nhóm?`)) return;

        setProcessingId(memberId);
        try {
            const { error } = await supabase
                .from('chat_members')
                .delete()
                .eq('channel_id', channelId)
                .eq('user_id', memberId);

            if (error) throw error;

            // System message
            await supabase.from('chat_messages').insert({
                channel_id: channelId,
                sender_id: userProfile?.id,
                content: `${userProfile?.full_name} đã mời ${memberName} ra khỏi nhóm.`,
                is_system: true
            });

            toast.success(`Đã mời ${memberName} ra khỏi nhóm`);
            if (onMembersUpdated) onMembersUpdated();
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi xóa thành viên");
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex-1 flex items-center gap-2 overflow-hidden">
                        <Users className="w-5 h-5 text-blue-600 shrink-0" />

                        {isEditingName ? (
                            <div className="flex items-center gap-1 flex-1 mr-2">
                                <input
                                    autoFocus
                                    className="flex-1 min-w-0 px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-500"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                />
                                <button onClick={handleSaveName} disabled={isSavingName} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Save className="w-4 h-4" />
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <h3 className="font-bold text-gray-800 truncate">
                                    {channelType === 'global' ? 'Danh sách nhân viên' : (activeChannel?.name || 'Thành viên nhóm')}
                                </h3>
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full shrink-0">
                                    {members.length}
                                </span>
                                {isManager && (
                                    <button
                                        onClick={() => setIsEditingName(true)}
                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Đổi tên nhóm"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {isManager && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-full transition-colors mr-1"
                                title="Thêm thành viên"
                            >
                                <UserPlus className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="p-3 border-b bg-gray-50/50">
                    <div className="relative group">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm thành viên..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        // autoFocus // Removed autofocus to prevent jumping when clicking edit name
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                            <span className="text-xs">Đang tải danh sách...</span>
                        </div>
                    ) : filteredMembers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
                            <Users className="w-12 h-12 text-gray-200" />
                            <p>Không tìm thấy thành viên nào.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredMembers.map(member => {
                                const isOnline = onlineUsers.has(member.id);
                                const isMe = member.id === userProfile?.id;
                                const canKick = isManager && !isMe;

                                // Prevent Mod from kicking Admin
                                const cannotKickAdmin = userProfile?.role === 'mod' && member.role === 'admin';

                                return (
                                    <div
                                        key={member.id}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all group border border-transparent hover:border-gray-100 hover:shadow-sm"
                                    >
                                        <button
                                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                            onClick={() => onMemberClick(member)}
                                        >
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 overflow-hidden ring-2 ring-white shadow-sm group-hover:ring-blue-50 transition-all">
                                                    {member.avatar_url ? (
                                                        <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        member.full_name?.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                {isOnline && (
                                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                                        {member.full_name}
                                                    </div>
                                                    {member.role === 'admin' && (
                                                        <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded border border-red-100 font-bold tracking-wider">
                                                            ADMIN
                                                        </span>
                                                    )}
                                                    {member.role === 'mod' && (
                                                        <span className="bg-indigo-50 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded border border-indigo-100 font-bold tracking-wider">
                                                            MOD
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                                    <span className={isOnline ? "text-green-600 font-medium" : ""}>
                                                        {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Kick Button */}
                                        {canKick && !cannotKickAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleKick(member.id, member.full_name);
                                                }}
                                                disabled={processingId === member.id}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Mời ra khỏi nhóm"
                                            >
                                                {processingId === member.id ? (
                                                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Actions (Leave Group) */}
                {channelType === 'team' && onLeaveChannel && (
                    <div className="p-4 border-t bg-gray-50">
                        <button
                            onClick={() => {
                                if (window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này không?")) {
                                    onLeaveChannel();
                                }
                            }}
                            className="w-full py-2.5 flex items-center justify-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-medium transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Rời nhóm
                        </button>
                    </div>
                )}

                {/* Add Members Modal */}
                <AddMembersModal
                    isOpen={showAddModal}
                    onClose={() => {
                        setShowAddModal(false);
                        if (onMembersUpdated) onMembersUpdated();
                    }}
                    channelId={channelId}
                    existingMemberIds={new Set(members.map(m => m.id))}
                />
            </div>
        </div>
    );
};

export default ChannelMembersModal;

import React, { useState } from 'react';
import { Users, Search, X, LogOut, UserPlus } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import AddMembersModal from './AddMembersModal';

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
    const { onlineUsers } = useChat();
    const { userProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    // Filter locally
    const filteredMembers = members.filter(m =>
        m.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const canAddMembers = channelType === 'team' && (userProfile?.role === 'admin' || userProfile?.role === 'mod');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span>
                            {channelType === 'global' ? 'Danh sách nhân viên' : 'Thành viên nhóm'}
                        </span>
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                            {members.length}
                        </span>
                    </h3>
                    <div className="flex items-center gap-1">
                        {canAddMembers && (
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
                            autoFocus
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
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => onMemberClick(member)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all group border border-transparent hover:border-gray-100 hover:shadow-sm"
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
                                        <div className="flex-1 text-left min-w-0">
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

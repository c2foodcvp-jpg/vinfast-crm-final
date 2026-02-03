import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { X, Search, Check, UserPlus } from 'lucide-react';

interface AddMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    channelId: string;
    existingMemberIds: Set<string>;
}

const AddMembersModal: React.FC<AddMembersModalProps> = ({ isOpen, onClose, channelId, existingMemberIds }) => {
    const { userProfile } = useAuth();
    const { refreshChannels } = useChat();
    const [users, setUsers] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setSelectedIds(new Set());
            setSearchTerm('');
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role, manager_id')
                .neq('id', userProfile?.id || '')
                .order('full_name');

            // If Mod, only show employees managed by them
            if (userProfile?.role === 'mod') {
                query = query.eq('manager_id', userProfile.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (data) {
                // Filter out users who are already members
                const nonMembers = data.filter(u => !existingMemberIds.has(u.id));
                setUsers(nonMembers);
            }
        } catch (error) {
            console.error("Error fetching users for team:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleAdd = async () => {
        if (selectedIds.size === 0) return alert("Vui lòng chọn ít nhất 1 thành viên");

        setAdding(true);
        try {
            // Use RPC to add members
            const { error } = await supabase.rpc('add_team_members', {
                team_id: channelId,
                member_ids: Array.from(selectedIds)
            });

            // If RPC fails (e.g., doesn't exist yet), try direct insert fallback (careful with policies)
            if (error) {
                // Try direct insert as fallback
                const inserts = Array.from(selectedIds).map(uid => ({
                    channel_id: channelId,
                    user_id: uid
                }));
                const { error: insertError } = await supabase.from('chat_members').insert(inserts);
                if (insertError) throw insertError;
            }

            await refreshChannels(); // To update counts/etc if needed
            // Also need to refresh the member list in parent, but typical usage will re-fetch
            onClose();
        } catch (error) {
            console.error("Error adding members:", error);
            alert(`Lỗi khi thêm thành viên: ${(error as Error).message}`);
        } finally {
            setAdding(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-blue-600" />
                        Thêm thành viên
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4">
                    <div className="flex flex-col flex-1 min-h-[300px]">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Chọn nhân viên ({selectedIds.size})</label>

                        {/* Search */}
                        <div className="relative mb-2">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Tìm nhân viên..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-[300px]">
                            {loading ? (
                                <div className="p-4 text-center text-gray-400 text-sm">Đang tải danh sách...</div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-sm">Không tìm thấy nhân viên nào khả dụng.</div>
                            ) : (
                                filteredUsers.map(user => {
                                    const isSelected = selectedIds.has(user.id);
                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => toggleUser(user.id)}
                                            className={`w-full flex items-center gap-3 p-2 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                        {user.full_name[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-sm font-medium text-gray-800 text-left flex-1">
                                                {user.full_name}
                                                {user.role === 'admin' && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1 rounded">ADMIN</span>}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                        Hủy
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={adding}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {adding && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Thêm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddMembersModal;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { X, Search, Check, Users } from 'lucide-react';

interface CreateTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose }) => {
    const { userProfile } = useAuth();
    const { refreshChannels } = useChat();
    const [teamName, setTeamName] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setTeamName('');
            setSelectedIds(new Set());
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
            if (data) setUsers(data);
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

    const handleCreate = async () => {
        if (!teamName.trim()) return alert("Vui lòng nhập tên nhóm");
        if (selectedIds.size === 0) return alert("Vui lòng chọn ít nhất 1 thành viên");
        if (!userProfile) return alert("Vui lòng đăng nhập lại");

        setCreating(true);
        try {
            const { error } = await supabase.rpc('create_team_group', {
                group_name: teamName,
                member_ids: Array.from(selectedIds),
                creator_id: userProfile?.id
            });

            if (error) throw error;

            await refreshChannels();
            onClose();
        } catch (error) {
            console.error("Error creating team:", error);
            alert(`Lỗi khi tạo nhóm: ${(error as Error).message}`);
        } finally {
            setCreating(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Tạo nhóm mới
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4">

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên nhóm</label>
                        <input
                            type="text"
                            placeholder="Ví dụ: Team Sale HCM..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={teamName}
                            onChange={e => setTeamName(e.target.value)}
                        />
                    </div>

                    {/* Member Selection */}
                    <div className="flex flex-col flex-1 min-h-[300px]">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Thêm thành viên ({selectedIds.size})</label>

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
                                <div className="p-4 text-center text-gray-400 text-sm">Không tìm thấy ai.</div>
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
                        onClick={handleCreate}
                        disabled={creating}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {creating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Tạo nhóm
                    </button>
                </div>
            </div>
        </div >
    );
};

export default CreateTeamModal;

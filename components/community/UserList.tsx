import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Search } from 'lucide-react';

interface UserListProps {
    onSelectUser: (userId: string) => void;
}

const UserList: React.FC<UserListProps> = ({ onSelectUser }) => {
    const { onlineUsers } = useChat();
    const { userProfile } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, last_seen_at')
                .neq('id', userProfile?.id || '')
                .order('full_name');

            if (!error && data) {
                setUsers(data);
            }
            setLoading(false);
        };
        fetchUsers();
    }, [userProfile?.id]);

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatLastSeen = (dateStr: string | null) => {
        if (!dateStr) return 'Ngoại tuyến';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 24) {
            // "Nếu < 24h thì thông báo số giờ"
            if (hours === 0) {
                const minutes = Math.floor(diff / (1000 * 60));
                if (minutes < 5) return 'Vừa truy cập';
                return `${minutes} phút trước`;
            }
            return `${hours} giờ trước`;
        } else {
            // "> 24h thì thông báo ngày giờ"
            return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-2">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Đang tải...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Không tìm thấy ai.</div>
                ) : (
                    filteredUsers.map(user => {
                        const isOnline = onlineUsers.has(user.id);
                        return (
                            <button
                                key={user.id}
                                onClick={() => onSelectUser(user.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm overflow-hidden border border-blue-200">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            user.full_name?.charAt(0).toUpperCase() || '?'
                                        )}
                                    </div>
                                    {isOnline && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                                    )}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">{user.full_name}</div>
                                    <div className={`text-xs truncate ${isOnline ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                                        {isOnline ? 'Đang hoạt động' : formatLastSeen(user.last_seen_at)}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default UserList;

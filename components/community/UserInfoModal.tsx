
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { X, Mail, Phone, Building, Calendar, MessageSquare, Loader2 } from 'lucide-react';

interface UserInfoModalProps {
    userId: string | null;
    initialUser?: any;
    onClose: () => void;
    onMessage: (userId: string) => void;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({ userId, initialUser, onClose, onMessage }) => {
    const [user, setUser] = useState<any>(initialUser || null);
    const [loading, setLoading] = useState(!initialUser);

    useEffect(() => {
        if (!userId) return;

        // If we switched users but kept modal open (rare), reset if no initialUser match
        if (initialUser && initialUser.id !== userId) {
            setUser(null);
            setLoading(true);
        } else if (initialUser && initialUser.id === userId && !user) {
            setUser(initialUser);
            setLoading(false);
        }

        const fetchUser = async () => {
            // If we already have full details (implied by having email/phone), maybe skin fetch?
            // For now, always fetch fresh data but SILENTLY if we have initialUser
            if (!initialUser) setLoading(true);
            try {
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (userError) throw userError;

                if (userData) {
                    // Update user with fresh data, merging with existing to prevent flicker
                    setUser((prev: any) => ({ ...prev, ...userData }));

                    // Removed client-side auto-healing to improve performance
                }
            } catch (error) {
                console.error("Error fetching user info:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [userId]);

    if (!userId) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 relative"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors z-10"
                >
                    <X size={16} />
                </button>

                {loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                    </div>
                ) : user ? (
                    <>
                        {/* Header / Cover */}
                        <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative">
                            {/* Avatar */}
                            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
                                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-200 overflow-hidden flex items-center justify-center">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl font-bold text-gray-500">{user.full_name?.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-12 pb-6 px-6 text-center">
                            <h2 className="text-xl font-bold text-gray-900">{user.full_name}</h2>
                            <p className="text-sm text-gray-500 mb-4">{user.role === 'admin' ? 'Administrator' : user.role === 'mod' ? 'Moderator' : 'Nhân viên'}</p>

                            {user.introduction && (
                                <div className="mb-6 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-600 italic border border-gray-100">
                                    "{user.introduction}"
                                </div>
                            )}

                            <div className="space-y-3 text-left mb-6">
                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <Phone size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Số điện thoại</p>
                                        <p className="text-sm font-medium text-gray-900 truncate">{user.phone || 'Chưa cập nhật'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                        <Building size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Đại lý làm việc</p>
                                        <p className="text-sm font-medium text-gray-900 truncate">{user.dealership_name || 'Chưa cập nhật'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                                        <Mail size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Email</p>
                                        <p className="text-sm font-medium text-gray-900 truncate">{user.email || 'Chưa cập nhật'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                        <Calendar size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Ngày sinh</p>
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {user.birthdate ? new Date(user.birthdate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => onMessage(user.id)}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all"
                            >
                                <MessageSquare size={18} /> Nhắn tin
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        Không tìm thấy thông tin người dùng.
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserInfoModal;

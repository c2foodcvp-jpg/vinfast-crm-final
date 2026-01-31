
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Customer } from '../types';
import { X, Share2, Trash2, Check, Loader2 } from 'lucide-react';

interface ShareCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    currentUser: UserProfile | null;
}

interface ShareRecord {
    id: string;
    shared_with: string;
    permission: 'view' | 'edit';
    created_at: string;
    user_name?: string; // Joined
}

const ShareCustomerModal: React.FC<ShareCustomerModalProps> = ({ isOpen, onClose, customer, currentUser }) => {
    const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
    const [existingShares, setExistingShares] = useState<ShareRecord[]>([]);
    const [shareForm, setShareForm] = useState<{ recipientId: string, permission: 'view' | 'edit' }>({ recipientId: '', permission: 'view' });
    const [loading, setLoading] = useState(false);
    const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && customer && currentUser) {
            fetchData();
        }
    }, [isOpen, customer, currentUser]);

    const fetchData = async () => {
        if (!customer) return;
        setLoading(true);
        try {
            // 1. Fetch Existing Shares
            const { data: shares, error: shareError } = await supabase
                .from('customer_shares')
                .select('*')
                .eq('customer_id', customer.id);

            if (shareError) throw shareError;

            // Fetch names for shares
            let sharesWithNames: ShareRecord[] = [];
            if (shares && shares.length > 0) {
                const userIds = shares.map(s => s.shared_with);
                const { data: users } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
                sharesWithNames = shares.map(s => ({
                    ...s,
                    user_name: users?.find(u => u.id === s.shared_with)?.full_name || 'Unknown'
                }));
            }
            setExistingShares(sharesWithNames);

            // 2. Fetch Available Users to Share
            // Exclude: Self, Creator, Sales Rep, Already Shared
            // Logic: Get all active users, then filter
            // 2. Fetch Available Users to Share
            // Exclude: Self, Creator, Sales Rep, Already Shared
            // Logic: Get all active users, then filter
            const { data: allUsers } = await supabase.from('profiles').select('id, full_name, role, manager_id').eq('status', 'active');

            if (allUsers) {
                const excludedIds = new Set([
                    currentUser?.id,
                    customer.creator_id,
                    ...sharesWithNames.map(s => s.shared_with)
                ]);

                const filteredUsers = allUsers.filter(u => {
                    if (excludedIds.has(u.id)) return false;

                    // Admin sees all
                    if (currentUser.role === 'admin') return true;

                    // --- NON-ADMIN RULES ---
                    const user = u as UserProfile;

                    // 1. Never see Admins
                    if (user.role === 'admin') return false;

                    // 2. Subordinate: Their manager is Me (Always see subordinates)
                    if (user.manager_id === currentUser.id) return true;

                    // 3. Peer: Same VALID manager (See teammates)
                    // IMPORTANT: Only if *I* have a manager. If I have no manager (Root Mod), I see NO peers, only subordinates.
                    if (currentUser.manager_id && user.manager_id === currentUser.manager_id) return true;

                    return false;
                });

                setAvailableUsers(filteredUsers as UserProfile[]);
            }

        } catch (e) {
            console.error("Error fetching share data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!shareForm.recipientId || !customer || !currentUser) return;

        try {
            // Check if already shared (double check)
            const exists = existingShares.find(s => s.shared_with === shareForm.recipientId);
            if (exists) {
                alert("Người này đã được chia sẻ rồi.");
                return;
            }

            const { error } = await supabase.from('customer_shares').insert([{
                customer_id: customer.id,
                shared_by: currentUser.id,
                shared_with: shareForm.recipientId,
                permission: shareForm.permission,
                created_at: new Date().toISOString()
            }]);

            if (error) throw error;

            // Notify
            await supabase.from('interactions').insert([{
                customer_id: customer.id,
                user_id: currentUser.id,
                type: 'note',
                content: `Đã chia sẻ khách hàng cho TVBH ID: ${shareForm.recipientId} với quyền ${shareForm.permission === 'edit' ? 'Chỉnh sửa' : 'Xem'}.`,
                created_at: new Date().toISOString()
            }]);

            setShareForm({ recipientId: '', permission: 'view' });
            fetchData(); // Reload
            alert("Chia sẻ thành công!");

        } catch (e: any) {
            alert("Lỗi chia sẻ: " + e.message);
        }
    };

    const handleRevoke = async (shareId: string, userName?: string) => {
        if (!customer || !currentUser) return;
        try {
            const { error } = await supabase.from('customer_shares').delete().eq('id', shareId);
            if (error) throw error;

            // Notify
            await supabase.from('interactions').insert([{
                customer_id: customer.id,
                user_id: currentUser.id,
                type: 'note',
                content: `Đã hủy quyền chia sẻ của ${userName || 'thành viên'}.`,
                created_at: new Date().toISOString()
            }]);

            setRevokeConfirmId(null);
            fetchData(); // Reload

        } catch (e: any) {
            alert("Lỗi hủy chia sẻ: " + e.message);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Share2 className="text-teal-600" size={20} /> Chia sẻ Khách hàng
                    </h3>
                    <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-teal-600" /></div>
                ) : (
                    <>
                        {/* Share Form */}
                        <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 mb-4 space-y-3">
                            <div>
                                <label className="text-xs font-bold text-teal-800 uppercase mb-1 block">Người nhận (TVBH)</label>
                                <select
                                    className="w-full border border-teal-200 rounded-lg p-2 text-sm outline-none bg-white focus:border-teal-500"
                                    value={shareForm.recipientId}
                                    onChange={e => setShareForm({ ...shareForm, recipientId: e.target.value })}
                                >
                                    <option value="">-- Chọn người nhận --</option>
                                    {availableUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-teal-800 uppercase mb-1 block">Quyền hạn</label>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 border border-teal-200 rounded-lg p-2 text-sm outline-none bg-white focus:border-teal-500"
                                        value={shareForm.permission}
                                        onChange={e => setShareForm({ ...shareForm, permission: e.target.value as any })}
                                    >
                                        <option value="view">Chỉ xem</option>
                                        <option value="edit">Được chỉnh sửa</option>
                                    </select>
                                    <button
                                        onClick={handleShare}
                                        disabled={!shareForm.recipientId}
                                        className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-teal-700 shadow-sm disabled:opacity-50 transition-colors"
                                    >
                                        Chia sẻ
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Existing Shares List */}
                        <div>
                            <h4 className="font-bold text-gray-800 text-sm mb-2 flex justify-between">
                                Đang chia sẻ với: <span className="text-gray-400 font-normal">({existingShares.length})</span>
                            </h4>
                            {existingShares.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    Chưa chia sẻ với ai.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {existingShares.map(share => (
                                        <div key={share.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-teal-200 transition-colors">
                                            {revokeConfirmId === share.id ? (
                                                <div className="flex items-center justify-between w-full gap-2 animate-fade-in">
                                                    <span className="text-xs font-bold text-red-600">Hủy quyền của {share.user_name}?</span>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => setRevokeConfirmId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-bold hover:bg-gray-200">Hủy</button>
                                                        <button onClick={() => handleRevoke(share.id, share.user_name)} className="px-2 py-1 bg-red-600 text-white text-xs rounded font-bold hover:bg-red-700">Đồng ý</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                                                            {share.user_name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-800">{share.user_name}</p>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${share.permission === 'edit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {share.permission === 'edit' ? 'Được sửa' : 'Chỉ xem'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setRevokeConfirmId(share.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ShareCustomerModal;

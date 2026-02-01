
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Customer } from '../types';
import { X, ArrowRightLeft, Loader2, Search } from 'lucide-react';

interface ChangeSalesModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    currentUser: UserProfile | null;
    onSuccess: () => void;
}

const ChangeSalesModal: React.FC<ChangeSalesModalProps> = ({ isOpen, onClose, customer, currentUser, onSuccess }) => {
    const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Confirmation State
    const [confirmData, setConfirmData] = useState<{ rep: UserProfile, type: 'direct' | 'request' } | null>(null);
    const [executing, setExecuting] = useState(false);

    useEffect(() => {
        if (isOpen && currentUser) {
            fetchUsers();
        }
    }, [isOpen, currentUser]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, role, manager_id, status').eq('status', 'active');

            if (allProfiles && currentUser) {
                const filteredUsers = allProfiles.filter(u => {
                    // Exclude self (Requested feature: "Không cần thấy chính mình")
                    if (u.id === currentUser.id) return false;

                    // Admin sees all
                    if (currentUser.role === 'admin') return true;

                    // --- NON-ADMIN RULES ---
                    // 1. Never see Admins
                    if (u.role === 'admin') return false;

                    // 2. Subordinate: Their manager is Me (Always see subordinates)
                    if (u.manager_id === currentUser.id) return true;

                    // 3. Peer: Same VALID manager (See teammates)
                    // IMPORTANT: Only if *I* have a manager. If I have no manager (Root Mod), I see NO peers, only subordinates.
                    if (currentUser.manager_id && u.manager_id === currentUser.manager_id) return true;

                    return false;
                });

                setAvailableUsers(filteredUsers as UserProfile[]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePrepareChange = (rep: UserProfile) => {
        if (!currentUser) return;
        const isAdmin = currentUser.role === 'admin';
        const isMod = currentUser.role === 'mod';
        const isManagerOfRep = rep.manager_id === currentUser.id;

        // Determine if Direct or Request
        // Admin: Always Direct
        // Mod: Direct if managing the rep or if rep is self? (Transfer TO self is direct usually)
        // Sales: Always Request (unless logic says otherwise)

        let type: 'direct' | 'request' = 'request';
        if (isAdmin) type = 'direct';
        else if (isMod && (isManagerOfRep || rep.id === currentUser.id)) type = 'direct'; // Mod assigning to team member or self

        // However, if assigning TO someone else outside team? Mod might request.
        // For simplicity, let's stick to this.

        setConfirmData({ rep, type });
    };

    const handleExecute = async () => {
        if (!confirmData || !customer || !currentUser) return;
        setExecuting(true);
        try {
            if (confirmData.type === 'direct') {
                // Direct Update
                const { error } = await supabase.from('customers').update({
                    sales_rep: confirmData.rep.full_name,
                    creator_id: confirmData.rep.id // Update ownership ID
                }).eq('id', customer.id);
                if (error) throw error;

                // Log
                await supabase.from('interactions').insert([{
                    customer_id: customer.id, user_id: currentUser.id, type: 'note',
                    content: `Đã chuyển quyền chăm sóc cho ${confirmData.rep.full_name}.`,
                    created_at: new Date().toISOString()
                }]);
                alert("Chuyển quyền thành công!");
                onSuccess();
                onClose();

            } else {
                // Request Transfer
                const { error } = await supabase.from('customers').update({
                    pending_transfer_to: confirmData.rep.id
                }).eq('id', customer.id);
                if (error) throw error;

                // Log
                await supabase.from('interactions').insert([{
                    customer_id: customer.id, user_id: currentUser.id, type: 'note',
                    content: `Đã gửi yêu cầu chuyển khách cho ${confirmData.rep.full_name}.`,
                    created_at: new Date().toISOString()
                }]);

                alert("Đã gửi yêu cầu chuyển quyền!");
                onClose();
            }

        } catch (e: any) {
            alert("Lỗi: " + e.message);
        } finally {
            setExecuting(false);
        }
    };

    const filteredUsers = availableUsers.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
            {/* Main List Modal */}
            {!confirmData ? (
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 max-h-[80vh] flex flex-col shadow-2xl">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ArrowRightLeft className="text-blue-600" size={20} /> Chuyển quyền CS
                        </h3>
                        <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                    </div>

                    {/* Search */}
                    <div className="mb-4 relative shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                            placeholder="Tìm nhân viên..."
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>
                        ) : filteredUsers.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-4">Không tìm thấy nhân viên.</p>
                        ) : (
                            filteredUsers.map(emp => (
                                <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => handlePrepareChange(emp)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-blue-50 transition-colors text-left group cursor-pointer hover:border-blue-100"
                                >
                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 group-hover:bg-blue-200 group-hover:text-blue-700 shrink-0">
                                        {emp.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 group-hover:text-blue-900 transition-colors">{emp.full_name}</p>
                                        <p className="text-xs text-gray-500 capitalize">{emp.role}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* Confirmation View */
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <ArrowRightLeft size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {confirmData.type === 'direct' ? 'Xác nhận chuyển Sales?' : 'Gửi yêu cầu chuyển?'}
                        </h3>
                        <p className="text-gray-500 text-sm mb-6 px-4">
                            {confirmData.type === 'direct'
                                ? <>Bạn có chắc muốn chuyển khách hàng này cho <strong>{confirmData.rep.full_name}</strong>?</>
                                : <>Bạn muốn gửi yêu cầu chuyển khách cho <strong>{confirmData.rep.full_name}</strong>?</>
                            }
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setConfirmData(null)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Quay lại
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={executing}
                                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2"
                            >
                                {executing && <Loader2 className="animate-spin" size={16} />}
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChangeSalesModal;

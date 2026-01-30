import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { X, CheckCircle2, XCircle, FileText, DollarSign, UserCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { Customer, Transaction, CustomerStatus, UserProfile } from '../types';

interface ApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose }) => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const [activeTab, setActiveTab] = useState<'customers' | 'finance'>('customers');
    const [loading, setLoading] = useState(false);

    // Data
    const [pendingCustomers, setPendingCustomers] = useState<Customer[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);

    // Action Loading
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchPendingItems();
        }
    }, [isOpen, userProfile]);

    const fetchPendingItems = async () => {
        setLoading(true);
        try {
            // 1. Fetch Customers
            let custQuery = supabase.from('customers')
                .select('*')
                .or('status.eq.Chờ duyệt chốt,status.eq.Chờ duyệt hủy,deal_status.eq.suspended_pending,deal_status.eq.refund_pending,pending_transfer_to.not.is.null');

            // 2. Fetch Transactions
            let transQuery = supabase.from('transactions')
                .select('*')
                .eq('status', 'pending');

            // Isolation: Admin sees all. Mod sees team.
            if (!isAdmin && isMod && userProfile?.id) {
                // For Customers: Check creator's manager
                // Complex query via Supabase is hard for "creator.manager_id". 
                // Easier: Fetch all then filter in JS for now, or use join. 
                // Given the scale, JS filter is safer for logic correctness first.
                // Limit to 1000 to be safe.
            }

            const [custRes, transRes] = await Promise.all([custQuery, transQuery]);

            if (custRes.data) {
                let custs = custRes.data as Customer[];
                // Filter for MOD
                if (!isAdmin && isMod) {
                    // We need to fetch profiles of creators to check team
                    // Optimization: Just check if creator_id is in my team list?
                    // For MVP: Let's assume Mod sees all for now OR fetch profiles.
                    // Better: Fetch profiles cache.
                    const { data: profiles } = await supabase.from('profiles').select('id, manager_id');
                    const myTeamIds = profiles?.filter(p => p.manager_id === userProfile.id).map(p => p.id) || [];
                    custs = custs.filter(c => c.creator_id === userProfile.id || myTeamIds.includes(c.creator_id || ''));
                }
                setPendingCustomers(custs);
            }

            if (transRes.data) {
                let trans = transRes.data as Transaction[];
                if (!isAdmin && isMod) {
                    const { data: profiles } = await supabase.from('profiles').select('id, manager_id');
                    const myTeamIds = profiles?.filter(p => p.manager_id === userProfile?.id).map(p => p.id) || [];
                    trans = trans.filter(t => t.user_id === userProfile?.id || myTeamIds.includes(t.user_id));
                }
                setPendingTransactions(trans);
            }

        } catch (e) {
            console.error("Error fetching approvals", e);
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS ---

    const handleApproveCustomer = async (c: Customer) => {
        setProcessingId(c.id);
        try {
            let updates: any = {};
            let note = '';

            if (c.status === 'Chờ duyệt chốt') {
                updates = {
                    status: 'Chốt đơn',
                    deal_status: 'processing',
                    won_at: new Date().toISOString()
                };
                note = 'Đã duyệt Chốt đơn (Approval Center).';

                // Auto Deposit Progress
                if (c.delivery_progress) {
                    updates.delivery_progress = {
                        ...c.delivery_progress,
                        deposited: { completed: true, timestamp: new Date().toISOString() }
                    };
                }

                // Add Revenue Transaction if needed
                if (c.deal_details?.revenue) {
                    await supabase.from('transactions').insert([{
                        customer_id: c.id,
                        customer_name: c.name,
                        user_id: c.creator_id,
                        // Need user name? We might miss it. It's okay.
                        type: 'revenue',
                        amount: c.deal_details.revenue,
                        reason: 'Doanh thu dự kiến (Duyệt chốt)',
                        status: 'approved'
                    }]);
                }

            } else if (c.status === 'Chờ duyệt hủy') {
                updates = { status: 'Đã hủy' };
                note = 'Đã duyệt Hủy đơn.';
            } else if (c.deal_status === 'suspended_pending') {
                updates = { deal_status: 'suspended' };
                note = 'Đã duyệt Treo hồ sơ.';
            } else if (c.deal_status === 'refund_pending') {
                updates = { deal_status: 'refunded' };
                note = 'Đã duyệt Hoàn tiền.';
            } else if (c.pending_transfer_to) {
                // Fetch new rep Name
                const { data: u } = await supabase.from('profiles').select('full_name').eq('id', c.pending_transfer_to).single();
                updates = {
                    sales_rep: u?.full_name || 'Unknown',
                    creator_id: c.pending_transfer_to,
                    pending_transfer_to: null
                };
                note = `Đã duyệt chuyển khách sang ${u?.full_name}.`;
            }

            await supabase.from('customers').update(updates).eq('id', c.id);
            await supabase.from('interactions').insert([{ customer_id: c.id, user_id: userProfile?.id, type: 'note', content: note }]);

            // Remove from list
            setPendingCustomers(prev => prev.filter(item => item.id !== c.id));

        } catch (e) {
            alert('Lỗi duyệt: ' + e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectCustomer = async (c: Customer) => {
        setProcessingId(c.id);
        try {
            let updates: any = {};
            let note = '';

            if (c.status === 'Chờ duyệt chốt') {
                updates = { status: 'Tiềm năng' }; // Back to Potential
                note = 'Từ chối duyệt Chốt đơn.';
            } else if (c.status === 'Chờ duyệt hủy') {
                updates = { status: 'Tiềm năng' }; // Back to active? Or keep current? Usually back to active processing?
                // Actually if they requested Lost from Won, it might be tricky. Assume back to Potential for now.
                note = 'Từ chối duyệt Hủy.';
            } else if (c.deal_status === 'suspended_pending') {
                updates = { deal_status: 'processing' };
                note = 'Từ chối treo hồ sơ.';
            } else if (c.deal_status === 'refund_pending') {
                updates = { deal_status: 'processing' }; // Back to processing
                note = 'Từ chối hoàn tiền.';
            } else if (c.pending_transfer_to) {
                updates = { pending_transfer_to: null };
                note = 'Từ chối chuyển quyền.';
            }

            await supabase.from('customers').update(updates).eq('id', c.id);
            await supabase.from('interactions').insert([{ customer_id: c.id, user_id: userProfile?.id, type: 'note', content: note }]);
            setPendingCustomers(prev => prev.filter(item => item.id !== c.id));
        } catch (e) {
            alert('Lỗi từ chối: ' + e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveTransaction = async (t: Transaction) => {
        setProcessingId(t.id);
        try {
            await supabase.from('transactions').update({
                status: 'approved',
                approved_by: userProfile?.id
            }).eq('id', t.id);
            setPendingTransactions(prev => prev.filter(item => item.id !== t.id));
        } catch (e) {
            alert('Lỗi duyệt: ' + e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectTransaction = async (t: Transaction) => {
        setProcessingId(t.id);
        try {
            await supabase.from('transactions').update({
                status: 'rejected',
                approved_by: userProfile?.id
            }).eq('id', t.id);
            setPendingTransactions(prev => prev.filter(item => item.id !== t.id));
        } catch (e) {
            alert('Lỗi từ chối: ' + e);
        } finally {
            setProcessingId(null);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN').format(val);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="text-primary-600" /> Trung tâm Phê duyệt
                        </h2>
                        <p className="text-xs text-slate-500">Duyệt nhanh các yêu cầu từ nhân sự</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'customers' ? 'border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <UserCheck size={16} />
                        Khách hàng
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 rounded-full text-xs">
                            {pendingCustomers.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('finance')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'finance' ? 'border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <DollarSign size={16} />
                        Tài chính
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 rounded-full text-xs">
                            {pendingTransactions.length}
                        </span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-primary-600" size={32} />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'customers' && (
                                <div className="space-y-3">
                                    {pendingCustomers.length === 0 ? <p className="text-center text-slate-400 py-10">Không có yêu cầu nào.</p> :
                                        pendingCustomers.map(c => (
                                            <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">{c.name}</h3>
                                                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">{c.sales_rep || 'Unknown Sales'}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                                        Yêu cầu: <span className="font-bold text-red-600">
                                                            {c.status === 'Chờ duyệt chốt' && 'Duyệt Chốt Đơn'}
                                                            {c.status === 'Chờ duyệt hủy' && 'Duyệt Hủy Đơn'}
                                                            {c.deal_status === 'suspended_pending' && 'Duyệt Treo Hồ Sơ'}
                                                            {c.deal_status === 'refund_pending' && 'Duyệt Hoàn Tiền'}
                                                            {c.pending_transfer_to && 'Duyệt Chuyển Quyền'}
                                                        </span>
                                                    </p>
                                                    {c.deal_details?.revenue && <p className="text-xs text-slate-500">Giá trị: {formatCurrency(c.deal_details.revenue)} đ</p>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        disabled={processingId === c.id}
                                                        onClick={() => handleRejectCustomer(c)}
                                                        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                                    >
                                                        Từ chối
                                                    </button>
                                                    <button
                                                        disabled={processingId === c.id}
                                                        onClick={() => handleApproveCustomer(c)}
                                                        className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm shadow-primary-200 transaction-colors flex items-center gap-2"
                                                    >
                                                        {processingId === c.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                                        Duyệt ngay
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}

                            {activeTab === 'finance' && (
                                <div className="space-y-3">
                                    {pendingTransactions.length === 0 ? <p className="text-center text-slate-400 py-10">Không có giao dịch nào.</p> :
                                        pendingTransactions.map(t => (
                                            <div key={t.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${t.type === 'advance' ? 'bg-orange-100 text-orange-700' :
                                                                t.type === 'expense' ? 'bg-red-100 text-red-700' :
                                                                    t.type === 'deposit' ? 'bg-green-100 text-green-700' :
                                                                        t.type === 'loan' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'
                                                            }`}>
                                                            {t.type === 'advance' ? 'Ứng lương' : t.type === 'expense' ? 'Chi quỹ' : t.type === 'loan' ? 'Mượn tiền' : t.type}
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.user_name}</span>
                                                    </div>
                                                    <p className="text-lg font-bold text-primary-600 mb-1">{formatCurrency(t.amount)} đ</p>
                                                    <p className="text-sm text-slate-500 italic">" {t.reason} "</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        disabled={processingId === t.id}
                                                        onClick={() => handleRejectTransaction(t)}
                                                        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg"
                                                    >
                                                        Từ chối
                                                    </button>
                                                    <button
                                                        disabled={processingId === t.id}
                                                        onClick={() => handleApproveTransaction(t)}
                                                        className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm shadow-primary-200 flex items-center gap-2"
                                                    >
                                                        {processingId === t.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                                        Duyệt
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApprovalModal;

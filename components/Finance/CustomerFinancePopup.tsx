import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Customer, Transaction, UserProfile } from '../../types';
import {
    ArrowDownLeft,
    ArrowUpRight,
    CheckCircle2,
    Trash2,
    X,
    AlertTriangle,
    Loader2,
    ExternalLink,
    Wallet,
    Calendar,
    User
} from 'lucide-react';
import TransactionModal from './TransactionModal';

interface CustomerFinancePopupProps {
    customer: Customer;
    onClose: () => void;
    userProfile: UserProfile | null;
}

const CustomerFinancePopup: React.FC<CustomerFinancePopupProps> = ({ customer, onClose }) => {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

    // Modal State
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState<'revenue' | 'expense'>('revenue');

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch transactions
                const { data: transData, error: transError } = await supabase
                    .from('customer_transactions')
                    .select('*')
                    .eq('customer_id', customer.id)
                    .order('transaction_date', { ascending: false });

                if (transError) throw transError;

                if (isMounted) {
                    setTransactions(transData as unknown as Transaction[]);
                }

                // Extract User IDs for Profiles
                const userIds = Array.from(new Set((transData || []).map((t: any) => t.created_by || t.user_id)));

                if (userIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', userIds);

                    if (isMounted && profiles) {
                        const pMap: Record<string, string> = {};
                        profiles.forEach(p => pMap[p.id] = p.full_name);
                        setProfilesMap(pMap);
                    }
                }
            } catch (e) {
                console.error("Error loading finance data:", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [customer.id]);

    const formatCurrency = (val: number) => val.toLocaleString('vi-VN');

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) return;
        try {
            const { error } = await supabase.from('customer_transactions').delete().eq('id', id);
            if (error) throw error;
            setTransactions(prev => prev.filter(t => t.id !== id));
        } catch (e: any) {
            alert("Lỗi xóa: " + e.message);
        }
    };

    const handleOpenModal = (type: 'revenue' | 'expense') => {
        setTransactionType(type);
        setIsTransactionModalOpen(true);
    };

    const stats = useMemo(() => {
        const income = transactions.filter(t => t.type === 'revenue' || (t as any).type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return { income, expense, balance: income - expense };
    }, [transactions]);

    return (
        <div className="fixed inset-0 z-[100] flex justify-center items-center bg-black/50 transition-opacity duration-200">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden ring-1 ring-black/5 mx-4">

                {/* HEAD: Clean & Minimal */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start bg-white z-10 sticky top-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{customer.name}</h2>
                            {(customer as any).finance_status === 'completed' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">Đã hoàn thành</span>
                            )}
                        </div>
                        <button
                            onClick={() => navigate(`/customers/${customer.id}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200 hover:border-blue-200"
                        >
                            Chi tiết hồ sơ <ExternalLink size={12} />
                        </button>

                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-all border border-transparent hover:border-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* STATS: Modern Cards */}
                <div className="p-6 grid grid-cols-3 gap-4 bg-gray-50/50">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tổng Thu</span>
                        <span className="text-lg font-bold text-emerald-600">+{formatCurrency(stats.income)}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tổng Chi</span>
                        <span className="text-lg font-bold text-rose-600">-{formatCurrency(stats.expense)}</span>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 rounded-xl text-white shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl"></div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1 relative z-10">Thực Nhận</span>
                        <span className={`text-xl font-bold relative z-10 ${stats.balance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                            {formatCurrency(stats.balance)}
                        </span>
                    </div>
                </div>

                {/* ACTIONS */}
                <div className="px-6 py-2 bg-white space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleOpenModal('revenue')}
                            className="py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition-all border border-emerald-100 flex justify-center items-center gap-2 text-sm active:scale-95"
                        >
                            <ArrowDownLeft size={16} /> Thêm Khoản Thu
                        </button>
                        <button
                            onClick={() => handleOpenModal('expense')}
                            className="py-2.5 bg-rose-50 text-rose-700 font-bold rounded-lg hover:bg-rose-100 transition-all border border-rose-100 flex justify-center items-center gap-2 text-sm active:scale-95"
                        >
                            <ArrowUpRight size={16} /> Thêm Khoản Chi
                        </button>
                    </div>

                    {(customer as any).finance_status !== 'completed' && (
                        <button
                            onClick={async () => {
                                if (!window.confirm("Xác nhận hoàn thành thu/chi? Khách sẽ chuyển sang tab 'Đã hoàn thành'.")) return;
                                try {
                                    const { error } = await supabase.from('customers').update({ finance_status: 'completed' }).eq('id', customer.id);
                                    if (error) throw error;
                                    window.location.reload();
                                } catch (e: any) {
                                    alert("Lỗi: " + e.message);
                                }
                            }}
                            className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-all flex justify-center items-center gap-2 text-sm shadow-md active:scale-95"
                        >
                            <CheckCircle2 size={16} /> Hoàn thành Thu/Chi
                        </button>
                    )}
                </div>

                {/* LIST: Transactions */}
                <div className="flex-1 overflow-y-auto px-6 py-4 bg-white border-t border-gray-100 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-full py-8">
                            <Loader2 className="animate-spin text-gray-300" size={24} />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-gray-300 gap-2">
                            <Wallet size={32} className="opacity-20" />
                            <p className="text-sm italic">Chưa có giao dịch phát sinh</p>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-4">
                            {transactions.map(t => (
                                <div
                                    key={t.id}
                                    className="group flex justify-between items-center p-3.5 rounded-xl border border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-200"
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${['revenue', 'deposit'].includes(t.type) ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            {['revenue', 'deposit'].includes(t.type) ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{t.reason}</p>
                                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 font-medium">
                                                <span className="flex items-center gap-0.5"><Calendar size={10} /> {new Date(t.transaction_date || t.created_at).toLocaleDateString('vi-VN')}</span>
                                                <span className="w-0.5 h-0.5 bg-gray-300 rounded-full"></span>
                                                <span className="flex items-center gap-0.5"><User size={10} /> {profilesMap[(t as any).created_by || t.user_id] || 'Unknown'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <p className={`font-bold text-sm ${['revenue', 'deposit'].includes(t.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {['revenue', 'deposit'].includes(t.type) ? '+' : '-'}{formatCurrency(t.amount)}
                                        </p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t.id); }}
                                            className="text-gray-300 hover:text-rose-500 transition-colors p-1.5 rounded-md hover:bg-rose-50 opacity-0 group-hover:opacity-100"
                                            title="Xóa giao dịch"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Components */}
            <TransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => setIsTransactionModalOpen(false)}
                onSuccess={() => { setIsTransactionModalOpen(false); navigate(0); }}
                customer={customer}
                type={transactionType}
            />
        </div>
    );
};

export default CustomerFinancePopup;

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { FundPeriod, Customer, Transaction, CustomerStatus } from '../types';
import {
    History, Calendar, DollarSign, Users, TrendingUp, ArrowLeft, Lock, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FinanceHistory: React.FC = () => {
    const { isAdmin, isMod } = useAuth();
    const navigate = useNavigate();

    // State
    const [completedFunds, setCompletedFunds] = useState<FundPeriod[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Access check
    useEffect(() => {
        if (!isAdmin && !isMod) {
            navigate('/');
        }
    }, [isAdmin, isMod, navigate]);

    // Fetch completed fund periods
    useEffect(() => {
        const fetchCompletedFunds = async () => {
            const { data } = await supabase
                .from('fund_periods')
                .select('*')
                .eq('is_completed', true)
                .order('completed_at', { ascending: false });

            if (data) {
                setCompletedFunds(data as FundPeriod[]);
                if (data.length > 0) {
                    setSelectedPeriodId(data[0].id);
                }
            }
            setLoading(false);
        };

        fetchCompletedFunds();
    }, []);

    // Fetch data for selected period
    useEffect(() => {
        const fetchPeriodData = async () => {
            if (!selectedPeriodId) return;

            const period = completedFunds.find(p => p.id === selectedPeriodId);
            if (!period) return;

            let customerQuery = supabase.from('customers').select('*');
            customerQuery = customerQuery.gte('created_at', period.start_date);
            if (period.end_date) {
                customerQuery = customerQuery.lte('created_at', period.end_date + 'T23:59:59');
            }

            const { data: custData } = await customerQuery;
            if (custData) setCustomers(custData as Customer[]);

            let transQuery = supabase.from('transactions').select('*');
            transQuery = transQuery.gte('created_at', period.start_date);
            if (period.end_date) {
                transQuery = transQuery.lte('created_at', period.end_date + 'T23:59:59');
            }

            const { data: transData } = await transQuery;
            if (transData) setTransactions(transData as Transaction[]);
        };

        fetchPeriodData();
    }, [selectedPeriodId, completedFunds]);

    const selectedPeriod = useMemo(() =>
        completedFunds.find(p => p.id === selectedPeriodId),
        [completedFunds, selectedPeriodId]
    );

    const stats = useMemo(() => {
        const isMKT = (src?: string) => (src || '').toUpperCase().includes('MKT');

        const mktCustomers = customers.filter(c =>
            isMKT(c.source) &&
            c.status === CustomerStatus.WON &&
            !['suspended', 'suspended_pending', 'refunded', 'refund_pending'].includes(c.deal_status || '')
        );

        const totalRevenue = transactions
            .filter(t => ['revenue', 'deposit'].includes(t.type) && t.status === 'approved')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = transactions
            .filter(t => ['expense', 'advance'].includes(t.type) && t.status === 'approved')
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            totalCustomers: mktCustomers.length,
            totalRevenue,
            totalExpense,
            netProfit: totalRevenue - totalExpense
        };
    }, [customers, transactions]);

    const formatCurrency = (n: number) => Math.round(n).toLocaleString('vi-VN');
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            </div>
        );
    }

    if (!isAdmin && !isMod) return null;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/fund')}
                            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <History className="text-amber-600" />
                                Lịch sử Quỹ đã hoàn thành
                            </h1>
                            <p className="text-gray-500 text-sm">Xem lại các kỳ quỹ đã đóng và hoàn thành</p>
                        </div>
                    </div>
                </div>

                {/* Period Selector */}
                {completedFunds.length > 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Lock size={18} className="text-amber-600" />
                                <span className="font-bold text-gray-700">Chọn kỳ quỹ:</span>
                            </div>
                            <select
                                value={selectedPeriodId}
                                onChange={(e) => setSelectedPeriodId(e.target.value)}
                                className="flex-1 max-w-md border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-200"
                            >
                                {completedFunds.map(period => (
                                    <option key={period.id} value={period.id}>
                                        {period.name} ({formatDate(period.start_date)} - {formatDate(period.end_date)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedPeriod && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Ngày bắt đầu:</span>
                                        <p className="font-bold text-gray-800">{formatDate(selectedPeriod.start_date)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Ngày kết thúc:</span>
                                        <p className="font-bold text-gray-800">{formatDate(selectedPeriod.end_date)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Ngày đóng:</span>
                                        <p className="font-bold text-gray-800">{formatDate(selectedPeriod.closed_at)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Ngày hoàn thành:</span>
                                        <p className="font-bold text-green-600">{formatDate(selectedPeriod.completed_at)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                        <History size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-500">Chưa có quỹ nào được hoàn thành</h3>
                        <p className="text-gray-400 mt-2">Khi bạn đánh dấu Hoàn thành một quỹ, nó sẽ xuất hiện ở đây.</p>
                        <button
                            onClick={() => navigate('/fund')}
                            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all"
                        >
                            Quay lại Quỹ & Thu Chi
                        </button>
                    </div>
                )}

                {/* Stats Cards */}
                {selectedPeriod && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Users className="text-blue-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Khách MKT (WON)</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                    <DollarSign className="text-green-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Tổng Thu</p>
                                    <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                    <TrendingUp className="text-red-600" size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Tổng Chi</p>
                                    <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalExpense)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 ${stats.netProfit >= 0 ? 'bg-emerald-100' : 'bg-orange-100'} rounded-xl flex items-center justify-center`}>
                                    <Calendar className={stats.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'} size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Lợi nhuận ròng</p>
                                    <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                        {formatCurrency(stats.netProfit)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Transaction Summary */}
                {selectedPeriod && transactions.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Eye size={18} /> Giao dịch trong kỳ ({transactions.length})
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="text-left py-3 px-2 text-gray-500">Ngày</th>
                                        <th className="text-left py-3 px-2 text-gray-500">Loại</th>
                                        <th className="text-left py-3 px-2 text-gray-500">Nội dung</th>
                                        <th className="text-right py-3 px-2 text-gray-500">Số tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.slice(0, 20).map(t => (
                                        <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-3 px-2 text-gray-600">{formatDate(t.created_at)}</td>
                                            <td className="py-3 px-2">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${['revenue', 'deposit'].includes(t.type) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-gray-800">{t.reason || '-'}</td>
                                            <td className={`py-3 px-2 text-right font-bold ${['revenue', 'deposit'].includes(t.type) ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {['revenue', 'deposit'].includes(t.type) ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {transactions.length > 20 && (
                                <p className="text-center text-gray-400 text-sm mt-4">
                                    Hiển thị 20 / {transactions.length} giao dịch
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinanceHistory;

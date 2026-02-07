import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Transaction } from '../types';
import CustomerFinancePopup from '../components/Finance/CustomerFinancePopup';
import { removeAccents } from '../utils/stringUtils';
import {
    BadgeDollarSign,
    Wallet,
    Search,
    ArrowUpRight,
    Loader2,
    Filter,
} from 'lucide-react';
import * as ReactRouterDOM from 'react-router-dom';

const CustomerFinance: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();

    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [displayedCustomers, setDisplayedCustomers] = useState<{ customer: Customer, stats: { income: number, expense: number, balance: number } }[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

    const [teams, setTeams] = useState<{ id: string, full_name: string }[]>([]);
    const [teamMembers, setTeamMembers] = useState<{ id: string, full_name: string, manager_id: string }[]>([]);

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [selectedMember, setSelectedMember] = useState<string>('all');

    const formatCurrency = (val: number) => val.toLocaleString('vi-VN');

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                // 0. Fetch Profiles & Teams
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, manager_id, role');

                const tMembers: { id: string, full_name: string, manager_id: string }[] = [];
                const managers: { id: string, full_name: string }[] = [];

                profiles?.forEach(p => {
                    tMembers.push({ id: p.id, full_name: p.full_name, manager_id: p.manager_id || '' });
                    if (p.role === 'mod') managers.push({ id: p.id, full_name: p.full_name });
                });

                setTeamMembers(tMembers);
                setTeams(managers);

                // Set default filters based on role
                if (isMod && userProfile) {
                    setSelectedTeam(userProfile.id);
                }

                // 1. Fetch Customers
                const { data: custData, error: custError } = await supabase.from('customers').select('*')
                    .eq('status', 'Chốt đơn')
                    .in('deal_status', ['processing', 'suspended'])
                    .order('updated_at', { ascending: false });

                if (custError) throw custError;

                // 2. Fetch ALL Transactions
                const { data: transData, error: transError } = await supabase
                    .from('customer_transactions')
                    .select('*');

                if (transError) throw transError;

                setAllTransactions(transData as unknown as Transaction[]);
                setCustomers(custData as Customer[]);

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [userProfile]);


    const location = ReactRouterDOM.useLocation();

    // Efficient Stats Calculation
    const customerStatsMap = useMemo(() => {
        const map: Record<string, { income: number, expense: number, balance: number }> = {};
        allTransactions.forEach(t => {
            const cid = t.customer_id;
            if (!cid) return; // Skip generic transactions if any

            if (!map[cid]) map[cid] = { income: 0, expense: 0, balance: 0 };

            if (t.status && t.status !== 'approved') return;

            if (t.type === 'revenue' || (t as any).type === 'deposit') {
                map[cid].income += t.amount;
            } else if (t.type === 'expense') {
                map[cid].expense += t.amount;
            }
        });

        // Finalize balance
        Object.keys(map).forEach(key => {
            map[key].balance = map[key].income - map[key].expense;
        });

        return map;
    }, [allTransactions]);

    const [showMobileFilters, setShowMobileFilters] = useState(false);

    useEffect(() => {
        let filtered = customers;
        // ... (lines 118-178 remain same, but needed to match Context)
        // 1. Tab Filter
        if (activeTab === 'active') {
            filtered = filtered.filter(c => (c as any).finance_status !== 'completed');
        } else {
            filtered = filtered.filter(c => (c as any).finance_status === 'completed');
        }

        // 2. Search Filter
        if (searchTerm) {
            const lowerTerm = removeAccents(searchTerm.toLowerCase());
            filtered = filtered.filter(c => {
                const name = removeAccents(c.name.toLowerCase());
                const phone = c.phone || '';
                const car = removeAccents((c.interest || '').toLowerCase());
                return name.includes(lowerTerm) || phone.includes(lowerTerm) || car.includes(lowerTerm);
            });
        }

        // 3. Team/Member Filter
        if (selectedTeam !== 'all') {
            const validCreators = teamMembers.filter(m => m.manager_id === selectedTeam || m.id === selectedTeam).map(m => m.id);
            filtered = filtered.filter(c => c.creator_id && validCreators.includes(c.creator_id));
        }

        if (selectedMember !== 'all') {
            filtered = filtered.filter(c => c.creator_id === selectedMember);
        }

        const computed = filtered.map(c => {
            const stats = customerStatsMap[c.id] || { income: 0, expense: 0, balance: 0 };
            return { customer: c, stats };
        });

        setDisplayedCustomers(computed);
    }, [customers, customerStatsMap, searchTerm, activeTab, selectedTeam, selectedMember, teamMembers, activeTab]); // Added activeTab to deps if missing

    // Handle deep link for specific customer
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const cid = params.get('customerId');

        if (cid && customers.length > 0) {
            const found = customers.find(c => c.id === cid);
            if (found) {
                if ((found as any).finance_status === 'completed' && activeTab !== 'completed') {
                    setActiveTab('completed');
                }
                if (!searchTerm) {
                    setSearchTerm(found.name);
                }
                setSelectedCustomer(found);
            }
        }
    }, [location.search, customers, activeTab]);

    const summary = useMemo(() => {
        const income = displayedCustomers.reduce((sum, c) => sum + c.stats.income, 0);
        const expense = displayedCustomers.reduce((sum, c) => sum + c.stats.expense, 0);
        return { income, expense, balance: income - expense };
    }, [displayedCustomers]);

    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden relative">

            {/* MOBILE HEADER */}
            <div className="md:hidden bg-white p-4 border-b border-gray-200 flex justify-between items-center shrink-0 z-30">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <BadgeDollarSign className="text-amber-600" size={20} />
                    Tài chính
                </h2>
                <div className="flex items-center gap-2">
                    <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold leading-none flex items-center shadow-sm">
                        {formatCurrency(summary.balance)}
                    </div>
                    <button
                        onClick={() => setShowMobileFilters(true)}
                        className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* LEFT SIDEBAR: SEARCH & FILTERS (Responsive Drawer) */}
            <div className={`
                fixed inset-0 z-50 bg-white md:static md:z-auto md:w-[340px] md:border-r md:border-gray-200 
                flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0
                ${showMobileFilters ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Mobile Close Button Header */}
                <div className="md:hidden p-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Bộ lọc & Thống kê</h3>
                    <button onClick={() => setShowMobileFilters(false)} className="p-2 bg-gray-50 rounded-full text-gray-400">
                        <ArrowUpRight className="rotate-45" size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5">
                    <div className="hidden md:flex items-center gap-2 mb-6">
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <BadgeDollarSign className="text-amber-600" />
                            Tài chính Khách
                        </h2>
                    </div>

                    <div className="space-y-4 md:space-y-5">
                        {/* TABS */}
                        <div className="flex p-1 bg-gray-100 rounded-xl">
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Đang quản lý
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'completed' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Đã hoàn thành
                            </button>
                        </div>

                        {/* SEARCH */}
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-600 transition-colors" size={18} />
                            <input
                                className="w-full bg-white border border-gray-200 rounded-xl md:rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-sm"
                                placeholder="Tìm tên, SĐT, xe..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* FILTERS */}
                        <div className="space-y-3 p-3 md:p-4 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-1 text-xs font-bold text-gray-500 uppercase tracking-wide">
                                <Filter size={12} /> Bộ lọc
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {/* Team Filter (Admin Only) */}
                                {isAdmin && (
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 mb-1 block">Team</label>
                                        <select
                                            value={selectedTeam}
                                            onChange={e => { setSelectedTeam(e.target.value); setSelectedMember('all'); }}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                                        >
                                            <option value="all">Tất cả</option>
                                            {teams.map(t => (
                                                <option key={t.id} value={t.id}>{t.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Member Filter */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">Nhân viên</label>
                                    <select
                                        value={selectedMember}
                                        onChange={e => setSelectedMember(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="all">Tất cả</option>
                                        {teamMembers
                                            .filter(m => selectedTeam === 'all' || m.manager_id === selectedTeam || m.id === selectedTeam)
                                            .map(m => (
                                                <option key={m.id} value={m.id}>{m.full_name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* STATS SUMMARY (New Layout) */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-emerald-50/80 p-3 md:p-4 rounded-xl md:rounded-2xl border border-emerald-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <ArrowUpRight className="text-emerald-600" size={32} />
                                </div>
                                <p className="text-emerald-600 text-[10px] font-black uppercase mb-1">Tổng Thu (Revenue)</p>
                                <p className="text-lg md:text-xl font-black text-emerald-700">+{formatCurrency(summary.income)}</p>
                            </div>
                            <div className="bg-red-50/80 p-3 md:p-4 rounded-xl md:rounded-2xl border border-red-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <ArrowUpRight className="text-red-600 rotate-180" size={32} />
                                </div>
                                <p className="text-red-500 text-[10px] font-black uppercase mb-1">Tổng Chi (Expense)</p>
                                <p className="text-lg md:text-xl font-black text-red-600">-{formatCurrency(summary.expense)}</p>
                            </div>
                            <div className="bg-slate-900 p-3 md:p-4 rounded-xl md:rounded-2xl text-white shadow-lg shadow-slate-200 relative overflow-hidden">
                                <div className="absolute -right-4 -bottom-4 bg-white/5 rounded-full w-20 h-20" />
                                <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Thực Nhận (Net)</p>
                                <p className={`text-2xl font-black ${summary.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                    {formatCurrency(summary.balance)} <span className="text-sm font-medium opacity-50">đ</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Apply Button */}
                    <div className="md:hidden mt-6 pb-20">
                        <button
                            onClick={() => setShowMobileFilters(false)}
                            className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-200 active:scale-95 transition-transform"
                        >
                            Áp dụng bộ lọc
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN GRID CONTENT */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-3 md:p-6">
                {loading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-amber-600" size={32} /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 pb-20">
                        {displayedCustomers.map(({ customer: c, stats }) => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedCustomer(c)}
                                className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group relative animate-fade-in-up cursor-pointer hover:border-amber-400/50 hover:-translate-y-1"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-base md:text-lg line-clamp-1" title={c.name}>{c.name}</h3>
                                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mt-1">
                                            {/* Distributor info removal respected */}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-gray-50 text-gray-300 rounded-lg group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                                        <ArrowUpRight size={18} />
                                    </div>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 font-medium">Tổng thu</span>
                                        <span className="font-bold text-emerald-600">+{formatCurrency(stats.income)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 font-medium">Tổng chi</span>
                                        <span className="font-bold text-red-500">-{formatCurrency(stats.expense)}</span>
                                    </div>
                                    <div className="pt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                                        <span className="text-gray-900 font-bold text-sm uppercase">Thực nhận</span>
                                        <span className={`font-black text-lg ${stats.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                            {formatCurrency(stats.balance)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {displayedCustomers.length === 0 && (
                            <div className="col-span-full text-center py-20 text-gray-400 flex flex-col items-center">
                                <Wallet size={48} className="mb-4 text-gray-200" />
                                <p>Không có dữ liệu hiển thị (Tab: {activeTab === 'active' ? 'Đang quản lý' : 'Đã hoàn thành'})</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* DETAIL POPUP (Replaced Overlay) */}
            {selectedCustomer && (
                <CustomerFinancePopup
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    userProfile={userProfile}
                />
            )}
        </div>
    );
};

export default CustomerFinance;

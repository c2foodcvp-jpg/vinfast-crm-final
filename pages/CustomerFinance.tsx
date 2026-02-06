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
    const [distributorMap, setDistributorMap] = useState<Record<string, string>>({});

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
                // 0. Fetch Profiles, Teams & Distributors
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, manager_id, role');
                const { data: distributors } = await supabase.from('distributors').select('id, name');

                const tMembers: { id: string, full_name: string, manager_id: string }[] = [];
                const managers: { id: string, full_name: string }[] = [];
                const dMap: Record<string, string> = {};

                distributors?.forEach(d => { dMap[d.id] = d.name; });
                setDistributorMap(dMap);

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

    useEffect(() => {
        let filtered = customers;

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
    }, [customers, customerStatsMap, searchTerm, activeTab, selectedTeam, selectedMember, teamMembers]);

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
    }, [location.search, customers]);

    // Calculate Summary Stats (Based on FILTERED view)
    const summary = useMemo(() => {
        const income = displayedCustomers.reduce((sum, c) => sum + c.stats.income, 0);
        const expense = displayedCustomers.reduce((sum, c) => sum + c.stats.expense, 0);
        return { income, expense, balance: income - expense };
    }, [displayedCustomers]);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* LEFT SIDEBAR: SEARCH & FILTERS */}
            <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col p-5 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] h-full overflow-y-auto custom-scrollbar">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <BadgeDollarSign className="text-amber-600" />
                    Tài chính Khách
                </h2>

                <div className="space-y-5">
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

                    {/* FILTERS */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-1 text-xs font-bold text-gray-500 uppercase tracking-wide">
                            <Filter size={12} /> Bộ lọc
                        </div>

                        {/* Team Filter (Admin Only) */}
                        {isAdmin && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Team (Quản lý)</label>
                                <select
                                    value={selectedTeam}
                                    onChange={e => { setSelectedTeam(e.target.value); setSelectedMember('all'); }} // Reset member when team changes
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                                >
                                    <option value="all">Tất cả Team</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Member Filter */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 mb-1 block">Nhân viên / Sales</label>
                            <select
                                value={selectedMember}
                                onChange={e => setSelectedMember(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:border-amber-500"
                            >
                                <option value="all">Tất cả nhân viên</option>
                                {teamMembers
                                    .filter(m => selectedTeam === 'all' || m.manager_id === selectedTeam || m.id === selectedTeam) // Filter members by selected team
                                    .map(m => (
                                        <option key={m.id} value={m.id}>{m.full_name}</option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* SEARCH */}
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-600 transition-colors" size={18} />
                        <input
                            className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-sm"
                            placeholder="Tìm tên, SĐT, xe..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* STATS SUMMARY (New Layout) */}
                    <div className="grid grid-cols-1 gap-3">
                        <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                            <p className="text-green-600 text-[10px] font-black uppercase mb-1">Tổng Nhận (Revenue)</p>
                            <p className="text-xl font-black text-green-700">+{formatCurrency(summary.income)}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                            <p className="text-red-500 text-[10px] font-black uppercase mb-1">Tổng Chi (Expense)</p>
                            <p className="text-xl font-black text-red-600">-{formatCurrency(summary.expense)}</p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded-2xl text-white shadow-xl shadow-gray-200">
                            <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Tổng Thực Nhận (Net)</p>
                            <p className={`text-2xl font-black ${summary.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatCurrency(summary.balance)} <span className="text-sm font-medium opacity-50">đ</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN GRID CONTENT */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
                {loading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-amber-600" size={32} /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
                        {displayedCustomers.map(({ customer: c, stats }) => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedCustomer(c)}
                                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all group relative animate-fade-in-up cursor-pointer hover:border-amber-400 hover:ring-1 hover:ring-amber-400"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg line-clamp-1" title={c.name}>{c.name}</h3>
                                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mt-1">
                                            {/* Distributor info removal respected */}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-gray-50 text-gray-400 rounded-lg group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                                        <ArrowUpRight size={18} />
                                    </div>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 font-medium">Tổng thu</span>
                                        <span className="font-bold text-green-600">+{formatCurrency(stats.income)}</span>
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

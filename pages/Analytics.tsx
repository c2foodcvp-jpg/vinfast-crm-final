
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Customer, Transaction, UserProfile, CustomerStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import {
    BarChart2, TrendingUp, TrendingDown, DollarSign, Calendar, Filter, Loader2, Activity, ArrowUp, ArrowDown
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Line, PieChart, Pie, Cell
} from 'recharts';

// Color Palette
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

// Extended Interface for enriched data
interface ExtendedTransaction extends Transaction {
    _source?: string;
    _is_part_time_creator?: boolean;
}

const Analytics: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);

    // Filters
    const [timeRange, setTimeRange] = useState<'this_month' | 'last_month' | 'quarter' | 'year'>('this_month');
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [managers, setManagers] = useState<{ id: string, name: string }[]>([]);

    // Helper: Case-insensitive MKT check
    const isMKT = (src?: string) => (src || '').toUpperCase().includes('MKT');

    useEffect(() => {
        if (!isAdmin && !isMod) {
            navigate('/');
            return;
        }
        fetchData();
    }, [userProfile, isAdmin, isMod]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: profiles } = await supabase.from('profiles').select('*');
            const allProfiles = profiles as UserProfile[] || [];

            let relevantMembers: UserProfile[] = [];
            let teamIds: string[] = [];

            if (isAdmin) {
                relevantMembers = allProfiles;
                const mgrIds = Array.from(new Set(allProfiles.filter(p => p.manager_id).map(p => p.manager_id)));
                const mgrList = mgrIds.map(id => {
                    const m = allProfiles.find(p => p.id === id);
                    return { id: id as string, name: m?.full_name || 'Unknown' };
                }).filter(m => m.name !== 'Unknown');
                setManagers(mgrList);
            } else if (isMod && userProfile) {
                relevantMembers = allProfiles.filter(p => p.id === userProfile.id || p.manager_id === userProfile.id);
            }

            setTeamMembers(relevantMembers);
            teamIds = relevantMembers.map(m => m.id);

            let custQuery = supabase.from('customers').select('*');
            // Optimization: We could filter MKT server side, but keeping client side for now to match structure
            if (!isAdmin) {
                custQuery = custQuery.in('creator_id', teamIds);
            }
            const { data: custData } = await custQuery;
            const customersList = custData as Customer[] || [];
            setCustomers(customersList);

            let transQuery = supabase.from('transactions').select('*').eq('status', 'approved');
            if (!isAdmin) {
                transQuery = transQuery.in('user_id', teamIds);
            }
            const { data: transData } = await transQuery;

            // Enrich Transactions
            const rawTrans = transData as Transaction[] || [];
            const enrichedTrans = rawTrans.map(t => {
                const customer = t.customer_id ? customersList.find(c => c.id === t.customer_id) : null;
                const creator = allProfiles.find(p => p.id === t.user_id);
                return {
                    ...t,
                    _source: customer?.source, // Capture source from customer for MKT check
                    _is_part_time_creator: creator?.is_part_time
                };
            });
            setTransactions(enrichedTrans);

        } catch (e) {
            console.error("Error fetching analytics data", e);
        } finally {
            setLoading(false);
        }
    };

    // --- FILTER LOGIC ---
    const getDateRange = () => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (timeRange === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (timeRange === 'last_month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (timeRange === 'quarter') {
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            end = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59);
        } else {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        }
        return { start, end };
    };

    const filteredData = useMemo(() => {
        const { start, end } = getDateRange();

        let targetUserIds = teamMembers.map(m => m.id);
        if (isAdmin && selectedTeam !== 'all') {
            targetUserIds = teamMembers.filter(m => m.manager_id === selectedTeam || m.id === selectedTeam).map(m => m.id);
        }

        // Filter Customers
        // Logic from Finance.tsx: Status WON, Not Refunded/Suspended, Source MKT
        // Date: won_at || created_at (Effective Date)
        const fCustomers = customers.filter(c => {
            if (c.status !== CustomerStatus.WON) return false;
            if (['refunded', 'suspended', 'suspended_pending', 'refund_pending'].includes(c.deal_status || '')) return false;
            if (!isMKT(c.source)) return false;

            // CRITICAL Fix from Finance: Use won_at (Deal Close) or created_at
            const d = new Date(c.won_at || c.created_at);
            return d >= start && d <= end && c.creator_id && targetUserIds.includes(c.creator_id);
        });

        // Filter Transactions
        const fTransactions = transactions.filter((t: any) => {
            const d = new Date(t.created_at);
            if (!(d >= start && d <= end && targetUserIds.includes(t.user_id))) return false;

            // Strict MKT Logic from Finance.tsx
            if (t.customer_id) {
                if (!isMKT(t._source)) return false;
            }
            return true;
        });

        return { transactions: fTransactions, customers: fCustomers, userIds: targetUserIds };
    }, [transactions, customers, teamMembers, timeRange, selectedTeam, isAdmin]);

    // --- KPI CALCULATIONS (MATCHING FINANCE.TSX) ---
    const kpis = useMemo(() => {
        const { transactions: trans, customers: cust } = filteredData;

        // 1. Projected Revenue (from Won Deals - MKT Only)
        const projectedRevenue = cust.reduce((sum, c) => sum + (c.deal_details?.revenue || 0), 0);

        // 2. Real Revenue (Thực thu) - Finance 'pnlRevenue'
        const revenue = trans
            .filter(t => ['deposit', 'adjustment'].includes(t.type) && t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);

        // 3. Real Expenses (Chi phí thực) - Finance 'realExpenses'
        const expenses = trans
            .filter(t => t.type === 'expense' || (t.type === 'adjustment' && t.amount < 0))
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // 4. Part-time Salary Liability - Finance 'partTimeSalaryLiability'
        const partTimeLiability = trans
            .filter((t: any) => t._is_part_time_creator && t.type === 'deposit')
            .reduce((sum, t) => sum + (t.amount * 0.3), 0);

        // 5. Net Profit (Lợi nhuận ròng) - Finance 'pnlNet'
        const netProfit = revenue - expenses - partTimeLiability;

        const totalCost = expenses + partTimeLiability;

        // 6. Debt (Combined: Projected - Collected)
        // Note: This is a simplified debt view. 
        // Finance usually separates debt per customer.
        // Here we show Aggregate Debt based on FILTERED Period.
        // Debt = (Rev of Deals in Period) - (Deposits in Period). 
        // This is technically cashflow gap, not true debt, but standard for period dashboard.
        const customerDeposits = trans.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
        const debt = Math.max(0, projectedRevenue - customerDeposits);
        const collectionRate = projectedRevenue > 0 ? (customerDeposits / projectedRevenue) * 100 : 0;

        return { projectedRevenue, netProfit, totalCost, debt, collectionRate };
    }, [filteredData]);

    // --- CHART DATA (Updated to use Profit Logic) ---
    const trendData = useMemo(() => {
        const { transactions: trans } = filteredData;

        const data: any[] = [];
        const isYearly = timeRange === 'year';

        // Initialize buckets
        if (isYearly) {
            for (let i = 0; i < 12; i++) data.push({ name: `T${i + 1}`, income: 0, expense: 0, net: 0 });
        }

        // Helper to add data
        const addToBucket = (date: Date, inc: number, exp: number) => {
            const key = isYearly ? `T${date.getMonth() + 1}` : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            let entry = data.find(d => d.name === key);
            if (!entry && !isYearly) {
                entry = { name: key, income: 0, expense: 0, net: 0 };
                data.push(entry);
            }
            if (entry) {
                entry.income += inc;
                entry.expense += exp;
            }
        };

        trans.forEach(t => {
            const d = new Date(t.created_at);
            // Apply same Profit Logic:
            if (['deposit', 'adjustment'].includes(t.type) && t.amount > 0) {
                addToBucket(d, t.amount, 0);
            } else if (['expense'].includes(t.type) || (t.type === 'adjustment' && t.amount < 0)) {
                addToBucket(d, 0, Math.abs(t.amount));
            }

            // Part-time check using Enriched Data
            if (t.type === 'deposit' && t._is_part_time_creator) {
                addToBucket(d, 0, t.amount * 0.3); // Add to Expense
            }
        });

        if (!isYearly) {
            data.sort((a, b) => {
                const [d1, m1] = a.name.split('/');
                const [d2, m2] = b.name.split('/');
                return new Date(2024, parseInt(m1) - 1, parseInt(d1)).getTime() - new Date(2024, parseInt(m2) - 1, parseInt(d2)).getTime();
            });
        }

        data.forEach(d => d.net = d.income - d.expense);
        return data;
    }, [filteredData, timeRange]);

    const sourceData = useMemo(() => {
        const { customers: cust } = filteredData;
        const map: Record<string, number> = {};
        cust.filter(c => c.status === CustomerStatus.WON).forEach(c => {
            let key = c.source || 'Khác';
            if (key.includes('MKT')) key = 'MKT Group';
            else if (key.includes('Showroom')) key = 'Showroom';
            else if (key.includes('Giới Thiệu')) key = 'Giới Thiệu';
            map[key] = (map[key] || 0) + (c.deal_details?.revenue || 0);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [filteredData]);

    const leaderboardData = useMemo(() => {
        const { transactions: trans, userIds } = filteredData;
        const map: Record<string, number> = {};

        trans.forEach(t => {
            if (!userIds.includes(t.user_id)) return;
            // Net Profit Contribution Logic
            if (['deposit', 'revenue'].includes(t.type) && t.amount > 0) {
                const val = t.type === 'deposit' ? t.amount : 0;
                map[t.user_id] = (map[t.user_id] || 0) + val;
            }
            if (t.type === 'expense') {
                map[t.user_id] = (map[t.user_id] || 0) - t.amount;
            }
            // Part-time deduction
            if (t.type === 'deposit') {
                const creator = teamMembers.find(m => m.id === t.user_id);
                if (creator?.is_part_time) {
                    map[t.user_id] = (map[t.user_id] || 0) - (t.amount * 0.3);
                }
            }
        });

        return Object.entries(map).map(([uid, net]) => {
            const user = teamMembers.find(m => m.id === uid);
            return { name: user?.full_name || 'Unknown', net };
        }).sort((a, b) => b.net - a.net).slice(0, 10);
    }, [filteredData, teamMembers]);

    const formatCurrency = (val: number) => {
        if (val >= 1000000000) return (val / 1000000000).toFixed(1) + ' tỷ';
        if (val >= 1000000) return (val / 1000000).toFixed(1) + ' Tr';
        return val.toLocaleString('vi-VN');
    };

    const ChartCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-[400px]">
            <h3 className="font-bold text-gray-800 mb-6">{title}</h3>
            <div className="flex-1 w-full min-h-0">
                {children}
            </div>
        </div>
    );

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="text-indigo-600" /> Phân tích Doanh nghiệp</h1>
                    <p className="text-gray-500">Báo cáo hiệu suất kinh doanh (Net Profit Logic).</p>
                </div>
                <div className="flex flex-wrap gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 px-2 border-r border-gray-100">
                        <Calendar size={16} className="text-gray-400" />
                        <select value={timeRange} onChange={e => setTimeRange(e.target.value as any)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer">
                            <option value="this_month">Tháng này</option>
                            <option value="last_month">Tháng trước</option>
                            <option value="quarter">Quý này</option>
                            <option value="year">Năm nay</option>
                        </select>
                    </div>
                    {isAdmin && (
                        <div className="flex items-center gap-2 px-2">
                            <Filter size={16} className="text-gray-400" />
                            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer">
                                <option value="all">Tất cả Team</option>
                                {managers.map(m => <option key={m.id} value={m.id}>Team {m.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <p className="text-xs font-bold text-indigo-500 uppercase flex items-center gap-1"><DollarSign size={14} /> Lợi nhuận Ròng (Net)</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpis.netProfit)}</h3>
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                        <TrendingUp size={12} /> Đã trừ chi phí
                    </div>
                    <div className="absolute -right-4 -bottom-4 bg-indigo-50 rounded-full w-24 h-24 flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform"><DollarSign size={48} className="text-indigo-200" /></div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <p className="text-xs font-bold text-blue-500 uppercase flex items-center gap-1"><Activity size={14} /> Doanh thu Dự kiến</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpis.projectedRevenue)}</h3>
                    <p className="text-xs text-gray-400 mt-2">Từ các Deal đã chốt (MKT)</p>
                    <div className="absolute -right-4 -bottom-4 bg-blue-50 rounded-full w-24 h-24 flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform"><BarChart2 size={48} className="text-blue-200" /></div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <p className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1"><ArrowDown size={14} /> Công nợ (Chưa thu)</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpis.debt)}</h3>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                        <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${100 - kpis.collectionRate}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">Tỷ lệ thu: {kpis.collectionRate.toFixed(1)}%</p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <p className="text-xs font-bold text-red-500 uppercase flex items-center gap-1"><ArrowUp size={14} /> Tổng Chi Phí</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpis.totalCost)}</h3>
                    <p className="text-xs text-gray-400 mt-2">Gồm Chi quỹ & Lương CTV (Ko tính ứng)</p>
                    <div className="absolute -right-4 -bottom-4 bg-red-50 rounded-full w-24 h-24 flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform"><TrendingDown size={48} className="text-red-200" /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ChartCard title="Xu hướng Lợi nhuận (Thu vs Chi)">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `${val / 1000000}M`} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(val: number) => formatCurrency(val)}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="income" name="Thu" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} stackId="a" />
                                <Bar dataKey="expense" name="Chi phí" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} stackId="a" />
                                <Line type="monotone" dataKey="net" name="Lợi nhuận ròng" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>
                <div>
                    <ChartCard title="Nguồn Doanh thu">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sourceData}
                                    cx="50%" cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {sourceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Top Hiệu suất (Net Profit)</h3>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Top 10</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Nhân viên</th>
                                    <th className="px-6 py-3 text-right">Lợi nhuận đóng góp</th>
                                    <th className="px-6 py-3 text-right">Hiệu quả</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leaderboardData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-bold text-gray-700 flex items-center gap-2">
                                            {idx < 3 && <span className={`text-[10px] w-5 h-5 rounded-full flex items-center justify-center text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}>{idx + 1}</span>}
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-indigo-600">{formatCurrency(item.net)}</td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="w-24 bg-gray-100 rounded-full h-1.5 ml-auto overflow-hidden">
                                                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (item.net / (leaderboardData[0]?.net || 1)) * 100)}%` }}></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <ChartCard title="Dự báo Tài chính (Waterfall)">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={[
                                { name: 'Dự kiến', value: kpis.projectedRevenue, fill: '#8b5cf6' },
                                { name: 'Chưa thu', value: -kpis.debt, fill: '#f59e0b' },
                                { name: 'Chi phí', value: -kpis.totalCost, fill: '#ef4444' },
                                { name: 'Thực nhận', value: kpis.netProfit, fill: '#10b981' }
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <YAxis hide />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                formatter={(val: number) => formatCurrency(Math.abs(val))}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={40}>
                                {
                                    [
                                        { name: 'Dự kiến', value: kpis.projectedRevenue, fill: '#8b5cf6' },
                                        { name: 'Chưa thu', value: -kpis.debt, fill: '#f59e0b' },
                                        { name: 'Chi phí', value: -kpis.totalCost, fill: '#ef4444' },
                                        { name: 'Thực nhận', value: kpis.netProfit, fill: '#10b981' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))
                                }
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
        </div>
    );
};

export default Analytics;


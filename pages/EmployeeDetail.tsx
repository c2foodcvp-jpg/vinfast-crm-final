
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Customer, CustomerStatus, UserProfile, Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
    ArrowLeft, Users, CheckCircle, TrendingUp, Calendar, Loader2, BadgeDollarSign, Wallet, ArrowUpRight, ArrowDownLeft, Target, Trophy, X, Flame, Briefcase, Copy, Terminal, Lock
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area } from 'recharts';

const EmployeeDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { isAdmin, isMod } = useAuth();
    const navigate = useNavigate();

    const [employee, setEmployee] = useState<UserProfile | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // KPI Logic
    const [viewedKPI, setViewedKPI] = useState<number>(0);

    // Date Filters
    const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

    // KPI Modal
    const [showKpiModal, setShowKpiModal] = useState(false);
    const [kpiForm, setKpiForm] = useState({
        target: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });
    const [isSavingKpi, setIsSavingKpi] = useState(false);

    // Tabs State
    const [activeTab, setActiveTab] = useState<'due' | 'overdue' | 'longterm' | 'won' | 'stopped' | 'all'>('due');

    // SQL Helper
    const [showSql, setShowSql] = useState(false);

    // GMT+7 Helper
    const getLocalTodayStr = () => {
        const now = new Date();
        const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        return vnTime.toISOString().split('T')[0];
    };
    const todayStr = getLocalTodayStr();

    useEffect(() => {
        if (!isAdmin && !isMod) {
            navigate('/');
            return;
        }
        fetchData();
    }, [id, isAdmin, isMod, filterMonth, filterYear]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Employee Profile
            const { data: empData, error: empError } = await supabase.from('profiles').select('*').eq('id', id).single();
            if (empError) throw empError;
            setEmployee(empData as UserProfile);

            // 2. Fetch Customers (Global list for this user, filtered in UI)
            const { data: custData, error: custError } = await supabase.from('customers').select('*').eq('creator_id', id).order('created_at', { ascending: false });
            if (custError) throw custError;
            setCustomers(custData as Customer[]);

            // 3. Fetch Transactions
            const { data: transData, error: transError } = await supabase.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false });
            if (transError) throw transError;
            setTransactions(transData as Transaction[]);

            // 4. Fetch Specific Month KPI
            try {
                const { data: kpiData, error: kpiError } = await supabase.from('employee_kpis')
                    .select('target')
                    .eq('user_id', id)
                    .eq('month', filterMonth)
                    .eq('year', filterYear)
                    .maybeSingle();

                if (kpiError) {
                    // Check for table missing error (42P01 or 404 from REST)
                    if (kpiError.code === '42P01' || kpiError.message?.includes('404')) {
                        setShowSql(true);
                        setViewedKPI(empData.kpi_target || 0); // Fallback to old field
                    } else {
                        console.error(kpiError);
                        setViewedKPI(0);
                    }
                } else {
                    // Use fetched target or 0 if no record exists for this specific month
                    setViewedKPI(kpiData ? kpiData.target : 0);
                }
            } catch (e) {
                // Fallback if table fetch fails completely
                setViewedKPI(empData.kpi_target || 0);
            }

        } catch (err) {
            console.error("Error fetching details:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateKpi = async () => {
        setIsSavingKpi(true);
        try {
            const target = parseInt(kpiForm.target);
            if (isNaN(target)) throw new Error("KPI phải là số.");

            // Upsert into employee_kpis
            const { error } = await supabase.from('employee_kpis').upsert({
                user_id: id,
                month: kpiForm.month,
                year: kpiForm.year,
                target: target,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,month,year' });

            if (error) throw error;

            // Refresh if setting for currently viewed month
            if (kpiForm.month === filterMonth && kpiForm.year === filterYear) {
                setViewedKPI(target);
            }

            setShowKpiModal(false);
            alert(`Đã cập nhật KPI tháng ${kpiForm.month}/${kpiForm.year} thành công!`);

            // Refresh all data
            fetchData();
        } catch (e: any) {
            console.error(e);
            // Check for table missing (404 Not Found usually implies table doesn't exist in Supabase REST)
            if (e.code === '42P01' || e.message?.includes('404') || e.code === 'PGRST204') {
                alert("Lỗi: Bảng dữ liệu KPI chưa được tạo. Vui lòng chạy mã SQL setup bên dưới.");
                setShowSql(true);
            } else {
                alert("Lỗi: " + e.message);
            }
        } finally {
            setIsSavingKpi(false);
        }
    };

    const setupSQL = `
-- 1. Tạo bảng KPI nhân viên theo tháng
create table if not exists public.employee_kpis (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  month int not null,
  year int not null,
  target int default 0,
  updated_at timestamptz default now(),
  unique(user_id, month, year)
);

-- 2. Bật bảo mật RLS
alter table public.employee_kpis enable row level security;

-- 3. Policy: Mọi người xem được
create policy "Read KPIs" on public.employee_kpis for select using (true);

-- 4. Policy: Chỉ Admin/Mod được sửa/thêm
create policy "Write KPIs" on public.employee_kpis for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'mod'))
);
`;

    // --- STATS CALCULATION ---
    const stats = useMemo(() => {
        // Filter stats based on selected Month/Year if needed, or keep global stats?
        // Usually "Total Customers" means lifetime. 
        // Let's keep lifetime stats here, KPI logic handles specific month.
        const total = customers.length;
        const won = customers.filter(c => c.status === CustomerStatus.WON).length;
        const lost = customers.filter(c => c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING).length;
        const active = total - won - lost;
        const potentialHot = customers.filter(c => c.classification === 'Hot' && c.status !== CustomerStatus.WON && c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.LOST_PENDING).length;
        const unacknowledged = customers.filter(c => c.status === CustomerStatus.NEW && c.is_acknowledged === false).length;
        const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0.0';
        return { total, won, lost, active, potentialHot, conversionRate, unacknowledged };
    }, [customers]);

    // --- KPI LOGIC (Based on Filter) ---
    const kpiData = useMemo(() => {
        // Calculate Won deals strictly in the filtered month/year
        const wonInPeriod = customers.filter(c => {
            if (c.status !== CustomerStatus.WON) return false;
            // Logic: Deal Date (updated_at) or Creation Date? Usually Closing Date.
            const d = new Date(c.updated_at || c.created_at);
            return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
        }).length;

        const target = viewedKPI || 0;
        const percentage = target > 0 ? Math.min(100, Math.round((wonInPeriod / target) * 100)) : 0;

        return { wonInPeriod, target, percentage };
    }, [customers, viewedKPI, filterMonth, filterYear]);

    // --- FINANCIAL CHART DATA (Monthly - Last 6 Months) ---
    // Keeps existing logic for the chart to show trend
    const financialData = useMemo(() => {
        const last6Months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            last6Months.push({
                month: d.getMonth() + 1,
                year: d.getFullYear(),
                label: `T${d.getMonth() + 1}`,
                revenue: 0,
                expense: 0,
                net: 0,
                predicted: 0
            });
        }

        transactions.forEach(t => {
            if (t.status !== 'approved') return;
            const tDate = new Date(t.created_at);
            const monthData = last6Months.find(m => m.month === tDate.getMonth() + 1 && m.year === tDate.getFullYear());
            if (monthData) {
                if (['revenue', 'deposit', 'repayment'].includes(t.type)) {
                    monthData.revenue += t.amount;
                } else if (['expense', 'advance'].includes(t.type)) {
                    monthData.expense += t.amount;
                }
            }
        });

        customers.forEach(c => {
            if (c.status === CustomerStatus.WON && c.deal_details?.revenue) {
                const cDate = new Date(c.updated_at || c.created_at);
                const monthData = last6Months.find(m => m.month === cDate.getMonth() + 1 && m.year === cDate.getFullYear());
                if (monthData) {
                    monthData.predicted += c.deal_details.revenue;
                }
            }
        });

        return last6Months.map(m => ({ ...m, net: m.revenue - m.expense }));
    }, [transactions, customers]);

    // --- PART TIME INCOME CALCULATION (30% of NET - Filtered by Month) ---
    const partTimeIncome = useMemo(() => {
        // Calculate Net Revenue for the specific filtered month
        const transInMonth = transactions.filter(t => {
            if (t.status !== 'approved') return false;
            const d = new Date(t.created_at);
            return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
        });

        const revenue = transInMonth.filter(t => ['revenue', 'deposit', 'repayment'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0);
        const expense = transInMonth.filter(t => ['expense', 'advance'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0);
        const net = revenue - expense;

        return net > 0 ? net * 0.3 : 0;
    }, [transactions, filterMonth, filterYear]);

    // --- CUSTOMER FILTER LOGIC ---
    const filteredCustomers = useMemo(() => {
        const isActiveCustomer = (c: Customer) => c.status !== CustomerStatus.WON && c.status !== CustomerStatus.LOST;
        switch (activeTab) {
            case 'due': return customers.filter(c => isActiveCustomer(c) && !c.is_special_care && c.recare_date === todayStr);
            case 'overdue': return customers.filter(c => isActiveCustomer(c) && !c.is_special_care && c.recare_date && c.recare_date < todayStr);
            case 'longterm': return customers.filter(c => isActiveCustomer(c) && c.is_long_term === true && c.recare_date && c.recare_date > todayStr);
            case 'won': return customers.filter(c => c.status === CustomerStatus.WON);
            case 'stopped': return customers.filter(c => c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING);
            case 'all': default: return customers;
        }
    }, [customers, activeTab, todayStr]);

    const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;
    if (!employee) return <div className="text-center p-8">Không tìm thấy nhân viên.</div>;

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => navigate('/employees')} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                        <ArrowLeft size={20} className="text-gray-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-900">{employee.full_name}</h1>
                            {employee.is_part_time && <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded border border-orange-200 uppercase">Part-time</span>}
                        </div>
                        <p className="text-gray-500 text-sm mb-1">{employee.email} • {employee.phone}</p>
                        {(isAdmin || isMod) && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase">Hạng:</span>
                                {isAdmin ? (
                                    <select
                                        className="bg-white border border-gray-200 text-xs font-bold rounded-lg px-2 py-1 outline-none focus:border-primary-500 text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                                        value={employee.member_tier || ''}
                                        onChange={async (e) => {
                                            const newVal = e.target.value;
                                            await supabase.from('profiles').update({ member_tier: newVal || null }).eq('id', employee.id);
                                            setEmployee({ ...employee, member_tier: newVal as any });
                                        }}
                                    >
                                        <option value="">-- Member --</option>
                                        <option value="Gold">Gold</option>
                                        <option value="Platinum">Platinum</option>
                                        <option value="Diamond">Diamond</option>
                                    </select>
                                ) : (
                                    <span className="text-xs font-bold text-gray-700 px-2 py-1 bg-gray-50 rounded border border-gray-200">
                                        {employee.member_tier || 'Thường'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Date Filter */}
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-sm h-10">
                        <Calendar size={16} className="text-gray-500 ml-1" />
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer border-r border-gray-200 pr-2 mr-2"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(parseInt(e.target.value))}
                            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
                        >
                            {[2024, 2025, 2026].map(y => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>

                    <div className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-bold uppercase h-10 flex items-center">{employee.role}</div>
                    {!employee.is_part_time && (
                        <button onClick={() => { setKpiForm({ target: viewedKPI.toString(), month: filterMonth, year: filterYear }); setShowKpiModal(true); }} className="px-3 h-10 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-purple-700 shadow-md">
                            <Target size={14} /> Set KPI
                        </button>
                    )}
                </div>
            </div>

            {/* LOCK CONTROLS FOR MOD/ADMIN */}
            {(isAdmin || isMod) && (
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Lock size={18} className="text-red-500" /> Quản lý Quyền truy cập</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Báo giá & Tính lãi</p>
                                <p className="text-xs text-gray-500">Trang OnlineQuote, BankCalculator</p>
                            </div>
                            <button
                                onClick={async () => {
                                    const newVal = !employee.is_locked_quote;
                                    await supabase.from('profiles').update({ is_locked_quote: newVal }).eq('id', employee.id);
                                    setEmployee({ ...employee, is_locked_quote: newVal });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${employee.is_locked_quote ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                                {employee.is_locked_quote ? 'Đang khoá' : 'Cho phép'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Ứng lương</p>
                                <p className="text-xs text-gray-500">Đề xuất ứng lương trước</p>
                            </div>
                            <button
                                onClick={async () => {
                                    const newVal = !employee.is_locked_advance;
                                    await supabase.from('profiles').update({ is_locked_advance: newVal }).eq('id', employee.id);
                                    setEmployee({ ...employee, is_locked_advance: newVal });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${employee.is_locked_advance ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                                {employee.is_locked_advance ? 'Đang khoá' : 'Cho phép'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Thêm khách mới</p>
                                <p className="text-xs text-gray-500">Tạo khách hàng mới</p>
                            </div>
                            <button
                                onClick={async () => {
                                    const newVal = !employee.is_locked_add;
                                    await supabase.from('profiles').update({ is_locked_add: newVal }).eq('id', employee.id);
                                    setEmployee({ ...employee, is_locked_add: newVal });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${employee.is_locked_add ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                                {employee.is_locked_add ? 'Đang khoá' : 'Cho phép'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Xem/Sửa khách</p>
                                <p className="text-xs text-gray-500">Truy cập dữ liệu khách hàng</p>
                            </div>
                            <button
                                onClick={async () => {
                                    const newVal = !employee.is_locked_view;
                                    await supabase.from('profiles').update({ is_locked_view: newVal }).eq('id', employee.id);
                                    setEmployee({ ...employee, is_locked_view: newVal });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${employee.is_locked_view ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                                {employee.is_locked_view ? 'Đang khoá' : 'Cho phép'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSql && isAdmin && (
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-xl overflow-hidden animate-fade-in relative">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-green-400 font-mono text-xs font-bold flex items-center gap-2"><Terminal size={14} /> Setup Database (SQL)</span>
                        <button onClick={() => { navigator.clipboard.writeText(setupSQL); alert("Đã copy SQL!"); }} className="text-xs bg-white/10 text-white px-2 py-1 rounded hover:bg-white/20 flex items-center gap-1">
                            <Copy size={12} /> Copy
                        </button>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">Lỗi "404 Not Found" hoặc "relation does not exist" nghĩa là bảng `employee_kpis` chưa được tạo. Hãy chạy mã này:</p>
                    <pre className="text-xs text-slate-300 font-mono overflow-x-auto p-2 bg-black/30 rounded border border-white/10">
                        {setupSQL}
                    </pre>
                    <button onClick={() => setShowSql(false)} className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white"><X size={16} /></button>
                </div>
            )}

            {/* KPI & STATS CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* KPI OR INCOME CHART */}
                {employee.is_part_time ? (
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-2xl border border-orange-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <p className="text-orange-800 text-xs font-bold uppercase flex items-center gap-1"><Wallet size={14} /> Thu nhập Tháng {filterMonth}/{filterYear}</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(partTimeIncome)} <span className="text-sm font-normal text-gray-500">VNĐ</span></h3>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-orange-700">30%</p>
                                <p className="text-[10px] text-orange-600">trên Doanh thu Net</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-orange-200">
                            <p className="text-xs text-orange-700 font-medium">Doanh thu Net tháng này: {formatCurrency(partTimeIncome / 0.3)} VNĐ</p>
                        </div>
                        <div className="absolute -right-6 -bottom-6 text-orange-200 opacity-50 pointer-events-none"><Briefcase size={100} /></div>
                    </div>
                ) : (
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <p className="text-gray-500 text-xs font-bold uppercase flex items-center gap-1"><Trophy size={14} className="text-yellow-500" /> KPI Tháng {filterMonth}/{filterYear}</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{kpiData.wonInPeriod} / {kpiData.target} <span className="text-sm font-normal text-gray-500">xe</span></h3>
                            </div>
                            <div className="text-right">
                                <p className={`text-lg font-bold ${kpiData.percentage >= 100 ? 'text-green-600' : 'text-blue-600'}`}>{kpiData.percentage}%</p>
                                <p className="text-[10px] text-gray-400">Hoàn thành</p>
                            </div>
                        </div>
                        <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${kpiData.percentage >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, kpiData.percentage)}%` }}></div>
                        </div>
                        <div className="absolute -right-6 -bottom-6 text-gray-50 opacity-50 pointer-events-none"><Target size={100} /></div>
                    </div>
                )}

                {/* OTHER STATS */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-full mb-2"><Users size={20} /></div>
                        <p className="text-gray-500 text-[10px] font-bold uppercase">Tổng Khách (Tất cả)</p>
                        <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                        <div className="p-2 bg-green-50 text-green-600 rounded-full mb-2"><CheckCircle size={20} /></div>
                        <p className="text-gray-500 text-[10px] font-bold uppercase">Đã chốt (Tất cả)</p>
                        <p className="text-xl font-bold text-gray-900">{stats.won}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                        <div className="p-2 bg-red-50 text-red-600 rounded-full mb-2"><Flame size={20} /></div>
                        <p className="text-gray-500 text-[10px] font-bold uppercase">Khách Hot</p>
                        <p className="text-xl font-bold text-gray-900">{stats.potentialHot}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-full mb-2"><TrendingUp size={20} /></div>
                        <p className="text-gray-500 text-[10px] font-bold uppercase">Tỷ lệ chốt</p>
                        <p className="text-xl font-bold text-gray-900">{stats.conversionRate}%</p>
                    </div>
                </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2"><BadgeDollarSign className="text-green-600" /> Hiệu quả Kinh doanh (Net - 6 Tháng gần nhất)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={financialData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `${val / 1000000}M`} />
                                <Tooltip cursor={{ fill: 'transparent' }} formatter={(val: number) => formatCurrency(val) + ' VNĐ'} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend />
                                <Bar name="Thực thu" dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar name="Chi phí" dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar name="Lợi nhuận" dataKey="net" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2"><TrendingUp className="text-purple-600" /> Doanh thu Dự kiến (Đã chốt)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={financialData}>
                                <defs>
                                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `${val / 1000000}M`} />
                                <Tooltip formatter={(val: number) => formatCurrency(val) + ' VNĐ'} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey="predicted" stroke="#8884d8" fillOpacity={1} fill="url(#colorPredicted)" name="Dự kiến" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* TRANSACTION HISTORY */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2"><Wallet size={20} className="text-blue-600" /> Lịch sử Thu / Chi</h3>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Ngày</th>
                                <th className="px-6 py-3">Loại</th>
                                <th className="px-6 py-3">Khách hàng / Nguồn</th>
                                <th className="px-6 py-3">Nội dung</th>
                                <th className="px-6 py-3 text-right">Số tiền</th>
                                <th className="px-6 py-3 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transactions.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chưa có giao dịch nào.</td></tr>
                            ) : (
                                transactions.map(t => {
                                    const relatedCustomer = customers.find(c => c.id === t.customer_id);
                                    const isMKT = relatedCustomer?.source?.includes('MKT') || false;
                                    return (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{new Date(t.created_at).toLocaleDateString('vi-VN')}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${['revenue', 'deposit', 'repayment'].includes(t.type) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {['revenue', 'deposit', 'repayment'].includes(t.type) ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                                    {t.type === 'revenue' ? 'Doanh thu' : t.type === 'deposit' ? 'Nộp quỹ' : t.type === 'expense' ? 'Chi phí' : t.type === 'advance' ? 'Ứng tiền' : 'Hoàn ứng'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{t.customer_name || '---'}</div>
                                                {isMKT && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-200">MKT Group</span>}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={t.reason}>{t.reason}</td>
                                            <td className={`px-6 py-4 text-right font-bold ${['revenue', 'deposit', 'repayment'].includes(t.type) ? 'text-green-600' : 'text-red-600'}`}>
                                                {['revenue', 'deposit', 'repayment'].includes(t.type) ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${t.status === 'approved' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`}>
                                                    {t.status === 'approved' ? 'Đã duyệt' : t.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* KPI MODAL */}
            {showKpiModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Target className="text-purple-600" /> Thiết lập KPI</h3>
                            <button onClick={() => setShowKpiModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Tháng</label>
                                    <select
                                        value={kpiForm.month}
                                        onChange={(e) => setKpiForm({ ...kpiForm, month: parseInt(e.target.value) })}
                                        className="w-full border p-2 rounded-xl"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Năm</label>
                                    <select
                                        value={kpiForm.year}
                                        onChange={(e) => setKpiForm({ ...kpiForm, year: parseInt(e.target.value) })}
                                        className="w-full border p-2 rounded-xl"
                                    >
                                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Mục tiêu số xe</label>
                                <input
                                    type="number"
                                    value={kpiForm.target}
                                    onChange={(e) => setKpiForm({ ...kpiForm, target: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-gray-900 font-bold outline-none focus:border-purple-500"
                                    placeholder="Ví dụ: 5"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setShowKpiModal(false)} className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                                <button
                                    onClick={handleUpdateKpi}
                                    disabled={isSavingKpi}
                                    className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 flex items-center gap-2"
                                >
                                    {isSavingKpi && <Loader2 className="animate-spin" size={16} />} Lưu KPI
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeDetail;



import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import {
    Users, TrendingUp, CheckCircle, Plus, BellRing, ChevronRight, Activity, Percent, ArrowUp, ArrowDown, Wallet
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { CustomerStatus, Customer, UserProfile } from '../types';
import * as ReactRouterDOM from 'react-router-dom';

const { useNavigate } = ReactRouterDOM as any;

/**
 * PRO DEMO DASHBOARD
 * A "Pro Max" version with glassmorphism, cleaner gradients, and denser information hierarchy.
 */

const GlassCard = ({ children, className = '' }: any) => (
    <div className={`bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl ${className}`}>
        {children}
    </div>
);

const KPICard = ({ title, value, change, isPositive, icon: Icon, colorClass }: any) => (
    <GlassCard className="p-6 relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
            <Icon size={80} />
        </div>
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass} bg-opacity-20 text-opacity-100`}>
                <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
            </div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-1">{value}</h3>

            {change && (
                <div className={`flex items-center gap-1 mt-3 text-sm font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isPositive ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    <span>{change}%</span>
                    <span className="text-slate-400 font-normal ml-1">so với tháng trước</span>
                </div>
            )}
        </div>
    </GlassCard>
);

const DashboardProDemo: React.FC = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ total: 0, new: 0, won: 0, revenue: 0 });
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        // Mock Data simulation for Demo purpose
        // In real PRO version, this would fetch optimized aggregated data
        setStats({ total: 1240, new: 85, won: 32, revenue: 15400000000 });
        setChartData([
            { name: 'T2', value: 4000 },
            { name: 'T3', value: 3000 },
            { name: 'T4', value: 2000 },
            { name: 'T5', value: 2780 },
            { name: 'T6', value: 1890 },
            { name: 'T7', value: 2390 },
            { name: 'CN', value: 3490 },
        ]);
    }, []);

    const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 space-y-8 font-sans">

            {/* HERDER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tổng quan</h1>
                    <p className="text-slate-500 mt-1 font-medium">Chào mừng trở lại, {userProfile?.full_name} 👋</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors shadow-sm text-sm">
                        Quay lại App cũ
                    </button>
                    <button className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 text-sm flex items-center gap-2">
                        <Plus size={18} /> Thêm Mới
                    </button>
                </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <KPICard
                    title="Doanh thu (Tháng)"
                    value="15.4 Tỷ"
                    change="12.5"
                    isPositive={true}
                    icon={Wallet}
                    colorClass="bg-blue-500 text-blue-600"
                />
                <KPICard
                    title="Khách hàng mới"
                    value="85"
                    change="5.2"
                    isPositive={false}
                    icon={Users}
                    colorClass="bg-purple-500 text-purple-600"
                />
                <KPICard
                    title="Hợp đồng chốt"
                    value="32"
                    change="8.1"
                    isPositive={true}
                    icon={CheckCircle}
                    colorClass="bg-emerald-500 text-emerald-600"
                />
                <KPICard
                    title="Tỷ lệ chuyển đổi"
                    value="37.6%"
                    icon={Activity}
                    colorClass="bg-orange-500 text-orange-600"
                />
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* CHART SECTION (Occupies 2 cols) */}
                <GlassCard className="lg:col-span-2 p-8 min-h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Xu hướng Doanh số</h3>
                            <p className="text-sm text-slate-500">Dữ liệu 7 ngày gần nhất</p>
                        </div>
                        <div className="flex gap-2">
                            {['7 Ngày', '30 Ngày', 'Năm'].map(p => (
                                <button key={p} className={`px-3 py-1 rounded-lg text-xs font-bold ${p === '7 Ngày' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{p}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }}
                                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* ACTIVITY FEED (Occupies 1 col) */}
                <GlassCard className="p-0 flex flex-col h-full">
                    <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md rounded-t-2xl">
                        <h3 className="text-xl font-bold text-slate-800">Hoạt động mới</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {[1, 2, 3, 4, 5].map((_, i) => (
                            <div key={i} className="flex gap-4 group">
                                <div className="mt-1 relative">
                                    <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors z-10 relative"></div>
                                    {i !== 4 && <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[1px] h-full bg-slate-200"></div>}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Nguyễn Văn A vừa chốt đơn VF 3</p>
                                    <p className="text-xs text-slate-500 mt-1">10 phút trước • Hợp đồng #HD00{90 + i}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-slate-100">
                        <button className="w-full py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors">Xem tất cả</button>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

export default DashboardProDemo;

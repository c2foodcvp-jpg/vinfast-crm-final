
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import * as ReactRouterDOM from 'react-router-dom';
import {
    Users, TrendingUp, CheckCircle, Plus, Loader2, AlertTriangle, Clock, Calendar, BellRing, ChevronRight, Send, X, Settings, Zap, MessageSquarePlus, BarChart3, UserPlus, Mail, Copy, Terminal, ExternalLink, ArrowRightLeft, FileCheck2, FileText, Save, Bell, Hand, Filter, Briefcase, Trophy, UserX, MapPin, CarFront, ChevronDown, BadgeDollarSign
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { CustomerStatus, Customer, UserProfile, UserRole, CustomerClassification } from '../types';
import AddCustomerModal from '../components/AddCustomerModal';
import DateRangeFilter from '../components/DateRangeFilter';

const { useNavigate } = ReactRouterDOM as any;

const COLORS = {
    NEW: '#3b82f6',      // Blue
    WON: '#10b981',      // Green
    LOST: '#f59e0b',     // Orange/Yellow
    POTENTIAL: '#ef4444' // Red/Hot
};

const Dashboard: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const navigate = useNavigate();

    // Data States
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    // Custom Date Range Filter (replaces old timeFilter)
    const [dateRangeStart, setDateRangeStart] = useState<string>('');
    const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

    // Helper to get today's date in GMT+7
    const getLocalTodayStr = () => {
        const now = new Date();
        const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        return vnTime.toISOString().split('T')[0];
    };
    const todayStr = getLocalTodayStr();

    // Initialize with today as default date range
    useEffect(() => {
        if (!dateRangeStart && !dateRangeEnd) {
            setDateRangeStart(todayStr);
            setDateRangeEnd(todayStr);
        }
    }, []);

    // Stats States
    const [stats, setStats] = useState({ total: 0, new: 0, won: 0, potential: 0, stopped: 0 });
    const [alerts, setAlerts] = useState({
        due: 0, overdue: 0, pendingCustomers: 0, pendingEmployees: 0, pendingTransfers: 0, pendingDeals: 0, assignedTodayToMe: 0, pendingAckCount: 0, pendingAckReps: 0, expiredLongTerm: 0, pendingFinance: 0, duplicateLeadsToday: 0
    });
    const [statusData, setStatusData] = useState<any[]>([]);
    const [leadData, setLeadData] = useState<any[]>([]);

    // Notification Bell State
    const [isNotiOpen, setIsNotiOpen] = useState(false);
    const notiRef = useRef<HTMLDivElement>(null);

    // --- ADD CUSTOMER MODAL STATE ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Get Tomorrow Str for Auto-Reschedule
    const getTomorrowStr = () => {
        const now = new Date();
        const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        vnTime.setDate(vnTime.getDate() + 1);
        return vnTime.toISOString().split('T')[0];
    };

    useEffect(() => {
        fetchDataWithIsolation();
        const handleClickOutside = (event: MouseEvent) => {
            if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
                setIsNotiOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [userProfile, selectedTeam]);

    // --- RE-CALCULATE STATS WHEN FILTER CHANGES ---
    useEffect(() => {
        if (allCustomers.length > 0) {
            calculateStats();
        }
    }, [dateRangeStart, dateRangeEnd, allCustomers]);

    // --- TEAM ISOLATION LOGIC ---
    const fetchDataWithIsolation = async () => {
        if (!userProfile) return;
        setLoading(true);
        try {
            let teamIds: string[] = [];
            let members: UserProfile[] = [];

            if (isAdmin) {
                // Admin: Fetch all members first
                const { data } = await supabase.from('profiles').select('*');
                let allMembers = data as UserProfile[] || [];

                if (selectedTeam !== 'all') {
                    // Filter members belonging to the selected team
                    members = allMembers.filter(m => m.manager_id === selectedTeam || m.id === selectedTeam);
                } else {
                    members = allMembers;
                }
                teamIds = members.map(m => m.id);
            } else if (isMod) {
                // MOD: See Self + Subordinates
                const { data } = await supabase.from('profiles').select('*').or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id}`);
                members = data as UserProfile[] || [];
                teamIds = members.map(m => m.id);
            } else {
                // Regular User (Sales): STRICTLY SELF ONLY
                members = [userProfile];
                teamIds = [userProfile.id];
            }

            setTeamMembers(members);

            // 1. Fetch Customers filtered by Team/User
            let query = supabase.from('customers').select('*');

            if (!isAdmin) {
                // For Mod and User, strictly enforce Creator ID check
                if (teamIds.length > 0) {
                    query = query.in('creator_id', teamIds);
                } else {
                    query = query.eq('creator_id', userProfile.id);
                }
            } else {
                // Admin: Apply team filter if selected
                if (selectedTeam !== 'all' && teamIds.length > 0) {
                    query = query.in('creator_id', teamIds);
                }
            }

            const { data: customersData, error } = await query;
            if (error) throw error;
            let customers = customersData as Customer[] || [];

            // --- AUTO-CONVERT EXPIRED LONG-TERM TO NORMAL ---
            const tomorrowStr = getTomorrowStr();
            const expiredLongTermIds: string[] = [];

            customers = customers.map(c => {
                // Logic: If Long-term AND Recare date is STRICTLY IN PAST (< todayStr)
                // Convert to Normal and move Recare Date to TOMORROW
                if (c.is_long_term && c.recare_date && c.recare_date < todayStr && c.status !== CustomerStatus.WON && c.status !== CustomerStatus.LOST) {
                    expiredLongTermIds.push(c.id);
                    // Update local object immediately for UI
                    return { ...c, is_long_term: false, recare_date: tomorrowStr };
                }
                return c;
            });

            // Perform DB update for expired ones (Fire and forget, or await if critical)
            if (expiredLongTermIds.length > 0) {
                await supabase.from('customers').update({
                    is_long_term: false,
                    recare_date: tomorrowStr
                }).in('id', expiredLongTermIds);

                // Optional: Log interaction for automation
                // expiredLongTermIds.forEach(id => {
                //    supabase.from('interactions').insert([{ customer_id: id, user_id: userProfile.id, type: 'note', content: 'Hệ thống: Tự động chuyển từ CS Dài hạn sang Thường (Hết hạn).', created_at: new Date().toISOString() }]);
                // });
            }

            setAllCustomers(customers);

            // Alerts are calculated on ALL fetched data (Operational)
            await calculateAlerts(customers, teamIds);

        } catch (err) {
            console.error("Error fetching isolated data:", err);
        } finally {
            setLoading(false);
        }
    };

    const calculateAlerts = async (customers: Customer[], teamIds: string[]) => {
        const dueCount = customers.filter((c: any) => !c.is_special_care && !c.is_long_term && c.recare_date === todayStr && c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.WON).length;
        const overdueCount = customers.filter((c: any) => !c.is_special_care && !c.is_long_term && c.recare_date && c.recare_date < todayStr && c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.WON).length;

        // Expired Long Term: ONLY SHOW IF RECARE DATE IS TODAY
        // (Past dates are auto-converted to normal, so only "Today" matters for notification)
        const expiredLongTerm = customers.filter((c: any) => c.is_long_term && c.recare_date === todayStr && c.status !== CustomerStatus.WON && c.status !== CustomerStatus.LOST).length;

        const assignedTodayToMe = customers.filter((c: Customer) => c.status === CustomerStatus.NEW && c.is_acknowledged === false && c.creator_id === userProfile?.id).length;

        const unacknowledgedLeads = (isAdmin || isMod)
            ? customers.filter((c: any) => c.status === CustomerStatus.NEW && c.is_acknowledged === false && c.sales_rep)
            : [];

        const pendingAckCount = unacknowledgedLeads.length;
        const pendingAckReps = new Set(unacknowledgedLeads.map((c: any) => c.sales_rep)).size;

        let pendingFinance = 0;
        if (isAdmin || isMod) {
            let fQuery = supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            if (!isAdmin || (isAdmin && selectedTeam !== 'all')) {
                fQuery = fQuery.in('user_id', teamIds);
            }
            const { count } = await fQuery;
            pendingFinance = count || 0;
        }

        const pendingCustomers = customers.filter((c: any) => c.status === CustomerStatus.WON_PENDING || c.status === CustomerStatus.LOST_PENDING).length;
        const pendingTransfers = customers.filter((c: any) => !!c.pending_transfer_to).length;
        const pendingDeals = customers.filter((c: any) => c.deal_status === 'completed_pending' || c.deal_status === 'refund_pending').length;

        let pendingEmployees = 0;
        if (isAdmin || isMod) {
            if (isAdmin && selectedTeam === 'all') {
                const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
                pendingEmployees = count || 0;
            }
        }

        // === KIỂM TRA LEAD TRÙNG HÔM NAY ===
        let duplicateLeadsToday = 0;
        if (isAdmin || isMod) {
            // Query interactions có chứa "[LEAD MỚI TRÙNG]" và created_at bắt đầu bằng todayStr
            const { count } = await supabase
                .from('interactions')
                .select('*', { count: 'exact', head: true })
                .ilike('content', '%[LEAD MỚI TRÙNG]%')
                .gte('created_at', todayStr + 'T00:00:00')
                .lt('created_at', todayStr + 'T23:59:59');
            duplicateLeadsToday = count || 0;
        }

        setAlerts({ due: dueCount, overdue: overdueCount, pendingCustomers, pendingEmployees, pendingTransfers, pendingDeals, assignedTodayToMe, pendingAckCount, pendingAckReps, expiredLongTerm, pendingFinance, duplicateLeadsToday });
    };

    const calculateStats = () => {
        // 1. Filter customers based on Date Range
        let start = dateRangeStart ? new Date(dateRangeStart + 'T00:00:00') : new Date(0);
        let end = dateRangeEnd ? new Date(dateRangeEnd + 'T23:59:59') : new Date();

        const filteredCustomers = (!dateRangeStart && !dateRangeEnd)
            ? allCustomers
            : allCustomers.filter(c => {
                const d = new Date(c.created_at);
                return d >= start && d <= end;
            });

        // 2. Calculate Stats from Filtered List
        const total = filteredCustomers.length;
        const newLeads = filteredCustomers.filter(c => c.status === CustomerStatus.NEW || c.status === CustomerStatus.CONTACTED).length; // "New" in period context usually means added
        const won = filteredCustomers.filter(c => c.status === CustomerStatus.WON).length;
        const potential = filteredCustomers.filter(c => c.is_special_care === true).length;
        const stopped = filteredCustomers.filter(c => c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING).length;

        setStats({ total, new: newLeads, won, potential, stopped });

        // 3. Status Pie Chart
        const countWon = filteredCustomers.filter(c => c.status === CustomerStatus.WON).length;
        const countLost = filteredCustomers.filter(c => c.status === CustomerStatus.LOST).length;
        const countPotential = filteredCustomers.filter(c => c.is_special_care && c.status !== CustomerStatus.WON && c.status !== CustomerStatus.LOST).length;
        const countOthers = filteredCustomers.length - countWon - countLost - countPotential;

        const pieData = [
            { name: 'Mới / Đang CS', value: Math.max(0, countOthers), color: COLORS.NEW },
            { name: 'Chốt đơn', value: countWon, color: COLORS.WON },
            { name: 'Đã hủy', value: countLost, color: COLORS.LOST },
            { name: 'Tiềm năng', value: countPotential, color: COLORS.POTENTIAL },
        ].filter(d => d.value > 0);
        setStatusData(pieData);

        // 4. Trend Data (Last 7 Days - Always Realtime trend for UX, or Filtered?)
        const last7Days = [];
        const vnNow = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
        for (let i = 6; i >= 0; i--) {
            const d = new Date(vnNow);
            d.setDate(vnNow.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const [y, m, day] = dateStr.split('-');
            // Check against ALL customers to show recent global trend
            const count = allCustomers.filter((c: any) => c.created_at && c.created_at.startsWith(dateStr)).length;
            last7Days.push({ name: `${day}/${m}`, customers: count });
        }
        setLeadData(last7Days);
    };

    // Memoized Filtered List for Rep Stats
    const filteredRepStatsList = useMemo(() => {
        let start = dateRangeStart ? new Date(dateRangeStart + 'T00:00:00') : new Date(0);
        let end = dateRangeEnd ? new Date(dateRangeEnd + 'T23:59:59') : new Date();

        if (!dateRangeStart && !dateRangeEnd) return allCustomers;
        return allCustomers.filter(c => {
            const d = new Date(c.created_at);
            return d >= start && d <= end;
        });
    }, [allCustomers, dateRangeStart, dateRangeEnd]);

    const repStats = useMemo(() => {
        // Only show rep stats for Admin or Mod
        if (!isAdmin && !isMod) return [];
        if (!teamMembers.length || !filteredRepStatsList.length) return [];
        let targetProfiles = teamMembers.filter(p => p.role !== UserRole.ADMIN && p.status === 'active');

        return targetProfiles.map(rep => {
            const repCustomers = filteredRepStatsList.filter(c => c.creator_id === rep.id);
            const total = repCustomers.length;
            const won = repCustomers.filter(c => c.status === CustomerStatus.WON).length;
            const stopped = repCustomers.filter(c => c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING).length;
            const active = total - won - stopped;
            const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0.0';
            return { id: rep.id, name: rep.full_name, avatar: rep.avatar_url, role: rep.role, total, active, won, stopped, conversionRate };
        }).sort((a, b) => b.won - a.won);
    }, [teamMembers, filteredRepStatsList, isAdmin, isMod, selectedTeam]);

    // For Admin Filter Dropdown
    const [allManagers, setAllManagers] = useState<{ id: string, name: string }[]>([]);
    useEffect(() => {
        if (isAdmin) {
            const fetchManagers = async () => {
                const { data } = await supabase.from('profiles').select('*');
                if (data) {
                    const profiles = data as UserProfile[];
                    const mgrIds = Array.from(new Set(profiles.filter(p => p.manager_id).map(p => p.manager_id)));
                    const list = mgrIds.map(id => {
                        const m = profiles.find(p => p.id === id);
                        return { id: id as string, name: m?.full_name || 'Unknown' };
                    }).filter(m => m.name !== 'Unknown');
                    setAllManagers(list);
                }
            };
            fetchManagers();
        }
    }, [isAdmin]);


    const totalPending = alerts.pendingCustomers + alerts.pendingEmployees + alerts.pendingTransfers + alerts.pendingDeals + alerts.overdue + alerts.pendingFinance;
    const displayNotifCount = (isAdmin || isMod) ? totalPending : (alerts.due + alerts.overdue + alerts.assignedTodayToMe);

    const handleAddCustomerClick = () => {
        if (userProfile?.is_locked_add) {
            alert("Bạn đã bị khóa quyền thêm khách mới.");
        } else {
            setIsAddModalOpen(true);
        }
    };

    const StatCard: React.FC<any> = ({ title, value, icon: Icon, color, onClick }) => (
        <div onClick={onClick} className={`relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md group ${onClick ? 'cursor-pointer' : ''}`}>
            <div className="relative flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">{title}</p><p className="mt-2 text-3xl font-bold text-gray-900">{value}</p></div><div className={`rounded-xl p-3 text-white shadow-sm ${color} group-hover:scale-110 transition-transform`}><Icon size={24} /></div></div>
        </div>
    );

    return (
        <div className="space-y-6 pb-10">

            {/* HEADER & ALERTS */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900">Tổng quan {(isAdmin || isMod) ? '(Team)' : '(Cá nhân)'}</h1><p className="text-gray-500">Xin chào, {userProfile?.full_name}!</p></div>

                {/* Actions Container - Updated for better mobile alignment */}
                <div className="flex w-full xl:w-auto items-center justify-end gap-3 flex-wrap">
                    {/* DATE RANGE FILTER */}
                    <DateRangeFilter
                        startDate={dateRangeStart}
                        endDate={dateRangeEnd}
                        onStartDateChange={setDateRangeStart}
                        onEndDateChange={setDateRangeEnd}
                        onClear={() => {
                            setDateRangeStart('');
                            setDateRangeEnd('');
                        }}
                    />

                    <div className="relative" ref={notiRef}>
                        <button onClick={() => setIsNotiOpen(!isNotiOpen)} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-primary-600 hover:bg-gray-50 shadow-sm transition-all relative">
                            <Bell size={20} />
                            {displayNotifCount > 0 && (<span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse">{displayNotifCount > 9 ? '9+' : displayNotifCount}</span>)}
                        </button>
                        {isNotiOpen && (
                            <div className="absolute right-[-60px] sm:right-0 top-full mt-2 w-[85vw] sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-[60] overflow-hidden animate-fade-in origin-top-right ring-1 ring-black/5">
                                <div className="p-4 border-b border-gray-50 bg-gray-50/50"><h4 className="font-bold text-gray-800 flex items-center gap-2"><BellRing size={16} className="text-primary-600" /> Thông báo</h4></div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {displayNotifCount === 0 ? <div className="p-8 text-center text-gray-400 text-sm">Không có thông báo mới.</div> : (
                                        <div className="flex flex-col">
                                            {alerts.assignedTodayToMe > 0 && <button onClick={() => navigate('/customers', { state: { filterType: 'today' } })} className="p-4 hover:bg-green-50 border-b border-gray-50 text-left transition-colors flex gap-3 bg-green-50/50"><div className="p-2 bg-green-100 text-green-600 rounded-full h-fit animate-pulse"><Hand size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.assignedTodayToMe} Khách mới phân bổ (Bạn)</p><p className="text-xs text-gray-500">Hãy vào xác nhận ngay!</p></div></button>}
                                            {alerts.pendingAckCount > 0 && <button onClick={() => navigate('/customers', { state: { filterType: 'unacknowledged' } })} className="p-4 hover:bg-purple-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-purple-100 text-purple-600 rounded-full h-fit"><UserX size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingAckCount} Khách chưa nhận (Team)</p><p className="text-xs text-gray-500">Thuộc {alerts.pendingAckReps} TVBH.</p></div></button>}
                                            {(alerts.pendingCustomers > 0 || alerts.pendingDeals > 0) && <button onClick={() => navigate('/customers', { state: { initialTab: 'pending' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-orange-100 text-orange-600 rounded-full h-fit"><FileCheck2 size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingCustomers + alerts.pendingDeals} Yêu cầu duyệt (Team)</p><p className="text-xs text-gray-500">Đơn hàng/Trạng thái.</p></div></button>}
                                            {alerts.pendingTransfers > 0 && <button onClick={() => navigate('/customers', { state: { initialTab: 'pending' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-orange-100 text-orange-600 rounded-full h-fit"><ArrowRightLeft size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingTransfers} Chuyển Sales (Team)</p><p className="text-xs text-gray-500">Đang chờ xử lý.</p></div></button>}
                                            {(isAdmin || isMod) && alerts.pendingFinance > 0 && <button onClick={() => navigate('/finance')} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-red-100 text-red-600 rounded-full h-fit"><BadgeDollarSign size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingFinance} Yêu cầu Duyệt Quỹ</p><p className="text-xs text-gray-500">Nộp/Chi/Ứng cần xử lý.</p></div></button>}
                                            {(isAdmin || isMod) && alerts.pendingEmployees > 0 && <button onClick={() => navigate('/employees')} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-full h-fit"><UserPlus size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingEmployees} Nhân sự mới</p><p className="text-xs text-gray-500">Đang chờ duyệt.</p></div></button>}
                                            {alerts.due > 0 && <button onClick={() => navigate('/customers', { state: { initialTab: 'due' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-orange-100 text-orange-600 rounded-full h-fit"><Clock size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.due} Khách đến hạn CS</p><p className="text-xs text-gray-500">Hôm nay.</p></div></button>}
                                            {alerts.expiredLongTerm > 0 && <button onClick={() => navigate('/customers', { state: { filterType: 'expired_longterm' } })} className="p-4 hover:bg-blue-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-full h-fit"><Calendar size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.expiredLongTerm} Hết hạn CS Dài hạn</p><p className="text-xs text-gray-500">Hôm nay - Cần chăm sóc lại.</p></div></button>}
                                            {alerts.overdue > 0 && <button onClick={() => navigate('/customers', { state: { initialTab: 'overdue' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-red-100 text-red-600 rounded-full h-fit"><AlertTriangle size={16} /></div><div><p className="text-sm font-bold text-gray-800">{alerts.overdue} Khách quá hạn CS</p><p className="text-xs text-gray-500">Cần xử lý gấp.</p></div></button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={handleAddCustomerClick} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors ${userProfile?.is_locked_add ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 shadow-primary-200 hover:bg-primary-700'}`}><Plus size={18} /> Thêm khách</button>
                </div>
            </div>

            {/* ALERT BANNERS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                {(!isAdmin && !isMod) && alerts.assignedTodayToMe > 0 && (<div onClick={() => navigate('/customers', { state: { filterType: 'today' } })} className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-green-100 transition-colors shadow-sm md:col-span-3 lg:col-span-1"><div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 animate-bounce"><Hand size={24} /></div><div className="flex-1"><h4 className="font-bold text-green-800">Cần tiếp nhận khách!</h4><p className="text-sm text-green-700">Bạn có <span className="font-bold text-lg ml-1">{alerts.assignedTodayToMe}</span> khách mới chưa bấm "Đã nhận".</p></div><ChevronRight className="text-green-400" /></div>)}
                {(isAdmin || isMod) && alerts.pendingFinance > 0 && (<div onClick={() => navigate('/finance')} className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-purple-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 animate-pulse"><BadgeDollarSign size={24} /></div><div className="flex-1"><h4 className="font-bold text-purple-800">Duyệt Quỹ / Tài chính</h4><p className="text-sm text-purple-700">Có <span className="font-bold text-lg ml-1">{alerts.pendingFinance}</span> yêu cầu chờ duyệt.</p></div><ChevronRight className="text-purple-400" /></div>)}
                {alerts.expiredLongTerm > 0 && <div onClick={() => navigate('/customers', { state: { filterType: 'expired_longterm' } })} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-blue-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 animate-pulse"><Calendar size={24} /></div><div className="flex-1"><h4 className="font-bold text-blue-700">Hết hạn CS Dài hạn</h4><p className="text-sm text-blue-600">Hôm nay: <span className="font-bold text-lg ml-1">{alerts.expiredLongTerm}</span></p></div><ChevronRight className="text-blue-400" /></div>}
                {alerts.overdue > 0 && <div onClick={() => navigate('/customers', { state: { initialTab: 'overdue' } })} className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-red-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 animate-pulse"><AlertTriangle size={24} /></div><div className="flex-1"><h4 className="font-bold text-red-700">Khách quá hạn CS</h4><p className="text-sm text-red-600">Tổng cộng: <span className="font-bold text-lg ml-1">{alerts.overdue}</span></p></div><ChevronRight className="text-red-400" /></div>}
                {alerts.due > 0 && <div onClick={() => navigate('/customers', { state: { initialTab: 'due' } })} className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-orange-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><Clock size={24} /></div><div className="flex-1"><h4 className="font-bold text-orange-800">Đến hạn chăm sóc</h4><p className="text-sm text-orange-700">Hôm nay: <span className="font-bold text-lg ml-1">{alerts.due}</span></p></div><ChevronRight className="text-orange-400" /></div>}
                {(isAdmin || isMod) && alerts.duplicateLeadsToday > 0 && <div onClick={() => navigate('/customers', { state: { filterType: 'duplicate_leads_today' } })} className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-yellow-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0 animate-pulse"><Mail size={24} /></div><div className="flex-1"><h4 className="font-bold text-yellow-800">Lead Email Trùng (Hôm nay)</h4><p className="text-sm text-yellow-700">Có <span className="font-bold text-lg ml-1">{alerts.duplicateLeadsToday}</span> khách cũ liên hệ lại qua Email Form.</p></div><ChevronRight className="text-yellow-500" /></div>}
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Tổng khách hàng (Lọc)" value={stats.total} icon={Users} color="bg-blue-500" onClick={() => navigate('/customers', { state: { initialTab: 'all' } })} />
                <StatCard title="Khách mới (Trong kỳ)" value={stats.new} icon={Plus} color="bg-emerald-500" onClick={() => navigate('/customers', { state: { filterType: 'today' } })} />
                <StatCard title="Tiềm năng (Hot/Special)" value={stats.potential} icon={TrendingUp} color="bg-red-500" onClick={() => navigate('/customers', { state: { initialTab: 'special' } })} />
                <StatCard title="Khách ngưng CS" value={stats.stopped} icon={UserX} color="bg-gray-500" onClick={() => navigate('/customers', { state: { initialTab: 'lost' } })} />
                <StatCard title="Đã chốt đơn" value={stats.won} icon={CheckCircle} color="bg-green-500" onClick={() => navigate('/customers', { state: { initialTab: 'won' } })} />
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 h-[400px] flex flex-col">
                    <h3 className="mb-6 text-lg font-bold text-gray-900">Hoạt động gần đây (7 ngày qua)</h3>
                    <div className="flex-1 w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={leadData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <Tooltip cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Line type="monotone" dataKey="customers" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 h-[400px] flex flex-col">
                    <h3 className="mb-6 text-lg font-bold text-gray-900">Phân loại khách hàng (Theo bộ lọc)</h3>
                    <div className="flex-1 w-full h-[250px] relative">
                        {statusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                <div className="w-32 h-32 rounded-full border-8 border-gray-100 mb-4"></div>
                                <p>Chưa có dữ liệu phân loại</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {(isAdmin || isMod) && (
                <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Briefcase size={20} className="text-primary-600" /> Hiệu suất Kinh doanh (Theo bộ lọc)</h3>
                        {isAdmin && (
                            <div className="relative">
                                <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm font-medium cursor-pointer">
                                    <option value="all">Tất cả Team</option>
                                    {allManagers.map(mgr => (<option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>))}
                                </select>
                                <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nhân viên</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">TỔNG KHÁCH</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Đã chốt</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Tỷ lệ chốt</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ngưng CS</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {repStats.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">Chưa có dữ liệu nhân viên.</td></tr>
                                ) : (
                                    repStats.map((rep) => (
                                        <tr key={rep.id} onClick={() => (isAdmin || isMod) && navigate('/employees/' + rep.id)} className={(isAdmin || isMod) ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">{rep.avatar ? <img src={rep.avatar} className="w-full h-full rounded-full object-cover" /> : rep.name.charAt(0).toUpperCase()}</div>
                                                    <div><div className="text-sm font-bold text-gray-900">{rep.name}</div><div className="text-xs text-gray-500 capitalize">{rep.role}</div></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{rep.total}</span></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{rep.won}</span></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center"><div className="flex items-center justify-center gap-2"><div className="w-16 bg-gray-200 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(parseFloat(rep.conversionRate), 100)}%` }}></div></div><span className="text-xs font-bold text-gray-700">{rep.conversionRate}%</span></div></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{rep.stopped}</span></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ISOLATED MODAL FOR BETTER PERFORMANCE */}
            <AddCustomerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => {
                    fetchDataWithIsolation();
                    // alert("Thêm khách hàng thành công!"); // Handled inside modal or here
                }}
            />

        </div>
    );
};

export default Dashboard;


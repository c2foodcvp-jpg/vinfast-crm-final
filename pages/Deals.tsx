
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Customer, CustomerStatus, DealStatus, UserRole, UserProfile, Distributor, Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { exportToExcel } from '../utils/excelExport';
import {
    CheckCircle2,
    Clock,
    RotateCcw,
    Search,
    FileCheck2,
    Loader2,
    ShieldCheck,
    Ban,
    X,
    User,
    CarFront,
    Filter,
    ChevronDown,
    Archive,
    PauseCircle,
    Calendar,
    ArrowRight,
    Edit,
    Download,
    ChevronLeft,
    ChevronRight,
    Building2,
    AlertTriangle,
    BarChart2
} from 'lucide-react';

import ProgressMonitorModal from '../components/ProgressMonitorModal';

const ITEMS_PER_PAGE = 15;

const Deals: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const navigate = useNavigate();
    const location = useLocation() as any;
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // States initialized with default values
    const [activeTab, setActiveTab] = useState<'processing' | 'completed' | 'refunded' | 'suspended'>('processing');
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'mkt' | 'other'>('all');
    const [selectedRep, setSelectedRep] = useState<string>('all');
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<number | 'all'>('all');
    const [selectedDistributor, setSelectedDistributor] = useState<string>('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [defaultAvatar, setDefaultAvatar] = useState<string | null>(null);

    useEffect(() => {
        const fetchDefaultAvatar = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'default_customer_avatar').single();
            if (data) setDefaultAvatar(data.value);
        };
        fetchDefaultAvatar();
    }, []);

    // Confirmation Modal
    const [confirmAction, setConfirmAction] = useState<{ id: string, type: 'completed' | 'refunded' | 'suspended' } | null>(null);

    // --- NEW: Manual Date Edit Modal State ---
    const [showDateModal, setShowDateModal] = useState(false);
    const [dateForm, setDateForm] = useState<{ id: string, date: string, name: string }>({ id: '', date: '', name: '' });

    // --- NEW: Progress Monitor Modal State ---
    const [showProgressMonitor, setShowProgressMonitor] = useState(false);

    // --- RESTORE STATE LOGIC (SessionStorage) ---
    const [isRestored, setIsRestored] = useState(false); // NEW: Guard flag

    useEffect(() => {
        // 1. If explicit navigation from Dashboard (Alerts), use location.state
        if (location.state && location.state.initialTab) {
            setActiveTab(location.state.initialTab);
            setIsRestored(true);
        }
        // 2. Else, restore from SessionStorage
        else {
            const savedState = sessionStorage.getItem('crm_deals_view_state');
            if (savedState) {
                try {
                    const parsed = JSON.parse(savedState);
                    if (parsed.activeTab) setActiveTab(parsed.activeTab);
                    if (parsed.searchTerm) setSearchTerm(parsed.searchTerm);
                    if (parsed.sourceFilter) setSourceFilter(parsed.sourceFilter);
                    if (parsed.selectedRep) setSelectedRep(parsed.selectedRep);
                    if (parsed.selectedTeam) setSelectedTeam(parsed.selectedTeam);
                    if (parsed.filterMonth) setFilterMonth(parsed.filterMonth);
                    if (parsed.filterYear) setFilterYear(parsed.filterYear);
                } catch (e) { console.error("Failed to restore deals state", e); }
            }
            setIsRestored(true);
        }
    }, [location.state]); // Added dependency to re-run if location.state changes

    // --- SAVE STATE LOGIC ---
    useEffect(() => {
        if (!isRestored) return; // CRITICAL: Do not save until restored

        const stateToSave = {
            activeTab, searchTerm, sourceFilter, selectedRep, selectedTeam, filterMonth, filterYear
        };
        sessionStorage.setItem('crm_deals_view_state', JSON.stringify(stateToSave));
    }, [activeTab, searchTerm, sourceFilter, selectedRep, selectedTeam, filterMonth, filterYear, isRestored]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm, sourceFilter, selectedRep, selectedTeam, filterMonth, filterYear, selectedDistributor]);

    useEffect(() => {
        fetchDataWithIsolation();
    }, [userProfile]);

    const fetchDataWithIsolation = async () => {
        if (!userProfile) return;
        try {
            setLoading(true);

            // 1. Determine Team (Isolation)
            let teamIds: string[] = [];
            let teamMembers: UserProfile[] = [];

            if (isAdmin) {
                // Admin fetches all active profiles for filtering
                const { data } = await supabase.from('profiles').select('id, full_name, manager_id').eq('status', 'active');
                if (data) setEmployees(data as UserProfile[]);
            } else {
                // MOD or Sales
                let profileQuery = supabase.from('profiles').select('id, full_name, manager_id');
                if (isMod) {
                    // MOD sees self + subordinates
                    profileQuery = profileQuery.or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id}`);
                } else {
                    // Sales sees self
                    profileQuery = profileQuery.eq('id', userProfile.id);
                }
                const { data: profiles } = await profileQuery;
                if (profiles) {
                    teamMembers = profiles as UserProfile[];
                    setEmployees(teamMembers); // Dropdown only shows team
                    teamIds = teamMembers.map(p => p.id);
                }
            }

            // 2. Fetch Customers (Deals)
            let query = supabase
                .from('customers')
                .select('*')
                .eq('status', CustomerStatus.WON);

            // Remove specific order by updated_at from DB query to ensure we get all data first, we will sort in client
            // or keep it but handle nulls. Supabase puts nulls last/first depending on config.
            // We will sort client-side to be safe with mixed updated_at/created_at

            if (!isAdmin) {
                if (teamIds.length > 0) {
                    query = query.in('creator_id', teamIds);
                } else {
                    query = query.eq('creator_id', userProfile.id); // Fallback
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            // Sort client side to handle the fallback logic (updated_at OR created_at)
            const sortedData = (data as Customer[]).sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at).getTime();
                const dateB = new Date(b.updated_at || b.created_at).getTime();
                return dateB - dateA; // Descending
            });

            setCustomers(sortedData);

            // 3. Fetch Distributors
            const { data: distData } = await supabase.from('distributors').select('*').order('name');
            if (distData) setDistributors(distData as Distributor[]);

            // 4. Fetch Transactions (for dealer_debt and deposit calculations)
            const { data: transData } = await supabase.from('transactions').select('*').in('type', ['dealer_debt', 'deposit', 'incurred_expense']);
            if (transData) setTransactions(transData as Transaction[]);

        } catch (err) {
            console.warn("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    const executeApprove = async () => {
        if (!confirmAction) return;
        const { id, type } = confirmAction;
        const newStatus = type;

        try {
            // Update status and updated_at to now
            const { error } = await supabase.from('customers').update({
                deal_status: newStatus,
                updated_at: new Date().toISOString()
            }).eq('id', id);

            if (error) throw error;
            setConfirmAction(null);
            fetchDataWithIsolation(); // Refresh
        } catch (err: any) {
            const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            alert("Lỗi duyệt: " + errorMessage);
        }
    };

    // --- NEW: Manual Date Update Handler ---
    const handleUpdateDate = async () => {
        if (!dateForm.id || !dateForm.date) return;
        try {
            // Add current time to the date to make it ISO (or just use date part if using T00:00:00)
            // We'll append current time to keep it roughly correct, or just use mid-day
            const newDateISO = new Date(dateForm.date + 'T12:00:00').toISOString();

            const { error } = await supabase.from('customers').update({
                won_at: newDateISO,
                updated_at: new Date().toISOString() // Also update updated_at to bump sort order
            }).eq('id', dateForm.id);

            if (error) throw error;

            alert("Đã cập nhật ngày chốt đơn!");
            setShowDateModal(false);
            fetchDataWithIsolation();
        } catch (e: any) {
            alert("Lỗi cập nhật: " + e.message);
        }
    };

    const filteredCustomers = customers.filter(c => {
        // Enhanced Search Logic
        const normalizedSearch = searchTerm.replace(/\s+/g, '');
        const lowerSearchTerm = searchTerm.toLowerCase();

        const normalizedPhone = c.phone ? c.phone.replace(/\s+/g, '') : '';
        const normalizedSecPhone = c.secondary_phone ? c.secondary_phone.replace(/\s+/g, '') : '';

        const matchesSearch =
            (c.name?.toLowerCase() || '').includes(lowerSearchTerm) ||
            (c.interest?.toLowerCase() || '').includes(lowerSearchTerm) ||
            normalizedPhone.includes(normalizedSearch) ||
            normalizedSecPhone.includes(normalizedSearch);

        const ds = c.deal_status || 'processing';

        // Source Filter
        let matchesSource = true;
        if (sourceFilter === 'mkt') matchesSource = c.source === 'MKT Group';
        if (sourceFilter === 'other') matchesSource = c.source !== 'MKT Group';

        // Team Filter (Admin Only)
        let matchesTeam = true;
        if (isAdmin && selectedTeam !== 'all') {
            // Check if creator belongs to the selected team
            const creator = employees.find(e => e.id === c.creator_id);
            matchesTeam = creator?.manager_id === selectedTeam || creator?.id === selectedTeam;
        }

        // Rep Filter
        let matchesRep = true;
        if ((isAdmin || isMod) && selectedRep !== 'all') {
            matchesRep = c.creator_id === selectedRep;
        }

        // Status Check (Tab)
        let matchesStatus = false;
        if (activeTab === 'processing') {
            matchesStatus = ds === 'processing' || ds === 'completed_pending' || ds === 'refund_pending' || ds === 'suspended_pending';
        } else if (activeTab === 'completed') {
            matchesStatus = ds === 'completed';
        } else if (activeTab === 'refunded') {
            matchesStatus = ds === 'refunded';
        } else if (activeTab === 'suspended') {
            matchesStatus = ds === 'suspended' || ds === 'suspended_pending';
        }

        // Date Filter (Month/Year) - Based on Won At (Closing Date)
        let matchesDate = true;

        // Only filter date if Year is NOT 'all'
        if (filterYear !== 'all') {
            const dateToUse = c.won_at || c.updated_at || c.created_at;
            const d = new Date(dateToUse);
            const yearMatch = d.getFullYear() === filterYear;

            if (filterMonth !== 'all') {
                const monthMatch = (d.getMonth() + 1) === parseInt(filterMonth);
                matchesDate = yearMatch && monthMatch;
            } else {
                matchesDate = yearMatch;
            }
        }
        // If filterYear is 'all', we don't care about the date, show everything (matchesDate = true)

        // Distributor Filter
        let matchesDistributor = true;
        if (selectedDistributor !== 'all') {
            matchesDistributor = c.deal_details?.distributor === selectedDistributor;
        }

        return matchesSearch && matchesSource && matchesRep && matchesStatus && matchesTeam && matchesDate && matchesDistributor;
    });

    // PAGINATION LOGIC
    const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredCustomers.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredCustomers, currentPage]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Export Function
    const handleExport = () => {
        const dataToExport = filteredCustomers.map(c => ({
            "Khách hàng": c.name,
            "Số điện thoại": c.phone,
            "Dòng xe": c.interest || '',
            "Doanh thu (DK)": c.deal_details?.revenue || 0,
            "Doanh thu (Thực)": c.deal_details?.actual_revenue || 0,
            "Nguồn": c.source || '',
            "TVBH": c.sales_rep || '',
            "Trạng thái": c.deal_status === 'completed' ? 'Hoàn thành' : c.deal_status === 'refunded' ? 'Đã trả cọc' : 'Đang xử lý',
            "Ngày chốt/CN": new Date(c.won_at || c.updated_at || c.created_at).toLocaleDateString('vi-VN')
        }));

        const fileName = `Danh_sach_don_hang_${filterMonth}_${filterYear}_${new Date().getTime()}`;
        exportToExcel(dataToExport, fileName);
    };

    // Managers for Dropdown (Admin View)
    const managers = useMemo(() => {
        const managerIds = Array.from(new Set(employees.filter(p => p.manager_id).map(p => p.manager_id)));
        return managerIds.map(id => {
            const m = employees.find(p => p.id === id);
            return { id: id as string, name: m?.full_name || 'Unknown' };
        }).filter(m => m.name !== 'Unknown');
    }, [employees]);

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'completed_pending': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">Chờ duyệt Hoàn thành</span>;
            case 'refund_pending': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-bold border border-red-200">Chờ duyệt Trả cọc</span>;
            case 'suspended_pending': return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-md text-xs font-bold border border-orange-200 animate-pulse">Chờ duyệt Treo</span>;
            case 'completed': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-bold border border-green-200">Đã hoàn thành</span>;
            case 'refunded': return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-xs font-bold border border-gray-200">Đã trả cọc</span>;
            case 'suspended': return <span className="bg-gray-600 text-white px-2 py-1 rounded-md text-xs font-bold">Hồ sơ Treo</span>;
            default: return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md text-xs font-bold border border-yellow-200">Đang xử lý</span>;
        }
    };

    // Format currency helper
    const formatCurrency = (value: number) => value.toLocaleString('vi-VN');

    // Calculate dealer debt for a specific customer (by customer_id)
    const getDealerDebtByCustomer = (customerId: string) => {
        return transactions
            .filter(t => t.customer_id === customerId && t.type === 'dealer_debt' && !t.reason.includes('(Đã thu)'))
            .reduce((sum, t) => sum + t.amount, 0);
    };

    // Calculate sale debt for a customer (collected - incurred - deposited)
    const getCustomerDebt = (customerId: string, actualRevenue: number) => {
        const incurred = transactions
            .filter(t => t.customer_id === customerId && t.type === 'incurred_expense' && t.status === 'approved')
            .reduce((sum, t) => sum + t.amount, 0);
        const deposited = transactions
            .filter(t => t.customer_id === customerId && t.type === 'deposit' && t.status === 'approved')
            .reduce((sum, t) => sum + t.amount, 0);
        return Math.max(0, (actualRevenue - incurred) - deposited);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải danh sách...</div>;

    return (
        <div className="space-y-6 pb-20 relative">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileCheck2 className="text-green-600" />
                    Quản lý Đơn hàng
                </h1>

                <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto items-center flex-wrap">
                    {/* Time Filter */}
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-sm h-10">
                        <Calendar size={16} className="text-gray-500 ml-1" />
                        {/* Disable Month Select if Year is 'All' */}
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            disabled={filterYear === 'all'}
                            className={`bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer border-r border-gray-200 pr-2 mr-2 ${filterYear === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="all">Tất cả tháng</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
                        >
                            <option value="all">Tất cả năm</option>
                            {[2023, 2024, 2025, 2026].map(y => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>

                    {/* Team Filter (Admin Only) */}
                    {isAdmin && (
                        <div className="relative h-10">
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="appearance-none bg-indigo-50 border border-indigo-200 text-indigo-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-bold shadow-sm cursor-pointer h-full flex items-center"
                            >
                                <option value="all">Tất cả Team</option>
                                {managers.map(mgr => (
                                    <option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>
                                ))}
                            </select>
                            <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Rep Filter (Admin/Mod Only) */}
                    {(isAdmin || isMod) && (
                        <div className="relative h-10">
                            <select
                                value={selectedRep}
                                onChange={(e) => setSelectedRep(e.target.value)}
                                className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm font-bold shadow-sm cursor-pointer h-full"
                            >
                                <option value="all">Tất cả nhân viên</option>
                                {employees
                                    .filter(emp => isAdmin && selectedTeam !== 'all' ? (emp.manager_id === selectedTeam || emp.id === selectedTeam) : true)
                                    .map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))
                                }
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Source Filter */}
                    <div className="relative h-10">
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value as any)}
                            className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm font-bold shadow-sm cursor-pointer h-full"
                        >
                            <option value="all">Tất cả nguồn</option>
                            <option value="mkt">Nguồn MKT Group</option>
                            <option value="other">Nguồn Khác</option>
                        </select>
                        <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Distributor Filter */}
                    <div className="relative h-10">
                        <select
                            value={selectedDistributor}
                            onChange={(e) => setSelectedDistributor(e.target.value)}
                            className="appearance-none bg-orange-50 border border-orange-200 text-orange-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-100 text-sm font-bold shadow-sm cursor-pointer h-full"
                        >
                            <option value="all">Tất cả đại lý</option>
                            {distributors.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                        <Building2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
                    </div>

                    {/* EXPORT BUTTON - Only for Admin/Mod */}
                    {(isAdmin || isMod) && (
                        <div className='flex gap-2 items-center'>
                            <button
                                onClick={() => setShowProgressMonitor(true)}
                                className="flex items-center gap-2 h-10 px-4 bg-purple-600 text-white rounded-xl font-bold shadow-md hover:bg-purple-700 transition-colors"
                                title="Kiểm tra tiến độ giao xe"
                            >
                                <BarChart2 size={18} /> <span className="hidden sm:inline">Kiểm tra tiến độ</span>
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 h-10 px-4 bg-green-600 text-white rounded-xl font-bold shadow-md hover:bg-green-700 transition-colors"
                                title="Xuất danh sách ra Excel"
                            >
                                <Download size={18} /> <span className="hidden sm:inline">Xuất Excel</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* PROGRESS MONITOR MODAL */}
            {showProgressMonitor && (
                <ProgressMonitorModal
                    isOpen={showProgressMonitor}
                    onClose={() => setShowProgressMonitor(false)}
                    customers={customers} // List of WON customers
                    employees={employees}
                    userProfile={userProfile}
                    isAdmin={isAdmin}
                    isMod={isMod}
                />
            )}

            {/* Search */}
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm tên, dòng xe, SĐT (Chính/Phụ)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto pb-2 border-b border-gray-200 hide-scrollbar gap-2">
                <button
                    onClick={() => setActiveTab('processing')}
                    className={`px-6 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'processing' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Clock size={16} /> Đang xử lý
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-6 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'completed' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <CheckCircle2 size={16} /> Đã hoàn thành
                </button>
                <button
                    onClick={() => setActiveTab('refunded')}
                    className={`px-6 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'refunded' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <RotateCcw size={16} /> Trả cọc
                </button>
                <button
                    onClick={() => setActiveTab('suspended')}
                    className={`px-6 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'suspended' ? 'border-gray-600 text-gray-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Archive size={16} /> Hồ sơ Treo
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {paginatedCustomers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
                        {filterYear === 'all'
                            ? 'Không có hồ sơ nào trong toàn bộ lịch sử.'
                            : `Không có hồ sơ nào ${filterMonth !== 'all' ? `trong tháng ${filterMonth}/${filterYear}` : `trong năm ${filterYear}`}.`
                        }
                    </div>
                ) : (
                    paginatedCustomers.map(c => {
                        const dateToUse = c.won_at || c.updated_at || c.created_at;

                        const isoDate = new Date(dateToUse).toISOString().split('T')[0];

                        return (
                            <div
                                key={c.id}
                                className={`bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md transition-all relative cursor-pointer flex flex-col justify-between
                                ${c.deal_status?.includes('pending') ? 'border-blue-200 ring-2 ring-blue-100' : 'border-gray-100'}
                                ${c.deal_status === 'suspended' ? 'bg-gray-50 opacity-80' : ''}
                            `}
                                // Pass 'from' state to navigate back correctly
                                onClick={() => navigate(`/customers/${c.id}`, { state: { customerIds: filteredCustomers.map(cust => cust.id), from: '/deals' } })}
                            >
                                {/* Approval Actions for Admin/Mod */}
                                {(isAdmin || isMod) && (c.deal_status === 'completed_pending' || c.deal_status === 'refund_pending' || c.deal_status === 'suspended_pending') && (
                                    <div className="absolute top-4 right-4 flex gap-1 z-20">
                                        {c.deal_status === 'completed_pending' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmAction({ id: c.id, type: 'completed' }); }}
                                                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md tooltip transition-transform active:scale-95"
                                                title="Duyệt hoàn thành"
                                            >
                                                <ShieldCheck size={16} />
                                            </button>
                                        )}
                                        {c.deal_status === 'refund_pending' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmAction({ id: c.id, type: 'refunded' }); }}
                                                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md tooltip transition-transform active:scale-95"
                                                title="Duyệt trả cọc"
                                            >
                                                <Ban size={16} />
                                            </button>
                                        )}
                                        {c.deal_status === 'suspended_pending' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmAction({ id: c.id, type: 'suspended' }); }}
                                                className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-md tooltip transition-transform active:scale-95"
                                                title="Duyệt treo hồ sơ"
                                            >
                                                <PauseCircle size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center gap-3 mb-3 pr-4"> {/* Added pr-4 to avoid overlap */}
                                        {defaultAvatar ? (
                                            <img src={defaultAvatar} alt="Avatar" className="h-10 w-10 rounded-full object-cover bg-green-100 border border-green-200" />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                                                {c.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-gray-900 group-hover:text-primary-600">{c.name}</h3>
                                            <p className="text-xs text-gray-500">{c.phone}</p>
                                        </div>
                                    </div>

                                    {/* Vertical Progress Bar */}
                                    {(() => {
                                        // Calculate Progress
                                        const DELIVERY_STEPS = [
                                            { key: 'deposited', condition: () => true },
                                            { key: 'contract_signed', condition: () => true },
                                            { key: 'bank_approved', condition: (cust: Customer) => cust.deal_details?.payment_method === 'Ngân hàng' },
                                            { key: 'payment_invoice', condition: () => true },
                                            { key: 'invoiced', condition: () => true },
                                            { key: 'plate_registration', condition: () => true },
                                            { key: 'accessories_pdi', condition: () => true },
                                            { key: 'handover', condition: () => true },
                                            { key: 'collection_return', condition: () => true },
                                            { key: 'money_recovered', condition: () => true }
                                        ];

                                        const progressData = c.delivery_progress || {};
                                        const applicableSteps = DELIVERY_STEPS.filter(step => step.condition(c));

                                        if (applicableSteps.length === 0) return null;

                                        const completedCount = applicableSteps.filter(step => progressData[step.key]?.completed).length;
                                        const percent = Math.round((completedCount / applicableSteps.length) * 100);

                                        // Color logic: Red -> Orange -> Green
                                        let colorClass = 'bg-red-500';
                                        if (percent >= 50 && percent < 100) colorClass = 'bg-orange-500';
                                        if (percent === 100) colorClass = 'bg-green-500';

                                        return (
                                            <>
                                                <div className="absolute right-0 top-10 bottom-10 w-1.5 bg-gray-100 rounded-l-full overflow-hidden" title={`Tiến trình: ${percent}%`}>
                                                    <div
                                                        className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out ${colorClass}`}
                                                        style={{ height: `${percent}%` }}
                                                    />
                                                </div>

                                                {/* 0% Reminder Tag - Positioned Top Right */}
                                                {percent === 0 && !['refunded', 'suspended'].includes(c.deal_status || '') && (
                                                    <div className="absolute right-2 top-2 z-10">
                                                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-red-200 shadow-sm flex items-center gap-1 animate-pulse" title="Khách chưa có tiến trình nào">
                                                            <AlertTriangle size={12} /> Cập nhật
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}

                                    <div className="space-y-2 text-sm text-gray-700 mb-3 pr-3">
                                        <div className="flex items-center gap-2">
                                            <CarFront size={14} className="text-gray-400" />
                                            <span className="font-bold">{c.interest?.toUpperCase() || 'CHƯA RÕ'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 text-xs">Doanh thu:</span>
                                            <span className="font-bold text-green-600">
                                                {c.deal_details?.revenue ? c.deal_details.revenue.toLocaleString('vi-VN') : 0} VNĐ
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 text-xs">Nguồn:</span>
                                            <span className="font-bold text-gray-700">{c.source || 'N/A'}</span>
                                        </div>
                                        {/* Distributor */}
                                        <div className="flex items-center gap-2">
                                            <Building2 size={12} className="text-orange-500" />
                                            <span className="text-xs text-orange-600 font-bold">{c.deal_details?.distributor || 'N/A'}</span>
                                            {/* Dealer Debt Badge - Now based on customer_id */}
                                            {(() => {
                                                const dealerDebt = getDealerDebtByCustomer(c.id);
                                                return dealerDebt > 0 ? (
                                                    <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 animate-pulse">
                                                        <AlertTriangle size={10} /> Nợ: {formatCurrency(dealerDebt)}
                                                    </span>
                                                ) : null;
                                            })()}
                                        </div>
                                        {/* Sale Debt to Fund - Modified for visibility */}
                                        {(() => {
                                            const baseRevenue = c.deal_details?.actual_revenue || c.deal_details?.revenue || 0;
                                            if (baseRevenue > 0) {
                                                const saleDebt = getCustomerDebt(c.id, baseRevenue);
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 text-xs">Nợ quỹ:</span>
                                                        <span className={`font-bold ${saleDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {formatCurrency(saleDebt)} VNĐ
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                        {(isAdmin || isMod) && c.sales_rep && (
                                            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-50">
                                                <User size={12} className="text-blue-500" />
                                                <span className="text-xs text-blue-600 font-bold">{c.sales_rep}</span>
                                            </div>
                                        )}
                                        <div className="mt-2">
                                            {getStatusBadge(c.deal_status)}
                                        </div>
                                    </div>
                                </div>

                                {/* Display Closing/Update Date & Edit Button */}
                                <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                                    <div className="flex flex-col gap-1">
                                        <span className="flex items-center gap-1" title="Ngày tạo đơn">
                                            <Calendar size={12} /> Bắt đầu: {new Date(c.created_at).toLocaleDateString('vi-VN')}
                                        </span>
                                        {/* Always show closing date, preferring won_at */}
                                        <span className="flex items-center gap-1 text-green-600 font-bold" title="Ngày chốt đơn (won_at)">
                                            <CheckCircle2 size={12} /> Chốt: {new Date(c.won_at || c.updated_at || c.created_at).toLocaleDateString('vi-VN')}
                                        </span>
                                    </div>

                                    {isAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDateForm({ id: c.id, date: isoDate, name: c.name });
                                                setShowDateModal(true);
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                                            title="Sửa ngày chốt"
                                        >
                                            <Edit size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-gray-100">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-gray-700">
                        Trang {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            {/* Modal Approval */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <ShieldCheck className="text-green-600" /> Xác nhận duyệt
                            </h3>
                            <button onClick={() => setConfirmAction(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <p className="text-gray-600 text-sm">
                            Bạn có chắc chắn muốn duyệt yêu cầu <strong className="text-gray-900">
                                {confirmAction.type === 'completed' ? 'Hoàn thành' : confirmAction.type === 'suspended' ? 'Treo hồ sơ' : 'Trả cọc'}
                            </strong> này không?
                        </p>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                            <button
                                onClick={executeApprove}
                                className={`flex-1 py-2 font-bold rounded-xl text-white shadow-lg ${confirmAction.type === 'completed' ? 'bg-green-600 hover:bg-green-700' : confirmAction.type === 'suspended' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                Duyệt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Manual Date Edit (Admin Only) */}
            {showDateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Sửa ngày chốt đơn</h3>
                            <button onClick={() => setShowDateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-800">Đang sửa cho khách hàng: <strong>{dateForm.name}</strong></p>
                            <p className="text-xs text-blue-600 mt-1">Việc thay đổi ngày sẽ ảnh hưởng đến báo cáo doanh số tháng.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Chọn ngày mới</label>
                            <input
                                type="date"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                                value={dateForm.date}
                                onChange={(e) => setDateForm({ ...dateForm, date: e.target.value })}
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowDateModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                            <button onClick={handleUpdateDate} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Deals;


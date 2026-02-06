
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import {
    LayoutDashboard, Users, LogOut, Menu, X, UserCircle, Briefcase,
    FileCheck2, UserPlus, Gift, BadgeDollarSign, ChevronRight, ChevronDown, PiggyBank, CarFront, Landmark, Box, Settings, User, FileInput, BarChart2, Calendar, Calculator,
    FolderOpen, Mail, Moon, Sun, Sparkles, MessageCircle
} from 'lucide-react';

// ... (existing imports)
import { UserRole } from '../types';
import NewCustomerNotification from './NewCustomerNotification';
import VersionChecker from './VersionChecker';
import { useTheme } from '../contexts/ThemeContext';

import UserStatusIndicator from './UserStatusIndicator';
import VersionLabel from './VersionLabel';

interface NavItemDef {
    key: string;
    icon: React.ElementType;
    label: string;
    path: string;
    roleReq?: UserRole[]; // Roles required to see this (undefined = all)
    partTimeHidden?: boolean; // Hide from part-time?
    countFetcher?: () => Promise<number>; // Optional function to fetch badge count
    children?: NavItemDef[]; // Nested items
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // Badge State
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [menuOrder, setMenuOrder] = useState<string[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'lookup_tools': false, // Default collapsed - user can expand when needed
        'customer_allocation': false // Phân Bổ Khách - auto-expands when at child routes
    });

    const [menuLogo, setMenuLogo] = useState<string | null>(null);

    // Definition of all possible menu items
    const MENU_DEFINITIONS: NavItemDef[] = useMemo(() => [
        { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', path: '/' },
        {
            key: 'calendar',
            icon: Calendar,
            label: 'Lịch làm việc',
            path: '/calendar',
            countFetcher: async () => {
                if (!userProfile) return 0;
                const todayStr = new Date().toISOString().split('T')[0];
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];

                try {
                    // 1. Personal Tasks (Due today or overdue)
                    const { count: tCount } = await supabase.from('user_tasks')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', userProfile.id)
                        .eq('is_completed', false)
                        .lt('deadline', tomorrowStr); // deadline < tomorrow 00:00 (meaning <= today 23:59)

                    // 2. Customers requiring care
                    let profileIds: string[] = [userProfile.id];

                    // Mod & not in Consultant Mode -> Fetch Team
                    if (userProfile.role === UserRole.MOD && !userProfile.is_consultant_mode) {
                        const { data: team } = await supabase.from('profiles').select('id').or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id}`);
                        if (team) profileIds = team.map(t => t.id);
                    }

                    let q = supabase.from('customers').select('*', { count: 'exact', head: true });

                    // Scope
                    if (userProfile.role !== UserRole.ADMIN) {
                        q = q.in('creator_id', profileIds);
                    }

                    // Status not WON/LOST
                    q = q.neq('status', 'Chốt đơn').neq('status', 'Đã hủy');

                    // Filter Conditions (Match Calendar.tsx logic)
                    // - Special Care (Always)
                    // - Regular (Due <= Today)
                    // - Long Term (Due == Today)
                    const orConditions = [
                        `is_special_care.eq.true`,
                        `and(recare_date.lte.${todayStr},is_long_term.eq.false,is_special_care.eq.false)`,
                        `and(recare_date.eq.${todayStr},is_long_term.eq.true)`
                    ].join(',');

                    q = q.or(orConditions);

                    const { count: cCount } = await q;

                    return (tCount || 0) + (cCount || 0);
                } catch (e) {
                    console.error("Error fetching calendar badge", e);
                    return 0;
                }
            }
        },

        { key: 'quote', icon: Calculator, label: 'Báo giá Online', path: '/quote' },
        { key: 'analytics', icon: BarChart2, label: 'Phân tích (BI)', path: '/analytics', roleReq: [UserRole.ADMIN, UserRole.MOD] },
        { key: 'customers', icon: Users, label: 'Khách hàng', path: '/customers' },
        { key: 'deals', icon: FileCheck2, label: 'Đơn hàng', path: '/deals' },
        {
            key: 'customer_allocation',
            icon: UserPlus,
            label: 'Phân Bổ Khách',
            path: '',
            roleReq: [UserRole.ADMIN, UserRole.MOD],
            countFetcher: async () => {
                const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true }).or('sales_rep.is.null,sales_rep.eq.,sales_rep.eq.System,sales_rep.eq.Chưa phân bổ');
                return count || 0;
            },
            children: [
                { key: 'assign', icon: UserPlus, label: 'Phân bổ Leads', path: '/leads/assign', roleReq: [UserRole.ADMIN, UserRole.MOD] },
                {
                    key: 'leads_queue',
                    icon: Mail,
                    label: 'Lead Email (Chờ)',
                    path: '/leads/queue',
                    roleReq: [UserRole.ADMIN, UserRole.MOD],
                    countFetcher: async () => {
                        // Base query for pending leads
                        let query = supabase.from('customers').select('*', { count: 'exact', head: true }).or('sales_rep.is.null,sales_rep.eq.,sales_rep.eq.System,sales_rep.eq.Chưa phân bổ');

                        // If MOD, check their page config for source_filter
                        if (userProfile?.role === UserRole.MOD) {
                            const { data: pageConfig } = await supabase
                                .from('lead_email_pages')
                                .select('source_filter')
                                .eq('mod_id', userProfile.id)
                                .eq('is_active', true)
                                .maybeSingle();

                            if (pageConfig?.source_filter) {
                                query = query.eq('source', pageConfig.source_filter);
                            }
                        }

                        const { count } = await query;
                        return count || 0;
                    }
                },
                { key: 'lead_email_settings', icon: Settings, label: 'Cấu hình Lead Email', path: '/admin/lead-email-settings', roleReq: [UserRole.ADMIN] },
            ]
        },
        { key: 'finance', icon: BadgeDollarSign, label: 'Tài chính & Quỹ', path: '/finance' },
        {
            key: 'proposals', icon: FileInput, label: 'Đề Xuất (Mới)', path: '/proposals', countFetcher: async () => {
                if (!userProfile) return 0;
                let q = supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
                if (userProfile.role === 'employee') {
                    q = q.eq('user_id', userProfile.id);
                }
                const { count } = await q;
                return count || 0;
            }
        },
        {
            key: 'lookup_tools',
            icon: FolderOpen,
            label: 'Chính sách & Tồn kho',
            path: '',
            children: [
                { key: 'car_prices', icon: CarFront, label: 'Bảng giá Xe', path: '/resources/cars' },
                { key: 'bank_rates', icon: Landmark, label: 'Lãi suất Bank', path: '/resources/banks' },
                { key: 'inventory', icon: Box, label: 'Kho xe (Tồn)', path: '/resources/inventory' },
                { key: 'promotions', icon: Gift, label: 'Chính sách Team', path: '/resources/promotions' },
            ]
        },
        {
            key: 'employees', icon: Briefcase, label: 'Nhân sự', path: '/employees', roleReq: [UserRole.ADMIN, UserRole.MOD], countFetcher: async () => {
                const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
                return count || 0;
            }
        },
        {
            key: 'team_fund', icon: PiggyBank, label: 'Quỹ Nhóm', path: '/fund', partTimeHidden: true, countFetcher: async () => {
                if (!userProfile?.id) return 0;
                const { count } = await supabase.from('team_fines').select('*', { count: 'exact', head: true }).eq('user_id', userProfile.id).eq('status', 'pending');
                return count || 0;
            }
        },
        { key: 'fund_history', icon: FolderOpen, label: 'Lịch sử Quỹ', path: '/fund-history', roleReq: [UserRole.ADMIN, UserRole.MOD] },
        { key: 'utilities', icon: Sparkles, label: 'Tiện ích', path: '/utilities' },
        { key: 'configuration', icon: Settings, label: 'Cấu hình', path: '/system', roleReq: [UserRole.ADMIN, UserRole.MOD] },
        { key: 'profile', icon: User, label: 'Cá nhân', path: '/profile' },
    ], [userProfile]);

    useEffect(() => {
        fetchMenuConfig();
        fetchLogoConfig();
        fetchBadges();

        const handleForceUpdate = () => {
            fetchMenuConfig();
            fetchLogoConfig();
        };
        window.addEventListener('menu_config_updated', handleForceUpdate);

        const channel = supabase.channel('layout-menu-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_settings', filter: 'key=in.(menu_order,system_logo_menu)' },
                () => {
                    fetchMenuConfig();
                    fetchLogoConfig();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('menu_config_updated', handleForceUpdate);
        }
    }, [userProfile]);

    const fetchMenuConfig = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'menu_order').maybeSingle();
            let order: string[] = [];

            if (data && data.value) {
                try { order = JSON.parse(data.value); } catch (e) { }
            }

            const allKeys = MENU_DEFINITIONS.map(i => i.key);
            if (order.length === 0) {
                setMenuOrder(allKeys);
            } else {
                const mappedOrder = order.map(k => k === 'distributors' ? 'configuration' : k);
                const missingKeys = allKeys.filter(k => !mappedOrder.includes(k));
                setMenuOrder([...mappedOrder, ...missingKeys]);
            }
        } catch (e) {
            console.error("Menu config error", e);
            setMenuOrder(MENU_DEFINITIONS.map(i => i.key));
        }
    };

    const fetchLogoConfig = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'system_logo_menu').maybeSingle();
            if (data?.value) setMenuLogo(data.value);
        } catch (e) { }
    }

    const fetchBadges = async () => {
        const newCounts: Record<string, number> = {};

        const processItem = async (item: NavItemDef) => {
            if (item.countFetcher && checkPermission(item)) {
                try {
                    const count = await item.countFetcher();
                    newCounts[item.key] = count;
                } catch (e) { }
            }
            if (item.children) {
                for (const child of item.children) {
                    await processItem(child);
                }
            }
        };

        for (const item of MENU_DEFINITIONS) {
            await processItem(item);
        }
        setCounts(newCounts);
    };

    const checkPermission = (item: NavItemDef) => {
        if (item.partTimeHidden && userProfile?.is_part_time) return false;
        if (item.roleReq && userProfile && !item.roleReq.includes(userProfile.role)) return false;
        // Special check for leads_queue: MOD needs can_access_leads_queue permission
        if (item.key === 'leads_queue' && userProfile?.role === UserRole.MOD && !userProfile.can_access_leads_queue) {
            return false;
        }
        return true;
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const sortedNavItems = useMemo(() => {
        return menuOrder
            .map(key => MENU_DEFINITIONS.find(i => i.key === key))
            .filter((item): item is NavItemDef => !!item && checkPermission(item));
    }, [menuOrder, MENU_DEFINITIONS, userProfile]);

    return (
        <div className="flex h-screen bg-[#f8fafc] dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200">
            {isSidebarOpen && <div className="fixed inset-0 z-[90] bg-slate-900/60 font-sans text-slate-800 transition-colors duration-200  md:hidden" onClick={() => setIsSidebarOpen(false)} />}

            <aside className={`fixed inset-y-0 left-0 z-[100] w-72 bg-white dark:bg-slate-800 border-r border-slate-200/60 dark:border-slate-700 transition-all duration-300 md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl md:shadow-none flex flex-col`}>
                <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-slate-700/50">
                    {menuLogo ? (
                        <div className="mr-3 flex items-center justify-center">
                            <img src={menuLogo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
                        </div>
                    ) : (
                        <div className="mr-3 flex items-center justify-center">
                            <img src="/logo.svg" alt="VinFast Logo" className="w-10 h-10 object-contain" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">VinFast<span className="text-primary-600">CRM</span></h1>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Enterprise</p>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden ml-auto text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"><X /></button>
                </div>

                <div className="p-4">
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100/50 dark:border-slate-600/50 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 p-0.5 flex-shrink-0 shadow-sm overflow-hidden">
                            {userProfile?.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full rounded-full object-cover" /> : <UserCircle className="w-full h-full text-slate-300 dark:text-slate-400" />}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{userProfile?.full_name || 'User'}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {userProfile?.id && <UserStatusIndicator userId={userProfile.id} showText={false} />}
                                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize font-medium whitespace-nowrap">{userProfile?.role || 'Sales'}</p>
                                {userProfile?.is_part_time && <span className="text-[9px] bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider border border-orange-200 dark:border-orange-800">Part-time</span>}
                                {userProfile?.member_tier && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider border ${userProfile.member_tier === 'Gold' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' :
                                        userProfile.member_tier === 'Platinum' ? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' :
                                            userProfile.member_tier === 'Diamond' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700' : ''
                                        }`}>
                                        {userProfile.member_tier}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-600/80 transition-all"
                            title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>
                </div>

                <div className="px-4 py-2">
                    <Link to="/community" onClick={() => setIsSidebarOpen(false)} className="group relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                            <div className="relative">
                                <MessageCircle size={20} className="fill-indigo-100 dark:fill-indigo-900/50" />
                                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">Cộng đồng</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">Thảo luận & Trao đổi</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </Link>
                </div>

                <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu chính</p>
                    <nav className="space-y-1">
                        {sortedNavItems.map((item) => {
                            // Check if item has children
                            if (item.children) {
                                // For a group, we check if any child is visible to show the group
                                const visibleChildren = item.children.filter(child => checkPermission(child));
                                if (visibleChildren.length === 0) return null;

                                const isExpanded = expandedGroups[item.key];
                                // Check if any child is active to highlight parent
                                const isChildActive = visibleChildren.some(child => location.pathname === child.path);

                                // Calculate total badge count for the group
                                const totalGroupCount = visibleChildren.reduce((sum, child) => sum + (counts[child.key] || 0), 0);

                                return (
                                    <div key={item.key} className="mb-1">
                                        <button
                                            onClick={() => setExpandedGroups(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${isExpanded || isChildActive
                                                ? 'text-slate-800 dark:text-white bg-slate-100/50 dark:bg-slate-700/40'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:text-slate-900 dark:hover:text-slate-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon size={20} className={`${isExpanded || isChildActive ? 'text-primary-600' : 'text-slate-400'} transition-colors`} />
                                                <span>{item.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {totalGroupCount > 0 && (
                                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                        {totalGroupCount}
                                                    </span>
                                                )}
                                                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100 mt-1 space-y-1' : 'max-h-0 opacity-0'}`}>
                                            {visibleChildren.map(child => {
                                                const isActive = location.pathname === child.path;
                                                const badgeCount = counts[child.key];
                                                return (
                                                    <Link key={child.key} to={child.path} onClick={() => setIsSidebarOpen(false)}
                                                        className={`flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ml-3 ${isActive
                                                            ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:text-slate-900 dark:hover:text-slate-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {/* <child.icon size={18} className={`${isActive ? 'text-white' : 'text-slate-400'} transition-colors`} /> */}
                                                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></span>
                                                            <span>{child.label}</span>
                                                        </div>
                                                        {badgeCount ? (
                                                            <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${'bg-red-500'}`}>
                                                                {badgeCount}
                                                            </span>
                                                        ) : null}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }

                            const isActive = location.pathname === item.path;
                            const badgeCount = counts[item.key];

                            return (
                                <Link key={item.key} to={item.path} onClick={() => setIsSidebarOpen(false)}
                                    className={`group flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${isActive
                                        ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={20} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary-600'} transition-colors`} />
                                        <span>{item.label}</span>
                                    </div>
                                    {badgeCount ? (
                                        <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${item.key === 'team_fund' ? 'bg-red-600 animate-pulse' : item.key === 'proposals' ? 'bg-orange-500' : 'bg-red-500'}`}>
                                            {badgeCount}
                                        </span>
                                    ) : isActive && (
                                        <ChevronRight size={16} className="text-white/80" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700/50">
                    <button onClick={handleSignOut} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30 group">
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Đăng xuất
                    </button>
                </div>

                <div className="px-6 pb-4 text-center">
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">
                        <VersionLabel />
                    </p>
                </div>
            </aside >

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc] dark:bg-slate-900 transition-colors duration-200">
                <header className="md:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm z-30 sticky top-0 transition-colors duration-200">
                    <div className="flex items-center gap-2">
                        {menuLogo ? (
                            <img src={menuLogo} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
                        ) : (
                            <img src="/logo.svg" alt="VinFast Logo" className="w-8 h-8 object-contain" />
                        )}
                        <span className="font-extrabold text-slate-800 dark:text-white text-lg">VinFast CRM</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={toggleTheme} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Menu /></button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <div className="mx-auto w-full px-4 animate-fade-in pb-10">
                        {children}
                    </div>
                </div>
            </main>

            {/* New Customer Notification Popup for Employees */}
            <NewCustomerNotification />

            {/* Mobile: Floating Chat Bubble */}


            {/* Auto Update Checker */}
            <VersionChecker />

            {/* Locked Account Popup (5 Days Inactivity) */}
            {userProfile?.role === UserRole.EMPLOYEE && userProfile.is_locked_view && userProfile.is_locked_add && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center border-2 border-red-100 flex flex-col items-center">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <span className="text-red-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tài khoản tạm thời khoá</h2>
                        <p className="text-gray-600 mb-6 px-4">
                            Do không đăng nhập trong <strong className="text-red-600">05 ngày</strong>, chức năng Xem và Thêm khách hàng đã bị tạm khóa.
                            <br /><br />
                            <span className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-sm font-bold border border-red-100">Vui lòng liên hệ Quản lý để mở khóa</span>
                        </p>
                        <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors w-full">
                            Đã hiểu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;

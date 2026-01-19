
import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { 
  LayoutDashboard, Users, LogOut, Menu, X, UserCircle, Briefcase, UserCog, Building2,
  FileCheck2, UserPlus, Gift, BadgeDollarSign, ChevronRight, PiggyBank, CarFront, Landmark, AlertCircle, Box, Settings, User, FileInput, BarChart2, Calendar, Calculator,
  TableProperties
} from 'lucide-react';
import { UserRole } from '../types';

const { Link, useLocation, useNavigate } = ReactRouterDOM as any;

interface NavItemDef {
  key: string;
  icon: React.ElementType;
  label: string;
  path: string;
  roleReq?: UserRole[]; // Roles required to see this (undefined = all)
  partTimeHidden?: boolean; // Hide from part-time?
  countFetcher?: () => Promise<number>; // Optional function to fetch badge count
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Badge State
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [menuOrder, setMenuOrder] = useState<string[]>([]);

  // Definition of all possible menu items
  const MENU_DEFINITIONS: NavItemDef[] = useMemo(() => [
    { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', path: '/' },
    { key: 'calendar', icon: Calendar, label: 'Lịch làm việc', path: '/calendar' },
    { key: 'quote', icon: Calculator, label: 'Báo giá Online', path: '/quote' },
    { key: 'bank_calculator', icon: TableProperties, label: 'Tính lãi Bank', path: '/bank-calculator' },
    { key: 'analytics', icon: BarChart2, label: 'Phân tích (BI)', path: '/analytics', roleReq: [UserRole.ADMIN, UserRole.MOD] },
    { key: 'customers', icon: Users, label: 'Khách hàng', path: '/customers' },
    { key: 'deals', icon: FileCheck2, label: 'Đơn hàng', path: '/deals' },
    { key: 'finance', icon: BadgeDollarSign, label: 'Tài chính & Quỹ', path: '/finance' },
    { key: 'proposals', icon: FileInput, label: 'Đề Xuất (Mới)', path: '/proposals', countFetcher: async () => {
        if (!userProfile) return 0;
        let q = supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        if (userProfile.role === 'employee') {
            q = q.eq('user_id', userProfile.id); 
        }
        const { count } = await q;
        return count || 0;
    }},
    { key: 'car_prices', icon: CarFront, label: 'Bảng giá Xe', path: '/car-prices' },
    { key: 'bank_rates', icon: Landmark, label: 'Lãi suất Bank', path: '/bank-rates' },
    { key: 'inventory', icon: Box, label: 'Kho xe (Tồn)', path: '/inventory' },
    { key: 'promotions', icon: Gift, label: 'Chính sách Team', path: '/promotions' },
    { key: 'assign', icon: UserPlus, label: 'Phân bổ Leads', path: '/assign', roleReq: [UserRole.ADMIN, UserRole.MOD] },
    { key: 'employees', icon: Briefcase, label: 'Nhân sự', path: '/employees', roleReq: [UserRole.ADMIN, UserRole.MOD], countFetcher: async () => {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        return count || 0;
    }},
    { key: 'team_fund', icon: PiggyBank, label: 'Quỹ Nhóm', path: '/team-fund', partTimeHidden: true, countFetcher: async () => {
        if (!userProfile?.id) return 0;
        const { count } = await supabase.from('team_fines').select('*', { count: 'exact', head: true }).eq('user_id', userProfile.id).eq('status', 'pending');
        return count || 0;
    }},
    { key: 'configuration', icon: Settings, label: 'Cấu hình', path: '/configuration', roleReq: [UserRole.ADMIN, UserRole.MOD] },
    { key: 'profile', icon: User, label: 'Cá nhân', path: '/profile' },
  ], [userProfile]);

  useEffect(() => {
    fetchMenuConfig();
    fetchBadges();

    const handleForceUpdate = () => fetchMenuConfig();
    window.addEventListener('menu_config_updated', handleForceUpdate);

    const channel = supabase.channel('layout-menu-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.menu_order' },
        () => {
          fetchMenuConfig();
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
              try { order = JSON.parse(data.value); } catch (e) {}
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

  const fetchBadges = async () => {
      const newCounts: Record<string, number> = {};
      for (const item of MENU_DEFINITIONS) {
          if (item.countFetcher && checkPermission(item)) {
              try {
                  const count = await item.countFetcher();
                  newCounts[item.key] = count;
              } catch (e) {}
          }
      }
      setCounts(newCounts);
  };

  const checkPermission = (item: NavItemDef) => {
      if (item.partTimeHidden && userProfile?.is_part_time) return false;
      if (item.roleReq && userProfile && !item.roleReq.includes(userProfile.role)) return false;
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
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800">
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/60 transition-transform duration-300 md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl md:shadow-none flex flex-col`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white font-bold text-2xl shadow-glow mr-3">V</div>
            <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">VinFast<span className="text-primary-600">CRM</span></h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Enterprise</p>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden ml-auto text-slate-400 hover:text-slate-600"><X/></button>
        </div>

        <div className="p-4">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100/50 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 p-0.5 flex-shrink-0 shadow-sm overflow-hidden">
                    {userProfile?.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full rounded-full object-cover"/> : <UserCircle className="w-full h-full text-slate-300"/>}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-900 truncate">{userProfile?.full_name || 'User'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <p className="text-xs text-slate-500 capitalize font-medium">{userProfile?.role || 'Sales'}</p>
                        {userProfile?.is_part_time && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded uppercase font-bold">Part-time</span>}
                    </div>
                </div>
            </div>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu chính</p>
            <nav className="space-y-1">
                {sortedNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const badgeCount = counts[item.key];
                    
                    return (
                        <Link key={item.key} to={item.path} onClick={() => setIsSidebarOpen(false)}
                            className={`group flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                isActive 
                                ? 'bg-primary-600 text-white shadow-md shadow-primary-200' 
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
                                <ChevronRight size={16} className="text-white/80"/>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>

        <div className="p-4 border-t border-slate-100">
            <button onClick={handleSignOut} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 group">
                <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" /> 
                Đăng xuất
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
          <header className="md:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-slate-200 shadow-sm z-30 sticky top-0">
              <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold">V</div>
                  <span className="font-extrabold text-slate-800 text-lg">VinFast CRM</span>
              </div>
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu/></button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <div className="mx-auto max-w-7xl animate-fade-in pb-10">
                  {children}
              </div>
          </div>
      </main>
    </div>
  );
};

export default Layout;

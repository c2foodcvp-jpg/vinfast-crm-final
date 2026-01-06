
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Users, TrendingUp, CheckCircle, Plus, Loader2, AlertTriangle, Clock, Calendar, BellRing, ChevronRight, Webhook, Send, X, Settings, Zap, MessageSquarePlus, BarChart3, UserPlus, Mail, Copy, Terminal, ExternalLink, ArrowRightLeft, FileCheck2, FileText, Save, Bell, Hand, Filter, Briefcase, Trophy, UserX, MapPin, CarFront, ChevronDown, BadgeDollarSign
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CustomerStatus, Customer, UserProfile, UserRole, CAR_MODELS, CustomerClassification } from '../types';

const { useNavigate } = ReactRouterDOM as any;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

const Dashboard: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, new: 0, won: 0, potential: 0 });
  const [alerts, setAlerts] = useState({ 
      due: 0, overdue: 0, pendingCustomers: 0, pendingEmployees: 0, pendingTransfers: 0, pendingDeals: 0, assignedTodayToMe: 0, pendingAckCount: 0, pendingAckReps: 0, expiredLongTerm: 0, pendingFinance: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [leadData, setLeadData] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  // Performance Filter State
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  // Discord State (Global Config)
  const [isDiscordModalOpen, setIsDiscordModalOpen] = useState(false);
  // State to hold URLs for editing (Admin) or using (All users)
  const [discordConfig, setDiscordConfig] = useState({
      webhookUrl: '',
      newCustomerWebhookUrl: '',
      summaryWebhookUrl: '',
      assignWebhookUrl: ''
  });
  const [isAutoSend, setIsAutoSend] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Notification Bell State
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);

  // --- ADD CUSTOMER MODAL STATE ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendToDiscord, setSendToDiscord] = useState(true);
  
  // DUPLICATE MODAL STATE
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<{id: string, name: string, sales_rep: string, phone: string} | null>(null);

  // GMT+7 Helper
  const getLocalTodayStr = () => {
    // Create date object for current time
    const now = new Date();
    // Offset for Vietnam (GMT+7) = 7 * 60 * 60 * 1000 milliseconds
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return vnTime.toISOString().split('T')[0];
  };
  const todayStr = getLocalTodayStr();

  const initialFormState = {
    name: '', phone: '', location: '', source: 'MKT Group', source_detail: '', interest: '', 
    notes: '', isZaloOnly: false, recare_date: todayStr, classification: 'Warm' as CustomerClassification
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchStats();
    loadDiscordSettings(); // Load for EVERYONE so Sales can trigger webhooks too
    const handleClickOutside = (event: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userProfile]);

  const loadDiscordSettings = async () => { 
      // Try fetching from app_settings first (Source of Truth)
      try {
          const { data } = await supabase.from('app_settings').select('*').in('key', ['discord_webhook_new_lead', 'discord_webhook_summary', 'discord_webhook_assign', 'discord_webhook_report']);
          
          const newConfig = { ...discordConfig };
          if (data) {
              data.forEach((setting: any) => {
                  if (setting.key === 'discord_webhook_report') newConfig.webhookUrl = setting.value;
                  if (setting.key === 'discord_webhook_new_lead') newConfig.newCustomerWebhookUrl = setting.value;
                  if (setting.key === 'discord_webhook_summary') newConfig.summaryWebhookUrl = setting.value;
                  if (setting.key === 'discord_webhook_assign') newConfig.assignWebhookUrl = setting.value;
              });
          }
          setDiscordConfig(newConfig);
          
          // Legacy/Fallback: Update local storage for other pages
          localStorage.setItem('vinfast_crm_discord_webhook_new_lead', newConfig.newCustomerWebhookUrl);
          localStorage.setItem('vinfast_crm_discord_webhook_assign', newConfig.assignWebhookUrl);
      } catch (e) {
          console.error("Error loading global discord settings", e);
      }
  };

  const saveDiscordSettings = async () => {
      setSavingSettings(true);
      try {
          // Save to app_settings table
          await supabase.from('app_settings').upsert([
              { key: 'discord_webhook_report', value: discordConfig.webhookUrl },
              { key: 'discord_webhook_new_lead', value: discordConfig.newCustomerWebhookUrl },
              { key: 'discord_webhook_summary', value: discordConfig.summaryWebhookUrl },
              { key: 'discord_webhook_assign', value: discordConfig.assignWebhookUrl },
          ]);
          
          // Sync Local Storage
          localStorage.setItem('vinfast_crm_discord_webhook', discordConfig.webhookUrl);
          localStorage.setItem('vinfast_crm_discord_webhook_new_lead', discordConfig.newCustomerWebhookUrl);
          localStorage.setItem('vinfast_crm_discord_webhook_summary', discordConfig.summaryWebhookUrl);
          localStorage.setItem('vinfast_crm_discord_webhook_assign', discordConfig.assignWebhookUrl);

          alert("Đã lưu cấu hình Discord cho toàn hệ thống!");
          setIsDiscordModalOpen(false);
      } catch (e) {
          alert("Lỗi lưu cấu hình. Đảm bảo bảng app_settings đã được tạo.");
      } finally {
          setSavingSettings(false);
      }
  };

  const handleSendDiscordReport = async (isSilent = false) => { };

  const fetchStats = async () => {
    try {
      setLoading(true);
      let query = supabase.from('customers').select('*');
      
      // Determine IDs to filter
      let teamIds: string[] = [];
      
      if (isAdmin) {
          // Admin sees all
      } else if (isMod && userProfile) {
          const { data: teamMembers } = await supabase.from('profiles').select('id').eq('manager_id', userProfile.id);
          teamIds = teamMembers ? teamMembers.map(m => m.id) : [];
          teamIds.push(userProfile.id);
          query = query.in('creator_id', teamIds);
      } else if (userProfile) {
          query = query.eq('creator_id', userProfile.id);
      }

      const { data, error } = await query;
      if (error) { console.warn("Error loading dashboard data", error); setLoading(false); return; }
      const customers = data as Customer[] || [];
      setAllCustomers(customers);

      if (isAdmin || isMod) {
          const { data: profiles } = await supabase.from('profiles').select('*');
          if (profiles) setAllProfiles(profiles as UserProfile[]);
      }
      
      const total = customers.length;
      
      // GMT+7 Date Comparison
      const newLeads = customers.filter((c: any) => {
          if (!c.created_at) return false;
          // Convert UTC created_at to GMT+7 Date object
          const d = new Date(c.created_at);
          const vnDate = new Date(d.getTime() + (7 * 60 * 60 * 1000));
          const cDate = vnDate.toISOString().split('T')[0];
          return cDate === todayStr;
      }).length;

      const won = customers.filter((c: any) => c.status === CustomerStatus.WON).length;
      
      const potential = customers.filter((c: any) => 
          c.classification === 'Hot' && 
          c.status !== CustomerStatus.WON && 
          c.status !== CustomerStatus.LOST
      ).length;

      setStats({ total, new: newLeads, won, potential });

      // Alerts Logic (Using todayStr which is now GMT+7)
      const dueCount = customers.filter((c: any) => {
          if (c.is_special_care || c.is_long_term) return false;
          if (!c.recare_date || c.status === CustomerStatus.LOST || c.status === CustomerStatus.WON) return false;
          return c.recare_date === todayStr;
      }).length;

      // UPDATE: Logic quá hạn (Đã fix chính xác để khớp CustomerList)
      const overdueCount = customers.filter((c: any) => {
          if (c.is_special_care) return false; 
          if (c.is_long_term) return false; // Loại trừ CS Dài hạn
          if (c.status === CustomerStatus.LOST || c.status === CustomerStatus.WON) return false;
          if (!c.recare_date) return false;
          return c.recare_date < todayStr;
      }).length;

      // UPDATE: Hết hạn CS Dài hạn (Chỉ tính ĐÚNG ngày hôm nay hoặc trễ hơn)
      const expiredLongTerm = customers.filter((c: any) => {
          if (!c.is_long_term) return false;
          if (c.status === CustomerStatus.WON || c.status === CustomerStatus.LOST) return false;
          // Logic mới: Chỉ báo alert nếu recare_date <= todayStr (đến hạn phải chăm sóc lại)
          if (!c.recare_date) return false;
          return c.recare_date <= todayStr;
      }).length;

      const assignedTodayToMe = (!isAdmin && !isMod) ? customers.filter((c: Customer) => {
          return c.status === CustomerStatus.NEW && c.is_acknowledged === false && c.creator_id === userProfile?.id;
      }).length : 0;

      const unacknowledgedLeads = customers.filter((c: any) => c.status === CustomerStatus.NEW && c.is_acknowledged === false && c.sales_rep);
      const pendingAckCount = unacknowledgedLeads.length;
      const uniqueReps = new Set(unacknowledgedLeads.map((c: any) => c.sales_rep));
      const pendingAckReps = uniqueReps.size;

      let pendingFinance = 0;
      if (isAdmin || isMod) {
          const { count: financeCount } = await supabase.from('transactions').select('*', {count: 'exact', head: true}).eq('status', 'pending');
          pendingFinance = financeCount || 0;
      }

      const pendingCustomers = customers.filter((c: any) => c.status === CustomerStatus.WON_PENDING || c.status === CustomerStatus.LOST_PENDING).length;
      const pendingTransfers = customers.filter((c: any) => !!c.pending_transfer_to).length;
      const pendingDeals = customers.filter((c: any) => c.deal_status === 'completed_pending' || c.deal_status === 'refund_pending').length;

      let pendingEmployees = 0;
      if (isAdmin || isMod) {
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
          pendingEmployees = count || 0;
      }

      setAlerts({ due: dueCount, overdue: overdueCount, pendingCustomers, pendingEmployees, pendingTransfers, pendingDeals, assignedTodayToMe, pendingAckCount, pendingAckReps, expiredLongTerm, pendingFinance });

      const statusCounts = customers.reduce((acc: any, curr: any) => { acc[curr.status] = (acc[curr.status] || 0) + 1; return acc; }, {});
      const pieData = Object.keys(statusCounts).map(status => ({ name: status, value: statusCounts[status] }));
      setStatusData(pieData);

      // Trend Data Logic (GMT+7 Adjusted)
      const last7Days = [];
      const now = new Date();
      // Adjust 'now' to GMT+7 to get correct "Today" reference
      const vnNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      
      for (let i = 6; i >= 0; i--) {
          const d = new Date(vnNow);
          d.setDate(vnNow.getDate() - i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          last7Days.push(`${y}-${m}-${day}`); 
      }

      const trendData = last7Days.map(dateStr => {
          const count = customers.filter((c: any) => {
              if (!c.created_at) return false;
              const d = new Date(c.created_at);
              const vnDate = new Date(d.getTime() + (7 * 60 * 60 * 1000));
              const cDate = vnDate.toISOString().split('T')[0];
              return cDate === dateStr;
          }).length;
          const [y, m, d] = dateStr.split('-');
          return { name: `${d}/${m}`, customers: count };
      });

      setLeadData(trendData);

    } catch (err) { console.warn("Could not fetch stats:", err); } finally { setLoading(false); }
  };

  // ... (rest of the file remains unchanged)
  const repStats = useMemo(() => {
      if (!allProfiles.length || !allCustomers.length) return [];
      let targetProfiles = allProfiles.filter(p => p.role !== UserRole.ADMIN && p.status === 'active');
      if (isMod && userProfile) targetProfiles = targetProfiles.filter(p => p.manager_id === userProfile.id);
      if (isAdmin && selectedTeam !== 'all') targetProfiles = targetProfiles.filter(p => p.manager_id === selectedTeam);

      return targetProfiles.map(rep => {
          const repCustomers = allCustomers.filter(c => c.creator_id === rep.id);
          const total = repCustomers.length;
          const won = repCustomers.filter(c => c.status === CustomerStatus.WON).length;
          const stopped = repCustomers.filter(c => c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING).length;
          const active = total - won - stopped; 
          const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0.0';
          return { id: rep.id, name: rep.full_name, avatar: rep.avatar_url, role: rep.role, total, active, won, stopped, conversionRate };
      }).sort((a, b) => b.won - a.won); 
  }, [allProfiles, allCustomers, isMod, isAdmin, userProfile, selectedTeam]);

  const managers = useMemo(() => {
      const managerIds = Array.from(new Set(allProfiles.filter(p => p.manager_id).map(p => p.manager_id)));
      return managerIds.map(id => {
          const m = allProfiles.find(p => p.id === id);
          return { id: id as string, name: m?.full_name || 'Unknown' };
      }).filter(m => m.name !== 'Unknown');
  }, [allProfiles]);

  const totalPending = alerts.pendingCustomers + alerts.pendingEmployees + alerts.pendingTransfers + alerts.pendingDeals + alerts.overdue + alerts.pendingFinance;
  const userNotifCount = alerts.due + alerts.overdue + alerts.assignedTodayToMe + alerts.expiredLongTerm; 
  const displayNotifCount = (isAdmin || isMod) ? totalPending : userNotifCount;

  // --- ADD CUSTOMER LOGIC ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleZaloOnly = () => {
     setFormData(prev => ({ ...prev, isZaloOnly: !prev.isZaloOnly }));
  }

  const normalizePhone = (p: string) => {
    if (!p) return '';
    return p.toString().replace(/\D/g, '');
  };

  const sendNewCustomerWebhook = async (customer: Customer, notes: string) => {
      const url = discordConfig.newCustomerWebhookUrl;
      if (!url) { console.warn("No Webhook URL found for New Customer"); return; }
      try {
          await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
              username: "Thông báo Khách Mới",
              embeds: [{
                  title: "🔥 CÓ KHÁCH HÀNG MỚI!",
                  description: `**${customer.name}** vừa được thêm vào hệ thống.`,
                  color: 5763719,
                  fields: [
                      { name: "📞 SĐT", value: customer.phone, inline: true },
                      { name: "🚗 Quan tâm", value: customer.interest || 'Chưa rõ', inline: true },
                      { name: "📍 Khu vực", value: customer.location || 'Chưa rõ', inline: true },
                      { name: "📝 Ghi chú", value: notes || "Không có", inline: false },
                      { name: "👤 Người tạo", value: userProfile?.full_name || 'System', inline: true }
                  ]
              }]
          }) });
      } catch (e) { console.error("Discord Error", e); }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!formData.name.trim()) { alert("Vui lòng nhập tên khách hàng"); setIsSubmitting(false); return; }
    if (!formData.isZaloOnly && !formData.phone.trim()) { alert("Vui lòng nhập số điện thoại"); setIsSubmitting(false); return; }
    try {
        let finalPhone = formData.phone;
        if (!formData.isZaloOnly) {
            finalPhone = normalizePhone(formData.phone);
            if (finalPhone.length === 9) finalPhone = '0' + finalPhone;
            const { data: existing } = await supabase.from('customers').select('id, name, sales_rep').eq('phone', finalPhone).maybeSingle();
            if (existing) {
                setDuplicateData({ id: existing.id, name: existing.name, sales_rep: existing.sales_rep || "Chưa phân bổ", phone: finalPhone });
                setIsDuplicateModalOpen(true);
                setIsSubmitting(false);
                return;
            }
        } else { finalPhone = 'Zalo-' + Date.now().toString().slice(-6); }
        await executeAddCustomer(finalPhone);
    } catch (err: any) { alert("Lỗi thêm khách: " + err.message); setIsSubmitting(false); }
  };

  const executeAddCustomer = async (finalPhone: string) => {
      try {
        const payload: any = {
            name: formData.name, phone: finalPhone, location: formData.location,
            source: formData.source === 'Khác' || formData.source === 'Giới Thiệu' ? `${formData.source}: ${formData.source_detail}` : formData.source,
            interest: formData.interest || null, status: CustomerStatus.NEW,
            classification: formData.classification, recare_date: formData.recare_date,
            creator_id: userProfile?.id, sales_rep: userProfile?.full_name,
            is_special_care: false, is_long_term: false, created_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from('customers').insert([payload]).select();
        if (error) throw error;
        if (data && data[0]) {
            await supabase.from('interactions').insert([{
                customer_id: data[0].id, user_id: userProfile?.id, type: 'note',
                content: `Khách hàng mới được tạo. Ghi chú: ${formData.notes}`,
                created_at: new Date().toISOString()
            }]);
            if (sendToDiscord) { await sendNewCustomerWebhook(data[0] as Customer, formData.notes); }
            setFormData(initialFormState);
            setIsAddModalOpen(false);
            setIsDuplicateModalOpen(false);
            setDuplicateData(null);
            fetchStats();
            alert("Thêm khách hàng thành công!");
        }
      } catch (err: any) { alert("Lỗi thêm khách: " + err.message); } finally { setIsSubmitting(false); }
  };

  const handleRequestTransfer = async () => {
      if (!duplicateData || !userProfile) return;
      setIsSubmitting(true);
      try {
          await supabase.from('customers').update({ pending_transfer_to: userProfile.id }).eq('id', duplicateData.id);
          await supabase.from('interactions').insert([{
              customer_id: duplicateData.id, user_id: userProfile.id, type: 'note',
              content: `⚠️ Yêu cầu chuyển quyền chăm sóc từ ${userProfile.full_name}.`,
              created_at: new Date().toISOString()
          }]);
          alert("Đã gửi yêu cầu chuyển quyền chăm sóc cho Admin/Mod!");
          setIsDuplicateModalOpen(false);
          setIsAddModalOpen(false);
          setDuplicateData(null);
          setFormData(initialFormState);
      } catch (e) { alert("Lỗi khi gửi yêu cầu."); } finally { setIsSubmitting(false); }
  };

  const StatCard: React.FC<any> = ({ title, value, icon: Icon, color, onClick }) => (
    <div onClick={onClick} className={`relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md group ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="relative flex items-center justify-between"><div><p className="text-sm font-medium text-gray-500">{title}</p><p className="mt-2 text-3xl font-bold text-gray-900">{value}</p></div><div className={`rounded-xl p-3 text-white shadow-sm ${color} group-hover:scale-110 transition-transform`}><Icon size={24} /></div></div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER & ALERTS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Tổng quan (GMT+7)</h1><p className="text-gray-500">Xin chào, {userProfile?.full_name}!</p></div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative mr-2" ref={notiRef}>
              <button onClick={() => setIsNotiOpen(!isNotiOpen)} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-primary-600 hover:bg-gray-50 shadow-sm transition-all relative">
                  <Bell size={20} />
                  {displayNotifCount > 0 && (<span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse">{displayNotifCount > 9 ? '9+' : displayNotifCount}</span>)}
              </button>
              {isNotiOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-[60] overflow-hidden animate-fade-in origin-top-right ring-1 ring-black/5">
                      <div className="p-4 border-b border-gray-50 bg-gray-50/50"><h4 className="font-bold text-gray-800 flex items-center gap-2"><BellRing size={16} className="text-primary-600"/> Thông báo</h4></div>
                      <div className="max-h-[300px] overflow-y-auto">
                          {displayNotifCount === 0 ? <div className="p-8 text-center text-gray-400 text-sm">Không có thông báo mới.</div> : (
                              <div className="flex flex-col">
                                  {/* ... Alerts ... */}
                                  {alerts.assignedTodayToMe > 0 && <button onClick={() => navigate('/customers', { state: { filterType: 'today' } })} className="p-4 hover:bg-green-50 border-b border-gray-50 text-left transition-colors flex gap-3 bg-green-50/50"><div className="p-2 bg-green-100 text-green-600 rounded-full h-fit animate-pulse"><Hand size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.assignedTodayToMe} Khách mới phân bổ (Bạn)</p><p className="text-xs text-gray-500">Hãy vào xác nhận ngay!</p></div></button>}
                                  {alerts.pendingAckCount > 0 && <button onClick={() => navigate('/customers', { state: { filterType: 'unacknowledged' } })} className="p-4 hover:bg-purple-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-purple-100 text-purple-600 rounded-full h-fit"><UserX size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingAckCount} Khách chưa nhận (Team)</p><p className="text-xs text-gray-500">Thuộc {alerts.pendingAckReps} TVBH.</p></div></button>}
                                  {(alerts.pendingCustomers > 0 || alerts.pendingDeals > 0) && <button onClick={() => navigate('/customers', { state: { initialTab: 'pending' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-orange-100 text-orange-600 rounded-full h-fit"><FileCheck2 size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingCustomers + alerts.pendingDeals} Yêu cầu duyệt (Team)</p><p className="text-xs text-gray-500">Đơn hàng/Trạng thái.</p></div></button>}
                                  {alerts.pendingTransfers > 0 && <button onClick={() => navigate('/customers', { state: { initialTab: 'pending' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-orange-100 text-orange-600 rounded-full h-fit"><ArrowRightLeft size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingTransfers} Chuyển Sales (Team)</p><p className="text-xs text-gray-500">Đang chờ xử lý.</p></div></button>}
                                  {(isAdmin || isMod) && alerts.pendingFinance > 0 && <button onClick={() => navigate('/finance')} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-red-100 text-red-600 rounded-full h-fit"><BadgeDollarSign size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingFinance} Yêu cầu Duyệt Quỹ</p><p className="text-xs text-gray-500">Nộp/Chi/Ứng cần xử lý.</p></div></button>}
                                  {(isAdmin || isMod) && alerts.pendingEmployees > 0 && <button onClick={() => navigate('/employees')} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-full h-fit"><UserPlus size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.pendingEmployees} Nhân sự mới</p><p className="text-xs text-gray-500">Đang chờ duyệt.</p></div></button>}
                                  {alerts.due > 0 && <button onClick={() => navigate('/customers', { state: { initialTab: 'due' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-orange-100 text-orange-600 rounded-full h-fit"><Clock size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.due} Khách đến hạn CS (Team)</p><p className="text-xs text-gray-500">Hôm nay.</p></div></button>}
                                  {alerts.expiredLongTerm > 0 && <button onClick={() => navigate('/customers', { state: { filterType: 'expired_longterm' } })} className="p-4 hover:bg-blue-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-full h-fit"><Calendar size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.expiredLongTerm} Hết hạn CS Dài hạn (Team)</p><p className="text-xs text-gray-500">Cần chăm sóc lại.</p></div></button>}
                                  {alerts.overdue > 0 && <button onClick={() => navigate('/customers', { state: { initialTab: 'overdue' } })} className="p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors flex gap-3"><div className="p-2 bg-red-100 text-red-600 rounded-full h-fit"><AlertTriangle size={16}/></div><div><p className="text-sm font-bold text-gray-800">{alerts.overdue} Khách quá hạn (Team)</p><p className="text-xs text-gray-500">Cần xử lý gấp.</p></div></button>}
                              </div>
                          )}
                      </div>
                  </div>
              )}
          </div>
          {isAdmin && (<button onClick={() => setIsDiscordModalOpen(true)} className="hidden md:flex items-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-[#4752C4]"><Webhook size={18} /> Discord</button>)}
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"><Plus size={18} /> Thêm khách</button>
        </div>
      </div>

      {/* ALERTS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
          {(!isAdmin && !isMod) && alerts.assignedTodayToMe > 0 && (<div onClick={() => navigate('/customers', { state: { filterType: 'today' } })} className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-green-100 transition-colors shadow-sm md:col-span-3 lg:col-span-1"><div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 animate-bounce"><Hand size={24} /></div><div className="flex-1"><h4 className="font-bold text-green-800">Cần tiếp nhận khách!</h4><p className="text-sm text-green-700">Bạn có <span className="font-bold text-lg ml-1">{alerts.assignedTodayToMe}</span> khách mới chưa bấm "Đã nhận".</p></div><ChevronRight className="text-green-400" /></div>)}
          {(isAdmin || isMod) && alerts.pendingFinance > 0 && (<div onClick={() => navigate('/finance')} className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-purple-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 animate-pulse"><BadgeDollarSign size={24} /></div><div className="flex-1"><h4 className="font-bold text-purple-800">Duyệt Quỹ / Tài chính</h4><p className="text-sm text-purple-700">Có <span className="font-bold text-lg ml-1">{alerts.pendingFinance}</span> yêu cầu chờ duyệt.</p></div><ChevronRight className="text-purple-400" /></div>)}
          {alerts.expiredLongTerm > 0 && <div onClick={() => navigate('/customers', { state: { filterType: 'expired_longterm' } })} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-blue-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 animate-pulse"><Calendar size={24} /></div><div className="flex-1"><h4 className="font-bold text-blue-700">Hết hạn CS Dài hạn</h4><p className="text-sm text-blue-600">Hôm nay: <span className="font-bold text-lg ml-1">{alerts.expiredLongTerm}</span></p></div><ChevronRight className="text-blue-400" /></div>}
          {alerts.overdue > 0 && <div onClick={() => navigate('/customers', { state: { initialTab: 'overdue' } })} className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-red-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 animate-pulse"><AlertTriangle size={24} /></div><div className="flex-1"><h4 className="font-bold text-red-700">Khách quá hạn CS</h4><p className="text-sm text-red-600">Toàn Team: <span className="font-bold text-lg ml-1">{alerts.overdue}</span></p></div><ChevronRight className="text-red-400" /></div>}
          {alerts.due > 0 && <div onClick={() => navigate('/customers', { state: { initialTab: 'due' } })} className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-orange-100 transition-colors shadow-sm"><div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><Clock size={24} /></div><div className="flex-1"><h4 className="font-bold text-orange-800">Đến hạn chăm sóc</h4><p className="text-sm text-orange-700">Hôm nay (Team): <span className="font-bold text-lg ml-1">{alerts.due}</span></p></div><ChevronRight className="text-orange-400" /></div>}
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Tổng khách hàng" value={stats.total} icon={Users} color="bg-blue-500" onClick={() => navigate('/customers', { state: { initialTab: 'all' } })} />
        <StatCard title="Khách mới (Hôm nay)" value={stats.new} icon={Plus} color="bg-emerald-500" onClick={() => navigate('/customers', { state: { filterType: 'today' } })} />
        <StatCard title="Khách tiềm năng (Hot)" value={stats.potential} icon={TrendingUp} color="bg-amber-500" onClick={() => navigate('/customers', { state: { initialTab: 'special' } })} />
        <StatCard title="Đã chốt đơn" value={stats.won} icon={CheckCircle} color="bg-purple-500" onClick={() => navigate('/customers', { state: { initialTab: 'won' } })} />
      </div>

      {/* ... Charts & Tables (Remaining code unchanged) ... */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 h-[400px] flex flex-col">
          <h3 className="mb-6 text-lg font-bold text-gray-900">Phân tích lượng khách (07 ngày qua)</h3>
          <div className="flex-1 w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip cursor={{stroke: '#e5e7eb', strokeWidth: 1}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Line type="monotone" dataKey="customers" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 h-[400px] flex flex-col">
          <h3 className="mb-6 text-lg font-bold text-gray-900">Phân loại khách hàng</h3>
          <div className="flex-1 w-full h-[250px] relative">
             {statusData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
               </ResponsiveContainer>
             ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-32 h-32 rounded-full border-8 border-gray-100 mb-4"></div>
                  <p>Chưa có dữ liệu phân loại</p>
               </div>
             )}
          </div>
          {statusData.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
               {statusData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                     <div className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                     <span className="text-xs text-gray-600 font-medium">{entry.name} ({entry.value})</span>
                  </div>
               ))}
            </div>
          )}
        </div>
      </div>

      {(isAdmin || isMod) && (
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Briefcase size={20} className="text-primary-600" /> Hiệu suất Kinh doanh</h3>
                  {isAdmin && (
                      <div className="relative">
                          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm font-medium cursor-pointer">
                              <option value="all">Tất cả Team</option>
                              {managers.map(mgr => (<option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>))}
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
                                              <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">{rep.avatar ? <img src={rep.avatar} className="w-full h-full rounded-full object-cover"/> : rep.name.charAt(0).toUpperCase()}</div>
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

      {isDiscordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-[#5865F2] flex items-center gap-2"><Webhook size={24} /> Cấu hình Discord (Toàn hệ thống)</h3><button onClick={() => setIsDiscordModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
              <div className="space-y-6">
                  <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-xs text-indigo-800">Cấu hình này sẽ được lưu chung cho toàn bộ hệ thống (app_settings). Bất kỳ ai thêm khách đều sẽ gửi về kênh này.</div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-2">Webhook 1: Báo cáo hàng ngày</label><input value={discordConfig.webhookUrl} onChange={(e) => setDiscordConfig({...discordConfig, webhookUrl: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="https://discord.com/api/webhooks/..." /></div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-2">Webhook 2: Thông báo Khách mới (Quan trọng)</label><input value={discordConfig.newCustomerWebhookUrl} onChange={(e) => setDiscordConfig({...discordConfig, newCustomerWebhookUrl: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="https://discord.com/api/webhooks/..." /></div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-2">Webhook 3: Tổng kết cuối ngày</label><input value={discordConfig.summaryWebhookUrl} onChange={(e) => setDiscordConfig({...discordConfig, summaryWebhookUrl: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="https://discord.com/api/webhooks/..." /></div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-2">Webhook 4: Thông báo Phân bổ</label><input value={discordConfig.assignWebhookUrl} onChange={(e) => setDiscordConfig({...discordConfig, assignWebhookUrl: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="https://discord.com/api/webhooks/..." /></div>
                  <div className="pt-2 border-t border-gray-100"><button onClick={saveDiscordSettings} disabled={savingSettings} className="w-full py-3 text-white font-bold bg-[#5865F2] hover:bg-[#4752C4] rounded-xl transition-colors flex justify-center items-center gap-2">{savingSettings ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Lưu cấu hình toàn hệ thống</button></div>
              </div>
           </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-bold text-gray-900">Thêm khách hàng mới</h3><button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Họ tên <span className="text-red-500">*</span></label><input name="name" required value={formData.name} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 font-medium" placeholder="Nguyễn Văn A" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label><input name="phone" type="tel" value={formData.phone} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 font-medium" placeholder="0912..." disabled={formData.isZaloOnly} /></div>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" id="zaloOnly" checked={formData.isZaloOnly} onChange={toggleZaloOnly} className="w-4 h-4 text-primary-600 rounded" /><label htmlFor="zaloOnly" className="text-sm text-gray-700 font-medium">Khách chỉ liên hệ qua Zalo</label></div>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Dòng xe quan tâm</label><div className="relative"><select name="interest" value={formData.interest} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 appearance-none"><option value="">-- Chưa xác định --</option>{CAR_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} /></div></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Khu vực</label><input name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500" placeholder="Quận 1, TP.HCM" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                   <div className={(formData.source === 'Khác' || formData.source === 'Giới Thiệu') ? "" : "col-span-2"}><label className="block text-sm font-bold text-gray-700 mb-1">Nguồn khách</label><div className="relative"><select name="source" value={formData.source} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 appearance-none"><option value="MKT Group">MKT Group</option><option value="Showroom">Showroom</option><option value="Hotline">Hotline</option><option value="Sự kiện">Sự kiện</option><option value="Giới Thiệu">Giới Thiệu</option><option value="Khác">Khác</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} /></div></div>
                   {(formData.source === 'Khác' || formData.source === 'Giới Thiệu') && (<div><label className="block text-sm font-bold text-gray-700 mb-1">Chi tiết nguồn</label><input name="source_detail" value={formData.source_detail} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500" placeholder="Nhập chi tiết..." /></div>)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Phân loại</label><div className="relative"><select name="classification" value={formData.classification} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 appearance-none"><option value="Hot">Hot</option><option value="Warm">Warm</option><option value="Cool">Cool</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} /></div></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Ngày CS tiếp theo</label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /><input name="recare_date" type="date" min={todayStr} value={formData.recare_date} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500" /></div></div>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú ban đầu</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 h-24 resize-none" placeholder="Khách hàng quan tâm vấn đề gì..." /></div>
              <div className="flex gap-3 pt-2">
                 <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-2.5 text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Hủy</button>
                 <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 text-white font-bold bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="animate-spin" size={18} />} Thêm mới</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDuplicateModalOpen && duplicateData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl transform scale-100 transition-all border border-red-100">
                  <div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 animate-bounce"><AlertTriangle className="text-red-600" size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Cảnh báo Trùng lặp!</h3><p className="text-sm text-gray-500 mb-6">Số điện thoại <span className="font-bold text-gray-900">{duplicateData.phone}</span> đã tồn tại trên hệ thống.</p><div className="w-full bg-red-50 rounded-xl p-4 border border-red-100 mb-6 text-left space-y-2"><div className="flex justify-between items-center border-b border-red-200 pb-2"><span className="text-xs font-bold text-red-500 uppercase">Khách hàng cũ</span></div><div><p className="text-xs text-gray-500">Họ tên</p><p className="font-bold text-gray-900">{duplicateData.name}</p></div><div><p className="text-xs text-gray-500">Đang thuộc về TVBH</p><p className="font-bold text-red-600 uppercase">{duplicateData.sales_rep}</p></div></div><div className="flex flex-col gap-3 w-full"><button onClick={handleRequestTransfer} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Yêu cầu chăm sóc Khách hàng này'}</button><button onClick={() => { setIsDuplicateModalOpen(false); setDuplicateData(null); setIsSubmitting(false); }} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button></div></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;

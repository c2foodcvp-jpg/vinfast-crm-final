
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Customer, CustomerStatus, CustomerClassification, UserProfile, AccessDelegation } from '../types';
import { useAuth } from '../contexts/AuthContext';
import * as ReactRouterDOM from 'react-router-dom';
import { exportToExcel } from '../utils/excelExport';
import { Search, Plus, X, User, CarFront, Calendar, AlertCircle, Clock, CheckCircle2, MessageSquare, ShieldAlert, Upload, FileSpreadsheet, Download, AlertTriangle, Flame, History, RotateCcw, HardDrive, MapPin, Loader2, ChevronDown, List, Filter, Webhook, UserX, ScanSearch, Phone, Trash2, Eye, Share2, Star, Activity, PauseCircle, Ban, EyeOff, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { CAR_MODELS } from '../types';

const { useNavigate, useLocation } = ReactRouterDOM as any;

// Local Interface for Duplicates
interface DuplicateGroup {
  phone: string;
  customers: Customer[];
}

const ITEMS_PER_PAGE = 15;

const CustomerList: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Initialize States
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // NEW: For performance
  
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all'); 
  const [timeFilter, setTimeFilter] = useState<'today' | 'this_month' | 'last_month' | 'quarter' | 'year' | 'all'>('all');
  
  const [isUnacknowledgedFilter, setIsUnacknowledgedFilter] = useState(false); 
  const [isExpiredLongTermFilter, setIsExpiredLongTermFilter] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('general');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Tabs State
  const location = useLocation();
  const navigate = useNavigate();

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendToDiscord, setSendToDiscord] = useState(true);
  
  // DUPLICATE MODAL STATE
  const [isDuplicateWarningOpen, setIsDuplicateWarningOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<{id: string, name: string, sales_rep: string, phone: string} | null>(null);

  // DUPLICATE SCANNER STATES
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);

  // DATE LOGIC HELPER (GMT+7)
  const getLocalTodayStr = () => {
    const now = new Date();
    // Shift to GMT+7
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return vnTime.toISOString().split('T')[0];
  };

  const todayStr = getLocalTodayStr();

  const initialFormState = {
    name: '', phone: '', location: '', source: 'MKT Group', source_detail: '', interest: '', 
    notes: '', isZaloOnly: false, recare_date: todayStr, classification: 'Warm' as CustomerClassification
  };
  
  const [formData, setFormData] = useState(initialFormState);

  // --- OPTIMIZATION: Debounce Search Term ---
  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedSearchTerm(searchTerm);
      }, 400); // Wait 400ms after typing stops
      return () => clearTimeout(handler);
  }, [searchTerm]);

  // --- RESTORE STATE LOGIC (SessionStorage) ---
  useEffect(() => {
    // 1. If explicit navigation from Dashboard (Alerts), use location.state
    if (location.state) {
      if (location.state.initialTab) {
        setActiveTab(location.state.initialTab);
        setTimeFilter('all'); setIsUnacknowledgedFilter(false); setIsExpiredLongTermFilter(false);
      }
      if (location.state.filterType === 'today') {
        setTimeFilter('today'); setActiveTab('all');
        setIsUnacknowledgedFilter(false); setIsExpiredLongTermFilter(false);
      }
      if (location.state.filterType === 'unacknowledged') {
        setIsUnacknowledgedFilter(true); setActiveTab('all');
        setTimeFilter('all'); setIsExpiredLongTermFilter(false);
      }
      if (location.state.filterType === 'expired_longterm') {
        setIsExpiredLongTermFilter(true); setActiveTab('all');
        setTimeFilter('all'); setIsUnacknowledgedFilter(false);
      }
    } 
    // 2. Else, restore from SessionStorage if available
    else {
      const savedState = sessionStorage.getItem('crm_customer_view_state');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          // Only restore if valid
          if (parsed.activeTab) setActiveTab(parsed.activeTab);
          // Note: We don't restore searchTerm automatically to avoid confusion
          if (parsed.selectedRep) setSelectedRep(parsed.selectedRep);
          if (parsed.selectedTeam) setSelectedTeam(parsed.selectedTeam);
          if (parsed.timeFilter) setTimeFilter(parsed.timeFilter);
          setIsUnacknowledgedFilter(!!parsed.isUnacknowledgedFilter);
          setIsExpiredLongTermFilter(!!parsed.isExpiredLongTermFilter);
        } catch (e) {
          console.error("Failed to restore state", e);
        }
      }
    }
  }, [location.state]);

  // --- SAVE STATE LOGIC ---
  useEffect(() => {
    const stateToSave = {
      activeTab,
      searchTerm: debouncedSearchTerm, // Save the actual applied term
      selectedRep,
      selectedTeam,
      timeFilter,
      isUnacknowledgedFilter,
      isExpiredLongTermFilter
    };
    sessionStorage.setItem('crm_customer_view_state', JSON.stringify(stateToSave));
  }, [activeTab, debouncedSearchTerm, selectedRep, selectedTeam, timeFilter, isUnacknowledgedFilter, isExpiredLongTermFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedRep, selectedTeam, timeFilter, isUnacknowledgedFilter, isExpiredLongTermFilter, activeTab]);

  useEffect(() => {
    fetchCustomersWithIsolation();
  }, [userProfile]);

  const fetchCustomersWithIsolation = async () => {
    if (!userProfile) return;
    try {
      setLoading(true);
      
      // PERMISSION CHECK: If locked_view, do not fetch
      if (userProfile.is_locked_view) {
          setLoading(false);
          return;
      }

      // 1. Determine Team (Isolation)
      let teamIds: string[] = [];
      let teamMembers: UserProfile[] = [];

      if (isAdmin) {
          // Admin fetches all employees for filter dropdown
          const { data } = await supabase.from('profiles').select('*').eq('status', 'active');
          if (data) setEmployees(data as UserProfile[]);
      } else {
          // MOD or Sales
          let profileQuery = supabase.from('profiles').select('*');
          if (isMod) {
             // MOD sees self + subordinates
             profileQuery = profileQuery.or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id}`);
          } else {
             // Sales sees strictly self
             profileQuery = profileQuery.eq('id', userProfile.id);
          }
          const { data: profiles } = await profileQuery;
          if (profiles) {
              teamMembers = profiles as UserProfile[];
              setEmployees(teamMembers); // Filter dropdown only shows team
              teamIds = teamMembers.map(p => p.id);
          }
      }

      // 1.5 CHECK DELEGATIONS (Global Delegation - Deprecated concept but kept for compatibility)
      let delegatedTargetIds: string[] = [];
      if (!isAdmin) {
          try {
              const { data: delegations } = await supabase
                  .from('access_delegations')
                  .select('target_user_id')
                  .eq('recipient_id', userProfile.id);
              
              if (delegations && delegations.length > 0) {
                  delegatedTargetIds = delegations.map((d: any) => d.target_user_id);
              }
          } catch (e) { console.log('Delegation table check failed'); }
      }

      // 2. Fetch Customers (OWNED + TEAM + GLOBAL DELEGATION)
      // OPTIMIZATION: ONLY SELECT COLUMNS NEEDED FOR LIST VIEW
      // Excludes: deal_details (heavy json), stop_reason (text)
      let query = supabase
        .from('customers')
        .select(`
            id, name, phone, secondary_phone, location, status, source, interest, 
            sales_rep, creator_id, classification, recare_date, is_special_care, 
            is_long_term, deal_status, pending_transfer_to, is_acknowledged, 
            created_at, updated_at
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin) {
          // Combine Team IDs and Delegated IDs
          const viewableIds = [...new Set([...teamIds, ...delegatedTargetIds])];
          
          if (viewableIds.length > 0) {
              query = query.in('creator_id', viewableIds);
          } else {
              query = query.eq('creator_id', userProfile.id); // Fallback
          }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let fetchedCustomers = data as Customer[] || [];
      
      // Mark delegated customers for UI (Old delegation)
      if (delegatedTargetIds.length > 0) {
          fetchedCustomers = fetchedCustomers.map(c => ({
              ...c,
              _is_delegated: c.creator_id ? delegatedTargetIds.includes(c.creator_id) : false
          }));
      }

      // 3. FETCH INDIVIDUALLY SHARED CUSTOMERS (Shared With Me & Shared By Me)
      try {
          // A. Shared WITH me (Incoming)
          const { data: sharesIn } = await supabase
              .from('customer_shares')
              .select('customer_id, permission')
              .eq('shared_with', userProfile.id);
          
          // B. Shared BY me (Outgoing)
          const { data: sharesOut } = await supabase
              .from('customer_shares')
              .select('customer_id')
              .eq('shared_by', userProfile.id);

          const sharedInIds = sharesIn ? sharesIn.map(s => s.customer_id) : [];
          const sharedOutIds = sharesOut ? sharesOut.map(s => s.customer_id) : [];

          // Fetch incoming shared customers if any
          if (sharedInIds.length > 0) {
              const { data: sharedCustomerData } = await supabase
                  .from('customers')
                  .select(`
                      id, name, phone, secondary_phone, location, status, source, interest, 
                      sales_rep, creator_id, classification, recare_date, is_special_care, 
                      is_long_term, deal_status, pending_transfer_to, is_acknowledged, 
                      created_at, updated_at
                  `)
                  .in('id', sharedInIds);
              
              if (sharedCustomerData) {
                  const sharedCustomersWithFlag = sharedCustomerData.map((c: any) => {
                      const shareInfo = sharesIn?.find(s => s.customer_id === c.id);
                      return {
                          ...c,
                          _is_delegated: true,
                          _shared_permission: shareInfo?.permission // 'view' or 'edit'
                      };
                  });
                  
                  // Merge avoiding duplicates
                  const existingIds = new Set(fetchedCustomers.map(c => c.id));
                  sharedCustomersWithFlag.forEach((sc: Customer) => {
                      if (!existingIds.has(sc.id)) {
                          fetchedCustomers.push(sc);
                      }
                  });
              }
          }

          // Mark Outgoing Shares (I shared these)
          if (sharedOutIds.length > 0) {
              fetchedCustomers = fetchedCustomers.map(c => {
                  if (sharedOutIds.includes(c.id)) {
                      return { ...c, _is_shared_by_me: true }; // Custom flag for UI
                  }
                  return c;
              });
          }

          // Mark Incoming Shares that were already in the list (e.g. Mod viewing sub's shared data)
          if (sharedInIds.length > 0) {
              fetchedCustomers = fetchedCustomers.map(c => {
                  if (sharedInIds.includes(c.id)) {
                      const shareInfo = sharesIn?.find(s => s.customer_id === c.id);
                      return { ...c, _shared_permission: shareInfo?.permission };
                  }
                  return c;
              });
          }

      } catch (e) {
          console.error("Error fetching shares", e);
      }

      // Re-sort by created_at after merge
      fetchedCustomers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setCustomers(fetchedCustomers);
    } catch (err) {
      console.warn("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  };

  // Managers for Dropdown (Admin View)
  const managers = useMemo(() => {
      const managerIds = Array.from(new Set(employees.filter(p => p.manager_id).map(p => p.manager_id)));
      return managerIds.map(id => {
          const m = employees.find(p => p.id === id);
          return { id: id as string, name: m?.full_name || 'Unknown' };
      }).filter(m => m.name !== 'Unknown');
  }, [employees]);

  // ... (Keep existing handler functions: handleScanDuplicates, handleInputChange, toggleZaloOnly, normalizePhone, sendNewCustomerWebhook, handleAddCustomer, executeAddCustomer, handleRequestTransfer, handleDeleteCustomer) ...
  const handleScanDuplicates = async () => {
    setIsScanning(true);
    setIsDuplicateModalOpen(true);
    setDuplicateGroups([]);
    try {
        const { data, error } = await supabase.from('customers').select('id, name, phone, created_at, sales_rep, status');
        if (error) throw error;
        const allCust = data as Customer[];
        const groups: Record<string, Customer[]> = {};
        allCust.forEach(c => {
            if (!c.phone) return;
            const cleanPhone = c.phone.trim();
            if (!groups[cleanPhone]) groups[cleanPhone] = [];
            groups[cleanPhone].push(c);
        });
        const duplicates: DuplicateGroup[] = [];
        for (const [phone, list] of Object.entries(groups)) {
            if (list.length > 1) {
                duplicates.push({ phone, customers: list });
            }
        }
        setDuplicateGroups(duplicates);
    } catch (err: any) {
        const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        alert("Lỗi khi quét: " + errorMessage);
    } finally {
        setIsScanning(false);
    }
  };
  
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
      let webhookUrl = localStorage.getItem('vinfast_crm_discord_webhook_new_lead');
      if (!webhookUrl) {
          const { data } = await supabase.from('app_settings').select('value').eq('key', 'discord_webhook_new_lead').maybeSingle();
          if (data) webhookUrl = data.value;
      }
      if (!webhookUrl) return;
      try {
          await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
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
    // PERMISSION CHECK
    if (userProfile?.is_locked_add) {
        alert("Bạn đã bị khóa quyền thêm khách mới.");
        return;
    }

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
                setIsDuplicateWarningOpen(true);
                setIsSubmitting(false);
                return;
            }
        } else {
            finalPhone = 'Zalo-' + Date.now().toString().slice(-6);
        }
        await executeAddCustomer(finalPhone);
    } catch (err: any) {
        alert("Lỗi thêm khách: " + err.message);
        setIsSubmitting(false);
    }
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
            if (sendToDiscord) await sendNewCustomerWebhook(data[0] as Customer, formData.notes);
            setFormData(initialFormState);
            setIsAddModalOpen(false);
            setIsDuplicateWarningOpen(false);
            setDuplicateData(null);
            fetchCustomersWithIsolation();
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
          setIsDuplicateWarningOpen(false);
          setIsAddModalOpen(false);
          setDuplicateData(null);
          setFormData(initialFormState);
      } catch (e) { alert("Lỗi khi gửi yêu cầu."); } finally { setIsSubmitting(false); }
  };

  const handleDeleteCustomer = async (customerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("CẢNH BÁO: Xóa khách hàng này? Hành động không thể hoàn tác.")) return;
      try {
          await supabase.from('interactions').delete().eq('customer_id', customerId);
          await supabase.from('transactions').delete().eq('customer_id', customerId);
          await supabase.from('customer_shares').delete().eq('customer_id', customerId); // Delete shares too
          const { error } = await supabase.from('customers').delete().eq('id', customerId);
          if (error) throw error;
          setCustomers(prev => prev.filter(c => c.id !== customerId));
      } catch (err: any) {
          alert("Lỗi xóa: " + (err.message || "Vui lòng liên hệ Admin."));
      }
  };

  // Base list filtered by Search/Rep/Date (Not Tabs)
  const baseFilteredCustomers = useMemo(() => {
      // Use Debounced Term for Filtering
      const normalizedSearch = debouncedSearchTerm.replace(/\s+/g, '');
      const lowerSearchTerm = debouncedSearchTerm.toLowerCase();

      let filtered = customers.filter(c => {
        const normalizedPhone = c.phone ? c.phone.replace(/\s+/g, '') : '';
        const normalizedSecPhone = c.secondary_phone ? c.secondary_phone.replace(/\s+/g, '') : '';
        
        return (
          (c.name?.toLowerCase() || '').includes(lowerSearchTerm) || 
          (c.interest?.toLowerCase() || '').includes(lowerSearchTerm) || 
          normalizedPhone.includes(normalizedSearch) ||
          normalizedSecPhone.includes(normalizedSearch)
        );
      });

      // Team Filter (Admin Only)
      if (isAdmin && selectedTeam !== 'all') {
          // Find employees in this team
          const teamMemberIds = employees.filter(e => e.manager_id === selectedTeam || e.id === selectedTeam).map(e => e.id);
          filtered = filtered.filter(c => teamMemberIds.includes(c.creator_id || ''));
      }

      // Rep Filter (Strictly applied above, but apply filter here if Admin/Mod selects specific rep)
      if ((isAdmin || isMod) && selectedRep !== 'all') {
          filtered = filtered.filter(c => c.creator_id === selectedRep);
      }

      // Time Range Filter Logic
      if (timeFilter !== 'all') {
          const now = new Date();
          let start = new Date(0); // Epoch
          let end = new Date();

          if (timeFilter === 'today') {
              start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
              end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          } else if (timeFilter === 'this_month') {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          } else if (timeFilter === 'last_month') {
              start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          } else if (timeFilter === 'quarter') {
              const q = Math.floor(now.getMonth() / 3);
              start = new Date(now.getFullYear(), q * 3, 1);
              end = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59);
          } else if (timeFilter === 'year') {
              start = new Date(now.getFullYear(), 0, 1);
              end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
          }

          filtered = filtered.filter(c => {
              const d = new Date(c.created_at);
              return d >= start && d <= end;
          });
      }

      if (isUnacknowledgedFilter) {
          filtered = filtered.filter(c => c.status === CustomerStatus.NEW && !c.is_acknowledged && c.sales_rep);
      }

      if (isExpiredLongTermFilter) {
          filtered = filtered.filter(c => {
              if (!c.is_long_term) return false;
              if (c.status === CustomerStatus.WON || c.status === CustomerStatus.LOST) return false;
              if (!c.recare_date) return false;
              return c.recare_date <= todayStr;
          });
      }

      return filtered;
  }, [customers, debouncedSearchTerm, selectedRep, selectedTeam, timeFilter, isUnacknowledgedFilter, isExpiredLongTermFilter, isAdmin, isMod, todayStr, employees]);

  // Tab Filtering logic applied to base list
  const filteredList = useMemo(() => {
      switch (activeTab) {
        case 'general': return baseFilteredCustomers.filter(c => c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.LOST_PENDING && c.status !== CustomerStatus.WON && c.status !== CustomerStatus.WON_PENDING);
        case 'special': return baseFilteredCustomers.filter(c => c.is_special_care === true && c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.WON);
        case 'due': return baseFilteredCustomers.filter(c => { if (c.is_special_care || c.is_long_term) return false; if (!c.recare_date || c.status === CustomerStatus.LOST || c.status === CustomerStatus.WON) return false; return c.recare_date === todayStr; });
        case 'overdue': return baseFilteredCustomers.filter(c => { if (c.is_special_care || c.is_long_term) return false; if (!c.recare_date || c.status === CustomerStatus.LOST || c.status === CustomerStatus.WON) return false; return c.recare_date < todayStr; });
        case 'longterm': return baseFilteredCustomers.filter(c => c.is_long_term === true && c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.WON);
        case 'stopped': return baseFilteredCustomers.filter(c => c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING);
        case 'won': return baseFilteredCustomers.filter(c => c.status === CustomerStatus.WON || c.status === CustomerStatus.WON_PENDING);
        case 'pending': return baseFilteredCustomers.filter(c => c.status === CustomerStatus.WON_PENDING || c.status === CustomerStatus.LOST_PENDING || c.deal_status === 'completed_pending' || c.deal_status === 'refund_pending' || !!c.pending_transfer_to);
        case 'all': return baseFilteredCustomers;
        default: return baseFilteredCustomers;
      }
  }, [activeTab, baseFilteredCustomers, todayStr]);
  
  // Counts Calculation for Badges
  const counts = useMemo(() => ({
      general: baseFilteredCustomers.filter(c => c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.LOST_PENDING && c.status !== CustomerStatus.WON && c.status !== CustomerStatus.WON_PENDING).length,
      special: baseFilteredCustomers.filter(c => c.is_special_care === true && c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.WON).length,
      due: baseFilteredCustomers.filter(c => { if (c.is_special_care || c.is_long_term) return false; if (!c.recare_date || c.status === CustomerStatus.LOST || c.status === CustomerStatus.WON) return false; return c.recare_date === todayStr; }).length,
      overdue: baseFilteredCustomers.filter(c => { if (c.is_special_care || c.is_long_term) return false; if (!c.recare_date || c.status === CustomerStatus.LOST || c.status === CustomerStatus.WON) return false; return c.recare_date < todayStr; }).length,
      longterm: baseFilteredCustomers.filter(c => c.is_long_term === true && c.status !== CustomerStatus.LOST && c.status !== CustomerStatus.WON).length,
      won: baseFilteredCustomers.filter(c => c.status === CustomerStatus.WON || c.status === CustomerStatus.WON_PENDING).length,
      stopped: baseFilteredCustomers.filter(c => c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING).length
  }), [baseFilteredCustomers, todayStr]);

  // PAGINATION LOGIC
  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  const handlePageChange = (page: number) => {
      if (page >= 1 && page <= totalPages) {
          setCurrentPage(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const tabs: {id: string; label: string; icon: any; count?: number; colorClass?: string}[] = [
    { id: 'general', label: 'Khách hàng', icon: User, count: counts.general, colorClass: 'text-green-600 bg-green-100' }, 
    { id: 'special', label: 'CS Đặc biệt', icon: AlertCircle, count: counts.special, colorClass: 'text-purple-600 bg-purple-100' }, 
    { id: 'due', label: 'Đến hạn CS', icon: Clock, count: counts.due, colorClass: 'text-orange-600 bg-orange-100' }, 
    { id: 'overdue', label: 'Quá hạn CS', icon: AlertTriangle, count: counts.overdue, colorClass: 'text-red-600 bg-red-100' }, 
    { id: 'longterm', label: 'CS Dài hạn', icon: Calendar, count: counts.longterm, colorClass: 'text-blue-600 bg-blue-100' }, 
    { id: 'stopped', label: 'Ngưng CS', icon: X, count: counts.stopped, colorClass: 'text-gray-600 bg-gray-100' },
    { id: 'won', label: 'Đã chốt', icon: CheckCircle2, count: counts.won, colorClass: 'text-emerald-700 bg-emerald-200' },
  ];

  if (isAdmin || isMod) {
      const pendingCount = baseFilteredCustomers.filter(c => c.status === CustomerStatus.WON_PENDING || c.status === CustomerStatus.LOST_PENDING || c.deal_status === 'completed_pending' || c.deal_status === 'refund_pending' || !!c.pending_transfer_to).length;
      tabs.push({ id: 'pending', label: 'Chờ duyệt', icon: ShieldAlert, count: pendingCount, colorClass: 'text-yellow-700 bg-yellow-100' });
      tabs.push({ id: 'all', label: 'Tất cả (DB)', icon: List });
  }

  const getRecareStatus = (customer: Customer) => { 
      let statusText = '--/--';
      let statusColor = 'text-gray-400';
      if (customer.recare_date && !['won','lost'].includes(customer.status)) {
          if (customer.recare_date < todayStr) { statusText = `${new Date(customer.recare_date).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'})} (Quá hạn)`; statusColor = 'text-red-600 font-bold'; } 
          else if (customer.recare_date === todayStr) { statusText = `${new Date(customer.recare_date).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'})} (Hôm nay)`; statusColor = 'text-orange-600 font-bold'; } 
          else { statusText = new Date(customer.recare_date).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'}); statusColor = 'text-gray-600'; }
      }
      return { text: statusText, color: statusColor };
  };

  const getCustomerStatusDisplay = (customer: Customer) => {
      // 1. Chăm sóc dài hạn -> Theo dõi thêm
      if (customer.is_long_term) {
          return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold text-xs shadow-sm flex items-center gap-1 border border-blue-100"><Calendar size={12}/> Theo dõi thêm</span>;
      }

      // 2. Đã hủy -> Đã hủy (Hiển thị rõ ràng cho trạng thái Lost)
      if (customer.status === CustomerStatus.LOST || customer.status === CustomerStatus.LOST_PENDING) {
          return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-bold text-xs shadow-sm flex items-center gap-1 border border-gray-200"><Ban size={12}/> Đã hủy</span>;
      }

      // 3. Check Special Care -> Potential
      if (customer.is_special_care) {
          return <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full font-bold text-xs shadow-md animate-pulse flex items-center gap-1 border border-white/20"><Star size={12} fill="white"/> TIỀM NĂNG</span>;
      }

      // 4. Logic for "New" customers older than 48 hours
      const created = new Date(customer.created_at);
      const now = new Date();
      const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      
      if (customer.status === CustomerStatus.NEW) {
          if (diffHours > 48) {
              return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-bold text-xs flex items-center gap-1 border border-gray-200"><Activity size={12}/> Đang theo dõi</span>;
          } else {
              return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold text-xs border border-blue-200 flex items-center gap-1"><Flame size={12}/> Mới</span>;
          }
      }
      
      // Default
      return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">{customer.status}</span>;
  };

  // Export Logic
  const handleExport = () => {
      const dataToExport = filteredList.map(c => ({
          "Khách hàng": c.name,
          "SĐT": c.phone,
          "Khu vực": c.location || '',
          "Dòng xe": c.interest || '',
          "Nguồn": c.source || '',
          "Phân loại": c.classification,
          "Ngày tạo": new Date(c.created_at).toLocaleDateString('vi-VN'),
          "TVBH": c.sales_rep || '',
          "Trạng thái": c.status
      }));
      
      exportToExcel(dataToExport, `Danh_sach_khach_hang_${new Date().getTime()}`);
  };

  // IF LOCKED VIEW -> SHOW BLOCK SCREEN
  if (userProfile?.is_locked_view) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><Lock size={32} className="text-red-600"/></div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Quyền truy cập bị hạn chế</h2>
              <p className="text-gray-500 max-w-sm">Tài khoản của bạn đang bị tạm khóa quyền xem danh sách khách hàng. Vui lòng liên hệ Admin/Mod.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-20 relative">
      {/* ... (Header and Search section kept same as before) ... */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Khách hàng</h1>
            {timeFilter === 'today' && (<span className="inline-flex items-center gap-2 mt-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold"><Calendar size={14} /> Đang xem: Khách mới hôm nay<button onClick={() => setTimeFilter('all')} className="ml-1 hover:text-green-900"><X size={14}/></button></span>)}
            {isUnacknowledgedFilter && (<span className="inline-flex items-center gap-2 mt-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold animate-fade-in"><UserX size={14} /> Đang xem: Khách chưa được TVBH tiếp nhận<button onClick={() => setIsUnacknowledgedFilter(false)} className="ml-1 hover:text-purple-900"><X size={14}/></button></span>)}
            {isExpiredLongTermFilter && (<span className="inline-flex items-center gap-2 mt-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold animate-fade-in"><AlertTriangle size={14} /> Đang xem: Khách CS Dài hạn đã đến hạn (Hết hạn)<button onClick={() => setIsExpiredLongTermFilter(false)} className="ml-1 hover:text-blue-900"><X size={14}/></button></span>)}
        </div>
        <div className="flex gap-2">
            {(isAdmin || isMod) && (<button onClick={handleScanDuplicates} className="flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-gray-400 transition-colors hover:bg-black"><ScanSearch size={18} /> Quét trùng lặp</button>)}
            <button onClick={() => userProfile?.is_locked_add ? alert("Bạn đã bị khóa quyền thêm khách mới.") : setIsAddModalOpen(true)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors ${userProfile?.is_locked_add ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 shadow-primary-200 hover:bg-primary-700'}`}><Plus size={18} /> Thêm khách</button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Tìm tên, dòng xe, SĐT (Chính/Phụ)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all" />
        </div>
        
        {/* FILTERS & EXPORT */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            {/* Time Filter */}
            <div className="relative min-w-[140px]">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                    value={timeFilter} 
                    onChange={(e) => setTimeFilter(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-8 text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all appearance-none cursor-pointer"
                >
                    <option value="all">Tất cả</option>
                    <option value="today">Hôm nay</option>
                    <option value="this_month">Tháng này</option>
                    <option value="last_month">Tháng trước</option>
                    <option value="quarter">Quý này</option>
                    <option value="year">Năm nay</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>

            {/* Team Filter */}
            {isAdmin && (
                <div className="relative min-w-[150px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-8 text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all appearance-none cursor-pointer">
                        <option value="all">Tất cả Team</option>
                        {managers.map(mgr => (<option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                </div>
            )}
            
            {/* Rep Filter */}
            {(isAdmin || isMod) && (
                <div className="relative min-w-[180px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-8 text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all appearance-none cursor-pointer">
                        <option value="all">Tất cả nhân viên</option>
                        {employees
                            .filter(emp => isAdmin && selectedTeam !== 'all' ? (emp.manager_id === selectedTeam || emp.id === selectedTeam) : true)
                            .map(emp => (<option key={emp.id} value={emp.id}>{emp.full_name}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                </div>
            )}

            {/* Export Button */}
            {(isAdmin || isMod) && (
                <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md transition-colors whitespace-nowrap"
                    title="Tải danh sách hiện tại"
                >
                    <Download size={18}/> Xuất Excel
                </button>
            )}
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
        {tabs.map((tab) => {
           const isActive = activeTab === tab.id;
           return (
             <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all text-sm font-medium border ${isActive ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
               <tab.icon size={16} /> {tab.label} {(tab as any).count > 0 && (<span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-1 font-bold ${(tab as any).colorClass || 'bg-gray-200 text-gray-700'}`}>{(tab as any).count}</span>)}
             </button>
           );
        })}
      </div>

      {/* List content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            <User size={48} className="mx-auto text-gray-300 mb-3" /> <p>Không tìm thấy khách hàng nào.</p>
          </div>
        ) : (
          paginatedCustomers.map((customer) => {
            const recareStatus = getRecareStatus(customer);
            const isFinishedStatus = [CustomerStatus.WON, CustomerStatus.LOST, CustomerStatus.WON_PENDING, CustomerStatus.LOST_PENDING].includes(customer.status);
            // Visual check if explicitly shared via 'customer_shares' table
            const isShared = customer._shared_permission !== undefined || (customer as any)._is_shared_by_me;
            
            // --- Phone Masking Logic ---
            // If New and Not Acknowledged, mask phone.
            const isPhoneHidden = customer.status === CustomerStatus.NEW && !customer.is_acknowledged;
            const displayPhone = isPhoneHidden ? (customer.phone.length > 3 ? customer.phone.substring(0, 4) + '*******' : '*******') : customer.phone;

            return (
              <div 
                key={customer.id} 
                onClick={() => navigate(`/customers/${customer.id}`, { 
                    state: { 
                        customerIds: filteredList.map(c => c.id), // Pass current list context
                        from: '/customers' // Added source identification
                    } 
                })} 
                className={`group bg-white rounded-2xl p-4 shadow-sm border hover:shadow-md transition-all cursor-pointer relative overflow-hidden 
                    ${isShared ? 'border-purple-400 border-2 bg-purple-50/60 ring-2 ring-purple-100 shadow-purple-100' : 
                      customer._is_delegated ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100 hover:border-primary-200'}`}
              >
                <div className="absolute top-0 right-0 p-2 flex flex-col gap-1 items-end">
                    {/* Badge for Shared Customer - Distinct Style */}
                    {isShared && <span className="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1"><Share2 size={10}/> {(customer as any)._is_shared_by_me ? 'Đã Chia Sẻ' : (customer._shared_permission === 'edit' ? 'Được Sửa' : 'Được Xem')}</span>}
                    {customer._is_delegated && !isShared && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1"><Eye size={10}/> Ủy quyền</span>}
                    {customer.is_special_care && <Flame size={18} className="text-red-500 animate-pulse" />}
                    {customer.is_long_term && <Calendar size={18} className="text-blue-500" />}
                    {customer.deal_status === 'completed_pending' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">Chờ duyệt Hoàn thành</span>}
                    {customer.deal_status === 'refund_pending' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">Chờ duyệt Trả cọc</span>}
                    {customer.deal_status === 'suspended_pending' && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200">Chờ duyệt Treo</span>}
                    {customer.deal_status === 'suspended' && <span className="bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Hồ sơ Treo</span>}
                    {customer.pending_transfer_to && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200">Chờ chuyển Sale</span>}
                    {customer.status === CustomerStatus.NEW && !customer.is_acknowledged && customer.sales_rep && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">Chờ tiếp nhận</span>}
                </div>
                {(isAdmin || isMod) && (
                    <button onClick={(e) => handleDeleteCustomer(customer.id, e)} className="absolute top-3 left-3 z-10 text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                    </button>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm ${customer.classification === 'Hot' ? 'bg-gradient-to-br from-red-500 to-orange-500' : customer.classification === 'Cool' ? 'bg-gradient-to-br from-blue-400 to-cyan-400' : 'bg-gradient-to-br from-orange-400 to-yellow-400'}`}>{customer.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors line-clamp-1">{customer.name}</h3>
                        <p className={`text-xs font-medium flex items-center gap-1 ${isPhoneHidden ? 'text-gray-400 italic' : 'text-gray-500'}`}>
                            {isPhoneHidden && <EyeOff size={10} />}
                            {displayPhone}
                        </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600 mb-3">
                   <div className="flex items-center gap-2"><CarFront size={14} className="text-gray-400" /><span className="font-medium">{customer.interest ? customer.interest.toUpperCase() : 'CHƯA RÕ'}</span></div>
                   {!(customer.is_special_care || customer.is_long_term || isFinishedStatus) && (<div className="flex items-center gap-2"><Clock size={14} className="text-gray-400" /><span className={`${recareStatus.color}`}>{recareStatus.text}</span></div>)}
                   {customer.location && (<div className="flex items-center gap-2"><MapPin size={14} className="text-gray-400" /><span className="truncate">{customer.location}</span></div>)}
                   {/* Show owner if delegated or shared */}
                   {(isShared || customer._is_delegated) && customer.sales_rep && (<div className="flex items-center gap-2 mt-1 pt-1 border-t border-indigo-100"><User size={12} className="text-indigo-500" /><span className="text-xs text-indigo-600 font-bold">{customer.sales_rep}</span></div>)}
                   {(isAdmin || isMod) && !customer._is_delegated && !isShared && customer.sales_rep && (<div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-100"><User size={12} className="text-blue-500" /><span className="text-xs text-blue-600 font-bold">{customer.sales_rep}</span></div>)}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-xs">
                    {getCustomerStatusDisplay(customer)}
                    <span className="text-gray-400">{new Date(customer.created_at).toLocaleDateString('vi-VN')}</span>
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
      
      {/* ... Add/Duplicate Modals (Identical to previous) ... */}
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
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Ngày CS tiếp theo</label><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /><input name="recare_date" type="date" min={todayStr} value={formData.recare_date} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500" /></div></div>
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

      {isDuplicateWarningOpen && duplicateData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl transform scale-100 transition-all border border-red-100">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                          <AlertTriangle className="text-red-600" size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Cảnh báo Trùng lặp!</h3>
                      <p className="text-sm text-gray-500 mb-6">Số điện thoại <span className="font-bold text-gray-900">{duplicateData.phone}</span> đã tồn tại trên hệ thống.</p>
                      <div className="w-full bg-red-50 rounded-xl p-4 border border-red-100 mb-6 text-left space-y-2">
                          <div className="flex justify-between items-center border-b border-red-200 pb-2"><span className="text-xs font-bold text-red-500 uppercase">Khách hàng cũ</span></div>
                          <div><p className="text-xs text-gray-500">Họ tên</p><p className="font-bold text-gray-900">{duplicateData.name}</p></div>
                          <div><p className="text-xs text-gray-500">Đang thuộc về TVBH</p><p className="font-bold text-red-600 uppercase">{duplicateData.sales_rep}</p></div>
                      </div>
                      <div className="flex flex-col gap-3 w-full">
                          <button onClick={handleRequestTransfer} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Yêu cầu chăm sóc Khách hàng này'}</button>
                          <button onClick={() => { setIsDuplicateWarningOpen(false); setDuplicateData(null); setIsSubmitting(false); }} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Duplicate Scanner Modal (Structure Unchanged) */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-4xl p-6 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-4 shrink-0"><h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ScanSearch size={24} className="text-primary-600" /> Quét trùng lặp dữ liệu</h3><button onClick={() => setIsDuplicateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
              <div className="flex-1 overflow-y-auto min-h-[300px]">
                  {isScanning ? (<div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3"><Loader2 className="animate-spin text-primary-600" size={32} /><p>Đang quét toàn bộ dữ liệu...</p></div>) : duplicateGroups.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3"><CheckCircle2 size={48} className="text-green-500" /><p className="text-lg font-medium text-gray-900">Không phát hiện dữ liệu trùng lặp!</p></div>) : (
                      <div className="space-y-6">
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3 text-yellow-800"><AlertTriangle size={24} /><div><h4 className="font-bold">Phát hiện {duplicateGroups.length} nhóm trùng lặp</h4></div></div>
                          {duplicateGroups.map((group, idx) => (
                              <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center"><span className="font-mono font-bold text-gray-800 flex items-center gap-2"><Phone size={14}/> {group.phone}</span><span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{group.customers.length} bản ghi</span></div>
                                  <div className="divide-y divide-gray-100">{group.customers.map(cust => (
                                          <div key={cust.id} className="p-3 hover:bg-blue-50 transition-colors flex justify-between items-center"><div><div className="font-bold text-gray-900 flex items-center gap-2" onClick={() => { setIsDuplicateModalOpen(false); navigate(`/customers/${cust.id}`); }}>{cust.name} <span className="text-xs font-normal text-gray-500">({new Date(cust.created_at).toLocaleDateString('vi-VN')})</span></div><div className="text-xs text-gray-600 mt-0.5">Sales: <strong>{cust.sales_rep || 'Chưa có'}</strong> • Trạng thái: {cust.status}</div></div><button onClick={() => { setIsDuplicateModalOpen(false); navigate(`/customers/${cust.id}`); }} className="px-3 py-1.5 bg-white border border-gray-200 text-xs font-bold text-gray-700 rounded hover:bg-gray-50">Xem chi tiết</button></div>
                                      ))}</div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;

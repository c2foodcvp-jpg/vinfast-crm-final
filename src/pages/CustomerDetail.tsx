
import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Customer, CustomerStatus, Interaction, CustomerClassification, DealDetails, UserProfile, UserRole, Distributor, DealStatus, CAR_MODELS as DEFAULT_CAR_MODELS, Transaction, TransactionType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, Phone, MapPin, Edit, MessageCircle, Send, User as UserIcon, CarFront, Calendar, Flame, Ban, CheckCircle2, ShieldCheck, Mail, RefreshCcw, ArrowRightLeft, X, Loader2, AlertTriangle, Database, Info, Copy, Terminal, ChevronDown, FileCheck2, Trash2, UserCheck, Hand, ChevronRight, ChevronLeft, Save, Plus, BadgeDollarSign, Wallet, Undo2, Building2, UserPlus, Keyboard, AlertOctagon, Check, Minus, Eye, Share2, Lock, Users, Archive
} from 'lucide-react';

const { useParams, useNavigate, useLocation } = ReactRouterDOM as any;

const CustomerDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, isMod, isAdmin } = useAuth();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');

  // Info Editing State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({
      interest: '', location: '', source: '', phone: '', secondary_phone: ''
  });

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]); 
  const [carList, setCarList] = useState<string[]>(DEFAULT_CAR_MODELS);

  // Local Control States
  const [classification, setClassification] = useState<CustomerClassification>('Warm');
  const [recareDate, setRecareDate] = useState('');
  const [isSpecialCare, setIsSpecialCare] = useState(false);
  const [isLongTerm, setIsLongTerm] = useState(false);
  
  // Delegation State
  const [isDelegatedViewOnly, setIsDelegatedViewOnly] = useState(false);
  
  // Navigation
  const [nextCustomerId, setNextCustomerId] = useState<string | null>(null);
  const [prevCustomerId, setPrevCustomerId] = useState<string | null>(null);
  const [customerListContext, setCustomerListContext] = useState<string[]>([]);

  // Modals
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [showWinModal, setShowWinModal] = useState(false);
  const [dealForm, setDealForm] = useState<any>({ 
      payment_method: 'Tiền mặt', plate_type: 'Biển trắng', revenue: '', distributor: '', car_availability: 'Sẵn xe', notes: '', has_accessories: false
  });
  
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const [showChangeSalesModal, setShowChangeSalesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangeSalesConfirm, setShowChangeSalesConfirm] = useState<{rep: UserProfile, type: 'direct' | 'request'} | null>(null);
  
  // SHARE CUSTOMER MODAL
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ recipientId: '', permission: 'view' as 'view' | 'edit' });
  const [existingShares, setExistingShares] = useState<any[]>([]);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null); // Replacement for window.confirm

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ type: 'expense' as TransactionType, amount: '', reason: '' });
  
  const [showAddRevenueModal, setShowAddRevenueModal] = useState(false);
  const [revenueForm, setRevenueForm] = useState({ amount: '', note: '' });

  const [showIncurredExpenseModal, setShowIncurredExpenseModal] = useState(false);
  const [incurredExpenseForm, setIncurredExpenseForm] = useState({ amount: '', reason: '' });

  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayForm, setRepayForm] = useState({ amount: '', reason: 'Nộp lại tiền ứng' });

  const [showDealerDebtModal, setShowDealerDebtModal] = useState(false);
  const [dealerDebtForm, setDealerDebtForm] = useState({ amount: '', targetDate: '', reason: 'Đại lý nợ tiền' });

  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [dealerDebtToConfirm, setDealerDebtToConfirm] = useState<Transaction | null>(null);

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const longTermTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  const getMinDate = () => {
      if (isLongTerm) {
          const d = new Date();
          d.setDate(d.getDate() + 10);
          return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      return todayStr;
  };

  const getMaxDate = () => {
      if (isLongTerm) return undefined;
      const d = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      d.setDate(d.getDate() + 4);
      return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    fetchCustomerData();
    fetchDistributors();
    fetchEmployees(); 
    fetchCarModels();
    setIsEditingInfo(false);
  }, [id, userProfile]); 

  useEffect(() => { 
      if (location.state?.customerIds) {
          const ids = location.state.customerIds;
          setCustomerListContext(ids);
          const currentIndex = ids.indexOf(id || '');
          if (currentIndex !== -1) {
              setPrevCustomerId(currentIndex > 0 ? ids[currentIndex - 1] : null);
              setNextCustomerId(currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null);
          }
      } else if (id) {
          fetchSiblingCustomers();
      }
  }, [id, location.state]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }
        if (e.key === 'ArrowLeft' && prevCustomerId) {
            navigate(`/customers/${prevCustomerId}`, { state: { customerIds: customerListContext } });
        } else if (e.key === 'ArrowRight' && nextCustomerId) {
            navigate(`/customers/${nextCustomerId}`, { state: { customerIds: customerListContext } });
        } else if (e.key === 'Home' && customerListContext.length > 0) {
            const firstId = customerListContext[0];
            if (firstId !== id) {
                navigate(`/customers/${firstId}`, { state: { customerIds: customerListContext } });
            }
        } else if (e.key === 'End' && customerListContext.length > 0) {
            const lastId = customerListContext[customerListContext.length - 1];
            if (lastId !== id) {
                navigate(`/customers/${lastId}`, { state: { customerIds: customerListContext } });
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [prevCustomerId, nextCustomerId, customerListContext, id, navigate]);

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 3000); return () => clearTimeout(timer); } }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });
  const formatCurrency = (value: number) => !value ? '0' : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const fetchDistributors = async () => { try { const { data } = await supabase.from('distributors').select('*').order('name'); if (data) setDistributors(data as Distributor[]); } catch (e) {} };
  
  const fetchEmployees = async () => { 
      try { 
          // Fetch active employees
          let query = supabase.from('profiles').select('*').eq('status', 'active');
          const { data } = await query;
          if (data) { setEmployees(data as UserProfile[]); }
      } catch (e) { console.error("Error fetching employees", e); } 
  };

  const fetchCarModels = async () => {
      try {
          const { data } = await supabase.from('car_models').select('name').order('created_at', { ascending: false });
          if (data && data.length > 0) {
              setCarList(data.map(c => c.name));
          }
      } catch (e) { console.error("Error fetching car models", e); }
  };

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      if (!id) return;
      const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
      if (error) throw error;
      setCustomer(data as Customer);
      
      if (data.classification) setClassification(data.classification);
      if (data.recare_date) setRecareDate(data.recare_date);
      
      setIsSpecialCare(!!data.is_special_care);
      setIsLongTerm(!!data.is_long_term);

      setEditForm({ interest: data.interest || '', location: data.location || '', source: data.source || '', phone: data.phone || '', secondary_phone: data.secondary_phone || '' });

      // Check Access / Delegation / Sharing
      if (!isAdmin && data.creator_id !== userProfile?.id) {
          // 1. Check direct share first (customer_shares)
          const { data: share } = await supabase.from('customer_shares')
              .select('permission')
              .eq('customer_id', id)
              .eq('shared_with', userProfile?.id)
              .maybeSingle();
          
          if (share) {
              // Explicit share found.
              // If permission is 'edit', viewOnly = false. If 'view', viewOnly = true.
              setIsDelegatedViewOnly(share.permission === 'view');
          } else {
              // 2. Fallback to old global delegation
              try {
                  const { data: delegation } = await supabase
                      .from('access_delegations')
                      .select('access_level')
                      .eq('recipient_id', userProfile?.id)
                      .eq('target_user_id', data.creator_id)
                      .single();
                  
                  if (delegation && delegation.access_level === 'view') {
                      setIsDelegatedViewOnly(true);
                  } else {
                      setIsDelegatedViewOnly(false); // Can view/edit if delegated with 'edit' or if mod logic allows
                  }
              } catch (e) { 
                  // If no delegation and not explicit share, assume View Only unless Mod
                  if (isMod) {
                      // Mod can edit if MKT Group
                      if (data.source === 'MKT Group') {
                          setIsDelegatedViewOnly(false);
                      } else {
                          // Standard Mod Logic (can edit team)
                          setIsDelegatedViewOnly(false); 
                      }
                  } else {
                      setIsDelegatedViewOnly(true);
                  }
              }
          }
      } else {
          setIsDelegatedViewOnly(false); // Owner or Admin
      }

      const { data: interactionData } = await supabase.from('interactions').select('*').eq('customer_id', id).order('created_at', { ascending: false });
      if (interactionData) setInteractions(interactionData as Interaction[]);

      const { data: transData } = await supabase.from('transactions').select('*').eq('customer_id', id).order('created_at', { ascending: false });
      if (transData) setTransactions(transData as Transaction[]);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchSiblingCustomers = async () => {
      try {
          if (!id) return;
          let query = supabase.from('customers').select('id').order('created_at', { ascending: false });
          if (!isAdmin && !isMod && userProfile?.id) query = query.eq('creator_id', userProfile.id);
          const { data } = await query;
          if (!data) return;
          const currentIndex = data.findIndex(c => c.id === id);
          if (currentIndex !== -1) {
              setPrevCustomerId(currentIndex > 0 ? data[currentIndex - 1].id : null);
              setNextCustomerId(currentIndex < data.length - 1 ? data[currentIndex + 1].id : null);
          }
      } catch (e) { console.error("Error fetching siblings", e); }
  };

  const handleAddNote = async (type: Interaction['type'] = 'note', customContent?: string) => {
      if (isDelegatedViewOnly) { showToast("Bạn chỉ có quyền xem, không thể thêm ghi chú.", 'error'); return; }
      if (!id || (!newNote.trim() && !customContent)) return;
      const content = customContent || newNote;
      try {
          const { data, error } = await supabase.from('interactions').insert([{ customer_id: id, user_id: userProfile?.id, type, content, created_at: new Date().toISOString() }]).select().single();
          if (error) throw error;
          setInteractions([data as Interaction, ...interactions]);
          if (!customContent) setNewNote('');
      } catch (e) { showToast("Lỗi lưu ghi chú", 'error'); }
  };

  // --- NEW: Handle Auto-track Call/Zalo ---
  const handleTrackAction = async (type: 'call' | 'zalo', content: string) => {
      // Allow action even if delegated view only? Usually View Only cannot add history.
      // But for calls, if they can see the number, they can call. Let's record it.
      if (!id || !userProfile?.id) return;
      
      try {
          const { data, error } = await supabase.from('interactions').insert([{ 
              customer_id: id, 
              user_id: userProfile.id, 
              type: type, 
              content: content, 
              created_at: new Date().toISOString() 
          }]).select().single();
          
          if (!error && data) {
              setInteractions(prev => [data as Interaction, ...prev]);
          }
      } catch (e) { console.error("Auto-track error", e); }
  };

  const updateCustomerField = async (fields: Partial<Customer>) => {
      if (isDelegatedViewOnly) { showToast("Bạn chỉ có quyền xem.", 'error'); return; }
      if (!id || !customer) return;
      const updatedLocal = { ...customer, ...fields };
      setCustomer(updatedLocal as Customer);
      try { await supabase.from('customers').update(fields).eq('id', id); } catch (e) {}
  };

  const handleSaveInfo = async () => {
      if (customer?.status === CustomerStatus.WON) { showToast("Khách đã chốt không thể sửa thông tin!", 'error'); return; }
      await updateCustomerField({ interest: editForm.interest, location: editForm.location, source: editForm.source, secondary_phone: editForm.secondary_phone });
      setIsEditingInfo(false); handleAddNote('note', "Đã cập nhật thông tin khách hàng."); showToast("Cập nhật thông tin thành công!");
  };

  const handleAcknowledge = async () => {
      if (!customer) return;
      await updateCustomerField({ is_acknowledged: true });
      handleAddNote('note', "Đã tiếp nhận khách hàng từ hệ thống phân bổ.");
      showToast("Đã tiếp nhận thành công!", 'success');
  };

  const handleClassificationChange = async (cls: CustomerClassification) => {
      setClassification(cls);
      await updateCustomerField({ classification: cls });
      showToast(`Đã chuyển sang ${cls}`);
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const date = e.target.value;
      if (isLongTerm) {
          const minDate = getMinDate();
          if (date < minDate) {
              showToast(`CS Dài hạn phải chọn ngày tối thiểu 10 ngày từ hôm nay`, 'error');
              return;
          }
      }
      setRecareDate(date);
      await updateCustomerField({ recare_date: date });
      showToast("Đã cập nhật ngày chăm sóc");
  };

  const toggleSpecialCare = async () => {
      const newVal = !isSpecialCare;
      setIsSpecialCare(newVal);
      if (newVal) {
          setIsLongTerm(false); 
          await updateCustomerField({ is_special_care: true, is_long_term: false, special_care_start_date: new Date().toISOString() });
          handleAddNote('note', "Đã đánh dấu: Chăm sóc đặc biệt (Hot)");
      } else {
          await updateCustomerField({ is_special_care: false, special_care_start_date: null });
      }
  };

  const toggleLongTerm = async () => {
      const newVal = !isLongTerm;
      setIsLongTerm(newVal);
      if (newVal) {
          setIsSpecialCare(false);
          setRecareDate(''); 
          // Cập nhật: Tự động chuyển phân loại về 'Cool' khi bật CS Dài hạn
          setClassification('Cool');
          await updateCustomerField({ is_long_term: true, is_special_care: false, recare_date: null, classification: 'Cool' });
          handleAddNote('note', "Đã chuyển sang: Chăm sóc dài hạn (Phân loại: Cool)");
      } else {
          await updateCustomerField({ is_long_term: false });
      }
  };

  const handleStopCare = async () => {
      if (!stopReason) { showToast("Vui lòng nhập lý do.", 'error'); return; }
      // Cập nhật: Trạng thái đổi thành LOST (Đã hủy) nếu là Admin/Mod, hoặc LOST_PENDING nếu là Sales
      // ĐỒNG THỜI: Chuyển classification về 'Cool'
      const newStatus = (isAdmin || isMod) ? CustomerStatus.LOST : CustomerStatus.LOST_PENDING;
      setClassification('Cool');
      await updateCustomerField({ status: newStatus, stop_reason: stopReason, classification: 'Cool' });
      handleAddNote('note', `Ngưng chăm sóc (Lý do: ${stopReason}). Trạng thái mới: ${newStatus}. Phân loại: Cool`);
      setShowStopModal(false);
      showToast("Đã cập nhật trạng thái thành công!");
  };

  const handleReopenCare = async () => {
      await updateCustomerField({ status: CustomerStatus.POTENTIAL, stop_reason: null });
      handleAddNote('note', 'Đã mở lại chăm sóc khách hàng.');
      showToast("Đã mở lại chăm sóc!");
  };

  // CHECK IF MKT GROUP (For strictly enforcing finance visibility)
  const isMKTSource = useMemo(() => {
      return customer?.source === 'MKT Group' || (customer?.source || '').includes('MKT');
  }, [customer]);

  const handleApproveRequest = async () => {
      if (!customer) return;
      if (customer.status === CustomerStatus.WON_PENDING) {
          await updateCustomerField({ status: CustomerStatus.WON, deal_status: 'processing' });
          // Only create revenue transaction if customer is MKT
          if (customer.deal_details?.revenue && isMKTSource) {
             await supabase.from('transactions').insert([{
                customer_id: id, customer_name: customer.name, user_id: userProfile?.id, user_name: userProfile?.full_name,
                type: 'revenue', amount: customer.deal_details.revenue, reason: 'Doanh thu dự kiến (Duyệt chốt)', status: 'approved'
             }]);
          }
          showToast("Đã duyệt Chốt Deal!");
      } else if (customer.status === CustomerStatus.LOST_PENDING) {
          await updateCustomerField({ status: CustomerStatus.LOST });
          showToast("Đã duyệt Ngưng Chăm Sóc!");
      }
  };

  const handleApproveTransfer = async () => {
      if (!customer || !customer.pending_transfer_to) return;
      
      const newRepId = customer.pending_transfer_to;
      let newRepName = 'Unknown';
      const rep = employees.find(e => e.id === newRepId);
      if (rep) {
          newRepName = rep.full_name;
      } else {
          const { data } = await supabase.from('profiles').select('full_name').eq('id', newRepId).single();
          if (data) newRepName = data.full_name;
      }

      await updateCustomerField({ 
          sales_rep: newRepName, 
          creator_id: newRepId,
          pending_transfer_to: null 
      });
      
      handleAddNote('note', `[Admin/Mod] Đã duyệt chuyển quyền chăm sóc sang ${newRepName}.`);
      showToast("Đã duyệt chuyển quyền!");
  };

  const handleRejectTransfer = async () => {
      await updateCustomerField({ pending_transfer_to: null });
      handleAddNote('note', '[Admin/Mod] Đã từ chối yêu cầu chuyển quyền.');
      showToast("Đã từ chối!");
  };

  const prepareChangeSales = (newRep: UserProfile) => {
      if (isAdmin || isMod) {
          setShowChangeSalesConfirm({ rep: newRep, type: 'direct' });
      } else {
          setShowChangeSalesConfirm({ rep: newRep, type: 'request' });
      }
  };

  const executeChangeSales = async () => {
      if (!showChangeSalesConfirm) return;
      const { rep, type } = showChangeSalesConfirm;

      if (type === 'direct') {
          await updateCustomerField({ sales_rep: rep.full_name, creator_id: rep.id });
          handleAddNote('note', `Đã chuyển khách hàng sang TVBH: ${rep.full_name}`);
          showToast("Đã chuyển Sales thành công!");
      } else {
          await updateCustomerField({ pending_transfer_to: rep.id });
          handleAddNote('note', `Đã gửi yêu cầu chuyển khách sang: ${rep.full_name}`);
          showToast("Đã gửi yêu cầu!");
      }
      setShowChangeSalesConfirm(null);
      setShowChangeSalesModal(false);
  };

  // --- SHARE CUSTOMER LOGIC ---
  const handleOpenShareModal = async () => {
      if (!id) return;
      // Fetch existing shares
      const { data } = await supabase.from('customer_shares').select('*').eq('customer_id', id);
      const mappedShares = [];
      if (data) {
          for (const s of data) {
              const u = employees.find(e => e.id === s.shared_with);
              mappedShares.push({ ...s, user_name: u?.full_name || 'Unknown' });
          }
      }
      setExistingShares(mappedShares);
      setShowShareModal(true);
  };

  // --- SHARE USER FILTER LOGIC ---
  const availableUsersToShare = useMemo(() => {
      if (!userProfile) return [];
      
      // Filter self out
      let targets = employees.filter(e => e.id !== userProfile.id);

      if (isAdmin) return targets;

      const myManagerId = userProfile.manager_id;

      if (isMod) {
          // Mod can share with:
          // 1. Subordinates (manager_id = me)
          // 2. My own manager (if exists)
          // 3. Admin (Always allowed)
          return targets.filter(e => 
              e.manager_id === userProfile.id || 
              (myManagerId && e.id === myManagerId) ||
              e.role === UserRole.ADMIN
          );
      }

      // Employee
      // Share with Manager or Team Members (same manager)
      return targets.filter(e => 
          (myManagerId && e.manager_id === myManagerId) || // Teammates (Same manager)
          (myManagerId && e.id === myManagerId) || // My Manager
          e.role === UserRole.ADMIN // Admin
      );
  }, [employees, userProfile, isAdmin, isMod]);

  // --- CHANGE SALES USER FILTER LOGIC ---
  const availableUsersToChange = useMemo(() => {
      if (!userProfile) return [];
      let targets = employees.filter(e => e.id !== userProfile.id);

      if (isAdmin) return targets;

      if (isMod) {
          // Mod can change sales to:
          // Subordinates (manager_id = me) only.
          return targets.filter(e => e.manager_id === userProfile.id);
      }

      // Sales cannot change sales directly usually, but if enabled request, limit to teammates?
      // Requirement: "Đổi sale chỉ đổi được trong team (Cùng cấp bậc hoặc thấp hơn)"
      // Assuming Sales can't change to anyone, returning empty or just Admin/Mod for request
      return []; 
  }, [employees, userProfile, isAdmin, isMod]);


  const handleShareCustomer = async () => {
      if (!shareForm.recipientId || !id) return;
      if (shareForm.recipientId === userProfile?.id) { alert("Không thể chia sẻ cho chính mình."); return; }
      
      try {
          // Upsert logic manually
          const { data: existing } = await supabase.from('customer_shares')
              .select('id')
              .eq('customer_id', id)
              .eq('shared_with', shareForm.recipientId)
              .maybeSingle();
          
          if (existing) {
              await supabase.from('customer_shares').update({
                  permission: shareForm.permission
              }).eq('id', existing.id);
          } else {
              await supabase.from('customer_shares').insert([{
                  customer_id: id,
                  shared_by: userProfile?.id,
                  shared_with: shareForm.recipientId,
                  permission: shareForm.permission
              }]);
          }
          
          const recipient = employees.find(e => e.id === shareForm.recipientId);
          handleAddNote('note', `Đã chia sẻ quyền truy cập (${shareForm.permission === 'view' ? 'Xem' : 'Sửa'}) cho: ${recipient?.full_name}`);
          alert("Đã chia sẻ thành công!");
          handleOpenShareModal(); // Refresh list
      } catch (e: any) {
          if (e.code === '42P01') alert("Lỗi: Bảng chia sẻ chưa được tạo trong Database. Vui lòng báo Admin.");
          else alert("Lỗi chia sẻ: " + e.message);
      }
  };

  const executeRevokeShare = async (shareId: string, userName: string) => {
      try {
          await supabase.from('customer_shares').delete().eq('id', shareId);
          handleAddNote('note', `Đã hủy quyền truy cập của: ${userName}`);
          handleOpenShareModal(); // Refresh
      } catch (e) { alert("Lỗi hủy chia sẻ."); }
      setRevokeConfirmId(null);
  };

  const executeDeleteCustomer = async () => {
      if (!id) return;
      try {
          await supabase.from('interactions').delete().eq('customer_id', id);
          await supabase.from('transactions').delete().eq('customer_id', id);
          await supabase.from('customer_shares').delete().eq('customer_id', id); // Clean up shares
          
          const { error } = await supabase.from('customers').delete().eq('id', id);
          if (error) { throw new Error(error.message); }
          navigate('/customers');
      } catch (e: any) {
          showToast("Lỗi xóa: " + e.message, 'error');
          setShowDeleteConfirm(false);
      }
  };

  const handleDealAction = async (action: 'complete' | 'refund' | 'cancel' | 'reopen' | 'suspend') => {
      if (action === 'cancel') {
          await updateCustomerField({ status: CustomerStatus.POTENTIAL, deal_status: undefined });
          handleAddNote('note', "Đã hủy chốt đơn, quay lại chăm sóc.");
          return;
      }
      if (action === 'reopen') {
          await updateCustomerField({ deal_status: 'processing' }); 
          handleAddNote('note', "Đã mở lại xử lý đơn hàng.");
          showToast("Đã mở lại xử lý!");
          return;
      }
      if (action === 'suspend') {
          setShowSuspendModal(true);
          return;
      }
      const statusMap: any = {
          'complete': (isAdmin || isMod) ? 'completed' : 'completed_pending',
          'refund': (isAdmin || isMod) ? 'refunded' : 'refund_pending',
      };
      await updateCustomerField({ deal_status: statusMap[action] });
      showToast("Đã cập nhật trạng thái đơn hàng!");
  };

  const confirmSuspend = async () => {
      if (!suspendReason.trim()) { showToast("Vui lòng nhập lý do treo hồ sơ.", 'error'); return; }
      
      const newStatus = (isAdmin || isMod) ? 'suspended' : 'suspended_pending';
      await updateCustomerField({ deal_status: newStatus });
      handleAddNote('note', `Treo hồ sơ. Lý do: ${suspendReason}`);
      
      setShowSuspendModal(false);
      setSuspendReason('');
      showToast("Đã cập nhật trạng thái hồ sơ!");
  };

  const handleAddRevenue = async () => {
      const amount = Number(revenueForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0) return;
      try {
          const currentActual = customer?.deal_details?.actual_revenue || 0;
          const newActual = currentActual + amount;
          const newDealDetails = { ...customer?.deal_details, actual_revenue: newActual };

          // UPDATE CUSTOMER DB ONLY - NO TRANSACTION
          const { error } = await supabase.from('customers').update({ deal_details: newDealDetails }).eq('id', id);
          if (error) throw error;
          
          setCustomer(prev => { if(!prev) return null; return { ...prev, deal_details: newDealDetails as any }; });
          setShowAddRevenueModal(false);
          setRevenueForm({amount: '', note: ''});
          showToast("Đã thêm doanh thu thực tế!");
          if (revenueForm.note) handleAddNote('note', `Thêm doanh thu thực tế: +${formatCurrency(amount)} VNĐ. Ghi chú: ${revenueForm.note}`);
      } catch (err: any) { showToast("Lỗi: " + err.message, 'error'); }
  };

  const handleAddIncurredExpense = async () => {
      const amount = Number(incurredExpenseForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0 || !incurredExpenseForm.reason) { showToast("Vui lòng nhập đủ thông tin", 'error'); return; }
      try {
          const { data, error } = await supabase.from('transactions').insert([{
              customer_id: id, customer_name: customer?.name, user_id: userProfile?.id, user_name: userProfile?.full_name,
              type: 'incurred_expense', // New Type
              amount: amount, 
              reason: incurredExpenseForm.reason, 
              status: 'approved' // Usually auto-approved as it doesn't affect fund, just record keeping
          }]).select().single();
          if (error) throw error;
          
          setTransactions(prev => [data as Transaction, ...prev]);
          setShowIncurredExpenseModal(false);
          setIncurredExpenseForm({ amount: '', reason: '' });
          handleAddNote('note', `Thêm khoản chi phát sinh: ${formatCurrency(amount)} VNĐ. Lý do: ${incurredExpenseForm.reason}`);
          showToast("Đã thêm khoản chi phát sinh!");
      } catch (e: any) { showToast("Lỗi: " + e.message, 'error'); }
  };

  const handleRequestExpense = async () => {
      const amount = Number(expenseForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0 || !expenseForm.reason) { showToast("Vui lòng nhập đủ thông tin.", 'error'); return; }
      try {
          const { data, error } = await supabase.from('transactions').insert([{
              customer_id: id, customer_name: customer?.name, user_id: userProfile?.id, user_name: userProfile?.full_name,
              type: expenseForm.type, 
              amount: amount, reason: expenseForm.reason, status: 'pending'
          }]).select().single();
          if (error) throw error;
          setTransactions(prev => [data as Transaction, ...prev]);
          setShowExpenseModal(false);
          setExpenseForm({ type: 'expense', amount: '', reason: '' });
          const actionText = expenseForm.type === 'advance' ? `ứng tiền` : 'chi tiền';
          handleAddNote('note', `Đã gửi yêu cầu ${actionText}: ${formatCurrency(amount)} VNĐ.`);
          showToast("Đã gửi yêu cầu duyệt!");
      } catch (err: any) { showToast("Lỗi: " + err.message, 'error'); }
  };

  const handleRepayAdvance = async () => {
      const amount = Number(repayForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0) return;
      try {
          const { data, error } = await supabase.from('transactions').insert([{
              customer_id: id, customer_name: customer?.name, user_id: userProfile?.id, user_name: userProfile?.full_name,
              type: 'repayment', 
              amount: amount, 
              reason: `${repayForm.reason} [Ref:Self]`,
              status: 'pending'
          }]).select().single();
          
          if (error) throw error;
          setTransactions(prev => [data as Transaction, ...prev]);
          setShowRepayModal(false);
          setRepayForm({ amount: '', reason: 'Nộp lại tiền ứng' });
          handleAddNote('note', `Đã gửi yêu cầu nộp lại tiền ứng: ${formatCurrency(amount)} VNĐ.`);
          showToast("Đã gửi yêu cầu nộp tiền! Chờ Admin duyệt.", 'success');
      } catch (err: any) { showToast("Lỗi: " + err.message, 'error'); }
  };

  const handleSubmitDealerDebt = async () => {
      const amount = Number(dealerDebtForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0 || !dealerDebtForm.targetDate) { showToast("Vui lòng nhập đủ thông tin", 'error'); return; }
      try {
          const { data, error } = await supabase.from('transactions').insert([{
              customer_id: id, customer_name: customer?.name, user_id: customer?.creator_id || userProfile?.id, user_name: customer?.sales_rep || userProfile?.full_name,
              type: 'dealer_debt', target_date: dealerDebtForm.targetDate, amount: amount, reason: dealerDebtForm.reason, status: 'approved'
          }]).select().single();
          if (error) throw error;
          const currentPredicted = customer?.deal_details?.revenue || 0;
          const currentActual = customer?.deal_details?.actual_revenue || 0;
          const newDealDetails = { ...customer?.deal_details, revenue: currentPredicted + amount, actual_revenue: currentActual + amount };
          await updateCustomerField({ deal_details: newDealDetails as any });
          setTransactions(prev => [data as Transaction, ...prev]);
          setShowDealerDebtModal(false);
          setDealerDebtForm({ amount: '', targetDate: '', reason: 'Đại lý nợ tiền' });
          handleAddNote('note', `Tạo khoản Đại lý nợ: ${formatCurrency(amount)} VNĐ. Dự kiến thu: ${new Date(dealerDebtForm.targetDate).toLocaleDateString('vi-VN')}`);
          showToast("Đã tạo khoản nợ!");
      } catch (e) { showToast("Lỗi tạo khoản nợ", 'error'); }
  };

  const handleDealerDebtPaid = (debtTransaction: Transaction) => { setDealerDebtToConfirm(debtTransaction); };

  const executeDealerDebtPaid = async () => {
      if (!dealerDebtToConfirm) return;
      try {
          const targetUserId = customer?.creator_id || dealerDebtToConfirm.user_id;
          const targetUserName = customer?.sales_rep || dealerDebtToConfirm.user_name;
          const { data, error } = await supabase.from('transactions').insert([{
              customer_id: id, customer_name: customer?.name, user_id: targetUserId, user_name: targetUserName,
              type: 'deposit', amount: dealerDebtToConfirm.amount, reason: `Thu nợ đại lý: ${dealerDebtToConfirm.reason}`, status: 'approved', approved_by: userProfile?.id
          }]).select().single();
          if (error) throw error;
          await supabase.from('transactions').update({ reason: `${dealerDebtToConfirm.reason} (Đã thu)` }).eq('id', dealerDebtToConfirm.id);
          setTransactions(prev => [data as Transaction, ...prev.map(t => t.id === dealerDebtToConfirm.id ? {...t, reason: `${t.reason} (Đã thu)`} : t)]);
          showToast("Đã thu nợ thành công!");
          handleAddNote('note', `Đã thu hồi khoản nợ đại lý: ${formatCurrency(dealerDebtToConfirm.amount)} VNĐ.`);
      } catch (e: any) { showToast("Lỗi: " + (e.message || "Unknown"), 'error'); } finally { setDealerDebtToConfirm(null); }
  };

  const handleRequestWin = async () => {
      if (!dealForm.payment_method || !dealForm.plate_type || !dealForm.distributor || !dealForm.car_availability || !dealForm.revenue) {
          showToast("Vui lòng nhập đầy đủ thông tin bắt buộc (*) trước khi chốt deal!", 'error');
          return;
      }
      const newStatus = (isAdmin || isMod) ? CustomerStatus.WON : CustomerStatus.WON_PENDING;
      const revenueNum = Number(dealForm.revenue.replace(/\./g, ''));
      await updateCustomerField({ status: newStatus, deal_details: {...dealForm, revenue: revenueNum}, deal_status: newStatus === CustomerStatus.WON ? 'processing' : undefined });
      
      // ONLY create transaction if customer is MKT
      if (newStatus === CustomerStatus.WON && isMKTSource) {
          await supabase.from('transactions').insert([{
              customer_id: id, customer_name: customer?.name, user_id: userProfile?.id, user_name: userProfile?.full_name,
              type: 'revenue', amount: revenueNum, reason: 'Doanh thu dự kiến (Chốt đơn)', status: 'approved'
          }]);
      }
      handleAddNote('note', `Chốt deal: ${formatCurrency(revenueNum)} VNĐ.`);
      setShowWinModal(false);
      showToast("Đã cập nhật!");
  };

  const confirmDeleteTransaction = async () => {
      if (!transactionToDelete) return;
      try {
          const { error } = await supabase.from('transactions').delete().eq('id', transactionToDelete.id);
          if (error) throw error;
          setTransactions(prev => prev.filter(t => t.id !== transactionToDelete.id));
          setTransactionToDelete(null);
          showToast("Đã xóa giao dịch thành công!");
      } catch (e: any) { showToast("Lỗi xóa: " + e.message, 'error'); }
  };

  // --- CALCULATION LOGIC ---
  const predictedRevenue = customer?.deal_details?.revenue || 0;
  
  // Calculate Incurred Expenses (Non-Fund Expenses)
  const totalIncurredExpenses = transactions
      .filter(t => t.type === 'incurred_expense' && t.status === 'approved')
      .reduce((acc, curr) => acc + curr.amount, 0);

  const rawActualRevenue = customer?.deal_details?.actual_revenue || 0;
  
  // Adjusted Actual Revenue (Total) = Raw Revenue - Incurred Expenses
  const moneyInTotal = rawActualRevenue - totalIncurredExpenses;
  
  // "Deposited" = Sum of all 'deposit' or 'revenue' type transactions that are NOT the initial predicted revenue
  const totalDeposited = transactions
      .filter(t => (t.type === 'deposit' || t.type === 'repayment') && t.status === 'approved')
      .reduce((acc, curr) => acc + curr.amount, 0);

  const pendingDeposit = Math.max(0, moneyInTotal - totalDeposited);

  // Refundable Advances Calculation (All Advances are Refundable now)
  const refundableAdvances = transactions
      .filter(t => t.type === 'advance' && t.status === 'approved')
      .reduce((acc, curr) => acc + curr.amount, 0);
  
  const repayments = transactions
      .filter(t => t.type === 'repayment' && t.status === 'approved')
      .reduce((acc, curr) => acc + curr.amount, 0);
  
  const outstandingAdvance = Math.max(0, refundableAdvances - repayments);
  
  const pendingRepaymentExists = transactions.some(t => t.type === 'repayment' && t.status === 'pending');

  const totalExpense = transactions.filter(t => (t.type === 'expense' || t.type === 'advance') && t.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0);

  const netRevenue = totalDeposited - totalExpense; 

  // Interaction Counts
  const callCount = useMemo(() => interactions.filter(i => i.type === 'call').length, [interactions]);
  const messageCount = useMemo(() => interactions.filter(i => ['zalo', 'email', 'message'].includes(i.type) || i.content.toLowerCase().includes('zalo') || i.content.toLowerCase().includes('nhắn tin')).length, [interactions]);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;
  if (!customer) return <div className="text-center p-8">Không tìm thấy khách hàng</div>;

  const isWon = customer.status === CustomerStatus.WON;
  const isPending = customer.status === CustomerStatus.WON_PENDING || customer.status === CustomerStatus.LOST_PENDING;
  const isLost = customer.status === CustomerStatus.LOST || customer.status === CustomerStatus.LOST_PENDING;
  const isCompleted = customer.deal_status === 'completed';
  const isRefunded = customer.deal_status === 'refunded';
  const isSuspended = customer.deal_status === 'suspended';
  const hideCarePanel = isWon || isLost;
  
  // Updated showFinance Logic: Must be Won AND not finished AND MKT Source
  const showFinance = isWon && !isCompleted && !isRefunded && !isSuspended && isMKTSource;

  const canShare = isAdmin || isMod || customer.creator_id === userProfile?.id; // Owners, Admin and Mod can share

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 relative">
      {/* HEADER (Unchanged) */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <button onClick={() => navigate('/customers')} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500"><ArrowLeft size={24} /></button>
            </div>
            <div className="flex gap-2">
                <button onClick={() => prevCustomerId && navigate(`/customers/${prevCustomerId}`, { state: { customerIds: customerListContext } })} disabled={!prevCustomerId} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1 group">
                    <ChevronLeft size={16}/> <span className="hidden sm:inline">Trước</span>
                    <span className="hidden sm:inline text-[10px] text-gray-400 bg-gray-100 px-1 rounded border border-gray-300 ml-1">←</span>
                </button>
                <button onClick={() => nextCustomerId && navigate(`/customers/${nextCustomerId}`, { state: { customerIds: customerListContext } })} disabled={!nextCustomerId} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1 group">
                    <span className="hidden sm:inline">Sau</span> <ChevronRight size={16}/>
                    <span className="hidden sm:inline text-[10px] text-gray-400 bg-gray-100 px-1 rounded border border-gray-300 ml-1">→</span>
                </button>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                <span className="px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide border bg-blue-100 text-blue-800 border-blue-200">{customer.status}</span>
                {isDelegatedViewOnly && <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full border border-gray-300 flex items-center gap-1"><Eye size={14}/> CHẾ ĐỘ XEM</span>}
            </div>
            <div className="flex gap-2">
                {(isAdmin || isMod) && customer.pending_transfer_to && !isDelegatedViewOnly && (
                    <div className="flex gap-2">
                        <button onClick={handleApproveTransfer} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 flex items-center gap-2 animate-pulse"><CheckCircle2 size={18}/> Duyệt Chuyển</button>
                        <button onClick={handleRejectTransfer} className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-lg shadow-sm hover:bg-red-200 flex items-center gap-2"><X size={18}/> Từ chối</button>
                    </div>
                )}
                {customer.status === CustomerStatus.NEW && !customer.is_acknowledged && !isDelegatedViewOnly && (
                    <button onClick={handleAcknowledge} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 flex items-center gap-2 animate-bounce">
                        <UserCheck size={18}/> Tiếp nhận khách
                    </button>
                )}
                {isPending && (isAdmin || isMod) && !isDelegatedViewOnly && (
                    <button onClick={handleApproveRequest} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 flex items-center gap-2"><CheckCircle2 size={18}/> Duyệt Yêu Cầu</button>
                )}
                {!isWon && !isLost && !isDelegatedViewOnly && (isAdmin || isMod) && (
                    <>
                        <button onClick={() => setShowChangeSalesModal(true)} className="px-3 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 flex items-center gap-2"><ArrowRightLeft size={16}/> Đổi Sales</button>
                        {canShare && (
                            <button onClick={handleOpenShareModal} className="px-3 py-2 bg-teal-50 border border-teal-200 text-teal-700 font-bold rounded-lg hover:bg-teal-100 flex items-center gap-2" title="Chia sẻ khách hàng"><Share2 size={16}/></button>
                        )}
                    </>
                )}
                {(isAdmin || isMod) && (
                    <button onClick={() => setShowDeleteConfirm(true)} className="p-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={18}/></button>
                )}
            </div>
        </div>
      </div>

      {toast && (
          <div className={`fixed top-4 right-4 z-[70] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="font-bold text-sm">{toast.msg}</span>
          </div>
      )}

      {/* ... Content Grids (Existing) ... */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          {/* ... Left Column Content (Care Panel) ... */}
          {isLost && (
              <div className="bg-red-50 rounded-2xl p-6 shadow-sm border border-red-100 text-center animate-fade-in"><div className="flex justify-center mb-3"><Ban size={48} className="text-red-400" /></div><h3 className="font-bold text-red-700 text-lg mb-2">Khách hàng đang Ngưng Chăm Sóc</h3><p className="text-red-600 text-sm mb-4 italic">"{customer.stop_reason || 'Không có lý do'}"</p><button onClick={handleReopenCare} disabled={isDelegatedViewOnly} className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCcw size={18}/> Mở lại chăm sóc</button></div>
          )}
          {isWon && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-200 animate-fade-in"><h3 className="font-bold text-green-800 mb-4 flex items-center gap-2"><FileCheck2 size={20}/> Trạng thái đơn hàng</h3><div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center mb-4"><p className="text-xs text-green-600 font-bold uppercase mb-1">TÌNH TRẠNG HIỆN TẠI</p><p className="text-xl font-bold text-green-800">{isCompleted ? 'Đã hoàn thành' : isRefunded ? 'Đã trả cọc' : isSuspended ? 'Hồ sơ Treo' : customer.deal_status === 'completed_pending' ? 'Chờ duyệt hoàn thành' : customer.deal_status === 'refund_pending' ? 'Chờ duyệt trả cọc' : customer.deal_status === 'suspended_pending' ? 'Chờ duyệt Treo' : 'Đang Xử Lý'}</p></div><div className="space-y-3"><button className="w-full py-2.5 bg-white border border-green-600 text-green-700 rounded-xl font-bold text-sm hover:bg-green-50 flex items-center justify-center gap-2"><FileCheck2 size={16}/> Quản lý Đơn hàng</button>{!isCompleted && !isRefunded && !isSuspended && !isDelegatedViewOnly && (<><button onClick={() => handleDealAction('complete')} className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Hoàn thành Đơn hàng</button><div className="grid grid-cols-2 gap-2"><button onClick={() => handleDealAction('refund')} className="py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-sm hover:bg-red-100 flex items-center justify-center gap-2"><RefreshCcw size={16}/> Trả cọc</button><button onClick={() => handleDealAction('suspend')} className="py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-200 flex items-center justify-center gap-2"><Archive size={16}/> Treo hồ sơ</button></div></>)}{(isRefunded || isSuspended) && !isDelegatedViewOnly && (<button onClick={() => handleDealAction('reopen')} className="w-full py-2.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-xl font-bold text-sm hover:bg-orange-200 flex items-center justify-center gap-2"><RefreshCcw size={16}/> Mở xử lý lại</button>)}{(isAdmin || isMod) && (<button onClick={() => handleDealAction('cancel')} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 flex items-center justify-center gap-2"><RefreshCcw size={16}/> Hủy chốt / Mở lại CS</button>)}</div></div>
          )}
          {!hideCarePanel && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">Thao tác chăm sóc {isDelegatedViewOnly && <span className="text-red-500 text-xs">(Chỉ xem)</span>}</h3>
                  <div className="mb-4">
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Mức độ tiềm năng</label>
                      <div className="flex bg-gray-100 p-1 rounded-xl">
                          {(['Hot', 'Warm', 'Cool'] as CustomerClassification[]).map((cls) => (
                              <button disabled={isDelegatedViewOnly} key={cls} onClick={() => handleClassificationChange(cls)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${classification === cls ? cls === 'Hot' ? 'bg-red-500 text-white shadow-md' : cls === 'Warm' ? 'bg-orange-500 text-white shadow-md' : 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'}`}>{cls}</button>
                          ))}
                      </div>
                  </div>
                  <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Flame size={16} className={isSpecialCare ? "text-red-500" : "text-gray-400"} /> CS Đặc biệt</span><div onClick={!isDelegatedViewOnly ? toggleSpecialCare : undefined} className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isSpecialCare ? 'bg-red-500' : 'bg-gray-300'} ${isDelegatedViewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isSpecialCare ? 'translate-x-5' : ''}`}></div></div></div>
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Calendar size={16} className={isLongTerm ? "text-blue-500" : "text-gray-400"} /> CS Dài hạn</span><div onClick={!isDelegatedViewOnly ? toggleLongTerm : undefined} className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isLongTerm ? 'bg-blue-500' : 'bg-gray-300'} ${isDelegatedViewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isLongTerm ? 'translate-x-5' : ''}`}></div></div></div>
                  </div>
                  {isSpecialCare ? (
                      <div className="mb-4 bg-white border border-red-200 rounded-xl p-4 shadow-sm animate-fade-in"><p className="text-xs font-bold text-gray-500 uppercase mb-1">TRẠNG THÁI ĐẶC BIỆT</p><div className="flex items-center gap-2 text-red-600 font-bold"><Flame size={18} className="fill-red-600 animate-pulse" /><span>Đang CS Đặc biệt</span></div><p className="text-gray-400 italic text-sm mt-1">Ngày chăm sóc tiếp theo bị ẩn.</p></div>
                  ) : (
                      <div className="mb-4">
                          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{isLongTerm ? 'Ngày CS Dài hạn' : 'Ngày chăm sóc tiếp theo'}</label>
                          <div className="relative"><input disabled={isDelegatedViewOnly} type="date" min={getMinDate()} max={getMaxDate()} value={recareDate} onChange={handleDateChange} className={`w-full border rounded-xl px-4 py-2.5 bg-white text-gray-900 font-bold focus:border-primary-500 outline-none ${isLongTerm ? 'border-blue-300 ring-2 ring-blue-50' : 'border-gray-300'} disabled:bg-gray-100 disabled:text-gray-500`} /></div>
                          {isLongTerm && <p className="text-xs text-blue-500 mt-1 italic">Chọn ngày xa nhất (Tối thiểu 10 ngày từ hôm nay).</p>}
                          {!isLongTerm && <p className="text-xs text-gray-400 mt-1 italic">Giới hạn chọn: Tối đa 4 ngày từ hôm nay.</p>}
                      </div>
                  )}
                  <div className="space-y-3"><button className="w-full py-2.5 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"><Mail size={16} /> Đặt lịch Lái thử</button><div className="grid grid-cols-2 gap-3"><button disabled={isDelegatedViewOnly} onClick={() => setShowStopModal(true)} className="py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"><Ban size={16} /> Ngưng CS</button><button disabled={isDelegatedViewOnly} onClick={() => setShowWinModal(true)} className="py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-1 disabled:opacity-50"><CheckCircle2 size={16} /> Chốt Deal</button></div></div>
              </div>
          )}
          {/* ... Customer Info & Finance Panels ... */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative">
            <h3 className="font-bold text-gray-900 mb-4 border-b pb-2 flex justify-between items-center">Thông tin khách hàng{!isEditingInfo && !isWon && !isLost && !isDelegatedViewOnly && (<button onClick={() => setIsEditingInfo(true)} className="text-primary-600 hover:text-primary-700 text-xs flex items-center gap-1 font-bold"><Edit size={14} /> Sửa</button>)}</h3>
            {isEditingInfo && !isWon && !isLost ? (<div className="space-y-3 animate-fade-in"><input value={editForm.phone} disabled className="w-full border rounded px-2 py-1 text-sm font-bold bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200" /><input value={editForm.secondary_phone} onChange={e => setEditForm({...editForm, secondary_phone: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold bg-white text-gray-900 outline-none" placeholder="Nhập thêm số..." /><select value={editForm.interest} onChange={e => setEditForm({...editForm, interest: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold bg-white text-gray-900 outline-none"><option value="">-- Chọn dòng xe --</option>{carList.map(m => <option key={m} value={m}>{m}</option>)}</select><input value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})} disabled={editForm.source.includes('MKT Group') && !isAdmin && !isMod} className={`w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold outline-none ${(editForm.source.includes('MKT Group') && !isAdmin && !isMod) ? 'bg-gray-100' : 'bg-white'}`} /><input value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold bg-white text-gray-900 outline-none" placeholder="Nhập địa chỉ..." /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsEditingInfo(false)} className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">Hủy</button><button onClick={handleSaveInfo} className="flex-1 py-1.5 bg-primary-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1"><Save size={14}/> Lưu</button></div></div>) : (<div className="space-y-4 text-sm"><div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Điện thoại</span><span className="font-bold text-gray-900">{customer.phone}</span></div>{customer.secondary_phone && <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">SĐT Phụ</span><span className="font-bold text-gray-900">{customer.secondary_phone}</span></div>}
            <div className="flex gap-2 mb-2">
                <a href={`tel:${customer.phone}`} onClick={() => handleTrackAction('call', 'Đã thực hiện cuộc gọi đi.')} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer">
                    <Phone size={14} /> Gọi điện
                </a>
                <a href={`https://zalo.me/${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={() => handleTrackAction('zalo', 'Đã mở hội thoại Zalo.')} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer">
                    <MessageCircle size={14} /> Chat Zalo
                </a>
            </div>
            <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Dòng xe</span><span className="font-bold text-primary-700">{customer.interest?.toUpperCase() || '---'}</span></div><div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Nguồn</span><span className="font-medium text-gray-900">{customer.source}</span></div><div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Phụ trách</span><span className="font-medium text-gray-900">{customer.sales_rep}</span></div><div><span className="text-gray-500 block mb-1">Địa chỉ</span><span className="font-medium text-gray-900">{customer.location || '---'}</span></div></div>)}
          </div>
          {showFinance && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-200">
                  <h3 className="font-bold text-green-800 mb-4 border-b border-green-100 pb-2 flex items-center gap-2"><BadgeDollarSign size={20} /> Tài chính Đơn hàng</h3>
                  <div className="space-y-4">
                      <div className="bg-green-50 p-3 rounded-xl border border-green-100"><p className="text-xs text-green-700 font-bold uppercase">Doanh thu dự kiến (Gốc)</p><p className="text-lg font-bold text-green-900">{formatCurrency(predictedRevenue)} VNĐ</p></div>
                      
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          <div className="flex justify-between items-center"><p className="text-xs text-emerald-700 font-bold uppercase">Doanh thu thực tế (Tổng)</p><button disabled={isDelegatedViewOnly} onClick={() => setShowAddRevenueModal(true)} className="p-1 bg-emerald-200 rounded hover:bg-emerald-300 text-emerald-800 disabled:opacity-50"><Plus size={14}/></button></div>
                          <p className="text-xl font-bold text-emerald-900">{formatCurrency(moneyInTotal)} VNĐ</p>
                          <p className="text-xs text-emerald-600 mt-1">Gốc: {formatCurrency(rawActualRevenue)} - Chi PS: {formatCurrency(totalIncurredExpenses)}</p>
                      </div>

                      {/* Incurred Expenses Section */}
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                          <div className="flex justify-between items-center">
                              <p className="text-xs text-gray-700 font-bold uppercase">Chi phí phát sinh (Trừ DT)</p>
                              <button disabled={isDelegatedViewOnly} onClick={() => setShowIncurredExpenseModal(true)} className="p-1 bg-gray-200 rounded hover:bg-gray-300 text-gray-800 disabled:opacity-50"><Plus size={14}/></button>
                          </div>
                          <p className="text-lg font-bold text-gray-800">-{formatCurrency(totalIncurredExpenses)} VNĐ</p>
                          <p className="text-xs text-gray-500 italic mt-1">Không trừ vào quỹ nhóm.</p>
                      </div>
                      
                      {/* --- PENDING DEPOSIT SECTION --- */}
                      <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                          <p className="text-xs text-orange-700 font-bold uppercase flex justify-between">
                              <span>Đã nộp quỹ: {formatCurrency(totalDeposited)}</span>
                          </p>
                          <div className="flex justify-between items-end mt-1">
                              <div>
                                  <p className="text-[10px] text-orange-600 font-bold uppercase">Chưa vào quỹ</p>
                                  <p className="text-lg font-bold text-orange-800">{formatCurrency(pendingDeposit)} VNĐ</p>
                              </div>
                              <button onClick={() => { navigate('/finance'); }} className="px-2 py-1 bg-white border border-orange-200 text-orange-700 text-xs font-bold rounded hover:bg-orange-100 shadow-sm">Nộp ngay</button>
                          </div>
                      </div>

                      <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                          <p className="text-xs text-red-700 font-bold uppercase">Tổng chi phí (Đã duyệt)</p>
                          <p className="text-lg font-bold text-red-900">{formatCurrency(totalExpense)} VNĐ</p>
                          
                          {outstandingAdvance > 0 && (
                              <div className="mt-2 pt-2 border-t border-red-100 flex items-center justify-between">
                                  <div>
                                      <p className="text-[10px] text-red-600 font-bold uppercase">Nợ ứng cần hoàn trả</p>
                                      <p className="text-sm font-bold text-red-800">{formatCurrency(outstandingAdvance)} VNĐ</p>
                                  </div>
                                  
                                  {pendingRepaymentExists ? (
                                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded border border-yellow-200 animate-pulse">Đang chờ duyệt...</span>
                                  ) : (
                                      <button disabled={isDelegatedViewOnly} onClick={() => { setRepayForm({ amount: outstandingAdvance.toLocaleString('vi-VN'), reason: 'Nộp lại tiền ứng' }); setShowRepayModal(true); }} className="px-2 py-1 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 flex items-center gap-1 disabled:opacity-50">
                                          <Undo2 size={12}/> Nộp lại
                                      </button>
                                  )}
                              </div>
                          )}
                          
                          <div className="flex gap-2 mt-2">
                              <button disabled={isDelegatedViewOnly} onClick={() => { setExpenseForm({type: 'advance', amount: '', reason: ''}); setShowExpenseModal(true); }} className="flex-1 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 disabled:opacity-50">Yêu cầu Ứng</button>
                              <button disabled={isDelegatedViewOnly} onClick={() => { setExpenseForm({type: 'expense', amount: '', reason: ''}); setShowExpenseModal(true); }} className="flex-1 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 disabled:opacity-50">Yêu cầu Chi</button>
                          </div>
                      </div>
                      
                      <div className="pt-2 border-t border-green-50"><button disabled={isDelegatedViewOnly} onClick={() => setShowDealerDebtModal(true)} className="w-full py-2 bg-white border border-green-200 text-green-700 font-bold rounded-xl text-sm hover:bg-green-50 flex items-center justify-center gap-2 disabled:opacity-50"><Building2 size={16}/> Tạo khoản Đại lý nợ</button></div></div></div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-2 space-y-6">
            {showFinance && transactions.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="p-4 border-b bg-gray-50 flex items-center justify-between"><h3 className="font-bold text-gray-900">Lịch sử Tài chính</h3></div><div className="p-4 overflow-y-auto max-h-[300px] space-y-3">{transactions.map(t => (<div key={t.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-gray-50"><div className="flex items-center gap-3"><div className={`p-2 rounded-full ${['revenue','deposit','repayment'].includes(t.type) ? 'bg-green-100 text-green-600' : t.type === 'dealer_debt' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{['revenue','deposit','repayment'].includes(t.type) ? <BadgeDollarSign size={16}/> : t.type === 'dealer_debt' ? <Building2 size={16}/> : <Wallet size={16}/>}</div><div><p className="text-sm font-bold text-gray-900">{t.reason}</p><p className="text-xs text-gray-500">{t.type === 'dealer_debt' ? `Hạn thanh toán: ${t.target_date ? new Date(t.target_date).toLocaleDateString('vi-VN') : 'N/A'}` : `${new Date(t.created_at).toLocaleDateString('vi-VN')} • ${t.user_name}`}</p></div></div><div className="flex items-center gap-2"><div className="text-right"><p className={`font-bold text-sm ${['revenue','deposit','repayment'].includes(t.type) ? 'text-green-600' : t.type === 'dealer_debt' ? 'text-green-600' : t.type === 'incurred_expense' ? 'text-gray-600' : 'text-red-600'}`}>{['revenue','deposit','repayment'].includes(t.type) ? '+' : t.type === 'dealer_debt' ? '+' : '-'}{formatCurrency(t.amount)}</p><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === 'approved' ? 'bg-green-100 text-green-700' : t.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status === 'approved' ? 'Đã duyệt' : t.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}</span></div>{(isAdmin || isMod) && (<button onClick={() => setTransactionToDelete(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>)}
            {/* DEALER DEBT PAID BUTTON */}
            {t.type === 'dealer_debt' && !t.reason.includes('(Đã thu)') && (isAdmin || isMod) && (
                <button onClick={() => setDealerDebtToConfirm(t)} className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-bold rounded flex items-center gap-1 hover:bg-green-100 transition-colors ml-2" title="Đại lý đã chi tiền">
                    <Check size={12}/> Đại lý đã chi
                </button>
            )}
            </div></div>))}</div></div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Lịch sử chăm sóc</h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                        <span className="flex items-center gap-1"><Phone size={12}/> {callCount}</span>
                        <span className="w-px h-3 bg-gray-400"></span>
                        <span className="flex items-center gap-1"><MessageCircle size={12}/> {messageCount}</span>
                    </div>
                </div>
                {!isLost && !isDelegatedViewOnly && (<div className="p-4 border-b border-gray-100 bg-white"><div className="flex gap-4"><div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0"><UserIcon size={20} /></div><div className="flex-1"><textarea className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none resize-none bg-gray-50 text-gray-900 font-medium" rows={3} placeholder="Ghi chú..." value={newNote} onChange={(e) => setNewNote(e.target.value)}></textarea><div className="flex justify-end mt-2"><button onClick={() => handleAddNote('note')} disabled={!newNote.trim()} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black disabled:opacity-50 transition-colors"><Send size={14} /> Lưu</button></div></div></div></div>)}<div className="p-6 bg-gray-50 min-h-[400px] max-h-[600px] overflow-y-auto"><div className="space-y-6 relative before:absolute before:left-5 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">{interactions.map((item) => (<div key={item.id} className="relative pl-12 animate-fade-in"><div className={`absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-gray-50 flex items-center justify-center z-10 ${item.type === 'call' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{item.type === 'call' ? <Phone size={16} /> : <MessageCircle size={16} />}</div><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start mb-2"><span className="font-bold text-gray-900 text-sm">{item.type === 'call' ? 'Cuộc gọi đi' : item.type === 'zalo' ? 'Chat Zalo' : 'Ghi chú'}</span><span className="text-xs text-gray-500 font-medium">{new Date(item.created_at).toLocaleString('vi-VN')}</span></div><p className="text-gray-900 text-sm leading-relaxed">{item.content}</p></div></div>))}</div></div>
            </div>
        </div>
      </div>

      {/* ... Modals ... */}
      {showSuspendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Yêu cầu treo hồ sơ</h3>
                      <button onClick={() => setShowSuspendModal(false)}><X size={24} className="text-gray-400"/></button>
                  </div>
                  <textarea 
                      value={suspendReason} 
                      onChange={(e) => setSuspendReason(e.target.value)} 
                      className="w-full border border-gray-300 rounded-xl p-3 mb-4 outline-none focus:border-gray-500 h-24 resize-none" 
                      placeholder="Lý do treo hồ sơ (VD: Khách đi nước ngoài, chờ ngân hàng...)" 
                  />
                  <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg mb-4">
                      Hồ sơ sẽ chuyển sang trạng thái <strong>Treo</strong> và không tính vào doanh thu dự kiến trong tháng này.
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setShowSuspendModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl">Hủy</button>
                      <button onClick={confirmSuspend} className="flex-1 py-2 bg-gray-800 text-white font-bold rounded-xl">Xác nhận</button>
                  </div>
              </div>
          </div>
      )}

      {showChangeSalesModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Chuyển quyền chăm sóc</h3><button onClick={() => setShowChangeSalesModal(false)}><X size={24} className="text-gray-400"/></button></div><div className="space-y-2">{availableUsersToChange.map(emp => (<button key={emp.id} onClick={() => prepareChangeSales(emp)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left group"><div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 group-hover:bg-primary-100 group-hover:text-primary-700">{emp.full_name.charAt(0)}</div><div><p className="font-bold text-gray-900">{emp.full_name}</p><p className="text-xs text-gray-500 capitalize">{emp.role}</p></div></button>))}</div></div></div>)}
      {showDeleteConfirm && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"><div className="flex flex-col items-center text-center"><div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><Trash2 size={24} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Xóa khách hàng?</h3><p className="text-gray-500 text-sm mb-6">Hành động này không thể hoàn tác. Toàn bộ dữ liệu tương tác và giao dịch sẽ bị xóa.</p><div className="flex gap-3 w-full"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={executeDeleteCustomer} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors">Xóa vĩnh viễn</button></div></div></div></div>)}
      
      {/* ... SHARE MODAL ... */}
      {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Share2 className="text-teal-600"/> Chia sẻ Khách hàng</h3>
                      <button onClick={() => setShowShareModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  
                  {/* Share Form */}
                  <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 mb-4 space-y-3">
                      <div>
                          <label className="text-xs font-bold text-teal-800 uppercase mb-1 block">Người nhận (TVBH)</label>
                          <select className="w-full border border-teal-200 rounded-lg p-2 text-sm outline-none" value={shareForm.recipientId} onChange={e => setShareForm({...shareForm, recipientId: e.target.value})}>
                              <option value="">-- Chọn người nhận --</option>
                              {availableUsersToShare.map(u => (
                                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-teal-800 uppercase mb-1 block">Quyền hạn</label>
                          <div className="flex gap-2">
                              <select className="flex-1 border border-teal-200 rounded-lg p-2 text-sm outline-none" value={shareForm.permission} onChange={e => setShareForm({...shareForm, permission: e.target.value as any})}>
                                  <option value="view">Chỉ xem</option>
                                  <option value="edit">Được chỉnh sửa</option>
                              </select>
                              <button onClick={handleShareCustomer} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-teal-700 shadow-sm">Chia sẻ</button>
                          </div>
                      </div>
                  </div>

                  {/* Existing Shares List */}
                  <div>
                      <h4 className="font-bold text-gray-800 text-sm mb-2">Đang chia sẻ với:</h4>
                      {existingShares.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">Chưa chia sẻ với ai.</p>
                      ) : (
                          <div className="space-y-2">
                              {existingShares.map(share => (
                                  <div key={share.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                                      {revokeConfirmId === share.id ? (
                                          <div className="flex items-center justify-between w-full gap-2 animate-fade-in">
                                              <span className="text-xs font-bold text-red-600">Hủy quyền của {share.user_name}?</span>
                                              <div className="flex gap-1">
                                                  <button onClick={() => setRevokeConfirmId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-bold">Hủy</button>
                                                  <button onClick={() => executeRevokeShare(share.id, share.user_name)} className="px-2 py-1 bg-red-600 text-white text-xs rounded font-bold">Đồng ý</button>
                                              </div>
                                          </div>
                                      ) : (
                                          <>
                                              <div>
                                                  <p className="text-sm font-bold text-gray-800">{share.user_name}</p>
                                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${share.permission === 'edit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{share.permission === 'edit' ? 'Được sửa' : 'Chỉ xem'}</span>
                                              </div>
                                              <button onClick={() => setRevokeConfirmId(share.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                          </>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* WIN DEAL MODAL */}
      {showWinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CheckCircle2 className="text-green-600"/> Xác nhận Chốt Đơn</h3>
                      <button onClick={() => setShowWinModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Hình thức thanh toán <span className="text-red-500">*</span></label>
                              <select className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 bg-white" value={dealForm.payment_method} onChange={e => setDealForm({...dealForm, payment_method: e.target.value})}>
                                  <option value="Tiền mặt">Tiền mặt</option>
                                  <option value="Ngân hàng">Ngân hàng</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Loại biển số <span className="text-red-500">*</span></label>
                              <select className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 bg-white" value={dealForm.plate_type} onChange={e => setDealForm({...dealForm, plate_type: e.target.value})}>
                                  <option value="Biển trắng">Biển trắng</option>
                                  <option value="Biển vàng">Biển vàng</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Doanh thu dự kiến (VNĐ) <span className="text-red-500">*</span></label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 font-bold text-green-700" value={dealForm.revenue} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setDealForm({...dealForm, revenue: v ? Number(v).toLocaleString('vi-VN') : ''}); }} placeholder="500.000.000" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Đại lý xuất xe <span className="text-red-500">*</span></label>
                          <select className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 bg-white" value={dealForm.distributor} onChange={e => setDealForm({...dealForm, distributor: e.target.value})}>
                              <option value="">-- Chọn đại lý --</option>
                              {distributors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Tình trạng xe <span className="text-red-500">*</span></label>
                          <select className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 bg-white" value={dealForm.car_availability} onChange={e => setDealForm({...dealForm, car_availability: e.target.value})}>
                              <option value="Sẵn xe">Sẵn xe</option>
                              <option value="Đợi xe">Đợi xe</option>
                          </select>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                          <input type="checkbox" id="acc" checked={dealForm.has_accessories} onChange={e => setDealForm({...dealForm, has_accessories: e.target.checked})} className="w-5 h-5 text-green-600 rounded focus:ring-green-500"/>
                          <label htmlFor="acc" className="text-sm font-bold text-gray-700 cursor-pointer">Khách có làm phụ kiện?</label>
                      </div>
                      <button onClick={handleRequestWin} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 flex items-center justify-center gap-2 mt-2">
                          <CheckCircle2 size={18}/> Xác nhận Chốt
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- ADD REVENUE MODAL --- */}
      {showAddRevenueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Thêm Doanh thu Thực tế</h3>
                      <button onClick={() => setShowAddRevenueModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền (VNĐ)</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 font-bold" value={revenueForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setRevenueForm({...revenueForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500" value={revenueForm.note} onChange={e => setRevenueForm({...revenueForm, note: e.target.value})} placeholder="Đợt 2, Phụ kiện..." />
                      </div>
                      <button onClick={handleAddRevenue} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700">Xác nhận Thêm</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- INCURRED EXPENSE MODAL --- */}
      {showIncurredExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Chi phí Phát sinh (Đơn hàng)</h3>
                      <button onClick={() => setShowIncurredExpenseModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền (VNĐ)</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-red-500 font-bold" value={incurredExpenseForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setIncurredExpenseForm({...incurredExpenseForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Lý do chi</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-red-500" value={incurredExpenseForm.reason} onChange={e => setIncurredExpenseForm({...incurredExpenseForm, reason: e.target.value})} placeholder="Hoa hồng ngoài, phí..." />
                      </div>
                      <div className="text-xs bg-gray-50 p-2 rounded text-gray-500">
                          Khoản này sẽ được trừ vào <strong>Doanh thu thực tế</strong> của đơn hàng này, không ảnh hưởng quỹ nhóm chung.
                      </div>
                      <button onClick={handleAddIncurredExpense} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Xác nhận Chi</button>
                  </div>
              </div>
          </div>
      )}

      {showRepayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Hoàn ứng / Nộp tiền</h3>
                      <button onClick={() => setShowRepayModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền nộp (VNĐ)</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 font-bold" value={repayForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setRepayForm({...repayForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Nội dung</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 bg-gray-100" value={repayForm.reason} disabled />
                      </div>
                      <button onClick={handleRepayAdvance} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700">Gửi yêu cầu Nộp</button>
                  </div>
              </div>
          </div>
      )}

      {showDealerDebtModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Đại lý Nợ</h3>
                      <button onClick={() => setShowDealerDebtModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền (VNĐ)</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 font-bold" value={dealerDebtForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setDealerDebtForm({...dealerDebtForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Hạn thanh toán</label>
                          <input type="date" min={todayStr} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500" value={dealerDebtForm.targetDate} onChange={e => setDealerDebtForm({...dealerDebtForm, targetDate: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500" value={dealerDebtForm.reason} onChange={e => setDealerDebtForm({...dealerDebtForm, reason: e.target.value})} />
                      </div>
                      <button onClick={handleSubmitDealerDebt} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700">Xác nhận</button>
                  </div>
              </div>
          </div>
      )}

      {dealerDebtToConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-green-100">
                  <div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600"><CheckCircle2 size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Đại lý đã trả nợ?</h3><div className="bg-green-50 p-4 rounded-xl text-left w-full mb-4 border border-green-100 space-y-2"><div><p className="text-xs text-gray-500">Khoản nợ</p><p className="font-bold text-gray-900">{dealerDebtToConfirm.reason}</p></div><div><p className="text-xs text-gray-500">Số tiền</p><p className="font-bold text-green-600 text-lg">{formatCurrency(dealerDebtToConfirm.amount)} VNĐ</p></div></div><p className="text-xs text-gray-500 mb-4">Hành động này sẽ ghi nhận <strong>Doanh thu/Nộp tiền</strong> vào hệ thống.</p><div className="flex gap-3 w-full"><button onClick={() => setDealerDebtToConfirm(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={executeDealerDebtPaid} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-colors">Xác nhận</button></div></div>
              </div>
          </div>
      )}

    </div>
  );
};

export default CustomerDetail;


import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Customer, CustomerStatus, Interaction, CustomerClassification, DealDetails, UserProfile, UserRole, Distributor, DealStatus, CAR_MODELS, Transaction, TransactionType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, Phone, MapPin, Edit, MessageCircle, Send, User as UserIcon, CarFront, Calendar, Flame, Ban, CheckCircle2, ShieldCheck, Mail, RefreshCcw, ArrowRightLeft, X, Loader2, AlertTriangle, Database, Info, Copy, Terminal, ChevronDown, FileCheck2, Trash2, UserCheck, Hand, ChevronRight, ChevronLeft, Save, Plus, BadgeDollarSign, Wallet, Undo2, Building2, UserPlus, Keyboard, AlertOctagon, Check, Minus
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

  // Local Control States
  const [classification, setClassification] = useState<CustomerClassification>('Warm');
  const [recareDate, setRecareDate] = useState('');
  const [isSpecialCare, setIsSpecialCare] = useState(false);
  const [isLongTerm, setIsLongTerm] = useState(false);
  
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
  
  const [showChangeSalesModal, setShowChangeSalesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangeSalesConfirm, setShowChangeSalesConfirm] = useState<{rep: UserProfile, type: 'direct' | 'request'} | null>(null);
  
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  // Removed subtype from state
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
          let query = supabase.from('profiles').select('*').eq('status', 'active');
          if (!isAdmin) {
              if (isMod) {
                  query = query.or(`id.eq.${userProfile?.id},manager_id.eq.${userProfile?.id}`);
              } else {
                  if (userProfile?.manager_id) {
                      query = query.eq('manager_id', userProfile.manager_id);
                  } else {
                      query = query.eq('id', userProfile?.id);
                  }
              }
          }
          const { data } = await query;
          if (data) { setEmployees(data as UserProfile[]); }
      } catch (e) { console.error("Error fetching employees", e); } 
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
      if (!id || (!newNote.trim() && !customContent)) return;
      const content = customContent || newNote;
      try {
          const { data, error } = await supabase.from('interactions').insert([{ customer_id: id, user_id: userProfile?.id, type, content, created_at: new Date().toISOString() }]).select().single();
          if (error) throw error;
          setInteractions([data as Interaction, ...interactions]);
          if (!customContent) setNewNote('');
      } catch (e) { showToast("Lỗi lưu ghi chú", 'error'); }
  };

  const updateCustomerField = async (fields: Partial<Customer>) => {
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
          await updateCustomerField({ is_long_term: true, is_special_care: false, recare_date: null });
          handleAddNote('note', "Đã chuyển sang: Chăm sóc dài hạn");
      } else {
          await updateCustomerField({ is_long_term: false });
      }
  };

  const handleStopCare = async () => {
      if (!stopReason) { showToast("Vui lòng nhập lý do.", 'error'); return; }
      const newStatus = (isAdmin || isMod) ? CustomerStatus.LOST : CustomerStatus.LOST_PENDING;
      await updateCustomerField({ status: newStatus, stop_reason: stopReason });
      handleAddNote('note', `Ngưng chăm sóc: ${stopReason}`);
      setShowStopModal(false);
      showToast("Đã cập nhật trạng thái!");
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

  const executeDeleteCustomer = async () => {
      if (!id) return;
      try {
          await supabase.from('interactions').delete().eq('customer_id', id);
          await supabase.from('transactions').delete().eq('customer_id', id);
          
          const { error } = await supabase.from('customers').delete().eq('id', id);
          if (error) { throw new Error(error.message); }
          navigate('/customers');
      } catch (e: any) {
          showToast("Lỗi xóa: " + e.message, 'error');
          setShowDeleteConfirm(false);
      }
  };

  const handleDealAction = async (action: 'complete' | 'refund' | 'cancel' | 'reopen') => {
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
      const statusMap: any = {
          'complete': (isAdmin || isMod) ? 'completed' : 'completed_pending',
          'refund': (isAdmin || isMod) ? 'refunded' : 'refund_pending'
      };
      await updateCustomerField({ deal_status: statusMap[action] });
      showToast("Đã cập nhật trạng thái đơn hàng!");
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

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;
  if (!customer) return <div className="text-center p-8">Không tìm thấy khách hàng</div>;

  const isWon = customer.status === CustomerStatus.WON;
  const isPending = customer.status === CustomerStatus.WON_PENDING || customer.status === CustomerStatus.LOST_PENDING;
  const isLost = customer.status === CustomerStatus.LOST || customer.status === CustomerStatus.LOST_PENDING;
  const isCompleted = customer.deal_status === 'completed';
  const isRefunded = customer.deal_status === 'refunded';
  const hideCarePanel = isWon || isLost;
  
  // Updated showFinance Logic: Must be Won AND not finished AND MKT Source
  const showFinance = isWon && !isCompleted && !isRefunded && isMKTSource;

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
            <div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1><span className="px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide border bg-blue-100 text-blue-800 border-blue-200">{customer.status}</span></div>
            <div className="flex gap-2">
                {(isAdmin || isMod) && customer.pending_transfer_to && (
                    <div className="flex gap-2">
                        <button onClick={handleApproveTransfer} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 flex items-center gap-2 animate-pulse"><CheckCircle2 size={18}/> Duyệt Chuyển</button>
                        <button onClick={handleRejectTransfer} className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-lg shadow-sm hover:bg-red-200 flex items-center gap-2"><X size={18}/> Từ chối</button>
                    </div>
                )}
                {customer.status === CustomerStatus.NEW && !customer.is_acknowledged && (
                    <button onClick={handleAcknowledge} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 flex items-center gap-2 animate-bounce">
                        <UserCheck size={18}/> Tiếp nhận khách
                    </button>
                )}
                {isPending && (isAdmin || isMod) && (
                    <button onClick={handleApproveRequest} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 flex items-center gap-2"><CheckCircle2 size={18}/> Duyệt Yêu Cầu</button>
                )}
                {!isWon && !isLost && (
                    <button onClick={() => setShowChangeSalesModal(true)} className="px-3 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 flex items-center gap-2"><ArrowRightLeft size={16}/> Đổi Sales</button>
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
              <div className="bg-red-50 rounded-2xl p-6 shadow-sm border border-red-100 text-center animate-fade-in"><div className="flex justify-center mb-3"><Ban size={48} className="text-red-400" /></div><h3 className="font-bold text-red-700 text-lg mb-2">Khách hàng đang Ngưng Chăm Sóc</h3><p className="text-red-600 text-sm mb-4 italic">"{customer.stop_reason || 'Không có lý do'}"</p><button onClick={handleReopenCare} className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all flex items-center justify-center gap-2"><RefreshCcw size={18}/> Mở lại chăm sóc</button></div>
          )}
          {isWon && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-200 animate-fade-in"><h3 className="font-bold text-green-800 mb-4 flex items-center gap-2"><FileCheck2 size={20}/> Trạng thái đơn hàng</h3><div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center mb-4"><p className="text-xs text-green-600 font-bold uppercase mb-1">TÌNH TRẠNG HIỆN TẠI</p><p className="text-xl font-bold text-green-800">{isCompleted ? 'Đã hoàn thành' : isRefunded ? 'Đã trả cọc' : customer.deal_status === 'completed_pending' ? 'Chờ duyệt hoàn thành' : customer.deal_status === 'refund_pending' ? 'Chờ duyệt trả cọc' : 'Đang Xử Lý'}</p></div><div className="space-y-3"><button className="w-full py-2.5 bg-white border border-green-600 text-green-700 rounded-xl font-bold text-sm hover:bg-green-50 flex items-center justify-center gap-2"><FileCheck2 size={16}/> Quản lý Đơn hàng</button>{!isCompleted && !isRefunded && (<><button onClick={() => handleDealAction('complete')} className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Hoàn thành Đơn hàng</button><button onClick={() => handleDealAction('refund')} className="w-full py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-sm hover:bg-red-100 flex items-center justify-center gap-2"><RefreshCcw size={16}/> Yêu cầu trả cọc</button></>)}{isRefunded && (<button onClick={() => handleDealAction('reopen')} className="w-full py-2.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-xl font-bold text-sm hover:bg-orange-200 flex items-center justify-center gap-2"><RefreshCcw size={16}/> Mở xử lý lại</button>)}{(isAdmin || isMod) && (<button onClick={() => handleDealAction('cancel')} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 flex items-center justify-center gap-2"><RefreshCcw size={16}/> Hủy chốt / Mở lại CS</button>)}</div></div>
          )}
          {!hideCarePanel && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">Thao tác chăm sóc</h3>
                  <div className="mb-4">
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Mức độ tiềm năng</label>
                      <div className="flex bg-gray-100 p-1 rounded-xl">
                          {(['Hot', 'Warm', 'Cool'] as CustomerClassification[]).map((cls) => (
                              <button key={cls} onClick={() => handleClassificationChange(cls)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${classification === cls ? cls === 'Hot' ? 'bg-red-500 text-white shadow-md' : cls === 'Warm' ? 'bg-orange-500 text-white shadow-md' : 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>{cls}</button>
                          ))}
                      </div>
                  </div>
                  <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Flame size={16} className={isSpecialCare ? "text-red-500" : "text-gray-400"} /> CS Đặc biệt</span><div onClick={toggleSpecialCare} className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isSpecialCare ? 'bg-red-500' : 'bg-gray-300'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isSpecialCare ? 'translate-x-5' : ''}`}></div></div></div>
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Calendar size={16} className={isLongTerm ? "text-blue-500" : "text-gray-400"} /> CS Dài hạn</span><div onClick={toggleLongTerm} className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isLongTerm ? 'bg-blue-500' : 'bg-gray-300'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isLongTerm ? 'translate-x-5' : ''}`}></div></div></div>
                  </div>
                  {isSpecialCare ? (
                      <div className="mb-4 bg-white border border-red-200 rounded-xl p-4 shadow-sm animate-fade-in"><p className="text-xs font-bold text-gray-500 uppercase mb-1">TRẠNG THÁI ĐẶC BIỆT</p><div className="flex items-center gap-2 text-red-600 font-bold"><Flame size={18} className="fill-red-600 animate-pulse" /><span>Đang CS Đặc biệt</span></div><p className="text-gray-400 italic text-sm mt-1">Ngày chăm sóc tiếp theo bị ẩn.</p></div>
                  ) : (
                      <div className="mb-4">
                          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{isLongTerm ? 'Ngày CS Dài hạn' : 'Ngày chăm sóc tiếp theo'}</label>
                          <div className="relative"><input type="date" min={getMinDate()} max={getMaxDate()} value={recareDate} onChange={handleDateChange} className={`w-full border rounded-xl px-4 py-2.5 bg-white text-gray-900 font-bold focus:border-primary-500 outline-none ${isLongTerm ? 'border-blue-300 ring-2 ring-blue-50' : 'border-gray-300'}`} /></div>
                          {isLongTerm && <p className="text-xs text-blue-500 mt-1 italic">Chọn ngày xa nhất (Tối thiểu 10 ngày từ hôm nay).</p>}
                          {!isLongTerm && <p className="text-xs text-gray-400 mt-1 italic">Giới hạn chọn: Tối đa 4 ngày từ hôm nay.</p>}
                      </div>
                  )}
                  <div className="space-y-3"><button className="w-full py-2.5 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"><Mail size={16} /> Đặt lịch Lái thử</button><div className="grid grid-cols-2 gap-3"><button onClick={() => setShowStopModal(true)} className="py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-1"><Ban size={16} /> Ngưng CS</button><button onClick={() => setShowWinModal(true)} className="py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-1"><CheckCircle2 size={16} /> Chốt Deal</button></div></div>
              </div>
          )}
          {/* ... Customer Info & Finance Panels ... */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative">
            <h3 className="font-bold text-gray-900 mb-4 border-b pb-2 flex justify-between items-center">Thông tin khách hàng{!isEditingInfo && !isWon && !isLost && (<button onClick={() => setIsEditingInfo(true)} className="text-primary-600 hover:text-primary-700 text-xs flex items-center gap-1 font-bold"><Edit size={14} /> Sửa</button>)}</h3>
            {isEditingInfo && !isWon && !isLost ? (<div className="space-y-3 animate-fade-in"><input value={editForm.phone} disabled className="w-full border rounded px-2 py-1 text-sm font-bold bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200" /><input value={editForm.secondary_phone} onChange={e => setEditForm({...editForm, secondary_phone: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold bg-white text-gray-900 outline-none" placeholder="Nhập thêm số..." /><select value={editForm.interest} onChange={e => setEditForm({...editForm, interest: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold bg-white text-gray-900 outline-none">{CAR_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select><input value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})} disabled={editForm.source.includes('MKT Group')} className={`w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold outline-none ${editForm.source.includes('MKT Group') ? 'bg-gray-100' : 'bg-white'}`} /><input value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-bold bg-white text-gray-900 outline-none" placeholder="Nhập địa chỉ..." /><div className="flex gap-2 pt-2"><button onClick={() => setIsEditingInfo(false)} className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">Hủy</button><button onClick={handleSaveInfo} className="flex-1 py-1.5 bg-primary-600 text-white text-xs font-bold rounded flex items-center justify-center gap-1"><Save size={14}/> Lưu</button></div></div>) : (<div className="space-y-4 text-sm"><div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Điện thoại</span><span className="font-bold text-gray-900">{customer.phone}</span></div>{customer.secondary_phone && <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">SĐT Phụ</span><span className="font-bold text-gray-900">{customer.secondary_phone}</span></div>}
            <div className="flex gap-2 mb-2">
                <a href={`tel:${customer.phone}`} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors">
                    <Phone size={14} /> Gọi điện
                </a>
                <a href={`https://zalo.me/${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors">
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
                          <div className="flex justify-between items-center"><p className="text-xs text-emerald-700 font-bold uppercase">Doanh thu thực tế (Tổng)</p><button onClick={() => setShowAddRevenueModal(true)} className="p-1 bg-emerald-200 rounded hover:bg-emerald-300 text-emerald-800"><Plus size={14}/></button></div>
                          <p className="text-xl font-bold text-emerald-900">{formatCurrency(moneyInTotal)} VNĐ</p>
                          <p className="text-xs text-emerald-600 mt-1">Gốc: {formatCurrency(rawActualRevenue)} - Chi PS: {formatCurrency(totalIncurredExpenses)}</p>
                      </div>

                      {/* Incurred Expenses Section */}
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                          <div className="flex justify-between items-center">
                              <p className="text-xs text-gray-700 font-bold uppercase">Chi phí phát sinh (Trừ DT)</p>
                              <button onClick={() => setShowIncurredExpenseModal(true)} className="p-1 bg-gray-200 rounded hover:bg-gray-300 text-gray-800"><Plus size={14}/></button>
                          </div>
                          <p className="text-lg font-bold text-gray-800">-{formatCurrency(totalIncurredExpenses)} VNĐ</p>
                          <p className="text-[10px] text-gray-500 italic mt-1">Không trừ vào quỹ nhóm.</p>
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
                                      <button onClick={() => { setRepayForm({ amount: outstandingAdvance.toLocaleString('vi-VN'), reason: 'Nộp lại tiền ứng' }); setShowRepayModal(true); }} className="px-2 py-1 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 flex items-center gap-1">
                                          <Undo2 size={12}/> Nộp lại
                                      </button>
                                  )}
                              </div>
                          )}
                          
                          <div className="flex gap-2 mt-2">
                              <button onClick={() => { setExpenseForm({type: 'advance', amount: '', reason: ''}); setShowExpenseModal(true); }} className="flex-1 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50">Yêu cầu Ứng</button>
                              <button onClick={() => { setExpenseForm({type: 'expense', amount: '', reason: ''}); setShowExpenseModal(true); }} className="flex-1 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50">Yêu cầu Chi</button>
                          </div>
                      </div>
                      
                      <div className="pt-2 border-t border-green-50"><button onClick={() => setShowDealerDebtModal(true)} className="w-full py-2 bg-white border border-green-200 text-green-700 font-bold rounded-xl text-sm hover:bg-green-50 flex items-center justify-center gap-2"><Building2 size={16}/> Tạo khoản Đại lý nợ</button></div></div></div>
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
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between"><h3 className="font-bold text-gray-900">Lịch sử chăm sóc</h3></div>
                {!isLost && (<div className="p-4 border-b border-gray-100 bg-white"><div className="flex gap-4"><div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0"><UserIcon size={20} /></div><div className="flex-1"><textarea className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none resize-none bg-gray-50 text-gray-900 font-medium" rows={3} placeholder="Ghi chú..." value={newNote} onChange={(e) => setNewNote(e.target.value)}></textarea><div className="flex justify-end mt-2"><button onClick={() => handleAddNote('note')} disabled={!newNote.trim()} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black disabled:opacity-50 transition-colors"><Send size={14} /> Lưu</button></div></div></div></div>)}<div className="p-6 bg-gray-50 min-h-[400px] max-h-[600px] overflow-y-auto"><div className="space-y-6 relative before:absolute before:left-5 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">{interactions.map((item) => (<div key={item.id} className="relative pl-12 animate-fade-in"><div className={`absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-gray-50 flex items-center justify-center z-10 ${item.type === 'call' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{item.type === 'call' ? <Phone size={16} /> : <MessageCircle size={16} />}</div><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start mb-2"><span className="font-bold text-gray-900 text-sm">{item.type === 'call' ? 'Cuộc gọi đi' : 'Ghi chú'}</span><span className="text-xs text-gray-500 font-medium">{new Date(item.created_at).toLocaleString('vi-VN')}</span></div><p className="text-gray-900 text-sm leading-relaxed">{item.content}</p></div></div>))}</div></div>
            </div>
        </div>
      </div>

      {/* ... Modals ... */}
      {showChangeSalesModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Chuyển quyền chăm sóc</h3><button onClick={() => setShowChangeSalesModal(false)}><X size={24} className="text-gray-400"/></button></div><div className="space-y-2">{employees.map(emp => (<button key={emp.id} onClick={() => prepareChangeSales(emp)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left group"><div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 group-hover:bg-primary-100 group-hover:text-primary-700">{emp.full_name.charAt(0)}</div><div><p className="font-bold text-gray-900">{emp.full_name}</p><p className="text-xs text-gray-500 capitalize">{emp.role}</p></div></button>))}</div></div></div>)}
      {showDeleteConfirm && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"><div className="flex flex-col items-center text-center"><div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3"><Trash2 size={24}/></div><h3 className="text-lg font-bold text-gray-900 mb-2">Xóa khách hàng?</h3><p className="text-sm text-gray-500 mb-6">Hành động này sẽ xóa vĩnh viễn toàn bộ lịch sử chăm sóc và giao dịch. Không thể hoàn tác.</p><div className="flex gap-3 w-full"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button><button onClick={executeDeleteCustomer} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200">Xóa ngay</button></div></div></div></div>)}
      {showChangeSalesConfirm && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"><div className="flex flex-col items-center text-center"><div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3"><UserPlus size={24}/></div><h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận chuyển quyền</h3><p className="text-sm text-gray-500 mb-4">Bạn có chắc chắn muốn {showChangeSalesConfirm.type === 'direct' ? 'chuyển ngay' : 'gửi yêu cầu chuyển'} khách hàng này sang <strong>{showChangeSalesConfirm.rep.full_name}</strong>?</p><div className="flex gap-3 w-full"><button onClick={() => setShowChangeSalesConfirm(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button><button onClick={executeChangeSales} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200">{showChangeSalesConfirm.type === 'direct' ? 'Chuyển ngay' : 'Gửi yêu cầu'}</button></div></div></div></div>)}
      
      {showExpenseModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"><h3 className="text-lg font-bold text-red-700">{expenseForm.type === 'advance' ? 'Yêu cầu Ứng tiền' : 'Yêu cầu Chi tiền'}</h3><div><label className="text-sm font-bold text-gray-600">Số tiền (VNĐ)</label><input type="text" value={expenseForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setExpenseForm({...expenseForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" /></div><div><label className="text-sm font-bold text-gray-600">Lý do chi</label><input type="text" value={expenseForm.reason} onChange={e => setExpenseForm({...expenseForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" placeholder={expenseForm.type === 'advance' ? "VD: Ứng đi đăng ký xe" : "VD: Mua hoa tặng khách"} /></div><div className="flex justify-end gap-2"><button onClick={() => setShowExpenseModal(false)} className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-bold">Hủy</button><button onClick={handleRequestExpense} className="px-3 py-2 bg-red-600 text-white rounded-lg font-bold">Gửi yêu cầu</button></div></div></div>)}
      
      {showDealerDebtModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"><h3 className="text-lg font-bold text-orange-700">Tạo khoản Đại lý nợ</h3><div><label className="text-sm font-bold text-gray-600">Số tiền nợ (VNĐ)</label><input type="text" value={dealerDebtForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setDealerDebtForm({...dealerDebtForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" /></div><div><label className="text-sm font-bold text-gray-600">Dự kiến thu</label><input type="date" value={dealerDebtForm.targetDate} onChange={e => setDealerDebtForm({...dealerDebtForm, targetDate: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" /></div><div><label className="text-sm font-bold text-gray-600">Ghi chú</label><input type="text" value={dealerDebtForm.reason} onChange={e => setDealerDebtForm({...dealerDebtForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" /></div><div className="flex justify-end gap-2"><button onClick={() => setShowDealerDebtModal(false)} className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-bold">Hủy</button><button onClick={handleSubmitDealerDebt} className="px-3 py-2 bg-orange-600 text-white rounded-lg font-bold">Tạo khoản nợ</button></div></div></div>)}
      {showStopModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><h3 className="text-lg font-bold text-gray-900 mb-4">Ngưng chăm sóc</h3><textarea value={stopReason} onChange={(e) => setStopReason(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 mb-4 outline-none focus:border-red-500" placeholder="Lý do (VD: Khách đã mua xe hãng khác...)" rows={3}></textarea><div className="flex gap-2"><button onClick={() => setShowStopModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl">Hủy</button><button onClick={handleStopCare} className="flex-1 py-2 bg-red-600 text-white font-bold rounded-xl">Xác nhận</button></div></div></div>)}
      
      {showWinModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Xác nhận Chốt Deal</h3><button onClick={() => setShowWinModal(false)}><X size={24} className="text-gray-400"/></button></div><div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Doanh thu dự kiến (VNĐ) <span className="text-red-500">*</span></label><input type="text" value={dealForm.revenue} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setDealForm({...dealForm, revenue: v ? Number(v).toLocaleString('vi-VN') : ''}); }} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none font-bold" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Đại lý phân phối <span className="text-red-500">*</span></label><select value={dealForm.distributor} onChange={(e) => setDealForm({...dealForm, distributor: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none appearance-none bg-white"><option value="">-- Chọn đại lý --</option>{distributors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Hình thức <span className="text-red-500">*</span></label><select value={dealForm.payment_method} onChange={(e) => setDealForm({...dealForm, payment_method: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none appearance-none bg-white"><option value="Tiền mặt">Tiền mặt</option><option value="Ngân hàng">Ngân hàng</option></select></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Biển số <span className="text-red-500">*</span></label><select value={dealForm.plate_type} onChange={(e) => setDealForm({...dealForm, plate_type: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none appearance-none bg-white"><option value="Biển trắng">Biển trắng</option><option value="Biển vàng">Biển vàng</option></select></div></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Tình trạng xe <span className="text-red-500">*</span></label><select value={dealForm.car_availability} onChange={(e) => setDealForm({...dealForm, car_availability: e.target.value as any})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none appearance-none bg-white"><option value="Sẵn xe">Sẵn xe</option><option value="Đợi xe">Đợi xe</option></select></div><div className="flex items-center gap-2 pt-2"><input type="checkbox" checked={dealForm.has_accessories} onChange={(e) => setDealForm({...dealForm, has_accessories: e.target.checked})} className="w-5 h-5 text-primary-600 rounded" /><label className="text-sm font-bold text-gray-700">Có làm phụ kiện</label></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú thêm</label><textarea value={dealForm.notes} onChange={(e) => setDealForm({...dealForm, notes: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none h-20 resize-none"></textarea></div><button onClick={handleRequestWin} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg mt-2">Xác nhận Chốt</button></div></div></div>)}
      
      {showAddRevenueModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"><h3 className="text-lg font-bold text-green-700">Thêm doanh thu thực tế</h3><div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-xs">Lưu ý: Doanh thu này chỉ cập nhật số liệu hiển thị, KHÔNG tạo lịch sử giao dịch.</div><div><label className="text-sm font-bold text-gray-600">Số tiền (VNĐ)</label><input type="text" value={revenueForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setRevenueForm({...revenueForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" /></div><div><label className="text-sm font-bold text-gray-600">Ghi chú</label><input type="text" value={revenueForm.note} onChange={e => setRevenueForm({...revenueForm, note: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" placeholder="VD: Lắp thêm phụ kiện" /></div><div className="flex justify-end gap-2"><button onClick={() => setShowAddRevenueModal(false)} className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-bold">Hủy</button><button onClick={handleAddRevenue} className="px-3 py-2 bg-green-600 text-white rounded-lg font-bold">Thêm</button></div></div></div>)}
      
      {/* Incurred Expense Modal */}
      {showIncurredExpenseModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"><h3 className="text-lg font-bold text-gray-800">Thêm chi phí phát sinh</h3><div className="bg-yellow-50 text-yellow-800 p-2 rounded text-xs">Khoản này sẽ trừ trực tiếp vào <strong>Doanh thu thực tế</strong> của đơn hàng, không ảnh hưởng đến Quỹ nhóm.</div><div><label className="text-sm font-bold text-gray-600">Số tiền (VNĐ)</label><input type="text" value={incurredExpenseForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setIncurredExpenseForm({...incurredExpenseForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" /></div><div><label className="text-sm font-bold text-gray-600">Nội dung</label><input type="text" value={incurredExpenseForm.reason} onChange={e => setIncurredExpenseForm({...incurredExpenseForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" /></div><div className="flex justify-end gap-2"><button onClick={() => setShowIncurredExpenseModal(false)} className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-bold">Hủy</button><button onClick={handleAddIncurredExpense} className="px-3 py-2 bg-gray-800 text-white rounded-lg font-bold">Lưu</button></div></div></div>)}

      {showRepayModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"><h3 className="text-lg font-bold text-green-700">Nộp lại tiền ứng</h3><div><label className="text-sm font-bold text-gray-600">Số tiền hoàn trả (VNĐ)</label><input type="text" value={repayForm.amount} disabled className="w-full border border-gray-200 bg-gray-100 p-2 rounded-lg outline-none text-gray-500 font-bold cursor-not-allowed" /></div><div><label className="text-sm font-bold text-gray-600">Lý do/Nguồn tiền</label><input type="text" value={repayForm.reason} onChange={e => setRepayForm({...repayForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" /></div><div className="flex justify-end gap-2"><button onClick={() => setShowRepayModal(false)} className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-bold">Hủy</button><button onClick={handleRepayAdvance} className="px-3 py-2 bg-green-600 text-white rounded-lg font-bold">Gửi yêu cầu</button></div></div></div>)}
      
      {transactionToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-red-100">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa giao dịch?</h3>
                      <p className="text-sm text-gray-500 mb-4">
                          Bạn có chắc chắn muốn xóa giao dịch này khỏi hồ sơ khách hàng?
                      </p>
                      
                      <div className="w-full bg-red-50 rounded-xl p-4 border border-red-100 mb-6 text-left space-y-2">
                          <div className="flex justify-between items-center border-b border-red-200 pb-2">
                              <span className="text-xs font-bold text-red-500 uppercase">Thông tin xóa</span>
                          </div>
                          <div>
                              <p className="text-xs text-gray-500">Nội dung</p>
                              <p className="font-bold text-gray-900">{transactionToDelete.reason}</p>
                          </div>
                          <div>
                              <p className="text-xs text-gray-500">Số tiền</p>
                              <p className="font-bold text-red-600 text-lg">{formatCurrency(transactionToDelete.amount)} VNĐ</p>
                          </div>
                      </div>

                      <div className="flex gap-3 w-full">
                          <button 
                              onClick={() => setTransactionToDelete(null)}
                              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                          >
                              Hủy bỏ
                          </button>
                          <button 
                              onClick={confirmDeleteTransaction}
                              className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                          >
                              Xóa ngay
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {dealerDebtToConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-green-100">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                          <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Đại lý đã chi tiền?</h3>
                      <p className="text-sm text-gray-500 mb-4">
                          Bạn xác nhận đại lý đã chi trả khoản nợ này? <br/>
                          Tiền sẽ được cộng vào quỹ nhóm.
                      </p>
                      
                      <div className="w-full bg-green-50 rounded-xl p-4 border border-green-100 mb-6 text-left space-y-2">
                          <div>
                              <p className="text-xs text-gray-500">Nội dung</p>
                              <p className="font-bold text-gray-900">{dealerDebtToConfirm.reason}</p>
                          </div>
                          <div>
                              <p className="text-xs text-gray-500">Số tiền cộng quỹ</p>
                              <p className="font-bold text-green-600 text-lg">+{formatCurrency(dealerDebtToConfirm.amount)} VNĐ</p>
                          </div>
                      </div>

                      <div className="flex gap-3 w-full">
                          <button 
                              onClick={() => setDealerDebtToConfirm(null)}
                              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                          >
                              Hủy bỏ
                          </button>
                          <button 
                              onClick={executeDealerDebtPaid}
                              className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-colors"
                          >
                              Xác nhận
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CustomerDetail;

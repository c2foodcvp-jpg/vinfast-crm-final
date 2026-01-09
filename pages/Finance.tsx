
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, UserProfile, Customer, CustomerStatus, TransactionType, ProfitExclusion } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  PiggyBank, Plus, CheckCircle2, AlertOctagon, History, User, Filter, 
  Loader2, X, Wallet, BellRing, ArrowUpRight, ArrowDownLeft, Terminal, 
  Copy, Database, Trash2, Check, XCircle, AlertTriangle, Calendar, 
  BadgeDollarSign, Settings2, Undo2, ExternalLink, Building2, QrCode,
  Percent,
  MinusCircle,
  Gift
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, BarChart, Bar, CartesianGrid, XAxis, YAxis, Legend } from 'recharts';

interface ExtendedTransaction extends Transaction {
    _source?: string;
    _is_part_time_creator?: boolean;
}

interface ProfitShareRow {
    user: UserProfile;
    kpiTarget: number;
    kpiActual: number;
    missedKpi: number;
    penaltyPercent: number; 
    baseShareRatio: number; 
    finalShareRatio: number; 
    personalNetPool: number; 
    estimatedIncome: number;
    excludedCustomerIds: string[];
    redistributedIncome: number;
    personalAdvanceDeduction: number; 
    personalBonus: number; 
}

const Finance: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [profitExclusions, setProfitExclusions] = useState<ProfitExclusion[]>([]);
  
  // Filter States
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [filterMode, setFilterMode] = useState<'creation' | 'deal'>('creation');

  // Modals & Forms
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '' });
  
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ customerId: '', amount: '', reason: '' });
  
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', reason: '' });

  // Missing Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', reason: '' });
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [newQrUrl, setNewQrUrl] = useState('');
  const [isSavingQr, setIsSavingQr] = useState(false);

  // Exclusion Modal
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [targetUserForExclusion, setTargetUserForExclusion] = useState<UserProfile | null>(null);
  
  // Ratio Edit
  const [editingRatioId, setEditingRatioId] = useState<string | null>(null);
  const [tempRatio, setTempRatio] = useState<string>('');

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [transactionToDelete, setTransactionToDelete] = useState<ExtendedTransaction | null>(null);
  const [advanceToRepay, setAdvanceToRepay] = useState<ExtendedTransaction | null>(null);
  const [dealerDebtToConfirm, setDealerDebtToConfirm] = useState<Transaction | null>(null);

  // Added missing states
  const [showDealerDebtModal, setShowDealerDebtModal] = useState(false);
  const [dealerDebtForm, setDealerDebtForm] = useState({ amount: '', targetDate: '', reason: 'Đại lý nợ tiền' });
  const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [showSql, setShowSql] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (userProfile) {
        fetchDataWithIsolation();
    }
  }, [userProfile]);

  useEffect(() => {
      if (toast) {
          const t = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(t);
      }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  const fetchDataWithIsolation = async () => {
      try {
          setLoading(true);
          const { data: configData } = await supabase.from('app_settings').select('value').eq('key', 'qr_code_url').maybeSingle();
          if (configData) setQrCodeUrl(configData.value);

          const { data: profiles } = await supabase.from('profiles').select('*');
          if (profiles) setAllProfiles(profiles as UserProfile[]);

          const { data: customers } = await supabase.from('customers').select('*');
          const custList = (customers as Customer[]) || [];
          setAllCustomers(custList);

          const { data: trans } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
          let transList = (trans as Transaction[]) || [];

          const { data: exclusions } = await supabase.from('profit_exclusions').select('*');
          if (exclusions) setProfitExclusions(exclusions as ProfitExclusion[]);

          const extendedTrans: ExtendedTransaction[] = transList.map(t => {
              const customer = t.customer_id ? custList.find(c => c.id === t.customer_id) : null;
              const creator = profiles?.find(p => p.id === t.user_id);
              return {
                  ...t,
                  _source: customer?.source,
                  _is_part_time_creator: creator?.is_part_time
              };
          });

          setTransactions(extendedTrans);

      } catch (e: any) {
          console.error("Error fetching data", e);
          showToast("Lỗi tải dữ liệu", 'error');
      } finally {
          setLoading(false);
      }
  };

  // ... (Keep submission handlers: Deposit, Adjustment, QR, Advance, Repay, Delete, Reset ...)
  const handleSubmitDeposit = async () => {
      const amount = Number(depositForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0 || !depositForm.customerId) { showToast("Vui lòng nhập đủ thông tin", 'error'); return; }
      try {
          const cust = allCustomers.find(c => c.id === depositForm.customerId);
          const { error } = await supabase.from('transactions').insert([{
              customer_id: depositForm.customerId, customer_name: cust?.name, user_id: userProfile?.id, user_name: userProfile?.full_name,
              type: 'deposit', amount: amount, reason: depositForm.reason || 'Nộp quỹ', status: (isAdmin || isMod) ? 'approved' : 'pending', approved_by: (isAdmin || isMod) ? userProfile?.id : null
          }]);
          if (error) throw error;
          setShowDepositModal(false); setDepositForm({ customerId: '', amount: '', reason: '' }); fetchDataWithIsolation(); showToast("Đã nộp quỹ!", 'success');
      } catch (e: any) { showToast("Lỗi nộp quỹ: " + e.message, 'error'); }
  };

  const handleSubmitAdjustment = async () => {
      const amount = Number(adjustmentForm.amount.replace(/\./g, ''));
      if (!amount || !adjustmentForm.reason) return;
      try {
          const { error } = await supabase.from('transactions').insert([{
              user_id: userProfile?.id, user_name: userProfile?.full_name, type: 'adjustment', amount: amount, reason: adjustmentForm.reason, status: 'approved', approved_by: userProfile?.id
          }]);
          if (error) throw error;
          setShowAdjustmentModal(false); setAdjustmentForm({ amount: '', reason: '' }); fetchDataWithIsolation(); showToast("Đã điều chỉnh quỹ!", 'success');
      } catch (e: any) { showToast("Lỗi điều chỉnh: " + e.message, 'error'); }
  };

  const handleSaveQr = async () => {
      setIsSavingQr(true);
      try { await supabase.from('app_settings').upsert({ key: 'qr_code_url', value: newQrUrl }); setQrCodeUrl(newQrUrl); setShowConfigModal(false); showToast("Đã lưu QR Code!", 'success'); } catch (e) { showToast("Lỗi lưu QR.", 'error'); } finally { setIsSavingQr(false); }
  };

  const handleApprove = async (t: Transaction, approve: boolean) => {
      try { await supabase.from('transactions').update({ status: approve ? 'approved' : 'rejected', approved_by: userProfile?.id }).eq('id', t.id); fetchDataWithIsolation(); showToast(approve ? "Đã duyệt!" : "Đã từ chối!", 'success'); } catch (e) { showToast("Lỗi xử lý.", 'error'); }
  };

  const confirmDeleteTransaction = async () => {
      if (!transactionToDelete) return;
      try { await supabase.from('transactions').delete().eq('id', transactionToDelete.id); setTransactionToDelete(null); fetchDataWithIsolation(); showToast("Đã xóa giao dịch!", 'success'); } catch (e) { showToast("Lỗi xóa.", 'error'); }
  };

  const executeResetFinance = async () => {
      setIsResetting(true);
      try {
          const { error: tError } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
          if (tError) throw tError;
          const { error: fError } = await supabase.from('team_fines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (fError) throw fError;
          const { error: eError } = await supabase.from('team_fund_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (eError) throw eError;
          const { error: cError } = await supabase.from('customers').update({ deal_details: null, deal_status: null }).neq('id', '00000000-0000-0000-0000-000000000000');
          setShowResetConfirm(false); fetchDataWithIsolation(); showToast("Đã RESET toàn bộ dữ liệu tài chính!", 'success');
      } catch (e: any) { showToast("Lỗi Reset: " + e.message, 'error'); } finally { setIsResetting(false); }
  };

  const handleSubmitAdvance = async () => {
      const amount = Number(advanceForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0 || !advanceForm.reason.trim()) { showToast("Vui lòng nhập đủ thông tin", 'error'); return; }
      const status = (isAdmin || isMod) ? 'approved' : 'pending';
      try {
          const { error } = await supabase.from('transactions').insert([{
              user_id: userProfile?.id, user_name: userProfile?.full_name, 
              type: 'advance',
              amount: amount, 
              reason: `Ứng tiền: ${advanceForm.reason}`, 
              status: status, 
              approved_by: status === 'approved' ? userProfile?.id : null
          }]);
          if (error) throw error;
          setShowAdvanceModal(false); setAdvanceForm({ amount: '', reason: '' }); fetchDataWithIsolation(); showToast(status === 'approved' ? "Đã duyệt Ứng tiền" : "Đã gửi yêu cầu Ứng tiền!", 'success');
      } catch (e: any) { showToast("Lỗi: " + e.message, 'error'); }
  };

  // NEW: Handle Expense (Chi tiền không hoàn lại)
  const handleSubmitExpense = async () => {
      const amount = Number(expenseForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0 || !expenseForm.reason.trim()) { showToast("Vui lòng nhập đủ thông tin", 'error'); return; }
      const status = (isAdmin || isMod) ? 'approved' : 'pending';
      try {
          const { error } = await supabase.from('transactions').insert([{
              user_id: userProfile?.id, user_name: userProfile?.full_name, 
              type: 'expense',
              amount: amount, 
              reason: `Chi quỹ: ${expenseForm.reason}`, 
              status: status, 
              approved_by: status === 'approved' ? userProfile?.id : null
          }]);
          if (error) throw error;
          setShowExpenseModal(false); setExpenseForm({ amount: '', reason: '' }); fetchDataWithIsolation(); showToast(status === 'approved' ? "Đã duyệt Chi tiền" : "Đã gửi yêu cầu Chi!", 'success');
      } catch (e: any) { showToast("Lỗi: " + e.message, 'error'); }
  };

  const handleManualRepay = async () => {
      if (!advanceToRepay) return;
      try {
          const { error: repayError } = await supabase.from('transactions').insert([{
              user_id: advanceToRepay.user_id, user_name: advanceToRepay.user_name, type: 'repayment', amount: advanceToRepay.amount, reason: `Hoàn ứng (Thu tiền mặt): ${advanceToRepay.reason} [Ref:${advanceToRepay.id}]`, status: 'approved', approved_by: userProfile?.id
          }]);
          if (repayError) throw repayError;
          await supabase.from('transactions').update({ reason: `${advanceToRepay.reason} (Đã trả)` }).eq('id', advanceToRepay.id);
          fetchDataWithIsolation(); setAdvanceToRepay(null); showToast("Đã xác nhận thu hồi tiền tạm ứng!", 'success');
      } catch (e: any) { showToast("Lỗi: " + e.message, 'error'); }
  };

  const handleSubmitDealerDebt = async () => {
      const amount = Number(dealerDebtForm.amount.replace(/\./g, ''));
      if (!amount || amount <= 0 || !dealerDebtForm.targetDate) { showToast("Vui lòng nhập đủ thông tin", 'error'); return; }
      try {
          const { data, error } = await supabase.from('transactions').insert([{
              customer_id: null, customer_name: null, user_id: userProfile?.id, user_name: userProfile?.full_name,
              type: 'dealer_debt', target_date: dealerDebtForm.targetDate, amount: amount, reason: dealerDebtForm.reason, status: 'approved'
          }]).select().single();
          if (error) throw error;
          setTransactions(prev => [data as Transaction, ...prev]);
          setShowDealerDebtModal(false);
          setDealerDebtForm({ amount: '', targetDate: '', reason: 'Đại lý nợ tiền' });
          showToast("Đã tạo khoản nợ!");
      } catch (e) { showToast("Lỗi tạo khoản nợ", 'error'); }
  };

  const executeDealerDebtPaid = async () => {
      if (!dealerDebtToConfirm) return;
      try {
          const { data, error } = await supabase.from('transactions').insert([{
              customer_id: null, customer_name: null, user_id: userProfile?.id, user_name: userProfile?.full_name,
              type: 'deposit', amount: dealerDebtToConfirm.amount, reason: `Thu nợ đại lý: ${dealerDebtToConfirm.reason}`, status: 'approved', approved_by: userProfile?.id
          }]).select().single();
          if (error) throw error;
          await supabase.from('transactions').update({ reason: `${dealerDebtToConfirm.reason} (Đã thu)` }).eq('id', dealerDebtToConfirm.id);
          setTransactions(prev => [data as Transaction, ...prev.map(t => t.id === dealerDebtToConfirm.id ? {...t, reason: `${t.reason} (Đã thu)`} : t)]);
          showToast("Đã thu nợ thành công!");
      } catch (e: any) { showToast("Lỗi: " + (e.message || "Unknown"), 'error'); } finally { setDealerDebtToConfirm(null); }
  };

  // --- PROFIT SHARING HANDLERS ---
  const handleUpdateRatio = async (userId: string) => {
      const ratio = parseFloat(tempRatio);
      if (isNaN(ratio) || ratio < 0 || ratio > 100) { showToast("Tỉ lệ không hợp lệ", 'error'); return; }
      try {
          await supabase.from('profiles').update({ profit_share_ratio: ratio }).eq('id', userId);
          setEditingRatioId(null);
          fetchDataWithIsolation();
          showToast("Đã cập nhật tỉ lệ!");
      } catch (e) { showToast("Lỗi cập nhật", 'error'); }
  };

  const handleToggleExclusion = async (customerId: string) => {
      if (!targetUserForExclusion) return;
      try {
          const exists = profitExclusions.find(ex => ex.user_id === targetUserForExclusion.id && ex.customer_id === customerId);
          if (exists) {
              await supabase.from('profit_exclusions').delete().eq('id', exists.id);
          } else {
              await supabase.from('profit_exclusions').insert([{ user_id: targetUserForExclusion.id, customer_id: customerId }]);
          }
          fetchDataWithIsolation(); 
      } catch (e) { console.error(e); }
  };

  // --- LOGIC ---
  const isMKT = (src?: string) => src === 'MKT Group';
  
  const isInMonthYear = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  };

  const filteredTransactions = useMemo(() => {
      return transactions.filter(t => {
          if (!isInMonthYear(t.created_at)) return false;
          if (isAdmin) {
              if (selectedTeam !== 'all') {
                  const transUser = allProfiles.find(p => p.id === t.user_id);
                  if (transUser?.manager_id !== selectedTeam && transUser?.id !== selectedTeam) return false;
              }
          } else if (isMod) {
              const transUser = allProfiles.find(p => p.id === t.user_id);
              const isSelf = t.user_id === userProfile?.id;
              const isSubordinate = transUser?.manager_id === userProfile?.id;
              if (!isSelf && !isSubordinate) return false;
          } else {
              if (t.user_id !== userProfile?.id) return false;
          }
          // Include if:
          // 1. Has customer_id AND is MKT
          // 2. OR is 'personal_bonus' (demo car fees) - these often have user_id but no customer_id
          // 3. OR is 'advance'/'expense'/'adjustment' (no customer_id required)
          if (t.customer_id) {
              return isMKT(t._source);
          }
          return true; 
      });
  }, [transactions, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, allProfiles, userProfile]);

  const filteredCustomers = useMemo(() => {
      return allCustomers.filter(c => {
          if (filterMode === 'creation') {
              if (!isInMonthYear(c.created_at)) return false;
          } else {
              if (c.status !== CustomerStatus.WON) return false;
              if (!c.updated_at || !isInMonthYear(c.updated_at)) return false;
          }
          if (c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') return false;
          if (!isMKT(c.source)) return false;
          const creator = allProfiles.find(p => p.id === c.creator_id);
          if (isAdmin) {
              if (selectedTeam !== 'all') {
                  if (creator?.manager_id !== selectedTeam && creator?.id !== selectedTeam) return false;
              }
          } else if (isMod) {
              const isSelf = c.creator_id === userProfile?.id;
              const isSubordinate = creator?.manager_id === userProfile?.id;
              if (!isSelf && !isSubordinate) return false;
          } else {
              if (c.creator_id !== userProfile?.id) return false;
          }
          return true;
      });
  }, [allCustomers, filterMode, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, allProfiles, userProfile]);

  const exclusionCandidates = useMemo(() => {
      if (!targetUserForExclusion) return [];
      return allCustomers.filter(c => {
          if (!isMKT(c.source)) return false; 
          if (c.status !== CustomerStatus.WON) return false;
          if (c.deal_status === 'refunded' || c.deal_status === 'refund_pending' || c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') return false;
          const dStr = c.updated_at || c.created_at;
          if (!isInMonthYear(dStr)) return false;
          const creator = allProfiles.find(p => p.id === c.creator_id);
          if (!creator) return false;
          if (isAdmin) {
              if (selectedTeam !== 'all') {
                  if (creator.manager_id !== selectedTeam && creator.id !== selectedTeam) return false;
              }
          } else if (isMod) {
              const isSelf = creator.id === userProfile?.id;
              const isSubordinate = creator.manager_id === userProfile?.id;
              if (!isSelf && !isSubordinate) return false;
          } else {
              if (creator.id !== userProfile?.id) return false;
          }
          return true;
      });
  }, [allCustomers, allProfiles, targetUserForExclusion, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, userProfile]);

  const managers = useMemo(() => {
      const managerIds = Array.from(new Set(allProfiles.filter(p => p.manager_id).map(p => p.manager_id)));
      return managerIds.map(id => {
          const m = allProfiles.find(p => p.id === id);
          return { id: id as string, name: m?.full_name || 'Unknown' };
      }).filter(m => m.name !== 'Unknown');
  }, [allProfiles]);

  const availableCustomersForDeposit = useMemo(() => {
      return allCustomers.filter(c => {
          const isWon = c.status === CustomerStatus.WON;
          const isNotFinished = c.deal_status !== 'completed' && c.deal_status !== 'refunded' && c.deal_status !== 'suspended' && c.deal_status !== 'suspended_pending'; 
          const isMKTSource = c.source === 'MKT Group' || (c.source || '').includes('MKT');
          if (!isWon || !isNotFinished || !isMKTSource) return false;
          if (isAdmin) {
              if (selectedTeam !== 'all') {
                  const creator = allProfiles.find(p => p.id === c.creator_id);
                  return creator?.manager_id === selectedTeam || creator?.id === selectedTeam;
              }
              return true;
          } 
          if (isMod) {
              const creator = allProfiles.find(p => p.id === c.creator_id);
              const isSelf = c.creator_id === userProfile?.id;
              const isSubordinate = creator?.manager_id === userProfile?.id;
              return isSelf || isSubordinate;
          }
          return c.creator_id === userProfile?.id;
      });
  }, [allCustomers, allProfiles, isAdmin, isMod, selectedTeam, userProfile]);

  // --- Calculations ---
  
  const pnlRevenue = filteredTransactions.filter(t => t.status === 'approved' && ['deposit', 'adjustment'].includes(t.type) && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const realExpenses = filteredTransactions.filter(t => t.status === 'approved' && (t.type === 'expense' || (t.type === 'adjustment' && t.amount < 0))).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const partTimeSalaryLiability = filteredTransactions.filter(t => t._is_part_time_creator && ['deposit'].includes(t.type) && t.status === 'approved').reduce((sum, t) => sum + (t.amount * 0.3), 0);
  
  const displayTotalExpense = realExpenses + partTimeSalaryLiability;
  const pnlNet = pnlRevenue - displayTotalExpense; 

  const totalIn = filteredTransactions.filter(t => ['deposit', 'adjustment', 'repayment'].includes(t.type) && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
  const totalOut = filteredTransactions.filter(t => t.status === 'approved' && (['expense', 'advance'].includes(t.type) || (t.type === 'adjustment' && t.amount < 0))).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const fundRemaining = totalIn - totalOut - partTimeSalaryLiability;

  // --- PROFIT SHARING CALCULATION (WITH REDISTRIBUTION) ---
  const profitSharingData: ProfitShareRow[] = useMemo(() => {
      let eligibleProfiles = allProfiles.filter(p => !p.is_part_time && p.status === 'active' && p.role !== 'admin');
      if (isAdmin && selectedTeam !== 'all') {
          eligibleProfiles = eligibleProfiles.filter(p => p.manager_id === selectedTeam || p.id === selectedTeam);
      } else if (isMod) {
          eligibleProfiles = eligibleProfiles.filter(p => p.id === userProfile?.id || p.manager_id === userProfile?.id);
      } else if (!isAdmin && !isMod) {
          eligibleProfiles = eligibleProfiles.filter(p => p.id === userProfile?.id);
      }

      if (eligibleProfiles.length === 0) return [];

      const totalCustomRatio = eligibleProfiles.reduce((sum, p) => sum + (p.profit_share_ratio || 0), 0);
      const profilesWithoutCustom = eligibleProfiles.filter(p => p.profit_share_ratio === null || p.profit_share_ratio === undefined);
      const remainingPercent = Math.max(0, 100 - totalCustomRatio);
      const defaultShare = profilesWithoutCustom.length > 0 ? remainingPercent / profilesWithoutCustom.length : 0;

      const rows = eligibleProfiles.map(emp => {
          const baseRatio = emp.profit_share_ratio !== null && emp.profit_share_ratio !== undefined ? emp.profit_share_ratio : defaultShare;
          
          const kpiTarget = emp.kpi_target || 0;
          const kpiActual = allCustomers.filter(c => {
              if (c.creator_id !== emp.id || c.status !== CustomerStatus.WON) return false;
              if (c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') return false; 
              if (!isMKT(c.source)) return false;
              const d = new Date(c.updated_at || c.created_at);
              return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
          }).length;
          
          const missedKpi = Math.max(0, kpiTarget - kpiActual);
          const penaltyPercent = missedKpi * 0.03; 
          const finalShareRatio = Math.max(0, baseRatio * (1 - penaltyPercent)); 

          const userExclusions = profitExclusions.filter(ex => ex.user_id === emp.id).map(ex => ex.customer_id);
          
          const excludedProfit = filteredTransactions
              .filter(t => t.customer_id && userExclusions.includes(t.customer_id) && t.status === 'approved')
              .reduce((sum, t) => {
                  if (['revenue', 'deposit'].includes(t.type)) return sum + t.amount;
                  if (['incurred_expense'].includes(t.type)) return sum - t.amount; 
                  return sum;
              }, 0);

          const personalNetPool = pnlNet - excludedProfit;
          
          // Deduct Salary Advances specific to THIS user (Strictly "Ứng lương")
          const personalSalaryAdvances = filteredTransactions
              .filter(t => t.user_id === emp.id && t.type === 'advance' && t.status === 'approved' && t.reason.toLowerCase().includes('ứng lương'))
              .reduce((sum, t) => sum + t.amount, 0);
          
          const netPersonalAdvance = personalSalaryAdvances; 

          // Calculate Personal Bonuses (e.g. Demo Car Owner)
          const personalBonus = filteredTransactions
              .filter(t => t.user_id === emp.id && t.type === 'personal_bonus' && t.status === 'approved')
              .reduce((sum, t) => sum + t.amount, 0);

          const estimatedIncome = (personalNetPool * (finalShareRatio / 100)) - netPersonalAdvance + personalBonus;

          return {
              user: emp,
              kpiTarget,
              kpiActual,
              missedKpi,
              penaltyPercent,
              baseShareRatio: baseRatio,
              finalShareRatio,
              personalNetPool,
              estimatedIncome,
              excludedCustomerIds: userExclusions,
              redistributedIncome: 0,
              personalAdvanceDeduction: netPersonalAdvance,
              personalBonus: personalBonus
          };
      });

      rows.forEach(sourceRow => {
          if (sourceRow.excludedCustomerIds.length === 0) return;
          sourceRow.excludedCustomerIds.forEach(custId => {
              const custProfit = filteredTransactions
                  .filter(t => t.customer_id === custId && t.status === 'approved')
                  .reduce((sum, t) => {
                       if (['revenue', 'deposit'].includes(t.type)) return sum + t.amount;
                       if (['incurred_expense'].includes(t.type)) return sum - t.amount;
                       return sum;
                  }, 0);
              if (custProfit <= 0) return;
              const lostAmount = custProfit * (sourceRow.finalShareRatio / 100);
              const beneficiaries = rows.filter(r => r.user.id !== sourceRow.user.id);
              if (beneficiaries.length > 0) {
                  const bonusPerPerson = lostAmount / beneficiaries.length;
                  beneficiaries.forEach(beneficiary => {
                      beneficiary.estimatedIncome += bonusPerPerson;
                      beneficiary.redistributedIncome += bonusPerPerson;
                  });
              }
          });
      });

      return rows;
  }, [allProfiles, allCustomers, profitExclusions, filteredTransactions, pnlNet, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, userProfile]);


  const expenses = filteredTransactions.filter(t => t.type === 'expense' || t.type === 'advance');
  const deposits = filteredTransactions.filter(t => ['deposit', 'revenue', 'adjustment', 'repayment', 'personal_bonus'].includes(t.type));
  const refundableAdvancesList = filteredTransactions.filter(t => t.type === 'advance' && !t.reason.toLowerCase().includes('ứng lương'));
  
  const allRepayments = transactions.filter(t => t.type === 'repayment');
  const pendingDealerDebts = filteredTransactions.filter(t => t.type === 'dealer_debt' && !t.reason.includes('(Đã thu)'));
  
  const totalAdvances = filteredTransactions.filter(t => t.type === 'advance' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
  const totalRepaid = filteredTransactions.filter(t => t.type === 'repayment' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
  const netOutstandingAdvances = Math.max(0, totalAdvances - totalRepaid);
  const outstandingAdvances = netOutstandingAdvances; 

  const pieData1 = [
      { name: 'Tồn quỹ công ty', value: fundRemaining > 0 ? fundRemaining : 0 },
      { name: 'Đã chi/ứng (Hoàn lại)', value: totalOut },
      { name: 'Lương Part-time', value: partTimeSalaryLiability }
  ];

  const totalExpectedRevenue = filteredCustomers.reduce((sum, c) => sum + Number(c.deal_details?.revenue || 0), 0);
  
  const collectionData = [
      { name: 'Tổng quan', 'Dự kiến (Sau ứng)': Math.max(0, totalExpectedRevenue - (displayTotalExpense - partTimeSalaryLiability)), 'Đã thu': pnlRevenue }
  ];
  
  const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-20 relative">
      {/* ... Header and Cards (unchanged) ... */}
      
      {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="font-bold text-sm">{toast.msg}</span>
          </div>
      )}

      {/* FILTER HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BadgeDollarSign className="text-green-600"/> Quỹ & Thu Chi (MKT Group)</h1>
          <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto items-center">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar size={16} className="text-gray-500" />
                  <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as any)} className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer border-r border-gray-200 pr-2 mr-2">
                      <option value="creation">Theo ngày tạo</option><option value="deal">Theo ngày chốt</option>
                  </select>
                  <span className="text-gray-500 text-sm">Tháng</span>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="text-sm font-bold text-primary-700 bg-transparent outline-none cursor-pointer">
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (<option key={m} value={m}>{m}</option>))}
                  </select>
                  <span className="text-gray-500 text-sm">/</span>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="text-sm font-bold text-primary-700 bg-transparent outline-none cursor-pointer">
                      {[2024, 2025, 2026].map(y => (<option key={y} value={y}>{y}</option>))}
                  </select>
              </div>
              <div className="flex gap-2 items-center">
                  {isAdmin && (
                      <div className="relative">
                          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="appearance-none bg-indigo-50 border border-indigo-200 text-indigo-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-bold shadow-sm cursor-pointer">
                              <option value="all">Tất cả Team</option>
                              {managers.map(mgr => (<option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>))}
                          </select>
                          <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                      </div>
                  )}
                  <div className="relative">
                      <div className="appearance-none bg-blue-50 border border-blue-200 text-blue-700 py-2 px-4 rounded-xl text-sm font-bold shadow-sm h-full flex items-center">
                          Nguồn: MKT Group
                      </div>
                  </div>
                  {(isAdmin || isMod) && <button onClick={() => { setNewQrUrl(qrCodeUrl); setShowConfigModal(true); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors whitespace-nowrap">Cấu hình QR</button>}
                  {isAdmin && (
                      <button onClick={() => setShowResetConfirm(true)} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-bold hover:bg-red-200 transition-colors whitespace-nowrap flex items-center gap-1 border border-red-200">
                          <Trash2 size={16}/> Reset
                      </button>
                  )}
              </div>
          </div>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
              <h3 className="font-bold text-gray-700 mb-4">Tổng quan Quỹ (MKT Only)</h3>
              <div className="w-full h-40"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData1} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"><Cell fill="#10b981" /><Cell fill="#ef4444" /><Cell fill="#f59e0b" /></Pie><ReTooltip formatter={(val: number) => formatCurrency(val) + ' VNĐ'} /></PieChart></ResponsiveContainer></div>
              <div className="text-center mt-2"><p className="text-sm text-gray-500">Quỹ tồn đọng (Thực tế)</p><p className="text-2xl font-bold text-green-600">{formatCurrency(fundRemaining)} VNĐ</p></div>
              <div className="mt-4 pt-4 border-t border-gray-100 w-full flex justify-between items-center px-2">
                  <span className="text-xs font-bold text-gray-500">Nợ ứng cần trả:</span>
                  <span className={`text-sm font-bold ${outstandingAdvances > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatCurrency(outstandingAdvances)} VNĐ</span>
              </div>
              {isAdmin && (<button onClick={() => setShowAdjustmentModal(true)} className="mt-4 text-xs font-bold text-gray-500 flex items-center gap-1 hover:text-gray-800"><Settings2 size={12}/> Điều chỉnh</button>)}
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-bold text-gray-700 mb-4">Tiến độ Thu tiền (MKT Group)</h3>
              <div className="flex-1 w-full h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={collectionData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" hide /><ReTooltip cursor={{fill: 'transparent'}} formatter={(val: number) => formatCurrency(val) + ' VNĐ'} /><Legend verticalAlign="top" height={36}/><Bar dataKey="Dự kiến (Sau ứng)" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={20} /><Bar dataKey="Đã thu" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} /></BarChart></ResponsiveContainer></div>
              <div className="flex flex-col text-xs text-gray-500 mt-2 px-2 gap-1">
                  <div className="flex justify-between"><span>Dự kiến gốc:</span><b className="text-purple-600">{formatCurrency(totalExpectedRevenue)}</b></div>
                  <div className="flex justify-between border-t pt-1"><span>Thực thu (Đã trừ ứng):</span><b className="text-green-600">{formatCurrency(pnlRevenue)}</b></div>
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-4">
              <h3 className="font-bold text-gray-700">Hiệu quả Kinh doanh (Net MKT)</h3>
              <div className="text-center w-full">
                  <p className="text-gray-500 font-bold uppercase text-xs">TỔNG THU</p>
                  <p className="text-2xl font-bold text-blue-600">+{formatCurrency(pnlRevenue)}</p>
              </div>
              <div className="w-full h-px bg-gray-100"></div>
              <div className="text-center w-full">
                  <p className="text-gray-500 font-bold uppercase text-xs">CHI QUỸ & LƯƠNG CTV</p>
                  <p className="text-xl font-bold text-red-600">-{formatCurrency(displayTotalExpense)}</p>
                  <p className="text-[10px] text-gray-400 mt-1 italic">(*Chỉ tính chi phí chung, KHÔNG bao gồm tạm ứng)</p>
              </div>
              <div className="w-full h-px bg-gray-100"></div>
              <div className="text-center bg-blue-50 w-full py-2 rounded-xl border border-blue-100"><p className="text-blue-800 font-bold uppercase text-xs">LỢI NHUẬN RÒNG (NET)</p><p className="text-xl font-bold text-blue-900">{formatCurrency(pnlNet)} VNĐ</p></div>
          </div>
      </div>

      {/* --- PROFIT DISTRIBUTION SECTION --- */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden mb-6">
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
              <h3 className="font-bold text-indigo-900 flex items-center gap-2"><Percent size={20} className="text-indigo-600"/> Phân chia Lợi Nhuận (Bonus)</h3>
              <span className="text-xs font-medium text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-200">
                  Pool Net: <strong>{formatCurrency(pnlNet)}</strong> VNĐ
              </span>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                      <tr>
                          <th className="px-4 py-3">Nhân viên</th>
                          <th className="px-4 py-3 text-center">KPI (Thực/Mục tiêu)</th>
                          <th className="px-4 py-3 text-center">Tỉ lệ cơ bản</th>
                          <th className="px-4 py-3 text-center">Phạt KPI</th>
                          <th className="px-4 py-3 text-center">Tỉ lệ cuối</th>
                          <th className="px-4 py-3 text-right">Pool Cá nhân</th>
                          <th className="px-4 py-3 text-right">Trừ Ứng / Cộng Thêm</th>
                          <th className="px-4 py-3 text-right">Thực nhận (Dự kiến)</th>
                          {(isAdmin || isMod) && <th className="px-4 py-3 text-center">Hành động</th>}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {profitSharingData.length === 0 ? (
                          <tr><td colSpan={9} className="p-4 text-center text-gray-400">Không có nhân viên Full-time nào trong danh sách.</td></tr>
                      ) : profitSharingData.map(row => (
                          <tr key={row.user.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-4 py-3 font-bold text-gray-800">
                                  <div className="flex flex-col">
                                      <span className="flex items-center gap-2">
                                          {row.user.full_name}
                                          {row.excludedCustomerIds.length > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-normal" title="Có khách hàng bị loại trừ">Excl: {row.excludedCustomerIds.length}</span>}
                                      </span>
                                      {row.redistributedIncome > 0 && (
                                          <span className="text-[10px] text-green-600 flex items-center gap-1 mt-0.5 font-semibold">
                                              <Gift size={10}/> Thưởng lại: +{formatCurrency(row.redistributedIncome)}
                                          </span>
                                      )}
                                  </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                  <span className={`font-bold ${row.missedKpi > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                      {row.kpiActual}
                                  </span>
                                  <span className="text-gray-400"> / {row.kpiTarget}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                  {editingRatioId === row.user.id ? (
                                      <div className="flex items-center justify-center gap-1">
                                          <input type="number" className="w-12 border rounded px-1 py-0.5 text-center font-bold" value={tempRatio} onChange={e => setTempRatio(e.target.value)} autoFocus />
                                          <button onClick={() => handleUpdateRatio(row.user.id)} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={14}/></button>
                                          <button onClick={() => setEditingRatioId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X size={14}/></button>
                                      </div>
                                  ) : (
                                      <span className="font-bold text-gray-700 cursor-pointer hover:text-indigo-600 hover:underline" onClick={() => { if(isAdmin || isMod) { setEditingRatioId(row.user.id); setTempRatio(row.baseShareRatio.toString()); }}}>
                                          {row.baseShareRatio.toFixed(1)}%
                                      </span>
                                  )}
                              </td>
                              <td className="px-4 py-3 text-center text-red-500 font-medium">
                                  {row.penaltyPercent > 0 ? `-${(row.penaltyPercent * 100).toFixed(0)}% (share)` : '-'}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-indigo-700">
                                  {row.finalShareRatio.toFixed(2)}%
                              </td>
                              <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                  {formatCurrency(row.personalNetPool)}
                              </td>
                              <td className="px-4 py-3 text-right text-xs">
                                  <div className="flex flex-col items-end gap-1">
                                      {row.personalAdvanceDeduction > 0 && <span className="text-red-500 font-semibold">-{formatCurrency(row.personalAdvanceDeduction)} (Ứng)</span>}
                                      {row.personalBonus > 0 && <span className="text-green-500 font-semibold">+{formatCurrency(row.personalBonus)} (Thêm)</span>}
                                      {row.personalAdvanceDeduction === 0 && row.personalBonus === 0 && <span className="text-gray-400">-</span>}
                                  </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-green-600 text-lg">
                                  {formatCurrency(row.estimatedIncome)}
                              </td>
                              {(isAdmin || isMod) && (
                                  <td className="px-4 py-3 text-center">
                                      <button onClick={() => { setTargetUserForExclusion(row.user); setShowExclusionModal(true); }} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-red-50 hover:text-red-600 transition-colors" title="Loại trừ Khách hàng">
                                          <MinusCircle size={16}/>
                                      </button>
                                  </td>
                              )}
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* DASHBOARD HISTORY TABLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center"><h3 className="font-bold text-red-800 flex items-center gap-2"><ArrowUpRight/> Lịch sử Chi/Tạm Ứng</h3>
              <button onClick={() => setShowExpenseModal(true)} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow hover:bg-red-700 flex items-center gap-1"><ArrowUpRight size={14}/> Xuất tiền (Chi)</button>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">{expenses.map(t => (<div key={t.id} className="p-3 border border-gray-100 rounded-xl hover:shadow-sm transition-all"><div className="flex justify-between items-start"><div><p className="font-bold text-gray-900">{t.reason}</p><p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString()}</p>{t.customer_name && <p className="text-xs text-blue-600 mt-1">Khách: {t.customer_name}</p>}</div><span className="font-bold text-red-600">-{formatCurrency(t.amount)}</span></div><div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status === 'approved' ? 'bg-green-100 text-green-700' : t.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span><div className="flex gap-2">{t.status === 'pending' && (isAdmin || isMod) && (<><button onClick={() => handleApprove(t, true)} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16}/></button><button onClick={() => handleApprove(t, false)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16}/></button></>)}{(isAdmin || isMod) && (<button onClick={() => setTransactionToDelete(t)} className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-red-100 hover:text-red-600"><Trash2 size={16}/></button>)}</div></div></div>))}</div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center"><h3 className="font-bold text-green-800 flex items-center gap-2"><ArrowDownLeft/> Hoạt động Nộp tiền</h3><button onClick={() => setShowDepositModal(true)} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg shadow hover:bg-green-700 flex items-center gap-1"><QrCode size={14}/> Nộp quỹ</button></div>
              <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">{deposits.map(t => (<div key={t.id} className="p-3 border border-gray-100 rounded-xl transition-all hover:shadow-sm"><div className="flex justify-between items-center"><div><p className="font-bold text-gray-900 flex items-center gap-2">{t.reason} {t._is_part_time_creator && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded uppercase">Part-time (30% lương)</span>}</p><p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString()}</p>{t.customer_name && <p className="text-xs text-green-600 mt-1">Khách: {t.customer_name}</p>}</div><span className={`font-bold ${t.type === 'adjustment' && t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}</span></div><div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status === 'approved' ? 'bg-green-100 text-green-700' : t.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span><div className="flex gap-2">{t.status === 'pending' && (isAdmin || isMod) && (<><button onClick={() => handleApprove(t, true)} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16}/></button><button onClick={() => handleApprove(t, false)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16}/></button></>)}{(isAdmin || isMod) && (<button onClick={() => setTransactionToDelete(t)} className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-red-100 hover:text-red-600"><Trash2 size={16}/></button>)}</div></div></div>))}</div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-purple-50 border-b border-purple-100 flex flex-col gap-1">
                  <h3 className="font-bold text-purple-800 flex items-center gap-2"><Undo2 size={18}/> Nợ ứng cần hoàn trả</h3>
                  <p className="text-xs text-purple-600 font-semibold">Tổng nợ: {formatCurrency(outstandingAdvances)} VNĐ</p>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">
                  {refundableAdvancesList.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">Không có khoản ứng nào.</div>
                  ) : (
                      refundableAdvancesList.map(t => {
                          const isPaid = t.reason.includes('(Đã trả)') || t.reason.includes('(Đã hoàn ứng)');
                          const pendingRepayment = allRepayments.find(r => r.status === 'pending' && (r.reason.includes(`Ref:${t.id}`) || (r.user_id === t.user_id && r.amount === t.amount && r.created_at > t.created_at)));
                          const approvedRepayment = allRepayments.find(r => r.status === 'approved' && (r.reason.includes(`Ref:${t.id}`) || (r.user_id === t.user_id && r.amount === t.amount && r.created_at > t.created_at)));
                          const finalPaid = isPaid || !!approvedRepayment;
                          const statusText = finalPaid ? 'Đã trả' : pendingRepayment ? 'Chờ duyệt trả' : t.status === 'approved' ? 'Chưa trả' : 'Chờ duyệt';
                          const statusColor = finalPaid ? 'bg-green-100 text-green-700' : pendingRepayment ? 'bg-orange-100 text-orange-700' : t.status === 'approved' ? 'bg-purple-200 text-purple-800' : 'bg-yellow-100 text-yellow-700';

                          return (
                              <div key={t.id} className={`p-3 border border-purple-200 bg-purple-50 rounded-xl transition-all ${t.customer_id ? 'cursor-pointer hover:shadow-md hover:border-purple-300' : ''}`}>
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <div className="flex items-center gap-1 mb-1"><p className="font-bold text-gray-900 line-clamp-1">{t.reason}</p>{t.customer_id && <ExternalLink size={12} className="text-purple-400"/>}</div>
                                          <p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString('vi-VN')}</p>
                                          {t.customer_name && <p className="text-xs text-purple-600 mt-1 font-semibold">Khách: {t.customer_name}</p>}
                                      </div>
                                      <div className="flex flex-col items-end"><span className="font-bold text-purple-700">-{formatCurrency(t.amount)}</span><span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 font-bold ${statusColor}`}>{statusText}</span></div>
                                  </div>
                                  <div className="flex justify-end mt-2 pt-2 border-t border-purple-100 gap-2">
                                      {pendingRepayment && (isAdmin || isMod) && (<button onClick={(e) => { e.stopPropagation(); handleApprove(pendingRepayment, true); }} className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 flex items-center gap-1 animate-pulse shadow-sm"><CheckCircle2 size={12}/> Duyệt nhận tiền</button>)}
                                      {t.status === 'approved' && !finalPaid && !pendingRepayment && (isAdmin || isMod) && (<button onClick={(e) => { e.stopPropagation(); setAdvanceToRepay(t); }} className="px-2 py-1 bg-white border border-green-200 text-green-700 rounded text-xs font-bold hover:bg-green-50 flex items-center gap-1"><Undo2 size={12}/> Thu tiền mặt</button>)}
                                      {t.status === 'pending' && (isAdmin || isMod) && (<><button onClick={(e) => { e.stopPropagation(); handleApprove(t, true); }} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16}/></button><button onClick={(e) => { e.stopPropagation(); handleApprove(t, false); }} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16}/></button></>)}
                                      {(isAdmin || isMod) && (<button onClick={(e) => { e.stopPropagation(); setTransactionToDelete(t); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>)}
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center"><h3 className="font-bold text-orange-800 flex items-center gap-2"><Building2 size={18}/> Đại lý nợ chưa thu</h3></div>
              <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">{pendingDealerDebts.length === 0 ? (<div className="text-center py-8 text-gray-400 text-sm">Không có khoản nợ nào.</div>) : (pendingDealerDebts.map(t => (<div key={t.id} className={`p-3 border border-orange-200 bg-orange-50 rounded-xl transition-all ${t.customer_id ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : ''}`}><div className="flex justify-between items-start"><div><div className="flex items-center gap-1 mb-1"><p className="font-bold text-gray-900 line-clamp-1">{t.reason}</p>{t.customer_id && <ExternalLink size={12} className="text-orange-400"/>}</div><p className="text-xs text-gray-500">{t.user_name} • Dự kiến: {t.target_date ? new Date(t.target_date).toLocaleDateString('vi-VN') : 'N/A'}</p>{t.customer_name && <p className="text-xs text-blue-600 mt-1 font-semibold">Khách: {t.customer_name}</p>}</div><div className="flex flex-col items-end"><span className="font-bold text-orange-700">+{formatCurrency(t.amount)}</span><span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded mt-1 font-bold">Chờ thu</span></div></div>{(isAdmin || isMod) && (<div className="flex justify-end mt-2 pt-2 border-t border-orange-100"><button onClick={(e) => { e.stopPropagation(); setTransactionToDelete(t); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button></div>)}</div>)))}</div>
          </div>
      </div>

      {/* ... (Keep existing modals unchanged) ... */}
      {showDepositModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Nộp quỹ / Doanh thu</h3><button onClick={() => setShowDepositModal(false)}><X size={24} className="text-gray-400"/></button></div>{qrCodeUrl && (<div className="flex flex-col items-center mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100"><img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 object-contain mb-2 mix-blend-multiply" /><p className="text-xs text-gray-500 text-center">Quét mã để chuyển khoản, sau đó nhập thông tin bên dưới.</p></div>)}<div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Chọn Khách hàng (Đã chốt)</label><select className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900" value={depositForm.customerId} onChange={e => setDepositForm({...depositForm, customerId: e.target.value})}><option value="">-- Chọn khách hàng --</option>{availableCustomersForDeposit.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}</select>{availableCustomersForDeposit.length === 0 && <p className="text-xs text-red-500 mt-1">Không có khách hàng khả dụng</p>}</div><div><label className="block text-sm font-bold text-gray-700 mb-1">Số tiền</label><input type="text" className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900 font-bold" value={depositForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setDepositForm({...depositForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Nội dung</label><input type="text" className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900" value={depositForm.reason} onChange={e => setDepositForm({...depositForm, reason: e.target.value})} /></div><button onClick={handleSubmitDeposit} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700">Xác nhận đã nộp</button></div></div></div>)}
      {showAdjustmentModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Điều chỉnh Quỹ (Admin)</h3><button onClick={() => setShowAdjustmentModal(false)}><X size={24} className="text-gray-400"/></button></div><div className="space-y-4"><div><label className="text-sm font-bold text-gray-600">Số tiền (+/-)</label><input type="text" value={adjustmentForm.amount} onChange={e => setAdjustmentForm({...adjustmentForm, amount: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" placeholder="-500000 hoặc 1000000" /></div><div><label className="text-sm font-bold text-gray-600">Lý do</label><input type="text" value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" /></div><button onClick={handleSubmitAdjustment} className="w-full py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900">Xác nhận điều chỉnh</button></div></div></div>)}
      
      {showAdvanceModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-red-700">Tạm Ứng (Cần hoàn lại)</h3><button onClick={() => setShowAdvanceModal(false)}><X size={24} className="text-gray-400"/></button></div><div className="space-y-4"><div><label className="text-sm font-bold text-gray-600">Số tiền cần ứng</label><input type="text" value={advanceForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAdvanceForm({...advanceForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" /></div><div><label className="text-sm font-bold text-gray-600">Lý do ứng</label><input type="text" value={advanceForm.reason} onChange={e => setAdvanceForm({...advanceForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" placeholder="VD: Đi tiếp khách..." /></div><div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">Khoản này sẽ tạo thành <strong>Nợ tạm ứng</strong> cần phải hoàn trả sau này.</div><button onClick={handleSubmitAdvance} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Gửi yêu cầu Ứng</button></div></div></div>)}
      
      {/* NEW EXPENSE MODAL */}
      {showExpenseModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-red-700">Chi Tiền (Trừ thẳng quỹ)</h3><button onClick={() => setShowExpenseModal(false)}><X size={24} className="text-gray-400"/></button></div><div className="space-y-4"><div><label className="text-sm font-bold text-gray-600">Số tiền chi</label><input type="text" value={expenseForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setExpenseForm({...expenseForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" /></div><div><label className="text-sm font-bold text-gray-600">Lý do chi</label><input type="text" value={expenseForm.reason} onChange={e => setExpenseForm({...expenseForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" placeholder="VD: Mua nước, liên hoan..." /></div><div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">Lưu ý: Khoản này là <strong>Chi phí</strong> chung, sẽ trừ thẳng vào quỹ và KHÔNG tạo nợ cá nhân.</div><button onClick={handleSubmitExpense} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Gửi yêu cầu Chi</button></div></div></div>)}

      {showConfigModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><h3 className="text-lg font-bold text-gray-900 mb-4">Cấu hình QR Code</h3><div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-1">Link ảnh QR</label><input type="text" placeholder="Dán link ảnh QR Code..." className="w-full border p-2 rounded-xl text-gray-900 outline-none focus:border-primary-500" value={newQrUrl} onChange={e => setNewQrUrl(e.target.value)} /></div>{newQrUrl && (<div className="mb-4 p-2 bg-gray-50 border rounded-xl flex justify-center"><img src={newQrUrl} alt="Preview" className="h-32 object-contain" /></div>)}<div className="flex justify-end gap-2"><button onClick={() => setShowConfigModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold">Hủy</button><button onClick={handleSaveQr} disabled={isSavingQr} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2">{isSavingQr && <Loader2 className="animate-spin" size={16} />} Lưu</button></div></div></div>)}
      {showExclusionModal && targetUserForExclusion && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Loại trừ khách hàng</h3><button onClick={() => setShowExclusionModal(false)}><X size={24} className="text-gray-400"/></button></div><div className="bg-yellow-50 p-3 rounded-xl mb-4 border border-yellow-100"><p className="text-sm text-yellow-800">Đang chọn loại trừ cho: <strong>{targetUserForExclusion.full_name}</strong></p><p className="text-xs text-yellow-700 mt-1">Danh sách hiển thị: Khách <strong>MKT Group</strong>, Đã chốt, Chưa hoàn tiền (Thuộc Team đang chọn).</p></div><div className="overflow-y-auto flex-1 space-y-2 border-t border-gray-100 pt-2">{exclusionCandidates.length === 0 ? <p className="text-center text-gray-400 py-4">Không có khách hàng MKT nào phù hợp.</p> : exclusionCandidates.map(c => { const isExcluded = profitExclusions.some(ex => ex.user_id === targetUserForExclusion.id && ex.customer_id === c.id); return (<div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer" onClick={() => handleToggleExclusion(c.id)}><div><p className="font-bold text-sm text-gray-900">{c.name} <span className="font-normal text-gray-500">({c.sales_rep})</span></p><p className="text-xs text-gray-500">{formatCurrency(c.deal_details?.revenue || 0)} VNĐ • {c.source}</p></div><div className={`w-5 h-5 rounded border flex items-center justify-center ${isExcluded ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300'}`}>{isExcluded && <Check size={14}/>}</div></div>); })}</div><div className="mt-4 pt-2 border-t flex justify-end"><button onClick={() => setShowExclusionModal(false)} className="px-4 py-2 bg-gray-100 font-bold rounded-xl text-gray-700 hover:bg-gray-200">Đóng</button></div></div></div>)}
      {transactionToDelete && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-red-100"><div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600"><Trash2 size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa giao dịch?</h3><p className="text-sm text-gray-500 mb-4">Bạn có chắc chắn muốn xóa giao dịch này khỏi hệ thống?</p><div className="flex gap-3 w-full"><button onClick={() => setTransactionToDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={confirmDeleteTransaction} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors">Xóa ngay</button></div></div></div></div>)}
      {advanceToRepay && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-purple-100"><div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600"><Undo2 size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận Hoàn ứng?</h3><div className="bg-purple-50 p-4 rounded-xl text-left w-full mb-4 border border-purple-100 space-y-2"><div><p className="text-xs text-gray-500">Nội dung ứng</p><p className="font-bold text-gray-900">{advanceToRepay.reason}</p></div><div><p className="text-xs text-gray-500">Số tiền hoàn trả</p><p className="font-bold text-purple-600 text-lg">{formatCurrency(advanceToRepay.amount)} VNĐ</p></div></div><p className="text-xs text-gray-500 mb-4">Hành động này sẽ gửi yêu cầu hoàn trả. Vui lòng chờ Admin/Mod duyệt để cập nhật quỹ.</p><div className="flex gap-3 w-full"><button onClick={() => setAdvanceToRepay(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={handleManualRepay} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-200 transition-colors">Xác nhận Thu</button></div></div></div></div>)}
      {showResetConfirm && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border-2 border-red-200"><div className="flex flex-col items-center text-center"><div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-pulse"><AlertTriangle size={40} /></div><h3 className="text-2xl font-bold text-gray-900 mb-2">CẢNH BÁO NGUY HIỂM!</h3><div className="bg-red-50 p-4 rounded-xl text-left w-full mb-6 border border-red-100"><p className="text-red-800 font-bold text-sm mb-2">Hành động này sẽ XÓA SẠCH:</p><ul className="list-disc list-inside text-red-700 text-sm space-y-1"><li>Toàn bộ lịch sử Thu/Chi/Nộp tiền.</li><li>Toàn bộ Tiền phạt và Quỹ nhóm.</li><li>Reset "Doanh thu thực tế" của tất cả khách hàng về 0.</li></ul><p className="text-red-600 text-xs italic mt-3 font-semibold text-center">Dữ liệu sẽ KHÔNG THỂ khôi phục được.</p></div><div className="flex gap-3 w-full"><button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3.5 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">Hủy bỏ</button><button onClick={executeResetFinance} disabled={isResetting} className="flex-1 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2">{isResetting && <Loader2 className="animate-spin" size={20} />} Xác nhận RESET</button></div></div></div></div>)}
      
      {dealerDebtToConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-green-100">
                  <div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600"><CheckCircle2 size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Đại lý đã trả nợ?</h3><div className="bg-green-50 p-4 rounded-xl text-left w-full mb-4 border border-green-100 space-y-2"><div><p className="text-xs text-gray-500">Khoản nợ</p><p className="font-bold text-gray-900">{dealerDebtToConfirm.reason}</p></div><div><p className="text-xs text-gray-500">Số tiền</p><p className="font-bold text-green-600 text-lg">{formatCurrency(dealerDebtToConfirm.amount)} VNĐ</p></div></div><p className="text-xs text-gray-500 mb-4">Hành động này sẽ ghi nhận <strong>Doanh thu/Nộp tiền</strong> vào hệ thống.</p><div className="flex gap-3 w-full"><button onClick={() => setDealerDebtToConfirm(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={executeDealerDebtPaid} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-colors">Xác nhận</button></div></div>
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
    </div>
  );
};

export default Finance;

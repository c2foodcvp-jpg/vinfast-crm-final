
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, UserProfile, Customer, CustomerStatus, TransactionType, ProfitExclusion, EmployeeKPI, FundPeriod } from '../types';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2, User, Filter,
    Loader2, X, ArrowUpRight, ArrowDownLeft, Trash2, Check, XCircle, AlertTriangle, Calendar,
    BadgeDollarSign, Settings2, Undo2, ExternalLink, Building2, QrCode,
    Percent, MinusCircle, Gift, Scale, Hand, Lock
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
    personalNetPool: number; // Gross Share before deductions

    // Breakdown Fields
    grossShare: number; // Income after Bonus/KPI adjustment
    advanceDeduction: number; // Pure Advance (Ung Luong)
    paidSalary: number; // Already Paid Salary in this period
    bonusAdjustment: number; // Demo Car Bonus or Redistributed Penalty

    // Legacy mapping (to keep code compiling if I miss refs, or just remove)
    estimatedIncome: number; // Final Net to Receive
    excludedCustomerIds: string[];
    excludedProfit: number;
    redistributedIncome: number;
    personalAdvanceDeduction: number; // Total Deduction (Advance + Salary)
    personalBonus: number;
    employeeRevenue: number;
    teamPoolWithEmployee: number;
}

const Finance: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
    const [profitExclusions, setProfitExclusions] = useState<ProfitExclusion[]>([]);
    const [allKPIs, setAllKPIs] = useState<EmployeeKPI[]>([]); // NEW: Store all KPIs

    // Filter States
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<number | 'all' | 'q1' | 'q2' | 'q3' | 'q4'>('all');
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
    const [expenseForm, setExpenseForm] = useState({ amount: '', reason: '', fundPeriodId: '' });

    const [showConfigModal, setShowConfigModal] = useState(false);
    // NEW: QR Upload States (Replaces simple URL string)
    const [qrFile, setQrFile] = useState<File | null>(null);
    const [qrPreview, setQrPreview] = useState<string | null>(null);
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

    // NEW: Borrow Money Modal State
    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [borrowForm, setBorrowForm] = useState({ customerId: '', amount: '', date: '', reason: '' });

    // NEW: Fund Period States (Đóng Quỹ)
    const [fundPeriods, setFundPeriods] = useState<FundPeriod[]>([]);
    const [selectedFundPeriod, setSelectedFundPeriod] = useState<string>('all');
    const [showCloseFundModal, setShowCloseFundModal] = useState(false);
    const [closeFundForm, setCloseFundForm] = useState({
        name: '',
        startDate: '',
        endDate: ''
    });
    const [selectedFundMembers, setSelectedFundMembers] = useState<string[]>([]); // New: Members for the new fund
    const [fundMembersMap, setFundMembersMap] = useState<{ fund_id: string, user_id: string }[]>([]); // New: State for fund members
    const [isEditingFund, setIsEditingFund] = useState<string | null>(null); // New: Track editing state
    const [isClosingFund, setIsClosingFund] = useState(false);

    // NEW: Dynamic KPI Penalty Rate (fetched from app_settings)
    const [kpiPenaltyRate, setKpiPenaltyRate] = useState<number>(0.03); // Default 3%

    const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];



    const [showSql, setShowSql] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    const [showSalaryConfirmModal, setShowSalaryConfirmModal] = useState(false);
    const [salaryPayoutTarget, setSalaryPayoutTarget] = useState<{ user: UserProfile, maxAmount: number } | null>(null);
    const [salaryPayoutAmount, setSalaryPayoutAmount] = useState<string>('');

    // KPI Penalty Rate Config Modal (for MOD)
    const [showKpiConfigModal, setShowKpiConfigModal] = useState(false);
    const [kpiConfigValue, setKpiConfigValue] = useState<string>('3');
    const [kpiConfigSaving, setKpiConfigSaving] = useState(false);
    const [kpiConfigMsg, setKpiConfigMsg] = useState<string | null>(null);

    // NEW: User Specific KPI Penalty Config Modal
    const [showUserKpiConfigModal, setShowUserKpiConfigModal] = useState(false);
    const [targetUserForKpiConfig, setTargetUserForKpiConfig] = useState<UserProfile | null>(null);
    const [userKpiConfigValue, setUserKpiConfigValue] = useState<string>('');

    // NEW: Map of User ID -> Penalty Rate (0.01 = 1%)
    const [userPenaltyRates, setUserPenaltyRates] = useState<Record<string, number>>({});

    useEffect(() => {
        if (userProfile) {
            fetchDataWithIsolation();
        }
    }, [userProfile, selectedTeam]); // Refetch when team changes for fund period isolation

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

            const { data: profiles } = await supabase.from('profiles').select('*');
            if (profiles) setAllProfiles(profiles as UserProfile[]);

            // Determine manager_id for team context
            let teamManagerId: string | null = null;
            if (isAdmin && selectedTeam !== 'all') {
                teamManagerId = selectedTeam;
            } else if (isMod && userProfile) {
                teamManagerId = userProfile.id;
            } else if (userProfile?.manager_id) {
                teamManagerId = userProfile.manager_id;
            }

            // Fetch KPI Penalty Rate: Try team-specific first, fallback to global
            let kpiRate = 0.03; // Default

            // 1. Try team-specific rate
            if (teamManagerId) {
                const { data: teamRateSetting } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'kpi_penalty_rate')
                    .eq('manager_id', teamManagerId)
                    .maybeSingle();

                if (teamRateSetting?.value) {
                    kpiRate = parseFloat(teamRateSetting.value) || 0.03;
                } else {
                    // 2. Fallback to global rate
                    const { data: globalRateSetting } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'kpi_penalty_rate')
                        .is('manager_id', null)
                        .maybeSingle();
                    if (globalRateSetting?.value) {
                        kpiRate = parseFloat(globalRateSetting.value) || 0.03;
                    }
                }
            } else {
                // No team context, use global
                const { data: globalRateSetting } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'kpi_penalty_rate')
                    .is('manager_id', null)
                    .maybeSingle();
                if (globalRateSetting?.value) {
                    kpiRate = parseFloat(globalRateSetting.value) || 0.03;
                }
            }
            setKpiPenaltyRate(kpiRate);

            // NEW: Fetch User Specific Rates
            const { data: userRatesData } = await supabase
                .from('app_settings')
                .select('key, value')
                .like('key', 'kpi_penalty_rate_USER_%');

            const newUserRates: Record<string, number> = {};
            if (userRatesData) {
                userRatesData.forEach(r => {
                    const uid = r.key.replace('kpi_penalty_rate_USER_', '');
                    if (uid) {
                        newUserRates[uid] = parseFloat(r.value);
                    }
                });
            }
            setUserPenaltyRates(newUserRates);

            // OPTIMIZED: Select only necessary fields + Filter WON + MKT Source on Server
            // This drastically reduces payload size and maintenance
            // FIX: Removed .eq('status', 'Chốt đơn') to allow Debt Collection for "Potentials" or "Processing"
            const { data: customers } = await supabase
                .from('customers')
                .select('id, name, phone, source, status, deal_status, creator_id, sales_rep, created_at, updated_at, won_at, deal_details, fund_period_id')
                .neq('status', 'Đã hủy') // Exclude Lost
                .neq('status', 'Chờ duyệt hủy') // Exclude Lost Pending
                .ilike('source', '%MKT%')
                .range(0, 9999)
                .order('created_at', { ascending: false });
            const custList = (customers as Customer[]) || [];
            setAllCustomers(custList);

            const { data: trans } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
            let transList = (trans as Transaction[]) || [];

            const { data: exclusions } = await supabase.from('profit_exclusions').select('*');
            if (exclusions) setProfitExclusions(exclusions as ProfitExclusion[]);

            // NEW: Fetch all KPIs to link dynamically
            const { data: kpis } = await supabase.from('employee_kpis').select('*');
            if (kpis) setAllKPIs(kpis as EmployeeKPI[]);

            // NEW: Fetch Fund Periods and Members
            // 1. Fetch All Allocation Memberships First (Global is fine as table is small, or filter by user)
            const { data: fMembers } = await supabase.from('fund_members').select('*');
            if (fMembers) setFundMembersMap(fMembers);

            // 2. Fetch Fund Periods with Team Isolation
            let periodsQuery = supabase.from('fund_periods').select('*');

            if (isAdmin) {
                if (selectedTeam !== 'all') {
                    periodsQuery = periodsQuery.eq('manager_id', selectedTeam);
                }
            } else if (isMod && userProfile) {
                periodsQuery = periodsQuery.eq('manager_id', userProfile.id);
            } else {
                // Regular User: We fetch ALL periods first (or optimize to fetch only relevant), 
                // but easier logic is fetch potentially relevant ones then filter by membership map.
                // However, we can't filter by Join on Supabase easily without complex query.
                // Let's fetch all periods (or those by manager) AND then filter in JS.
                if (userProfile?.manager_id) {
                    periodsQuery = periodsQuery.eq('manager_id', userProfile.manager_id);
                }
            }

            const { data: funds } = await periodsQuery;
            let displayFunds = funds || [];

            // 3. Post-Filter for Regular Users: Only show funds they are a MEMBER of
            if (!isAdmin && !isMod && userProfile && fMembers) {
                const myFundIds = fMembers.filter(m => m.user_id === userProfile.id).map(m => m.fund_id);
                // Also keep any "Open" funds without members if that's a legacy rule? 
                // Creating a stricter rule: MUST be a member
                displayFunds = displayFunds.filter(f => myFundIds.includes(f.id));
            }

            setFundPeriods(displayFunds);

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
        if (!qrFile && !qrPreview) return; // Nothing to save
        setIsSavingQr(true);
        try {
            let finalUrl = qrPreview;

            if (qrFile) {
                // 1. Upload to Storage
                const fileExt = qrFile.name.split('.').pop();
                const fileName = `${userProfile?.id}/qr-code-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('qr-codes').upload(fileName, qrFile, { upsert: true });
                if (uploadError) throw uploadError;

                // 2. Get Public URL
                const { data: urlData } = await supabase.storage.from('qr-codes').getPublicUrl(fileName);
                finalUrl = urlData.publicUrl;
            }

            // 3. Update Profile
            if (userProfile?.id && finalUrl) {
                await supabase.from('profiles').update({ qr_code_url: finalUrl }).eq('id', userProfile.id);
                // Update local state immediately
                setAllProfiles(prev => prev.map(p => p.id === userProfile.id ? { ...p, qr_code_url: finalUrl as string } : p));
                setShowConfigModal(false);
                setQrFile(null);
                setQrPreview(null);
                showToast("Đã lưu QR Code mới cho Team!", 'success');
            }
        } catch (e: any) {
            console.error(e);
            showToast("Lỗi lưu QR: " + e.message, 'error');
        } finally {
            setIsSavingQr(false);
        }
    };

    const handleApprove = async (t: Transaction, approve: boolean) => {
        try { await supabase.from('transactions').update({ status: approve ? 'approved' : 'rejected', approved_by: userProfile?.id }).eq('id', t.id); fetchDataWithIsolation(); showToast(approve ? "Đã duyệt!" : "Đã từ chối!", 'success'); } catch (e: any) { showToast("Lỗi xử lý.", 'error'); }
    };

    const confirmDeleteTransaction = async () => {
        if (!transactionToDelete) return;
        try { await supabase.from('transactions').delete().eq('id', transactionToDelete.id); setTransactionToDelete(null); fetchDataWithIsolation(); showToast("Đã xóa giao dịch!", 'success'); } catch (e: any) { showToast("Lỗi xóa.", 'error'); }
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
                approved_by: status === 'approved' ? userProfile?.id : null,
                fund_period_id: expenseForm.fundPeriodId || null
            }]);
            if (error) throw error;
            setShowExpenseModal(false); setExpenseForm({ amount: '', reason: '', fundPeriodId: '' }); fetchDataWithIsolation(); showToast(status === 'approved' ? "Đã duyệt Chi tiền" : "Đã gửi yêu cầu Chi!", 'success');
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
        } catch (e: any) { showToast("Lỗi tạo khoản nợ", 'error'); }
    };

    // NEW: Handle Submit Borrow (Loan) from Finance Page
    const handleSubmitBorrow = async () => {
        const amount = Number(borrowForm.amount.replace(/\./g, ''));
        if (!amount || amount <= 0 || !borrowForm.date || !borrowForm.customerId) { showToast("Vui lòng nhập đủ thông tin!", 'error'); return; }

        try {
            // Check Daily Limit (100M) for User
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { data: todayLoans } = await supabase.from('transactions')
                .select('amount')
                .eq('user_id', userProfile?.id)
                .eq('type', 'loan')
                .gte('created_at', todayStart.toISOString())
                .neq('status', 'rejected');

            const currentTotal = todayLoans?.reduce((sum, t) => sum + t.amount, 0) || 0;
            if (currentTotal + amount > 100_000_000) {
                showToast(`Vượt quá hạn mức mượn trong ngày (Đã mượn: ${formatCurrency(currentTotal)}, Hạn mức: 100tr)`, 'error');
                return;
            }

            const cust = allCustomers.find(c => c.id === borrowForm.customerId);

            const { data, error } = await supabase.from('transactions').insert([{
                customer_id: borrowForm.customerId,
                customer_name: cust?.name,
                user_id: userProfile?.id,
                user_name: userProfile?.full_name,
                type: 'loan',
                amount: amount,
                target_date: borrowForm.date,
                reason: `Mượn tiền (Trả: ${new Date(borrowForm.date).toLocaleDateString('vi-VN')})`,
                status: (isAdmin || isMod) ? 'approved' : 'pending',
                approved_by: (isAdmin || isMod) ? userProfile?.id : null
            }]).select().single();
            if (error) throw error;

            setTransactions(prev => [data as Transaction, ...prev]);
            setShowBorrowModal(false);
            setBorrowForm({ customerId: '', amount: '', date: '', reason: '' });

            const msg = (isAdmin || isMod) ? "Đã tạo khoản vay thành công!" : "Đã gửi yêu cầu mượn tiền!";
            showToast(msg, 'success');
        } catch (e: any) {
            showToast("Lỗi: " + e.message, 'error');
        }
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
            setTransactions(prev => [data as Transaction, ...prev.map(t => t.id === dealerDebtToConfirm.id ? { ...t, reason: `${t.reason} (Đã thu)` } : t)]);
            showToast("Đã thu nợ thành công!");
        } catch (e: any) { showToast("Lỗi: " + (e.message || "Unknown"), 'error'); } finally { setDealerDebtToConfirm(null); }
    };

    // --- FUND PERIOD HANDLERS (Create / Edit) ---
    const handleCloseFund = async () => {
        if (!closeFundForm.name || !closeFundForm.startDate) {
            showToast("Vui lòng nhập tên quỹ và ngày bắt đầu", 'error');
            return;
        }

        // VALIDATION: Check for overlap with existing fund periods (TEAM SCOPED)
        const newStartDate = new Date(closeFundForm.startDate);

        // Determine current team context for overlap check
        const currentTeamId = isMod ? userProfile?.id : (isAdmin && selectedTeam !== 'all' ? selectedTeam : null);

        // Only check overlap within the same team
        for (const period of fundPeriods) {
            // Skip periods from other teams (if team filter is active)
            if (currentTeamId && period.manager_id !== currentTeamId) continue;

            // Skip self if editing
            if (isEditingFund && period.id === isEditingFund) continue;

            const existingStart = new Date(period.start_date);
            const existingEnd = period.end_date ? new Date(period.end_date) : new Date(); // Open period assumes "now" as end

            // Check if new start date falls within an existing period (inclusive)
            if (newStartDate >= existingStart && newStartDate <= existingEnd) {
                // Calculate next valid date (day after existing end)
                const nextValidDate = new Date(existingEnd);
                nextValidDate.setDate(nextValidDate.getDate() + 1);
                const nextValidStr = nextValidDate.toISOString().split('T')[0];

                showToast(`Ngày bắt đầu trùng với kỳ quỹ "${period.name}". Vui lòng chọn từ ngày ${nextValidStr} trở đi.`, 'error');
                return;
            }
        }

        setIsClosingFund(true);
        try {
            const periodData: Partial<FundPeriod> = {
                name: closeFundForm.name,
                start_date: closeFundForm.startDate,
                end_date: closeFundForm.endDate || undefined,
                closed_at: closeFundForm.endDate ? new Date().toISOString() : undefined,
                closed_by: closeFundForm.endDate ? userProfile?.id : undefined,
                manager_id: isMod ? userProfile?.id : (isAdmin && selectedTeam !== 'all' ? selectedTeam : undefined)
            };

            if (isEditingFund) {
                // --- UPDATE EXISTING FUND ---
                const { error } = await supabase
                    .from('fund_periods')
                    .update(periodData)
                    .eq('id', isEditingFund);

                if (error) throw error;

                // Sync Members for Edit
                const currentMemberIds = fundMembersMap.filter(m => m.fund_id === isEditingFund).map(m => m.user_id);
                const toAdd = selectedFundMembers.filter(uid => !currentMemberIds.includes(uid));
                const toRemove = currentMemberIds.filter(uid => !selectedFundMembers.includes(uid));

                if (toRemove.length > 0) {
                    await supabase.from('fund_members').delete().eq('fund_id', isEditingFund).in('user_id', toRemove);
                }
                if (toAdd.length > 0) {
                    const insertRows = toAdd.map(uid => ({ fund_id: isEditingFund, user_id: uid }));
                    await supabase.from('fund_members').insert(insertRows);
                }

                // Update Local State
                setFundPeriods(prev => prev.map(p => p.id === isEditingFund ? { ...p, ...periodData, id: p.id } as FundPeriod : p)); // Ensure ID persists
                setFundMembersMap(prev => {
                    const next = prev.filter(m => !(m.fund_id === isEditingFund && toRemove.includes(m.user_id)));
                    const newEntries = toAdd.map(uid => ({ fund_id: isEditingFund!, user_id: uid }));
                    return [...next, ...newEntries];
                });

                showToast("Đã cập nhật kỳ quỹ!", 'success');

            } else {
                // --- CREATE NEW FUND ---
                const { data, error } = await supabase
                    .from('fund_periods')
                    .insert([periodData])
                    .select()
                    .single();

                if (error) throw error;

                if (selectedFundMembers.length > 0) {
                    const membersToInsert = selectedFundMembers.map(uid => ({
                        fund_id: (data as FundPeriod).id,
                        user_id: uid
                    }));
                    const { error: memberError } = await supabase.from('fund_members').insert(membersToInsert);
                    if (memberError) {
                        console.error('Error inserting members:', memberError);
                        showToast("Tạo quỹ thành công nhưng lỗi thêm thành viên: " + memberError.message, 'error'); // Use 'error' type
                    } else {
                        const newMembers = selectedFundMembers.map(uid => ({ fund_id: (data as FundPeriod).id, user_id: uid }));
                        setFundMembersMap(prev => [...prev, ...newMembers]);
                    }
                }

                setFundPeriods(prev => [data as FundPeriod, ...prev]);
                showToast("Đã tạo kỳ quỹ mới!", 'success');
            }

            setShowCloseFundModal(false);
            setCloseFundForm({ name: '', startDate: '', endDate: '' });
            setSelectedFundMembers([]);
            setIsEditingFund(null);

        } catch (e: any) {
            showToast("Lỗi xử lý quỹ: " + e.message, 'error');
        } finally {
            setIsClosingFund(false);
        }
    };

    // NEW: Handle User KPI Config Save
    const handleSaveUserKpiConfig = async () => {
        if (!targetUserForKpiConfig) return;
        const rateVal = parseFloat(userKpiConfigValue);
        if (isNaN(rateVal) || rateVal < 0) {
            showToast("Vui lòng nhập số hợp lệ", 'error');
            return;
        }

        const finalRate = rateVal / 100; // 5 -> 0.05
        const key = `kpi_penalty_rate_USER_${targetUserForKpiConfig.id}`;

        try {
            // Upsert (Check conflict based on KEY + MANAGER_ID constraint, but here manager_id specific?)
            // We use manager_id = NULL for global, but here we want to ensure uniqueness.
            // Our index is unique on (key, coalesce(manager_id...)).
            // We can just use manager_id = null for simplicity, OR rely on the KEY being unique enough conceptually.
            // But if we want to separate "My setting for this user" vs "Others setting", we might need manager_id.
            // Let's stick effectively to: Key is Unique for "User Config".
            // Since User ID is IN the key, we don't need manager_id differentiation unless multiple managers rate the same user differently?
            // Assuming Global/Shared setting for that user in the team context.
            // Let's use manager_id = NULL so it's visible globally? Or UserProfile.manager_id?
            // Actually, keep it simple: manager_id = NULL (as it's a "System" or "Absolute" override for now).

            // Check if exists
            const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).maybeSingle();

            if (existing) {
                await supabase.from('app_settings').update({ value: finalRate.toString(), updated_by: userProfile?.id }).eq('id', existing.id);
            } else {
                await supabase.from('app_settings').insert([{ key: key, value: finalRate.toString(), updated_by: userProfile?.id, manager_id: null }]);
            }

            setUserPenaltyRates(prev => ({ ...prev, [targetUserForKpiConfig.id]: finalRate }));
            setShowUserKpiConfigModal(false);
            showToast(`Đã lưu tỉ lệ phạt riêng cho ${targetUserForKpiConfig.full_name}!`, 'success');

        } catch (e: any) {
            showToast("Lỗi lưu cấu hình: " + e.message, 'error');
        }
    };

    // Fund Warning State
    const [fundWarning, setFundWarning] = useState<{
        visible: boolean;
        periodId: string;
        issues: { id: string; name: string; sales: string; reasons: string[] }[];
        loading: boolean;
    }>({ visible: false, periodId: '', issues: [], loading: false });

    // Handle marking a fund period as completed (archived)
    const handleCompleteFund = async (periodId: string, force = false) => {
        if (!force) {
            // Validation Phase
            setFundWarning({ visible: true, periodId, issues: [], loading: true });
            try {
                const period = fundPeriods.find(p => p.id === periodId);
                if (!period) throw new Error("Không tìm thấy kỳ quỹ");

                // 1. COMPREHENSIVE IDENTIFICATION
                // We need to identify ALL customers relevant to this period by TWO criteria:
                // A. Customers CREATED in this period (New customers)
                // B. Customers with TRANSACTIONS in this period (Old customers active now)

                // Comprehensive Customer Identification (BROAD SCAN for MKT)
                // We scan all MKT customers with relevant statuses to ensure "Silent Debtors" are caught
                const distinctIds = new Set<string>();

                // Strategy: Fetch ALL MKT Customers and filter in JS for maximum reliability
                // This avoids complex OR queries and ensures we catch "Silent Debtors" (e.g. Completed but with Debt)
                // INCREASED RANGE to 20,000 to avoid default 1000 row limit
                let qBroad = supabase
                    .from('customers')
                    .select('id, status, deal_status')
                    .ilike('source', '%mkt%')
                    .range(0, 20000);

                const { data: broadData, error: broadErr } = await qBroad;
                if (broadErr) throw broadErr;

                (broadData || []).forEach(c => {
                    const statusLower = (c.status || '').toLowerCase();
                    const dealStatus = (c.deal_status || '').toLowerCase();

                    // Systematic Fix: REMOVE Status Filters
                    // We scan ALL MKT customers to find "Silent Debtors" regardless of their status label.
                    // We only exclude explicitly "Lost" or "Cancelled" customers.

                    const isLost = statusLower.includes('hủy') || statusLower.includes('lost') || dealStatus.includes('cancel') || dealStatus.includes('lost');

                    if (!isLost) {
                        distinctIds.add(c.id);
                    }
                });

                // Also include explicitly assigned customers (even if not MKT)
                const { data: assignedIds } = await supabase.from('customers').select('id').eq('fund_period_id', periodId);
                (assignedIds || []).forEach(x => distinctIds.add(x.id));

                const targetCustomerIds = Array.from(distinctIds);
                let periodCustomers: Customer[] = [];
                let allCustTrans: any[] = [];

                // 2. FETCH DETAILS (Chunked to avoid 400 Bad Request)
                if (targetCustomerIds.length > 0) {
                    const chunkSize = 20;
                    const chunks = [];
                    for (let i = 0; i < targetCustomerIds.length; i += chunkSize) {
                        chunks.push(targetCustomerIds.slice(i, i + chunkSize));
                    }

                    // A. Fetch Customer Profiles
                    const custPromises = chunks.map(chunk =>
                        supabase.from('customers').select('*').in('id', chunk)
                    );
                    const custResults = await Promise.all(custPromises);
                    for (const res of custResults) {
                        if (res.error) throw res.error;
                        if (res.data) periodCustomers = [...periodCustomers, ...res.data];
                    }

                    // B. Fetch Lifetime Transactions (for Debt Check)
                    const transPromises = chunks.map(chunk =>
                        supabase.from('transactions').select('*').in('customer_id', chunk)
                    );
                    const transResults = await Promise.all(transPromises);
                    for (const res of transResults) {
                        if (res.error) throw res.error;
                        if (res.data) allCustTrans = [...allCustTrans, ...res.data];
                    }
                }

                const periodTrans = allCustTrans;

                const detectedIssues: { id: string; name: string; sales: string; reasons: string[] }[] = [];

                // 3. Analyze each customer
                for (const c of (periodCustomers as Customer[])) {
                    // Skip LOST/REFUNDED customers
                    if (['Đã hủy', 'Chờ duyệt hủy'].includes(c.status)) continue;

                    // Allow suspended now as per broader logic, but skip refunded if no debt?
                    // actually, keep skipping refunded unless debt check?
                    // Previous logic skipped refunded. Let's stick to 'Active' statuses.
                    if (['refunded', 'cancelled'].includes(c.deal_status || '')) continue;

                    // Team Filter Logic (Case Insensitive Match)
                    // Fixes issue where "Nguyễn Nhất TRung" (Customer) != "Nguyễn Nhất Trung" (Profile)
                    const sRepName = (c.sales_rep || '').toLowerCase().trim();
                    const salesProfile = allProfiles.find(p =>
                        (p.full_name || '').toLowerCase().trim() === sRepName ||
                        (p.email || '').toLowerCase().trim() === sRepName
                    );

                    if (isAdmin) {
                        if (selectedTeam !== 'all') {
                            if (salesProfile) {
                                if (salesProfile.manager_id !== selectedTeam && salesProfile.id !== selectedTeam) continue;
                            }
                        }
                    } else if (isMod) {
                        // For Mods, if profile is not found (e.g. name typo), we strictly skip?
                        // Or should we fallback to Creator ID?
                        // Current logic: If name matches Self or Subordinate.
                        // If name mismatch/unfound, filtered out.

                        const isSelf = salesProfile?.id === userProfile?.id;
                        const isSubordinate = salesProfile?.manager_id === userProfile?.id;
                        if (!isSelf && !isSubordinate) continue;
                    }

                    // MKT Filter: Only warn for MKT Group customers
                    if (!c.source?.toLowerCase().includes('mkt')) continue;

                    // --- NEW: Filter by Fund Period Dates or Explicit Assignment ---

                    // 1. Check Explicit Assignment Authorization (Highest Priority)
                    if (c.fund_period_id) {
                        // If explicitly assigned to another fund, skip
                        if (c.fund_period_id !== period.id) continue;
                        // If assigned to THIS fund, proceed (skip date check)
                    } else {
                        // 2. Date-based Fallback
                        const cDate = new Date(c.created_at);
                        const pStart = new Date(period.start_date);
                        // Reset time to ensure strict comparison
                        pStart.setHours(0, 0, 0, 0);

                        if (cDate < pStart) continue;

                        if (period.end_date) {
                            const pEnd = new Date(period.end_date);
                            pEnd.setHours(23, 59, 59, 999); // End of Day
                            if (cDate > pEnd) continue;
                        }
                    }
                    // ----------------------------------------

                    // Only check WON or potential if logic dictates? Usually only WON matters for debt.
                    // If status is NEW/CONTACTED/POTENTIAL, do they have debt? Maybe advance?

                    const cReasons: string[] = [];
                    // Filter transactions for this customer ONCE at top of loop
                    const cTrans = (periodTrans as Transaction[]).filter(t => t.customer_id === c.id);

                    // Check A: Money Recovery (For WON or Processing deals)
                    // Expanded status check: WON, or Deal Processing, or has Deposit
                    const hasDeal = c.status === CustomerStatus.WON ||
                        c.status === CustomerStatus.WON_PENDING ||
                        (c.deal_status === 'processing');

                    if (hasDeal || c.delivery_progress?.['deposited']?.completed) {
                        const isMoneyDone = c.delivery_progress?.['money_recovered']?.completed;
                        if (!isMoneyDone) {
                            // Calculate saleDebt: (Revenue - Incurred) - Deposited
                            // This matches the getCustomerDebt logic in Deals.tsx
                            const incurred = cTrans
                                .filter(t => t.type === 'incurred_expense' && t.status === 'approved')
                                .reduce((sum, t) => sum + t.amount, 0);
                            const deposited = cTrans
                                .filter(t => t.type === 'deposit' && t.status === 'approved')
                                .reduce((sum, t) => sum + t.amount, 0);

                            // Use actual_revenue first (like Deals.tsx line 733)
                            const baseRevenue = c.deal_details?.actual_revenue || c.deal_details?.revenue || 0;
                            const saleDebt = Math.max(0, (baseRevenue - incurred) - deposited);

                            // Modified: Only warn if there is ACTUAL sale debt (> 0)
                            // If debt is 0, we treat it as recovered (or not requiring recovery), ignoring the step checkbox
                            if (saleDebt > 0) {
                                const pendingStr = `: ${saleDebt.toLocaleString('vi-VN')} đ`;
                                cReasons.push(`Chưa hoàn tất thu hồi công nợ (Chưa vào quỹ${pendingStr})`);
                            }
                        }
                    }

                    // Check B: Debt Balance (Lifetime for this customer)
                    // cTrans is already defined above
                    const debt = cTrans
                        .filter(t => ['dealer_debt', 'advance', 'loan'].includes(t.type) && t.status === 'approved')
                        .reduce((sum, t) => sum + t.amount, 0);
                    const repaid = cTrans
                        .filter(t => ['repayment', 'loan_repayment'].includes(t.type) && t.status === 'approved')
                        .reduce((sum, t) => sum + t.amount, 0);

                    const remainingDebt = debt - repaid;
                    if (remainingDebt > 0) {
                        cReasons.push(`Còn nợ quỹ: ${remainingDebt.toLocaleString('vi-VN')} đ`);
                    }

                    if (cReasons.length > 0) {
                        // Find Sales Rep Name
                        const salesProfile = allProfiles.find(p => p.full_name === c.sales_rep || p.email === c.sales_rep) || { full_name: c.sales_rep || 'N/A' };

                        detectedIssues.push({
                            id: c.id,
                            name: c.name,
                            sales: salesProfile.full_name,
                            reasons: cReasons
                        });
                    }
                }

                if (detectedIssues.length > 0) {
                    setFundWarning({
                        visible: true,
                        periodId,
                        issues: detectedIssues,
                        loading: false
                    });
                    return; // Stop here, show modal
                } else {
                    setFundWarning(prev => ({ ...prev, visible: false }));
                    // No issues, proceed to confirm logic below
                }

            } catch (e: any) {
                console.error(e);
                showToast("Lỗi kiểm tra dữ liệu: " + e.message, 'error');
                setFundWarning(prev => ({ ...prev, visible: false }));
                return;
            }
        }

        // CONFIRMATION (If no issues or forced)
        if (!force && !window.confirm('Xác nhận hoàn thành quỹ? Quỹ sẽ được lưu trữ và không thể chỉnh sửa thêm.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('fund_periods')
                .update({
                    is_completed: true,
                    completed_at: new Date().toISOString()
                })
                .eq('id', periodId);

            if (error) throw error;

            // Update local state
            setFundPeriods(prev => prev.map(p =>
                p.id === periodId
                    ? { ...p, is_completed: true, completed_at: new Date().toISOString() }
                    : p
            ));

            // Reset selection if completed fund was selected
            if (selectedFundPeriod === periodId) {
                setSelectedFundPeriod('all');
            }

            // Close modal if open
            setFundWarning(prev => ({ ...prev, visible: false }));
            showToast("Đã hoàn thành quỹ!", 'success');
        } catch (e: any) {
            showToast("Lỗi: " + e.message, 'error');
        }
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
        } catch (e: any) { showToast("Lỗi cập nhật", 'error'); }
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
        } catch (e: any) { console.error(e); }
    };

    // --- PAYOUT HANDLERS ---
    const isSalaryPayout = (t: ExtendedTransaction) => t.type === 'expense' && t.reason.startsWith('Chi lương:');

    // --- SALARY MODAL FUNCTIONS --- (State is at top level)

    const openSalaryModal = (user: UserProfile, maxAmount: number) => {
        setSalaryPayoutTarget({ user, maxAmount });
        setSalaryPayoutAmount('');
        setShowSalaryConfirmModal(true);
    };

    const confirmPaySalary = async () => {
        if (!salaryPayoutTarget || !salaryPayoutAmount) return;

        // Remove non-numeric chars (commas, dots) before parsing
        const rawAmount = salaryPayoutAmount.replace(/[^0-9]/g, '');
        const amount = Number(rawAmount);

        if (isNaN(amount) || amount <= 0) { showToast("Số tiền không hợp lệ", 'error'); return; }

        // Validation: Cannot pay more than Estimated Net Income (if logic requires)
        // User Request: "Số tiền chi không được vượt quá (Thực nhận (Dự kiến)) hiện tại"
        if (amount > salaryPayoutTarget.maxAmount) {
            showToast(`Số tiền chi không được vượt quá số thực nhận (${salaryPayoutTarget.maxAmount.toLocaleString('vi-VN')} đ)`, 'error');
            return;
        }

        const user = salaryPayoutTarget.user;
        const timeLabel = selectedMonth === 'all' ? `Năm ${selectedYear}` : typeof selectedMonth === 'number' ? `T${selectedMonth}/${selectedYear}` : `${selectedMonth.toUpperCase()}/${selectedYear}`;

        try {
            const { error } = await supabase.from('transactions').insert([{
                user_id: user.id,
                user_name: user.full_name,
                type: 'expense',
                amount: Math.floor(amount),
                reason: `Chi lương: ${user.full_name} - ${timeLabel}`,
                status: 'approved',
                approved_by: userProfile?.id
            }]);
            if (error) throw error;
            fetchDataWithIsolation();
            setShowSalaryConfirmModal(false);
            setSalaryPayoutTarget(null);
            showToast(`Đã chi lương cho ${user.full_name}!`, 'success');
        } catch (e: any) {
            showToast("Lỗi chi lương: " + e.message, 'error');
        }
    };

    const handlePayAllSalaries = async () => {
        const salaryCandidates = profitSharingData.filter(row => row.estimatedIncome > 1000); // Only pay if > 1000 VND
        if (salaryCandidates.length === 0) { showToast("Không có nhân viên nào cần chi lương.", 'error'); return; }

        const totalAmt = salaryCandidates.reduce((s, r) => s + r.estimatedIncome, 0);
        if (!window.confirm(`Xác nhận CHI LƯƠNG cho ${salaryCandidates.length} nhân viên? Tổng tiền: ${totalAmt.toLocaleString('vi-VN')} đ`)) return;

        const timeLabel = selectedMonth === 'all' ? `Năm ${selectedYear}` : typeof selectedMonth === 'number' ? `T${selectedMonth}/${selectedYear}` : `${selectedMonth.toUpperCase()}/${selectedYear}`;

        try {
            const transactions = salaryCandidates.map(row => ({
                user_id: row.user.id,
                user_name: row.user.full_name,
                type: 'expense',
                amount: Math.floor(row.estimatedIncome),
                reason: `Chi lương: ${row.user.full_name} - ${timeLabel}`,
                status: 'approved',
                approved_by: userProfile?.id
            }));

            const { error } = await supabase.from('transactions').insert(transactions);
            if (error) throw error;

            fetchDataWithIsolation();
            showToast(`Đã chi lương cho ${salaryCandidates.length} nhân viên!`, 'success');
        } catch (e: any) {
            showToast("Lỗi chi lương hàng loạt: " + e.message, 'error');
        }
    };

    // Relaxed MKT check (Case Insensitive)
    const isMKT = (src?: string) => (src || '').toUpperCase().includes('MKT');

    const isInMonthYear = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();

        if (y !== selectedYear) return false;

        if (selectedMonth === 'all') return true;
        if (typeof selectedMonth === 'number') return m === selectedMonth;
        if (selectedMonth === 'q1') return [1, 2, 3].includes(m);
        if (selectedMonth === 'q2') return [4, 5, 6].includes(m);
        if (selectedMonth === 'q3') return [7, 8, 9].includes(m);
        if (selectedMonth === 'q4') return [10, 11, 12].includes(m);

        return false;
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
                if (!isMKT(t._source)) return false;
            }

            // NEW: Fund Period Filter for Transactions
            // Key Logic: Transactions are assigned to a period based on their CUSTOMER's created_at
            // This ensures that old customers' payments (even if made after closing) stay in old period
            if (selectedFundPeriod !== 'all') {
                const period = fundPeriods.find(p => p.id === selectedFundPeriod);
                if (period) {
                    if (t.customer_id) {
                        // Transaction has customer → use customer's Explicit Fund Period or created_at
                        const customer = allCustomers.find(c => c.id === t.customer_id);
                        if (customer) {
                            // NEW: Explicit Fund Assignment Check
                            if (customer.fund_period_id) {
                                if (customer.fund_period_id !== selectedFundPeriod) return false;
                                // If matches, proceed (skip date check)
                            } else {
                                // Fallback: Date Check
                                const customerDate = new Date(customer.created_at);
                                const periodStart = new Date(period.start_date);

                                // Reset strict check logic to standard logic
                                if (customerDate < periodStart) return false;

                                if (period.end_date) {
                                    const periodEnd = new Date(period.end_date);
                                    periodEnd.setHours(23, 59, 59, 999);
                                    if (customerDate > periodEnd) return false;
                                }
                            }
                        }
                    } else {
                        // Transaction has NO customer (advance, expense, adjustment, dealer_debt)

                        // NEW: Explicit Fund Assignment Check
                        if (t.fund_period_id) {
                            if (t.fund_period_id !== selectedFundPeriod) return false;
                        } else {
                            // Link by Date (Fallback)
                            const transDate = new Date(t.created_at);
                            const periodStart = new Date(period.start_date);

                            if (transDate < periodStart) return false;

                            if (period.end_date) {
                                const periodEnd = new Date(period.end_date);
                                periodEnd.setHours(23, 59, 59, 999);
                                if (transDate > periodEnd) return false;
                            }
                        }
                    }
                }
            }

            return true;
        });
    }, [transactions, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, allProfiles, userProfile, selectedFundPeriod, fundPeriods, allCustomers]);

    const filteredCustomers = useMemo(() => {
        return allCustomers.filter(c => {
            if (filterMode === 'creation') {
                const d = new Date(c.created_at);
                const m = d.getMonth() + 1;
                const y = d.getFullYear();

                let inRange = false;
                if (y === selectedYear) {
                    if (selectedMonth === 'all') inRange = true;
                    else if (typeof selectedMonth === 'number') inRange = m === selectedMonth;
                    else if (selectedMonth === 'q1') inRange = [1, 2, 3].includes(m);
                    else if (selectedMonth === 'q2') inRange = [4, 5, 6].includes(m);
                    else if (selectedMonth === 'q3') inRange = [7, 8, 9].includes(m);
                    else if (selectedMonth === 'q4') inRange = [10, 11, 12].includes(m);
                }
                if (!inRange) return false;

            } else {
                // 'deal' mode -> Use Effective Date Logic (Deal Close Date)
                if (c.status !== CustomerStatus.WON) return false;

                // CRITICAL FIX: Do NOT use updated_at. It causes deals to jump months when edited.
                // Use won_at (Deal Close). If missing, use created_at (Deal Start).
                // Never use updated_at for Finance Period placement.
                const effectiveDate = c.won_at || c.created_at || '';
                if (!isInMonthYear(effectiveDate)) return false;
            }
            if (c.deal_status === 'suspended' || c.deal_status === 'suspended_pending' || c.deal_status === 'refunded' || c.deal_status === 'refund_pending') return false;

            // Check Source with relaxed logic
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

            // NEW: Fund Period Filter - Customers are assigned based on created_at
            // NEW: Fund Period Filter - Customers are assigned based on created_at OR explicit assignment
            if (selectedFundPeriod !== 'all') {
                // NEW: Explicit Check
                if (c.fund_period_id) {
                    if (c.fund_period_id !== selectedFundPeriod) return false;
                    // If matched, we skip date check
                } else {
                    const period = fundPeriods.find(p => p.id === selectedFundPeriod);
                    if (period) {
                        const customerDate = new Date(c.created_at);
                        const periodStart = new Date(period.start_date);

                        // Customer must be created on or after period start
                        if (customerDate < periodStart) return false;

                        // If period has end_date, customer must be created on or before end
                        if (period.end_date) {
                            const periodEnd = new Date(period.end_date);
                            periodEnd.setHours(23, 59, 59, 999); // Include entire end day
                            if (customerDate > periodEnd) return false;
                        }
                    }
                }
            }

            return true;
        });
    }, [allCustomers, filterMode, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, allProfiles, userProfile, selectedFundPeriod, fundPeriods]);

    const exclusionCandidates = useMemo(() => {
        if (!targetUserForExclusion) return [];
        return allCustomers.filter(c => {
            if (!isMKT(c.source)) return false;
            if (c.status !== CustomerStatus.WON) return false;
            if (c.deal_status === 'refunded' || c.deal_status === 'refund_pending' || c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') return false;

            // Use same date logic as main filter to be consistent
            const effectiveDate = c.won_at || c.created_at || '';
            if (!isInMonthYear(effectiveDate)) return false;

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
            // STRICT REQUIREMENT: Only active WON deals in 'processing' state
            if (c.status !== CustomerStatus.WON) return false;
            if (c.deal_status !== 'processing') return false; // Excludes: refunded, suspended, completed, etc.

            // Source Check: Must contain "MKT" (Case insensitive preferably)
            if (!isMKT(c.source)) return false;

            // Permission Check
            if (isAdmin) {
                if (selectedTeam !== 'all') {
                    const creator = allProfiles.find(p => p.id === c.creator_id);
                    // Also check Sales Rep's team if strictly assigned?
                    // For now, stick to Creator's team or if Sales Rep is in team.
                    // Let's simplify: Any customer handled by this team.
                    const salesRepProfile = allProfiles.find(p => p.full_name === c.sales_rep);
                    const isCreatorInTeam = creator?.manager_id === selectedTeam || creator?.id === selectedTeam;
                    const isRepInTeam = salesRepProfile?.manager_id === selectedTeam || salesRepProfile?.id === selectedTeam;

                    return isCreatorInTeam || isRepInTeam;
                }
                return true;
            }
            if (isMod) {
                const creator = allProfiles.find(p => p.id === c.creator_id);
                const salesRepProfile = allProfiles.find(p => p.full_name === c.sales_rep);

                const isCreatorSelf = c.creator_id === userProfile?.id;
                const isCreatorSub = creator?.manager_id === userProfile?.id;

                const isRepSelf = c.sales_rep === userProfile?.full_name; // Check Name
                const isRepSub = salesRepProfile?.manager_id === userProfile?.id;

                return isCreatorSelf || isCreatorSub || isRepSelf || isRepSub;
            }
            // Regular: Creator OR Assigned Sales Rep
            return c.creator_id === userProfile?.id || c.sales_rep === userProfile?.full_name;
        });
    }, [allCustomers, allProfiles, isAdmin, isMod, selectedTeam, userProfile]);

    // --- Calculations ---

    const pnlRevenue = filteredTransactions.filter(t => t.status === 'approved' && ['deposit', 'adjustment'].includes(t.type) && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const realExpenses = filteredTransactions.filter(t => t.status === 'approved' && (t.type === 'expense' || (t.type === 'adjustment' && t.amount < 0))).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const partTimeSalaryLiability = filteredTransactions.filter(t => t._is_part_time_creator && ['deposit'].includes(t.type) && t.status === 'approved').reduce((sum, t) => sum + (t.amount * 0.3), 0);

    const displayTotalExpense = realExpenses + partTimeSalaryLiability;
    const pnlNet = pnlRevenue - displayTotalExpense;

    const totalIn = filteredTransactions.filter(t => ['deposit', 'adjustment', 'repayment', 'loan_repayment'].includes(t.type) && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    // Modified TotalOut: Include Salary Payouts in the "Actual Cash" calculation
    const totalOut = filteredTransactions.filter(t => t.status === 'approved' && (['expense', 'advance', 'loan'].includes(t.type) || (t.type === 'adjustment' && t.amount < 0))).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Separate Salary Payouts from Total Out for Pool Calculation
    const totalSalaryPayouts = filteredTransactions.filter(t => t.status === 'approved' && isSalaryPayout(t)).reduce((sum, t) => sum + t.amount, 0);

    // Actual Cash in Hand (Display) = Total In - Total Out (Everything)
    const fundRemaining = totalIn - totalOut - partTimeSalaryLiability;

    // Calculation Pool (Gross) for Bonus Share = Fund Remaining + Salary Payouts
    // Explanation: If I pay 10M salary, Fund drops 10M. But that 10M should still be part of the "Shareable Pool" 
    // so that OTHER employees' shares don't drop.
    const fundCalculationPool = fundRemaining + totalSalaryPayouts;

    // --- PROFIT SHARING CALCULATION (WITH REDISTRIBUTION) ---
    const profitSharingData: ProfitShareRow[] = useMemo(() => {
        // Base Eligible: Full-time + Active + Not Admin
        let eligibleProfiles = allProfiles.filter(p => !p.is_part_time && p.status === 'active' && p.role !== 'admin');

        // 1. Filter by Fund Membership (if current period)
        if (selectedFundPeriod !== 'all') {
            const membersInFund = fundMembersMap.filter(m => m.fund_id === selectedFundPeriod).map(m => m.user_id);
            // If defined, strictly use; else fallback to all eligible?
            // "Quỹ A (Set NV 1,2,3)" implies strict filtering.
            if (membersInFund.length > 0) {
                eligibleProfiles = eligibleProfiles.filter(p => membersInFund.includes(p.id));
            } else {
                // Legacy support: If no members defined for this fund, maybe show all (or none? Safe is all for now)
            }
        }

        // 2. Filter by Permission Scope (View)
        if (isAdmin && selectedTeam !== 'all') {
            eligibleProfiles = eligibleProfiles.filter(p => p.manager_id === selectedTeam || p.id === selectedTeam);
        } else if (isMod) {
            eligibleProfiles = eligibleProfiles.filter(p => p.id === userProfile?.id || p.manager_id === userProfile?.id);
        } else if (!isAdmin && !isMod) {
            eligibleProfiles = eligibleProfiles.filter(p => p.id === userProfile?.id);
        }

        // Initialize Rows
        const rows: ProfitShareRow[] = eligibleProfiles.map(emp => {
            // ... (KPI Logic remains same) ...
            // [Keep KPI Logic Code Here - I will assume it is preserved if not matched exactly, but I can't preserve it without copying]
            // RE-WRITING KPI LOGIC SHORTLY TO FIT CHUNK LIMIT

            // UPDATED: Find KPI for the SELECTED Month/Year
            let kpiTarget = emp.kpi_target || 0;
            if (typeof selectedMonth === 'number') {
                const specificKPI = allKPIs.find(k => k.user_id === emp.id && k.month === selectedMonth && k.year === selectedYear);
                if (specificKPI) kpiTarget = specificKPI.target;
            } else if (selectedMonth === 'all') {
                const yearlyKPIs = allKPIs.filter(k => k.user_id === emp.id && k.year === selectedYear);
                if (yearlyKPIs.length > 0) {
                    kpiTarget = yearlyKPIs.reduce((sum, k) => sum + k.target, 0) + ((12 - yearlyKPIs.length) * (emp.kpi_target || 0));
                } else {
                    kpiTarget = (emp.kpi_target || 0) * 12;
                }
            } else if (selectedMonth.startsWith('q')) {
                let months: number[] = [];
                if (selectedMonth === 'q1') months = [1, 2, 3];
                if (selectedMonth === 'q2') months = [4, 5, 6];
                if (selectedMonth === 'q3') months = [7, 8, 9];
                if (selectedMonth === 'q4') months = [10, 11, 12];
                const quarterKPIs = allKPIs.filter(k => k.user_id === emp.id && k.year === selectedYear && months.includes(k.month));
                const foundMonths = quarterKPIs.map(k => k.month);
                kpiTarget = quarterKPIs.reduce((sum, k) => sum + k.target, 0) + ((3 - foundMonths.length) * (emp.kpi_target || 0));
            }

            const kpiActual = allCustomers.filter(c => {
                if (c.creator_id !== emp.id || c.status !== CustomerStatus.WON) return false;
                if (c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') return false;
                if (!isMKT(c.source)) return false;
                const effectiveDate = c.won_at || c.created_at || '';
                if (!isInMonthYear(effectiveDate)) return false;
                if (selectedFundPeriod !== 'all') {
                    // NEW: Prioritize Explicit Assignment for KPIs too
                    if (c.fund_period_id) {
                        if (c.fund_period_id !== selectedFundPeriod) return false;
                        // If matches, we include it, skipping date checks below.
                    } else {
                        const period = fundPeriods.find(p => p.id === selectedFundPeriod);
                        if (period) {
                            const cDate = new Date(c.created_at);
                            const pStart = new Date(period.start_date);
                            pStart.setHours(0, 0, 0, 0); // consistency
                            if (cDate < pStart) return false;
                            if (period.end_date) {
                                const pEnd = new Date(period.end_date); pEnd.setHours(23, 59, 59, 999);
                                if (cDate > pEnd) return false;
                            }
                        }
                    }
                }
                return true;
            }).length;

            const missedKpi = Math.max(0, kpiTarget - kpiActual);
            const userExclusions = profitExclusions.filter(ex => ex.user_id === emp.id).map(ex => ex.customer_id);

            const excludedProfit = filteredTransactions
                .filter(t => t.customer_id && userExclusions.includes(t.customer_id) && t.status === 'approved')
                .reduce((sum, t) => {
                    if (['revenue', 'deposit'].includes(t.type)) return sum + t.amount;
                    if (['incurred_expense'].includes(t.type)) return sum - t.amount;
                    return sum;
                }, 0);

            // Deduct Salary Advances specific to THIS user (Strictly "Ứng lương")
            const personalSalaryAdvances = filteredTransactions
                .filter(t => t.user_id === emp.id && t.type === 'advance' && t.status === 'approved' && t.reason.toLowerCase().includes('ứng lương'))
                .reduce((sum, t) => sum + t.amount, 0);

            // Paid Salaries
            const paidSalary = filteredTransactions
                .filter(t => t.user_id === emp.id && t.status === 'approved' && isSalaryPayout(t))
                .reduce((sum, t) => sum + t.amount, 0);

            // Calculate Personal Bonuses (e.g. Demo Car Owner)
            const personalBonus = filteredTransactions
                .filter(t => t.user_id === emp.id && t.type === 'personal_bonus' && t.status === 'approved')
                .reduce((sum, t) => sum + t.amount, 0);

            // NEW: Calculate employee's personal revenue
            const employeeCustomerIds = allCustomers
                .filter(c => c.creator_id === emp.id && (c.source || '').includes('MKT'))
                .map(c => c.id);
            const employeeRevenue = filteredTransactions
                .filter(t => t.customer_id && employeeCustomerIds.includes(t.customer_id) && t.status === 'approved' && t.type === 'deposit')
                .reduce((sum, t) => sum + t.amount, 0);

            // Used for display only
            const teamPoolWithEmployee = fundRemaining - excludedProfit;

            // Initial State for Calculation
            return {
                user: emp,
                kpiTarget,
                kpiActual,
                missedKpi,
                penaltyPercent: 0,
                baseShareRatio: 0,
                finalShareRatio: 0,
                personalNetPool: 0,

                // Fields
                grossShare: 0,
                advanceDeduction: personalSalaryAdvances,
                paidSalary: paidSalary,
                bonusAdjustment: personalBonus, // Start with direct bonus, will adjust redistribution later

                estimatedIncome: 0, // Will be calculated at very end

                excludedCustomerIds: userExclusions,
                excludedProfit: excludedProfit,
                redistributedIncome: 0,
                personalAdvanceDeduction: personalSalaryAdvances + paidSalary, // For Legacy UI compatibility
                personalBonus: personalBonus,
                employeeRevenue: employeeRevenue,
                teamPoolWithEmployee: teamPoolWithEmployee
            };
        });

        const numEmployees = rows.length;
        if (numEmployees === 0) return rows;

        // --- STEP 1: GROSS SHARE ---
        const baseSharePerPerson = fundCalculationPool / numEmployees; // Using Gross Pool
        const baseRatio = 100 / numEmployees;

        rows.forEach(row => {
            row.baseShareRatio = baseRatio;
            row.personalNetPool = baseSharePerPerson;
            row.grossShare = baseSharePerPerson;
        });

        // --- STEP 2: EXCLUSION REDISTRIBUTION ---
        rows.forEach(sourceRow => {
            if (sourceRow.excludedCustomerIds.length === 0) return;
            const excludedAmount = sourceRow.excludedProfit;
            if (excludedAmount <= 0) return;

            const lostAmount = excludedAmount / numEmployees;
            sourceRow.grossShare -= lostAmount;

            const beneficiaries = rows.filter(r => r.user.id !== sourceRow.user.id);
            if (beneficiaries.length > 0) {
                const bonusPerPerson = lostAmount / beneficiaries.length;
                beneficiaries.forEach(b => {
                    b.grossShare += bonusPerPerson;
                    b.redistributedIncome += bonusPerPerson;
                });
            }
        });

        // --- STEP 3: KPI PENALTY ---
        // IMPORTANT: Penalty is calculated on BASE EQUAL SHARE (personalNetPool), NOT on grossShare
        // Example: Pool=100M, 5 employees → Each gets 20M base
        // If Employee A misses KPI (10% penalty) → loses 2M (10% of 20M, NOT 10% of 100M)
        // The 2M is redistributed to employees who met KPI
        const employeesWithFullKpi = rows.filter(r => r.missedKpi === 0);
        rows.forEach(row => {
            if (row.missedKpi > 0) {
                // Determine rate: User Specific > Team Default
                const userRate = userPenaltyRates[row.user.id];
                const effectiveRate = userRate !== undefined ? userRate : kpiPenaltyRate;

                const penaltyPercent = row.missedKpi * effectiveRate; // Dynamic KPI penalty rate
                row.penaltyPercent = penaltyPercent;

                // Calculate penalty on BASE SHARE (after equal division), not modified grossShare
                const penaltyAmount = row.personalNetPool * penaltyPercent;

                row.grossShare -= penaltyAmount;
                row.finalShareRatio = row.baseShareRatio * (1 - penaltyPercent);

                // Redistribute penalty to employees with full KPI
                if (employeesWithFullKpi.length > 0) {
                    const bonusPerPerson = penaltyAmount / employeesWithFullKpi.length;
                    employeesWithFullKpi.forEach(b => {
                        b.grossShare += bonusPerPerson;
                        b.redistributedIncome += bonusPerPerson;
                    });
                }
            } else {
                row.finalShareRatio = row.baseShareRatio;
            }
        });

        // --- STEP 4: DEMO CAR BONUS (COST SHARING) ---
        // Anyone with "personalBonus" (Demo Owner) gets full amount back.
        // Everyone (including owner) pays share.
        const totalBonuses = rows.reduce((sum, r) => sum + r.personalBonus, 0);
        if (totalBonuses > 0) {
            const costPerPerson = totalBonuses / numEmployees;
            rows.forEach(row => {
                row.grossShare -= costPerPerson;
                // If this user is owner, they receive their bonus
                if (row.personalBonus > 0) {
                    row.grossShare += row.personalBonus;
                }
            });
        }

        // --- STEP 5: FINAL NET CALCULATION ---
        rows.forEach(row => {
            // Net Receive = Gross Share - Advance - Salary Paid
            row.estimatedIncome = row.grossShare - row.advanceDeduction - row.paidSalary;
        });

        return rows;
    }, [allProfiles, allCustomers, profitExclusions, filteredTransactions, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, userProfile, allKPIs, selectedFundPeriod, fundPeriods, fundCalculationPool, kpiPenaltyRate, userPenaltyRates]);

    // --- NEW: Employee Performance & Debt Stats ---
    const employeeStats = useMemo(() => {
        let eligibleProfiles = allProfiles.filter(p => !p.is_part_time && p.status === 'active' && p.role !== 'admin');
        if (isAdmin && selectedTeam !== 'all') {
            eligibleProfiles = eligibleProfiles.filter(p => p.manager_id === selectedTeam || p.id === selectedTeam);
        } else if (isMod) {
            eligibleProfiles = eligibleProfiles.filter(p => p.id === userProfile?.id || p.manager_id === userProfile?.id);
        } else if (!isAdmin && !isMod) {
            eligibleProfiles = eligibleProfiles.filter(p => p.id === userProfile?.id);
        }

        // --- NEW: Filter by Fund Membership ---
        if (selectedFundPeriod !== 'all') {
            const membersInFund = fundMembersMap.filter(m => m.fund_id === selectedFundPeriod).map(m => m.user_id);
            if (membersInFund.length > 0) {
                eligibleProfiles = eligibleProfiles.filter(p => membersInFund.includes(p.id));
            }
        }

        return eligibleProfiles.map(emp => {
            // Get Customers for this employee (Filtered by Month/Year/MKT)
            const empCustomers = allCustomers.filter(c => {
                // Ownership: Creator OR Sales Rep (to handle transferred leads)
                const isOwner = c.creator_id === emp.id || c.sales_rep === emp.full_name;
                if (!isOwner) return false;

                // FILTER: Exclude Lost
                if (c.status === CustomerStatus.LOST || c.status === CustomerStatus.LOST_PENDING) return false;

                // REMOVED: Strict WON check to allow Debt visibility for non-won customers
                // if (c.status !== CustomerStatus.WON) return false;

                if (c.deal_status === 'refunded' || c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') return false;

                if (!isMKT(c.source)) return false;

                // CRITICAL FIX: Use won_at (Deal Date) instead of updated_at

                // Fund Period Filtering Logic for Customers
                // If a specific fund period is selected, we filter by creation date falling within that period, IGNORING Month/Year selector
                if (selectedFundPeriod !== 'all') {
                    // NEW: Explicit Check First
                    if (c.fund_period_id) {
                        if (c.fund_period_id !== selectedFundPeriod) return false;
                        // If match, we include it (and skip further date checks below by returning early? No, we need to return TRUE here if strictly matching fund)
                        // Actually, if selectedFundPeriod is active, we IGNORE the Month/Year filter.
                        return true;
                    }

                    const period = fundPeriods.find(p => p.id === selectedFundPeriod);
                    if (period) {
                        const cDate = new Date(c.created_at);
                        const pStart = new Date(period.start_date);
                        // Inclusive check
                        if (period.end_date) {
                            // Closed period: strict range
                            const endDateObj = new Date(period.end_date);
                            endDateObj.setHours(23, 59, 59, 999); // End of day
                            return cDate >= pStart && cDate <= endDateObj;
                        } else {
                            // Open period: strict start, loose end
                            return cDate >= pStart;
                        }
                    }
                }

                if (filterMode === 'creation') {
                    return isInMonthYear(c.created_at);
                } else {
                    return isInMonthYear(c.won_at || c.created_at || '');
                }
            });

            const countWon = empCustomers.filter(c => c.status === CustomerStatus.WON).length; // FIX: Count only WON
            const expectedRevenue = empCustomers
                .filter(c => c.status === CustomerStatus.WON)
                .reduce((sum, c) => sum + (c.deal_details?.revenue || 0), 0);

            const custIds = empCustomers.map(c => c.id);

            // Incurred Expenses (Chi phí phát sinh linked to customers)
            const incurredExpenses = transactions
                .filter(t => t.customer_id && custIds.includes(t.customer_id) && t.type === 'incurred_expense' && t.status === 'approved')
                .reduce((sum, t) => sum + t.amount, 0);

            // Collected Revenue (From Customer Deal Details) - Incurred Expenses
            // Request: "Doanh thu thực tế (tổng) ... : = Doanh thu thực tế (Tổng) - Chi phí phát sinh (Trừ DT)"
            const rawCollected = empCustomers.reduce((sum, c) => sum + (c.deal_details?.actual_revenue || 0), 0);
            const collectedRevenue = rawCollected - incurredExpenses;

            // Deposited (Nộp quỹ)
            const depositedRevenue = transactions
                .filter(t => t.customer_id && custIds.includes(t.customer_id) && t.type === 'deposit' && t.status === 'approved')
                .reduce((sum, t) => sum + t.amount, 0);

            // Removed: totalExpenses (Chi đã duyệt) per request "Xoá cột Đã chi"

            // Advances & Repayments
            const totalAdvances = transactions
                .filter(t => t.user_id === emp.id && (t.type === 'advance' || t.type === 'loan') && t.status === 'approved')
                .reduce((sum, t) => sum + t.amount, 0);

            const totalRepayments = transactions
                .filter(t => t.user_id === emp.id && (t.type === 'repayment' || t.type === 'loan_repayment') && t.status === 'approved')
                .reduce((sum, t) => sum + t.amount, 0);

            const outstandingAdvance = Math.max(0, totalAdvances - totalRepayments);

            // Debt Logic:
            // Remaining Debt = (Collected Real - Deposited) + Outstanding Advance
            // Note: collectedRevenue here already includes deduction of Incurred Expenses per new request.
            const revenueDebt = Math.max(0, collectedRevenue - depositedRevenue);

            // Total Debt
            const debt = revenueDebt + outstandingAdvance;

            return {
                user: emp,
                countWon,
                expectedRevenue,
                collectedRevenue,
                depositedRevenue,
                totalAdvances,
                debt
            };
        }).sort((a, b) => b.expectedRevenue - a.expectedRevenue);
    }, [allProfiles, allCustomers, transactions, selectedMonth, selectedYear, isAdmin, isMod, selectedTeam, userProfile, filterMode, selectedFundPeriod, fundPeriods, fundMembersMap]);


    const expenses = filteredTransactions.filter(t => t.type === 'expense' || t.type === 'advance' || t.type === 'loan');
    const expectedRevenueCustomers = filteredCustomers
        .filter(c => (c.deal_details?.revenue || 0) > 0)
        .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    const approvedDeposits = filteredTransactions.filter(t =>
        ['deposit', 'revenue', 'adjustment', 'repayment', 'personal_bonus', 'loan_repayment'].includes(t.type) &&
        t.status === 'approved' &&
        !t.reason.toLowerCase().includes('dự kiến')
    );
    const pendingDeposits = filteredTransactions.filter(t =>
        t.type === 'deposit' && t.status === 'pending'
    );
    const refundableAdvancesList = filteredTransactions.filter(t => (t.type === 'advance' || t.type === 'loan') && !t.reason.toLowerCase().includes('ứng lương'));

    const allRepayments = transactions.filter(t => t.type === 'repayment' || t.type === 'loan_repayment');
    const pendingDealerDebts = filteredTransactions.filter(t =>
        t.type === 'dealer_debt' &&
        !t.reason.toLowerCase().includes('(đã thu)')
    );

    const totalAdvances = filteredTransactions.filter(t => (t.type === 'advance' || t.type === 'loan') && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    const totalRepaid = filteredTransactions.filter(t => (t.type === 'repayment' || t.type === 'loan_repayment') && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    const netOutstandingAdvances = Math.max(0, totalAdvances - totalRepaid);
    const outstandingAdvances = netOutstandingAdvances;

    const pieData1 = [
        { name: 'Tồn quỹ công ty', value: fundRemaining > 0 ? fundRemaining : 0 },
        { name: 'Đã chi/ứng (Hoàn lại)', value: totalOut },
        { name: 'Lương Part-time', value: partTimeSalaryLiability }
    ];

    const totalExpectedRevenue = filteredCustomers.reduce((sum, c) => {
        const contractRev = Number(c.deal_details?.revenue || 0);
        const actualRev = Number(c.deal_details?.actual_revenue || 0);
        // Use Actual Revenue if it exceeds Contract (Upsell), otherwise use Contract (Unpaid)
        return sum + Math.max(contractRev, actualRev);
    }, 0);

    const collectionData = [
        { name: 'Tổng quan', 'Dự kiến (Sau ứng)': Math.max(0, totalExpectedRevenue - (displayTotalExpense - partTimeSalaryLiability)), 'Đã thu': pnlRevenue }
    ];

    // --- NEW: TOTAL DEBT CALCULATION ---
    // 1. Total Dealer Debt
    const totalDealerDebt = pendingDealerDebts.reduce((sum, t) => sum + t.amount, 0);

    // 2. User Borrow Loans (Tiền mượn của User)
    const totalLoans = filteredTransactions.filter(t => t.type === 'loan' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    const totalLoanRepaid = filteredTransactions.filter(t => t.type === 'loan_repayment' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    const outstandingBorrowLoans = Math.max(0, totalLoans - totalLoanRepaid);

    // 3. Total Pending Customer Revenue (Contract - Deposited)
    const totalDepositedReal = filteredTransactions
        .filter(t => t.type === 'deposit' && t.status === 'approved')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalIncurredExpenses = filteredTransactions
        .filter(t => t.type === 'incurred_expense' && t.status === 'approved')
        .reduce((sum, t) => sum + t.amount, 0);

    // "Dư nợ khách hàng" = (Total Expected - Incurred Expenses - Real Deposit) - "Nợ Đại lý" (Excluded per request)
    // We must deduct Incurred Expenses because they reduce the Target Revenue (Khách không cần đóng khoản này).
    // Start with Raw Gap:
    const rawCustomerGap = Math.max(0, totalExpectedRevenue - totalIncurredExpenses - totalDepositedReal);
    // Filter "Nợ mới" specifically to deduct it again if required by user logic (Offsetting potential revenue duplication)
    const totalNewDealerDebt = pendingDealerDebts
        .filter(t => t.reason.toLowerCase().includes('nợ mới'))
        .reduce((sum, t) => sum + t.amount, 0);

    // Request: "Tiền nợ quỹ nhưng Không tính (Đại lý nợ...)" -> Deduct Dealer Debt.
    // Updated Request: "Đại lý nợ tiền [Nợ mới]... không tính vào vì đã cộng trước đó" -> Deduct AGAIN? or Ensure it's deducted?
    // User wants result 25.6M (Current 26.6M). NewDebt=1M. So we deduct it.
    const totalCustomerDebt = Math.max(0, rawCustomerGap - totalDealerDebt - totalNewDealerDebt);

    // 4. Total to Collect (Cong no phai doi)
    // Request: Tổng số tiền nợ quỹ + Đại ý nợ + Tiền mượn của User
    // "Tổng số tiền nợ quỹ" mapped to "totalCustomerDebt" above?
    const totalDebtToCollect = totalCustomerDebt + totalDealerDebt + outstandingBorrowLoans;

    // --- NEW: Effective QR Code Logic (Hierarchy based) ---
    const effectiveQrUrl = useMemo(() => {
        if (!userProfile) return '';
        let targetManagerId = '';

        if (isAdmin) {
            if (selectedTeam !== 'all') {
                targetManagerId = selectedTeam;
            } else {
                return ''; // Admin showing 'All' doesn't show a specific QR, or show Admin's? Let's show nothing or fallback.
            }
        } else if (isMod) {
            // Mod (Team Leader) uses their own QR
            targetManagerId = userProfile.id;
        } else {
            // Member uses Manager's QR
            targetManagerId = userProfile.manager_id || '';
        }

        const targetProfile = allProfiles.find(p => p.id === targetManagerId);
        return targetProfile?.qr_code_url || '';
    }, [userProfile, allProfiles, selectedTeam, isAdmin, isMod]);

    const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 pb-20 relative">
            {/* ... Header and Cards (unchanged) ... */}

            {toast && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            {/* FILTER HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BadgeDollarSign className="text-green-600" />
                    <span>Quỹ & Thu Chi <span className="text-sm font-medium text-gray-500 hidden sm:inline">(MKT Group)</span></span>
                </h1>

                <div className="w-full xl:w-auto flex flex-col xl:flex-row gap-2 xl:items-center mt-4 xl:mt-0">
                    {/* Time Filters */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm flex-shrink-0">
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                            {/* Filter Mode */}
                            <div className="flex items-center gap-2 w-full sm:w-auto border-b sm:border-b-0 sm:border-r border-gray-100 pb-2 sm:pb-0 sm:pr-2">
                                <Calendar size={18} className="text-purple-600 ml-2" />
                                <select
                                    value={filterMode}
                                    onChange={(e) => setFilterMode(e.target.value as any)}
                                    className="w-full sm:w-auto text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer py-1"
                                >
                                    <option value="creation">Theo ngày tạo</option>
                                    <option value="deal">Theo ngày chốt</option>
                                </select>
                            </div>

                            {/* Month/Year */}
                            <div className="flex gap-2 w-full sm:w-auto">
                                <div className="flex-1 sm:w-auto flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                                    <span className="text-xs font-semibold text-gray-400">Tháng</span>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => { const val = e.target.value; setSelectedMonth((val === 'all' || val.startsWith('q')) ? val as 'all' | 'q1' | 'q2' | 'q3' | 'q4' : Number(val)); }}
                                        className="w-full text-sm font-bold text-gray-800 bg-transparent outline-none cursor-pointer"
                                    >
                                        <option value="all">Tất cả</option>
                                        <option value="q1">Quý 1</option>
                                        <option value="q2">Quý 2</option>
                                        <option value="q3">Quý 3</option>
                                        <option value="q4">Quý 4</option>
                                        <option disabled>─────</option>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (<option key={m} value={m}>Tháng {m}</option>))}
                                    </select>
                                </div>

                                <span className="text-gray-300 self-center hidden sm:block">/</span>

                                <div className="flex-1 sm:w-auto flex items-center justify-center gap-1 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="text-sm font-bold text-gray-800 bg-transparent outline-none cursor-pointer"
                                    >
                                        {[2024, 2025, 2026].map(y => (<option key={y} value={y}>{y}</option>))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Filters & Actions */}
                    <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 w-full xl:w-auto">
                        {isAdmin && (
                            <div className="relative flex-1 sm:flex-none min-w-[140px]">
                                <select
                                    value={selectedTeam}
                                    onChange={(e) => setSelectedTeam(e.target.value)}
                                    className="w-full appearance-none bg-indigo-50 border border-indigo-200 text-indigo-700 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-bold shadow-sm cursor-pointer"
                                >
                                    <option value="all">Tất cả Team</option>
                                    {managers.map(mgr => (<option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>))}
                                </select>
                                <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap text-center">
                            MKT Group
                        </div>

                        {/* Fund Period Selector - Hide completed funds */}
                        {fundPeriods.filter(p => !p.is_completed).length > 0 && (
                            <div className="relative flex-1 sm:flex-none min-w-[140px]">
                                <select
                                    value={selectedFundPeriod}
                                    onChange={(e) => setSelectedFundPeriod(e.target.value)}
                                    className="w-full appearance-none bg-amber-50 border border-amber-200 text-amber-700 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-100 text-sm font-bold shadow-sm cursor-pointer"
                                >
                                    <option value="all">Tất cả Kỳ Quỹ</option>
                                    {fundPeriods.filter(p => !p.is_completed).map(period => (
                                        <option key={period.id} value={period.id}>
                                            {period.name} {period.end_date ? '✓' : '(đang mở)'}
                                        </option>
                                    ))}
                                </select>
                                <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                            </div>
                        )}

                        {/* Complete Fund Button - Only show when a specific period is selected */}
                        {(isAdmin || isMod) && selectedFundPeriod !== 'all' && (
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleCompleteFund(selectedFundPeriod)}
                                    className="px-3 py-2.5 bg-green-50 text-green-600 border border-green-200 rounded-xl text-sm font-bold hover:bg-green-100 transition-all whitespace-nowrap flex items-center gap-1 shadow-sm"
                                    title="Hoàn thành và lưu quỹ vào lịch sử"
                                >
                                    <CheckCircle2 size={16} /> Hoàn thành
                                </button>
                                <button
                                    onClick={() => {
                                        const period = fundPeriods.find(p => p.id === selectedFundPeriod);
                                        if (period) {
                                            setCloseFundForm({ name: period.name, startDate: period.start_date, endDate: period.end_date || '' });
                                            const members = fundMembersMap.filter(m => m.fund_id === period.id).map(m => m.user_id);
                                            setSelectedFundMembers(members);
                                            setIsEditingFund(period.id);
                                            setShowCloseFundModal(true);
                                        }
                                    }}
                                    className="px-3 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all whitespace-nowrap flex items-center gap-1 shadow-sm"
                                    title="Chỉnh sửa kỳ quỹ"
                                >
                                    <Settings2 size={16} /> Sửa
                                </button>
                            </div>
                        )}

                        {/* Close Fund Button */}
                        {(isAdmin || isMod) && (
                            <button
                                onClick={() => {
                                    // Auto-fill form with suggested values
                                    const now = new Date();
                                    const month = now.getMonth() + 1;
                                    const year = now.getFullYear();
                                    const suggestedName = `Quỹ T${month}/${year}`;

                                    // Find last period end date to auto-fill start date
                                    const lastPeriod = fundPeriods.find(p => p.end_date && !p.is_completed);
                                    const nextStartDate = lastPeriod?.end_date
                                        ? new Date(new Date(lastPeriod.end_date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                        : todayStr;

                                    setCloseFundForm({
                                        name: suggestedName,
                                        startDate: nextStartDate,
                                        endDate: ''
                                    });
                                    setIsEditingFund(null); // Ensure creation mode
                                    setSelectedFundMembers([]);
                                    setShowCloseFundModal(true);
                                }}
                                className="px-4 py-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all whitespace-nowrap flex items-center gap-2 shadow-sm"
                            >
                                <Lock size={16} /> Tạo / Đóng Quỹ
                            </button>
                        )}

                        <div className="flex gap-2 ml-auto sm:ml-0 w-full sm:w-auto xl:w-auto">
                            {(isAdmin || isMod) && (
                                <button
                                    onClick={() => { setQrPreview(effectiveQrUrl); setShowConfigModal(true); }}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    <QrCode size={16} /> <span className="hidden sm:inline">Cấu hình</span> QR
                                </button>
                            )}

                            {isAdmin && (
                                <button
                                    onClick={() => setShowResetConfirm(true)}
                                    className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 transition-all whitespace-nowrap flex items-center gap-2 shadow-sm"
                                >
                                    <Trash2 size={16} /> Reset
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* DASHBOARD CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                    <h3 className="font-bold text-gray-700 mb-4">Tổng quan Quỹ (MKT Only)</h3>
                    <div className="w-full h-40"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData1} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"><Cell fill="#10b981" /><Cell fill="#ef4444" /><Cell fill="#f59e0b" /></Pie><ReTooltip formatter={(val: number) => formatCurrency(val) + ' VNĐ'} /></PieChart></ResponsiveContainer></div>
                    <div className="text-center mt-2"><p className="text-sm text-gray-500">Quỹ tồn đọng (Thực tế)</p><p className="text-2xl font-bold text-green-600">{formatCurrency(fundRemaining)} VNĐ</p></div>
                    <div className="mt-4 pt-4 border-t border-gray-100 w-full flex justify-between items-center px-2">
                        <span className="text-xs font-bold text-gray-500">Nợ ứng cần trả:</span>
                        <span className={`text-sm font-bold ${outstandingAdvances > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatCurrency(outstandingAdvances)} VNĐ</span>
                    </div>
                    {isAdmin && (<button onClick={() => setShowAdjustmentModal(true)} className="mt-4 text-xs font-bold text-gray-500 flex items-center gap-1 hover:text-gray-800"><Settings2 size={12} /> Điều chỉnh</button>)}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="font-bold text-gray-700 mb-4">Tiến độ Thu tiền (MKT Group)</h3>
                    <div className="flex-1 w-full h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={collectionData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" hide /><ReTooltip cursor={{ fill: 'transparent' }} formatter={(val: number) => formatCurrency(val) + ' VNĐ'} /><Legend verticalAlign="top" height={36} /><Bar dataKey="Dự kiến (Sau ứng)" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={20} /><Bar dataKey="Đã thu" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} /></BarChart></ResponsiveContainer></div>
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

                {/* NEW CARD: TOTAL DEBT TO COLLECT */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-4">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2"><Scale className="text-orange-500" /> Công nợ phải đòi</h3>

                    <div className="text-center w-full bg-orange-50 py-3 rounded-xl border border-orange-100 mb-2">
                        <p className="text-orange-800 font-bold uppercase text-xs">TỔNG PHẢI THU</p>
                        <p className="text-2xl font-bold text-orange-900">{formatCurrency(totalDebtToCollect)} VNĐ</p>
                    </div>

                    <div className="w-full space-y-3">
                        <div className="flex justify-between items-center px-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><User size={12} /></div>
                                Dư nợ Khách hàng
                            </div>
                            <span className="font-bold text-gray-800 text-sm">{formatCurrency(totalCustomerDebt)}</span>
                        </div>
                        <div className="w-full h-px bg-gray-100"></div>
                        <div className="flex justify-between items-center px-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Building2 size={12} /></div>
                                Nợ Đại lý
                            </div>
                            <span className="font-bold text-gray-800 text-sm">{formatCurrency(totalDealerDebt)}</span>
                        </div>
                        <div className="w-full h-px bg-gray-100"></div>
                        <div className="flex justify-between items-center px-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                                <div className="p-1.5 bg-red-100 text-red-600 rounded-lg"><Undo2 size={12} /></div>
                                Tiền mượn của User
                            </div>
                            <span className="font-bold text-gray-800 text-sm">{formatCurrency(outstandingBorrowLoans)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- PROFIT DISTRIBUTION SECTION --- */}
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden mb-6">
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Percent size={20} className="text-indigo-600" /> Phân chia Lợi Nhuận (Bonus)
                        {isMod && (
                            <button
                                onClick={() => {
                                    setKpiConfigValue(((kpiPenaltyRate * 100)).toFixed(1));
                                    setShowKpiConfigModal(true);
                                }}
                                className="ml-2 p-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                title="Cấu hình tỉ lệ phạt KPI cho team"
                            >
                                <Settings2 size={14} />
                            </button>
                        )}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-200">
                            Pool: <strong>{formatCurrency(fundCalculationPool)}</strong>
                        </span>
                        {(isAdmin || isMod) && (
                            <button onClick={handlePayAllSalaries} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 shadow flex items-center gap-1">
                                <BadgeDollarSign size={14} /> Chi lương
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                            <tr>
                                <th className="px-4 py-3">Nhân viên</th>
                                <th className="px-4 py-3 text-center">KPI (Thực/Mục tiêu)</th>
                                <th className="px-4 py-3 text-right">Doanh thu NV</th>
                                <th className="px-4 py-3 text-center">Tỉ lệ cơ bản</th>
                                <th className="px-4 py-3 text-center">Phạt KPI</th>
                                <th className="px-4 py-3 text-center">Tỉ lệ cuối</th>
                                <th className="px-4 py-3 text-right">Pool (Được chia)</th>
                                <th className="px-4 py-3 text-right">Trừ Ứng / Cộng Thêm</th>
                                <th className="px-4 py-3 text-right">Thực nhận (Dự kiến)</th>
                                {(isAdmin || isMod) && <th className="px-4 py-3 text-center">Hành động</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {profitSharingData.length === 0 ? (
                                <tr><td colSpan={10} className="p-4 text-center text-gray-400">Không có nhân viên Full-time nào trong danh sách.</td></tr>
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
                                                    <Gift size={10} /> Thưởng lại: +{formatCurrency(row.redistributedIncome)}
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
                                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                                        {formatCurrency(row.employeeRevenue)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {editingRatioId === row.user.id ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <input type="number" className="w-12 border rounded px-1 py-0.5 text-center font-bold" value={tempRatio} onChange={e => setTempRatio(e.target.value)} autoFocus />
                                                <button onClick={() => handleUpdateRatio(row.user.id)} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={14} /></button>
                                                <button onClick={() => setEditingRatioId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <span className="font-bold text-gray-700 cursor-pointer hover:text-indigo-600 hover:underline" onClick={() => { if (isAdmin || isMod) { setEditingRatioId(row.user.id); setTempRatio(row.baseShareRatio.toString()); } }}>
                                                {row.baseShareRatio.toFixed(1)}%
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-red-500 font-medium whitespace-nowrap">
                                        {row.penaltyPercent > 0 ? (
                                            <span className="flex items-center justify-center gap-1">
                                                -{(row.penaltyPercent * 100).toFixed(0)}% (share)
                                                {userPenaltyRates[row.user.id] !== undefined && <span className="text-[10px] bg-red-100 px-1 rounded" title="Đã chỉnh tay">Tay</span>}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-indigo-700">
                                        {row.finalShareRatio.toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600 text-xs font-medium">
                                        {formatCurrency(row.teamPoolWithEmployee)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs">
                                        <div className="flex flex-col items-end gap-1">
                                            {row.paidSalary > 0 && <span className="text-orange-600 font-semibold">-{formatCurrency(row.paidSalary)} (Đã chi lương)</span>}
                                            {row.advanceDeduction > 0 && <span className="text-red-500 font-semibold">-{formatCurrency(row.advanceDeduction)} (Ứng)</span>}
                                            {row.personalBonus > 0 && <span className="text-green-500 font-semibold">+{formatCurrency(row.personalBonus)} (Thêm)</span>}
                                            {row.paidSalary === 0 && row.advanceDeduction === 0 && row.personalBonus === 0 && <span className="text-gray-400">-</span>}
                                        </div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold text-lg ${row.estimatedIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(row.estimatedIncome)}
                                    </td>
                                    {(isAdmin || isMod) && (
                                        <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                                            <button onClick={() => { setTargetUserForExclusion(row.user); setShowExclusionModal(true); }} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-red-50 hover:text-red-600 transition-colors" title="Loại trừ Khách hàng">
                                                <MinusCircle size={16} />
                                            </button>
                                            <button onClick={() => {
                                                setTargetUserForKpiConfig(row.user);
                                                const currentRate = userPenaltyRates[row.user.id] !== undefined ? userPenaltyRates[row.user.id] * 100 : kpiPenaltyRate * 100;
                                                setUserKpiConfigValue(currentRate.toFixed(1));
                                                setShowUserKpiConfigModal(true);
                                            }} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 transition-colors" title="Phạt thủ công (Cấu hình %)">
                                                <Scale size={16} />
                                            </button>
                                            {/* Show Payout Button ALWAYS if Admin/Mod, regardless of estimated income */}
                                            <button onClick={() => openSalaryModal(row.user, row.estimatedIncome)} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 border border-green-200 transition-colors" title="Chi tiền lương (Payout)">
                                                <BadgeDollarSign size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- SALARY CONFIRM MODAL --- */}
            {showSalaryConfirmModal && salaryPayoutTarget && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <BadgeDollarSign className="text-green-600" /> Xác nhận Chi lương
                            </h3>
                            <button onClick={() => setShowSalaryConfirmModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="text-center">
                                <p className="text-sm text-gray-500">Chi lương cho nhân viên</p>
                                <p className="text-xl font-bold text-gray-900">{salaryPayoutTarget.user.full_name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Số tiền chi lương (Nhập tay)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={salaryPayoutAmount}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            setSalaryPayoutAmount(raw ? Number(raw).toLocaleString('vi-VN') : '');
                                        }}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-green-100 focus:border-green-500 font-bold text-lg text-green-700 placeholder:font-normal"
                                        placeholder="Ví dụ: 5.000.000"
                                        autoFocus
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">VNĐ</span>
                                </div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 border border-gray-100 italic">
                                Lưu ý: Số tiền này sẽ được ghi nhận là "Chi quỹ" (Expense) và khấu trừ vào khoản "Thực nhận" của nhân viên trong bảng lương.
                            </div>
                            <button onClick={confirmPaySalary} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95">
                                Xác nhận Chi ngay (Approved)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DASHBOARD HISTORY TABLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center"><h3 className="font-bold text-red-800 flex items-center gap-2"><ArrowUpRight /> Lịch sử Chi/Tạm Ứng/Mượn</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setShowBorrowModal(true)} className="px-3 py-1 bg-white text-red-600 border border-red-200 text-xs font-bold rounded-lg shadow-sm hover:bg-red-50 flex items-center gap-1"><Hand size={14} /> Mượn tiền</button>
                            <button onClick={() => setShowExpenseModal(true)} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow hover:bg-red-700 flex items-center gap-1"><ArrowUpRight size={14} /> Xuất tiền (Chi)</button>
                        </div>
                    </div>
                    <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">{expenses.map(t => (<div key={t.id} className="p-3 border border-gray-100 rounded-xl hover:shadow-sm transition-all"><div className="flex justify-between items-start"><div><p className="font-bold text-gray-900">{t.reason}</p><p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString()}</p>{t.customer_name && <p className="text-xs text-blue-600 mt-1">Khách: {t.customer_name}</p>}</div><span className="font-bold text-red-600">-{formatCurrency(t.amount)}</span></div><div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status === 'approved' ? 'bg-green-100 text-green-700' : t.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span><div className="flex gap-2">{t.status === 'pending' && (isAdmin || isMod) && (<><button onClick={() => handleApprove(t, true)} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16} /></button><button onClick={() => handleApprove(t, false)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16} /></button></>)}{(isAdmin || isMod) && (<button onClick={() => setTransactionToDelete(t)} className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-red-100 hover:text-red-600"><Trash2 size={16} /></button>)}</div></div></div>))}</div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center"><h3 className="font-bold text-purple-800 flex items-center gap-2"><ArrowDownLeft /> Nộp tiền DỰ KIẾN</h3><span className="text-xs font-bold text-purple-600 bg-white px-2 py-1 rounded-lg border border-purple-200">Tổng: {formatCurrency(totalExpectedRevenue)} VNĐ</span></div>
                    <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">{expectedRevenueCustomers.length === 0 ? (<div className="text-center py-8 text-gray-400 text-sm">Không có doanh thu dự kiến.</div>) : expectedRevenueCustomers.map(c => (<div key={c.id} className="p-3 border border-purple-100 bg-purple-50/30 rounded-xl transition-all hover:shadow-sm cursor-pointer" onClick={() => window.open('/customers/' + c.id, '_blank')}><div className="flex justify-between items-center"><div><p className="font-bold text-gray-900">{c.name}</p><p className="text-xs text-gray-500">{c.sales_rep} • {new Date(c.updated_at || c.created_at).toLocaleDateString('vi-VN')}</p><p className="text-xs text-purple-600 mt-1 font-medium">SĐT: {c.phone}</p></div><span className="font-bold text-purple-600">+{formatCurrency(c.deal_details?.revenue || 0)}</span></div><div className="flex justify-between items-center mt-2 pt-2 border-t border-purple-100"><span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">Dự kiến HĐ</span></div></div>))}</div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center"><h3 className="font-bold text-green-800 flex items-center gap-2"><CheckCircle2 /> Nộp tiền THỰC THU</h3><button onClick={() => setShowDepositModal(true)} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg shadow hover:bg-green-700 flex items-center gap-1"><QrCode size={14} /> Nộp quỹ</button></div>
                    <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">
                        {/* PENDING DEPOSITS */}
                        {pendingDeposits.length > 0 && (
                            <div className="mb-4 space-y-3 pb-4 border-b border-gray-100">
                                <p className="text-xs font-extrabold text-orange-600 uppercase px-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Yêu cầu đang chờ duyệt ({pendingDeposits.length})</p>
                                {pendingDeposits.map(t => (
                                    <div key={t.id} className="p-3 border border-orange-200 bg-orange-50/50 rounded-xl transition-all shadow-sm">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-gray-900 flex items-center gap-2">{t.reason} {t._is_part_time_creator && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded uppercase">Part-time</span>}</p>
                                                <p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString()}</p>
                                                {t.customer_name && <p className="text-xs text-blue-600 mt-1 font-medium">Khách: {t.customer_name}</p>}
                                            </div>
                                            <span className="font-bold text-orange-600">+{formatCurrency(t.amount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-orange-100">
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">Chờ duyệt</span>
                                            <div className="flex gap-2">
                                                {(isAdmin || isMod) && (
                                                    <>
                                                        <button onClick={() => handleApprove(t, true)} className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-colors" title="Duyệt"><Check size={16} /></button>
                                                        <button onClick={() => handleApprove(t, false)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Từ chối"><X size={16} /></button>
                                                        <button onClick={() => setTransactionToDelete(t)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"><Trash2 size={16} /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* APPROVED DEPOSITS */}
                        {approvedDeposits.length === 0 && pendingDeposits.length === 0 ? (<div className="text-center py-8 text-gray-400 text-sm">Chưa có khoản nào đã nộp.</div>) : approvedDeposits.map(t => (<div key={t.id} className={`p-3 border border-gray-100 rounded-xl transition-all hover:shadow-sm ${t.customer_id ? 'cursor-pointer hover:border-green-200' : ''}`} onClick={() => t.customer_id && window.open('/customers/' + t.customer_id, '_blank')}><div className="flex justify-between items-center"><div><p className="font-bold text-gray-900 flex items-center gap-2">{t.reason} {t._is_part_time_creator && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded uppercase">Part-time (30% lương)</span>}</p><p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString()}</p>{t.customer_name && <p className="text-xs text-green-600 mt-1">Khách: {t.customer_name}</p>}</div><span className="font-bold text-green-600">{t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}</span></div><div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50"><span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">ĐÃ NỘP QUỸ</span><div className="flex gap-2">{(isAdmin || isMod) && (<button onClick={(e) => { e.stopPropagation(); setTransactionToDelete(t); }} className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-red-100 hover:text-red-600"><Trash2 size={16} /></button>)}</div></div></div>))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-purple-50 border-b border-purple-100 flex flex-col gap-1">
                        <h3 className="font-bold text-purple-800 flex items-center gap-2"><Undo2 size={18} /> Nợ ứng / Mượn cần hoàn trả</h3>
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
                                                <div className="flex items-center gap-1 mb-1"><p className="font-bold text-gray-900 line-clamp-1">{t.reason}</p>{t.customer_id && <ExternalLink size={12} className="text-purple-400" />}</div>
                                                <p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString('vi-VN')}</p>
                                                {t.customer_name && <p className="text-xs text-purple-600 mt-1 font-semibold">Khách: {t.customer_name}</p>}
                                            </div>
                                            <div className="flex flex-col items-end"><span className="font-bold text-purple-700">-{formatCurrency(t.amount)}</span><span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 font-bold ${statusColor}`}>{statusText}</span></div>
                                        </div>
                                        <div className="flex justify-end mt-2 pt-2 border-t border-purple-100 gap-2">
                                            {pendingRepayment && (isAdmin || isMod) && (<button onClick={(e) => { e.stopPropagation(); handleApprove(pendingRepayment, true); }} className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 flex items-center gap-1 animate-pulse shadow-sm"><CheckCircle2 size={12} /> Duyệt nhận tiền</button>)}
                                            {t.status === 'approved' && !finalPaid && !pendingRepayment && (isAdmin || isMod) && (<button onClick={(e) => { e.stopPropagation(); setAdvanceToRepay(t); }} className="px-2 py-1 bg-white border border-green-200 text-green-700 rounded text-xs font-bold hover:bg-green-50 flex items-center gap-1"><Undo2 size={12} /> Thu tiền mặt</button>)}
                                            {t.status === 'pending' && (isAdmin || isMod) && (<><button onClick={(e) => { e.stopPropagation(); handleApprove(t, true); }} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16} /></button><button onClick={(e) => { e.stopPropagation(); handleApprove(t, false); }} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16} /></button></>)}
                                            {(isAdmin || isMod) && (<button onClick={(e) => { e.stopPropagation(); setTransactionToDelete(t); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>)}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center"><h3 className="font-bold text-orange-800 flex items-center gap-2"><Building2 size={18} /> Đại lý nợ chưa thu</h3></div>
                    <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">{pendingDealerDebts.length === 0 ? (<div className="text-center py-8 text-gray-400 text-sm">Không có khoản nợ nào.</div>) : (pendingDealerDebts.map(t => (<div key={t.id} className={`p-3 border border-orange-200 bg-orange-50 rounded-xl transition-all ${t.customer_id ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : ''}`}><div className="flex justify-between items-start"><div><div className="flex items-center gap-1 mb-1"><p className="font-bold text-gray-900 line-clamp-1">{t.reason}</p>{t.customer_id && <ExternalLink size={12} className="text-orange-400" />}</div><p className="text-xs text-gray-500">{t.user_name} • Dự kiến: {t.target_date ? new Date(t.target_date).toLocaleDateString('vi-VN') : 'N/A'}</p>{t.customer_name && <p className="text-xs text-blue-600 mt-1 font-semibold">Khách: {t.customer_name}</p>}</div><div className="flex flex-col items-end"><span className="font-bold text-orange-700">+{formatCurrency(t.amount)}</span><span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded mt-1 font-bold">Chờ thu</span></div></div>{(isAdmin || isMod) && (<div className="flex justify-end mt-2 pt-2 border-t border-orange-100"><button onClick={(e) => { e.stopPropagation(); setTransactionToDelete(t); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button></div>)}</div>)))}</div>
                </div>
            </div>


            {/* --- NEW: EMPLOYEE PERFORMANCE & DEBT TABLE --- */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><User size={20} className="text-gray-600" /> Hiệu suất & Công nợ Nhân viên</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                            <tr>
                                <th className="px-4 py-3">Nhân viên</th>
                                <th className="px-4 py-3 text-center">Số xe đã chốt</th>
                                <th className="px-4 py-3 text-right">Doanh thu dự kiến</th>
                                <th className="px-4 py-3 text-right">Doanh thu thực tế (Tổng)</th>
                                <th className="px-4 py-3 text-right text-green-600">Đã nộp quỹ</th>
                                <th className="px-4 py-3 text-right text-purple-600">Đã ứng</th>
                                <th className="px-4 py-3 text-right text-red-600">Nợ cần thu</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employeeStats.length === 0 ? (
                                <tr><td colSpan={7} className="p-4 text-center text-gray-400">Không có dữ liệu nhân viên.</td></tr>
                            ) : employeeStats.map(row => (
                                <tr key={row.user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-gray-900">{row.user.full_name}</td>
                                    <td className="px-4 py-3 text-center font-semibold">{row.countWon}</td>
                                    <td className="px-4 py-3 text-right font-medium text-purple-600">{formatCurrency(row.expectedRevenue)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-800">{formatCurrency(row.collectedRevenue)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(row.depositedRevenue)}</td>
                                    <td className="px-4 py-3 text-right font-medium text-purple-600">{formatCurrency(row.totalAdvances)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(row.debt)}</td>
                                </tr>
                            ))}
                            {/* Summary Row */}
                            {employeeStats.length > 0 && (
                                <tr className="bg-gray-50 font-bold bg-yellow-50/50">
                                    <td className="px-4 py-3 text-gray-800 uppercase">TỔNG CỘNG</td>
                                    <td className="px-4 py-3 text-center">{employeeStats.reduce((a, b) => a + b.countWon, 0)}</td>
                                    <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(employeeStats.reduce((a, b) => a + b.expectedRevenue, 0))}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(employeeStats.reduce((a, b) => a + b.collectedRevenue, 0))}</td>
                                    <td className="px-4 py-3 text-right text-green-700">{formatCurrency(employeeStats.reduce((a, b) => a + b.depositedRevenue, 0))}</td>
                                    <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(employeeStats.reduce((a, b) => a + b.totalAdvances, 0))}</td>
                                    <td className="px-4 py-3 text-right text-red-700">{formatCurrency(employeeStats.reduce((a, b) => a + b.debt, 0))}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ... (Keep existing modals unchanged) ... */}
            {
                showDepositModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Nộp quỹ / Doanh thu</h3><button onClick={() => setShowDepositModal(false)}><X size={24} className="text-gray-400" /></button></div>
                    {effectiveQrUrl ? (
                        <div className="flex flex-col items-center mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <img src={effectiveQrUrl} alt="QR Code" className="w-48 h-48 object-contain mb-2 mix-blend-multiply" />
                            <p className="text-xs text-gray-500 text-center">Quét mã để chuyển khoản cho Team Lead.</p>
                        </div>
                    ) : (
                        <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 text-sm text-center rounded-xl border border-yellow-200">
                            Chưa có QR Code. Vui lòng liên hệ Team Lead để cấu hình.
                        </div>
                    )}
                    <div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Chọn Khách hàng (Đã chốt)</label><select className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900" value={depositForm.customerId} onChange={e => setDepositForm({ ...depositForm, customerId: e.target.value })}><option value="">-- Chọn khách hàng --</option>{availableCustomersForDeposit.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}</select>{availableCustomersForDeposit.length === 0 && <p className="text-xs text-red-500 mt-1">Không có khách hàng khả dụng</p>}</div><div><label className="block text-sm font-bold text-gray-700 mb-1">Số tiền</label><input type="text" className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900 font-bold" value={depositForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setDepositForm({ ...depositForm, amount: v ? Number(v).toLocaleString('vi-VN') : '' }); }} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Nội dung</label><input type="text" className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900" value={depositForm.reason} onChange={e => setDepositForm({ ...depositForm, reason: e.target.value })} /></div><button onClick={handleSubmitDeposit} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700">Xác nhận đã nộp</button></div></div></div>)
            }
            {showAdjustmentModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Điều chỉnh Quỹ (Admin)</h3><button onClick={() => setShowAdjustmentModal(false)}><X size={24} className="text-gray-400" /></button></div><div className="space-y-4"><div><label className="text-sm font-bold text-gray-600">Số tiền (+/-)</label><input type="text" value={adjustmentForm.amount} onChange={e => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" placeholder="-500000 hoặc 1000000" /></div><div><label className="text-sm font-bold text-gray-600">Lý do</label><input type="text" value={adjustmentForm.reason} onChange={e => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" /></div><button onClick={handleSubmitAdjustment} className="w-full py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900">Xác nhận điều chỉnh</button></div></div></div>)}

            {showAdvanceModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-red-700">Tạm Ứng (Cần hoàn lại)</h3><button onClick={() => setShowAdvanceModal(false)}><X size={24} className="text-gray-400" /></button></div><div className="space-y-4"><div><label className="text-sm font-bold text-gray-600">Số tiền cần ứng</label><input type="text" value={advanceForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAdvanceForm({ ...advanceForm, amount: v ? Number(v).toLocaleString('vi-VN') : '' }); }} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" /></div><div><label className="text-sm font-bold text-gray-600">Lý do ứng</label><input type="text" value={advanceForm.reason} onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" placeholder="VD: Đi tiếp khách..." /></div><div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">Khoản này sẽ tạo thành <strong>Nợ tạm ứng</strong> cần phải hoàn trả sau này.</div><button onClick={handleSubmitAdvance} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Gửi yêu cầu Ứng</button></div></div></div>)}

            {/* CLOSE FUND MODAL */}
            {
                showCloseFundModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-amber-700 flex items-center gap-2">
                                    <Lock size={20} /> {isEditingFund ? 'Cập nhật Kỳ Quỹ' : 'Tạo / Đóng Kỳ Quỹ'}
                                </h3>
                                <button onClick={() => setShowCloseFundModal(false)}>
                                    <X size={24} className="text-gray-400 hover:text-gray-600" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Tên Kỳ Quỹ *</label>
                                    <input
                                        type="text"
                                        value={closeFundForm.name}
                                        onChange={e => setCloseFundForm({ ...closeFundForm, name: e.target.value })}
                                        className="w-full border border-gray-300 p-3 rounded-xl outline-none bg-white text-gray-900 font-bold focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                        placeholder="VD: Quỹ T1/2026"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Ngày bắt đầu *</label>
                                        <input
                                            type="date"
                                            value={closeFundForm.startDate}
                                            onChange={e => setCloseFundForm({ ...closeFundForm, startDate: e.target.value })}
                                            className="w-full border border-gray-300 p-3 rounded-xl outline-none bg-white text-gray-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Ngày kết thúc</label>
                                        <input
                                            type="date"
                                            value={closeFundForm.endDate}
                                            onChange={e => setCloseFundForm({ ...closeFundForm, endDate: e.target.value })}
                                            className="w-full border border-gray-300 p-3 rounded-xl outline-none bg-white text-gray-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                        />
                                    </div>
                                </div>

                                {/* NEW: Member Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Thành viên tham gia quỹ (Tùy chọn)</label>
                                    <div className="border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto bg-gray-50/50">
                                        <p className="text-xs text-gray-500 mb-2 italic">Chọn nhân viên thuộc quỹ này (để chia lợi nhuận). Nếu không chọn, mặc định áp dụng tất cả.</p>
                                        <div className="space-y-2">
                                            {allProfiles
                                                .filter(p => {
                                                    // Basic check: Active and Not Admin
                                                    const isEligible = p.status === 'active' && p.role !== 'admin';
                                                    if (!isEligible) return false;

                                                    // Scope check:
                                                    if (isAdmin) {
                                                        // Admin viewing a specific team -> Filter ONLY that team's members
                                                        if (selectedTeam !== 'all') {
                                                            return p.manager_id === selectedTeam || p.id === selectedTeam;
                                                        }
                                                        // Admin viewing 'all' -> Show all eligible members
                                                        return true;
                                                    }

                                                    if (isMod) {
                                                        // Mod -> Show ONLY members managed by this Mod
                                                        return p.manager_id === userProfile?.id || p.id === userProfile?.id;
                                                    }

                                                    return false; // Regular users shouldn't see this anyway
                                                })
                                                .map(p => (
                                                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedFundMembers.includes(p.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedFundMembers(prev => [...prev, p.id]);
                                                                } else {
                                                                    setSelectedFundMembers(prev => prev.filter(id => id !== p.id));
                                                                }
                                                            }}
                                                            className="rounded text-amber-600 focus:ring-amber-500"
                                                        />
                                                        <span className="text-sm text-gray-700 font-medium">{p.full_name}</span>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                    <p className="font-semibold text-amber-700 mb-1">💡 Hướng dẫn:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Để trống ngày kết thúc = Kỳ quỹ đang mở (chưa đóng)</li>
                                        <li>Nhập ngày kết thúc = Đóng kỳ quỹ ngay</li>
                                        <li>Khách hàng được phân theo ngày <strong>tạo khách</strong></li>
                                    </ul>
                                </div>

                                <button
                                    onClick={handleCloseFund}
                                    disabled={isClosingFund}
                                    className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                                >
                                    {isClosingFund ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
                                    {isEditingFund ? 'Lưu thay đổi' : 'Tạo / Đóng Quỹ'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* NEW EXPENSE MODAL */}
            {
                showExpenseModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-red-700">Chi Tiền (Trừ thẳng quỹ)</h3>
                                <button onClick={() => setShowExpenseModal(false)}>
                                    <X size={24} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                {/* NEW: Fund Period Selector */}
                                {fundPeriods.filter(p => !p.is_completed).length > 0 && (
                                    <div>
                                        <label className="text-sm font-bold text-gray-600">Chọn gói quỹ</label>
                                        <select
                                            value={expenseForm.fundPeriodId}
                                            onChange={e => setExpenseForm({ ...expenseForm, fundPeriodId: e.target.value })}
                                            className="w-full border border-amber-300 p-2 rounded-lg outline-none bg-amber-50 text-gray-900 font-bold"
                                        >
                                            <option value="">-- Quỹ hiện tại --</option>
                                            {fundPeriods.filter(p => !p.is_completed).map(period => (
                                                <option key={period.id} value={period.id}>
                                                    {period.name} {period.end_date ? '(đã đóng)' : '(đang mở)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm font-bold text-gray-600">Số tiền chi</label>
                                    <input
                                        type="text"
                                        value={expenseForm.amount}
                                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setExpenseForm({ ...expenseForm, amount: v ? Number(v).toLocaleString('vi-VN') : '' }); }}
                                        className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-gray-600">Lý do chi</label>
                                    <input
                                        type="text"
                                        value={expenseForm.reason}
                                        onChange={e => setExpenseForm({ ...expenseForm, reason: e.target.value })}
                                        className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900"
                                        placeholder="VD: Mua nước, liên hoan..."
                                    />
                                </div>
                                <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                                    Lưu ý: Khoản này là <strong>Chi phí</strong> chung, sẽ trừ thẳng vào quỹ và KHÔNG tạo nợ cá nhân.
                                </div>
                                <button onClick={handleSubmitExpense} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">
                                    Gửi yêu cầu Chi
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showConfigModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Cấu hình QR Code (Team)</h3>

                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tải ảnh QR lên</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setQrFile(e.target.files[0]);
                                            setQrPreview(URL.createObjectURL(e.target.files[0]));
                                        }
                                    }}
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>

                            {qrPreview && (
                                <div className="mb-4 p-2 bg-gray-50 border rounded-xl flex justify-center relative group">
                                    <img src={qrPreview} alt="Preview" className="h-40 object-contain" />
                                    {qrFile && <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="bg-black/70 text-white text-xs px-2 py-1 rounded">Mới</span></div>}
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold">Hủy</button>
                                <button onClick={handleSaveQr} disabled={isSavingQr} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2">
                                    {isSavingQr && <Loader2 className="animate-spin" size={16} />} Lưu
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {showExclusionModal && targetUserForExclusion && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Loại trừ khách hàng</h3><button onClick={() => setShowExclusionModal(false)}><X size={24} className="text-gray-400" /></button></div><div className="bg-yellow-50 p-3 rounded-xl mb-4 border border-yellow-100"><p className="text-sm text-yellow-800">Đang chọn loại trừ cho: <strong>{targetUserForExclusion.full_name}</strong></p><p className="text-xs text-yellow-700 mt-1">Danh sách hiển thị: Khách <strong>MKT Group</strong>, Đã chốt, Chưa hoàn tiền (Thuộc Team đang chọn).</p></div><div className="overflow-y-auto flex-1 space-y-2 border-t border-gray-100 pt-2">{exclusionCandidates.length === 0 ? <p className="text-center text-gray-400 py-4">Không có khách hàng MKT nào phù hợp.</p> : exclusionCandidates.map(c => { const isExcluded = profitExclusions.some(ex => ex.user_id === targetUserForExclusion.id && ex.customer_id === c.id); return (<div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer" onClick={() => handleToggleExclusion(c.id)}><div><p className="font-bold text-sm text-gray-900">{c.name} <span className="font-normal text-gray-500">({c.sales_rep})</span></p><p className="text-xs text-gray-500">{formatCurrency(c.deal_details?.revenue || 0)} VNĐ • {c.source}</p></div><div className={`w-5 h-5 rounded border flex items-center justify-center ${isExcluded ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300'}`}>{isExcluded && <Check size={14} />}</div></div>); })}</div><div className="mt-4 pt-2 border-t flex justify-end"><button onClick={() => setShowExclusionModal(false)} className="px-4 py-2 bg-gray-100 font-bold rounded-xl text-gray-700 hover:bg-gray-200">Đóng</button></div></div></div>)}

            {/* NEW: User KPI Config Modal */}
            {showUserKpiConfigModal && targetUserForKpiConfig && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Scale className="text-red-600" /> Phạt thủ công (Cá nhân)
                            </h3>
                            <button onClick={() => setShowUserKpiConfigModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        <div className="mb-6 bg-red-50 p-4 rounded-xl border border-red-100">
                            <p className="text-sm text-red-800 font-bold mb-1">Cấu hình cho: {targetUserForKpiConfig.full_name}</p>
                            <p className="text-xs text-red-600">Thay đổi này sẽ ghi đè thiết lập chung của Team.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tỉ lệ phạt KPI / Xe thiếu</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={userKpiConfigValue}
                                        onChange={(e) => setUserKpiConfigValue(e.target.value)}
                                        className="w-full text-center border-2 border-red-100 focus:border-red-500 rounded-xl px-4 py-3 text-2xl font-bold text-red-600 outline-none"
                                        autoFocus
                                    />
                                    <span className="text-xl font-bold text-gray-400">% /xe</span>
                                </div>
                            </div>

                            <div className="text-xs text-gray-500 italic p-2">
                                * Nhập 0 để không áp dụng phạt cho nhân viên này.
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        // Reset to Default (Remove Override)
                                        // Logic: Delete the key from app_settings
                                        const key = `kpi_penalty_rate_USER_${targetUserForKpiConfig.id}`;
                                        supabase.from('app_settings').delete().eq('key', key).then(() => {
                                            setUserPenaltyRates(prev => {
                                                const next = { ...prev };
                                                delete next[targetUserForKpiConfig.id];
                                                return next;
                                            });
                                            setShowUserKpiConfigModal(false);
                                            showToast("Đã về mặc định Team!", 'success');
                                        });
                                    }}
                                    className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200"
                                >
                                    Mặc định
                                </button>
                                <button
                                    onClick={handleSaveUserKpiConfig}
                                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200"
                                >
                                    Lưu riêng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {transactionToDelete && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-red-100"><div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600"><Trash2 size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa giao dịch?</h3><p className="text-sm text-gray-500 mb-4">Bạn có chắc chắn muốn xóa giao dịch này khỏi hệ thống?</p><div className="flex gap-3 w-full"><button onClick={() => setTransactionToDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={confirmDeleteTransaction} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors">Xóa ngay</button></div></div></div></div>)}
            {advanceToRepay && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-purple-100"><div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600"><Undo2 size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận Hoàn ứng?</h3><div className="bg-purple-50 p-4 rounded-xl text-left w-full mb-4 border border-purple-100 space-y-2"><div><p className="text-xs text-gray-500">Nội dung ứng</p><p className="font-bold text-gray-900">{advanceToRepay.reason}</p></div><div><p className="text-xs text-gray-500">Số tiền hoàn trả</p><p className="font-bold text-purple-600 text-lg">{formatCurrency(advanceToRepay.amount)} VNĐ</p></div></div><p className="text-xs text-gray-500 mb-4">Hành động này sẽ gửi yêu cầu hoàn trả. Vui lòng chờ Admin/Mod duyệt để cập nhật quỹ.</p><div className="flex gap-3 w-full"><button onClick={() => setAdvanceToRepay(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={handleManualRepay} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-200 transition-colors">Xác nhận Thu</button></div></div></div></div>)}
            {showResetConfirm && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70  animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border-2 border-red-200"><div className="flex flex-col items-center text-center"><div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-pulse"><AlertTriangle size={40} /></div><h3 className="text-2xl font-bold text-gray-900 mb-2">CẢNH BÁO NGUY HIỂM!</h3><div className="bg-red-50 p-4 rounded-xl text-left w-full mb-6 border border-red-100"><p className="text-red-800 font-bold text-sm mb-2">Hành động này sẽ XÓA SẠCH:</p><ul className="list-disc list-inside text-red-700 text-sm space-y-1"><li>Toàn bộ lịch sử Thu/Chi/Nộp tiền.</li><li>Toàn bộ Tiền phạt và Quỹ nhóm.</li><li>Reset "Doanh thu thực tế" của tất cả khách hàng về 0.</li></ul><p className="text-red-600 text-xs italic mt-3 font-semibold text-center">Dữ liệu sẽ KHÔNG THỂ khôi phục được.</p></div><div className="flex gap-3 w-full"><button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3.5 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">Hủy bỏ</button><button onClick={executeResetFinance} disabled={isResetting} className="flex-1 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2">{isResetting && <Loader2 className="animate-spin" size={20} />} Xác nhận RESET</button></div></div></div></div>)}

            {
                dealerDebtToConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-green-100">
                            <div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600"><CheckCircle2 size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Đại lý đã trả nợ?</h3><div className="bg-green-50 p-4 rounded-xl text-left w-full mb-4 border border-green-100 space-y-2"><div><p className="text-xs text-gray-500">Khoản nợ</p><p className="font-bold text-gray-900">{dealerDebtToConfirm.reason}</p></div><div><p className="text-xs text-gray-500">Số tiền</p><p className="font-bold text-green-600 text-lg">{formatCurrency(dealerDebtToConfirm.amount)} VNĐ</p></div></div><p className="text-xs text-gray-500 mb-4">Hành động này sẽ ghi nhận <strong>Doanh thu/Nộp tiền</strong> vào hệ thống.</p><div className="flex gap-3 w-full"><button onClick={() => setDealerDebtToConfirm(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button><button onClick={executeDealerDebtPaid} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-colors">Xác nhận</button></div></div>
                        </div>
                    </div>
                )
            }

            {
                showDealerDebtModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Đại lý Nợ</h3>
                                <button onClick={() => setShowDealerDebtModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền (VNĐ)</label>
                                    <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500 font-bold" value={dealerDebtForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setDealerDebtForm({ ...dealerDebtForm, amount: v ? Number(v).toLocaleString('vi-VN') : '' }); }} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Hạn thanh toán</label>
                                    <input type="date" min={todayStr} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500" value={dealerDebtForm.targetDate} onChange={e => setDealerDebtForm({ ...dealerDebtForm, targetDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú</label>
                                    <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-green-500" value={dealerDebtForm.reason} onChange={e => setDealerDebtForm({ ...dealerDebtForm, reason: e.target.value })} />
                                </div>
                                <button onClick={handleSubmitDealerDebt} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700">Xác nhận</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* NEW: Finance Page Borrow Modal */}
            {
                showBorrowModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-red-700">Mượn tiền quỹ</h3>
                                <button onClick={() => setShowBorrowModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Chọn Khách hàng (Liên quan)</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-red-500 bg-white"
                                        value={borrowForm.customerId}
                                        onChange={e => setBorrowForm({ ...borrowForm, customerId: e.target.value })}
                                    >
                                        <option value="">-- Chọn khách hàng --</option>
                                        {allCustomers
                                            .filter(c => {
                                                // 1. Source: MKT Group
                                                const sourceUpper = (c.source || '').toUpperCase();
                                                const isMKT = sourceUpper.includes('MKT');
                                                if (!isMKT) return false;

                                                // 2. Status: WON + Processing
                                                const isProcessing = c.status === CustomerStatus.WON && c.deal_status === 'processing';
                                                if (!isProcessing) return false;

                                                // 3. Ownership
                                                if (isAdmin) return true; // Admin sees all

                                                if (isMod) {
                                                    // My customers
                                                    if (c.creator_id === userProfile?.id) return true;
                                                    if (c.sales_rep === userProfile?.full_name) return true;

                                                    // My Team's customers (Owner reports to Me)
                                                    const owner = allProfiles.find(p => p.id === c.creator_id);
                                                    if (owner && owner.manager_id === userProfile?.id) return true;

                                                    return false;
                                                }

                                                // Regular User
                                                return c.sales_rep === userProfile?.full_name || c.creator_id === userProfile?.id;
                                            })
                                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền (VNĐ)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-red-500 font-bold"
                                        value={borrowForm.amount}
                                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setBorrowForm({ ...borrowForm, amount: v ? Number(v).toLocaleString('vi-VN') : '' }); }}
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">* Hạn mức: 100.000.000 VNĐ / ngày</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Dự kiến trả</label>
                                    <input
                                        type="date"
                                        min={todayStr}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-red-500"
                                        value={borrowForm.date}
                                        onChange={e => setBorrowForm({ ...borrowForm, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú (Tùy chọn)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-red-500"
                                        value={borrowForm.reason}
                                        onChange={e => setBorrowForm({ ...borrowForm, reason: e.target.value })}
                                        placeholder="Lý do..."
                                    />
                                </div>
                                <button
                                    onClick={handleSubmitBorrow}
                                    className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                                >
                                    Xác nhận Mượn
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* FUND COMPLETION WARNING MODAL */}
            {fundWarning.visible && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                                <AlertTriangle /> Cảnh báo chưa hoàn tất
                            </h3>
                            <button onClick={() => setFundWarning(prev => ({ ...prev, visible: false }))}>
                                <X size={24} className="text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>

                        {fundWarning.loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="animate-spin text-amber-500 mb-2" size={32} />
                                <p className="text-gray-500 font-bold">Đang kiểm tra dữ liệu khách hàng...</p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 text-sm">
                                    <p className="font-bold text-base mb-1">Không thể đóng quỹ ngay!</p>
                                    Có <strong>{fundWarning.issues.length}</strong> khách hàng chưa hoàn tất thủ tục công nợ hoặc tiền về.
                                    <br />Việc hoàn thành quỹ lúc này có thể gây sai lệch số liệu lịch sử.
                                </div>
                                <div className="flex-1 overflow-y-auto min-h-0 border border-gray-200 rounded-xl mb-6 custom-scrollbar">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 font-bold text-gray-700 sticky top-0">
                                            <tr>
                                                <th className="p-3 border-b">Khách hàng</th>
                                                <th className="p-3 border-b">Sales</th>
                                                <th className="p-3 border-b">Vấn đề</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {fundWarning.issues.map((issue) => (
                                                <tr key={issue.id} className="hover:bg-red-50/30">
                                                    <td
                                                        className="p-3 font-bold text-blue-600 align-top cursor-pointer hover:underline"
                                                        onClick={() => {
                                                            navigate(`/customers/${issue.id}`);
                                                            setFundWarning(prev => ({ ...prev, visible: false }));
                                                        }}
                                                    >
                                                        {issue.name} <ExternalLink size={12} className="inline ml-1" />
                                                    </td>
                                                    <td className="p-3 text-gray-600 align-top">{issue.sales}</td>
                                                    <td className="p-3 align-top">
                                                        <ul className="list-disc list-inside text-red-600 space-y-1">
                                                            {issue.reasons.map((r, idx) => (
                                                                <li key={idx}>{r}</li>
                                                            ))}
                                                        </ul>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => setFundWarning(prev => ({ ...prev, visible: false }))}
                                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                                    >
                                        Quay lại kiểm tra
                                    </button>
                                    <button
                                        onClick={() => handleCompleteFund(fundWarning.periodId, true)}
                                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-red-200 transition-colors"
                                    >
                                        <AlertTriangle size={18} /> Vẫn hoàn thành (Reset)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* KPI Penalty Rate Config Modal (MOD Only) */}
            {showKpiConfigModal && isMod && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Percent className="text-red-500" /> Cấu hình Phạt KPI (Team của bạn)
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Tỉ lệ phạt KPI mỗi xe thiếu chỉ tiêu
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    Khi nhân viên không đạt KPI, mỗi xe thiếu sẽ bị trừ % này vào phần chia lợi nhuận.
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={kpiConfigValue}
                                            onChange={(e) => setKpiConfigValue(e.target.value)}
                                            className="w-full px-4 py-3 pr-10 border-2 border-red-300 rounded-xl text-center font-bold text-xl text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 font-bold">%</span>
                                    </div>
                                    <span className="text-gray-500 font-medium text-lg">/xe</span>
                                </div>
                            </div>

                            {kpiConfigMsg && (
                                <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${kpiConfigMsg.includes('thành công') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {kpiConfigMsg.includes('thành công') ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                    {kpiConfigMsg}
                                </div>
                            )}

                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                                <strong>💡 Lưu ý:</strong> Thay đổi này chỉ áp dụng cho Team của bạn. Các team khác sử dụng giá trị mặc định do Admin cấu hình.
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setShowKpiConfigModal(false);
                                        setKpiConfigMsg(null);
                                    }}
                                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={async () => {
                                        const numRate = parseFloat(kpiConfigValue);
                                        if (isNaN(numRate) || numRate < 0 || numRate > 100) {
                                            setKpiConfigMsg('Giá trị không hợp lệ (0-100%)');
                                            return;
                                        }

                                        setKpiConfigSaving(true);
                                        setKpiConfigMsg(null);
                                        try {
                                            const decimalValue = (numRate / 100).toFixed(4);

                                            // Strategy: Delete existing + Insert new (avoid constraint conflicts)
                                            // First delete any existing record for this MOD
                                            await supabase
                                                .from('app_settings')
                                                .delete()
                                                .eq('key', 'kpi_penalty_rate')
                                                .eq('manager_id', userProfile?.id);

                                            // Then insert fresh
                                            const { error } = await supabase
                                                .from('app_settings')
                                                .insert({
                                                    key: 'kpi_penalty_rate',
                                                    value: decimalValue,
                                                    description: `Tỉ lệ phạt KPI - Team ${userProfile?.full_name}`,
                                                    manager_id: userProfile?.id,
                                                    updated_at: new Date().toISOString(),
                                                    updated_by: userProfile?.id
                                                });

                                            if (error) throw error;

                                            setKpiPenaltyRate(parseFloat(decimalValue));
                                            setKpiConfigMsg(`Đã lưu thành công: ${numRate}%/xe`);
                                            showToast(`Đã cập nhật tỉ lệ phạt KPI: ${numRate}%/xe`, 'success');

                                            setTimeout(() => {
                                                setShowKpiConfigModal(false);
                                                setKpiConfigMsg(null);
                                            }, 1500);
                                        } catch (e: any) {
                                            setKpiConfigMsg('Lỗi lưu: ' + e.message);
                                        } finally {
                                            setKpiConfigSaving(false);
                                        }
                                    }}
                                    disabled={kpiConfigSaving}
                                    className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {kpiConfigSaving && <Loader2 size={16} className="animate-spin" />}
                                    Lưu cho Team
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
};

export default Finance;


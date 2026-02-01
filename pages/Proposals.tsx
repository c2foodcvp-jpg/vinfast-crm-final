
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { DemoCar, Proposal, UserProfile, Customer, CustomerStatus, ProfitExclusion } from '../types';
import {
    FileText, Car, DollarSign, CheckCircle2, XCircle, Clock, Plus, Loader2, Key, Calendar,
    AlertTriangle, ArrowRight, ShieldCheck, X, Lock
} from 'lucide-react';

const Proposals: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const [activeTab, setActiveTab] = useState<'demo' | 'salary'>('demo');
    const [loading, setLoading] = useState(true);
    const [demoCars, setDemoCars] = useState<DemoCar[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);

    // Data for Salary Calculation (Same as Finance)
    const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [profitExclusions, setProfitExclusions] = useState<ProfitExclusion[]>([]);

    // Forms
    const [showDemoModal, setShowDemoModal] = useState(false);
    const [demoForm, setDemoForm] = useState({ carId: '', reason: '' });

    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [salaryForm, setSalaryForm] = useState({ amount: '', reason: '' });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{ type: 'approve' | 'reject', proposal: Proposal } | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchData();
    }, [userProfile]);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Profiles FIRST to determine team structure for filtering
            const { data: profiles } = await supabase.from('profiles').select('*');
            const profilesList = profiles as UserProfile[] || [];
            setAllProfiles(profilesList);

            // 2. Determine Viewable User IDs based on Role (Isolation Logic)
            let viewableIds: string[] = [];

            if (isAdmin) {
                // Admin sees all
                viewableIds = profilesList.map(p => p.id);
            } else if (isMod && userProfile) {
                // Mod sees Self + Subordinates (Team)
                viewableIds = profilesList
                    .filter(p => p.id === userProfile.id || p.manager_id === userProfile.id)
                    .map(p => p.id);
            } else if (userProfile) {
                // Sales sees Self only
                viewableIds = [userProfile.id];
            }

            // 3. Fetch Demo Cars (Filtered by Team Manager)
            let carQuery = supabase.from('demo_cars').select('*').order('created_at', { ascending: false });
            if (!isAdmin && userProfile) {
                const managerId = isMod ? userProfile.id : userProfile.manager_id;
                if (managerId) {
                    carQuery = carQuery.eq('manager_id', managerId);
                }
            }
            const { data: cars } = await carQuery;
            if (cars) setDemoCars(cars as DemoCar[]);

            // 4. Fetch Proposals (Strictly Filtered by Viewable IDs)
            let pQuery = supabase.from('proposals').select('*').order('created_at', { ascending: false });

            if (viewableIds.length > 0) {
                pQuery = pQuery.in('user_id', viewableIds);
            } else {
                // Fallback safety to show nothing if IDs not resolved
                pQuery = pQuery.eq('id', '00000000-0000-0000-0000-000000000000');
            }

            const { data: props } = await pQuery;

            if (props) {
                const mapped = props.map((p: any) => ({
                    ...p,
                    user_name: profilesList?.find((u: any) => u.id === p.user_id)?.full_name || 'Unknown'
                }));
                setProposals(mapped);
            }

            // 5. Fetch Financial Data for Salary Check (Only needed if user is active)
            const { data: cust } = await supabase.from('customers').select('*');
            if (cust) setAllCustomers(cust as Customer[]);

            const { data: trans } = await supabase.from('transactions').select('*');

            if (trans) {
                // Add Helper Fields like Finance.tsx
                const extendedTrans = trans.map((t: any) => {
                    const customer = t.customer_id ? cust?.find((c: any) => c.id === t.customer_id) : null;
                    const creator = profilesList?.find((p: any) => p.id === t.user_id);
                    return {
                        ...t,
                        _source: customer?.source,
                        _is_part_time_creator: creator?.is_part_time
                    };
                });
                setAllTransactions(extendedTrans);
            }

            const { data: excl } = await supabase.from('profit_exclusions').select('*');
            if (excl) setProfitExclusions(excl as ProfitExclusion[]);

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // Date Selection
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // --- CALCULATE ESTIMATED INCOME (UPDATED LOGIC TO MATCH FINANCE.tsx) ---
    const myEstimatedIncome = useMemo(() => {
        if (!userProfile || !allProfiles.length) return 0;

        const currentMonth = selectedMonth;
        const currentYear = selectedYear;
        // Fix: Case-insensitive MKT check
        const isMKT = (src?: string) => (src || '').toUpperCase().includes('MKT');

        // 1. Identify Team Members
        let teamIds: string[] = [];
        let members: UserProfile[] = [];

        if (isAdmin) {
            members = allProfiles.filter(p => !p.is_part_time && p.status === 'active');
        } else if (userProfile.role === 'mod') {
            members = allProfiles.filter(p => (p.id === userProfile.id || p.manager_id === userProfile.id) && !p.is_part_time && p.status === 'active');
        } else {
            if (userProfile.manager_id) {
                members = allProfiles.filter(p => (p.id === userProfile.manager_id || p.manager_id === userProfile.manager_id) && !p.is_part_time && p.status === 'active');
            } else {
                members = [userProfile];
            }
        }
        teamIds = members.map(m => m.id);

        // 2. Calculate Team Pool (PNL Net)
        const filteredTransactions = allTransactions.filter(t => {
            const d = new Date(t.created_at);
            if (d.getMonth() + 1 !== currentMonth || d.getFullYear() !== currentYear) return false;
            if (!teamIds.includes(t.user_id)) return false;
            if (t.customer_id) {
                if (!isMKT(t._source)) return false;
            }
            return true;
        });

        const pnlRevenue = filteredTransactions.filter(t => t.status === 'approved' && ['deposit', 'adjustment'].includes(t.type) && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const realExpenses = filteredTransactions.filter(t => t.status === 'approved' && (t.type === 'expense' || (t.type === 'adjustment' && t.amount < 0))).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const partTimeSalaryLiability = filteredTransactions.filter(t => t._is_part_time_creator && ['deposit'].includes(t.type) && t.status === 'approved').reduce((sum, t) => sum + (t.amount * 0.3), 0);

        const displayTotalExpense = realExpenses + partTimeSalaryLiability;
        const pnlNet = pnlRevenue - displayTotalExpense;

        // 3. Calculate Share Ratios
        const eligibleProfiles = members.filter(p => !p.is_part_time && p.role !== 'admin');
        if (eligibleProfiles.length === 0) return 0;

        const totalCustomRatio = eligibleProfiles.reduce((sum, p) => sum + (p.profit_share_ratio || 0), 0);
        const profilesWithoutCustom = eligibleProfiles.filter(p => p.profit_share_ratio === null || p.profit_share_ratio === undefined);
        const remainingPercent = Math.max(0, 100 - totalCustomRatio);
        const defaultShare = profilesWithoutCustom.length > 0 ? remainingPercent / profilesWithoutCustom.length : 0;

        // 4. Calculate Distribution
        const rows = eligibleProfiles.map(emp => {
            const baseRatio = emp.profit_share_ratio !== null && emp.profit_share_ratio !== undefined ? emp.profit_share_ratio : defaultShare;
            const kpiTarget = emp.kpi_target || 0;
            const kpiActual = allCustomers.filter(c => {
                if (c.creator_id !== emp.id || c.status !== CustomerStatus.WON) return false;
                if (c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') return false;
                if (!isMKT(c.source)) return false;
                const d = new Date(c.updated_at || c.created_at);
                return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
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

            // Deduct Salary Advances specific to THIS user (strictly filters for 'ứng lương' in reason)
            const personalSalaryAdvances = filteredTransactions
                .filter(t => t.user_id === emp.id && t.type === 'advance' && t.status === 'approved' && t.reason.toLowerCase().includes('ứng lương'))
                .reduce((sum, t) => sum + t.amount, 0);

            const netPersonalAdvance = personalSalaryAdvances;

            // Add Personal Bonus (e.g. Demo Car)
            const personalBonus = filteredTransactions.filter(t => t.user_id === emp.id && t.type === 'personal_bonus' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);

            const estimatedIncome = (personalNetPool * (finalShareRatio / 100)) - netPersonalAdvance + personalBonus;

            return {
                user: emp,
                finalShareRatio,
                estimatedIncome,
                excludedCustomerIds: userExclusions
            };
        });

        // Redistribution Logic (simplified)
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
                    });
                }
            });
        });

        // 5. Find Current User Result
        const myRow = rows.find(r => r.user.id === userProfile.id);
        return myRow ? myRow.estimatedIncome : 0;

    }, [allTransactions, allCustomers, allProfiles, userProfile, profitExclusions, selectedMonth, selectedYear]);

    // --- SUBMIT HANDLERS ---
    const handleSubmitDemo = async () => {
        if (!demoForm.carId) { showToast("Vui lòng chọn xe", 'error'); return; }
        const car = demoCars.find(c => c.id === demoForm.carId);
        if (!car) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('proposals').insert([{
                type: 'demo_car',
                user_id: userProfile?.id,
                data: { car_id: car.id, car_name: car.name, price: car.price, owner_id: car.owner_id },
                amount: car.price,
                reason: demoForm.reason || `Mượn xe ${car.name}`,
                status: 'pending'
            }]);
            if (error) throw error;
            setShowDemoModal(false); setDemoForm({ carId: '', reason: '' }); fetchData(); showToast("Gửi đề xuất thành công!", 'success');
        } catch (e: any) {
            const msg = e.message || JSON.stringify(e);
            if (msg.includes('404') || msg.includes('relation "public.proposals" does not exist')) {
                showToast("Lỗi: Bảng Proposals chưa được tạo. Vui lòng báo Admin vào Cấu hình chạy SQL fix lỗi.", 'error');
            } else {
                showToast("Lỗi gửi đề xuất: " + msg, 'error');
            }
        } finally { setIsSubmitting(false); }
    };

    const handleSubmitSalary = async () => {
        const amount = Number(salaryForm.amount.replace(/\./g, ''));
        if (!amount || amount <= 0) { showToast("Số tiền không hợp lệ", 'error'); return; }

        // Validate 30%
        const limit = myEstimatedIncome * 0.3;
        if (amount > limit) { showToast(`Vượt quá hạn mức 30% (${limit.toLocaleString('vi-VN')} VNĐ)`, 'error'); return; }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('proposals').insert([{
                type: 'salary_advance',
                user_id: userProfile?.id,
                amount: amount,
                reason: salaryForm.reason || 'Ứng lương',
                status: 'pending'
            }]);
            if (error) throw error;
            setShowSalaryModal(false); setSalaryForm({ amount: '', reason: '' }); fetchData(); showToast("Gửi đề xuất thành công!", 'success');
        } catch (e: any) {
            const msg = e.message || JSON.stringify(e);
            if (msg.includes('404') || msg.includes('relation "public.proposals" does not exist')) {
                showToast("Lỗi: Bảng Proposals chưa được tạo. Vui lòng báo Admin vào Cấu hình chạy SQL fix lỗi.", 'error');
            } else {
                showToast("Lỗi gửi đề xuất: " + msg, 'error');
            }
        } finally { setIsSubmitting(false); }
    };

    // --- APPROVAL HANDLERS (MOD/ADMIN) ---
    const handleOpenActionModal = (prop: Proposal, type: 'approve' | 'reject') => {
        setConfirmModal({ type, proposal: prop });
    };

    const executeAction = async () => {
        if (!confirmModal) return;
        const { type, proposal } = confirmModal;

        setIsSubmitting(true);
        try {
            if (type === 'approve') {
                // 1. Update Proposal Status
                const { error: pError } = await supabase.from('proposals').update({ status: 'approved', approved_by: userProfile?.id }).eq('id', proposal.id);
                if (pError) throw pError;

                // 2. Create Financial Transactions based on Type
                if (proposal.type === 'demo_car') {
                    const carData = proposal.data;

                    // A. Identity Team & Split Cost
                    const creator = allProfiles.find(p => p.id === proposal.user_id);
                    if (creator) {
                        let teamMembers: UserProfile[] = [];
                        let modId = creator.role === 'mod' ? creator.id : creator.manager_id;

                        // Fallback: If no manager_id (and not mod), try to find if they are the manager
                        if (!modId && creator.role !== 'admin') modId = creator.id;

                        if (modId) {
                            // Team = MOD + Subordinates
                            teamMembers = allProfiles.filter(p =>
                                (p.id === modId || p.manager_id === modId) &&
                                p.status === 'active' &&
                                !p.is_part_time
                            );
                        } else {
                            // Standalone or weird case, just charge the creator
                            teamMembers = [creator];
                        }

                        if (teamMembers.length > 0) {
                            const splitAmount = Math.round(proposal.amount / teamMembers.length);

                            // Create deduction transactions for each member
                            const deductionPromises = teamMembers.map(member =>
                                supabase.from('transactions').insert([{
                                    user_id: member.id,
                                    user_name: member.full_name,
                                    type: 'personal_bonus', // Negative bonus = Deduction
                                    amount: -splitAmount, // NEGATIVE
                                    reason: `Phí mượn xe Demo (${carData.car_name}) - Share team`,
                                    status: 'approved',
                                    approved_by: userProfile?.id
                                }])
                            );
                            await Promise.all(deductionPromises);
                        }
                    }

                    // B. Add to Owner (Personal Bonus) -> Increases Owner's Income
                    const owner = allProfiles.find(p => p.id === carData.owner_id);
                    await supabase.from('transactions').insert([{
                        user_id: carData.owner_id,
                        user_name: owner?.full_name || 'Owner',
                        type: 'personal_bonus',
                        amount: proposal.amount,
                        reason: `Thu tiền cho thuê xe Demo (${carData.car_name})`,
                        status: 'approved',
                        approved_by: userProfile?.id
                    }]);

                } else if (proposal.type === 'salary_advance') {
                    // A. Create Advance Transaction -> Deducted from Individual's share later, NOT from pool expenses
                    await supabase.from('transactions').insert([{
                        user_id: proposal.user_id,
                        user_name: proposal.user_name,
                        type: 'advance',
                        amount: proposal.amount,
                        reason: `Ứng lương (Đề xuất): ${proposal.reason}`,
                        status: 'approved',
                        approved_by: userProfile?.id
                    }]);
                }
                showToast("Đã duyệt và tạo giao dịch!", 'success');
            } else {
                // Reject
                await supabase.from('proposals').update({ status: 'rejected', approved_by: userProfile?.id }).eq('id', proposal.id);
                showToast("Đã từ chối đề xuất.", 'success');
            }

            fetchData();
            setConfirmModal(null);
        } catch (e: any) {
            showToast("Lỗi xử lý: " + e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 relative">
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="text-blue-600" /> Đề Xuất & Duyệt</h1>
                    <p className="text-gray-500 text-sm">Gửi yêu cầu mượn xe hoặc ứng lương.</p>
                </div>
            </div>

            <div className="flex gap-4 border-b border-gray-200">
                <button onClick={() => setActiveTab('demo')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 ${activeTab === 'demo' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
                    <Key size={18} /> Mượn xe Demo
                </button>
                <button onClick={() => setActiveTab('salary')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 ${activeTab === 'salary' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>
                    <DollarSign size={18} /> Ứng lương
                </button>
            </div>

            {activeTab === 'demo' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Danh sách xe Demo khả dụng</h3>
                        <button onClick={() => setShowDemoModal(true)} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200"><Plus size={18} /> Đề xuất Mượn</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {demoCars.length === 0 ? <p className="col-span-3 text-center text-gray-400 py-8">Chưa có xe demo nào cho Team của bạn. Vui lòng liên hệ MOD cấu hình.</p> : demoCars.map(car => (
                            <div key={car.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2"><Car className="text-purple-500" /> <span className="font-bold text-gray-900">{car.name}</span></div>
                                    <p className="text-sm text-gray-500">Giá mượn: <span className="font-bold text-purple-600">{car.price.toLocaleString('vi-VN')} đ</span></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'salary' && (
                <div className="space-y-6">
                    {/* Month/Year Selector */}
                    <div className="flex justify-end items-center gap-3">
                        <label className="text-sm font-medium text-gray-500">Kỳ tính lương:</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                        >
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                            <option value={2027}>2027</option>
                        </select>
                    </div>

                    {userProfile?.is_locked_advance ? (
                        <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 flex flex-col items-center gap-4 text-center">
                            <Lock size={48} className="text-red-500" />
                            <h3 className="font-bold text-red-900 text-lg">Tài khoản bị khoá ứng lương</h3>
                            <p className="text-red-600 text-sm">Bạn đã bị khoá quyền ứng lương. Vui lòng liên hệ Quản lý để được hỗ trợ.</p>
                        </div>
                    ) : (
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-200 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="font-bold text-green-900 text-lg">Thông tin Ứng lương</h3>
                                <p className="text-green-700 text-sm mt-1">Hạn mức tối đa: <strong>30%</strong> thu nhập dự kiến hiện tại.</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-green-600 font-bold uppercase">Thu nhập Dự kiến (T{selectedMonth}/{selectedYear})</p>
                                <p className="text-lg font-bold text-gray-800">{myEstimatedIncome.toLocaleString('vi-VN')} VNĐ</p>
                                <p className="text-xs text-green-600 font-bold uppercase mt-2">Khả dụng ứng (Max 30%)</p>
                                <p className="text-2xl font-bold text-green-700">{(myEstimatedIncome * 0.3).toLocaleString('vi-VN')} VNĐ</p>
                            </div>
                            <button onClick={() => setShowSalaryModal(true)} className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200"><Plus size={18} /> Đề xuất Ứng</button>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100"><h3 className="font-bold text-gray-900">Lịch sử Đề xuất</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Loại</th>
                                <th className="px-4 py-3">Người gửi</th>
                                <th className="px-4 py-3">Chi tiết / Số tiền</th>
                                <th className="px-4 py-3">Trạng thái</th>
                                <th className="px-4 py-3">Ngày tạo</th>
                                {(isAdmin || isMod) && <th className="px-4 py-3 text-center">Hành động</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {proposals.filter(p => activeTab === 'demo' ? p.type === 'demo_car' : p.type === 'salary_advance').map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        {p.type === 'demo_car' ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">Mượn xe</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Ứng lương</span>}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-gray-700">{p.user_name}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-gray-900">{p.amount.toLocaleString('vi-VN')} VNĐ</p>
                                        <p className="text-xs text-gray-500">{p.reason}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.status === 'pending' ? <span className="text-yellow-600 bg-yellow-100 px-2 py-1 rounded text-xs font-bold">Chờ duyệt</span> : p.status === 'approved' ? <span className="text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-bold">Đã duyệt</span> : <span className="text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-bold">Từ chối</span>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
                                    {(isAdmin || isMod) && (
                                        <td className="px-4 py-3 text-center">
                                            {p.status === 'pending' && (
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleOpenActionModal(p, 'approve')} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16} /></button>
                                                    <button onClick={() => handleOpenActionModal(p, 'reject')} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16} /></button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {proposals.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">Chưa có dữ liệu.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CONFIRMATION MODAL */}
            {confirmModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmModal.type === 'approve' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {confirmModal.type === 'approve' ? <ShieldCheck size={24} /> : <XCircle size={24} />}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {confirmModal.type === 'approve' ? 'Xác nhận Duyệt?' : 'Xác nhận Từ chối?'}
                            </h3>
                            <p className="text-gray-500 text-sm mb-6">
                                {confirmModal.type === 'approve'
                                    ? 'Hành động này sẽ tạo giao dịch và trừ/cộng tiền vào quỹ tương ứng.'
                                    : 'Đề xuất này sẽ bị hủy bỏ và không tạo giao dịch.'}
                            </p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
                                <button
                                    onClick={executeAction}
                                    disabled={isSubmitting}
                                    className={`flex-1 py-2.5 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 ${confirmModal.type === 'approve' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                                >
                                    {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                                    {confirmModal.type === 'approve' ? 'Duyệt ngay' : 'Từ chối'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DEMO MODAL */}
            {showDemoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Đề xuất mượn xe Demo</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Chọn xe</label>
                                <select className="w-full border p-2 rounded-xl" value={demoForm.carId} onChange={e => setDemoForm({ ...demoForm, carId: e.target.value })}>
                                    <option value="">-- Chọn xe --</option>
                                    {demoCars.map(c => <option key={c.id} value={c.id}>{c.name} ({c.price.toLocaleString()}đ)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Lý do / Ngày giờ</label>
                                <input className="w-full border p-2 rounded-xl" value={demoForm.reason} onChange={e => setDemoForm({ ...demoForm, reason: e.target.value })} placeholder="VD: Khách lái thử sáng thứ 2" />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => setShowDemoModal(false)} className="px-4 py-2 bg-gray-100 rounded-xl font-bold">Hủy</button>
                                <button onClick={handleSubmitDemo} disabled={isSubmitting} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold flex items-center gap-2">{isSubmitting && <Loader2 className="animate-spin" size={16} />} Gửi</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SALARY MODAL */}
            {showSalaryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Đề xuất Ứng lương</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền muốn ứng (VNĐ)</label>
                                <input className="w-full border p-2 rounded-xl font-bold" value={salaryForm.amount} onChange={e => setSalaryForm({ ...salaryForm, amount: e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".") })} placeholder="5.000.000" />
                                <p className="text-xs text-gray-500 mt-1">Tối đa: {(myEstimatedIncome * 0.3).toLocaleString()} VNĐ</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Lý do</label>
                                <input className="w-full border p-2 rounded-xl" value={salaryForm.reason} onChange={e => setSalaryForm({ ...salaryForm, reason: e.target.value })} />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => setShowSalaryModal(false)} className="px-4 py-2 bg-gray-100 rounded-xl font-bold">Hủy</button>
                                <button onClick={handleSubmitSalary} disabled={isSubmitting} className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold flex items-center gap-2">{isSubmitting && <Loader2 className="animate-spin" size={16} />} Gửi</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proposals;


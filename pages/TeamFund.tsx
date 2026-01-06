
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { TeamFine, UserProfile, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';
import { PiggyBank, Plus, CheckCircle2, AlertOctagon, History, User, Filter, Loader2, X, Wallet, BellRing, ArrowUpRight, ArrowDownLeft, Terminal, Copy, Database, Trash2, Check, XCircle, AlertTriangle } from 'lucide-react';

interface TeamExpense {
    id: string;
    created_by: string;
    amount: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    approved_by?: string;
    created_at: string;
    user_name?: string; // Mapped
}

const TeamFund: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  const [fines, setFines] = useState<TeamFine[]>([]);
  const [expenses, setExpenses] = useState<TeamExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [totalFund, setTotalFund] = useState(0);
  
  // My Fines
  const [myPendingFines, setMyPendingFines] = useState<TeamFine[]>([]);

  // Modal State
  const [showFineModal, setShowFineModal] = useState(false);
  const [fineForm, setFineForm] = useState({ userId: '', amount: '', reason: '' });
  
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', reason: '' });

  // ACTION CONFIRMATION MODAL
  const [confirmAction, setConfirmAction] = useState<{
      type: 'approve_expense' | 'reject_expense' | 'collect_fine';
      id: string;
      title: string;
      message: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Toast & DB Check
  const [showSql, setShowSql] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (userProfile?.is_part_time) {
        navigate('/');
        return;
    }
    fetchData();
  }, [userProfile]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: empData } = await supabase.from('profiles').select('*');
      if (empData) setEmployees(empData as UserProfile[]);

      const { data: fineData, error: fineError } = await supabase.from('team_fines').select('*').order('created_at', { ascending: false });
      if (fineError) throw fineError;

      // Check Expenses Table exists
      const { data: expData, error: expError } = await supabase.from('team_fund_expenses').select('*').order('created_at', { ascending: false });
      
      if (expError) {
          if (expError.code === '42P01') setShowSql(true); // Table missing
          else console.error("Error fetching expenses", expError);
      }

      // Map names
      const mappedFines = (fineData as TeamFine[]).map(f => {
          const u = empData?.find(e => e.id === f.user_id);
          return { ...f, user_name: u?.full_name || 'Unknown' };
      });
      setFines(mappedFines);

      const mappedExpenses = (expData || []).map((e: TeamExpense) => {
          const u = empData?.find(p => p.id === e.created_by);
          return { ...e, user_name: u?.full_name || 'Unknown' };
      });
      setExpenses(mappedExpenses);

      if (userProfile) {
          const myPending = mappedFines.filter(f => f.user_id === userProfile.id && f.status === 'pending');
          setMyPendingFines(myPending);
      }

      const income = mappedFines.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
      const outcome = mappedExpenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
      setTotalFund(income - outcome);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFine = async () => {
      const amount = Number(fineForm.amount.replace(/\./g, ''));
      if (!fineForm.userId || !amount || !fineForm.reason) { showToast("Vui lòng nhập đủ thông tin.", 'error'); return; }
      
      setIsSubmitting(true);
      try {
          const { error } = await supabase.from('team_fines').insert([{
              user_id: fineForm.userId,
              created_by: userProfile?.id,
              amount: amount,
              reason: fineForm.reason,
              status: 'pending',
              created_at: new Date().toISOString()
          }]);
          if (error) throw error;
          setShowFineModal(false);
          setFineForm({ userId: '', amount: '', reason: '' });
          fetchData();
          showToast("Đã tạo phiếu phạt thành công!", 'success');
      } catch (e) { showToast("Lỗi tạo phiếu phạt.", 'error'); } finally { setIsSubmitting(false); }
  };

  const handleRequestExpense = async () => {
      const amount = Number(expenseForm.amount.replace(/\./g, ''));
      if (!amount || !expenseForm.reason) { showToast("Vui lòng nhập số tiền và nội dung chi.", 'error'); return; }
      
      setIsSubmitting(true);
      try {
          const { error } = await supabase.from('team_fund_expenses').insert([{
              created_by: userProfile?.id,
              amount: amount,
              reason: expenseForm.reason,
              status: 'pending', // Always pending initially
              created_at: new Date().toISOString()
          }]);
          if (error) throw error;
          setShowExpenseModal(false);
          setExpenseForm({ amount: '', reason: '' });
          fetchData();
          showToast("Đã gửi yêu cầu. Vui lòng đợi duyệt.", 'success');
      } catch (e: any) { 
          if (e.code === '42P01') {
              showToast("Lỗi: Chưa có bảng database. Báo Admin.", 'error');
              setShowSql(true);
          } else {
              showToast("Lỗi gửi yêu cầu: " + e.message, 'error'); 
          }
      } finally { setIsSubmitting(false); }
  };

  // Trigger Modal instead of window.confirm
  const openConfirmAction = (type: 'approve_expense' | 'reject_expense' | 'collect_fine', id: string) => {
      let title = '';
      let message = '';
      if (type === 'approve_expense') { title = 'Duyệt chi tiền?'; message = 'Bạn xác nhận duyệt khoản chi này? Tiền quỹ sẽ bị trừ.'; }
      if (type === 'reject_expense') { title = 'Từ chối chi?'; message = 'Bạn xác nhận từ chối yêu cầu này?'; }
      if (type === 'collect_fine') { title = 'Thu tiền phạt?'; message = 'Xác nhận nhân viên đã đóng tiền mặt?'; }
      setConfirmAction({ type, id, title, message });
  };

  const executeConfirmAction = async () => {
      if (!confirmAction) return;
      setIsSubmitting(true);
      try {
          if (confirmAction.type === 'collect_fine') {
              await supabase.from('team_fines').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', confirmAction.id);
              showToast("Đã xác nhận thu tiền!", 'success');
          } else {
              // Expense actions
              const status = confirmAction.type === 'approve_expense' ? 'approved' : 'rejected';
              const { error } = await supabase.from('team_fund_expenses')
                .update({ status: status, approved_by: userProfile?.id })
                .eq('id', confirmAction.id);
              if (error) throw error;
              showToast(status === 'approved' ? "Đã duyệt chi!" : "Đã từ chối!", status === 'approved' ? 'success' : 'error');
          }
          fetchData();
      } catch (e: any) {
          showToast("Lỗi: " + e.message, 'error');
          if (isAdmin) setShowSql(true);
      } finally {
          setIsSubmitting(false);
          setConfirmAction(null);
      }
  };

  const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

  const setupSQL = `
-- 1. Tạo bảng (nếu chưa có)
create table if not exists public.team_fund_expenses (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references public.profiles(id),
  amount numeric not null,
  reason text,
  status text default 'pending',
  approved_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 2. Bật RLS
alter table public.team_fund_expenses enable row level security;

-- 3. Xóa policy cũ (để tránh lỗi trùng)
drop policy if exists "Enable read for authenticated" on public.team_fund_expenses;
drop policy if exists "Enable insert for authenticated" on public.team_fund_expenses;
drop policy if exists "Enable update for admins/mods" on public.team_fund_expenses;
drop policy if exists "Enable all for admins/mods" on public.team_fund_expenses;

-- 4. Tạo Policy mới
-- Cho phép mọi người xem
create policy "Enable read for authenticated" on public.team_fund_expenses for select using (true);

-- Cho phép mọi người thêm yêu cầu
create policy "Enable insert for authenticated" on public.team_fund_expenses for insert with check (true);

-- Cho phép Admin/Mod sửa (Duyệt/Từ chối/Xóa)
create policy "Enable all for admins/mods" on public.team_fund_expenses for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'mod'))
);
`;

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">
      
      {toast && (
          <div className={`fixed top-4 right-4 z-[70] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="font-bold text-sm">{toast.msg}</span>
          </div>
      )}

      {myPendingFines.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 animate-pulse shadow-lg shadow-red-100">
              <div className="flex items-start gap-4">
                  <div className="bg-red-100 p-3 rounded-full text-red-600"><BellRing size={24} /></div>
                  <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-800">Thông báo đóng phạt</h3>
                      <p className="text-red-700 text-sm mt-1">Bạn có <span className="font-bold">{myPendingFines.length} khoản phạt</span> chưa nộp. Vui lòng liên hệ Admin/Mod để đóng quỹ.</p>
                  </div>
              </div>
          </div>
      )}

      {/* SQL HELPER FOR ADMIN */}
      {isAdmin && (
          <div className="mb-4">
              <button onClick={() => setShowSql(!showSql)} className="text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1 underline">
                  <Database size={12}/> {showSql ? 'Ẩn mã SQL' : 'Hiện mã SQL cấu hình Database'}
              </button>
              {showSql && (
                  <div className="mt-2 bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono relative border border-slate-700 shadow-xl">
                      <p className="text-green-400 mb-2 font-bold">// Copy đoạn này vào Supabase SQL Editor để sửa lỗi quyền cập nhật (RLS):</p>
                      <pre className="overflow-x-auto pb-4">{setupSQL}</pre>
                      <button onClick={() => { navigator.clipboard.writeText(setupSQL); alert("Đã copy SQL! Hãy chạy trong Supabase."); }} className="absolute top-4 right-4 p-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold flex items-center gap-2">
                          <Copy size={14}/> Copy SQL
                      </button>
                  </div>
              )}
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><PiggyBank className="text-pink-500" /> Quỹ Nhóm & Tiền Phạt</h1>
              <p className="text-gray-500 text-sm">Quản lý thu chi nội bộ team.</p>
          </div>
          <div className="flex gap-2">
              <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                  <ArrowUpRight size={18} className="text-red-500"/> Chi tiền
              </button>
              {(isAdmin || isMod) && (
                  <button onClick={() => setShowFineModal(true)} className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-200 hover:bg-pink-700 transition-all">
                      <AlertOctagon size={18} /> Phạt Nhân viên
                  </button>
              )}
          </div>
      </div>

      {/* Fund Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-pink-50 to-rose-100 p-6 rounded-2xl border border-pink-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
              <p className="text-pink-800 font-bold uppercase text-xs mb-1 z-10">Tổng Quỹ Nhóm (Thực Tế)</p>
              <p className="text-3xl font-bold text-pink-900 z-10">{formatCurrency(totalFund)} VNĐ</p>
              <div className="absolute -right-4 -bottom-4 text-pink-200 opacity-50"><Wallet size={100}/></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-500 font-bold uppercase text-xs">Đang chờ thu (Phạt)</p>
                  <ArrowDownLeft size={16} className="text-green-500"/>
              </div>
              <p className="text-2xl font-bold text-green-600">+{formatCurrency(fines.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0))} VNĐ</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-500 font-bold uppercase text-xs">Đang chờ duyệt chi</p>
                  <ArrowUpRight size={16} className="text-red-500"/>
              </div>
              <p className="text-2xl font-bold text-red-600">-{formatCurrency(expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0))} VNĐ</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fines List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowDownLeft size={18} className="text-green-600"/> Khoản Thu (Phạt)</h3>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                  <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-white sticky top-0">
                          <tr>
                              <th className="px-3 py-2">Nhân viên</th>
                              <th className="px-3 py-2">Lý do</th>
                              <th className="px-3 py-2 text-right">Số tiền</th>
                              <th className="px-3 py-2 text-center">TT</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {fines.map(fine => (
                              <tr key={fine.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-3 font-bold text-gray-700">{fine.user_name}</td>
                                  <td className="px-3 py-3 text-gray-500 truncate max-w-[100px]" title={fine.reason}>{fine.reason}</td>
                                  <td className="px-3 py-3 font-bold text-green-600 text-right">+{formatCurrency(fine.amount)}</td>
                                  <td className="px-3 py-3 text-center">
                                      {fine.status === 'paid' ? (
                                          <span className="text-green-600 text-[10px] font-bold bg-green-100 px-2 py-1 rounded">Đã thu</span>
                                      ) : (isAdmin || isMod) ? (
                                          <button onClick={() => openConfirmAction('collect_fine', fine.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Thu</button>
                                      ) : (
                                          <span className="text-orange-600 text-[10px] font-bold bg-orange-100 px-2 py-1 rounded">Chưa nộp</span>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Expenses List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowUpRight size={18} className="text-red-600"/> Khoản Chi</h3>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                  <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-white sticky top-0">
                          <tr>
                              <th className="px-3 py-2">Người yêu cầu</th>
                              <th className="px-3 py-2">Lý do</th>
                              <th className="px-3 py-2 text-right">Số tiền</th>
                              <th className="px-3 py-2 text-center">TT</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {expenses.map(exp => (
                              <tr key={exp.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-3 font-bold text-gray-700">{exp.user_name}</td>
                                  <td className="px-3 py-3 text-gray-500 truncate max-w-[100px]" title={exp.reason}>{exp.reason}</td>
                                  <td className="px-3 py-3 font-bold text-red-600 text-right">-{formatCurrency(exp.amount)}</td>
                                  <td className="px-3 py-3 text-center">
                                      {exp.status === 'pending' ? (
                                          (isAdmin || isMod) ? (
                                              <div className="flex justify-center gap-1.5">
                                                  <button onClick={(e) => {e.stopPropagation(); openConfirmAction('approve_expense', exp.id)}} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors" title="Duyệt"><Check size={16}/></button>
                                                  <button onClick={(e) => {e.stopPropagation(); openConfirmAction('reject_expense', exp.id)}} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors" title="Từ chối"><X size={16}/></button>
                                              </div>
                                          ) : <span className="text-yellow-600 text-[10px] font-bold bg-yellow-100 px-2 py-1 rounded">Chờ duyệt</span>
                                      ) : (
                                          <span className={`text-[10px] font-bold px-2 py-1 rounded ${exp.status === 'approved' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                              {exp.status === 'approved' ? 'Đã chi' : 'Từ chối'}
                                          </span>
                                      )}
                                  </td>
                              </tr>
                          ))}
                          {expenses.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">Chưa có khoản chi nào.</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      {/* MODAL XÁC NHẬN HÀNH ĐỘNG (Replacing window.confirm) */}
      {confirmAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmAction.title}</h3>
                  <p className="text-gray-600 text-sm mb-6">{confirmAction.message}</p>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setConfirmAction(null)} 
                          className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                          Hủy
                      </button>
                      <button 
                          onClick={executeConfirmAction} 
                          disabled={isSubmitting}
                          className={`flex-1 py-2.5 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2
                              ${confirmAction.type === 'approve_expense' || confirmAction.type === 'collect_fine' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}
                          `}
                      >
                          {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                          Xác nhận
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Phạt */}
      {showFineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><AlertOctagon className="text-pink-600"/> Phạt Nhân viên</h3>
                      <button onClick={() => setShowFineModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Chọn nhân viên bị phạt</label>
                          <select className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white" value={fineForm.userId} onChange={e => setFineForm({...fineForm, userId: e.target.value})}>
                              <option value="">-- Chọn nhân viên --</option>
                              {employees.filter(e => e.role !== 'admin' && !e.is_part_time).map(e => (
                                  <option key={e.id} value={e.id}>{e.full_name}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền phạt (VNĐ)</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 font-bold" value={fineForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setFineForm({...fineForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} placeholder="VD: 500.000" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Lý do / Vi phạm</label>
                          <input type="text" className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500" value={fineForm.reason} onChange={e => setFineForm({...fineForm, reason: e.target.value})} placeholder="VD: Đi muộn, Trang phục..." />
                      </div>
                      <button onClick={handleCreateFine} disabled={isSubmitting} className="w-full py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-700 flex items-center justify-center gap-2 mt-2">
                          {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : 'Xác nhận Phạt'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Chi Tiền - Clean Design */}
      {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-3">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ArrowUpRight className="text-red-600"/> Chi Tiền Quỹ Nhóm</h3>
                      <button onClick={() => setShowExpenseModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  
                  <div className="space-y-5">
                      <div className="bg-gray-50 text-gray-600 p-3 rounded-xl text-xs border border-gray-100">
                          Yêu cầu sẽ được gửi ở trạng thái <strong>Chờ duyệt</strong>. Admin/Mod sẽ xem xét.
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-900 mb-1.5">Số tiền chi (VNĐ)</label>
                          <div className="relative">
                              <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-gray-500 font-bold text-lg text-gray-900 bg-white" 
                                value={expenseForm.amount} 
                                onChange={e => { const v = e.target.value.replace(/\D/g, ''); setExpenseForm({...expenseForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} 
                                placeholder="500.000" 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">VNĐ</span>
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-900 mb-1.5">Nội dung chi</label>
                          <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-gray-500 text-gray-900 bg-white" 
                            value={expenseForm.reason} 
                            onChange={e => setExpenseForm({...expenseForm, reason: e.target.value})} 
                            placeholder="VD: Mua nước, liên hoan..." 
                          />
                      </div>
                      <button 
                        onClick={handleRequestExpense} 
                        disabled={isSubmitting} 
                        className="w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-red-200 transition-all active:scale-95"
                      >
                          {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : 'Gửi yêu cầu Chi'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TeamFund;


import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Customer, UserRole, CustomerStatus } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { BadgeDollarSign, Wallet, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock, QrCode, Upload, Save, X, Filter, Settings2, Building2, Calendar, Loader2 } from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

interface ExtendedTransaction extends Transaction {
  _source?: string;
}

const Finance: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // Filter State
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mkt' | 'other'>('all');
  
  // New Month/Year Filter
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [filterMode, setFilterMode] = useState<'creation' | 'deal'>('creation'); // 'creation': Created At, 'deal': Deal/Transaction Date

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ customerId: '', amount: '', reason: 'Nộp quỹ' });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newQrUrl, setNewQrUrl] = useState('');
  const [isSavingQr, setIsSavingQr] = useState(false);

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', reason: '' });

  useEffect(() => {
    fetchData();
    fetchQrSettings();
  }, []);

  const fetchQrSettings = async () => {
      try {
          const { data } = await supabase.from('app_settings').select('value').eq('key', 'finance_qr_url').maybeSingle();
          if (data) setQrCodeUrl(data.value);
      } catch (e) {
          console.error("Lỗi tải QR", e);
      }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Transactions - SHOW ALL FOR EVERYONE
      let query = supabase.from('transactions').select('*').order('created_at', { ascending: false });
      
      const { data: transData, error: transError } = await query;
      if (transError) throw transError;
      
      // 2. Fetch Customers
      let custQuery = supabase.from('customers').select('id, name, phone, source, deal_details, status, deal_status, created_at, creator_id');
      const { data: custData, error: custError } = await custQuery;
      if (custError) throw custError;

      const mappedTransactions: ExtendedTransaction[] = (transData as Transaction[]).map(t => {
          const c = (custData as Customer[]).find(cd => cd.id === t.customer_id);
          return { ...t, _source: c?.source || 'Khác' };
      });

      setTransactions(mappedTransactions);
      setAllCustomers(custData as Customer[]); 

    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleApprove = async (id: string, approve: boolean) => {
      if (!isAdmin && !isMod) return;
      try {
          await supabase.from('transactions').update({ status: approve ? 'approved' : 'rejected', approved_by: userProfile?.id }).eq('id', id);
          fetchData();
      } catch(e) { alert("Lỗi cập nhật"); }
  };

  const handleSaveQr = async () => {
      if (!newQrUrl.trim()) return;
      setIsSavingQr(true);
      try {
          const { error } = await supabase.from('app_settings').upsert({ 
              key: 'finance_qr_url', 
              value: newQrUrl 
          });
          
          if (error) throw error;
          
          setQrCodeUrl(newQrUrl);
          setShowConfigModal(false);
          alert("Đã lưu cấu hình QR thành công!");
      } catch (e: any) {
          alert("Lỗi lưu QR: " + e.message + ". Vui lòng đảm bảo bạn đã chạy SQL trong trang Profile.");
      } finally {
          setIsSavingQr(false);
      }
  };

  const handleSubmitDeposit = async () => {
      const amount = Number(depositForm.amount.replace(/\./g, ''));
      if (!depositForm.customerId || !amount || amount <= 0) return;
      
      const cust = allCustomers.find(c => c.id === depositForm.customerId);
      
      // Logic: Admin/Mod nộp thì duyệt luôn, TVBH nộp thì Pending
      const status = (isAdmin || isMod) ? 'approved' : 'pending';

      try {
          const { error } = await supabase.from('transactions').insert([{
              customer_id: depositForm.customerId,
              customer_name: cust ? cust.name : 'Khách hàng', 
              user_id: userProfile?.id,
              user_name: userProfile?.full_name,
              type: 'deposit',
              amount: amount,
              reason: depositForm.reason,
              status: status,
              approved_by: status === 'approved' ? userProfile?.id : null
          }]);
          if (error) throw error;
          setShowDepositModal(false);
          setDepositForm({ customerId: '', amount: '', reason: 'Nộp quỹ' });
          fetchData();
          
          if (status === 'pending') {
              alert("Đã gửi yêu cầu nộp tiền. Vui lòng chờ Admin/Mod xác nhận.");
          } else {
              alert("Đã nộp quỹ thành công!");
          }
      } catch (e) { alert("Lỗi nộp tiền"); }
  };

  const handleSubmitAdjustment = async () => {
      // 1. Safe parsing of amount. Remove dots, commas, but keep negative sign.
      // E.g. "-500.000" -> "-500000"
      const cleanAmountStr = adjustmentForm.amount.replace(/[^0-9-]/g, ''); 
      const numAmount = Number(cleanAmountStr);

      if (isNaN(numAmount) || numAmount === 0) {
          alert("Vui lòng nhập số tiền hợp lệ.");
          return;
      }
      if (!adjustmentForm.reason.trim()) {
          alert("Vui lòng nhập lý do điều chỉnh.");
          return;
      }
      if (!userProfile?.id) {
          alert("Phiên đăng nhập hết hạn. Vui lòng F5 lại trang.");
          return;
      }

      try {
          // Explicitly define the payload structure to match DB schema
          const payload = {
              user_id: userProfile.id,
              user_name: userProfile.full_name,
              type: 'adjustment', // Must match check constraint
              amount: numAmount,
              reason: `[Điều chỉnh] ${adjustmentForm.reason}`,
              status: 'approved',
              approved_by: userProfile.id
          };

          const { error } = await supabase.from('transactions').insert([payload]);
          
          if (error) throw error;
          
          setShowAdjustmentModal(false);
          setAdjustmentForm({ amount: '', reason: '' });
          fetchData();
          alert("Đã điều chỉnh quỹ thành công!");
      } catch (e: any) { 
          alert("Lỗi điều chỉnh: " + (e.message || "Kiểm tra lại dữ liệu nhập.")); 
      }
  };

  // --- FILTERING LOGIC ---
  const isMKT = (src?: string) => src === 'MKT Group';
  
  // Month/Year Filtering Helper
  const isInMonthYear = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  };

  const filteredTransactions = transactions.filter(t => {
      if (!isInMonthYear(t.created_at)) return false;
      if (sourceFilter === 'all') return true;
      if (sourceFilter === 'mkt') return isMKT(t._source);
      return !isMKT(t._source);
  });

  const filteredCustomers = allCustomers.filter(c => {
      if (!isInMonthYear(c.created_at)) return false; 
      
      if (sourceFilter === 'all') return true;
      if (sourceFilter === 'mkt') return isMKT(c.source);
      return !isMKT(c.source);
  });

  // --- CALCULATIONS ---
  const totalIn = filteredTransactions
      .filter(t => ['deposit', 'revenue', 'adjustment', 'repayment'].includes(t.type) && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

  const totalOut = filteredTransactions
      .filter(t => ['expense', 'advance'].includes(t.type) && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

  const fundRemaining = totalIn - totalOut;

  const totalExpensesOnly = filteredTransactions
      .filter(t => t.type === 'expense' && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);
  
  const netRevenueDisplay = totalIn - totalExpensesOnly;

  // Chart 1: Fund Overview
  const pieData1 = [
      { name: 'Tồn quỹ', value: fundRemaining > 0 ? fundRemaining : 0 },
      { name: 'Đã chi/ứng', value: totalOut }
  ];

  // Chart 2: Collection Progress
  const totalDeposited = filteredTransactions
      .filter(t => ['deposit', 'revenue'].includes(t.type) && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

  const totalExpectedRevenue = filteredCustomers.reduce((sum, c) => sum + Number(c.deal_details?.revenue || 0), 0);

  const collectionData = [
      { name: 'Tổng quan', 'Dự kiến': totalExpectedRevenue, 'Đã thu': totalDeposited }
  ];

  const deposits = filteredTransactions.filter(t => ['deposit', 'revenue', 'adjustment', 'repayment'].includes(t.type));
  const expenses = filteredTransactions.filter(t => ['expense', 'advance'].includes(t.type));
  const dealerDebts = filteredTransactions.filter(t => t.type === 'dealer_debt');

  const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

  // Filter Customers for Deposit Modal
  const availableCustomersForDeposit = allCustomers.filter(c => {
      const isWon = c.status === CustomerStatus.WON;
      const isNotFinished = c.deal_status !== 'completed' && c.deal_status !== 'refunded';
      const hasPermission = (isAdmin || isMod) ? true : c.creator_id === userProfile?.id;
      return isWon && isNotFinished && hasPermission;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BadgeDollarSign className="text-green-600"/> Quỹ & Thu Chi</h1>
          
          <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto items-center">
              {/* Month/Year Filter */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar size={16} className="text-gray-500" />
                  <select 
                    value={filterMode} 
                    onChange={(e) => setFilterMode(e.target.value as any)}
                    className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer border-r border-gray-200 pr-2 mr-2"
                  >
                      <option value="creation">Theo ngày tạo</option>
                      <option value="deal">Theo ngày chốt</option>
                  </select>
                  <span className="text-gray-500 text-sm">Tháng</span>
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="text-sm font-bold text-primary-700 bg-transparent outline-none cursor-pointer"
                  >
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{m}</option>
                      ))}
                  </select>
                  <span className="text-gray-500 text-sm">/</span>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="text-sm font-bold text-primary-700 bg-transparent outline-none cursor-pointer"
                  >
                      <option value={2024}>2024</option>
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                  </select>
              </div>

              <div className="flex gap-2">
                  <div className="relative">
                      <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)} className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm font-bold shadow-sm cursor-pointer h-full">
                          <option value="all">Tất cả nguồn</option><option value="mkt">Nguồn MKT Group</option><option value="other">Nguồn Khác</option>
                      </select>
                      <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {(isAdmin || isMod) && <button onClick={() => { setNewQrUrl(qrCodeUrl); setShowConfigModal(true); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors whitespace-nowrap">Cấu hình QR</button>}
              </div>
          </div>
      </div>

      {/* TOP CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pie Chart: Fund Balance */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
              <h3 className="font-bold text-gray-700 mb-4">Tổng quan Quỹ hiện tại</h3>
              <div className="w-full h-40">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={pieData1} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                              <Cell fill="#10b981" />
                              <Cell fill="#ef4444" />
                          </Pie>
                          <ReTooltip formatter={(val: number) => formatCurrency(val) + ' VNĐ'} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="text-center mt-2"><p className="text-sm text-gray-500">Quỹ tồn đọng</p><p className="text-2xl font-bold text-green-600">{formatCurrency(fundRemaining)} VNĐ</p></div>
              {isAdmin && (<button onClick={() => setShowAdjustmentModal(true)} className="mt-4 text-xs font-bold text-gray-500 flex items-center gap-1 hover:text-gray-800"><Settings2 size={12}/> Điều chỉnh</button>)}
          </div>

          {/* New Chart: Expected vs Received */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-bold text-gray-700 mb-4">Tiến độ Thu tiền (T{selectedMonth}/{selectedYear})</h3>
              <div className="flex-1 w-full h-40">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={collectionData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" hide />
                          <ReTooltip cursor={{fill: 'transparent'}} formatter={(val: number) => formatCurrency(val) + ' VNĐ'} />
                          <Legend verticalAlign="top" height={36}/>
                          <Bar dataKey="Dự kiến" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={20} />
                          <Bar dataKey="Đã thu" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
                  <span>Dự kiến: <b className="text-purple-600">{formatCurrency(totalExpectedRevenue)}</b></span>
                  <span>Đã thu: <b className="text-green-600">{formatCurrency(totalDeposited)}</b></span>
              </div>
          </div>

          {/* Net Revenue Text */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-4">
              <h3 className="font-bold text-gray-700">Hiệu quả Kinh doanh (Net)</h3>
              <div className="text-center w-full"><p className="text-gray-500 font-bold uppercase text-xs">Tổng Thu (Nộp + Doanh thu)</p><p className="text-2xl font-bold text-blue-600">+{formatCurrency(totalIn)}</p></div>
              <div className="w-full h-px bg-gray-100"></div>
              <div className="text-center w-full"><p className="text-gray-500 font-bold uppercase text-xs">Tổng Chi (Chỉ tính Chi phí)</p><p className="text-2xl font-bold text-red-600">-{formatCurrency(totalExpensesOnly)}</p></div>
              <div className="w-full h-px bg-gray-100"></div>
              <div className="text-center bg-blue-50 w-full py-2 rounded-xl border border-blue-100"><p className="text-blue-800 font-bold uppercase text-xs">Doanh thu Thực tế (Net)</p><p className="text-xl font-bold text-blue-900">{formatCurrency(netRevenueDisplay)}</p></div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center"><h3 className="font-bold text-red-800 flex items-center gap-2"><ArrowUpRight/> Lịch sử Ứng / Chi</h3></div>
              <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">
                  {expenses.map(t => (
                      <div key={t.id} className="p-3 border border-gray-100 rounded-xl hover:shadow-sm transition-all">
                          <div className="flex justify-between items-start">
                              <div>
                                  <p className="font-bold text-gray-900">{t.reason}</p>
                                  <p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString()}</p>
                                  {t.customer_name && <p className="text-xs text-blue-600 mt-1">Khách: {t.customer_name}</p>}
                              </div>
                              <span className="font-bold text-red-600">-{formatCurrency(t.amount)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status === 'approved' ? 'bg-green-100 text-green-700' : t.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span>
                              {t.status === 'pending' && (isAdmin || isMod) && (
                                  <div className="flex gap-2"><button onClick={() => handleApprove(t.id, true)} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16}/></button><button onClick={() => handleApprove(t.id, false)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16}/></button></div>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center">
                  <h3 className="font-bold text-green-800 flex items-center gap-2"><ArrowDownLeft/> Hoạt động Nộp tiền</h3>
                  <button onClick={() => setShowDepositModal(true)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg shadow hover:bg-green-700 flex items-center gap-1"><QrCode size={14}/> Nộp quỹ</button>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">
                  {/* Dealer Debts First */}
                  {dealerDebts.map(t => (
                      <div key={t.id} className="p-3 border border-orange-200 bg-orange-50 rounded-xl flex justify-between items-center">
                          <div>
                              <p className="font-bold text-orange-900">{t.reason}</p>
                              <p className="text-xs text-orange-700">Dự kiến chi: {t.target_date ? new Date(t.target_date).toLocaleDateString('vi-VN') : 'N/A'}</p>
                          </div>
                          <span className="font-bold text-orange-700">{formatCurrency(t.amount)}</span>
                      </div>
                  ))}
                  
                  {deposits.map(t => (
                      <div key={t.id} className="p-3 border border-gray-100 rounded-xl transition-all hover:shadow-sm">
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-gray-900">{t.reason}</p>
                                  <p className="text-xs text-gray-500">{t.user_name} • {new Date(t.created_at).toLocaleDateString()}</p>
                                  {t.customer_name && <p className="text-xs text-green-600 mt-1">Khách: {t.customer_name}</p>}
                              </div>
                              <span className={`font-bold ${t.type === 'adjustment' && t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status === 'approved' ? 'bg-green-100 text-green-700' : t.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span>
                              {t.status === 'pending' && (isAdmin || isMod) && (
                                  <div className="flex gap-2"><button onClick={() => handleApprove(t.id, true)} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckCircle2 size={16}/></button><button onClick={() => handleApprove(t.id, false)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16}/></button></div>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Nộp quỹ / Doanh thu</h3><button onClick={() => setShowDepositModal(false)}><X size={24} className="text-gray-400"/></button></div>
                  
                  {qrCodeUrl && (
                      <div className="flex flex-col items-center mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 object-contain mb-2 mix-blend-multiply" />
                          <p className="text-xs text-gray-500 text-center">Quét mã để chuyển khoản, sau đó nhập thông tin bên dưới.</p>
                      </div>
                  )}

                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Chọn Khách hàng (Đã chốt)</label>
                          <select className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900" value={depositForm.customerId} onChange={e => setDepositForm({...depositForm, customerId: e.target.value})}>
                              <option value="">-- Chọn khách hàng --</option>
                              {availableCustomersForDeposit.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
                          </select>
                          {availableCustomersForDeposit.length === 0 && <p className="text-xs text-red-500 mt-1">Không có khách hàng khả dụng (Phải là khách WON và chưa hoàn thành/trả cọc)</p>}
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền</label>
                          <input type="text" className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900 font-bold" value={depositForm.amount} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setDepositForm({...depositForm, amount: v ? Number(v).toLocaleString('vi-VN') : ''}); }} />
                      </div>
                      <div><label className="block text-sm font-bold text-gray-700 mb-1">Nội dung</label><input type="text" className="w-full border border-gray-300 p-2 rounded-xl outline-none bg-white text-gray-900" value={depositForm.reason} onChange={e => setDepositForm({...depositForm, reason: e.target.value})} /></div>
                      <button onClick={handleSubmitDeposit} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700">Xác nhận đã nộp</button>
                  </div>
              </div>
          </div>
      )}

      {/* ADJUSTMENT MODAL (ADMIN ONLY) */}
      {showAdjustmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Điều chỉnh Quỹ (Admin)</h3><button onClick={() => setShowAdjustmentModal(false)}><X size={24} className="text-gray-400"/></button></div>
                  <div className="space-y-4">
                      <div><label className="text-sm font-bold text-gray-600">Số tiền (+/-)</label><input type="text" value={adjustmentForm.amount} onChange={e => setAdjustmentForm({...adjustmentForm, amount: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900 font-bold" placeholder="-500000 hoặc 1000000" /></div>
                      <div><label className="text-sm font-bold text-gray-600">Lý do</label><input type="text" value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg outline-none bg-white text-gray-900" /></div>
                      <button onClick={handleSubmitAdjustment} className="w-full py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900">Xác nhận điều chỉnh</button>
                  </div>
              </div>
          </div>
      )}

      {/* QR CONFIG MODAL */}
      {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Cấu hình QR Code</h3>
                  <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-1">Link ảnh QR</label>
                      <input type="text" placeholder="Dán link ảnh QR Code..." className="w-full border p-2 rounded-xl text-gray-900 outline-none focus:border-primary-500" value={newQrUrl} onChange={e => setNewQrUrl(e.target.value)} />
                  </div>
                  {newQrUrl && (
                      <div className="mb-4 p-2 bg-gray-50 border rounded-xl flex justify-center">
                          <img src={newQrUrl} alt="Preview" className="h-32 object-contain" />
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
      )}
    </div>
  );
};

export default Finance;

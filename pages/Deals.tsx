
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Customer, CustomerStatus, DealStatus, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  Search, 
  FileCheck2, 
  Loader2, 
  ShieldCheck, 
  Ban, 
  X, 
  User, 
  MapPin, 
  CarFront,
  Filter
} from 'lucide-react';

const Deals: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'processing' | 'completed' | 'refunded'>('processing');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter State
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mkt' | 'other'>('all');
  
  // Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<{id: string, type: 'completed' | 'refunded'} | null>(null);

  useEffect(() => {
    fetchWonCustomers();
  }, [userProfile]);

  const fetchWonCustomers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('customers')
        .select('*')
        .eq('status', CustomerStatus.WON)
        .order('created_at', { ascending: false });

      if (!isAdmin && !isMod && userProfile?.id) {
        query = query.eq('creator_id', userProfile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCustomers(data as Customer[]);
    } catch (err) {
      console.warn("Error fetching won customers:", err);
    } finally {
      setLoading(false);
    }
  };

  const executeApprove = async () => {
      if (!confirmAction) return;
      const { id, type } = confirmAction;
      const newStatus = type;
      
      try {
          const { error } = await supabase.from('customers').update({ deal_status: newStatus }).eq('id', id);
          if (error) throw error;
          setConfirmAction(null);
          fetchWonCustomers(); // Refresh
      } catch (err: any) {
          const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          alert("Lỗi duyệt: " + errorMessage);
      }
  };

  const filteredCustomers = customers.filter(c => {
      const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);
      const ds = c.deal_status || 'processing'; 

      // Source Filter
      let matchesSource = true;
      if (sourceFilter === 'mkt') matchesSource = c.source === 'MKT Group';
      if (sourceFilter === 'other') matchesSource = c.source !== 'MKT Group';

      if (activeTab === 'processing') {
          return matchesSearch && matchesSource && (ds === 'processing' || ds === 'completed_pending' || ds === 'refund_pending');
      } else if (activeTab === 'completed') {
          return matchesSearch && matchesSource && ds === 'completed';
      } else {
          return matchesSearch && matchesSource && ds === 'refunded';
      }
  });

  const getStatusBadge = (status?: string) => {
      switch(status) {
          case 'completed_pending': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">Chờ duyệt Hoàn thành</span>;
          case 'refund_pending': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-bold border border-red-200">Chờ duyệt Trả cọc</span>;
          case 'completed': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-bold border border-green-200">Đã hoàn thành</span>;
          case 'refunded': return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-xs font-bold border border-gray-200">Đã trả cọc</span>;
          default: return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md text-xs font-bold border border-yellow-200">Đang xử lý</span>;
      }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải danh sách...</div>;

  return (
    <div className="space-y-6 pb-20 relative">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileCheck2 className="text-green-600" />
                Quản lý Đơn hàng
            </h1>
            
            {/* Source Filter */}
            <div className="relative">
                <select 
                    value={sourceFilter} 
                    onChange={(e) => setSourceFilter(e.target.value as any)}
                    className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm font-bold shadow-sm cursor-pointer"
                >
                    <option value="all">Tất cả nguồn</option>
                    <option value="mkt">Nguồn MKT Group</option>
                    <option value="other">Nguồn Khác</option>
                </select>
                <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
        </div>

        {/* Search */}
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Tìm kiếm khách đã chốt..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
                />
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
            <button
                onClick={() => setActiveTab('processing')}
                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'processing' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <Clock size={16} /> Đang xử lý
            </button>
            <button
                onClick={() => setActiveTab('completed')}
                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'completed' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <CheckCircle2 size={16} /> Đã hoàn thành
            </button>
            <button
                onClick={() => setActiveTab('refunded')}
                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'refunded' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <RotateCcw size={16} /> Trả cọc
            </button>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
                    Chưa có đơn hàng nào.
                </div>
            ) : (
                filteredCustomers.map(c => (
                    <div 
                        key={c.id} 
                        className={`bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md transition-all relative cursor-pointer
                            ${c.deal_status?.includes('pending') ? 'border-blue-200 ring-2 ring-blue-100' : 'border-gray-100'}
                        `}
                        onClick={() => navigate(`/customers/${c.id}`)}
                    >
                        {/* Approval Actions for Admin/Mod */}
                        {(isAdmin || isMod) && (c.deal_status === 'completed_pending' || c.deal_status === 'refund_pending') && (
                            <div className="absolute top-4 right-4 flex gap-1 z-20">
                                {c.deal_status === 'completed_pending' && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setConfirmAction({id: c.id, type: 'completed'}); }}
                                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md tooltip transition-transform active:scale-95"
                                        title="Duyệt hoàn thành"
                                    >
                                        <ShieldCheck size={16} />
                                    </button>
                                )}
                                {c.deal_status === 'refund_pending' && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setConfirmAction({id: c.id, type: 'refunded'}); }}
                                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md tooltip transition-transform active:scale-95"
                                        title="Duyệt trả cọc"
                                    >
                                        <Ban size={16} />
                                    </button>
                                )}
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                                    {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 group-hover:text-primary-600">{c.name}</h3>
                                    <p className="text-xs text-gray-500">{c.phone}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-700 mb-3">
                                <div className="flex items-center gap-2">
                                    <CarFront size={14} className="text-gray-400" />
                                    <span className="font-bold">{c.interest?.toUpperCase() || 'CHƯA RÕ'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">Doanh thu:</span>
                                    <span className="font-bold text-green-600">
                                        {c.deal_details?.revenue ? c.deal_details.revenue.toLocaleString('vi-VN') : 0} VNĐ
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">Nguồn:</span>
                                    <span className="font-bold text-gray-700">{c.source || 'N/A'}</span>
                                </div>
                                {(isAdmin || isMod) && c.sales_rep && (
                                    <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-50">
                                        <User size={12} className="text-blue-500" />
                                        <span className="text-xs text-blue-600 font-bold">{c.sales_rep}</span>
                                    </div>
                                )}
                                <div className="mt-2">
                                    {getStatusBadge(c.deal_status)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Modal Approval */}
        {confirmAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck className="text-green-600" /> Xác nhận duyệt
                        </h3>
                        <button onClick={() => setConfirmAction(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>
                    <p className="text-gray-600 text-sm">
                        Bạn có chắc chắn muốn duyệt yêu cầu <strong className="text-gray-900">{confirmAction.type === 'completed' ? 'Hoàn thành' : 'Trả cọc'}</strong> này không?
                    </p>
                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                        <button 
                            onClick={executeApprove}
                            className={`flex-1 py-2 font-bold rounded-xl text-white shadow-lg ${confirmAction.type === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            Duyệt
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Deals;


import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Distributor, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, Save, X, MapPin, Building2, Loader2, Copy, Terminal, Database, AlertCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DistributorList: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Security check: Only Admin
    if (userProfile && userProfile.role !== UserRole.ADMIN) {
        navigate('/');
        return;
    }
    fetchDistributors();
  }, [userProfile]);

  const fetchDistributors = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDistributors(data as Distributor[]);
    } catch (err: any) {
      console.error("Error fetching distributors:", err);
      // Robust Error Detection
      const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      
      // Check for 'relation does not exist' (42P01) OR 'Could not find the table' (PGRST205)
      if (
          msg.includes('relation "public.distributors" does not exist') || 
          err.code === '42P01' || 
          err.code === 'PGRST205'
      ) {
          setErrorMsg("TABLE_MISSING");
      } else {
          setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (dist?: Distributor) => {
      if (dist) {
          setFormData({ id: dist.id, name: dist.name, address: dist.address || '' });
      } else {
          setFormData({ id: '', name: '', address: '' });
      }
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
          if (formData.id) {
              // Update
              const { error } = await supabase
                .from('distributors')
                .update({ name: formData.name, address: formData.address })
                .eq('id', formData.id);
              if (error) throw error;
          } else {
              // Create
              const { error } = await supabase
                .from('distributors')
                .insert([{ name: formData.name, address: formData.address }]);
              if (error) throw error;
          }
          
          setIsModalOpen(false);
          fetchDistributors();
      } catch (err: any) {
          const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          alert("Lỗi lưu dữ liệu: " + msg);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Bạn có chắc chắn muốn xóa đại lý này không?")) return;
      try {
          const { error } = await supabase.from('distributors').delete().eq('id', id);
          if (error) throw error;
          fetchDistributors();
      } catch (err: any) {
          const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          alert("Lỗi xóa: " + msg);
      }
  };

  const setupSQL = `-- 1. Tạo bảng Distributors
create table if not exists public.distributors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  created_at timestamptz default now()
);

-- 2. Cấp quyền
alter table public.distributors enable row level security;
grant all on table public.distributors to authenticated;
grant all on table public.distributors to service_role;

-- 3. Chính sách: Ai cũng xem được
create policy "Enable read access for all authenticated users" on public.distributors for select to authenticated using (true);

-- 4. Chính sách: Chỉ Admin được sửa/xóa
create policy "Enable write access for admins only" on public.distributors for all to authenticated using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

NOTIFY pgrst, 'reload schema';
`;

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải danh sách...</div>;

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Settings className="text-primary-600"/> Cấu hình Hệ thống</h1>
            <p className="text-gray-500">Quản lý Đại lý phân phối và các cài đặt khác.</p>
        </div>
        <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
        >
            <Plus size={18} />
            Thêm đại lý
        </button>
      </div>

      {errorMsg === "TABLE_MISSING" ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
             <div className="flex items-center gap-3 mb-4">
                <Database className="text-red-600" />
                <h3 className="font-bold text-red-900 text-lg">Chưa khởi tạo Database</h3>
             </div>
             <p className="text-gray-700 mb-4">
                Bảng <code>distributors</code> chưa tồn tại trong Supabase. Vui lòng chạy đoạn SQL sau trong SQL Editor để khởi tạo:
             </p>
             <div className="relative bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 overflow-x-auto border border-gray-700 shadow-inner">
                <pre>{setupSQL}</pre>
                <button 
                onClick={() => { navigator.clipboard.writeText(setupSQL); alert("Đã sao chép SQL!"); }}
                className="absolute top-3 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                    <Copy size={12} /> Sao chép
                </button>
             </div>
             <div className="mt-4 flex gap-2">
                 <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50">
                    <Terminal size={16} /> Mở Supabase SQL Editor
                 </a>
                 <button onClick={fetchDistributors} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">
                    Đã chạy xong, tải lại trang
                 </button>
             </div>
          </div>
      ) : errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm flex items-center gap-3 text-red-700">
              <AlertCircle size={24} />
              <div>
                  <h3 className="font-bold">Đã xảy ra lỗi khi tải dữ liệu</h3>
                  <p className="text-sm">{errorMsg}</p>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {distributors.length === 0 && !errorMsg ? (
              <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 border-dashed">
                  Chưa có đại lý nào.
              </div>
          ) : (
              distributors.map(dist => (
                  <div key={dist.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                  <Building2 size={20} />
                              </div>
                              <div>
                                  <h3 className="font-bold text-gray-900">{dist.name}</h3>
                                  {dist.address && (
                                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                          <MapPin size={12} /> {dist.address}
                                      </div>
                                  )}
                              </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(dist)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                  <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(dist.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      </div>
                  </div>
              ))
          )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{formData.id ? 'Cập nhật đại lý' : 'Thêm đại lý mới'}</h3>
                  <button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Tên Đại lý <span className="text-red-500">*</span></label>
                      <input 
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:border-primary-500 outline-none"
                        placeholder="VD: VinFast Thảo Điền"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Địa chỉ</label>
                      <input 
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:border-primary-500 outline-none"
                        placeholder="VD: 159 Xa Lộ Hà Nội..."
                      />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-bold bg-gray-100 hover:bg-gray-200 rounded-xl">Hủy</button>
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 flex items-center gap-2"
                      >
                          {isSubmitting && <Loader2 className="animate-spin" size={16} />} Lưu
                      </button>
                  </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default DistributorList;


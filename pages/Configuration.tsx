
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Distributor, CarModel, UserRole, DemoCar, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, X, MapPin, Building2, Loader2, Copy, Terminal, Database, AlertCircle, Car, Settings, CheckCircle2, AlertTriangle, Key, Filter, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Configuration: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'distributors' | 'cars' | 'demo_cars'>('distributors');
  
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [demoCars, setDemoCars] = useState<DemoCar[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [allManagers, setAllManagers] = useState<{id: string, name: string}[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Admin Filter State
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', address: '', price: '', owner_id: '' }); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (!isAdmin && !isMod) {
        navigate('/');
        return;
    }
    fetchManagers();
  }, [isAdmin, isMod]);

  useEffect(() => {
    if (userProfile) {
        fetchData();
        fetchProfiles();
    }
  }, [userProfile, activeTab, selectedTeam]);

  useEffect(() => {
      if (toast) {
          const t = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(t);
      }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error') => setToast({msg, type});

  const fetchManagers = async () => {
      if (isAdmin) {
          const { data } = await supabase.from('profiles').select('*');
          if (data) {
              const profiles = data as UserProfile[];
              const mgrIds = Array.from(new Set(profiles.filter(p => p.manager_id).map(p => p.manager_id)));
              const list = mgrIds.map(id => {
                  const m = profiles.find(p => p.id === id);
                  return { id: id as string, name: m?.full_name || 'Unknown' };
              }).filter(m => m.name !== 'Unknown');
              setAllManagers(list);
          }
      }
  };

  const fetchProfiles = async () => {
      try {
          const { data } = await supabase.from('profiles').select('id, full_name, role').eq('status', 'active');
          if (data) setProfiles(data as UserProfile[]);
      } catch (e) { console.error(e); }
  };

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
        // Build Isolation Logic
        const getQuery = (table: string) => {
            let query = supabase.from(table).select('*').order('created_at', { ascending: false });
            if (isAdmin) {
                if (selectedTeam !== 'all') {
                    query = query.eq('manager_id', selectedTeam);
                }
            } else if (isMod && userProfile) {
                query = query.eq('manager_id', userProfile.id);
            }
            return query;
        };

        if (activeTab === 'distributors') {
            const { data, error } = await getQuery('distributors');
            if (error) throw error;
            setDistributors(data as Distributor[]);
        } else if (activeTab === 'cars') {
            const { data, error } = await getQuery('car_models');
            if (error) throw error;
            setCarModels(data as CarModel[]);
        } else if (activeTab === 'demo_cars') {
            const { data, error } = await getQuery('demo_cars');
            if (error) throw error;
            setDemoCars(data as DemoCar[]);
        }
    } catch (err: any) {
        console.error("Error fetching data:", err);
        const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        
        if (msg.includes('relation') || err.code === '42P01' || err.code === '42501') {
            setErrorMsg("DB_ERROR");
        } else {
            setErrorMsg(msg);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleOpenModal = (item?: any) => {
      if (item) {
          setFormData({ 
              id: item.id, 
              name: item.name, 
              address: item.address || '', 
              price: item.price ? item.price.toString() : '', 
              owner_id: item.owner_id || '' 
          });
      } else {
          setFormData({ id: '', name: '', address: '', price: '', owner_id: '' });
      }
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
          let table = 'distributors';
          const payload: any = { name: formData.name };

          // Team Isolation Logic for Insert
          if (isAdmin) {
              // Only assign manager_id if a specific team is selected.
              // If 'all', it's a global asset (manager_id = null)
              payload.manager_id = selectedTeam !== 'all' ? selectedTeam : null;
          } else if (isMod && userProfile) {
              payload.manager_id = userProfile.id;
          }

          if (activeTab === 'distributors') {
              payload.address = formData.address;
          } else if (activeTab === 'cars') {
              table = 'car_models';
          } else if (activeTab === 'demo_cars') {
              table = 'demo_cars';
              payload.price = Number(formData.price.replace(/\D/g, ''));
              payload.owner_id = formData.owner_id;
              if (!payload.owner_id) throw new Error("Vui lòng chọn chủ xe (TVBH).");
          }

          if (formData.id) {
              // Update
              const { error } = await supabase.from(table).update(payload).eq('id', formData.id);
              if (error) throw error;
          } else {
              // Create
              const { error } = await supabase.from(table).insert([payload]);
              if (error) throw error;
          }
          
          setIsModalOpen(false);
          fetchData();
          showToast("Đã lưu thành công!", 'success');
      } catch (err: any) {
          const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          showToast("Lỗi lưu dữ liệu: " + msg, 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDeleteClick = (item: any) => {
      setDeleteTarget({ id: item.id, name: item.name });
  };

  const confirmDelete = async () => {
      if (!deleteTarget) return;
      try {
          let table = 'distributors';
          if (activeTab === 'cars') table = 'car_models';
          if (activeTab === 'demo_cars') table = 'demo_cars';

          const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
          if (error) throw error;
          fetchData();
          showToast("Đã xóa thành công!", 'success');
      } catch (err: any) {
          const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          showToast("Lỗi xóa: " + msg, 'error');
          setErrorMsg("DB_ERROR");
      } finally {
          setDeleteTarget(null);
      }
  };

  const setupSQL = `-- Chạy mã này trong Supabase SQL Editor để KHỞI TẠO CÁC BẢNG CẤU HÌNH và PHÂN QUYỀN:

-- 1. Tạo bảng (Create Tables if not exist)
create table if not exists public.distributors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  manager_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.car_models (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  manager_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.demo_cars (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  price numeric default 0,
  owner_id uuid references public.profiles(id),
  manager_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.proposals (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('demo_car', 'salary_advance')),
  user_id uuid references public.profiles(id),
  data jsonb,
  amount numeric default 0,
  reason text,
  status text default 'pending',
  approved_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 2. Thêm cột manager_id nếu bảng đã tồn tại nhưng thiếu cột (Idempotent)
do $$ 
begin
  alter table public.distributors add column if not exists manager_id uuid references public.profiles(id);
  alter table public.car_models add column if not exists manager_id uuid references public.profiles(id);
  alter table public.demo_cars add column if not exists manager_id uuid references public.profiles(id);
exception
  when others then null;
end $$;

-- 3. Bật RLS (Row Level Security)
alter table public.distributors enable row level security;
alter table public.car_models enable row level security;
alter table public.demo_cars enable row level security;
alter table public.proposals enable row level security;

-- 4. Xóa Policies cũ (để tránh lỗi trùng tên khi chạy lại)
drop policy if exists "Read Team" on public.distributors;
drop policy if exists "Mod/Admin Write" on public.distributors;
drop policy if exists "Read Team" on public.car_models;
drop policy if exists "Mod/Admin Write" on public.car_models;
drop policy if exists "Read Team" on public.demo_cars;
drop policy if exists "Mod/Admin Write" on public.demo_cars;
drop policy if exists "Read Proposals" on public.proposals;
drop policy if exists "Insert Proposals" on public.proposals;
drop policy if exists "Update Proposals" on public.proposals;

-- 5. Tạo Policies mới (Phân quyền Team)

-- Distributors
create policy "Read Team" on public.distributors for select using (
  (manager_id is null) or 
  (manager_id = auth.uid()) or
  (exists (select 1 from profiles where id = auth.uid() and role = 'admin')) or
  (exists (select 1 from profiles where id = auth.uid() and manager_id = distributors.manager_id))
);
create policy "Mod/Admin Write" on public.distributors for all using (
  (exists (select 1 from profiles where id = auth.uid() and role = 'admin')) or
  (auth.uid() = manager_id)
);

-- Car Models
create policy "Read Team" on public.car_models for select using (
  (manager_id is null) or 
  (manager_id = auth.uid()) or
  (exists (select 1 from profiles where id = auth.uid() and role = 'admin')) or
  (exists (select 1 from profiles where id = auth.uid() and manager_id = car_models.manager_id))
);
create policy "Mod/Admin Write" on public.car_models for all using (
  (exists (select 1 from profiles where id = auth.uid() and role = 'admin')) or
  (auth.uid() = manager_id)
);

-- Demo Cars
create policy "Read Team" on public.demo_cars for select using (
  (manager_id is null) or 
  (manager_id = auth.uid()) or
  (exists (select 1 from profiles where id = auth.uid() and role = 'admin')) or
  (exists (select 1 from profiles where id = auth.uid() and manager_id = demo_cars.manager_id))
);
create policy "Mod/Admin Write" on public.demo_cars for all using (
  (exists (select 1 from profiles where id = auth.uid() and role = 'admin')) or
  (auth.uid() = manager_id)
);

-- Proposals
create policy "Read Proposals" on public.proposals for select using (
  auth.uid() = user_id or 
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'mod'))
);
create policy "Insert Proposals" on public.proposals for insert with check (auth.uid() = user_id);
create policy "Update Proposals" on public.proposals for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'mod'))
);
`;

  return (
    <div className="space-y-6 relative">
       {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="font-bold text-sm">{toast.msg}</span>
          </div>
       )}

       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Settings className="text-primary-600"/> Cấu hình Hệ thống (Team)</h1>
            <p className="text-gray-500">Quản lý các danh mục riêng cho từng nhóm.</p>
        </div>
        {isAdmin && (
            <div className="relative">
                <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm font-bold shadow-sm cursor-pointer hover:bg-gray-50">
                    <option value="all">Toàn bộ hệ thống</option>
                    {allManagers.map(mgr => (<option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
        )}
      </div>

      <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('distributors')}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'distributors' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Building2 size={18}/> Đại lý phân phối
          </button>
          <button 
            onClick={() => setActiveTab('cars')}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'cars' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Car size={18}/> Dòng xe quan tâm
          </button>
          <button 
            onClick={() => setActiveTab('demo_cars')}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'demo_cars' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Key size={18}/> Xe Demo (Cho thuê)
          </button>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end">
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
        >
            <Plus size={18} />
            Thêm mới
        </button>
      </div>

      {errorMsg === "DB_ERROR" ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
             <div className="flex items-center gap-3 mb-4">
                <Database className="text-red-600" />
                <h3 className="font-bold text-red-900 text-lg">Lỗi Quyền hoặc Cấu trúc Bảng</h3>
             </div>
             <p className="text-gray-700 mb-4">
                Hệ thống phát hiện bảng dữ liệu (như Demo Cars) chưa được tạo. Vui lòng chạy đoạn mã sau trong Supabase SQL Editor:
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
                 <button onClick={fetchData} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">
                    Đã chạy xong, tải lại
                 </button>
             </div>
          </div>
      ) : loading ? (
          <div className="p-12 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2"/> Đang tải dữ liệu...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTab === 'distributors' && distributors.map(dist => (
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
                              <button onClick={() => handleDeleteClick(dist)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      </div>
                  </div>
              ))}

              {activeTab === 'cars' && carModels.map(car => (
                  <div key={car.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                                  <Car size={20} />
                              </div>
                              <h3 className="font-bold text-gray-900">{car.name}</h3>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(car)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                  <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDeleteClick(car)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      </div>
                  </div>
              ))}

              {activeTab === 'demo_cars' && demoCars.map(car => {
                  const owner = profiles.find(p => p.id === car.owner_id);
                  return (
                      <div key={car.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                          <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                      <Key size={24} />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-gray-900">{car.name}</h3>
                                      <p className="text-sm text-green-600 font-bold">{car.price?.toLocaleString('vi-VN')} VNĐ / lượt</p>
                                      <p className="text-xs text-gray-500 mt-1">Chủ xe: {owner?.full_name || '---'}</p>
                                  </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleOpenModal(car)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                      <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteClick(car)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{formData.id ? 'Cập nhật' : 'Thêm mới'}</h3>
                  <button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Tên <span className="text-red-500">*</span></label>
                      <input 
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:border-primary-500 outline-none"
                        placeholder="VD: VinFast Thảo Điền / VF 3"
                      />
                  </div>
                  {activeTab === 'distributors' && (
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Địa chỉ</label>
                          <input 
                            value={formData.address}
                            onChange={e => setFormData({...formData, address: e.target.value})}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:border-primary-500 outline-none"
                            placeholder="VD: 159 Xa Lộ Hà Nội..."
                          />
                      </div>
                  )}
                  {activeTab === 'demo_cars' && (
                      <>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Giá mượn xe (VNĐ) <span className="text-red-500">*</span></label>
                              <input 
                                required
                                type="text"
                                value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''}
                                onChange={e => setFormData({...formData, price: e.target.value.replace(/\D/g, '')})}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:border-primary-500 outline-none font-bold"
                                placeholder="500.000"
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Chủ xe (TVBH nhận tiền) <span className="text-red-500">*</span></label>
                              <select 
                                required 
                                value={formData.owner_id} 
                                onChange={e => setFormData({...formData, owner_id: e.target.value})}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:border-primary-500 outline-none"
                              >
                                  <option value="">-- Chọn chủ xe --</option>
                                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                              </select>
                          </div>
                      </>
                  )}
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

      {/* Delete Confirm Modal */}
      {deleteTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><Trash2 size={24} /></div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa?</h3>
                      <p className="text-gray-500 text-sm mb-6">Bạn có chắc chắn muốn xóa "<strong>{deleteTarget.name}</strong>"? Hành động này không thể hoàn tác.</p>
                      <div className="flex gap-3 w-full">
                          <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                          <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors">Xóa ngay</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Configuration;

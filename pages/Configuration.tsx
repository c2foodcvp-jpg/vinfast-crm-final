
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Distributor, CarModel, UserRole, DemoCar, UserProfile, CarVersion, QuoteConfig, BankConfig, QuoteConfigOption, BankPackage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, X, MapPin, Building2, Loader2, Copy, Terminal, Database, AlertCircle, Car, Settings, CheckCircle2, AlertTriangle, Key, Filter, ChevronDown, List, Percent, Landmark, Wallet, Layers, GripVertical, Gift, Crown, Coins, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Configuration: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  // Enhanced tabs
  const [activeTab, setActiveTab] = useState<'distributors' | 'cars' | 'versions' | 'promos' | 'fees' | 'banks' | 'demo_cars' | 'gifts' | 'membership' | 'warranties'>('distributors');
  
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [carVersions, setCarVersions] = useState<CarVersion[]>([]);
  const [quoteConfigs, setQuoteConfigs] = useState<QuoteConfig[]>([]); // Promos, Fees, Gifts, Membership, Warranty
  const [banks, setBanks] = useState<BankConfig[]>([]);
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
  const [formData, setFormData] = useState<any>({}); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Options State for Fees/VinPoint
  const [isMultiOption, setIsMultiOption] = useState(false);
  const [feeOptions, setFeeOptions] = useState<QuoteConfigOption[]>([]);
  
  // VinPoint State
  const [isVinPoint, setIsVinPoint] = useState(false);
  const [vinPointMap, setVinPointMap] = useState<Record<string, number>>({});

  // Bank Packages State
  const [bankPackages, setBankPackages] = useState<BankPackage[]>([]);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string, table: string} | null>(null);

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
            // Some tables might not have manager_id, but the RLS policies in SQL handle permission.
            // For tables with manager_id:
            if (['distributors', 'car_models', 'car_versions', 'demo_cars', 'quote_configs', 'banks'].includes(table)) {
                if (isAdmin) {
                    if (selectedTeam !== 'all') {
                        query = query.eq('manager_id', selectedTeam);
                    }
                } else if (isMod && userProfile) {
                    query = query.eq('manager_id', userProfile.id);
                }
            }
            return query;
        };

        // Always fetch car models for dropdowns in versions/promos
        const { data: cars } = await getQuery('car_models');
        setCarModels(cars as CarModel[] || []);
        
        // Also fetch versions for promo config
        const { data: versions } = await getQuery('car_versions');
        setCarVersions(versions as CarVersion[] || []);

        if (activeTab === 'distributors') {
            const { data, error } = await getQuery('distributors');
            if (error) throw error;
            setDistributors(data as Distributor[]);
        } else if (activeTab === 'versions') {
            // Already fetched above
        } else if (activeTab === 'promos') {
            const { data, error } = await getQuery('quote_configs').eq('type', 'promotion').order('priority', {ascending: true});
            if (error) throw error;
            setQuoteConfigs(data as QuoteConfig[]);
        } else if (activeTab === 'fees') {
            const { data, error } = await getQuery('quote_configs').eq('type', 'fee').order('priority', {ascending: true});
            if (error) throw error;
            setQuoteConfigs(data as QuoteConfig[]);
        } else if (activeTab === 'gifts') {
            const { data, error } = await getQuery('quote_configs').eq('type', 'gift').order('priority', {ascending: true});
            if (error) throw error;
            setQuoteConfigs(data as QuoteConfig[]);
        } else if (activeTab === 'membership') {
            const { data, error } = await getQuery('quote_configs').eq('type', 'membership').order('priority', {ascending: true});
            if (error) throw error;
            setQuoteConfigs(data as QuoteConfig[]);
        } else if (activeTab === 'warranties') {
            const { data, error } = await getQuery('quote_configs').eq('type', 'warranty').order('created_at', {ascending: false});
            if (error) throw error;
            setQuoteConfigs(data as QuoteConfig[]);
        } else if (activeTab === 'banks') {
            const { data, error } = await getQuery('banks');
            if (error) throw error;
            setBanks(data as BankConfig[]);
        } else if (activeTab === 'demo_cars') {
            const { data, error } = await getQuery('demo_cars');
            if (error) throw error;
            setDemoCars(data as DemoCar[]);
        }
    } catch (err: any) {
        console.error("Error fetching data:", err);
        const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        if (msg.includes('relation') || err.code === '42P01' || err.code === '42501' || msg.includes('column')) {
            setErrorMsg("DB_ERROR");
        } else {
            setErrorMsg(msg);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleOpenModal = (item?: any) => {
      setFormData(item ? { ...item } : {}); 
      
      // Fee Options Logic
      if (activeTab === 'fees') {
          if (item && item.options && item.options.length > 0) {
              setIsMultiOption(true);
              setFeeOptions(item.options);
          } else {
              setIsMultiOption(false);
              setFeeOptions([{ label: 'Mặc định', value: 0 }]);
          }
      }

      // Gifts Logic (VinPoint)
      if (activeTab === 'gifts') {
          if (item && item.options && item.options.length > 0) {
              setIsVinPoint(true);
              // Map back to vinPointMap
              const map: Record<string, number> = {};
              item.options.forEach((opt: QuoteConfigOption) => {
                  if (opt.model_id) map[opt.model_id] = opt.value;
              });
              setVinPointMap(map);
          } else {
              setIsVinPoint(false);
              setVinPointMap({});
          }
      }

      // Bank Packages Logic
      if (activeTab === 'banks') {
          if (item && item.packages && item.packages.length > 0) {
              setBankPackages(item.packages);
          } else if (item && item.interest_rate_1y) {
              // Backward compatibility: Convert single rate to package
              setBankPackages([{ name: 'Gói Tiêu chuẩn', rate: item.interest_rate_1y }]);
          } else {
              setBankPackages([{ name: '', rate: 0 }]);
          }
      }

      setIsModalOpen(true);
  };

  // Fee Option Handlers
  const addOption = () => { setFeeOptions([...feeOptions, { label: '', value: 0 }]); };
  const removeOption = (index: number) => { setFeeOptions(feeOptions.filter((_, i) => i !== index)); };
  const updateOption = (index: number, field: keyof QuoteConfigOption, val: any) => {
      const newOptions = [...feeOptions];
      if (field === 'value') { newOptions[index].value = Number(val.replace(/\D/g, '')); } else { newOptions[index].label = val; }
      setFeeOptions(newOptions);
  };

  // Bank Package Handlers
  const addBankPackage = () => { setBankPackages([...bankPackages, { name: '', rate: 0 }]); };
  const removeBankPackage = (index: number) => { setBankPackages(bankPackages.filter((_, i) => i !== index)); };
  const updateBankPackage = (index: number, field: keyof BankPackage, val: any) => {
      const newPkgs = [...bankPackages];
      if (field === 'rate') { newPkgs[index].rate = Number(val); } else { newPkgs[index].name = val; }
      setBankPackages(newPkgs);
  };

  // Helper for Promo Car Model Multi-Select
  const toggleModelSelection = (modelId: string) => {
      let current = formData.apply_to_model_ids || [];
      if (current.includes(modelId)) {
          current = current.filter((id: string) => id !== modelId);
      } else {
          current = [...current, modelId];
      }
      // Also clear version selection if model selection changes to avoid stale versions
      setFormData({ ...formData, apply_to_model_ids: current, apply_to_version_ids: [] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
          let table = '';
          const payload: any = { ...formData };
          delete payload.id; // Don't update ID
          delete payload.created_at;

          // Set Manager ID based on context
          if (isAdmin) {
              payload.manager_id = selectedTeam !== 'all' ? selectedTeam : null;
          } else if (isMod && userProfile) {
              payload.manager_id = userProfile.id;
          }

          if (activeTab === 'distributors') table = 'distributors';
          else if (activeTab === 'cars') { table = 'car_models'; }
          else if (activeTab === 'versions') { table = 'car_versions'; payload.price = Number(String(payload.price).replace(/\D/g, '')); }
          else if (activeTab === 'promos') { 
              table = 'quote_configs'; 
              payload.type = 'promotion'; 
              payload.value = Number(String(payload.value).replace(/\D/g, '')); 
              // Sanitize arrays
              if (!payload.apply_to_version_ids || payload.apply_to_version_ids.length === 0) payload.apply_to_version_ids = null;
              if (!payload.apply_to_model_ids || payload.apply_to_model_ids.length === 0) payload.apply_to_model_ids = null;
          }
          else if (activeTab === 'fees') { 
              table = 'quote_configs'; 
              payload.type = 'fee'; 
              // If multi-option, use first value as fallback/default
              if (isMultiOption) {
                  const validOpts = feeOptions.filter(o => o.label.trim() !== '');
                  payload.options = validOpts;
                  payload.value = validOpts.length > 0 ? validOpts[0].value : 0;
              } else {
                  payload.value = Number(String(payload.value).replace(/\D/g, '')); 
                  payload.options = null;
              }
          }
          else if (activeTab === 'gifts') {
              table = 'quote_configs';
              payload.type = 'gift';
              if (isVinPoint) {
                  payload.value = 0;
                  payload.value_type = 'fixed';
                  // Map vinPointMap to options array
                  const options = Object.entries(vinPointMap).map(([mId, pts]) => {
                      const mName = carModels.find(m => m.id === mId)?.name || 'Unknown';
                      return { label: mName, value: pts, model_id: mId };
                  });
                  payload.options = options;
              } else {
                  payload.value = Number(String(payload.value).replace(/\D/g, ''));
                  payload.value_type = 'fixed'; 
                  payload.options = null;
              }
          }
          else if (activeTab === 'membership') {
              table = 'quote_configs';
              payload.type = 'membership';
              
              // FIX: Robust Decimal Parsing logic.
              const parseDecimal = (val: any) => {
                  if (!val) return 0;
                  let s = String(val);
                  s = s.replace(/,/g, '.'); // Swap comma to dot
                  // Keep digits and dots only
                  s = s.replace(/[^0-9.]/g, ''); 
                  const num = parseFloat(s);
                  return isNaN(num) ? 0 : num;
              };

              // Use the parser instead of stripping non-digits
              payload.value = parseDecimal(formData.value); 
              payload.gift_ratio = parseDecimal(formData.gift_ratio); 

              payload.value_type = 'percent';
          }
          else if (activeTab === 'warranties') {
              table = 'quote_configs';
              payload.type = 'warranty';
              payload.value = 0; 
              payload.value_type = 'fixed';
              // Sanitize arrays
              if (!payload.apply_to_model_ids || payload.apply_to_model_ids.length === 0) payload.apply_to_model_ids = null;
          }
          else if (activeTab === 'banks') { 
              table = 'banks'; 
              // Save packages
              const validPackages = bankPackages.filter(p => p.name.trim() !== '');
              payload.packages = validPackages;
              // Legacy support: use first package rate as main rate
              payload.interest_rate_1y = validPackages.length > 0 ? validPackages[0].rate : 0;
              payload.max_loan_ratio = Number(payload.max_loan_ratio); 
          }
          else if (activeTab === 'demo_cars') { table = 'demo_cars'; payload.price = Number(String(payload.price).replace(/\D/g, '')); }

          if (formData.id) {
              const { error } = await supabase.from(table).update(payload).eq('id', formData.id);
              if (error) throw error;
          } else {
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

  const handleDeleteClick = (item: any, table: string) => {
      setDeleteTarget({ id: item.id, name: item.name, table });
  };

  const confirmDelete = async () => {
      if (!deleteTarget) return;
      try {
          const { error } = await supabase.from(deleteTarget.table).delete().eq('id', deleteTarget.id);
          if (error) throw error;
          fetchData();
          showToast("Đã xóa thành công!", 'success');
      } catch (err: any) {
          const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          showToast("Lỗi xóa: " + msg, 'error');
      } finally {
          setDeleteTarget(null);
      }
  };

  // Helper to manage multi-select versions
  const toggleVersionSelection = (verId: string) => {
      let current = formData.apply_to_version_ids || [];
      if (current.includes(verId)) {
          current = current.filter((id: string) => id !== verId);
      } else {
          current = [...current, verId];
      }
      setFormData({ ...formData, apply_to_version_ids: current });
  };

  const setupSQL = `-- Chạy mã này trong Supabase SQL Editor:

-- Bổ sung cột cho bảng quote_configs
alter table public.quote_configs drop constraint if exists quote_configs_type_check;
alter table public.quote_configs add constraint quote_configs_type_check check (type in ('promotion', 'fee', 'gift', 'membership', 'warranty'));
alter table public.quote_configs add column if not exists gift_ratio numeric default 0;

alter table public.quote_configs add column if not exists target_type text check (target_type in ('invoice', 'rolling')) default 'invoice';
alter table public.quote_configs add column if not exists apply_to_version_ids text[];
alter table public.quote_configs add column if not exists options jsonb; -- Store options array

-- Bổ sung cột packages cho bảng banks
alter table public.banks add column if not exists packages jsonb;

-- Cập nhật cấu trúc cũ (nếu có)
update public.quote_configs set target_type = 'invoice' where target_type is null;
`;

  return (
    <div className="space-y-6 relative pb-20">
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

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('distributors')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'distributors' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Building2 size={18}/> Đại lý
          </button>
          <button onClick={() => setActiveTab('cars')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'cars' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Car size={18}/> Dòng xe
          </button>
          <button onClick={() => setActiveTab('versions')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'versions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Layers size={18}/> Phiên bản & Giá
          </button>
          <button onClick={() => setActiveTab('promos')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'promos' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Percent size={18}/> Khuyến mãi
          </button>
          <button onClick={() => setActiveTab('gifts')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'gifts' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Gift size={18}/> Quà tặng
          </button>
          <button onClick={() => setActiveTab('membership')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'membership' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Crown size={18}/> Hạng thành viên
          </button>
          <button onClick={() => setActiveTab('warranties')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'warranties' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <ShieldCheck size={18}/> Bảo hành
          </button>
          <button onClick={() => setActiveTab('fees')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'fees' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Wallet size={18}/> Các loại phí
          </button>
          <button onClick={() => setActiveTab('banks')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'banks' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Landmark size={18}/> Ngân hàng
          </button>
          <button onClick={() => setActiveTab('demo_cars')} className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'demo_cars' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Key size={18}/> Xe Demo
          </button>
      </div>

      <div className="flex justify-end">
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700">
            <Plus size={18} /> Thêm mới
        </button>
      </div>

      {errorMsg === "DB_ERROR" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
             <div className="flex items-center gap-3 mb-4"><Database className="text-red-600" /><h3 className="font-bold text-red-900 text-lg">Cấu trúc bảng chưa đồng bộ</h3></div>
             <p className="text-gray-700 mb-4">Hệ thống cần cập nhật database để hỗ trợ các tính năng mới (Quà tặng, Hạng thành viên, v.v). Vui lòng chạy đoạn mã sau trong Supabase SQL Editor:</p>
             <div className="relative bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 overflow-x-auto border border-gray-700 shadow-inner"><pre>{setupSQL}</pre><button onClick={() => { navigator.clipboard.writeText(setupSQL); alert("Đã sao chép SQL!"); }} className="absolute top-3 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"><Copy size={12} /> Sao chép</button></div>
             <div className="mt-4 flex gap-2"><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"><Terminal size={16} /> Mở SQL Editor</a><button onClick={fetchData} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">Tải lại trang</button></div>
          </div>
      )}

      {loading ? (<div className="p-12 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2"/> Đang tải dữ liệu...</div>) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* ... Other tabs renderers (unchanged) ... */}
              {activeTab === 'distributors' && distributors.map(dist => (
                  <div key={dist.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Building2 size={20} /></div>
                              <div><h3 className="font-bold text-gray-900">{dist.name}</h3>{dist.address && (<div className="flex items-center gap-1 text-xs text-gray-500 mt-1"><MapPin size={12} /> {dist.address}</div>)}</div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(dist)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(dist, 'distributors')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  </div>
              ))}

              {activeTab === 'cars' && carModels.map(car => (
                  <div key={car.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><Car size={20} /></div>
                              <h3 className="font-bold text-gray-900">{car.name}</h3>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(car)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(car, 'car_models')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  </div>
              ))}

              {activeTab === 'versions' && carVersions.map(ver => {
                  const modelName = carModels.find(m => m.id === ver.model_id)?.name || 'Unknown';
                  return (
                      <div key={ver.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                          <div className="flex justify-between items-start">
                              <div>
                                  <p className="text-xs text-gray-500 font-bold uppercase">{modelName}</p>
                                  <h3 className="font-bold text-gray-900 text-lg">{ver.name}</h3>
                                  <p className="text-green-600 font-bold">{ver.price?.toLocaleString()} VNĐ</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleOpenModal(ver)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                  <button onClick={() => handleDeleteClick(ver, 'car_versions')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                              </div>
                          </div>
                      </div>
                  );
              })}

              {/* Enhanced Promos Display */}
              {(activeTab === 'promos') && quoteConfigs.map(conf => (
                  <div key={conf.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">Ưu tiên: {conf.priority}</span>
                                  {conf.target_type === 'rolling' ? (
                                      <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded">Giảm Lăn Bánh</span>
                                  ) : (
                                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">Giảm Giá Xe (XHĐ)</span>
                                  )}
                                  {!conf.is_active && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded">Ẩn</span>}
                              </div>
                              <h3 className="font-bold text-gray-900 mt-1">{conf.name}</h3>
                              <p className="font-bold text-green-600">
                                  {conf.value_type === 'percent' ? `${conf.value}%` : `${conf.value.toLocaleString()} VNĐ`}
                              </p>
                              {/* Display Scope */}
                              <div className="mt-2 text-xs text-gray-500">
                                  {conf.apply_to_model_ids && conf.apply_to_model_ids.length > 0 ? (
                                      <p>Dòng xe: {conf.apply_to_model_ids.map(id => carModels.find(m => m.id === id)?.name).join(', ')}</p>
                                  ) : <p>Tất cả dòng xe</p>}
                                  {conf.apply_to_version_ids && conf.apply_to_version_ids.length > 0 && (
                                      <p className="mt-0.5 text-blue-600">Phiên bản: {conf.apply_to_version_ids.length} phiên bản chọn lọc</p>
                                  )}
                              </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(conf)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(conf, 'quote_configs')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  </div>
              ))}

              {/* Gifts Display */}
              {activeTab === 'gifts' && quoteConfigs.map(conf => (
                  <div key={conf.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">Ưu tiên: {conf.priority}</span>
                                  {!conf.is_active && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded">Ẩn</span>}
                              </div>
                              <h3 className="font-bold text-gray-900 mt-1 flex items-center gap-2"><Gift size={16} className="text-purple-500"/> {conf.name}</h3>
                              {/* VinPoint Check */}
                              {conf.options && conf.options.length > 0 ? (
                                  <div className="mt-1">
                                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold flex items-center gap-1 w-fit"><Coins size={10}/> VinPoint</span>
                                      <p className="text-xs text-gray-500 mt-1">
                                          Tích điểm tùy dòng xe ({conf.options.length} dòng xe)
                                      </p>
                                  </div>
                              ) : (
                                  <p className="text-gray-500 text-sm mt-1">Giá trị: {conf.value > 0 ? `${conf.value.toLocaleString()} VNĐ` : 'Hiện vật'}</p>
                              )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(conf)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(conf, 'quote_configs')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  </div>
              ))}

              {/* Membership Display */}
              {activeTab === 'membership' && quoteConfigs.map(conf => (
                  <div key={conf.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">Ưu tiên: {conf.priority}</span>
                                  {!conf.is_active && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded">Ẩn</span>}
                              </div>
                              <h3 className="font-bold text-gray-900 mt-1 flex items-center gap-2"><Crown size={16} className="text-yellow-500"/> {conf.name}</h3>
                              <div className="mt-2 space-y-1">
                                  <p className="text-blue-600 text-sm font-bold">Giảm giá: {conf.value}%</p>
                                  <p className="text-green-600 text-sm font-bold">Tặng thêm: {conf.gift_ratio || 0}%</p>
                              </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(conf)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(conf, 'quote_configs')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  </div>
              ))}

              {/* Warranty Display (NEW) */}
              {activeTab === 'warranties' && quoteConfigs.map(conf => (
                  <div key={conf.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  {!conf.is_active && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded">Ẩn</span>}
                              </div>
                              <h3 className="font-bold text-gray-900 mt-1 flex items-center gap-2"><ShieldCheck size={16} className="text-green-600"/> {conf.name}</h3>
                              {/* Display Scope */}
                              <div className="mt-2 text-xs text-gray-500">
                                  {conf.apply_to_model_ids && conf.apply_to_model_ids.length > 0 ? (
                                      <p>Dòng xe: {conf.apply_to_model_ids.map(id => carModels.find(m => m.id === id)?.name).join(', ')}</p>
                                  ) : <p>Tất cả dòng xe</p>}
                              </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(conf)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(conf, 'quote_configs')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  </div>
              ))}

              {(activeTab === 'fees') && quoteConfigs.map(conf => (
                  <div key={conf.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start">
                          <div>
                              <div className="flex items-center gap-2">
                                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">Ưu tiên: {conf.priority}</span>
                                  {!conf.is_active && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded">Ẩn</span>}
                              </div>
                              <h3 className="font-bold text-gray-900 mt-1">{conf.name}</h3>
                              {conf.options && conf.options.length > 0 ? (
                                  <p className="font-bold text-blue-600 text-xs mt-1">
                                      {conf.options.length} Lựa chọn ({conf.options.map(o => o.label).join(', ')})
                                  </p>
                              ) : (
                                  <p className="font-bold text-red-600">
                                      {conf.value_type === 'percent' ? `${conf.value}%` : `${conf.value.toLocaleString()} VNĐ`}
                                  </p>
                              )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(conf)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(conf, 'quote_configs')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  </div>
              ))}

              {activeTab === 'banks' && banks.map(bank => (
                  <div key={bank.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start">
                          <div>
                              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Landmark size={16}/> {bank.name}</h3>
                              {bank.packages && bank.packages.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                      {bank.packages.map((pkg, idx) => (
                                          <div key={idx} className="text-xs text-gray-600 flex justify-between gap-4">
                                              <span>{pkg.name}:</span>
                                              <span className="font-bold">{pkg.rate}%</span>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                                      <p>Lãi suất: <strong>{bank.interest_rate_1y}%</strong></p>
                                  </div>
                              )}
                              <p className="text-xs text-gray-500 mt-2">Vay tối đa: <strong>{bank.max_loan_ratio}%</strong></p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(bank)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteClick(bank, 'banks')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
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
                                  <div className="h-12 w-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><Key size={24} /></div>
                                  <div>
                                      <h3 className="font-bold text-gray-900">{car.name}</h3>
                                      <p className="text-sm text-green-600 font-bold">{car.price?.toLocaleString('vi-VN')} VNĐ / lượt</p>
                                      <p className="text-xs text-gray-500 mt-1">Chủ xe: {owner?.full_name || '---'}</p>
                                  </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleOpenModal(car)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                  <button onClick={() => handleDeleteClick(car, 'demo_cars')} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      {/* Unified Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{formData.id ? 'Cập nhật' : 'Thêm mới'}</h3>
                  <button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
                      <input required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:border-primary-500 outline-none" />
                  </div>

                  {activeTab === 'distributors' && (
                      <div><label className="block text-sm font-bold text-gray-700 mb-1">Địa chỉ</label><input value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 outline-none"/></div>
                  )}

                  {activeTab === 'versions' && (
                      <>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Dòng xe</label><select required value={formData.model_id || ''} onChange={e => setFormData({...formData, model_id: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"><option value="">-- Chọn --</option>{carModels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Giá niêm yết</label><input required type="text" value={formData.price ? Number(formData.price).toLocaleString() : ''} onChange={e => setFormData({...formData, price: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold text-gray-900 outline-none"/></div>
                      </>
                  )}

                  {(activeTab === 'promos') && (
                      <>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Giá trị</label><input required type="text" value={formData.value ? (formData.value_type === 'percent' ? formData.value : Number(formData.value).toLocaleString()) : ''} onChange={e => setFormData({...formData, value: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold text-gray-900 outline-none"/></div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Loại giá trị</label><select value={formData.value_type || 'fixed'} onChange={e => setFormData({...formData, value_type: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"><option value="fixed">Số tiền cố định (VNĐ)</option><option value="percent">Phần trăm (%)</option></select></div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Thứ tự ưu tiên (1 = Cao nhất)</label><input type="number" value={formData.priority || 0} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"/></div>
                          
                          {/* TARGET TYPE: Invoice vs Rolling */}
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Mục tiêu giảm giá</label>
                              <div className="flex gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="radio" name="target_type" value="invoice" checked={!formData.target_type || formData.target_type === 'invoice'} onChange={() => setFormData({...formData, target_type: 'invoice'})} className="w-4 h-4 text-blue-600"/>
                                      <span className="text-sm">Trừ vào giá xe (XHĐ)</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="radio" name="target_type" value="rolling" checked={formData.target_type === 'rolling'} onChange={() => setFormData({...formData, target_type: 'rolling'})} className="w-4 h-4 text-orange-600"/>
                                      <span className="text-sm">Trừ vào giá Lăn bánh</span>
                                  </label>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 italic">
                                  {formData.target_type === 'rolling' ? 'Sẽ được trừ sau cùng, KHÔNG ảnh hưởng tính thuế.' : 'Sẽ được trừ theo thứ tự ưu tiên vào giá xe.'}
                              </p>
                          </div>

                          {/* SCOPE SELECTION: Multi-Select for Models */}
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Áp dụng cho Dòng xe (Chọn nhiều)</label>
                              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 p-3 rounded-xl bg-gray-50">
                                  {carModels.map(c => (
                                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition-colors">
                                          <input
                                              type="checkbox"
                                              checked={formData.apply_to_model_ids && formData.apply_to_model_ids.includes(c.id)}
                                              onChange={() => toggleModelSelection(c.id)}
                                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                          />
                                          <span className="text-sm font-medium text-gray-700">{c.name}</span>
                                      </label>
                                  ))}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Để trống = Tất cả dòng xe</p>
                          </div>
                          
                          {/* Version Multi-Select: Show versions for ALL selected models */}
                          {formData.apply_to_model_ids && formData.apply_to_model_ids.length > 0 && (
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                                  <label className="block text-xs font-bold text-gray-700 mb-2">Chọn phiên bản cụ thể (Trống = Tất cả phiên bản)</label>
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                      {carVersions.filter(v => formData.apply_to_model_ids.includes(v.model_id)).map(v => {
                                          const modelName = carModels.find(m => m.id === v.model_id)?.name;
                                          return (
                                              <label key={v.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                  <input 
                                                      type="checkbox" 
                                                      checked={formData.apply_to_version_ids?.includes(v.id) || false} 
                                                  onChange={() => toggleVersionSelection(v.id)} 
                                                      className="rounded text-blue-600"
                                                  />
                                                  <span className="text-sm">
                                                      <span className="text-gray-500 text-xs font-bold mr-1">[{modelName}]</span>
                                                      {v.name} ({Number(v.price).toLocaleString()} đ)
                                                  </span>
                                              </label>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}

                          <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.is_active !== false} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4"/><label className="text-sm">Đang kích hoạt</label></div>
                      </>
                  )}

                  {activeTab === 'gifts' && (
                      <>
                          {/* VinPoint Toggle */}
                          <div className="flex items-center gap-2 mb-4 p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                              <input 
                                  type="checkbox" 
                                  id="isVinPoint" 
                                  checked={isVinPoint} 
                                  onChange={(e) => setIsVinPoint(e.target.checked)} 
                                  className="w-5 h-5 text-yellow-600 rounded"
                              />
                              <label htmlFor="isVinPoint" className="text-sm font-bold text-gray-800 cursor-pointer select-none flex items-center gap-2">
                                  <Coins size={16} className="text-yellow-600"/>
                                  Cấu hình VinPoint (Điểm thưởng theo dòng xe)
                              </label>
                          </div>

                          {isVinPoint ? (
                              <div className="space-y-2 mb-4 border border-gray-200 rounded-xl p-3 max-h-60 overflow-y-auto">
                                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Nhập điểm cho từng dòng xe</p>
                                  {carModels.map(model => (
                                      <div key={model.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                          <span className="text-sm font-medium text-gray-700">{model.name}</span>
                                          <div className="flex items-center gap-2">
                                              <input 
                                                  type="text"
                                                  className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-right font-bold text-gray-900 outline-none focus:border-yellow-500"
                                                  placeholder="0"
                                                  value={vinPointMap[model.id] ? vinPointMap[model.id].toLocaleString('vi-VN') : ''}
                                                  onChange={(e) => {
                                                      const val = Number(e.target.value.replace(/\D/g, ''));
                                                      setVinPointMap({...vinPointMap, [model.id]: val});
                                                  }}
                                              />
                                              <span className="text-xs text-gray-500 font-bold">điểm</span>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div>
                                  <label className="block text-sm font-bold text-gray-700 mb-1">Giá trị (VNĐ) hoặc Tên quà</label>
                                  <input type="text" value={formData.value ? Number(formData.value).toLocaleString() : ''} onChange={e => setFormData({...formData, value: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold text-gray-900 outline-none" placeholder="VD: 2.000.000"/>
                              </div>
                          )}

                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Thứ tự ưu tiên (Hiển thị)</label><input type="number" value={formData.priority || 0} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"/></div>
                          <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.is_active !== false} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4"/><label className="text-sm">Đang kích hoạt</label></div>
                      </>
                  )}

                  {activeTab === 'membership' && (
                      <>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Giảm giá (%)</label>
                              <input 
                                type="text" // Keep as text to control input manually
                                value={formData.value || ''} 
                                onChange={e => {
                                    // Allow numbers, dots, and commas only
                                    const raw = e.target.value;
                                    // Regex to allow digits, one dot, or one comma
                                    if (/^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                                        setFormData({...formData, value: raw});
                                    }
                                }} 
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold text-blue-600 outline-none" 
                                placeholder="VD: 0.5"
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Tặng thêm (% giá trị xe)</label>
                              <input 
                                type="text" 
                                value={formData.gift_ratio || ''} 
                                onChange={e => {
                                    const raw = e.target.value;
                                    if (/^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                                        setFormData({...formData, gift_ratio: raw});
                                    }
                                }}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold text-green-600 outline-none" 
                                placeholder="VD: 0.5"
                              />
                          </div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Thứ tự ưu tiên</label><input type="number" value={formData.priority || 0} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"/></div>
                          <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.is_active !== false} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4"/><label className="text-sm">Đang kích hoạt</label></div>
                      </>
                  )}
                  
                  {activeTab === 'warranties' && (
                      <>
                          {/* Warranty specific fields */}
                          {/* SCOPE SELECTION: Multi-Select for Models */}
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Áp dụng cho Dòng xe (Chọn nhiều)</label>
                              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 p-3 rounded-xl bg-gray-50">
                                  {carModels.map(c => (
                                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition-colors">
                                          <input
                                              type="checkbox"
                                              checked={formData.apply_to_model_ids && formData.apply_to_model_ids.includes(c.id)}
                                              onChange={() => toggleModelSelection(c.id)}
                                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                          />
                                          <span className="text-sm font-medium text-gray-700">{c.name}</span>
                                      </label>
                                  ))}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Để trống = Tất cả dòng xe</p>
                          </div>
                          <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={formData.is_active !== false} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4"/><label className="text-sm">Đang kích hoạt</label></div>
                      </>
                  )}

                  {activeTab === 'fees' && (
                      <>
                          <div className="flex items-center gap-2 mb-2 bg-blue-50 p-2 rounded-lg">
                              <input type="checkbox" id="multiOption" checked={isMultiOption} onChange={e => setIsMultiOption(e.target.checked)} className="w-4 h-4"/>
                              <label htmlFor="multiOption" className="text-sm font-bold text-blue-800 cursor-pointer">Có nhiều lựa chọn (VD: HCM, Tỉnh...)</label>
                          </div>

                          {!isMultiOption ? (
                              <>
                                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Giá trị mặc định</label><input required type="text" value={formData.value ? (formData.value_type === 'percent' ? formData.value : Number(formData.value).toLocaleString()) : ''} onChange={e => setFormData({...formData, value: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold text-gray-900 outline-none"/></div>
                                  <div><label className="block text-sm font-bold text-gray-700 mb-1">Loại giá trị</label><select value={formData.value_type || 'fixed'} onChange={e => setFormData({...formData, value_type: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"><option value="fixed">Số tiền cố định (VNĐ)</option><option value="percent">Phần trăm (%)</option></select></div>
                              </>
                          ) : (
                              <div className="space-y-2">
                                  <label className="block text-sm font-bold text-gray-700">Danh sách tùy chọn</label>
                                  {feeOptions.map((opt, idx) => (
                                      <div key={idx} className="flex gap-2">
                                          <input placeholder="Tên (VD: HCM)" value={opt.label} onChange={e => updateOption(idx, 'label', e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm"/>
                                          <input placeholder="Giá tiền" value={Number(opt.value).toLocaleString()} onChange={e => updateOption(idx, 'value', e.target.value)} className="w-32 border rounded px-2 py-1 text-sm font-bold"/>
                                          <button type="button" onClick={() => removeOption(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                      </div>
                                  ))}
                                  <button type="button" onClick={addOption} className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">+ Thêm lựa chọn</button>
                              </div>
                          )}
                          
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Thứ tự ưu tiên (1 = Cao nhất)</label><input type="number" value={formData.priority || 0} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"/></div>
                          <div className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active !== false} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4"/><label className="text-sm">Đang kích hoạt</label></div>
                      </>
                  )}

                  {activeTab === 'banks' && (
                      <>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Các gói lãi suất (Năm đầu)</label>
                              <div className="space-y-2 mb-3">
                                  {bankPackages.map((pkg, idx) => (
                                      <div key={idx} className="flex gap-2 items-center">
                                          <input 
                                              placeholder="Tên gói (VD: Cố định 1 năm)" 
                                              className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
                                              value={pkg.name}
                                              onChange={(e) => updateBankPackage(idx, 'name', e.target.value)}
                                          />
                                          <input 
                                              type="number" 
                                              step="0.1" 
                                              placeholder="%" 
                                              className="w-20 border rounded-lg px-2 py-1.5 text-sm font-bold text-center"
                                              value={pkg.rate}
                                              onChange={(e) => updateBankPackage(idx, 'rate', e.target.value)}
                                          />
                                          <span className="text-sm font-bold text-gray-500">%</span>
                                          <button type="button" onClick={() => removeBankPackage(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                      </div>
                                  ))}
                                  <button type="button" onClick={addBankPackage} className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">+ Thêm gói lãi suất</button>
                              </div>
                          </div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Tỉ lệ vay tối đa (%)</label><input type="number" value={formData.max_loan_ratio || ''} onChange={e => setFormData({...formData, max_loan_ratio: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"/></div>
                      </>
                  )}

                  {activeTab === 'demo_cars' && (
                      <>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Giá mượn xe</label><input required type="text" value={formData.price ? Number(formData.price).toLocaleString() : ''} onChange={e => setFormData({...formData, price: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-300 rounded-xl px-3 py-2 font-bold text-gray-900 outline-none"/></div>
                          <div><label className="block text-sm font-bold text-gray-700 mb-1">Chủ xe</label><select required value={formData.owner_id || ''} onChange={e => setFormData({...formData, owner_id: e.target.value})} className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none"><option value="">-- Chọn chủ xe --</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                      </>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-bold bg-gray-100 hover:bg-gray-200 rounded-xl">Hủy</button>
                      <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 flex items-center gap-2">{isSubmitting && <Loader2 className="animate-spin" size={16} />} Lưu</button>
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
                      <p className="text-gray-500 text-sm mb-6">Bạn có chắc chắn muốn xóa "<strong>{deleteTarget.name}</strong>"?</p>
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

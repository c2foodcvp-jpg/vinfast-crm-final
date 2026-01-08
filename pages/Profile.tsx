
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, Phone, Save, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Database, Copy, Zap, Globe, Layout, ArrowUp, ArrowDown, RotateCcw, FileText, X
} from 'lucide-react';
import { UserRole } from '../types';

const Profile: React.FC = () => {
  const { userProfile, session, isAdmin, isMod } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', content: string } | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // App Config State
  const [appIconUrl, setAppIconUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Menu Sorting State
  const [menuOrder, setMenuOrder] = useState<string[]>([]);
  const [menuLabels, setMenuLabels] = useState<Record<string, string>>({});

  // Quick Edit Text (Car Prices, Bank Rates)
  const [quickEditType, setQuickEditType] = useState<'car_prices' | 'bank_rates' | null>(null);
  const [quickEditContent, setQuickEditContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Define default menu keys for reference
  const DEFAULT_MENU_KEYS = [
      { key: 'dashboard', label: 'Tổng quan' },
      { key: 'customers', label: 'Khách hàng' },
      { key: 'deals', label: 'Đơn hàng' },
      { key: 'finance', label: 'Tài chính & Quỹ' },
      { key: 'car_prices', label: 'Bảng giá Xe' },
      { key: 'bank_rates', label: 'Lãi suất Bank' },
      { key: 'inventory', label: 'Kho xe (Tồn)' },
      { key: 'promotions', label: 'Chính sách Team' },
      { key: 'assign', label: 'Phân bổ Leads' },
      { key: 'employees', label: 'Nhân sự' },
      { key: 'team_fund', label: 'Quỹ Nhóm' },
      { key: 'configuration', label: 'Cấu hình' },
      { key: 'profile', label: 'Cá nhân' }
  ];

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setPhone(userProfile.phone || '');
      setAvatarUrl(userProfile.avatar_url || '');
    }
    if (isAdmin) {
        fetchAppConfig();
    }
  }, [userProfile, isAdmin]);

  const fetchAppConfig = async () => {
      try {
          const { data } = await supabase.from('app_settings').select('*').in('key', ['app_icon_url', 'menu_order']);
          
          let fetchedOrder: string[] = [];
          if (data) {
              data.forEach(item => {
                  if (item.key === 'app_icon_url') setAppIconUrl(item.value);
                  if (item.key === 'menu_order') {
                      try { fetchedOrder = JSON.parse(item.value); } catch (e) {}
                  }
              });
          }
          // Init menu order if empty
          const allDefaultKeys = DEFAULT_MENU_KEYS.map(k => k.key);
          if (fetchedOrder.length === 0) {
              setMenuOrder(allDefaultKeys);
          } else {
              // Ensure no missing keys if new features added
              // Also map old 'distributors' to 'configuration' if it exists in DB
              const mappedOrder = fetchedOrder.map(k => k === 'distributors' ? 'configuration' : k);
              const missing = allDefaultKeys.filter(k => !mappedOrder.includes(k));
              setMenuOrder([...mappedOrder, ...missing]);
          }
          
          // Map labels
          const labels: any = {};
          DEFAULT_MENU_KEYS.forEach(k => labels[k.key] = k.label);
          setMenuLabels(labels);

      } catch (e) { console.error("Failed to fetch app config", e); }
  };

  const handleSaveAppConfig = async () => {
      setSavingConfig(true);
      try {
          const updates = [];
          updates.push({ key: 'app_icon_url', value: appIconUrl });
          if (menuOrder.length > 0) updates.push({ key: 'menu_order', value: JSON.stringify(menuOrder) });

          const { error } = await supabase.from('app_settings').upsert(updates);
          if (error) throw error;
          
          // Trigger forced update for Layout
          window.dispatchEvent(new Event('menu_config_updated'));
          
          setMessage({ type: 'success', content: 'Đã lưu cấu hình hệ thống! Menu sẽ cập nhật ngay.' });
      } catch (e) {
          setMessage({ type: 'error', content: 'Lỗi lưu cấu hình.' });
      } finally {
          setSavingConfig(false);
      }
  };

  const handleResetMenu = () => {
      setMenuOrder(DEFAULT_MENU_KEYS.map(k => k.key));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // Removing updated_at to prevent errors if column missing
      const updateData: any = { full_name: fullName, phone: phone, avatar_url: avatarUrl };
      
      const { error } = await supabase.from('profiles').update(updateData).eq('id', userProfile?.id);
      
      if (error) throw error;
      
      // Update Auth Metadata as well
      await supabase.auth.updateUser({ data: { full_name: fullName, phone: phone } });
      
      setMessage({ type: 'success', content: 'Cập nhật thông tin thành công! Đang tải lại...' });
      
      // Reload to ensure Sidebar/Header updates (Context might not refresh immediately)
      setTimeout(() => {
          window.location.reload();
      }, 1000);

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('violates row-level security')) {
          setMessage({ type: 'error', content: 'Lỗi Quyền: Bạn chưa được cấp quyền sửa hồ sơ. Vui lòng báo Admin.' });
      } else if (err.code === 'PGRST204') {
          // Columns missing
          setMessage({ type: 'error', content: 'Lỗi Database: Thiếu cột dữ liệu. Hãy chạy mã SQL sửa lỗi trong phần Cấu hình.' });
      } else {
          setMessage({ type: 'error', content: err.message || 'Lỗi cập nhật hồ sơ.' });
      }
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    if (!currentPassword || newPassword.length < 6 || newPassword !== confirmPassword) {
      setMessage({ type: 'error', content: 'Vui lòng kiểm tra lại thông tin mật khẩu.' }); setLoading(false); return;
    }
    try {
      const email = session?.user?.email;
      if (!email) throw new Error("Không tìm thấy email.");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) throw new Error("Mật khẩu hiện tại không đúng.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: 'success', content: 'Đổi mật khẩu thành công!' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', content: err.message || 'Lỗi đổi mật khẩu.' });
    } finally {
      setLoading(false);
    }
  };

  const moveMenu = (index: number, direction: 'up' | 'down') => {
      const newOrder = [...menuOrder];
      if (direction === 'up') {
          if (index === 0) return;
          [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      } else {
          if (index === newOrder.length - 1) return;
          [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
      }
      setMenuOrder(newOrder);
  };

  // --- QUICK EDIT LOGIC ---
  const openQuickEdit = async (type: 'car_prices' | 'bank_rates') => {
      setQuickEditType(type);
      setLoadingContent(true);
      const key = type === 'car_prices' ? 'car_prices_html' : 'bank_rates_html';
      try {
          const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
          setQuickEditContent(data?.value || '');
      } catch (e) {} finally { setLoadingContent(false); }
  };

  const saveQuickEdit = async () => {
      if (!quickEditType) return;
      setLoadingContent(true);
      const key = quickEditType === 'car_prices' ? 'car_prices_html' : 'bank_rates_html';
      try {
          await supabase.from('app_settings').upsert({ key, value: quickEditContent });
          setMessage({ type: 'success', content: 'Đã cập nhật nội dung thành công!' });
          setQuickEditType(null);
      } catch (e) {
          setMessage({ type: 'error', content: 'Lỗi lưu nội dung.' });
      } finally { setLoadingContent(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div><h1 className="text-2xl font-bold text-gray-900">Tài khoản cá nhân</h1><p className="text-gray-500">Quản lý thông tin hồ sơ và bảo mật tài khoản.</p></div>
      {message && (<div className={`p-4 rounded-xl flex items-center gap-3 animate-fade-in ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}<span className="font-medium">{message.content}</span></div>)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-900 flex items-center gap-2"><User size={20} className="text-primary-600" /> Thông tin chung</h3></div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative group"><div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">{avatarUrl ? (<img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />) : (<span className="text-3xl font-bold text-gray-400">{fullName?.charAt(0)?.toUpperCase() || 'U'}</span>)}</div></div>
                <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Link Ảnh đại diện (URL)</label><input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-primary-500 outline-none text-gray-900 font-medium" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">Họ và tên</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-gray-900 font-medium outline-none focus:border-primary-500" /></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Số điện thoại</label><input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-gray-900 font-medium outline-none focus:border-primary-500" /></div></div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end"><button type="submit" disabled={loading} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-200 transition-all disabled:opacity-70">{loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Lưu thay đổi</button></div>
          </form>

          {isAdmin && (
              <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 overflow-hidden">
                 <div className="p-6 border-b border-indigo-100 bg-indigo-50 flex items-center justify-between">
                     <div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Globe size={24} /></div><div><h3 className="font-bold text-indigo-900">Cấu hình Hệ thống (Admin)</h3></div></div>
                     <button onClick={handleSaveAppConfig} disabled={savingConfig} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-70">{savingConfig ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Lưu cấu hình</button>
                 </div>
                 <div className="p-6 space-y-6">
                     <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2">URL Icon Web</label>
                         <div className="flex gap-2"><input type="text" value={appIconUrl} onChange={e => setAppIconUrl(e.target.value)} className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 text-gray-900 font-medium" placeholder="https://..." /></div>
                     </div>
                     
                     {/* CONTENT MANAGEMENT */}
                     <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><FileText size={16}/> Quản lý Nội dung Chung</label>
                         <div className="flex gap-3">
                             <button onClick={() => openQuickEdit('car_prices')} className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 flex items-center gap-2 shadow-sm"><FileText size={14}/> Sửa Bảng giá Xe</button>
                             <button onClick={() => openQuickEdit('bank_rates')} className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 flex items-center gap-2 shadow-sm"><FileText size={14}/> Sửa Lãi suất Bank</button>
                         </div>
                         {quickEditType && (
                             <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in">
                                 <div className="flex justify-between items-center mb-2">
                                     <h4 className="font-bold text-sm text-gray-800">Đang sửa: {quickEditType === 'car_prices' ? 'Bảng giá Xe' : 'Lãi suất Ngân hàng'}</h4>
                                     <button onClick={() => setQuickEditType(null)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
                                 </div>
                                 <textarea className="w-full h-48 border border-gray-300 rounded-lg p-3 text-xs font-mono focus:border-indigo-500 outline-none" value={quickEditContent} onChange={e => setQuickEditContent(e.target.value)} disabled={loadingContent}></textarea>
                                 <div className="mt-2 flex justify-end">
                                     <button onClick={saveQuickEdit} className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 flex items-center gap-1">{loadingContent ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Lưu Nội dung</button>
                                 </div>
                             </div>
                         )}
                     </div>

                     {/* MENU SORTING */}
                     <div>
                         <div className="flex justify-between items-center mb-2">
                             <label className="block text-sm font-bold text-gray-700 flex items-center gap-2"><Layout size={16}/> Sắp xếp Menu Chính</label>
                             <button onClick={handleResetMenu} className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline"><RotateCcw size={12}/> Khôi phục mặc định</button>
                         </div>
                         <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                             {menuOrder.map((key, index) => (
                                 <div key={key} className="flex items-center justify-between p-3 border-b border-gray-200 last:border-0 bg-white">
                                     <span className="font-medium text-gray-700 ml-2">{menuLabels[key] || key}</span>
                                     <div className="flex gap-1">
                                         <button onClick={() => moveMenu(index, 'up')} disabled={index === 0} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-600"><ArrowUp size={16}/></button>
                                         <button onClick={() => moveMenu(index, 'down')} disabled={index === menuOrder.length - 1} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-600"><ArrowDown size={16}/></button>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
              </div>
          )}
        </div>

        <div className="space-y-6">
          <form onSubmit={handleChangePassword} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100"><h3 className="font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={20} className="text-green-600" /> Bảo mật</h3></div>
            <div className="p-6 space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-2">Mật khẩu hiện tại</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-gray-900 focus:border-green-500 outline-none font-medium" /></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Mật khẩu mới</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-gray-900 focus:border-green-500 outline-none font-medium" /></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Nhập lại mật khẩu mới</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-gray-900 focus:border-green-500 outline-none font-medium" /></div></div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100"><button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18} /> : 'Đổi mật khẩu'}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;

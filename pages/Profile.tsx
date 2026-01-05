
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, 
  Phone, 
  Save, 
  ShieldCheck, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Database, 
  Copy, 
  Zap,
  Globe
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
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'app_icon_url').maybeSingle();
      if (data) setAppIconUrl(data.value);
  };

  const handleSaveAppConfig = async () => {
      setSavingConfig(true);
      try {
          const { error } = await supabase.from('app_settings').upsert({ key: 'app_icon_url', value: appIconUrl });
          if (error) throw error;
          setMessage({ type: 'success', content: 'Đã lưu cấu hình Icon Web!' });
      } catch (e) {
          setMessage({ type: 'error', content: 'Lỗi lưu cấu hình. Hãy đảm bảo bạn đã chạy SQL tạo bảng app_settings.' });
      } finally {
          setSavingConfig(false);
      }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName, phone: phone, avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', userProfile?.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: fullName, phone: phone } });
      setMessage({ type: 'success', content: 'Cập nhật thông tin thành công!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', content: err.message || 'Lỗi cập nhật hồ sơ.' });
    } finally {
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

  // --- SQL MIGRATION: UPDATE POLICIES FOR ADMIN & MOD ---
  // Updated to include constraint fix for transactions type
  const financePromoSQL = `
-- 1. BẢNG APP_SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- 2. CỘT PENDING_TRANSFER CHO CUSTOMERS
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='pending_transfer_to') THEN
    ALTER TABLE public.customers ADD COLUMN pending_transfer_to uuid REFERENCES public.profiles(id);
  END IF;
END $$;

-- 3. BẢNG TRANSACTIONS (Ensure Constraints are Updated)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  user_id uuid REFERENCES public.profiles(id),
  user_name text,
  type text NOT NULL,
  subtype text,
  target_date date,
  amount numeric DEFAULT 0,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid,
  created_at timestamptz DEFAULT now()
);

-- FIX: Explicitly update check constraint to include 'adjustment'
DO $$ BEGIN
  ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
  ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('revenue', 'deposit', 'advance', 'expense', 'adjustment', 'dealer_debt', 'repayment'));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 4. BẢNG TEAM_POLICIES
CREATE TABLE IF NOT EXISTS public.team_policies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id uuid REFERENCES public.profiles(id) UNIQUE,
  content text,
  updated_at timestamptz DEFAULT now()
);

-- 5. CẤP QUYỀN (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_policies ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.team_policies TO authenticated;
GRANT ALL ON public.team_policies TO service_role;

-- 6. TẠO POLICIES (DROP TRƯỚC ĐỂ TRÁNH LỖI)

-- Settings Policies (Updated to allow MODs)
DROP POLICY IF EXISTS "Read settings" ON public.app_settings;
CREATE POLICY "Read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Manage settings" ON public.app_settings;
CREATE POLICY "Manage settings" ON public.app_settings FOR ALL TO authenticated USING (
  exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or role = 'mod'))
);

-- Transaction Policies
DROP POLICY IF EXISTS "View transactions" ON public.transactions;
CREATE POLICY "View transactions" ON public.transactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Create transactions" ON public.transactions;
CREATE POLICY "Create transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update transactions (Admin)" ON public.transactions;
CREATE POLICY "Update transactions (Admin)" ON public.transactions FOR UPDATE TO authenticated USING (
  exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or role = 'mod'))
);

DROP POLICY IF EXISTS "Delete transactions (Admin)" ON public.transactions;
CREATE POLICY "Delete transactions (Admin)" ON public.transactions FOR DELETE TO authenticated USING (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Policy Policies
DROP POLICY IF EXISTS "View policies" ON public.team_policies;
CREATE POLICY "View policies" ON public.team_policies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Manage policies" ON public.team_policies;
CREATE POLICY "Manage policies" ON public.team_policies FOR ALL TO authenticated USING (
  manager_id = auth.uid() OR exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Interaction Policies (Fix Delete)
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.interactions;
CREATE POLICY "Enable delete for users based on user_id" ON public.interactions FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or role = 'mod'))
);

-- Customer Policies (Fix Delete)
DROP POLICY IF EXISTS "Enable delete for admins/mods" ON public.customers;
CREATE POLICY "Enable delete for admins/mods" ON public.customers FOR DELETE TO authenticated USING (
  exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or role = 'mod'))
);

NOTIFY pgrst, 'reload schema';
`;

  const copySQL = (sql: string) => {
      navigator.clipboard.writeText(sql);
      alert("Đã sao chép mã SQL! Vui lòng vào Supabase -> SQL Editor -> Paste và bấm RUN.");
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
                <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Link Ảnh đại diện (URL)</label><input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">Họ và tên</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-gray-900 font-medium" /></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Số điện thoại</label><input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-gray-900 font-medium" /></div></div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end"><button type="submit" disabled={loading} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-200 transition-all disabled:opacity-70">{loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Lưu thay đổi</button></div>
          </form>

          {isAdmin && (
              <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 overflow-hidden">
                 <div className="p-6 border-b border-indigo-100 bg-indigo-50 flex items-center gap-3"><div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Globe size={24} /></div><div><h3 className="font-bold text-indigo-900">Cấu hình Hệ thống (Admin)</h3></div></div>
                 <div className="p-6 space-y-4">
                     <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2">URL Icon Web (Logo hiển thị trên menu)</label>
                         <div className="flex gap-2">
                             <input type="text" value={appIconUrl} onChange={e => setAppIconUrl(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500" placeholder="https://..." />
                             <button onClick={handleSaveAppConfig} disabled={savingConfig} className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-70">{savingConfig ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Lưu</button>
                         </div>
                         {appIconUrl && <div className="mt-2"><img src={appIconUrl} alt="Preview" className="h-10 w-10 object-contain rounded border border-gray-200" /></div>}
                     </div>
                 </div>
              </div>
          )}

          {(isAdmin || isMod) && (
              <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
                 <div className="p-6 border-b border-orange-100 bg-orange-50 flex items-center gap-3"><div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Database size={24} /></div><div><h3 className="font-bold text-orange-900">Cập nhật CSDL (SQL Fix Lỗi Xóa, Chọn Sales & Tài chính)</h3></div></div>
                 <div className="p-6 space-y-6">
                     <div className="space-y-2">
                         <div className="flex items-center justify-between"><h4 className="font-bold text-gray-900 flex items-center gap-2"><Zap size={16} className="text-green-500"/> Khởi tạo & Cập nhật Cấu trúc Bảng</h4></div>
                         <p className="text-xs text-gray-500">Chạy script này để khắc phục lỗi 400 khi điều chỉnh quỹ và các lỗi quyền hạn khác.</p>
                         <div className="relative bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 overflow-x-auto border border-gray-700 shadow-inner"><pre>{financePromoSQL}</pre><button onClick={() => copySQL(financePromoSQL)} className="absolute top-3 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"><Copy size={12} /> Sao chép</button></div>
                     </div>
                 </div>
              </div>
          )}
        </div>

        <div className="space-y-6">
          <form onSubmit={handleChangePassword} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100"><h3 className="font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={20} className="text-green-600" /> Bảo mật</h3></div>
            <div className="p-6 space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-2">Mật khẩu hiện tại</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-gray-900 focus:border-green-500 outline-none" /></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Mật khẩu mới</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-gray-900 focus:border-green-500 outline-none" /></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Nhập lại mật khẩu mới</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-gray-900 focus:border-green-500 outline-none" /></div></div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100"><button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18} /> : 'Đổi mật khẩu'}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;

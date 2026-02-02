
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  User, Save, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Globe, Layout, ArrowUp, ArrowDown, RotateCcw, Camera, Crown, CreditCard, Plus, Trash2, QrCode, Lock
} from 'lucide-react';
import { MembershipTier, PaymentAccount, TIER_ACCOUNT_LIMITS } from '../types';
import AddPaymentAccountModal from '../components/AddPaymentAccountModal';

const Profile: React.FC = () => {
  const { userProfile, session, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', content: string } | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dealershipName, setDealershipName] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false); // New uploading state

  // App Config State
  const [appIconUrl, setAppIconUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Menu Sorting State
  const [menuOrder, setMenuOrder] = useState<string[]>([]);
  const [menuLabels, setMenuLabels] = useState<Record<string, string>>({});

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Payment Accounts State
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const tierName = userProfile?.member_tier || 'Member';
  const maxAccounts = TIER_ACCOUNT_LIMITS[tierName as keyof typeof TIER_ACCOUNT_LIMITS] || 1;

  const DEFAULT_MENU_KEYS = [
    { key: 'dashboard', label: 'Tổng quan' },
    { key: 'calendar', label: 'Lịch làm việc' },
    { key: 'quote', label: 'Báo giá Online' },
    { key: 'analytics', label: 'Phân tích (BI)' },
    { key: 'customers', label: 'Khách hàng' },
    { key: 'deals', label: 'Đơn hàng' },
    { key: 'customer_allocation', label: 'Phân Bổ Khách' },
    { key: 'finance', label: 'Tài chính & Quỹ' },
    { key: 'proposals', label: 'Đề Xuất (Mới)' },
    { key: 'lookup_tools', label: 'Chính sách & Tồn kho' },
    { key: 'employees', label: 'Nhân sự' },
    { key: 'team_fund', label: 'Quỹ Nhóm' },
    { key: 'utilities', label: 'Tiện ích' },
    { key: 'configuration', label: 'Cấu hình' },
    { key: 'profile', label: 'Cá nhân' }
  ];

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setPhone(userProfile.phone || '');
      setDealershipName(userProfile.dealership_name || '');
      setIntroduction(userProfile.introduction || '');
      setBirthdate(userProfile.birthdate || '');
      setAvatarUrl(userProfile.avatar_url || '');
      fetchPaymentAccounts();

      // NEW: Auto-sync Dealership for Employees
      if (userProfile.manager_id && !userProfile.dealership_name) {
        syncDealershipFromManager(userProfile.manager_id);
      } else if (userProfile.manager_id) {
        // Even if they have one, double check/override to ensure sync?
        // For now, let's just ensure it loads correctly.
        // The syncDealershipFromManager can also be used to force update
        syncDealershipFromManager(userProfile.manager_id);
      }
    }
    if (isAdmin) {
      fetchAppConfig();
    }
  }, [userProfile, isAdmin]);

  const syncDealershipFromManager = async (managerId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('dealership_name').eq('id', managerId).single();
      if (data && data.dealership_name) {
        setDealershipName(data.dealership_name);

        // Optionally: Auto-save to DB if current profile is empty/different
        if (userProfile?.dealership_name !== data.dealership_name) {
          await supabase.from('profiles').update({ dealership_name: data.dealership_name }).eq('id', userProfile?.id);
          console.log("Auto-synced dealership from manager");
        }
      }
    } catch (e) {
      console.error("Failed to sync manager dealership", e);
    }
  };

  // Fetch user's payment accounts
  const fetchPaymentAccounts = async () => {
    if (!userProfile?.id) return;
    setLoadingAccounts(true);
    try {
      const { data } = await supabase
        .from('payment_accounts')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: true });
      if (data) setPaymentAccounts(data as PaymentAccount[]);
    } catch (err) {
      console.error('Error fetching payment accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Delete payment account
  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
    try {
      await supabase.from('payment_accounts').delete().eq('id', accountId);
      setPaymentAccounts(prev => prev.filter(a => a.id !== accountId));
      setMessage({ type: 'success', content: 'Đã xóa tài khoản thành công!' });
    } catch (err: any) {
      setMessage({ type: 'error', content: 'Lỗi xóa tài khoản: ' + err.message });
    }
  };

  // Handle add account success
  const handleAddAccountSuccess = (newAccount: PaymentAccount) => {
    setPaymentAccounts(prev => [...prev, newAccount]);
    setMessage({ type: 'success', content: 'Đã thêm tài khoản thành công!' });
  };


  const fetchAppConfig = async () => {
    try {
      const { data } = await supabase.from('app_settings').select('*').in('key', ['app_icon_url', 'menu_order']);

      let fetchedOrder: string[] = [];
      if (data) {
        data.forEach(item => {
          if (item.key === 'app_icon_url') setAppIconUrl(item.value);
          if (item.key === 'menu_order') {
            try { fetchedOrder = JSON.parse(item.value); } catch (e) { }
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

        // Filter out keys that are no longer top-level (like car_prices, etc.)
        const validKeys = allDefaultKeys;
        const cleanedOrder = mappedOrder.filter(k => validKeys.includes(k));

        const missing = validKeys.filter(k => !cleanedOrder.includes(k));
        setMenuOrder([...cleanedOrder, ...missing]);
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
      const updateData: any = {
        full_name: fullName,
        phone: phone,
        avatar_url: avatarUrl,
        dealership_name: dealershipName,
        introduction: introduction,
        birthdate: birthdate
      };

      const { error } = await supabase.from('profiles').update(updateData).eq('id', userProfile?.id);

      if (error) throw error;

      // Update Auth Metadata as well
      await supabase.auth.updateUser({ data: { full_name: fullName, phone: phone } });

      // --- SYNC DEALERSHIP NAME FOR TEAM MEMBERS (IF MOD) ---
      if ((userProfile?.role === 'mod' || userProfile?.role === 'admin') && dealershipName) {
        // Auto-update all employees under this manager
        const { error: syncError } = await supabase
          .from('profiles')
          .update({ dealership_name: dealershipName })
          .eq('manager_id', userProfile.id);

        if (syncError) {
          console.error("Failed to sync dealership name to team:", syncError);
          // Optional: warn user, but don't block success
        }
      }

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

  // --- NEW: AVATAR UPLOAD LOGIC ---
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      // 1. Tier Check
      const isPlatinumOrHigher =
        userProfile?.member_tier === MembershipTier.PLATINUM ||
        userProfile?.member_tier === MembershipTier.DIAMOND ||
        userProfile?.role === 'admin' || userProfile?.role === 'moderator';

      if (!isPlatinumOrHigher) {
        setMessage({ type: 'error', content: 'Tính năng đổi ảnh chỉ dành cho Platinum trở lên.' });
        // Reset input
        event.target.value = '';
        return;
      }

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Bạn phải chọn một hình ảnh để tải lên.');
      }

      const file = event.target.files[0];

      // 2. Size Check (Max 1MB)
      if (file.size > 1024 * 1024) {
        throw new Error('Kích thước ảnh quá lớn (Tối đa 1MB).');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userProfile?.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 3. Upload
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // 4. Get Public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (data) {
        const newAvatarUrl = data.publicUrl;
        setAvatarUrl(newAvatarUrl); // Update local state

        // 5. AUTO-SAVE to DB
        console.log("Attempting to save avatar to DB...", { id: userProfile?.id, url: newAvatarUrl });
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: newAvatarUrl })
          .eq('id', userProfile?.id);

        if (updateError) {
          console.error("Profile Update Failed:", updateError);
          throw updateError;
        } else {
          console.log("Profile Update Success!");
        }

        // Update Auth Metadata as well (best effort)
        await supabase.auth.updateUser({ data: { avatar_url: newAvatarUrl } });

        setMessage({ type: 'success', content: 'Đã cập nhật ảnh đại diện thành công!' });

        // Reload page shortly to reflect changes everywhere if needed
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }

    } catch (error: any) {
      console.error("Avatar Upload Flow Error:", error);
      setMessage({ type: 'error', content: error.message + (error.details ? ` (${error.details})` : '') });
    } finally {
      setUploading(false);
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
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-gray-400">{fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  {/* Upload Button Overlay */}
                  <label
                    className={`absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-gray-200 cursor-pointer transition-all 
                        ${(userProfile?.member_tier === MembershipTier.PLATINUM || userProfile?.member_tier === MembershipTier.DIAMOND || isAdmin) ? 'hover:bg-gray-50 text-gray-600' : 'opacity-60 grayscale cursor-not-allowed'}`}
                    title={!(userProfile?.member_tier === MembershipTier.PLATINUM || userProfile?.member_tier === MembershipTier.DIAMOND || isAdmin) ? "Chỉ dành cho Platinum+" : "Đổi ảnh đại diện"}
                  >
                    {uploading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploading || !(userProfile?.member_tier === MembershipTier.PLATINUM || userProfile?.member_tier === MembershipTier.DIAMOND || isAdmin)}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link Ảnh đại diện (URL)</label>
                  <div className="flex gap-2">
                    <input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-primary-500 outline-none text-gray-900 font-medium" />
                    {!(userProfile?.member_tier === MembershipTier.PLATINUM || userProfile?.member_tier === MembershipTier.DIAMOND || isAdmin) && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-lg text-xs text-gray-500 whitespace-nowrap border border-gray-200" title="Nâng cấp lên Platinum để mở khóa upload">
                        <Crown size={12} className="text-gray-400" />
                        <span className="font-bold">Upgrade to Upload</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Họ và tên</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-gray-900 font-medium outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Số điện thoại</label>
                  <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-gray-900 font-medium outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    Đại lý làm việc
                    {userProfile?.manager_id && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                        <Lock size={10} /> Theo quản lý
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={dealershipName}
                    onChange={(e) => setDealershipName(e.target.value)}
                    placeholder="Tên đại lý (Showroom)"
                    disabled={!!userProfile?.manager_id} // Disable if managed
                    className={`w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 font-medium outline-none focus:border-primary-500 ${!!userProfile?.manager_id ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Ngày sinh</label>
                  <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 font-medium outline-none focus:border-primary-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Giới thiệu bản thân</label>
                  <textarea rows={3} value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="Một vài lời giới thiệu về bạn..." className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 font-medium outline-none focus:border-primary-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end"><button type="submit" disabled={loading} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-200 transition-all disabled:opacity-70">{loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Lưu thay đổi</button></div>
          </form>

          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 overflow-hidden">
              <div className="p-6 border-b border-indigo-100 bg-indigo-50 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Globe size={24} /></div><div><h3 className="font-bold text-indigo-900">Cấu hình Hệ thống (Admin)</h3></div></div>
                <button onClick={handleSaveAppConfig} disabled={savingConfig} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-70">{savingConfig ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Lưu cấu hình</button>
              </div>
              <div className="p-6 space-y-6">


                {/* MENU SORTING */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-gray-700 flex items-center gap-2"><Layout size={16} /> Sắp xếp Menu Chính</label>
                    <button onClick={handleResetMenu} className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline"><RotateCcw size={12} /> Khôi phục mặc định</button>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                    {menuOrder.map((key, index) => (
                      <div key={key} className="flex items-center justify-between p-3 border-b border-gray-200 last:border-0 bg-white">
                        <span className="font-medium text-gray-700 ml-2">{menuLabels[key] || key}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moveMenu(index, 'up')} disabled={index === 0} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-600"><ArrowUp size={16} /></button>
                          <button onClick={() => moveMenu(index, 'down')} disabled={index === menuOrder.length - 1} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-600"><ArrowDown size={16} /></button>
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

          {/* Payment Accounts Management */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="p-6 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Tài khoản đóng tiền đăng ký xe</h3>
                  <p className="text-xs text-gray-500">{paymentAccounts.length}/{maxAccounts} tài khoản</p>
                </div>
              </div>
              {paymentAccounts.length < maxAccounts && (
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm transition-all"
                >
                  <Plus size={16} /> Thêm tài khoản
                </button>
              )}
            </div>
            <div className="p-6">
              {loadingAccounts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-blue-500" size={24} />
                </div>
              ) : paymentAccounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <QrCode size={40} className="mx-auto mb-2 text-gray-300" />
                  <p>Chưa có tài khoản nào</p>
                  <p className="text-xs text-gray-400">Thêm tài khoản để gửi thông báo đóng tiền cho khách hàng</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentAccounts.map((account) => (
                    <div key={account.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-all">
                      {account.qr_code_url ? (
                        <img src={account.qr_code_url} alt="QR" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center">
                          <QrCode size={24} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate">{account.name}</p>
                        {account.content && (
                          <p className="text-xs text-gray-500 truncate">{account.content}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa tài khoản"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Payment Account Modal */}
      <AddPaymentAccountModal
        visible={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSuccess={handleAddAccountSuccess}
        currentCount={paymentAccounts.length}
      />
    </div>
  );
};

export default Profile;


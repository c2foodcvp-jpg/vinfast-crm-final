import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Upload, Save, Loader2, Image as ImageIcon, AlertCircle, CheckCircle2, LayoutTemplate, LogIn, RefreshCw, Bell, User } from 'lucide-react';

type LogoType = 'favicon' | 'login' | 'menu' | 'customer_avatar';

const SystemSettingsPanel: React.FC = () => {
    const [settings, setSettings] = useState<{
        favicon: string | null;
        loginLogo: string | null;
        menuLogo: string | null;
        defaultCustomerAvatar: string | null;
    }>({
        favicon: null,
        loginLogo: null,
        menuLogo: null,
        defaultCustomerAvatar: null,
    });

    const [uploading, setUploading] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [forceUpdate, setForceUpdate] = useState(false);
    const [forceUpdateSaving, setForceUpdateSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('key, value').in('key', ['system_favicon', 'system_logo_login', 'system_logo_menu', 'force_update', 'default_customer_avatar']);

            const newSettings = { ...settings };
            data?.forEach(item => {
                if (item.key === 'system_favicon') newSettings.favicon = item.value;
                if (item.key === 'system_logo_login') newSettings.loginLogo = item.value;
                if (item.key === 'system_logo_menu') newSettings.menuLogo = item.value;
                if (item.key === 'default_customer_avatar') newSettings.defaultCustomerAvatar = item.value;
                if (item.key === 'force_update') setForceUpdate(item.value === 'true' || item.value === true);
            });
            setSettings(newSettings);
        } catch (error) {
            console.error(error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: LogoType) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        // Check file size (Max 1MB)
        if (file.size > 1024 * 1024) {
            setMsg({ type: 'error', text: `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(2)}MB). Vui lòng chọn ảnh dưới 1MB.` });
            return;
        }

        setUploading(prev => ({ ...prev, [type]: true }));
        setMsg(null);
        const fileExt = file.name.split('.').pop();
        const fileName = `${type}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
            // 1. Upload to 'system-assets' bucket
            const { error: uploadError } = await supabase.storage
                .from('system-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('system-assets')
                .getPublicUrl(filePath);

            setSettings(prev => ({
                ...prev,
                ...prev,
                [type === 'favicon' ? 'favicon' : type === 'login' ? 'loginLogo' : type === 'menu' ? 'menuLogo' : 'defaultCustomerAvatar']: publicUrl
            }));

            // Auto-save logic can be here, or user clicks Save. To keep it simple, let user click Save.
            setMsg({ type: 'success', text: `Đã tải ảnh ${type} lên! Nhấn Lưu để áp dụng.` });

        } catch (error: any) {
            console.error("Upload error:", error);
            if (error.message.includes("Bucket not found")) {
                setMsg({ type: 'error', text: "Lỗi: Bucket 'system-assets' chưa được tạo. Vui lòng chạy SQL setup." });
            } else {
                setMsg({ type: 'error', text: `Upload thất bại: ${error.message}` });
            }
        } finally {
            setUploading(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = [
                { key: 'system_favicon', value: settings.favicon },
                { key: 'system_logo_login', value: settings.loginLogo },
                { key: 'system_logo_menu', value: settings.menuLogo },
                { key: 'default_customer_avatar', value: settings.defaultCustomerAvatar },
            ].filter(i => i.value !== null); // Only save what we have

            const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });

            if (error) throw error;
            setMsg({ type: 'success', text: "Đã lưu tất cả cấu hình logo thành công!" });
        } catch (error: any) {
            setMsg({ type: 'error', text: "Lỗi lưu cấu hình: " + error.message });
        } finally {
            setSaving(false);
        }
    };

    const ImageUploader = ({ type, label, icon: Icon, value, desc }: { type: LogoType, label: string, icon: any, value: string | null, desc: string }) => (
        <div className="flex flex-col items-center gap-3 p-4 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 w-full justify-center">
                <Icon size={16} className="text-primary-600" /> {label}
            </div>

            <div className="w-32 h-32 rounded-2xl bg-white border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group shadow-sm">
                {value ? (
                    <img src={value} alt={`${type} Preview`} className="w-24 h-24 object-contain" />
                ) : (
                    <span className="text-gray-400 text-xs text-center px-2">Chưa có<br />Ảnh</span>
                )}
                {uploading[type] && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                        <Loader2 className="animate-spin text-primary-600" />
                    </div>
                )}
            </div>

            <label className="cursor-pointer px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">
                <Upload size={14} /> Chọn ảnh
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, type)} disabled={uploading[type]} />
            </label>
            <p className="text-[10px] text-gray-400 text-center max-w-[180px] h-8">{desc}</p>
        </div>
    );

    const sqlScript = `
-- Tạo bucket system-assets
insert into storage.buckets (id, name, public) 
values ('system-assets', 'system-assets', true)
on conflict (id) do nothing;

-- Policy cho phép public xem
create policy "Public Access" 
on storage.objects for select 
using ( bucket_id = 'system-assets' );

-- Policy cho phép authenticated user upload
create policy "Authenticated Upload" 
on storage.objects for insert 
to authenticated 
with check ( bucket_id = 'system-assets' );
`;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2 pb-4 border-b border-gray-100">
                <ImageIcon className="text-primary-600" /> Cấu hình Thương hiệu (Logo & Favicon)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <ImageUploader
                    type="favicon"
                    label="Favicon (Tab Web)"
                    icon={LayoutTemplate}
                    value={settings.favicon}
                    desc="Icon nhỏ trên tab trình duyệt. Nên dùng ảnh vuông, 64x64px."
                />
                <ImageUploader
                    type="login"
                    label="Logo Trang Login"
                    icon={LogIn}
                    value={settings.loginLogo}
                    desc="Hiển thị ở trang đăng nhập. Nên dùng ảnh trong suốt, kích thước lớn."
                />
                <ImageUploader
                    type="menu"
                    label="Logo Menu (Góc trái)"
                    icon={LayoutTemplate}
                    value={settings.menuLogo}
                    desc="Hiển thị trên thanh menu chính. Nên dùng ảnh vuông hoặc chữ nhật nhỏ."
                />
            </div>

            {/* Customer Avatar Config */}
            <div className="mb-8 border-t border-gray-100 pt-6">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={16} className="text-blue-600" /> Avatar Khách hàng Mặc định</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ImageUploader
                        type="customer_avatar"
                        label="Avatar Mặc định"
                        icon={User}
                        value={settings.defaultCustomerAvatar}
                        desc="Thay thế avatar chữ cái mặc định. Nên dùng ảnh vuông, trong suốt."
                    />
                    <div className="col-span-2 bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600">
                        <p className="font-bold mb-2">Thông tin:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Ảnh này sẽ hiển thị cho tất cả khách hàng thay vì chữ cái đầu tiên của tên.</li>
                            <li>Kích thước tối đa: <strong>1MB</strong>.</li>
                            <li>Định dạng khuyên dùng: <strong>PNG, JPG (Vuông 128x128px)</strong>.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <h4 className="font-bold text-blue-900 text-sm mb-1">Lưu ý</h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                        Các thay đổi về hình ảnh thương hiệu sẽ áp dụng cho <strong>toàn bộ người dùng</strong> sau khi họ tải lại trang.
                    </p>
                </div>

                {msg && (
                    <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {msg.text}
                    </div>
                )}

                {msg?.text?.includes('Bucket') && (
                    <div className="bg-gray-900 text-green-400 p-3 rounded-xl text-xs font-mono overflow-x-auto relative">
                        <pre>{sqlScript}</pre>
                        <button onClick={() => navigator.clipboard.writeText(sqlScript)} className="absolute top-2 right-2 p-1 bg-white/10 hover:bg-white/20 rounded text-white text-[10px]">Copy SQL</button>
                    </div>
                )}

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving || Object.values(uploading).some(Boolean)}
                        className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Lưu Thay Đổi
                    </button>
                </div>
            </div>

            {/* Force Update Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Bell className="text-orange-500" /> Thông báo Bắt buộc Cập nhật
                </h3>

                <div className={`p-5 rounded-2xl border-2 ${forceUpdate ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-900">
                                {forceUpdate ? '🔴 Đang bật thông báo' : '⚪ Thông báo đang tắt'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                {forceUpdate
                                    ? 'Tất cả user sẽ thấy popup bắt buộc cập nhật khi mở app'
                                    : 'User có thể sử dụng bình thường'}
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                setForceUpdateSaving(true);
                                const newValue = !forceUpdate;
                                try {
                                    const { error } = await supabase
                                        .from('app_settings')
                                        .upsert({ key: 'force_update', value: newValue.toString() }, { onConflict: 'key' });
                                    if (error) throw error;
                                    setForceUpdate(newValue);
                                    setMsg({ type: 'success', text: newValue ? 'Đã BẬT thông báo cập nhật!' : 'Đã TẮT thông báo cập nhật' });
                                } catch (e: any) {
                                    setMsg({ type: 'error', text: 'Lỗi: ' + e.message });
                                } finally {
                                    setForceUpdateSaving(false);
                                }
                            }}
                            disabled={forceUpdateSaving}
                            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${forceUpdate
                                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200'
                                } disabled:opacity-50`}
                        >
                            {forceUpdateSaving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <RefreshCw size={18} />
                            )}
                            {forceUpdate ? 'Tắt thông báo' : 'Bật thông báo'}
                        </button>
                    </div>

                    {forceUpdate && (
                        <div className="mt-4 p-3 bg-orange-100 rounded-xl text-sm text-orange-800">
                            <strong>⚠️ Lưu ý:</strong> User sẽ không thể sử dụng app cho đến khi nhấn "Đồng ý" (reload trang).
                            Sau khi deploy xong phiên bản mới, hãy TẮT thông báo này.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsPanel;

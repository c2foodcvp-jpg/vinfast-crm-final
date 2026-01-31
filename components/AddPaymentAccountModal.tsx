import React, { useState } from 'react';
import { X, Upload, Loader2, User, FileText, QrCode } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { PaymentAccount, TIER_ACCOUNT_LIMITS } from '../types';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: (account: PaymentAccount) => void;
    currentCount: number;
}

const AddPaymentAccountModal: React.FC<Props> = ({ visible, onClose, onSuccess, currentCount }) => {
    const { userProfile } = useAuth();
    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Get tier limit
    const tierName = userProfile?.member_tier || 'Member';
    const maxAccounts = TIER_ACCOUNT_LIMITS[tierName] || 1;
    const canAdd = currentCount < maxAccounts;

    const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        if (file.size > 1024 * 1024) { // 1MB
            setError('File quá lớn! Vui lòng chọn ảnh dưới 1MB.');
            return;
        }

        setUploading(true);
        setError('');

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `qr_${userProfile?.id}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('images').getPublicUrl(fileName);
            setQrCodeUrl(data.publicUrl);
        } catch (err: any) {
            setError('Lỗi upload: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Vui lòng nhập họ và tên');
            return;
        }

        if (!canAdd) {
            setError(`Đã đạt giới hạn ${maxAccounts} tài khoản cho hạng ${tierName}`);
            return;
        }

        setSaving(true);
        setError('');

        try {
            const { data, error: insertError } = await supabase
                .from('payment_accounts')
                .insert({
                    user_id: userProfile?.id,
                    name: name.trim(),
                    content: content.trim() || null,
                    qr_code_url: qrCodeUrl || null,
                    is_default: currentCount === 0 // First account is default
                })
                .select()
                .single();

            if (insertError) throw insertError;

            onSuccess(data as PaymentAccount);
            onClose();
        } catch (err: any) {
            setError('Lỗi lưu: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <QrCode className="text-white" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Thêm tài khoản</h2>
                            <p className="text-blue-100 text-xs">Đóng tiền đăng ký xe</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Tier Limit Info */}
                <div className="px-5 pt-4">
                    <div className={`text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${canAdd ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {currentCount}/{maxAccounts} tài khoản ({tierName})
                    </div>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                            <User size={14} /> Họ và Tên <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Nguyễn Văn A"
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                            <FileText size={14} /> Nội dung chuyển khoản
                        </label>
                        <input
                            type="text"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="VD: Thanh toán phí đăng ký xe..."
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        />
                    </div>

                    {/* QR Upload */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                            <QrCode size={14} /> Ảnh mã QR (Max 1MB)
                        </label>
                        <div className="flex items-center gap-4">
                            {qrCodeUrl ? (
                                <img src={qrCodeUrl} alt="QR Preview" className="w-20 h-20 rounded-xl object-cover border-2 border-blue-200" />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                                    <QrCode size={28} className="text-gray-300" />
                                </div>
                            )}
                            <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer px-4 py-3 rounded-xl text-sm font-bold transition-all ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'}`}>
                                {uploading ? (
                                    <><Loader2 size={16} className="animate-spin" /> Đang tải...</>
                                ) : (
                                    <><Upload size={16} /> {qrCodeUrl ? 'Thay đổi' : 'Tải lên'}</>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={handleQRUpload} disabled={uploading} />
                            </label>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                            {error}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-5 pb-5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !canAdd}
                        className={`flex-1 py-3 px-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${saving || !canAdd ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-200'}`}
                    >
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : 'Lưu tài khoản'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddPaymentAccountModal;

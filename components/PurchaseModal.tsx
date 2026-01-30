import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, Shield, Gem, Star, Crown, Zap } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface PurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPackage: 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'TRIAL';
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ isOpen, onClose, selectedPackage }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Get Config
            const { data: settings } = await supabase
                .from('app_settings')
                .select('key, value')
                .eq('key', 'email_script_url')
                .maybeSingle();

            const scriptUrl = settings?.value;
            const adminEmail = 'nguyen.hocao@gmail.com';

            if (!scriptUrl) {
                alert('Lỗi: Chưa cấu hình email script url.');
                return;
            }

            // 2. Prepare Email Content
            const emailBody = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-top: 0;">YEU CAU DANG KY: ${selectedPackage}</h2>
                    <p>Khách hàng muốn đăng ký gói bản quyền <strong>${selectedPackage}</strong>:</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; width: 120px; font-weight: bold;">Gói Dịch Vụ:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #d02626; font-weight: bold; font-size: 16px;">${selectedPackage}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Họ tên:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Số điện thoại:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.phone}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.email}</td>
                        </tr>
                    </table>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">Yêu cầu được gửi từ trang Landing Page.</p>
                </div>
            `;

            // 3. Send Request
            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    type: 'send_email',
                    recipientEmail: adminEmail,
                    subject: `[MUA APP] Don hang moi: ${selectedPackage} - ${formData.name}`,
                    htmlBody: emailBody
                })
            });

            if (!response.ok) throw new Error('Network error');
            const result = await response.json();

            if (result.success) {
                alert('✅ Đăng ký thành công!\nChúng tôi đã nhận được yêu cầu và sẽ liên hệ kích hoạt sớm nhất.');
                onClose();
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error(error);
            alert('Lỗi gửi yêu cầu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getPackageColor = () => {
        if (selectedPackage === 'GOLD') return 'text-yellow-500 border-yellow-500';
        if (selectedPackage === 'PLATINUM') return 'text-blue-400 border-blue-400';
        if (selectedPackage === 'TRIAL') return 'text-emerald-400 border-emerald-400';
        return 'text-cyan-400 border-cyan-400';
    };

    const getPackageIcon = () => {
        if (selectedPackage === 'GOLD') return <Star className="text-yellow-500" size={24} fill="currentColor" />;
        if (selectedPackage === 'PLATINUM') return <Crown className="text-blue-400" size={24} fill="currentColor" />;
        if (selectedPackage === 'TRIAL') return <Zap className="text-emerald-400" size={24} fill="currentColor" />;
        return <Gem className="text-cyan-400" size={24} />;
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#1E293B] border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 bg-slate-900/50 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            Đăng ký Mua Phần mềm
                        </h3>
                        <p className="text-sm text-gray-400">Điền thông tin để kích hoạt tài khoản</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Selected Package Badge */}
                    <div className={`flex items-center gap-3 p-4 mb-6 rounded-xl border bg-slate-800/50 ${getPackageColor()}`}>
                        {getPackageIcon()}
                        <div>
                            <div className="text-xs text-gray-400 uppercase font-bold">Gói đang chọn</div>
                            <div className="font-bold text-lg text-white">{selectedPackage}</div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-400">Họ và Tên <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="text"
                                className="w-full bg-slate-800 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                placeholder="Nguyễn Văn A"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-400">Số điện thoại / Zalo <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="tel"
                                className="w-full bg-slate-800 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                placeholder="0909 xxx xxx"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-400">Email (để nhận tài khoản) <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="email"
                                className="w-full bg-slate-800 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                placeholder="email@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                            Xác nhận Đăng ký
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PurchaseModal;

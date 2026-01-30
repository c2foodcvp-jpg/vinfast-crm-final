import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, Phone, User } from 'lucide-react';
import { supabase } from '../supabaseClient';

const SupportWidget = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contact: '',
        message: 'Tôi quan tâm và muốn mua bản quyền phần mềm CRM này. Vui lòng tư vấn.'
    });

    // Config: Only show on Authenticate pages
    const allowedPath = ['/login', '/register', '/update-password', '/intro'];
    const shouldShow = allowedPath.includes(location.pathname);

    if (!shouldShow) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Get Config
            const { data: settings } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['email_script_url', 'admin_notification_email']);

            const scriptUrl = settings?.find(s => s.key === 'email_script_url')?.value;
            // FIXED: Send requests to this specific email
            const adminEmail = 'nguyen.hocao@gmail.com';

            if (!scriptUrl) {
                alert('Lỗi: Chưa cấu hình email_script_url trong hệ thống.');
                return;
            }

            // 2. Prepare Payload (NO EMOJIS in Subject/Body to avoid font issues)
            const emailBody = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-top: 0;">YEU CAU MUA PHAN MEM MOI</h2>
                    <p>Có một khách hàng vừa để lại thông tin liên hệ:</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; width: 120px; font-weight: bold;">Họ tên:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${formData.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">SĐT/Zalo:</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #d02626; font-weight: bold;">${formData.contact}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold;">Lời nhắn:</td>
                            <td style="padding: 8px;">${formData.message}</td>
                        </tr>
                    </table>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">Email được gửi từ Widget hỗ trợ trên website.</p>
                </div>
            `;

            // 3. Send
            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    type: 'send_email',
                    recipientEmail: adminEmail, // Fixed Admin Email
                    subject: `[LIEN HE MUA APP] Khach hang ${formData.name} - ${formData.contact}`, // No special chars
                    htmlBody: emailBody
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const result = await response.json();
            if (result.success) {
                alert('Gửi yêu cầu thành công! Chúng tôi sẽ liên hệ lại sớm nhất.');
                setIsOpen(false);
                setFormData({ ...formData, message: 'Tôi quan tâm và muốn mua bản quyền phần mềm CRM này. Vui lòng tư vấn.' });
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error(error);
            alert('Có lỗi xảy ra: ' + (error.message || 'Vui lòng thử lại sau'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
            {/* Chat Form */}
            {isOpen && (
                <div className="mb-4 w-80 bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex justify-between items-center text-white">
                        <div>
                            <h3 className="font-bold text-lg">Liên hệ Admin</h3>
                            <p className="text-xs text-blue-100 opacity-90">Hỗ trợ & Mua bản quyền</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Họ và Tên</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    placeholder="Nguyễn Văn A"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Số điện thoại / Zalo</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-gray-900"
                                    placeholder="0912 xxx xxx"
                                    value={formData.contact}
                                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Nội dung</label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all h-24 resize-none"
                                value={formData.message}
                                onChange={e => setFormData({ ...formData, message: e.target.value })}
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            Gửi yêu cầu
                        </button>
                    </form>
                    <div className="bg-gray-50 p-2 text-center text-[10px] text-gray-400 border-t">
                        Powered by VinFast CRM
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`${isOpen ? 'rotate-90 bg-gray-200 text-gray-600' : 'bg-blue-600 text-white shadow-blue-600/40 hover:scale-110'} shadow-xl p-4 rounded-full transition-all duration-300 flex items-center justify-center`}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={28} fill="currentColor" />}
            </button>
        </div>
    );
};

export default SupportWidget;


import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, CAR_MODELS as DEFAULT_CAR_MODELS, CustomerStatus, CustomerClassification, Customer } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { X, Loader2, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';

interface AddCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { userProfile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [carList, setCarList] = useState<string[]>(DEFAULT_CAR_MODELS);

    // Form State isolated here to prevent parent re-renders
    const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const initialFormState = {
        name: '', phone: '', location: '', source: 'MKT Group', source_detail: '', interest: '',
        notes: '', isZaloOnly: false, recare_date: todayStr, classification: 'Warm' as CustomerClassification
    };
    const [formData, setFormData] = useState(initialFormState);

    // Duplicate Check State
    const [isDuplicateWarningOpen, setIsDuplicateWarningOpen] = useState(false);
    const [duplicateData, setDuplicateData] = useState<{ id: string, name: string, sales_rep: string, phone: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchCarModels();
            setFormData(initialFormState); // Reset form on open
            setIsDuplicateWarningOpen(false);
            setDuplicateData(null);
        }
    }, [isOpen]);

    const fetchCarModels = async () => {
        try {
            const { data } = await supabase.from('car_models').select('name').order('priority', { ascending: true });
            if (data && data.length > 0) {
                setCarList(data.map(c => c.name));
            }
        } catch (e) { console.error("Error fetching car models", e); }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleZaloOnly = () => {
        setFormData(prev => ({ ...prev, isZaloOnly: !prev.isZaloOnly }));
    }

    const normalizePhone = (p: string) => {
        if (!p) return '';
        return p.toString().replace(/\D/g, '');
    };

    const sendNewCustomerWebhook = async (customer: Customer, notes: string) => {
        let webhookUrl = localStorage.getItem('vinfast_crm_discord_webhook_new_lead');
        if (!webhookUrl) {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'discord_webhook_new_lead').maybeSingle();
            if (data) webhookUrl = data.value;
        }
        if (!webhookUrl) return;
        try {
            await fetch(webhookUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    username: "Thông báo Khách Mới",
                    embeds: [{
                        title: "🔥 CÓ KHÁCH HÀNG MỚI!",
                        description: `**${customer.name}** vừa được thêm vào hệ thống.`,
                        color: 5763719,
                        fields: [
                            { name: "📞 SĐT", value: customer.phone, inline: true },
                            { name: "🚗 Quan tâm", value: customer.interest || 'Chưa rõ', inline: true },
                            { name: "📍 Khu vực", value: customer.location || 'Chưa rõ', inline: true },
                            { name: "📝 Ghi chú", value: notes || "Không có", inline: false },
                            { name: "👤 Người tạo", value: userProfile?.full_name || 'System', inline: true }
                        ]
                    }]
                })
            });
        } catch (e) { console.error("Discord Error", e); }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (userProfile?.is_locked_add) {
            alert("Bạn đã bị khóa quyền thêm khách mới.");
            return;
        }

        setIsSubmitting(true);
        if (!formData.name.trim()) { alert("Vui lòng nhập tên khách hàng"); setIsSubmitting(false); return; }
        if (!formData.isZaloOnly && !formData.phone.trim()) { alert("Vui lòng nhập số điện thoại"); setIsSubmitting(false); return; }

        try {
            let finalPhone = formData.phone;
            if (!formData.isZaloOnly) {
                // Remove non-digit characters to check length
                finalPhone = normalizePhone(formData.phone);

                // VALIDATION: Must be exactly 10 digits and start with '0'
                const phoneRegex = /^0\d{9}$/;
                if (!phoneRegex.test(finalPhone)) {
                    alert("Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số và bắt đầu bằng số 0.");
                    setIsSubmitting(false);
                    return;
                }

                // DUPLICATE CHECK
                const { data: existing } = await supabase.from('customers').select('id, name, sales_rep').eq('phone', finalPhone).maybeSingle();
                if (existing) {
                    setDuplicateData({ id: existing.id, name: existing.name, sales_rep: existing.sales_rep || "Chưa phân bổ", phone: finalPhone });
                    setIsDuplicateWarningOpen(true);
                    setIsSubmitting(false);
                    return;
                }
            } else {
                finalPhone = 'Zalo-' + Date.now().toString().slice(-6);
            }
            await executeAddCustomer(finalPhone);
        } catch (err: any) {
            alert("Lỗi thêm khách: " + err.message);
            setIsSubmitting(false);
        }
    };

    const executeAddCustomer = async (finalPhone: string) => {
        try {
            const payload: any = {
                name: formData.name, phone: finalPhone, location: formData.location,
                source: formData.source === 'Khác' || formData.source === 'Giới Thiệu' ? `${formData.source}: ${formData.source_detail}` : formData.source,
                interest: formData.interest || null, status: CustomerStatus.NEW,
                classification: formData.classification, recare_date: formData.recare_date,
                creator_id: userProfile?.id, sales_rep: userProfile?.full_name,
                is_special_care: false, is_long_term: false, created_at: new Date().toISOString()
            };
            const { data, error } = await supabase.from('customers').insert([payload]).select();
            if (error) throw error;
            if (data && data[0]) {
                await supabase.from('interactions').insert([{
                    customer_id: data[0].id, user_id: userProfile?.id, type: 'note',
                    content: `Khách hàng mới được tạo. Ghi chú: ${formData.notes}`,
                    created_at: new Date().toISOString()
                }]);

                // Webhook logic kept but non-blocking for UI
                sendNewCustomerWebhook(data[0] as Customer, formData.notes);

                setFormData(initialFormState);
                setIsDuplicateWarningOpen(false);
                setDuplicateData(null);
                onSuccess(); // Trigger parent refresh
                onClose(); // Close modal
                // alert("Thêm khách hàng thành công!"); // Optional: Parent handles toast/alert
            }
        } catch (err: any) { alert("Lỗi thêm khách: " + err.message); } finally { setIsSubmitting(false); }
    };

    const handleRequestTransfer = async () => {
        if (!duplicateData || !userProfile) return;
        setIsSubmitting(true);
        try {
            await supabase.from('customers').update({ pending_transfer_to: userProfile.id }).eq('id', duplicateData.id);
            await supabase.from('interactions').insert([{
                customer_id: duplicateData.id, user_id: userProfile.id, type: 'note',
                content: `⚠️ Yêu cầu chuyển quyền chăm sóc từ ${userProfile.full_name}.`,
                created_at: new Date().toISOString()
            }]);
            alert("Đã gửi yêu cầu chuyển quyền chăm sóc cho Admin/Mod!");
            setIsDuplicateWarningOpen(false);
            setDuplicateData(null);
            setFormData(initialFormState);
            onClose();
        } catch (e) { alert("Lỗi khi gửi yêu cầu."); } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
                    <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-bold text-gray-900">Thêm khách hàng mới</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                    <form onSubmit={handleAddCustomer} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Họ tên <span className="text-red-500">*</span></label><input name="name" required value={formData.name} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 font-medium" placeholder="Nguyễn Văn A" /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label><input name="phone" type="tel" value={formData.phone} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 font-medium" placeholder="0912..." disabled={formData.isZaloOnly} /></div>
                        </div>
                        <div className="flex items-center gap-2"><input type="checkbox" id="zaloOnly" checked={formData.isZaloOnly} onChange={toggleZaloOnly} className="w-4 h-4 text-primary-600 rounded" /><label htmlFor="zaloOnly" className="text-sm text-gray-700 font-medium cursor-pointer">Khách chỉ liên hệ qua Zalo</label></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Dòng xe quan tâm</label><div className="relative"><select name="interest" value={formData.interest} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 appearance-none cursor-pointer"><option value="">-- Chưa xác định --</option>{carList.map(m => <option key={m} value={m}>{m}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} /></div></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Khu vực</label><input name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500" placeholder="Quận 1, TP.HCM" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className={(formData.source === 'Khác' || formData.source === 'Giới Thiệu') ? "" : "col-span-2"}><label className="block text-sm font-bold text-gray-700 mb-1">Nguồn khách</label><div className="relative"><select name="source" value={formData.source} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 appearance-none cursor-pointer"><option value="MKT Group">MKT Group</option><option value="Showroom">Showroom</option><option value="Hotline">Hotline</option><option value="Sự kiện">Sự kiện</option><option value="Giới Thiệu">Giới Thiệu</option><option value="Khác">Khác</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} /></div></div>
                            {(formData.source === 'Khác' || formData.source === 'Giới Thiệu') && (<div><label className="block text-sm font-bold text-gray-700 mb-1">Chi tiết nguồn</label><input name="source_detail" value={formData.source_detail} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500" placeholder="Nhập chi tiết..." /></div>)}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Phân loại</label><div className="relative"><select name="classification" value={formData.classification} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 appearance-none cursor-pointer"><option value="Hot">Hot</option><option value="Warm">Warm</option><option value="Cool">Cool</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} /></div></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Ngày CS tiếp theo</label><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /><input name="recare_date" type="date" min={todayStr} value={formData.recare_date} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500" /></div></div>
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú ban đầu</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-3 outline-none focus:border-primary-500 h-24 resize-none" placeholder="Khách hàng quan tâm vấn đề gì..." /></div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-gray-700 font-bold bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Hủy</button>
                            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 text-white font-bold bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="animate-spin" size={18} />} Thêm mới</button>
                        </div>
                    </form>
                </div>
            </div>

            {isDuplicateWarningOpen && duplicateData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl transform scale-100 transition-all border border-red-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                                <AlertTriangle className="text-red-600" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Cảnh báo Trùng lặp!</h3>
                            <p className="text-sm text-gray-500 mb-6">Số điện thoại <span className="font-bold text-gray-900">{duplicateData.phone}</span> đã tồn tại trên hệ thống.</p>
                            <div className="w-full bg-red-50 rounded-xl p-4 border border-red-100 mb-6 text-left space-y-2">
                                <div className="flex justify-between items-center border-b border-red-200 pb-2"><span className="text-xs font-bold text-red-500 uppercase">Khách hàng cũ</span></div>
                                <div><p className="text-xs text-gray-500">Họ tên</p><p className="font-bold text-gray-900">{duplicateData.name}</p></div>
                                <div><p className="text-xs text-gray-500">Đang thuộc về TVBH</p><p className="font-bold text-red-600 uppercase">{duplicateData.sales_rep}</p></div>
                            </div>
                            <div className="flex flex-col gap-3 w-full">
                                <button onClick={handleRequestTransfer} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Yêu cầu chăm sóc Khách hàng này'}</button>
                                <button onClick={() => { setIsDuplicateWarningOpen(false); setDuplicateData(null); setIsSubmitting(false); }} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AddCustomerModal;


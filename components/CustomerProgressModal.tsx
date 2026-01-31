import React, { useState, useEffect, useMemo } from 'react';
import { Customer, DeliveryProgress, MembershipTier, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, Circle, X, History, Truck, CarFront, BadgeDollarSign, ExternalLink, Calendar, Mail, Loader2 } from 'lucide-react';
import { Transaction } from '../types';
import { useNavigate } from 'react-router-dom';

interface Props {
    customer: Customer;
    visible: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

export const DELIVERY_STEPS = [
    { key: 'deposited', label: 'Đã cọc', description: 'Khách hàng đã đặt cọc xe' },
    { key: 'contract_signed', label: 'Lên hợp đồng', description: 'Ký hợp đồng mua bán' },
    { key: 'bank_approved', label: 'Đã xong ngân hàng', description: 'Ngân hàng ra thông báo cho vay', condition: (c: Customer) => c.deal_details?.payment_method === 'Ngân hàng' },
    { key: 'payment_invoice', label: 'Đóng tiền XHĐ', description: 'Khách đóng tiền để xuất hóa đơn' },
    { key: 'invoiced', label: 'Đã Xuất hoá đơn', description: 'Hoàn tất xuất hóa đơn GTGT' },
    { key: 'plate_registration', label: 'Bấm biển số', description: 'Hoàn tất đăng ký, bấm biển' },
    { key: 'accessories_pdi', label: 'Làm phụ kiện & PDI', description: 'Lắp phụ kiện và kiểm tra xe (PDI)' },
    { key: 'handover', label: 'Đã bàn giao xe', description: 'Giao xe cho khách hàng' },
    { key: 'collection_return', label: 'Đợi thu hồi tiền về', description: 'Chờ tiền giải ngân/tiền hàng về đủ' },
    { key: 'money_recovered', label: 'Đã thu hồi tiền', description: 'Tiền đã về đủ, hoàn tất quy trình' }
];

const CustomerProgressModal: React.FC<Props> = ({ customer, visible, onClose, onUpdate }) => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [progress, setProgress] = useState<DeliveryProgress>(customer.delivery_progress || {});
    const [activeTab, setActiveTab] = useState<'progress' | 'finance'>('progress');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    // EMAIL NOTIFICATION STATE (Diamond only can USE, but visible to all)
    const isDiamond = userProfile?.member_tier === MembershipTier.DIAMOND || userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.MOD;
    const [sendEmailNotification, setSendEmailNotification] = useState(() => {
        // Remember user preference from localStorage
        return localStorage.getItem('send_progress_email') === 'true';
    });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [showUpgradePopup, setShowUpgradePopup] = useState(false);

    // Save preference when toggled
    const toggleEmailNotification = () => {
        const newState = !sendEmailNotification;
        setSendEmailNotification(newState);
        localStorage.setItem('send_progress_email', String(newState));
    };

    useEffect(() => {
        if (customer.delivery_progress) {
            setProgress(customer.delivery_progress);
        } else {
            setProgress({});
        }
    }, [customer]);

    // Calculate applicable steps
    const applicableSteps = useMemo(() => {
        return DELIVERY_STEPS.filter(step => !step.condition || step.condition(customer));
    }, [customer]);

    // Local state for 'Waiting for Car'
    const [isWaitCar, setIsWaitCar] = useState(customer.deal_details?.car_availability === 'Đợi xe');

    useEffect(() => {
        setIsWaitCar(customer.deal_details?.car_availability === 'Đợi xe');
    }, [customer]);

    useEffect(() => {
        if (visible && activeTab === 'finance') {
            fetchTransactions();
        }
    }, [visible, activeTab, customer.id]);

    const fetchTransactions = async () => {
        setLoadingTransactions(true);
        try {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false });
            if (data) setTransactions(data as Transaction[]);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoadingTransactions(false);
        }
    };

    // Calculate completion percentage
    const percentComplete = useMemo(() => {
        if (isWaitCar) return 0; // If waiting for car, progress is not calculated
        if (applicableSteps.length === 0) return 0;
        const completedCount = applicableSteps.filter(step => progress[step.key]?.completed).length;
        return Math.round((completedCount / applicableSteps.length) * 100);
    }, [applicableSteps, progress, isWaitCar]);

    const handleToggleWaitCar = async () => {
        const newVal = !isWaitCar;
        setIsWaitCar(newVal);
        const newStatus = newVal ? 'Đợi xe' : 'Sẵn xe';

        try {
            // Update deal_details in DB
            // We need to fetch current deal_details first or assume customer.deal_details is fresh enough? 
            // Better to merge safely if possible, but for now we'll update the JSON column field if Supabase supports generic JSONB update or just replace the field in the object.
            // Since we are updating a specific row, allow existing fields to remain.

            const updatedDealDetails = {
                ...customer.deal_details,
                car_availability: newStatus
            };

            const { error } = await supabase
                .from('customers')
                .update({ deal_details: updatedDealDetails })
                .eq('id', customer.id);

            if (error) throw error;
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error("Error updating car availability:", err);
            setIsWaitCar(!newVal); // Revert on error
            alert("Lỗi cập nhật trạng thái xe: " + err.message);
        }
    };

    // Send email notification helper
    const sendProgressEmail = async (stepLabel: string) => {
        if (!customer.email || !sendEmailNotification) return;

        setSendingEmail(true);
        try {
            // Get email script URL from settings
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'email_script_url')
                .maybeSingle();

            const scriptUrl = settingData?.value;
            if (!scriptUrl) {
                console.warn('Email script URL not configured');
                return;
            }


            // Prepare PREMIUM email HTML template - Luxury Automotive Style
            const currentDate = new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const emailPayload = {
                type: 'send_email',
                recipientEmail: customer.email,
                subject: `[VinFast] Cập nhật tiến trình đơn hàng - ${customer.name}`,
                htmlBody: `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                    
                    <!-- Premium Header with Gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%); padding: 40px 40px 35px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">VINFAST</h1>
                                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase;">DRIVING THE FUTURE</p>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                        <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.15); border-radius: 50%; display: inline-block; text-align: center; line-height: 56px;">
                                            <span style="font-size: 24px; color: #ffffff;">V</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Date Badge -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-top: -20px; position: relative; z-index: 1; display: inline-block;">
                                <span style="color: #64748b; font-size: 13px; font-weight: 500;">${currentDate}</span>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 30px 40px 20px;">
                            <h2 style="margin: 0 0 8px; color: #1e293b; font-size: 22px; font-weight: 600;">Kính gửi Quý khách ${customer.name},</h2>
                            <p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.7;">
                                Lời đầu tiên, VinFast xin gửi đến Quý khách lời cảm ơn chân thành vì đã tin tưởng và lựa chọn VinFast là người bạn đồng hành trên mọi nẻo đường.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Progress Update Card -->
                    <tr>
                        <td style="padding: 10px 40px 25px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border-left: 4px solid #10b981;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 8px; color: #059669; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">CẬP NHẬT TIẾN TRÌNH</p>
                                        <h3 style="margin: 0; color: #065f46; font-size: 20px; font-weight: 700;">&#10004; ${stepLabel}</h3>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Message Body -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.8;">
                                Đây là một bước quan trọng trong hành trình sở hữu chiếc xe VinFast của Quý khách. Chúng tôi cam kết sẽ tiếp tục đồng hành và hỗ trợ Quý khách trong suốt quá trình này.
                            </p>
                            <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.8;">
                                Nếu Quý khách có bất kỳ thắc mắc hoặc cần hỗ trợ thêm, vui lòng liên hệ trực tiếp với Tư vấn viên phụ trách. Chúng tôi luôn sẵn sàng hỗ trợ Quý khách 24/7.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Consultant Card -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                                <tr>
                                    <td style="padding: 20px 24px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td width="48" style="vertical-align: top;">
                                                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #1e40af); border-radius: 50%; text-align: center; line-height: 48px; color: white; font-size: 18px; font-weight: 600;">
                                                        ${(userProfile?.full_name || 'V').charAt(0).toUpperCase()}
                                                    </div>
                                                </td>
                                                <td style="padding-left: 16px; vertical-align: top;">
                                                    <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Tư vấn viên phụ trách</p>
                                                    <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${userProfile?.full_name || 'VinFast Sales Consultant'}</p>
                                                    <p style="margin: 4px 0 0; color: #3b82f6; font-size: 14px;">VinFast Auto</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Thank You Section -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.7; font-style: italic; border-left: 3px solid #3b82f6; padding-left: 16px;">
                                "Sự hài lòng của Quý khách là niềm vinh dự và động lực lớn nhất của chúng tôi. Xin chân thành cảm ơn Quý khách!"
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Signature -->
                    <tr>
                        <td style="padding: 0 40px 35px;">
                            <p style="margin: 0; color: #1e293b; font-size: 15px;">
                                Trân trọng,<br/>
                                <strong style="color: #1e40af; font-size: 16px;">${userProfile?.full_name || 'VinFast Sales'}</strong>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #1e293b; padding: 30px 40px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px;">© 2024 VinFast Auto. All rights reserved.</p>
                                        <p style="margin: 0; color: #64748b; font-size: 11px;">Email này được gửi tự động từ hệ thống CRM VinFast.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
                `,
                senderName: userProfile?.full_name || 'VinFast Sales'
            };

            // Use text/plain to avoid CORS preflight (like OnlineQuote.tsx)
            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(emailPayload)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Progress email sent to:', customer.email);
                } else {
                    console.warn('Email send issue:', result.message);
                }
            } else {
                console.warn('Email response not ok:', response.status);
            }
        } catch (err) {
            console.error('Failed to send progress email:', err);
        } finally {
            setSendingEmail(false);
        }
    };

    const handleToggleStep = async (stepKey: string) => {
        const isCompleted = !progress[stepKey]?.completed;
        const newProgress = {
            ...progress,
            [stepKey]: {
                completed: isCompleted,
                timestamp: isCompleted ? new Date().toISOString() : undefined
            }
        };

        setProgress(newProgress);

        // Auto-save logic can be here, or use a "Save" button. 
        // User asked for "Check click", implying immediate interaction or simple flow.
        // Let's autosave for smooth UX, but maybe debounced? 
        // Or just save immediately since it's a critical state.

        try {
            const { error } = await supabase
                .from('customers')
                .update({ delivery_progress: newProgress })
                .eq('id', customer.id);

            if (error) throw error;
            if (onUpdate) onUpdate();

            // Send email notification if enabled and step was completed
            // Exclude financial/internal steps: collection_return, money_recovered
            const excludedFromEmail = ['collection_return', 'money_recovered'];
            if (isCompleted && sendEmailNotification && customer.email && !excludedFromEmail.includes(stepKey)) {
                const step = DELIVERY_STEPS.find(s => s.key === stepKey);
                if (step) sendProgressEmail(step.label);
            }
        } catch (err: any) {
            console.error("Error saving progress:", err);
            alert("Lỗi lưu tiến trình: " + err.message);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeTab === 'progress' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {activeTab === 'progress' ? <Truck size={24} /> : <BadgeDollarSign size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {activeTab === 'progress' ? 'Tiến trình giao xe' : 'Hoạt động thu chi'}
                            </h2>
                            <p className="text-sm text-gray-500 font-medium">{customer.name} - {customer.interest}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                onClose();
                                navigate(`/customers/${customer.id}`, { state: { from: '/calendar', calendarTab: 'orders' } });
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
                        >
                            <ExternalLink size={16} /> Chi tiết
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={20} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50/50 p-1 gap-1">
                    <button
                        onClick={() => setActiveTab('progress')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'progress' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                        <Truck size={16} /> Tiến trình
                    </button>
                    <button
                        onClick={() => setActiveTab('finance')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'finance' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                        <BadgeDollarSign size={16} /> Thu chi
                    </button>
                </div>

                {activeTab === 'progress' ? (
                    <>
                        {/* Email Notification Toggle - Visible to ALL, but only Diamond can use */}
                        {customer.email && (
                            <div className="px-4 pt-4">
                                <div
                                    onClick={() => {
                                        if (isDiamond) {
                                            toggleEmailNotification();
                                        } else {
                                            setShowUpgradePopup(true);
                                        }
                                    }}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${sendEmailNotification ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-200'}`}
                                >
                                    <div className={`w-6 h-6 rounded flex items-center justify-center border ${sendEmailNotification ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-300 text-transparent'}`}>
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className={`font-bold text-sm ${sendEmailNotification ? 'text-purple-800' : 'text-gray-700'}`}>
                                            Gửi email thông báo
                                            {sendingEmail && <Loader2 size={14} className="inline ml-2 animate-spin" />}
                                            {!isDiamond && <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-xs rounded-full font-bold">DIAMOND</span>}
                                        </h3>
                                        <p className="text-xs text-gray-500">Tự động gửi email cho khách khi cập nhật tiến trình</p>
                                    </div>
                                    <Mail size={20} className={sendEmailNotification ? 'text-purple-500' : 'text-gray-300'} />
                                </div>
                            </div>
                        )}

                        {/* Show hint if no email set */}
                        {!customer.email && (
                            <div className="px-4 pt-4">
                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                    <p className="text-xs text-gray-500">Thêm email khách hàng để bật tính năng gửi thông báo tiến trình</p>
                                </div>
                            </div>
                        )}

                        {/* Progress Bar Container */}
                        <div className="px-8 py-6 bg-white">
                            {/* Wait Car Toggle - Hide if Plate Registration is done */}
                            {!(progress['plate_registration']?.completed || progress['accessories_pdi']?.completed || progress['handover']?.completed) && (
                                <div
                                    onClick={handleToggleWaitCar}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all mb-4 ${isWaitCar ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-blue-200'}`}
                                >
                                    <div className={`w-6 h-6 rounded flex items-center justify-center border ${isWaitCar ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 text-transparent'}`}>
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className={`font-bold text-sm ${isWaitCar ? 'text-orange-800' : 'text-gray-700'}`}>Báo chờ xe (Đợi xe về)</h3>
                                        <p className="text-xs text-gray-500">Nếu chọn, tiến độ sẽ tạm dừng tính toán.</p>
                                    </div>
                                    <CarFront size={24} className={isWaitCar ? 'text-orange-500' : 'text-gray-300'} />
                                </div>
                            )}

                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span className="text-blue-600">Tiến độ hoàn thành</span>
                                <span className="text-blue-600">{percentComplete}%</span>
                            </div>
                            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className={`h-full transition-all duration-700 ease-out shadow-lg relative ${isWaitCar ? 'bg-gray-300' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                                    style={{ width: `${isWaitCar ? 100 : percentComplete}%` }}
                                >
                                </div>
                            </div>
                        </div>

                        {/* Steps List */}
                        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
                            {applicableSteps.map((step, index) => {
                                const isCompleted = progress[step.key]?.completed;
                                const timestamp = progress[step.key]?.timestamp;

                                // Check previous step completion
                                const isPreviousCompleted = index === 0 || progress[applicableSteps[index - 1].key]?.completed;
                                const isDisabled = !isPreviousCompleted;

                                return (
                                    <div
                                        key={step.key}
                                        onClick={() => {
                                            if (!isDisabled && !isCompleted) handleToggleStep(step.key);
                                        }}
                                        className={`
                                    group relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200
                                    ${isDisabled
                                                ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                                : isCompleted
                                                    ? 'border-green-100 bg-green-50/50 cursor-default'
                                                    : 'cursor-pointer border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                                            }
                                    ${isWaitCar ? 'opacity-50 grayscale pointer-events-none' : ''}
                                `}
                                    >
                                        <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300
                                    ${isCompleted
                                                ? 'bg-green-500 text-white shadow-green-200 shadow-md'
                                                : isDisabled
                                                    ? 'bg-gray-100 text-gray-300'
                                                    : 'bg-gray-200 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500'
                                            }
                                `}>
                                            {isCompleted ? <CheckCircle2 size={18} strokeWidth={3} /> : <Circle size={18} />}
                                        </div>

                                        <div className="flex-1">
                                            <h3 className={`font-bold text-base ${isCompleted ? 'text-green-800' : 'text-gray-700'}`}>
                                                {step.label}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-1">{step.description}</p>

                                            {isCompleted && timestamp && (
                                                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
                                                    <History size={12} />
                                                    Hoàn thành: {new Date(timestamp).toLocaleDateString('vi-VN')} {new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>

                                        {index < applicableSteps.length - 1 && (
                                            <div className={`absolute left-[31px] -bottom-6 w-0.5 h-6 -z-10 ${progress[step.key]?.completed ? 'bg-green-200' : 'bg-gray-200'}`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
                        {loadingTransactions ? (
                            <div className="text-center py-10 text-gray-500">Đang tải dữ liệu...</div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <BadgeDollarSign size={24} className="text-gray-300" />
                                </div>
                                <p>Chưa có giao dịch nào</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Summary Cards can go here if needed */}
                                {transactions.map((t) => {
                                    const isIncome = ['deposit', 'revenue', 'loan_repayment'].includes(t.type);
                                    return (
                                        <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${t.type === 'revenue' ? 'bg-green-100 text-green-700' :
                                                        t.type === 'deposit' ? 'bg-blue-100 text-blue-700' :
                                                            t.type === 'dealer_debt' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {t.type === 'revenue' ? 'Doanh thu' :
                                                            t.type === 'deposit' ? 'Tiền cọc' :
                                                                t.type === 'dealer_debt' ? 'Đại lý nợ' :
                                                                    t.type === 'incurred_expense' ? 'Chi phí' : t.type}
                                                    </span>
                                                    <p className="font-medium text-gray-800 mt-1">{t.reason}</p>
                                                </div>
                                                <span className={`font-bold text-lg ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isIncome ? '+' : '-'}{t.amount.toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-50 mt-1">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(t.created_at).toLocaleDateString('vi-VN')}</span>
                                                <span>{t.user_name}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Diamond Upgrade Popup */}
            {showUpgradePopup && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in">
                        {/* Header with gradient */}
                        <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-6 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-3xl">💎</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Tính năng Diamond</h3>
                        </div>

                        {/* Content */}
                        <div className="p-6 text-center">
                            <p className="text-gray-600 mb-2">
                                Tính năng <strong className="text-purple-600">Gửi email thông báo tự động</strong> chỉ dành cho thành viên hạng <strong className="text-amber-600">Diamond</strong>.
                            </p>
                            <p className="text-sm text-gray-500 mb-6">
                                Nâng cấp để mở khóa các tính năng độc quyền và nâng cao trải nghiệm bán hàng của bạn.
                            </p>

                            {/* Current tier badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full mb-6">
                                <span className="text-sm text-gray-600">Hạng hiện tại:</span>
                                <span className="font-bold text-gray-800">{userProfile?.member_tier || 'FREE'}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setShowUpgradePopup(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                            >
                                Đóng
                            </button>
                            <button
                                onClick={() => {
                                    setShowUpgradePopup(false);
                                    // TODO: Navigate to membership page when built
                                    alert('Tính năng nâng cấp hạng thành viên sẽ sớm ra mắt!');
                                }}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-200"
                            >
                                Nâng cấp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerProgressModal;

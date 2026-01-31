import React, { useState, useEffect } from 'react';
import { X, CreditCard, Receipt, CheckCircle2, Plus, Loader2, QrCode, AlertTriangle, Send, Pencil } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Customer, PaymentAccount, DEFAULT_REGISTRATION_FEES, TIER_ACCOUNT_LIMITS, Distributor, MembershipTier, UserRole } from '../types';
import AddPaymentAccountModal from './AddPaymentAccountModal';

interface Props {
    visible: boolean;
    customer: Customer;
    onClose: () => void;
    onComplete: () => void;
}

const PaymentNotificationModal: React.FC<Props> = ({ visible, customer, onClose, onComplete }) => {
    const { userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<'basic' | 'detailed'>('basic');
    const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [customerEmail, setCustomerEmail] = useState(customer.email || '');
    const [distributor, setDistributor] = useState<Distributor | null>(null);

    // Tier check
    const isDiamond = userProfile?.member_tier === MembershipTier.DIAMOND ||
        userProfile?.role === UserRole.ADMIN ||
        userProfile?.role === UserRole.MOD;
    const tierName = userProfile?.member_tier || 'Member';
    const maxAccounts = TIER_ACCOUNT_LIMITS[tierName] || 1;

    // EDITABLE CAR PRICES - Default values, user can change
    const [listPrice, setListPrice] = useState(500_000_000);
    const [totalDiscount, setTotalDiscount] = useState(50_000_000);
    const finalPrice = listPrice - totalDiscount;

    // EDITABLE REGISTRATION FEES - Default values from constants, user can change
    const [regTax, setRegTax] = useState(DEFAULT_REGISTRATION_FEES.tax);
    const [plateFee, setPlateFee] = useState(DEFAULT_REGISTRATION_FEES.plate_fee);
    const [roadFee, setRoadFee] = useState(DEFAULT_REGISTRATION_FEES.road_fee);
    const [inspectionFee, setInspectionFee] = useState(DEFAULT_REGISTRATION_FEES.inspection_book_fee);
    const [civilInsurance, setCivilInsurance] = useState(DEFAULT_REGISTRATION_FEES.civil_insurance);
    const [vehicleInsurance, setVehicleInsurance] = useState(Math.round(500_000_000 * 0.014)); // Default 1.4% of list price
    const [registrationService, setRegistrationService] = useState(DEFAULT_REGISTRATION_FEES.registration_service);

    // Calculate derived values
    const registrationTotal = regTax + plateFee + roadFee + inspectionFee + civilInsurance + vehicleInsurance + registrationService;

    // Editing state
    const [editingField, setEditingField] = useState<string | null>(null);

    // Fetch accounts and distributor
    useEffect(() => {
        if (visible) {
            fetchData();
        }
    }, [visible]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch payment accounts
            const { data: accountsData } = await supabase
                .from('payment_accounts')
                .select('*')
                .eq('user_id', userProfile?.id)
                .order('created_at', { ascending: true });

            if (accountsData) {
                setAccounts(accountsData as PaymentAccount[]);
                const defaultAcc = accountsData.find(a => a.is_default);
                if (defaultAcc) setSelectedAccountId(defaultAcc.id);
                else if (accountsData.length > 0) setSelectedAccountId(accountsData[0].id);
            }

            // Fetch distributor info
            if (customer.deal_details?.distributor) {
                const { data: distData } = await supabase
                    .from('distributors')
                    .select('*')
                    .eq('name', customer.deal_details.distributor)
                    .maybeSingle();
                if (distData) setDistributor(distData as Distributor);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => amount.toLocaleString('vi-VN') + 'đ';
    const parseCurrency = (value: string) => parseInt(value.replace(/\D/g, '')) || 0;

    // Editable number input component
    const EditableField = ({ label, value, onChange, fieldKey }: { label: string; value: number; onChange: (v: number) => void; fieldKey: string }) => (
        <div className="flex justify-between items-center">
            <span className="text-gray-600">{label}</span>
            {editingField === fieldKey ? (
                <input
                    type="text"
                    value={value.toLocaleString('vi-VN')}
                    onChange={e => onChange(parseCurrency(e.target.value))}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={e => e.key === 'Enter' && setEditingField(null)}
                    autoFocus
                    className="w-32 text-right font-bold border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none"
                />
            ) : (
                <span
                    className="font-medium cursor-pointer hover:bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1"
                    onClick={() => setEditingField(fieldKey)}
                >
                    {formatCurrency(value)}
                    <Pencil size={12} className="text-gray-400" />
                </span>
            )}
        </div>
    );

    const handleAddAccountSuccess = (newAccount: PaymentAccount) => {
        setAccounts(prev => [...prev, newAccount]);
        setSelectedAccountId(newAccount.id);
    };

    const handleSend = async () => {
        if (!customerEmail) {
            alert('Vui lòng nhập email khách hàng');
            return;
        }

        const selectedAccount = accounts.find(a => a.id === selectedAccountId);

        setSending(true);
        try {
            // Update customer email if changed
            if (customerEmail !== customer.email) {
                await supabase
                    .from('customers')
                    .update({ email: customerEmail })
                    .eq('id', customer.id);
            }

            // Get email script URL
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'email_script_url')
                .maybeSingle();

            const scriptUrl = settingData?.value;
            if (!scriptUrl) {
                alert('Chưa cấu hình Email Script URL');
                setSending(false);
                return;
            }

            // Build email content
            const currentDate = new Date().toLocaleDateString('vi-VN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const basicContent = `
                <tr>
                    <td style="padding: 20px; background: #f8fafc; border-radius: 12px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 16px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>[THÔNG TIN TIỀN XE]</strong> Chi Phí Thanh Toán Tiền Xe</h3>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #2563eb; font-family: 'Segoe UI', Arial, sans-serif;">${formatCurrency(finalPrice)}</p>
                    </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                    <td style="padding: 20px; background: #f0fdf4; border-radius: 12px;">
                        <h3 style="margin: 0 0 12px; color: #166534; font-size: 16px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>[THÔNG TIN TIỀN ĐĂNG KÝ XE]</strong> Chi Phí Đăng Ký Xe</h3>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #16a34a; font-family: 'Segoe UI', Arial, sans-serif;">${formatCurrency(registrationTotal)}</p>
                    </td>
                </tr>
            `;

            const detailedContent = `
                <tr>
                    <td style="padding: 20px; background: #f8fafc; border-radius: 12px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>[TIỀN XE]</strong> Chi Tiết Tiền Xe</h3>
                        <table width="100%" cellspacing="0" cellpadding="4" style="font-family: 'Segoe UI', Arial, sans-serif;">
                            <tr><td style="color: #64748b;">Giá niêm yết</td><td align="right" style="font-weight: 600;">${formatCurrency(listPrice)}</td></tr>
                            <tr><td style="color: #64748b;">Tổng ưu đãi</td><td align="right" style="font-weight: 600; color: #dc2626;">-${formatCurrency(totalDiscount)}</td></tr>
                            <tr style="border-top: 1px solid #e2e8f0;"><td style="color: #1e293b; font-weight: 700; padding-top: 8px;">GIÁ SAU KHUYẾN MÃI</td><td align="right" style="font-weight: 700; color: #2563eb; font-size: 18px; padding-top: 8px;">${formatCurrency(finalPrice)}</td></tr>
                        </table>
                    </td>
                </tr>
                <tr><td style="height: 16px;"></td></tr>
                <tr>
                    <td style="padding: 20px; background: #f0fdf4; border-radius: 12px;">
                        <h3 style="margin: 0 0 16px; color: #166534; font-size: 16px; border-bottom: 2px solid #bbf7d0; padding-bottom: 8px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>[ĐĂNG KÝ</strong> Chi Tiết Chi Phí Đăng Ký Xe</h3>
                        <table width="100%" cellspacing="0" cellpadding="4" style="font-family: 'Segoe UI', Arial, sans-serif;">
                            <tr><td style="color: #64748b;">Thuế bạ</td><td align="right" style="font-weight: 600;">${formatCurrency(regTax)}</td></tr>
                            <tr><td style="color: #64748b;">Lệ phí đăng ký biển số</td><td align="right" style="font-weight: 600;">${formatCurrency(plateFee)}</td></tr>
                            <tr><td style="color: #64748b;">Phí đường bộ</td><td align="right" style="font-weight: 600;">${formatCurrency(roadFee)}</td></tr>
                            <tr><td style="color: #64748b;">Lệ phí cấp sổ đăng kiểm</td><td align="right" style="font-weight: 600;">${formatCurrency(inspectionFee)}</td></tr>
                            <tr><td style="color: #64748b;">Bảo hiểm TNDS</td><td align="right" style="font-weight: 600;">${formatCurrency(civilInsurance)}</td></tr>
                            <tr><td style="color: #64748b;">Bảo hiểm vật chất xe</td><td align="right" style="font-weight: 600;">${formatCurrency(vehicleInsurance)}</td></tr>
                            <tr><td style="color: #64748b;">Dịch vụ đăng ký xe</td><td align="right" style="font-weight: 600;">${formatCurrency(registrationService)}</td></tr>
                            <tr style="border-top: 2px solid #bbf7d0;"><td style="color: #166534; font-weight: 700; padding-top: 8px;">TỔNG CHI PHÍ ĐĂNG KÝ</td><td align="right" style="font-weight: 700; color: #16a34a; font-size: 18px; padding-top: 8px;">${formatCurrency(registrationTotal)}</td></tr>
                        </table>
                    </td>
                </tr>
            `;

            const emailPayload = {
                type: 'send_email',
                recipientEmail: customerEmail,
                subject: `[VinFast] Thông tin đóng tiền - ${customer.name}`,
                htmlBody: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                    
                    <!-- New Header -->
                    <tr>
                        <td style="background-color: #3b82f6; padding: 30px; border-top-left-radius: 16px; border-top-right-radius: 16px;">
                            <table width="100%">
                                <tr>
                                    <td>
                                        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; font-family: 'Segoe UI', sans-serif;">VINFAST</h1>
                                        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 10px; letter-spacing: 2px; font-weight: 600; font-family: 'Segoe UI', sans-serif;">DRIVING THE FUTURE</p>
                                    </td>
                                    <td align="right">
                                        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; text-align: center; line-height: 40px; color: white; font-weight: bold; font-family: 'Segoe UI', sans-serif;">V</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Date Bubble -->
                    <tr>
                        <td style="padding: 20px 40px 0;">
                            <span style="background: #f1f5f9; color: #64748b; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-family: 'Segoe UI', sans-serif;">${currentDate}</span>
                        </td>
                    </tr>
                    
                    <!-- Greeting & Intro -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <h2 style="margin: 0; color: #1e293b; font-size: 20px; font-family: 'Segoe UI', sans-serif;">Kính gửi Quý khách ${customer.name},</h2>
                            <p style="margin: 12px 0 0; color: #475569; line-height: 1.7; font-family: 'Segoe UI', sans-serif;">
                                Lời đầu tiên, VinFast xin gửi đến Quý khách lời cảm ơn chân thành vì đã tin tưởng và lựa chọn VinFast là người bạn đồng hành trên mọi nẻo đường.
                            </p>
                        </td>
                    </tr>

                    <!-- Green Progress Box -->
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table width="100%" cellspacing="0" cellpadding="0" style="background: #dcfce7; border-radius: 12px; overflow: hidden;">
                                <tr>
                                    <td width="6" style="background: #059669;"></td>
                                    <td style="padding: 20px;">
                                         <p style="margin: 0 0 8px; color: #15803d; font-size: 11px; font-weight: 700; text-transform: uppercase; font-family: 'Segoe UI', sans-serif; letter-spacing: 0.5px;">CẬP NHẬT TIẾN TRÌNH</p>
                                         <h2 style="margin: 0; color: #14532d; font-size: 20px; font-family: 'Segoe UI', sans-serif;">✔️ Đóng tiền XHĐ</h2>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Intro 2 -->
                    <tr>
                         <td style="padding: 0 40px 20px;">
                            <p style="margin: 0; color: #475569; line-height: 1.7; font-family: 'Segoe UI', sans-serif;">
                                Đây là một bước quan trọng trong hành trình sở hữu chiếc xe VinFast của Quý khách. Chúng tôi cam kết sẽ tiếp tục đồng hành và hỗ trợ Quý khách trong suốt quá trình này.
                                <br><br>
                                Dưới đây là thông tin chi tiết để Quý khách thực hiện thanh toán:
                            </p>
                         </td>
                    </tr>
                    
                    <!-- Payment Details -->
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                ${activeTab === 'basic' ? basicContent : detailedContent}
                            </table>
                        </td>
                    </tr>
                    
                    <!-- QR Codes Section -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <!-- Car Payment QR (Distributor) -->
                                ${distributor?.image_url ? `
                                <tr>
                                    <td style="padding: 20px; background: #eff6ff; border-radius: 12px; margin-bottom: 12px;">
                                        <h4 style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>[THÔNG TIN THANH TOÁN TỀN XE]</strong></h4>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td width="120" style="vertical-align: top;">
                                                    <img src="${distributor.image_url}" alt="QR" style="width: 100px; height: 100px; border-radius: 8px; object-fit: cover;" />
                                                </td>
                                                <td style="padding-left: 16px; vertical-align: top; font-family: 'Segoe UI', Arial, sans-serif;">
                                                    <p style="margin: 0 0 8px; font-weight: 600; color: #1e293b;">${distributor.name}</p>
                                                    <p style="margin: 0; color: #64748b; font-size: 13px;">Noi dung: ${customer.name} thanh toan tien xe ${customer.interest || 'VinFast'}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr><td style="height: 12px;"></td></tr>
                                ` : ''}
                                
                                <!-- Registration Payment QR -->
                                ${selectedAccount?.qr_code_url ? `
                                <tr>
                                    <td style="padding: 20px; background: #f0fdf4; border-radius: 12px;">
                                        <h4 style="margin: 0 0 12px; color: #166534; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>[THÔNG TIN THANH TOÁN TIỀN ĐĂNG KÝ XE</strong></h4>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td width="120" style="vertical-align: top;">
                                                    <img src="${selectedAccount.qr_code_url}" alt="QR" style="width: 100px; height: 100px; border-radius: 8px; object-fit: cover;" />
                                                </td>
                                                <td style="padding-left: 16px; vertical-align: top; font-family: 'Segoe UI', Arial, sans-serif;">
                                                    <p style="margin: 0 0 8px; font-weight: 600; color: #1e293b;">${selectedAccount.name}</p>
                                                    ${selectedAccount.content ? `<p style="margin: 0; color: #64748b; font-size: 13px;">Noi dung: ${selectedAccount.content}</p>` : ''}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                ` : ''}
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Consultant Info -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; border: 1px solid #cbd5e1;">
                                <tr>
                                    <td style="padding: 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                                        <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">TƯ VẤN BÁN HÀNG PHỤ TRÁCH</p>
                                        <table width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td>
                                                    <p style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 700;">${userProfile?.full_name || 'VinFast Sales'}</p>
                                                </td>
                                                <td align="right">
                                                    <p style="margin: 0; color: #3b82f6; font-size: 16px; font-weight: 600;">${userProfile?.phone || ''}</p>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="margin: 8px 0 0; color: #64748b; font-size: 13px;">Nếu Quý khách có bất kỳ thắc mắc hoặc cần hỗ trợ thêm, vui lòng liên hệ trực tiếp với Tư vấn viên phụ trách. Chúng tôi luôn sẵn sàng hỗ trợ Quý khách 24/7.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #1e293b; padding: 24px 40px; text-align: center;">
                            <p style="margin: 0; color: #94a3b8; font-size: 12px;">© 2024 VinFast Auto. All rights reserved.</p>
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

            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(emailPayload)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    onComplete();
                    onClose();
                } else {
                    alert('Lỗi gửi email: ' + result.message);
                }
            } else {
                alert('Lỗi kết nối server email');
            }
        } catch (err: any) {
            alert('Lỗi: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    if (!visible) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 flex justify-between items-center rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <CreditCard className="text-white" size={26} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">THÔNG TIN ĐÓNG TIỀN</h2>
                                <p className="text-emerald-100 text-sm">{customer.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <X size={22} className="text-white" />
                        </button>
                    </div>

                    {/* Email Check */}
                    {!customer.email && (
                        <div className="px-5 pt-4">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-amber-800 text-sm font-bold mb-2">Vui lòng bổ sung Email để sử dụng tính năng này!</p>
                                        <input
                                            type="email"
                                            value={customerEmail}
                                            onChange={e => setCustomerEmail(e.target.value)}
                                            placeholder="email@example.com"
                                            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 mx-5 mt-4">
                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'basic' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            CƠ BẢN
                        </button>
                        <button
                            onClick={() => setActiveTab('detailed')}
                            className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'detailed' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            CHI TIẾT
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {loading ? (
                            <div className="text-center py-10 text-gray-500">
                                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                                Đang tải...
                            </div>
                        ) : (
                            <>
                                {/* Basic Tab */}
                                {activeTab === 'basic' && (
                                    <div className="space-y-3">
                                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-blue-700 text-sm font-bold">
                                                    <CreditCard size={16} /> Tiền xe
                                                </div>
                                            </div>
                                            <EditableField label="Giá cuối cùng" value={finalPrice} onChange={() => { }} fieldKey="finalPrice_basic" />
                                        </div>
                                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                            <div className="flex items-center gap-2 text-green-700 text-sm font-bold mb-2">
                                                <Receipt size={16} /> Tiền đăng ký xe
                                            </div>
                                            <p className="text-2xl font-bold text-green-600">{formatCurrency(registrationTotal)}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Detailed Tab */}
                                {activeTab === 'detailed' && (
                                    <div className="space-y-4">
                                        {/* Car Price Breakdown */}
                                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                                <CreditCard size={16} /> Tiền xe
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <EditableField label="Giá niêm yết" value={listPrice} onChange={setListPrice} fieldKey="listPrice" />
                                                <EditableField label="Tổng khuyến mãi" value={totalDiscount} onChange={setTotalDiscount} fieldKey="totalDiscount" />
                                                <div className="flex justify-between pt-2 border-t border-blue-200">
                                                    <span className="font-bold text-blue-800">Giá cuối cùng</span>
                                                    <span className="font-bold text-blue-600 text-lg">{formatCurrency(finalPrice)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Registration Fee Breakdown */}
                                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                            <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                                                <Receipt size={16} /> Tiền đăng ký xe
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <EditableField label="Thuế bạ" value={regTax} onChange={setRegTax} fieldKey="regTax" />
                                                <EditableField label="Lệ phí đăng ký biển số" value={plateFee} onChange={setPlateFee} fieldKey="plateFee" />
                                                <EditableField label="Phí đường bộ" value={roadFee} onChange={setRoadFee} fieldKey="roadFee" />
                                                <EditableField label="Lệ phí cấp sổ đăng kiểm" value={inspectionFee} onChange={setInspectionFee} fieldKey="inspectionFee" />
                                                <EditableField label="Bảo hiểm TNDS" value={civilInsurance} onChange={setCivilInsurance} fieldKey="civilInsurance" />
                                                <EditableField label="Bảo hiểm vật chất xe" value={vehicleInsurance} onChange={setVehicleInsurance} fieldKey="vehicleInsurance" />
                                                <EditableField label="Dịch vụ đăng ký xe" value={registrationService} onChange={setRegistrationService} fieldKey="registrationService" />
                                                <div className="flex justify-between pt-2 border-t border-green-200">
                                                    <span className="font-bold text-green-800">Tổng chi phí đăng ký</span>
                                                    <span className="font-bold text-green-600 text-lg">{formatCurrency(registrationTotal)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Divider */}
                                <div className="border-t border-gray-200 my-4"></div>

                                {/* Account Selection */}
                                <div>
                                    <h4 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">
                                        Danh sách tài khoản đóng tiền đăng ký xe
                                    </h4>
                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                                        {accounts.map(acc => (
                                            <div
                                                key={acc.id}
                                                onClick={() => setSelectedAccountId(acc.id)}
                                                className={`shrink-0 w-32 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedAccountId === acc.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="w-12 h-12 mx-auto mb-2 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                                    {acc.qr_code_url ? (
                                                        <img src={acc.qr_code_url} alt="QR" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <QrCode size={20} className="text-gray-400" />
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-center text-gray-800 truncate">{acc.name}</p>
                                                {selectedAccountId === acc.id && (
                                                    <div className="mt-2 flex justify-center">
                                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Add Account Button */}
                                        {accounts.length < maxAccounts && (
                                            <div
                                                onClick={() => setShowAddAccount(true)}
                                                className="shrink-0 w-32 p-3 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all flex flex-col items-center justify-center"
                                            >
                                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                                                    <Plus size={24} className="text-gray-400" />
                                                </div>
                                                <p className="text-xs font-bold text-gray-500">Thêm TK</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-5 border-t border-gray-100 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={sending || !customerEmail}
                            className={`flex-1 py-3 px-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${sending || !customerEmail ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-200'}`}
                        >
                            {sending ? (
                                <><Loader2 size={18} className="animate-spin" /> Đang gửi...</>
                            ) : (
                                <><Send size={18} /> Hoàn tất & Gửi</>
                            )}
                        </button>
                    </div>

                </div>
            </div>

            {/* Add Account Modal */}
            <AddPaymentAccountModal
                visible={showAddAccount}
                onClose={() => setShowAddAccount(false)}
                onSuccess={handleAddAccountSuccess}
                currentCount={accounts.length}
            />
        </>
    );
};

export default PaymentNotificationModal;

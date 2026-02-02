import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { CarModel, CarVersion, QuoteConfig, BankConfig, BankPackage, MembershipTier, RegistrationService, UserRole } from '../types';
import {
    Car, Calculator, FileImage, FileText, CheckCircle2, AlertCircle, Settings2, Mail, Loader2, Lock, Check, DollarSign, Landmark, Gift, Crown, Coins, ShieldCheck, MapPin, Search, TableProperties, ArrowUpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';


// --- HELPER: WARRANTY TEXT LOGIC ---
const getWarrantyText = (modelName: string) => {
    const name = modelName ? modelName.toUpperCase() : '';
    const tenYearModels = ['VF 7', 'VF 8', 'VF 9', 'VF7', 'VF8', 'VF9', 'LẠC HỒNG', 'DRAGON'];
    if (tenYearModels.some(m => name.includes(m))) {
        return "Bảo hành 10 năm - Không giới hạn Km";
    }
    return "Bảo hành 07 năm hoặc 160.000 Km";
};

// --- 1. MẪU BÁO GIÁ CHUẨN (Dùng để render ẩn và chụp ảnh - Inline CSS 100%) ---
const PrintableQuoteTemplate: React.FC<{ data: any }> = ({ data }) => {
    const {
        carModelName, versionName, listPrice, finalInvoicePrice, totalFees, finalRollingPrice,
        invoiceBreakdown, feeBreakdown, rollingBreakdown, activeGifts, membershipData,
        bankName, loanAmount, upfrontPayment, monthlyPaymentTable, userProfile, prepaidPercent,
        isRegistrationFree
    } = data;

    const formatCurrency = (n: number) => n.toLocaleString('vi-VN');
    const today = new Date().toLocaleDateString('vi-VN');
    const warrantyText = getWarrantyText(carModelName);

    // Inline Styles để đảm bảo tính nhất quán tuyệt đối khi render
    const styles = {
        container: {
            width: '800px', // Cố định chiều rộng chuẩn A4
            backgroundColor: '#ffffff',
            padding: '40px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#111827',
            position: 'relative' as const,
            lineHeight: '1.5',
            boxSizing: 'border-box' as const,
            margin: '0 auto'
        },
        header: {
            borderBottom: '3px solid #059669',
            paddingBottom: '20px',
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
        },
        title: {
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#059669',
            margin: '0 0 5px 0',
            textTransform: 'uppercase' as const
        },
        sectionTitle: {
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '4px',
            margin: '0 0 15px 0',
            display: 'inline-block',
            width: '100%',
            boxSizing: 'border-box' as const
        },
        row: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid #f3f4f6'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse' as const,
            fontSize: '14px',
            marginBottom: '20px'
        },
        td: {
            padding: '8px 5px',
            borderBottom: '1px solid #e5e7eb',
            color: '#374151'
        },
        tdRight: {
            padding: '8px 5px',
            borderBottom: '1px solid #e5e7eb',
            textAlign: 'right' as const,
            fontWeight: 'bold',
            color: '#111827'
        },
        totalRow: {
            backgroundColor: '#ecfdf5',
            fontWeight: 'bold',
            color: '#047857',
            fontSize: '16px'
        }
    };

    return (
        <div id="print-template" style={styles.container}>
            {/* HEADER */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>BÁO GIÁ XE VINFAST</h1>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Ngày báo giá: {today}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', color: '#059669', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>VINFAST AUTO</div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#111827', marginBottom: '4px' }}>{warrantyText}</div>
                    <div style={{ fontSize: '14px', color: '#374151', fontStyle: 'italic' }}>Cứu hộ miễn phí 24/7</div>
                </div>
            </div>

            {/* SECTION 1: XE & GIÁ */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ ...styles.sectionTitle, backgroundColor: '#059669' }}>
                    1. THÔNG TIN XE & GIÁ BÁN
                </h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div><span style={{ color: '#6b7280', fontSize: '13px', display: 'block' }}>Dòng xe</span> <strong style={{ fontSize: '16px' }}>{carModelName}</strong></div>
                    <div><span style={{ color: '#6b7280', fontSize: '13px', display: 'block' }}>Phiên bản</span> <strong style={{ fontSize: '16px' }}>{versionName}</strong></div>
                    <div style={{ textAlign: 'right' }}><span style={{ color: '#6b7280', fontSize: '13px', display: 'block' }}>Giá Niêm Yết</span> <strong style={{ color: '#059669', fontSize: '18px' }}>{formatCurrency(listPrice)} VNĐ</strong></div>
                </div>

                <table style={styles.table}>
                    <tbody>
                        {invoiceBreakdown.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td style={styles.td}>• {item.name}</td>
                                <td style={{ ...styles.tdRight, color: '#dc2626' }}>-{formatCurrency(item.amount)}</td>
                            </tr>
                        ))}
                        <tr style={styles.totalRow}>
                            <td style={{ padding: '12px 10px' }}>GIÁ XUẤT HÓA ĐƠN</td>
                            <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatCurrency(finalInvoicePrice)} VNĐ</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SECTION 2: LĂN BÁNH */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ ...styles.sectionTitle, backgroundColor: '#374151' }}>
                    2. CHI PHÍ LĂN BÁNH (DỰ KIẾN)
                </h2>
                <table style={styles.table}>
                    <tbody>
                        {feeBreakdown.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td style={styles.td}>{idx + 1}. {item.name}</td>
                                <td style={{ ...styles.tdRight, fontWeight: 'bold', color: '#1d4ed8' }}>{Math.round(item.amount).toLocaleString('vi-VN')}</td>
                            </tr>
                        ))}
                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                            <td style={{ ...styles.td, fontWeight: 'bold', fontStyle: 'italic' }}>TỔNG PHÍ ĐĂNG KÝ</td>
                            <td style={{ ...styles.tdRight, fontWeight: 'bold' }}>{formatCurrency(totalFees)}</td>
                        </tr>

                        {isRegistrationFree && (
                            <tr style={{ backgroundColor: '#f0fdf4' }}>
                                <td style={{ ...styles.td, color: '#166534', fontWeight: 'bold' }}>• Tặng 100% Phí Đăng ký</td>
                                <td style={{ ...styles.tdRight, color: '#166534' }}>-{formatCurrency(totalFees)}</td>
                            </tr>
                        )}
                        {rollingBreakdown.map((item: any, idx: number) => (
                            <tr key={`r-${idx}`} style={{ backgroundColor: '#fff7ed' }}>
                                <td style={{ ...styles.td, color: '#ea580c', fontWeight: 'bold' }}>• {item.name} (Ưu đãi)</td>
                                <td style={{ ...styles.tdRight, color: '#ea580c' }}>-{formatCurrency(item.amount)}</td>
                            </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid #374151' }}>
                            <td style={{ padding: '15px 5px', fontWeight: 'bold', fontSize: '16px' }}>TỔNG CỘNG LĂN BÁNH</td>
                            <td style={{ padding: '15px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: '24px', color: '#dc2626' }}>{formatCurrency(finalRollingPrice)} VNĐ</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SECTION 3: QUÀ TẶNG */}
            {(activeGifts.length > 0 || membershipData.giftValue > 0) && (
                <div style={{ marginBottom: '30px' }}>
                    <h2 style={{ ...styles.sectionTitle, backgroundColor: '#8b5cf6' }}>
                        3. QUÀ TẶNG & ƯU ĐÃI KHÁC
                    </h2>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#374151', lineHeight: '1.8' }}>
                        {activeGifts.map((g: any, idx: number) => (
                            <li key={idx}>
                                <strong>{g.label}</strong> {g.isVinPoint ? `: ${formatCurrency(g.value)} điểm VinPoint` : (g.value > 0 ? `: ${formatCurrency(g.value)}` : '')}
                            </li>
                        ))}
                        {membershipData.giftValue > 0 && (
                            <li>
                                <strong>Ưu đãi {membershipData.name}:</strong> Tặng thêm {formatCurrency(membershipData.giftValue)} (Voucher/Quà)
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {/* SECTION 4: NGÂN HÀNG */}
            {bankName && loanAmount > 0 && (
                <div style={{ marginBottom: '30px', pageBreakInside: 'avoid' }}>
                    <h2 style={{ ...styles.sectionTitle, backgroundColor: '#2563eb' }}>
                        4. DỰ TÍNH TRẢ GÓP ({bankName})
                    </h2>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                            <p style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Thanh toán đối ứng</p>
                            <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', margin: '5px 0 0 0' }}>{formatCurrency(upfrontPayment)}</p>
                            <p style={{ fontSize: '11px', color: '#60a5fa', margin: '2px 0 0 0' }}>(Lăn bánh - Vay)</p>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Số tiền vay ({100 - prepaidPercent}%)</p>
                            <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', margin: '5px 0 0 0' }}>{formatCurrency(loanAmount)}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {monthlyPaymentTable.map((row: any) => (
                            <div key={row.year} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', textAlign: 'center', backgroundColor: '#f9fafb' }}>
                                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>Vay {row.year} Năm</p>
                                <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#2563eb', margin: '4px 0 0 0' }}>{formatCurrency(row.monthly)}/tháng</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: '11px', fontStyle: 'italic', color: '#9ca3af', marginTop: '10px', textAlign: 'center' }}>
                        * Số tiền trả góp tính theo dư nợ giảm dần (Gốc + Lãi tháng đầu). Lãi suất thực tế tuỳ thuộc chính sách ngân hàng tại thời điểm vay.
                    </p>
                </div>
            )}

            <div style={{ marginTop: '40px', borderTop: '1px dashed #d1d5db', paddingTop: '20px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                <p>Bảng báo giá có giá trị tham khảo. Vui lòng liên hệ trực tiếp TVBH để được tư vấn chương trình khuyến mãi chính xác nhất.</p>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const OnlineQuote: React.FC = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const quoteRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);

    // Access Control
    const isDiamond = userProfile?.member_tier === MembershipTier.DIAMOND ||
        userProfile?.role === UserRole.ADMIN ||
        userProfile?.role === UserRole.MOD;

    // --- EMAIL SENDING STATE ---
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [emailMessage, setEmailMessage] = useState(''); // Lời nhắn
    const [sendingEmail, setSendingEmail] = useState(false);
    const [attachPDF, setAttachPDF] = useState(true); // Tùy chọn đính kèm PDF

    // Check if user is locked from using this page (Restricted to Platinum+)
    const isPlatinumOrHigher =
        userProfile?.member_tier === MembershipTier.PLATINUM ||
        userProfile?.member_tier === MembershipTier.DIAMOND ||
        userProfile?.role === 'admin' || userProfile?.role === 'moderator'; // Allow Admin/Mod

    // --- UI HANDLERS ---
    const handleEmailButtonClick = () => {
        if (isDiamond) {
            setShowEmailModal(true);
        } else {
            alert('🔒 TÍNH NĂNG CAO CẤP\n\nBạn cần đạt hạng DIAMOND (Kim Cương) để sử dụng tính năng Gửi Email Báo Giá tự động.\n\nVui lòng liên hệ Admin để nâng cấp!');
        }
    };

    if (!isPlatinumOrHigher) {
        return (
            <div className="max-w-2xl mx-auto mt-20 p-8 bg-white border border-gray-100 rounded-3xl text-center shadow-xl">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock className="text-gray-400" size={32} />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Tính năng giới hạn</h2>
                <p className="text-gray-500 mb-6">
                    Công cụ Báo giá Online chỉ dành cho thành viên hạng
                    <span className="font-bold text-slate-700"> Platinum</span> trở lên.
                </p>
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <div className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-xl font-bold shadow-lg cursor-default">
                        <ArrowUpCircle size={20} />
                        <span>Nâng cấp hạng thành viên</span>
                    </div>
                    <button onClick={() => navigate('/')} className="px-6 py-2 text-gray-500 hover:text-gray-900 font-medium text-sm">
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        );
    }

    // Data Sources
    const [carModels, setCarModels] = useState<CarModel[]>([]);
    const [carVersions, setCarVersions] = useState<CarVersion[]>([]);
    const [promotions, setPromotions] = useState<QuoteConfig[]>([]);
    const [fees, setFees] = useState<QuoteConfig[]>([]);
    const [banks, setBanks] = useState<BankConfig[]>([]);
    const [gifts, setGifts] = useState<QuoteConfig[]>([]);
    const [memberships, setMemberships] = useState<QuoteConfig[]>([]);
    const [warranties, setWarranties] = useState<QuoteConfig[]>([]);
    const [registrationServices, setRegistrationServices] = useState<RegistrationService[]>([]);

    // --- LOCAL STORAGE PERSISTENCE ---
    const STORAGE_KEY = 'vinfast_quote_state';

    // Helper to get saved state from localStorage
    const getSavedState = <T,>(key: string, defaultValue: T): T => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed[key] !== undefined ? parsed[key] : defaultValue;
            }
        } catch (e) { console.error('Error reading localStorage:', e); }
        return defaultValue;
    };

    // Selection State - Initialize from localStorage
    const [selectedModelId, setSelectedModelId] = useState<string>(() => getSavedState('selectedModelId', ''));
    const [selectedVersionId, setSelectedVersionId] = useState<string>(() => getSavedState('selectedVersionId', ''));
    const [selectedBankId, setSelectedBankId] = useState<string>(() => getSavedState('selectedBankId', ''));
    const [selectedMembershipId, setSelectedMembershipId] = useState<string>(() => getSavedState('selectedMembershipId', ''));

    // Bank Package Selection
    const [selectedPackageIndex, setSelectedPackageIndex] = useState<number>(() => getSavedState('selectedPackageIndex', 0));

    // Input State
    const [prepaidPercent, setPrepaidPercent] = useState<number>(() => getSavedState('prepaidPercent', 20));
    const [manualPrepaidAmount, setManualPrepaidAmount] = useState<number | null>(() => getSavedState('manualPrepaidAmount', null));

    const [appliedPromos, setAppliedPromos] = useState<string[]>(() => getSavedState('appliedPromos', []));
    const [customFees, setCustomFees] = useState<Record<string, number>>(() => getSavedState('customFees', {}));
    const [feeOptions, setFeeOptions] = useState<Record<string, number>>(() => getSavedState('feeOptions', {}));
    const [manualDiscount, setManualDiscount] = useState<string>(() => getSavedState('manualDiscount', ''));
    const [manualDiscountType, setManualDiscountType] = useState<'invoice' | 'rolling'>(() => getSavedState('manualDiscountType', 'invoice'));
    const [manualServiceFee, setManualServiceFee] = useState<string>(() => getSavedState('manualServiceFee', '3.000.000'));

    // --- NEW: INSURANCE & REG FEE STATE ---
    const [includeInsurance, setIncludeInsurance] = useState(() => getSavedState('includeInsurance', false));
    const [insuranceRate, setInsuranceRate] = useState<string>(() => String(getSavedState('insuranceRate', 1.2)));
    const [feeSearch, setFeeSearch] = useState('');
    const [showFeeList, setShowFeeList] = useState(false);

    // NEW: FREE REGISTRATION FLAG
    const [isRegistrationFree, setIsRegistrationFree] = useState(() => getSavedState('isRegistrationFree', false));

    // NEW: PREMIUM COLOR FLAG
    const [includePremiumColor, setIncludePremiumColor] = useState(() => getSavedState('includePremiumColor', false));

    // --- SAVE STATE TO LOCALSTORAGE ---
    useEffect(() => {
        const stateToSave = {
            selectedModelId, selectedVersionId, selectedBankId, selectedMembershipId,
            selectedPackageIndex, prepaidPercent, manualPrepaidAmount,
            appliedPromos, customFees, feeOptions, manualDiscount, manualDiscountType, manualServiceFee,
            includeInsurance, insuranceRate, isRegistrationFree, includePremiumColor
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) { console.error('Error saving to localStorage:', e); }
    }, [
        selectedModelId, selectedVersionId, selectedBankId, selectedMembershipId,
        selectedPackageIndex, prepaidPercent, manualPrepaidAmount,
        appliedPromos, customFees, feeOptions, manualDiscount, manualDiscountType, manualServiceFee,
        includeInsurance, insuranceRate, isRegistrationFree, includePremiumColor
    ]);

    useEffect(() => {
        fetchQuoteData();
    }, [userProfile]);

    // Auto-fill email from URL params when navigating from CustomerDetail
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlEmail = params.get('customerEmail');
        const urlName = params.get('customerName');
        if (urlEmail) setEmailRecipient(decodeURIComponent(urlEmail));
        if (urlName) setCustomerName(decodeURIComponent(urlName));
    }, []);

    // Track previous model ID to detect user-initiated changes (not initial load)
    const previousModelId = useRef<string | null>(null);

    useEffect(() => {
        // On first effect run, just record the current model ID without resetting
        if (previousModelId.current === null) {
            previousModelId.current = selectedModelId;
            return;
        }

        // Only reset if model ACTUALLY changed (user selected different model)
        if (previousModelId.current !== selectedModelId) {
            previousModelId.current = selectedModelId;
            setSelectedVersionId('');
            setAppliedPromos([]);
            setManualDiscount('');
        }
    }, [selectedModelId]);

    // Track if bank was changed by user (vs initial load)
    const isInitialBankChange = useRef(true);

    useEffect(() => {
        // Skip reset on initial load (when restoring from localStorage)
        if (isInitialBankChange.current) {
            isInitialBankChange.current = false;
            return;
        }
        setSelectedPackageIndex(0);
    }, [selectedBankId]);

    // Initialize fee options only if no saved state exists
    const isInitialFeeLoad = useRef(true);

    useEffect(() => {
        if (fees.length > 0) {
            const initOptions: Record<string, number> = {};
            fees.forEach(f => {
                if (f.options && f.options.length > 0) {
                    initOptions[f.id] = f.options[0].value;
                } else {
                    initOptions[f.id] = f.value;
                }
            });

            // Only set defaults if no saved feeOptions OR this is a fresh session
            if (isInitialFeeLoad.current) {
                isInitialFeeLoad.current = false;
                // Merge: use saved values if they exist, otherwise use defaults
                const savedFeeOptions = getSavedState('feeOptions', {});
                const mergedOptions = { ...initOptions, ...savedFeeOptions };
                setFeeOptions(mergedOptions);
            }
        }
    }, [fees]);

    // AUTO-SELECT PROMOS - Only on user interaction, not on initial load
    const isInitialPromoLoad = useRef(true);

    useEffect(() => {
        // Skip auto-select on initial load (preserve saved appliedPromos)
        if (isInitialPromoLoad.current) {
            isInitialPromoLoad.current = false;
            return;
        }

        if (promotions.length > 0 && selectedModelId) {
            const validPromos = promotions.filter(p => {
                const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
                let versionMatch = true;
                if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
                    versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
                }
                return modelMatch && versionMatch;
            });
            setAppliedPromos(validPromos.map(p => p.id));
        }
    }, [selectedModelId, selectedVersionId, promotions]);

    const fetchQuoteData = async () => {
        setLoading(true);
        try {
            const [modelsRes, versionsRes, promosRes, feesRes, banksRes, giftsRes, memberRes, warrantyRes, regServicesRes] = await Promise.all([
                supabase.from('car_models').select('*').order('priority', { ascending: true }),
                supabase.from('car_versions').select('*'),
                supabase.from('quote_configs').select('*').eq('type', 'promotion').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('quote_configs').select('*').eq('type', 'fee').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('banks').select('*'),
                supabase.from('quote_configs').select('*').eq('type', 'gift').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('quote_configs').select('*').eq('type', 'membership').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('quote_configs').select('*').eq('type', 'warranty').eq('is_active', true).order('created_at', { ascending: false }),
                supabase.from('registration_services').select('*').eq('is_active', true).order('priority', { ascending: true }),
            ]);

            setCarModels((modelsRes.data as CarModel[]) || []);
            setCarVersions((versionsRes.data as CarVersion[]) || []);
            setPromotions((promosRes.data as QuoteConfig[]) || []);
            setFees((feesRes.data as QuoteConfig[]) || []);
            setBanks((banksRes.data as BankConfig[]) || []);
            setGifts((giftsRes.data as QuoteConfig[]) || []);
            setMemberships((memberRes.data as QuoteConfig[]) || []);
            setWarranties((warrantyRes.data as QuoteConfig[]) || []);
            setRegistrationServices((regServicesRes.data as RegistrationService[]) || []);

            if (banksRes.data && banksRes.data.length > 0) {
                // Only set default bank if no saved bankId
                const savedBankId = getSavedState('selectedBankId', '');
                if (!savedBankId) {
                    setSelectedBankId(banksRes.data[0].id);
                }
            }

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const selectedVersion = carVersions.find(v => v.id === selectedVersionId);
    const selectedBank = banks.find(b => b.id === selectedBankId);

    // Warranty Logic Helper - Updated to use Config
    const getWarrantyPeriod = (modelId: string) => {
        // Find warranty config for this model
        const config = warranties.find(w => w.apply_to_model_ids && w.apply_to_model_ids.includes(modelId));
        if (config) return config.name;

        // Default Fallback
        return "Theo chính sách VinFast";
    };

    const currentInterestRate = useMemo(() => {
        if (!selectedBank) return 0;
        if (selectedBank.packages && selectedBank.packages.length > 0) {
            return selectedBank.packages[selectedPackageIndex]?.rate || 0;
        }
        return selectedBank.interest_rate_1y || 0;
    }, [selectedBank, selectedPackageIndex]);

    // Filtered Reg Fees for Search
    const filteredRegFees = useMemo(() => {
        if (!feeSearch) return [];
        const lower = feeSearch.toLowerCase();
        return registrationServices.filter((s: RegistrationService) => s.label.toLowerCase().includes(lower));
    }, [feeSearch, registrationServices]);

    // --- REGION DETECTION LOGIC ---
    const currentRegion = useMemo(() => {
        const feeWithOptions = fees.find(f => f.options && f.options.length > 0);
        if (!feeWithOptions) return 'Tỉnh'; // Default fallback

        const selectedVal = feeOptions[feeWithOptions.id];
        const selectedOption = feeWithOptions.options?.find(o => o.value === selectedVal);

        if (!selectedOption) return 'Tỉnh';

        const label = selectedOption.label.toLowerCase();
        if (label.includes('hcm') || label.includes('hồ chí minh') || label.includes('sài gòn')) return 'HCM';
        if (label.includes('hà nội') || label.includes('hn') || label.includes('ha noi')) return 'HN';

        return 'Tỉnh';
    }, [fees, feeOptions]);

    // --- CALCULATIONS ---
    // Calculate listPrice with optional premium color
    const basePrice = selectedVersion?.price || 0;
    const premiumColorAmount = (includePremiumColor && selectedVersion?.premium_color_amount) ? selectedVersion.premium_color_amount : 0;
    const listPrice = basePrice + premiumColorAmount;

    // Membership Logic
    const membershipCalculation = useMemo(() => {
        const selectedMem = memberships.find(m => m.id === selectedMembershipId);
        if (!selectedMem) return { discount: 0, giftValue: 0, name: '' };

        const discount = listPrice * (selectedMem.value / 100);
        const giftValue = listPrice * ((selectedMem.gift_ratio || 0) / 100);

        return { discount, giftValue, name: selectedMem.name, percent: selectedMem.value, giftPercent: selectedMem.gift_ratio };
    }, [selectedMembershipId, listPrice, memberships]);

    // 1. Calculate Final INVOICE Price (Giá Xe Hóa Đơn)
    const invoicePromoCalculation = useMemo(() => {
        let currentPrice = listPrice;
        const breakdown: { name: string, amount: number }[] = [];

        // A. Standard Promos (Target: Invoice)
        const applicable = promotions.filter(p => {
            const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
            let versionMatch = true;
            if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
                versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
            }
            return modelMatch && versionMatch;
        });

        const invoicePromos = applicable.filter(p => !p.target_type || p.target_type === 'invoice');
        invoicePromos.sort((a, b) => a.priority - b.priority);

        invoicePromos.forEach(p => {
            if (appliedPromos.includes(p.id)) {
                let amount = 0;
                if (p.value_type === 'percent') {
                    amount = listPrice * (p.value / 100);
                } else {
                    amount = p.value;
                }
                currentPrice -= amount;
                breakdown.push({ name: p.name, amount });
            }
        });

        // B. Membership Discount
        if (membershipCalculation.discount > 0) {
            currentPrice -= membershipCalculation.discount;
            breakdown.push({ name: `Ưu đãi ${membershipCalculation.name} (-${membershipCalculation.percent}%)`, amount: membershipCalculation.discount });
        }

        // C. Manual Discount (Target: Invoice)
        const manualVal = Number(manualDiscount.replace(/\D/g, ''));
        if (manualVal > 0 && manualDiscountType === 'invoice') {
            currentPrice -= manualVal;
            breakdown.push({ name: 'Giảm giá thêm (XHĐ)', amount: manualVal });
        }

        return { finalPrice: Math.max(0, currentPrice), breakdown };
    }, [listPrice, promotions, appliedPromos, selectedModelId, selectedVersionId, membershipCalculation, manualDiscount, manualDiscountType]);

    const finalInvoicePrice = invoicePromoCalculation.finalPrice;

    // 2. Fees + INSURANCE
    const feeCalculation = useMemo(() => {
        let totalFees = 0;
        const breakdown: { name: string, amount: number, originalId: string }[] = [];

        fees.forEach(f => {
            let baseValue = f.value;
            if (f.options && f.options.length > 0 && feeOptions[f.id] !== undefined) {
                baseValue = feeOptions[f.id];
            }
            if (customFees[f.id] !== undefined) {
                baseValue = customFees[f.id];
            }

            let amount = baseValue;
            if (f.value_type === 'percent') {
                amount = listPrice * (baseValue / 100);
            }
            totalFees += amount;

            let displayLabel = f.name;
            if (f.options && f.options.length > 0) {
                const selectedOpt = f.options.find(o => o.value === feeOptions[f.id]);
                if (selectedOpt) displayLabel = `${f.name} (${selectedOpt.label})`;
            }

            breakdown.push({ name: displayLabel, amount, originalId: f.id });
        });

        if (includeInsurance) {
            const rate = parseFloat(String(insuranceRate).replace(',', '.')) || 0;
            const insuranceAmount = finalInvoicePrice * (rate / 100);
            totalFees += insuranceAmount;
            breakdown.push({ name: `Bảo hiểm 2 chiều (${insuranceRate}%)`, amount: insuranceAmount, originalId: 'hull_insurance' });
        }

        const serviceFee = Number(manualServiceFee.replace(/\D/g, ''));
        if (serviceFee > 0) {
            totalFees += serviceFee;
            breakdown.push({ name: "Dịch vụ đăng ký (Khác)", amount: serviceFee, originalId: 'manual_service' });
        }

        return { totalFees, breakdown };
    }, [fees, customFees, feeOptions, listPrice, finalInvoicePrice, manualServiceFee, includeInsurance, insuranceRate]);

    const totalFees = feeCalculation.totalFees;

    // 3. Rolling Promos & Manual Discount
    const rollingPromoCalculation = useMemo(() => {
        let totalDiscount = 0;
        const breakdown: { name: string, amount: number }[] = [];

        const applicable = promotions.filter(p => {
            const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
            let versionMatch = true;
            if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
                versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
            }
            return modelMatch && versionMatch;
        });

        const rollingPromos = applicable.filter(p => p.target_type === 'rolling');

        rollingPromos.forEach(p => {
            if (appliedPromos.includes(p.id)) {
                let amount = 0;
                if (p.value_type === 'percent') {
                    amount = listPrice * (p.value / 100);
                } else {
                    amount = p.value;
                }
                totalDiscount += amount;
                breakdown.push({ name: p.name, amount });
            }
        });

        const manualVal = Number(manualDiscount.replace(/\D/g, ''));
        if (manualVal > 0 && manualDiscountType === 'rolling') {
            totalDiscount += manualVal;
            breakdown.push({ name: 'Giảm giá thêm (Lăn bánh)', amount: manualVal });
        }

        return { totalDiscount, breakdown };
    }, [promotions, appliedPromos, selectedModelId, selectedVersionId, listPrice, manualDiscount, manualDiscountType]);

    // Final Rolling Calculation
    const preRollingPrice = finalInvoicePrice + totalFees;
    const finalRollingPrice = Math.max(0, preRollingPrice - rollingPromoCalculation.totalDiscount);

    // 4. Payment & Loan
    const loanAmount = useMemo(() => {
        if (manualPrepaidAmount !== null) {
            return Math.max(0, finalInvoicePrice - manualPrepaidAmount);
        }
        return finalInvoicePrice * ((100 - prepaidPercent) / 100);
    }, [finalInvoicePrice, prepaidPercent, manualPrepaidAmount]);

    const upfrontPayment = Math.max(0, finalRollingPrice - loanAmount);

    const handlePrepaidPercentChange = (val: number) => {
        setPrepaidPercent(val);
        setManualPrepaidAmount(null);
    };

    const handleManualPrepaidChange = (val: number) => {
        setManualPrepaidAmount(val);
        if (finalInvoicePrice > 0) {
            const pct = (val / finalInvoicePrice) * 100;
            setPrepaidPercent(Math.round(pct));
        }
    };

    // 5. Monthly Payment Table
    const monthlyPaymentTable = useMemo(() => {
        if (!selectedBank || loanAmount <= 0) return [];
        const rate = currentInterestRate / 100;
        const result = [];
        for (let year = 3; year <= 8; year++) {
            const months = year * 12;
            const principal = loanAmount / months;
            const interest = (loanAmount * rate) / 12;
            const firstMonth = principal + interest;
            result.push({ year, monthly: firstMonth });
        }
        return result;
    }, [loanAmount, selectedBank, currentInterestRate]);

    // Helper to check if gift is VinPoint
    const getGiftDetails = (g: QuoteConfig) => {
        // Check if it's VinPoint type (has options mapping)
        if (g.options && g.options.length > 0) {
            // Find mapping for current model
            const mapped = g.options.find(opt => opt.model_id === selectedModelId);
            if (mapped) {
                return { isVinPoint: true, value: mapped.value, label: `${g.name} (Tích điểm)` };
            }
            // If no mapping for this model, return null (gift not applicable)
            return null;
        }
        // Standard Gift
        return { isVinPoint: false, value: g.value, label: g.name };
    };

    const activeGifts = gifts.map(g => getGiftDetails(g)).filter(g => g !== null) as { isVinPoint: boolean, value: number, label: string }[];

    const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

    // --- UPDATED EXPORT LOGIC: GHOST RENDER STRATEGY ---
    const handleExportQuote = async (type: 'excel' | 'pdf' | 'image') => {
        if (type === 'excel') {
            // Keep existing Excel logic
            const data = [
                ["BÁO GIÁ XE VINFAST", ""],
                ["Dòng xe", `${selectedVersion?.name || ''} (${carModels.find(m => m.id === selectedModelId)?.name})`],
                ["Giá Niêm Yết", formatCurrency(listPrice)],
                ...invoicePromoCalculation.breakdown.map(p => [p.name, `-${formatCurrency(p.amount)}`]),
                ["GIÁ XUẤT HÓA ĐƠN", formatCurrency(finalInvoicePrice)],
                ["", ""],
                ["CHI PHÍ LĂN BÁNH", ""],
                ...feeCalculation.breakdown.map(f => [f.name, formatCurrency(f.amount)]),
                ["TỔNG PHÍ", formatCurrency(totalFees)],
                ["", ""],
                ["ƯU ĐÃI LĂN BÁNH", ""],
                ...rollingPromoCalculation.breakdown.map(p => [p.name, `-${formatCurrency(p.amount)}`]),
                ["", ""],
                ["TỔNG CỘNG LĂN BÁNH", formatCurrency(finalRollingPrice)],
                ["", ""],
                ["QUÀ TẶNG KÈM THEO", ""],
                ...activeGifts.map(g => [g.label, g.isVinPoint ? `${formatCurrency(g.value)} điểm` : (g.value > 0 ? formatCurrency(g.value) : 'Hiện vật')]),
                ...(membershipCalculation.giftValue > 0 ? [[`Ưu đãi ${membershipCalculation.name} (Tặng thêm)`, formatCurrency(membershipCalculation.giftValue)]] : []),
                ["", ""],
                ["DỰ TÍNH NGÂN HÀNG", selectedBank?.name],
                ["Trả trước", `${prepaidPercent}% (~${formatCurrency(finalInvoicePrice - loanAmount)})`],
                ["Số tiền vay", formatCurrency(loanAmount)],
                ["Thanh toán đối ứng", formatCurrency(upfrontPayment)],
                ["", ""],
                ["GÓP HÀNG THÁNG (Dư nợ giảm dần)", ""],
                ...monthlyPaymentTable.map(r => [`${r.year} Năm`, `${formatCurrency(r.monthly)} VNĐ/tháng`])
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "BaoGia");
            XLSX.writeFile(wb, "Bao_Gia_VinFast.xlsx");
            return;
        }

        // --- NEW GHOST RENDER LOGIC FOR IMAGE/PDF (Using PrintableQuoteTemplate) ---

        const quoteData = {
            carModelName: carModels.find(m => m.id === selectedModelId)?.name || 'VinFast',
            versionName: selectedVersion?.name || '',
            listPrice,
            finalInvoicePrice,
            totalFees,
            finalRollingPrice,
            invoiceBreakdown: invoicePromoCalculation.breakdown,
            feeBreakdown: feeCalculation.breakdown,
            rollingBreakdown: rollingPromoCalculation.breakdown,
            activeGifts,
            membershipData: membershipCalculation,
            bankName: selectedBank?.name,
            loanAmount,
            upfrontPayment,
            monthlyPaymentTable,
            userProfile,
            prepaidPercent,
            isRegistrationFree // Pass this flag to print template
        };

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-10000px';
        container.style.left = '0';
        container.style.zIndex = '-1000';
        document.body.appendChild(container);

        const root = createRoot(container);
        root.render(<PrintableQuoteTemplate data={quoteData} />);

        await new Promise(resolve => setTimeout(resolve, 800));

        const element = document.getElementById('print-template');
        if (!element) {
            document.body.removeChild(container);
            alert("Lỗi tạo mẫu in.");
            return;
        }

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // High resolution
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);

            if (type === 'image') {
                const link = document.createElement('a');
                link.download = `BaoGia_VinFast_${new Date().getTime()}.jpg`;
                link.href = imgData;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                let heightLeft = imgHeight;
                let position = 0;

                // Page 1
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;

                // Subsequent Pages
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight; // This will start becoming negative to shift image up
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }

                pdf.save(`BaoGia_VinFast_${new Date().getTime()}.pdf`);
            }
        } catch (err) {
            console.error("Export failed", err);
            alert("Lỗi khi xuất file. Vui lòng thử lại.");
        } finally {
            setTimeout(() => {
                root.unmount();
                document.body.removeChild(container);
            }, 100);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" /></div>;

    const availablePromos = promotions.filter(p => {
        const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
        let versionMatch = true;
        if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
            versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
        }
        return modelMatch && versionMatch;
    });

    // Logic for Back Button
    const searchParams = new URLSearchParams(location.search);
    const fromCustomerId = searchParams.get('fromCustomer');

    const handleBack = () => {
        if (fromCustomerId) {
            navigate(`/customers/${fromCustomerId}`);
        } else {
            navigate(-1);
        }
    };

    // --- EMAIL SENDING LOGIC ---
    const handleTestEmailConnection = async () => {
        try {
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'email_script_url')
                .maybeSingle();

            const scriptUrl = settingData?.value;
            if (!scriptUrl) {
                alert('LỖI: Chưa cấu hình URL gửi email (key: email_script_url) trong App Settings.');
                return;
            }

            // Mask URL for security in alert
            const maskedUrl = scriptUrl.substring(0, 30) + '...';
            if (!confirm(`Đang test kết nối tới: ${maskedUrl}\n\nNhấn OK để tiếp tục.`)) return;

            const response = await fetch(scriptUrl); // GET request
            if (!response.ok) throw new Error(response.statusText);

            const text = await response.text();
            alert('✅ KẾT NỐI THÀNH CÔNG!\n\nPhản hồi từ Server:\n' + text);

        } catch (e: any) {
            console.error(e);
            alert('❌ KẾT NỐI THẤT BẠI: ' + e.message + '\n\nNguyên nhân thường gặp:\n- Script chưa Deploy dạng Web App "Anyone".\n- URL bị sai.');
        }
    };

    // --- HELPER: GENERATE ASSETS (PDF & IMG) ---
    const generateQuoteAssets = async (data: any): Promise<{ pdf: string, img: string } | null> => {
        // Render Template off-screen
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        document.body.appendChild(container);

        const root = createRoot(container);
        // Force sync render promise wrapper
        await new Promise<void>(resolve => {
            root.render(<PrintableQuoteTemplate data={data} />);
            setTimeout(resolve, 500); // Wait for render
        });

        try {
            const element = container.querySelector('#print-template') as HTMLElement;
            if (!element) return null;

            const canvas = await html2canvas(element, {
                scale: 1.5, // Scale for quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // 1. Get Image Base64
            // toDataURL returns: "data:image/jpeg;base64,....." -> we split to get just the code
            const imgDataFull = canvas.toDataURL('image/jpeg', 0.9);
            const imgBase64 = imgDataFull.split(',')[1];

            // 2. Generate PDF using the image
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgDataFull, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgDataFull, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            const pdfOutput = pdf.output('datauristring');
            const pdfBase64 = pdfOutput.split(',')[1];

            return { pdf: pdfBase64, img: imgBase64 };

        } catch (err) {
            console.error("Asset Gen Error:", err);
            return null;
        } finally {
            setTimeout(() => {
                root.unmount();
                document.body.removeChild(container);
            }, 100);
        }
    };

    const handleSendEmail = async () => {
        if (!emailRecipient) {
            alert('Vui lòng nhập địa chỉ Email!');
            return;
        }

        setSendingEmail(true);
        try {
            // 1. Get Google Apps Script URL
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'email_script_url')
                .maybeSingle();

            const scriptUrl = settingData?.value;

            if (!scriptUrl) {
                alert('Chưa cấu hình URL gửi email (app_settings: email_script_url)');
                return;
            }

            // 2. Prepare Data
            const quoteData = {
                carModelName: carModels.find(m => m.id === selectedModelId)?.name || 'VinFast',
                versionName: selectedVersionId ? carVersions.find(v => v.id === selectedVersionId)?.name : '',
                listPrice: selectedVersionId ? carVersions.find(v => v.id === selectedVersionId)?.price : 0,
                finalInvoicePrice,
                totalFees,
                finalRollingPrice,
                invoiceBreakdown: invoicePromoCalculation.breakdown,
                feeBreakdown: feeCalculation.breakdown,
                rollingBreakdown: rollingPromoCalculation.breakdown,
                activeGifts,
                membershipData: membershipCalculation,
                bankName: selectedBankId ? banks.find(b => b.id === selectedBankId)?.name : '',
                loanAmount,
                upfrontPayment,
                monthlyPaymentTable,
                userProfile,
                prepaidPercent,
                isRegistrationFree
            };

            // 3. Generate Assets if requested
            let assets = null;
            if (attachPDF) {
                assets = await generateQuoteAssets(quoteData);
            }

            // 4. Professional HTML Body
            const emailHtml = renderToStaticMarkup(
                <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', lineHeight: '1.6', color: '#1f2937', maxWidth: '600px', margin: '0 auto', fontSize: '15px' }}>

                    {/* Header Logo/Brand */}
                    <div style={{ padding: '24px 0', borderBottom: '2px solid #2563eb', textAlign: 'center' }}>
                        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 'bold', color: '#2563eb', letterSpacing: '-0.5px' }}>VINFAST AUTO</h1>
                        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Hệ thống Báo giá Online</p>
                    </div>

                    {/* Greeting */}
                    <div style={{ padding: '30px 20px', backgroundColor: '#ffffff' }}>
                        <p style={{ marginTop: 0 }}>Kính gửi Quý khách <strong>{customerName}</strong>,</p>

                        <p>Lời đầu tiên, <strong>VinFast</strong> xin gửi lời cảm ơn chân thành tới Quý khách vì đã quan tâm đến dòng xe <strong>{quoteData.carModelName}</strong>.</p>

                        <p>Theo yêu cầu của Quý khách, chúng tôi xin gửi kèm <strong>Báo giá chi tiết & Bảng tính dòng tiền trả góp</strong> (gồm File PDF và Hình ảnh) để Quý khách tham khảo.</p>

                        {/* Custom Message */}
                        {emailMessage && (
                            <div style={{ backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '16px', color: '#1e40af', margin: '24px 0', borderRadius: '0 8px 8px 0', fontStyle: 'italic' }}>
                                "{emailMessage}"
                            </div>
                        )}

                        <p style={{ marginBottom: 0 }}>Nếu cần thêm thông tin chi tiết hoặc hỗ trợ lái thử xe tận nhà, Quý khách vui lòng liên hệ trực tiếp với em qua số điện thoại bên dưới.</p>
                    </div>
                    {/* CTA Button */}
                    <div style={{ textAlign: 'center', margin: '10px 0 40px' }}>
                        <a href="https://vinfast-hcmc.com/" style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '14px 32px', borderRadius: '50px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)' }}>
                            Truy cập Website VinFast HCMC
                        </a>
                    </div>

                    {/* Footer / Signature */}
                    <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', padding: '24px', fontSize: '13px', color: '#4b5563', borderRadius: '0 0 12px 12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    <td style={{ verticalAlign: 'top', width: '60px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', overflow: 'hidden', lineHeight: '48px', textAlign: 'center' }}>
                                            {userProfile?.full_name?.charAt(0) || 'V'}
                                        </div>
                                    </td>
                                    <td style={{ verticalAlign: 'top', paddingLeft: '12px' }}>
                                        <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>{userProfile?.full_name || 'Tư vấn bán hàng'}</p>
                                        <p style={{ margin: '0 0 4px', color: '#2563eb', fontWeight: '500' }}>Tư vấn bán hàng - VinFast</p>
                                        <p style={{ margin: '0 0 2px' }}>Email: <a href={`mailto:${userProfile?.email}`} style={{ color: '#4b5563', textDecoration: 'none' }}>{userProfile?.email}</a></p>
                                        <p style={{ margin: '0 0 2px' }}>Hotline/Zalo: <a href={`tel:${userProfile?.phone}`} style={{ color: '#059669', fontWeight: 'bold', textDecoration: 'none' }}>{userProfile?.phone || 'Đang cập nhật'}</a></p>
                                        <p style={{ margin: '12px 0 0', fontSize: '12px', fontStyle: 'italic', color: '#9ca3af' }}>VinFast - Mãnh liệt tinh thần Việt Nam</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            );

            // 5. Send Request
            const attachments = [];
            if (assets) {
                // Add PDF
                attachments.push({
                    fileName: `BaoGia_VinFast_${quoteData.carModelName}.pdf`,
                    mimeType: 'application/pdf',
                    content: assets.pdf
                });
                // Add Image
                attachments.push({
                    fileName: `ChiTiet_BaoGia_${quoteData.carModelName}.jpg`,
                    mimeType: 'image/jpeg',
                    content: assets.img
                });
            }

            const payload = {
                type: 'send_email',
                recipientEmail: emailRecipient,
                subject: `Báo giá xe VinFast ${quoteData.carModelName} - Kính gửi ${customerName || 'Quý khách'}`,
                htmlBody: emailHtml,
                attachments: attachments
            };

            const response = await fetch(scriptUrl, {
                method: 'POST',
                // Quan trọng: Dùng text/plain để tránh CORS Preflight
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                alert(`Đã gửi báo giá (kèm PDF) tới ${emailRecipient} thành công!`);
                setShowEmailModal(false);
                setEmailRecipient('');
                setCustomerName('');
                setEmailMessage('');
            } else {
                console.error("Server Response Error:", result);
                throw new Error(result.message || JSON.stringify(result) || 'Unknown error');
            }

        } catch (e: any) {
            console.error(e);
            alert('Lỗi khi gửi email: ' + (e.message || e));
            if (e.message && e.message.includes("Invalid request format")) {
                alert("GỢI Ý: Bạn cần cập nhật Google Apps Script lên phiên bản v4 (Hỗ trợ Attachments).");
            }
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto pb-20">
            <div className="mb-4">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    Quay lại
                </button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Calculator className="text-emerald-600" /> Báo Giá Online
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Tạo báo giá, tính lăn bánh & dự tính trả góp.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => navigate('/bank-calculator', {
                            state: {
                                initialLoanAmount: loanAmount,
                                bankName: selectedBank?.name,
                                bankPackage: selectedBank?.packages?.[selectedPackageIndex]
                            }
                        })}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all shadow-sm group"
                    >
                        <TableProperties size={16} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                        Tính lãi Bank
                    </button>
                    <div className="w-px h-8 bg-gray-300 mx-1"></div>
                    <button onClick={() => handleExportQuote('image')} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 shadow-sm text-sm transition-all">
                        <FileImage size={16} /> Lưu Ảnh
                    </button>
                    <div className="flex items-center gap-1">
                        <button onClick={handleEmailButtonClick} className={`flex items-center gap-2 px-3 py-2 border rounded-xl font-bold shadow-sm text-sm transition-all ${isDiamond ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 cursor-not-allowed'}`}>
                            <Mail size={16} /> Gửi Email
                            {!isDiamond && <Lock size={12} className="ml-1" />}
                        </button>

                        {/* Debug Button (Small) - Only show for Admin */}
                        {userProfile?.role === 'admin' && (
                            <button onClick={handleTestEmailConnection} className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Test Kết nối Email (Admin Only)">
                                <Settings2 size={16} />
                            </button>
                        )}
                    </div>
                    <button onClick={() => handleExportQuote('pdf')} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg text-sm transition-all">
                        <FileText size={16} /> Xuất PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LEFT COLUMN: CONFIGURATION */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Car Selection */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Car size={18} /> Chọn xe</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Dòng xe</label>
                                <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium" value={selectedModelId} onChange={e => setSelectedModelId(e.target.value)}>
                                    <option value="">-- Chọn dòng xe --</option>
                                    {carModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Phiên bản</label>
                                <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium" value={selectedVersionId} onChange={e => setSelectedVersionId(e.target.value)} disabled={!selectedModelId}>
                                    <option value="">-- Chọn phiên bản --</option>
                                    {carVersions.filter(v => v.model_id === selectedModelId).map(v => <option key={v.id} value={v.id}>{v.name} ({formatCurrency(v.price)})</option>)}
                                </select>
                            </div>

                            {/* PREMIUM COLOR CHECKBOX */}
                            {selectedVersion && selectedVersion.premium_color_amount != null && selectedVersion.premium_color_amount > 0 && (
                                <div className="pt-3 border-t border-gray-100 mt-3">
                                    <label className="flex items-center justify-between cursor-pointer p-3 border border-orange-200 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={includePremiumColor}
                                                onChange={(e) => setIncludePremiumColor(e.target.checked)}
                                                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                                            />
                                            <span className="text-sm font-bold text-orange-800">Màu nâng cao</span>
                                        </div>
                                        <span className="text-sm font-bold text-orange-600">+{formatCurrency(selectedVersion.premium_color_amount)} VNĐ</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MEMBERSHIP & INSURANCE */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Crown size={18} /> Hạng Khách hàng</h3>
                        <div className="space-y-2 mb-4">
                            <label className="flex items-center gap-3 cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="membership"
                                    className="w-4 h-4 text-emerald-600"
                                    checked={selectedMembershipId === ''}
                                    onChange={() => setSelectedMembershipId('')}
                                />
                                <span className="text-sm text-gray-700">Khách hàng thông thường</span>
                            </label>
                            {memberships.map(m => (
                                <label key={m.id} className="flex items-center gap-3 cursor-pointer p-2 border border-yellow-200 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                                    <input
                                        type="radio"
                                        name="membership"
                                        className="w-4 h-4 text-emerald-600"
                                        checked={selectedMembershipId === m.id}
                                        onChange={() => setSelectedMembershipId(m.id)}
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-gray-800">{m.name}</span>
                                        <div className="text-xs text-gray-600 flex gap-2">
                                            <span>Giảm: <strong>{m.value}%</strong></span>
                                            {m.gift_ratio && <span>+ Tặng thêm: <strong>{m.gift_ratio}%</strong></span>}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* INSURANCE CHECKBOX */}
                        <div className="pt-4 border-t border-gray-100">
                            <h4 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-2"><ShieldCheck size={16} /> Bảo hiểm thân vỏ</h4>
                            <div className="flex items-center justify-between p-2 border border-blue-100 bg-blue-50 rounded-lg">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={includeInsurance}
                                        onChange={(e) => setIncludeInsurance(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-bold text-blue-800">Mua Bảo Hiểm</span>
                                </label>
                                {includeInsurance && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            step="any"
                                            value={insuranceRate}
                                            onChange={(e) => setInsuranceRate(e.target.value)}
                                            onBlur={() => {
                                                // Normalize on blur: 1,2 -> 1.2
                                                // Handle empty/invalid cases gracefully
                                                if (!insuranceRate) return;
                                                const parsed = parseFloat(insuranceRate.replace(',', '.'));
                                                if (!isNaN(parsed)) setInsuranceRate(parsed.toString());
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="w-20 px-2 py-1 text-sm text-right font-bold border border-blue-200 rounded outline-none"
                                        />
                                        <span className="text-xs font-bold text-blue-600">%</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* NEW: QUICK REGISTRATION FEE LOOKUP */}
                        <div className="pt-4 border-t border-gray-100 relative">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Search size={16} /> Tra cứu Phí đăng ký</h4>
                            </div>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-2"
                                placeholder="Nhập tỉnh/thành (VD: HCM, Đồng Nai...)"
                                value={feeSearch}
                                onChange={(e) => {
                                    setFeeSearch(e.target.value);
                                    setShowFeeList(true);
                                }}
                                onFocus={() => setShowFeeList(true)}
                                onBlur={() => setTimeout(() => setShowFeeList(false), 200)}
                            />
                            {showFeeList && feeSearch && (
                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                                    {filteredRegFees.length > 0 ? (
                                        filteredRegFees.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-50 last:border-0"
                                                onMouseDown={() => {
                                                    setManualServiceFee(item.value.toLocaleString('vi-VN'));
                                                    setFeeSearch('');
                                                    setShowFeeList(false);
                                                }}
                                            >
                                                <div className="font-bold text-gray-800">{item.label}</div>
                                                <div className="text-blue-600 font-bold">{item.value.toLocaleString('vi-VN')} VNĐ</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-xs text-gray-500">Không tìm thấy kết quả.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* FEE OPTIONS (Plate, TNDS...) */}
                    {fees.some(f => f.options && f.options.length > 0) && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MapPin size={18} /> Khu vực & Phí khác</h3>
                            <div className="space-y-4">
                                {fees.filter(f => f.options && f.options.length > 0).map(f => (
                                    <div key={f.id}>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">{f.name}</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium"
                                            value={feeOptions[f.id] || (f.options && f.options[0]?.value)}
                                            onChange={(e) => setFeeOptions({ ...feeOptions, [f.id]: Number(e.target.value) })}
                                        >
                                            {f.options?.map((opt, idx) => (
                                                <option key={idx} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            {/* FREE REGISTRATION CHECKBOX */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer bg-green-50 p-2 rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isRegistrationFree}
                                        onChange={(e) => setIsRegistrationFree(e.target.checked)}
                                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                    />
                                    <span className="text-sm font-bold text-green-800 flex-1">Tặng 100% Phí đăng ký</span>
                                    {isRegistrationFree && <span className="text-xs font-bold text-green-600 bg-white px-2 py-0.5 rounded">Đã áp dụng</span>}
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Promotions */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18} /> Khuyến mãi áp dụng</h3>
                        {availablePromos.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Không có khuyến mãi cho dòng xe này.</p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {availablePromos.map(p => (
                                    <div key={p.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setAppliedPromos(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${appliedPromos.includes(p.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                                            {appliedPromos.includes(p.id) && <Check size={14} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-800">{p.name}</p>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <p className="text-xs text-emerald-600 font-bold">Giảm {p.value_type === 'percent' ? `${p.value}%` : formatCurrency(p.value)}</p>
                                                {p.target_type === 'rolling' && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 rounded uppercase font-bold">Lăn bánh</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* MANUAL DISCOUNT FIELD */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Giảm giá thêm (VNĐ)</label>

                            {/* Discount Type Selector */}
                            <div className="flex gap-4 mb-2">
                                <label className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${manualDiscountType === 'invoice' ? 'bg-red-50 border-red-200 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                                        checked={manualDiscountType === 'invoice'}
                                        onChange={() => setManualDiscountType('invoice')}
                                    />
                                    <span>Trừ vào XHĐ</span>
                                </label>
                                <label className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${manualDiscountType === 'rolling' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                                        checked={manualDiscountType === 'rolling'}
                                        onChange={() => setManualDiscountType('rolling')}
                                    />
                                    <span>Giá lăn bánh</span>
                                </label>
                            </div>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-bold text-red-600"
                                value={manualDiscount}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setManualDiscount(val ? Number(val).toLocaleString('vi-VN') : '');
                                }}
                                placeholder="Nhập số tiền giảm thêm..."
                            />
                            <p className="text-xs text-gray-400 mt-1 italic">Số tiền này sẽ trừ vào giá Lăn bánh cuối cùng.</p>
                        </div>
                    </div>

                    {/* Bank Config */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Landmark size={18} /> Vay Ngân hàng</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Ngân hàng</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {banks.map(b => (
                                        <button
                                            key={b.id}
                                            onClick={() => setSelectedBankId(b.id)}
                                            className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${selectedBankId === b.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {b.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Package Selection */}
                            {selectedBank && selectedBank.packages && selectedBank.packages.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Gói lãi suất</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none text-sm font-medium"
                                        value={selectedPackageIndex}
                                        onChange={e => setSelectedPackageIndex(Number(e.target.value))}
                                    >
                                        {selectedBank.packages.map((pkg, idx) => (
                                            <option key={idx} value={idx}>{pkg.name} ({pkg.rate}%)</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="block text-sm font-bold text-gray-600">Trả trước (theo XHĐ)</label>
                                    <span className="text-sm font-bold text-blue-600">{prepaidPercent}%</span>
                                </div>

                                {/* Slider */}
                                <input type="range" min="15" max="95" step="5" value={prepaidPercent} onChange={e => handlePrepaidPercentChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2" />
                                <div className="flex justify-between text-xs text-gray-400 mb-2"><span>15%</span><span>50%</span><span>95%</span></div>

                                {/* Manual Prepaid Input */}
                                <label className="block text-xs font-bold text-gray-500 mb-1">Hoặc nhập số tiền (VNĐ)</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-bold text-gray-800"
                                    value={manualPrepaidAmount !== null ? formatCurrency(manualPrepaidAmount) : ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        handleManualPrepaidChange(val ? Number(val) : 0);
                                    }}
                                    placeholder={formatCurrency(finalInvoicePrice * (prepaidPercent / 100))}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: QUOTE SHEET (VISUAL) */}
                <div className="lg:col-span-7">
                    <div ref={quoteRef} className="bg-[#e6fffa] border-2 border-emerald-500 rounded-2xl overflow-hidden shadow-xl sticky top-6">
                        {/* Header Image Area */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-extrabold uppercase tracking-tight">Báo Giá Xe {carModels.find(m => m.id === selectedModelId)?.name || 'VinFast'}</h2>
                                <p className="text-emerald-100 font-medium text-lg mt-1">{selectedVersion?.name || 'Vui lòng chọn phiên bản'}</p>

                                {/* Specs Summary */}
                                {selectedVersion && (
                                    <div className="mt-4 grid grid-cols-2 gap-y-1 text-sm font-medium text-white/90">
                                        <div className="flex items-center gap-1"><CheckCircle2 size={14} /> Giá niêm yết: {formatCurrency(listPrice)}</div>
                                        <div className="flex items-center gap-1"><ShieldCheck size={14} /> {getWarrantyPeriod(selectedModelId)}</div>
                                    </div>
                                )}
                            </div>
                            <Car className="absolute -right-6 -bottom-6 text-white opacity-20 w-48 h-48 transform -rotate-12" />
                        </div>

                        <div className="p-6 space-y-6">
                            {/* 1. PRICE & PROMOS (INVOICE TARGET) */}
                            <div>
                                <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                    <span className="text-sm font-bold text-gray-500 uppercase">Giá xe (Hóa đơn)</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-800">Giá Niêm Yết</span>
                                        <span className="font-bold text-gray-900">{formatCurrency(listPrice)} VNĐ</span>
                                    </div>
                                    {invoicePromoCalculation.breakdown.map((p, idx) => (
                                        <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-emerald-300">
                                            <span>• {p.name}</span>
                                            <span className="font-bold text-red-500">-{formatCurrency(p.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between pt-2 mt-2 border-t border-dashed border-emerald-300">
                                        <span className="font-extrabold text-blue-600 uppercase">GIÁ XUẤT HÓA ĐƠN</span>
                                        <span className="font-extrabold text-blue-600 text-lg">{formatCurrency(finalInvoicePrice)} VNĐ</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. FEES - UPDATED WITH OPTIONS */}
                            <div>
                                <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                    <span className="text-sm font-bold text-gray-500 uppercase">Chi phí lăn bánh (Dự kiến)</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    {fees.map((f) => (
                                        <div key={f.id} className="flex justify-between items-center group">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-700 font-medium">{f.name}</span>
                                                {/* Show Dropdown if Options exist */}
                                                {f.options && f.options.length > 0 && (
                                                    <select
                                                        className="bg-gray-50 border border-gray-300 text-gray-800 text-xs rounded p-1 outline-none font-bold"
                                                        value={feeOptions[f.id] || f.options[0].value}
                                                        onChange={(e) => setFeeOptions({ ...feeOptions, [f.id]: Number(e.target.value) })}
                                                    >
                                                        {f.options.map((opt, idx) => (
                                                            <option key={idx} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Editable Fee if no options */}
                                                <input
                                                    className="text-right font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-emerald-500 focus:bg-white w-28 outline-none transition-all"
                                                    value={formatCurrency(
                                                        (f.options && f.options.length > 0) ? (feeOptions[f.id] || 0) : (customFees[f.id] !== undefined ? customFees[f.id] : f.value)
                                                    )}
                                                    onChange={(e) => {
                                                        // Only allow manual edit if NOT options based
                                                        if (!f.options || f.options.length === 0) {
                                                            const val = Number(e.target.value.replace(/\./g, ''));
                                                            if (!isNaN(val)) setCustomFees({ ...customFees, [f.id]: val });
                                                        }
                                                    }}
                                                    disabled={!!f.options && f.options.length > 0}
                                                />
                                                <span className="text-gray-500 text-xs">VNĐ</span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* MANUAL SERVICE FEE INPUT */}
                                    <div className="flex justify-between items-center group pt-1">
                                        <span className="text-gray-700 font-medium">Dịch vụ đăng ký (Khác)</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="text-right font-bold text-blue-600 bg-blue-50/50 border-b border-blue-200 focus:border-blue-500 w-28 outline-none transition-all"
                                                value={manualServiceFee}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setManualServiceFee(val ? Number(val).toLocaleString('vi-VN') : '');
                                                }}
                                                placeholder="0"
                                            />
                                            <span className="text-gray-500 text-xs">VNĐ</span>
                                        </div>
                                    </div>

                                    {/* NEW: Insurance Line Visible in Preview when Checked */}
                                    {includeInsurance && (
                                        <div className="flex justify-between items-center group pt-1">
                                            <span className="text-gray-700 font-medium">Bảo hiểm 2 chiều ({insuranceRate}%)</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-right font-bold text-gray-800 w-28">{formatCurrency(finalInvoicePrice * ((parseFloat(String(insuranceRate).replace(',', '.')) || 0) / 100))}</span>
                                                <span className="text-gray-500 text-xs">VNĐ</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                                        <span className="font-bold text-gray-600 uppercase">TỔNG PHÍ ĐĂNG KÝ</span>
                                        <span className="font-bold text-gray-800">{formatCurrency(totalFees)} VNĐ</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. ROLLING PROMOS */}
                            {(rollingPromoCalculation.totalDiscount > 0 || isRegistrationFree) && (
                                <div>
                                    <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                        <span className="text-sm font-bold text-gray-500 uppercase">Ưu đãi Lăn bánh / Giảm thêm</span>
                                    </div>
                                    <div className="space-y-2">
                                        {isRegistrationFree && (
                                            <div className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-green-500 bg-green-50/50 p-1 rounded-r">
                                                <span>• Tặng 100% Phí Đăng ký</span>
                                                <span className="font-bold text-green-600">-{formatCurrency(totalFees)}</span>
                                            </div>
                                        )}
                                        {rollingPromoCalculation.breakdown.map((p, idx) => (
                                            <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-orange-300">
                                                <span>• {p.name}</span>
                                                <span className="font-bold text-red-500">-{formatCurrency(p.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 4. TOTAL ROLLING */}
                            <div className="bg-white p-4 rounded-xl border-2 border-red-100 text-center shadow-inner">
                                <p className="text-gray-500 font-bold uppercase text-xs">TỔNG CỘNG LĂN BÁNH</p>
                                <p className="text-3xl font-extrabold text-red-600 tracking-tight">{formatCurrency(finalRollingPrice)} VNĐ</p>
                                <p className="text-[10px] text-gray-400 mt-1">(Đã bao gồm Giá xe + Phí - Khuyến mãi)</p>
                            </div>

                            {/* 5. GIFTS & MEMBERSHIP BONUS (UPDATED with VinPoint) */}
                            {(activeGifts.length > 0 || membershipCalculation.giftValue > 0) && (
                                <div>
                                    <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                        <span className="text-sm font-bold text-gray-500 uppercase flex items-center gap-1"><Gift size={14} /> QUÀ TẶNG & ƯU ĐÃI THÊM</span>
                                    </div>
                                    <div className="space-y-2">
                                        {activeGifts.map((g, idx) => (
                                            <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-purple-300">
                                                <span>• {g.label}</span>
                                                {g.isVinPoint ? (
                                                    <span className="font-bold text-yellow-600 flex items-center gap-1"><Coins size={12} /> {formatCurrency(g.value)} điểm</span>
                                                ) : (
                                                    <span className="font-bold text-purple-600">{g.value > 0 ? formatCurrency(g.value) : 'Hiện vật'}</span>
                                                )}
                                            </div>
                                        ))}
                                        {membershipCalculation.giftValue > 0 && (
                                            <div className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-yellow-300">
                                                <span>• Ưu đãi {membershipCalculation.name} (Tặng thêm {membershipCalculation.giftPercent}%)</span>
                                                <span className="font-bold text-green-600">+{formatCurrency(membershipCalculation.giftValue)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 6. BANK PREVIEW (UPDATED) */}
                            {selectedBank && loanAmount > 0 && (
                                <div className="bg-white rounded-xl overflow-hidden border border-blue-100">
                                    <div className="bg-blue-50 p-3 flex items-center justify-between border-b border-blue-100">
                                        <div className="flex items-center gap-2 text-blue-800 font-bold"><Landmark size={18} /> BẢNG TÍNH VAY NGÂN HÀNG</div>
                                        <div className="text-xs font-bold bg-white text-blue-600 px-2 py-1 rounded border border-blue-200">
                                            {selectedBank?.packages?.[selectedPackageIndex]?.name || (currentInterestRate > 0 ? `Lãi ${currentInterestRate}%` : 'Chưa có lãi suất')}
                                        </div>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-6 bg-blue-50/30">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Thanh toán đối ứng</p>
                                            <p className="text-lg font-bold text-red-600">{formatCurrency(upfrontPayment)}</p>
                                            <p className="text-[10px] text-gray-400">(Lăn bánh - Vay)</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-bold">Số tiền vay</p>
                                            <p className="text-lg font-bold text-blue-600">{formatCurrency(loanAmount)}</p>
                                            <p className="text-[10px] text-gray-400">({prepaidPercent}% Trả trước)</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 border-t border-gray-100">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-3 text-center">ƯỚC TÍNH TRẢ GÓP (GỐC + LÃI THÁNG ĐẦU)</p>
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            {monthlyPaymentTable.map(row => (
                                                <div key={row.year} className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                    <p className="text-[10px] text-gray-500 font-bold mb-1">{row.year} Năm</p>
                                                    <p className="text-sm font-bold text-blue-700">{formatCurrency(row.monthly)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-center text-gray-400 mt-3 italic flex items-center justify-center gap-1">
                                            <AlertCircle size={10} /> Số tiền tính theo dư nợ giảm dần, lãi suất thả nổi sau ưu đãi.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showEmailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in relative z-[10000]">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Mail className="text-primary-600" /> Gửi Báo Giá
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tên khách hàng</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-primary-500"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="VD: Nguyễn Văn A"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Email nhận <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-primary-500"
                                    value={emailRecipient}
                                    onChange={e => setEmailRecipient(e.target.value)}
                                    placeholder="khachhang@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Lời nhắn (Tùy chọn)</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-primary-500 text-sm h-20 resize-none"
                                    value={emailMessage}
                                    onChange={e => setEmailMessage(e.target.value)}
                                    placeholder="Nhập lời nhắn cá nhân tới khách hàng..."
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                                <input
                                    type="checkbox"
                                    checked={attachPDF}
                                    onChange={e => setAttachPDF(e.target.checked)}
                                    className="w-4 h-4 text-emerald-600 rounded"
                                />
                                <span className="text-sm text-gray-700 font-medium">Đính kèm file PDF + Hình ảnh Báo Giá</span>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowEmailModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                                >
                                    Đóng
                                </button>
                                <button
                                    onClick={handleSendEmail}
                                    disabled={sendingEmail || !emailRecipient}
                                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {sendingEmail ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
                                    Gửi Ngay
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnlineQuote;


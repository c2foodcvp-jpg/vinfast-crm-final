
import React, { useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Calculator, Percent, FileImage, Settings2, TableProperties, Loader2, ArrowLeft, Lock, ArrowUpCircle, FileText, Mail
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { MembershipTier, UserRole } from '../types';

const BankCalculator: React.FC = () => {
    const { userProfile } = useAuth();
    const resultRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [isExporting, setIsExporting] = useState(false);

    // --- EMAIL STATE ---
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [emailMessage, setEmailMessage] = useState(''); // Lời nhắn
    const [sendingEmail, setSendingEmail] = useState(false);

    // Diamond Check for Email Feature
    const isDiamond = userProfile?.member_tier === MembershipTier.DIAMOND ||
        userProfile?.role === UserRole.ADMIN ||
        userProfile?.role === UserRole.MOD;

    // Check if user is locked from using this page (Restricted to Platinum+)
    const isPlatinumOrHigher =
        userProfile?.member_tier === MembershipTier.PLATINUM ||
        userProfile?.member_tier === MembershipTier.DIAMOND ||
        userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.MOD; // Allow Admin/Mod

    if (!isPlatinumOrHigher) {
        return (
            <div className="max-w-2xl mx-auto mt-20 p-8 bg-white border border-gray-100 rounded-3xl text-center shadow-xl">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock className="text-gray-400" size={32} />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Tính năng giới hạn</h2>
                <p className="text-gray-500 mb-6">
                    Công cụ Tính Lãi Bank chỉ dành cho thành viên hạng
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

    // Define navigation state interface
    interface BankCalcState {
        initialLoanAmount?: number | string;
        bankName?: string;
        bankPackage?: { name: string; rate: number };
    }

    // Helper to parse duration from package name (e.g., "Cố định 3 năm" -> 36 months)
    const parseDurationFromPackage = (name?: string): number => {
        if (!name) return 12;
        const match = name.match(/(\d+)\s*năm/i);
        if (match) return parseInt(match[1]) * 12;
        const monthMatch = name.match(/(\d+)\s*tháng/i);
        if (monthMatch) return parseInt(monthMatch[1]);
        return 12; // Default to 12 months
    };

    const navState = location.state as BankCalcState;
    const prefilledSource = navState?.bankName && navState?.bankPackage
        ? `${navState.bankName} - ${navState.bankPackage.name}`
        : null;

    // --- INPUT STATES ---
    const [loanAmount, setLoanAmount] = useState<string>(() => {
        if (navState?.initialLoanAmount) {
            const raw = navState.initialLoanAmount.toString().replace(/\./g, '');
            const num = Number(raw);
            if (!isNaN(num)) return num.toLocaleString('vi-VN').replace(/,/g, '.');
        }
        return '500.000.000';
    });
    const [loanTermYears, setLoanTermYears] = useState<number>(8);
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Scenarios: 1, 2, or 3 stages
    const [numStages, setNumStages] = useState<1 | 2 | 3>(2);

    // Phase 1 (Fixed) - Initialize from bankPackage if available
    const [phase1Rate, setPhase1Rate] = useState<string>(() =>
        (navState?.bankPackage?.rate ?? 7.5).toString()
    );
    const [phase1Duration, setPhase1Duration] = useState<number>(() =>
        parseDurationFromPackage(navState?.bankPackage?.name) || 12
    );

    // Phase 2 (Intermediate or Floating)
    const [phase2Rate, setPhase2Rate] = useState<string>('8.5');
    const [phase2Duration, setPhase2Duration] = useState<number>(12); // months

    // Final Stage (Floating)
    const [floatingRate, setFloatingRate] = useState<string>('10.5');

    // Prepayment Penalty Settings
    const [penalties, setPenalties] = useState<number[]>([4, 3, 2, 1, 0]);

    // Helper
    const formatCurrency = (n: number) => Math.round(n).toLocaleString('vi-VN');
    const parseAmount = (s: string) => Number(s.replace(/\D/g, ''));

    // --- CALCULATION LOGIC ---
    const schedule = useMemo(() => {
        const amount = parseAmount(loanAmount);
        const totalMonths = loanTermYears * 12;
        if (amount <= 0 || totalMonths <= 0) return [];

        const rows = [];
        let currentBalance = amount;
        const monthlyPrincipal = amount / totalMonths;
        const start = new Date(startDate);

        for (let i = 1; i <= totalMonths; i++) {
            const monthDate = new Date(start.getFullYear(), start.getMonth() + i - 1, 1);
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

            // Determine Interest Rate based on stages
            let currentAnnualRate = parseFloat(floatingRate.replace(',', '.'));
            if (numStages >= 2 && i <= phase1Duration) {
                currentAnnualRate = parseFloat(phase1Rate.replace(',', '.'));
            } else if (numStages === 3 && i <= (phase1Duration + phase2Duration)) {
                currentAnnualRate = parseFloat(phase2Rate.replace(',', '.'));
            }

            // Fallback for check
            if (isNaN(currentAnnualRate)) currentAnnualRate = 0;

            const monthlyInterest = currentBalance * (currentAnnualRate / 100 / 12);
            const totalPayment = monthlyPrincipal + monthlyInterest;

            // Settlement Fee Logic
            const currentYear = Math.ceil(i / 12);
            const penaltyPercent = penalties[currentYear - 1] || 0;
            const settlementFee = currentBalance * (penaltyPercent / 100);

            rows.push({
                monthIndex: i,
                date: monthDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
                daysInMonth,
                currentBalance,
                principal: monthlyPrincipal,
                interest: monthlyInterest,
                total: totalPayment,
                remaining: Math.max(0, currentBalance - monthlyPrincipal),
                settlementFee,
                penaltyPercent
            });

            currentBalance -= monthlyPrincipal;
        }

        return rows;
    }, [loanAmount, loanTermYears, startDate, numStages, phase1Rate, phase1Duration, phase2Rate, phase2Duration, floatingRate, penalties]);

    const totals = useMemo(() => {
        const interest = schedule.reduce((sum, r) => sum + r.interest, 0);
        const firstMonth = schedule[0]?.total || 0;
        return { interest, total: parseAmount(loanAmount) + interest, firstMonth };
    }, [schedule, loanAmount]);

    // --- TEST CONNECTION ---
    const handleTestEmailConnection = async () => {
        try {
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'email_script_url')
                .maybeSingle();

            const scriptUrl = settingData?.value;
            if (!scriptUrl) {
                alert('LỖI: Chưa cấu hình URL gửi email (key: email_script_url).');
                return;
            }

            const maskedUrl = scriptUrl.substring(0, 30) + '...';
            if (!confirm(`Đang test kết nối tới: ${maskedUrl}\n\nNhấn OK để tiếp tục.`)) return;

            const response = await fetch(scriptUrl);
            if (!response.ok) throw new Error(response.statusText);
            const text = await response.text();
            alert('✅ KẾT NỐI THÀNH CÔNG!\n\n' + text);
        } catch (e: any) {
            alert('❌ KẾT NỐI THẤT BẠI: ' + e.message);
        }
    };

    // --- SEND EMAIL LOGIC ---
    const handleSendEmail = async () => {
        if (!emailRecipient) {
            alert('Vui lòng nhập địa chỉ Email!');
            return;
        }

        setSendingEmail(true);
        try {
            // 1. Get Script URL
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

            // 2. HTML Content
            const emailHtml = renderToStaticMarkup(
                <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f3f4f6' }}>
                    <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ padding: '20px', backgroundColor: '#2563eb', color: '#ffffff', textAlign: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '24px' }}>Bảng Tính Trả Góp VinFast</h2>
                            <p style={{ margin: '5px 0 0', opacity: 0.9 }}>Kính gửi: {customerName || 'Quý khách hàng'}</p>
                        </div>

                        <div style={{ padding: '20px' }}>
                            {/* SUMMARY */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#1e40af', fontWeight: 'bold' }}>SỐ TIỀN VAY</p>
                                    <p style={{ margin: '5px 0 0', fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a' }}>{loanAmount} VNĐ</p>
                                </div>
                                <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#1e40af', fontWeight: 'bold' }}>THỜI HẠN VAY</p>
                                    <p style={{ margin: '5px 0 0', fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a' }}>{loanTermYears} Năm</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '30px' }}>
                                <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Tổng lãi</p>
                                    <p style={{ margin: '5px 0 0', fontWeight: 'bold', color: '#059669' }}>{formatCurrency(totals.interest)}</p>
                                </div>
                                <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Tổng gốc + lãi</p>
                                    <p style={{ margin: '5px 0 0', fontWeight: 'bold', color: '#111827' }}>{formatCurrency(totals.total)}</p>
                                </div>
                                <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Tháng đầu trả</p>
                                    <p style={{ margin: '5px 0 0', fontWeight: 'bold', color: '#dc2626' }}>{formatCurrency(totals.firstMonth)}</p>
                                </div>
                            </div>

                            {/* TABLE */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={{ padding: '10px', textAlign: 'left', color: '#6b7280' }}>Kỳ</th>
                                        <th style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>Dư nợ</th>
                                        <th style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>Gốc</th>
                                        <th style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>Lãi</th>
                                        <th style={{ padding: '10px', textAlign: 'right', color: '#1d4ed8', backgroundColor: '#eff6ff' }}>Tổng trả</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedule.map((row) => (
                                        <tr key={row.monthIndex} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '8px 10px', color: '#374151', fontWeight: 'bold' }}>{row.monthIndex}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#4b5563' }}>{formatCurrency(row.currentBalance)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#111827' }}>{formatCurrency(row.principal)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669' }}>{formatCurrency(row.interest)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#1d4ed8', backgroundColor: '#eff6ff' }}>{formatCurrency(row.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
                            <p>Email này được gửi tự động từ hệ thống VinFast CRM.</p>
                        </div>
                    </div>
                </div>
            );

            // 3. Send
            const response = await fetch(scriptUrl, {
                method: 'POST',
                // Quan trọng: Dùng text/plain để tránh CORS Preflight
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    type: 'send_email',
                    recipientEmail: emailRecipient,
                    subject: `[VinFast] Bảng tính trả góp - ${customerName || 'Khách hàng'}`,
                    htmlBody: emailHtml
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                alert(`Đã gửi bảng tính tới ${emailRecipient} thành công!`);
                setShowEmailModal(false);
                setEmailRecipient('');
                setCustomerName('');
            } else {
                console.error("Server Response Error:", result);
                throw new Error(result.message || JSON.stringify(result) || 'Unknown error');
            }

        } catch (e: any) {
            console.error(e);
            alert('Lỗi khi gửi email: ' + (e.message || e));
            // Detailed message for users
            if (e.message && e.message.includes('Failed to fetch')) {
                alert('⚠️ LỖI KẾT NỐI: Không thể kết nối tới Google Apps Script.\n\nNguyên nhân có thể:\n1. URL Script chưa đúng trong Cài đặt chung.\n2. Script chưa được Public "Anyone" (Ai cũng có thể truy cập).\n3. Mạng bị chặn.');
            }
        } finally {
            setSendingEmail(false);
        }
    };

    const handleExportImage = async () => {
        if (!resultRef.current || isExporting) return;

        setIsExporting(true);
        try {
            const canvas = await html2canvas(resultRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1600, // Force desktop width
                onclone: (clonedDoc) => {
                    const tableContainer = clonedDoc.getElementById('repayment-table-container');
                    if (tableContainer) {
                        tableContainer.style.maxHeight = 'none';
                        tableContainer.style.overflow = 'visible';
                        tableContainer.style.width = 'auto'; // Allow expansion
                    }

                    // Hide summary section if requested, but for Image user might want it? 
                    // User said "Xuất PDF... không cần hiện 3 ô". I will keep it in Image for now unless asked.
                    // Wait, usually users want consistency. But specifically PDF was mentioned.
                    // I will leave Image alone for now regarding hiding, but fix the cut-off/overflow logic.

                    // Thêm tiêu đề chuyên nghiệp vào bản clone
                    const header = clonedDoc.createElement('div');
                    header.innerHTML = `
                    <div style="padding: 20px; border-bottom: 2px solid #2462bd; margin-bottom: 20px; text-align: center;">
                        <h1 style="color: #2462bd; font-size: 24px; font-weight: bold; margin: 0;">BẢNG TÍNH LÃI SUẤT TRẢ GÓP VINFAST</h1>
                        <p style="color: #666; margin: 5px 0;">Ngày xuất: ${new Date().toLocaleString('vi-VN')}</p>
                    </div>
                `;
                    resultRef.current && clonedDoc.getElementById('export-container')?.prepend(header);
                }
            });

            const link = document.createElement('a');
            link.download = `BangTinhLai_VinFast_${new Date().getTime()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        } catch (err) {
            console.error("Export failed", err);
            alert("Lỗi khi xuất ảnh. Vui lòng thử lại.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!resultRef.current || isExporting) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(resultRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1600, // Force desktop width to prevent cut-off
                onclone: (clonedDoc) => {
                    const tableContainer = clonedDoc.getElementById('repayment-table-container');
                    if (tableContainer) {
                        tableContainer.style.maxHeight = 'none';
                        tableContainer.style.overflow = 'visible';
                        tableContainer.style.width = '100%'; // Ensure table takes full width
                    }

                    // Hide summary section for PDF
                    const summary = clonedDoc.getElementById('summary-section');
                    if (summary) {
                        summary.remove();
                    }

                    const header = clonedDoc.createElement('div');
                    header.innerHTML = `
                        <div style="padding: 20px; border-bottom: 2px solid #2462bd; margin-bottom: 20px; text-align: center;">
                             <h1 style="color: #2462bd; font-size: 24px; font-weight: bold; margin: 0;">BẢNG TÍNH LÃI SUẤT TRẢ GÓP VINFAST</h1>
                             <p style="color: #666; margin: 5px 0;">Ngày xuất: ${new Date().toLocaleString('vi-VN')}</p>
                        </div>
                    `;
                    clonedDoc.getElementById('export-container')?.prepend(header);
                }
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
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
                position = heightLeft - imgHeight; // Calculate position for negative offset
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`BangTinhLai_VinFast_${new Date().getTime()}.pdf`);

        } catch (err) {
            console.error("Export PDF failed", err);
            alert("Lỗi khi xuất PDF. Vui lòng thử lại.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleEmailButtonClick = () => {
        if (isDiamond) {
            setShowEmailModal(true);
        } else {
            alert('🔒 TÍNH NĂNG CAO CẤP\n\nBạn cần đạt hạng DIAMOND (Kim Cương) để sử dụng tính năng Gửi Email này.\n\nVui lòng liên hệ Admin để nâng cấp!');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/quote')}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                    >
                        <ArrowLeft size={16} />
                        Báo giá
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Calculator className="text-primary-600" /> Bảng tính lãi suất Ngân hàng
                        </h1>
                        <p className="text-gray-500">Phân tích dòng tiền trả nợ theo dư nợ giảm dần.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportImage}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-200 transition-all disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileImage size={18} />}
                        Xuất Ảnh
                    </button>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleEmailButtonClick}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-sm transition-all ${isDiamond ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                        >
                            <Mail size={18} /> Gửi Email
                            {!isDiamond && <Lock size={14} className="ml-1" />}
                        </button>

                        {userProfile?.role === 'admin' && (
                            <button onClick={handleTestEmailConnection} className="p-2 text-indigo-300 hover:text-indigo-600 transition-colors" title="Test Kết nối Email (Admin Only)">
                                <Settings2 size={18} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg disabled:opacity-50 transition-all"
                    >
                        {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                        Xuất PDF
                    </button>
                </div>
            </div>

            {/* Pre-filled Source Notice */}
            {prefilledSource && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <Percent size={18} className="text-indigo-600 flex-shrink-0" />
                    <div>
                        <span className="font-bold text-indigo-900">Đã áp dụng từ Báo giá: </span>
                        <span className="text-indigo-700">{prefilledSource}</span>
                        <span className="text-indigo-500 text-sm ml-2">(Lãi suất: {phase1Rate}% | {phase1Duration} tháng)</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT: CONTROLS */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                            <Settings2 size={18} className="text-primary-600" /> Cấu hình khoản vay
                        </h3>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số tiền vay (VNĐ)</label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 font-bold text-lg text-primary-700"
                                value={loanAmount}
                                onChange={e => setLoanAmount(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thời hạn (Năm)</label>
                                <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none" value={loanTermYears} onChange={e => setLoanTermYears(Number(e.target.value))}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(y => <option key={y} value={y}>{y} Năm</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày bắt đầu</label>
                                <input type="date" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Kịch bản ưu đãi lãi suất</label>
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                {[1, 2, 3].map(s => (
                                    <button key={s} onClick={() => setNumStages(s as any)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${numStages === s ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        {s} Giai đoạn
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            {/* Phase 1 */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-blue-700 uppercase">Lãi cố định ({numStages === 1 ? 'Suốt TG' : 'GĐ 1'})</label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            step="any"
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm font-bold"
                                            value={phase1Rate}
                                            onChange={e => setPhase1Rate(e.target.value)}
                                            onBlur={() => {
                                                if (!phase1Rate) return;
                                                const parsed = parseFloat(phase1Rate.replace(',', '.'));
                                                if (!isNaN(parsed)) setPhase1Rate(parsed.toString());
                                            }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <span className="text-xs font-bold text-blue-600">%</span>
                                    </div>
                                </div>
                                {numStages > 1 && (
                                    <div className="w-24">
                                        <label className="block text-[10px] font-bold text-blue-700 uppercase">Tháng</label>
                                        <select className="w-full border rounded-lg px-1 py-1.5 text-sm mt-1" value={phase1Duration} onChange={e => setPhase1Duration(Number(e.target.value))}>
                                            {[6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m} Th</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Phase 2 (Intermediate) */}
                            {numStages === 3 && (
                                <div className="flex items-center gap-2 animate-fade-in">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-purple-700 uppercase">Lãi Giai đoạn 2</label>
                                        <div className="flex items-center gap-1 mt-1">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                step="any"
                                                className="w-full border rounded-lg px-2 py-1.5 text-sm font-bold"
                                                value={phase2Rate}
                                                onChange={e => setPhase2Rate(e.target.value)}
                                                onBlur={() => {
                                                    if (!phase2Rate) return;
                                                    const parsed = parseFloat(phase2Rate.replace(',', '.'));
                                                    if (!isNaN(parsed)) setPhase2Rate(parsed.toString());
                                                }}
                                                onFocus={(e) => e.target.select()}
                                            />
                                            <span className="text-xs font-bold text-purple-600">%</span>
                                        </div>
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-[10px] font-bold text-purple-700 uppercase">Tháng</label>
                                        <select className="w-full border rounded-lg px-1 py-1.5 text-sm mt-1" value={phase2Duration} onChange={e => setPhase2Duration(Number(e.target.value))}>
                                            {[6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m} Th</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Floating Rate */}
                            {numStages >= 2 && (
                                <div className="pt-2 border-t border-blue-200">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase">Lãi thả nổi sau ưu đãi</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            step="any"
                                            className="flex-1 border rounded-lg px-2 py-1.5 text-sm font-bold"
                                            value={floatingRate}
                                            onChange={e => setFloatingRate(e.target.value)}
                                            onBlur={() => {
                                                if (!floatingRate) return;
                                                const parsed = parseFloat(floatingRate.replace(',', '.'));
                                                if (!isNaN(parsed)) setFloatingRate(parsed.toString());
                                            }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <span className="text-xs font-bold text-gray-500">% / năm</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Penalty Settings */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <Percent size={18} className="text-red-500" /> Phí tất toán trước hạn (%)
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
                            {penalties.map((p, idx) => (
                                <div key={idx} className="text-center">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Năm {idx + 1}</label>
                                    <input
                                        type="number"
                                        className="w-full border rounded-lg px-1 py-1.5 text-xs text-center font-bold"
                                        value={p}
                                        onChange={e => {
                                            const newP = [...penalties];
                                            newP[idx] = Number(e.target.value);
                                            setPenalties(newP);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: SUMMARY & TABLE */}
                <div className="lg:col-span-8 space-y-6" id="export-container" ref={resultRef}>
                    <div id="summary-section" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-primary-50 to-blue-100 p-5 rounded-2xl border border-primary-100">
                            <p className="text-primary-800 text-xs font-bold uppercase mb-1">Tháng trả cao nhất</p>
                            <h4 className="text-2xl font-bold text-primary-900">{formatCurrency(totals.firstMonth)} đ</h4>
                            <p className="text-[10px] text-primary-600 mt-1 italic">(Gốc + Lãi tháng đầu)</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1">Tổng tiền lãi</p>
                            <h4 className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.interest)} đ</h4>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1">Tổng gốc + lãi</p>
                            <h4 className="text-2xl font-bold text-gray-900">{formatCurrency(totals.total)} đ</h4>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <TableProperties size={18} className="text-primary-600" /> Lịch trả nợ chi tiết
                            </h3>
                            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg border border-gray-200 text-gray-500">
                                {loanTermYears * 12} Kỳ thanh toán
                            </span>
                        </div>
                        <div id="repayment-table-container" className="overflow-x-auto max-h-[600px] custom-scrollbar">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-white sticky top-0 z-10 border-b-2 border-gray-100">
                                    <tr>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase">Tháng</th>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase">Ngày trả</th>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase text-right">Dư nợ gốc</th>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase text-center">Ngày</th>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase text-right">Tiền Gốc</th>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase text-right">Tiền Lãi</th>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase text-right bg-blue-50/50">Tổng trả</th>
                                        <th className="px-3 py-3 font-bold text-gray-500 uppercase text-right">Còn lại</th>
                                        <th className="px-3 py-3 font-bold text-red-500 uppercase text-right">Phí tất toán</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {schedule.map((row) => (
                                        <tr key={row.monthIndex} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-3 py-2.5 font-bold text-gray-400">{row.monthIndex}</td>
                                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.date}</td>
                                            <td className="px-3 py-2.5 text-right font-medium text-gray-700">{formatCurrency(row.currentBalance)}</td>
                                            <td className="px-3 py-2.5 text-center text-gray-400">{row.daysInMonth}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(row.principal)}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(row.interest)}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-blue-700 bg-blue-50/30">{formatCurrency(row.total)}</td>
                                            <td className="px-3 py-2.5 text-right font-medium text-gray-500">{formatCurrency(row.remaining)}</td>
                                            <td className="px-3 py-2.5 text-right group relative">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-red-600">{formatCurrency(row.settlementFee)}</span>
                                                    <span className="text-[8px] font-bold text-red-400">{row.penaltyPercent}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-gray-50 text-[10px] text-gray-400 italic text-center border-t">
                            * Lưu ý: Kết quả trên mang tính chất tham khảo. Lãi suất và các khoản phí có thể thay đổi tùy theo quy định của Ngân hàng tại thời điểm vay.
                        </div>
                    </div>
                </div>
            </div>
            {showEmailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in relative z-[10000]">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Mail className="text-blue-600" /> Gửi Bảng Tính
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tên khách hàng</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-blue-500"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="VD: Nguyễn Văn A"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Email nhận <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-blue-500"
                                    value={emailRecipient}
                                    onChange={e => setEmailRecipient(e.target.value)}
                                    placeholder="khachhang@example.com"
                                />
                            </div>

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
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
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

export default BankCalculator;


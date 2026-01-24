
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Calculator, Landmark, Calendar, DollarSign, Percent, ArrowRight, Download,
    FileImage, Settings2, Info, ChevronDown, CheckCircle2, TableProperties, Loader2, ArrowLeft, Lock
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { useAuth } from '../contexts/AuthContext';

const BankCalculator: React.FC = () => {
    const { userProfile } = useAuth();
    const resultRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [isExporting, setIsExporting] = useState(false);

    // Check if user is locked from using this page
    if (userProfile?.is_locked_quote) {
        return (
            <div className="max-w-2xl mx-auto mt-20 p-8 bg-red-50 border-2 border-red-200 rounded-2xl text-center">
                <Lock className="mx-auto text-red-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-red-700 mb-2">Tài khoản bị khoá</h2>
                <p className="text-red-600">Bạn đã bị khoá quyền sử dụng trang Báo giá & Tính lãi.</p>
                <p className="text-gray-500 mt-2 text-sm">Vui lòng liên hệ Quản lý để được hỗ trợ.</p>
                <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    Về trang chủ
                </button>
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
    const [phase1Rate, setPhase1Rate] = useState<number>(() =>
        navState?.bankPackage?.rate ?? 7.5
    );
    const [phase1Duration, setPhase1Duration] = useState<number>(() =>
        parseDurationFromPackage(navState?.bankPackage?.name) || 12
    );

    // Phase 2 (Intermediate or Floating)
    const [phase2Rate, setPhase2Rate] = useState<number>(8.5);
    const [phase2Duration, setPhase2Duration] = useState<number>(12); // months

    // Final Stage (Floating)
    const [floatingRate, setFloatingRate] = useState<number>(10.5);

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
            let currentAnnualRate = floatingRate;
            if (numStages >= 2 && i <= phase1Duration) {
                currentAnnualRate = phase1Rate;
            } else if (numStages === 3 && i <= (phase1Duration + phase2Duration)) {
                currentAnnualRate = phase2Rate;
            }

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

    const handleExportImage = async () => {
        if (!resultRef.current || isExporting) return;

        setIsExporting(true);
        try {
            // Kỹ thuật: html2canvas chụp ảnh element. 
            // Ta sử dụng 'onclone' để can thiệp vào bản sao của DOM trước khi chụp, 
            // giúp bỏ qua scrollbar và chụp toàn bộ nội dung.
            const canvas = await html2canvas(resultRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const tableContainer = clonedDoc.getElementById('repayment-table-container');
                    if (tableContainer) {
                        tableContainer.style.maxHeight = 'none';
                        tableContainer.style.overflow = 'visible';
                    }
                    // Thêm tiêu đề chuyên nghiệp vào bản clone (chỉ hiện trong ảnh)
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
                <button
                    onClick={handleExportImage}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50 transition-all"
                >
                    {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileImage size={18} />}
                    {isExporting ? 'Đang tạo ảnh...' : 'Xuất Ảnh Toàn Bộ Các Kỳ'}
                </button>
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
                                        <input type="number" step="0.1" className="w-full border rounded-lg px-2 py-1.5 text-sm font-bold" value={phase1Rate} onChange={e => setPhase1Rate(Number(e.target.value))} />
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
                                            <input type="number" step="0.1" className="w-full border rounded-lg px-2 py-1.5 text-sm font-bold" value={phase2Rate} onChange={e => setPhase2Rate(Number(e.target.value))} />
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
                                        <input type="number" step="0.1" className="flex-1 border rounded-lg px-2 py-1.5 text-sm font-bold" value={floatingRate} onChange={e => setFloatingRate(Number(e.target.value))} />
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
    );
};

export default BankCalculator;


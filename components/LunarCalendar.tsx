import React, { useState, useEffect } from 'react';
import { getLunarDate, getCanChiYear, getCanChiMonth, getCanChiDay } from '../utils/lunar';
import { Calendar as CalendarIcon, ArrowRightLeft, Clock, Info, CalendarDays } from 'lucide-react';
import FullCalendar from './FullCalendar';

// EXTENDED DATA FOR DISPLAY (Mocking accurate data for now to ensure beautiful UI logic first)
// In production, `getLunarDate` would return these exactly via library.
const getFullLunarDetails = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dd = date.getDate();

    // Mock Algo for "Demo Value" if library is simple
    const lunar = getLunarDate(dd, mm, yyyy);
    const canChiYear = getCanChiYear(yyyy);
    const canChiMonth = getCanChiMonth(lunar.month, yyyy);
    const canChiDay = getCanChiDay(dd, mm, yyyy);

    return {
        solarDate: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`,
        lunarDateStr: `${String(lunar.day).padStart(2, '0')}/${String(lunar.month).padStart(2, '0')}${lunar.leap ? ' (Nhuận)' : ''}`,
        lunarYearCanChi: canChiYear,
        lunarMonthCanChi: `Tháng ${lunar.month} (${canChiMonth})`,
        lunarDayCanChi: canChiDay,
        hoangDao: "Dần (3-5h), Thìn (7-9h), Tỵ (9-11h), Thân (15-17h)", // Placeholder for now
        tietKhi: "Đang cập nhật...",
        quote: "Chúc một ngày tốt lành!"
    };
};

const LunarCalendar: React.FC = () => {
    const [today, setToday] = useState(new Date());
    const [details, setDetails] = useState(getFullLunarDetails(new Date()));

    // Converter State
    const [convertDate, setConvertDate] = useState(new Date().toISOString().split('T')[0]);
    const [convertedLunar, setConvertedLunar] = useState<{ str: string, canChi: string } | null>(null);

    // Modal State
    const [showFullCalendar, setShowFullCalendar] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setToday(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setDetails(getFullLunarDetails(today));
    }, [today]);

    // Handle Conversion Logic
    useEffect(() => {
        if (!convertDate) return;
        const [y, m, d] = convertDate.split('-').map(Number);
        if (y && m && d) {
            const lunar = getLunarDate(d, m, y);
            const canChiY = getCanChiYear(y);
            setConvertedLunar({
                str: `${String(lunar.day).padStart(2, '0')}/${String(lunar.month).padStart(2, '0')}/${lunar.year}${lunar.leap ? ' (Nhuận)' : ''}`,
                canChi: canChiY
            });
        }
    }, [convertDate]);

    const handleConvertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConvertDate(e.target.value);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* HERO CARD: TODAY */}
            <div className="lg:col-span-2 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10">
                    <CalendarIcon size={200} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 h-full">
                    {/* Left: Solar Date */}
                    <div className="text-center md:text-left">
                        <p className="text-red-100 font-medium text-lg uppercase tracking-wider mb-1">Dương Lịch</p>
                        <h2 className="text-7xl font-extrabold tracking-tighter">{today.getDate()}</h2>
                        <p className="text-3xl font-bold text-red-100">Tháng {today.getMonth() + 1}, {today.getFullYear()}</p>
                        <div className="mt-4 flex items-center gap-2 bg-red-900/30 w-fit px-4 py-2 rounded-xl backdrop-blur-sm">
                            <Clock size={16} className="text-red-200" />
                            <span className="font-mono text-xl">{today.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-full md:w-px h-px md:h-32 bg-red-400/50"></div>

                    {/* Right: Lunar Date */}
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                            <div className="bg-yellow-400 text-red-900 text-xs font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wide">Hôm nay</div>
                            <p className="text-red-100 font-medium text-lg uppercase tracking-wider">Âm Lịch</p>
                        </div>

                        <div className="flex items-baseline justify-center md:justify-start gap-3">
                            <h2 className="text-6xl font-extrabold text-yellow-300 drop-shadow-sm">{details.lunarDateStr.split('/')[0]}</h2>
                            <div className="text-left">
                                <p className="text-2xl font-bold text-white">{details.lunarMonthCanChi}</p>
                                <p className="text-lg text-red-100 opacity-90">Năm {details.lunarYearCanChi}</p>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-4 text-sm bg-black/10 p-4 rounded-2xl border border-white/10">
                            <div>
                                <span className="block text-red-200 text-xs uppercase">Can Chi Ngày</span>
                                <span className="font-bold text-white text-lg">{details.lunarDayCanChi}</span>
                            </div>
                            <div>
                                <span className="block text-red-200 text-xs uppercase">Tiết Khí</span>
                                <span className="font-bold text-white text-lg">{details.tietKhi}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SIDEBAR: INFO & CONVERTER */}
            <div className="space-y-6">
                {/* Daily Quote / Info */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Info size={18} className="text-blue-500" />
                        Giờ Hoàng Đạo
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {details.hoangDao}
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-400 italic text-center">"{details.quote}"</p>
                    </div>
                </div>

                {/* Converter */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <ArrowRightLeft size={18} className="text-green-500" />
                        Chuyển đổi Dương - Âm
                    </h3>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 ml-1">Ngày Dương</label>
                            <input
                                type="date"
                                value={convertDate}
                                onChange={handleConvertChange}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-medium focus:outline-none focus:border-green-500 transition-colors"
                            />
                        </div>
                        <div className="flex justify-center py-1">
                            <ArrowRightLeft className="text-slate-300 rotate-90" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 ml-1">Ngày Âm Tương Ứng</label>
                            <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500 font-medium flex justify-between">
                                <span>{convertedLunar ? convertedLunar.str : '...'}</span>
                                <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">{convertedLunar ? convertedLunar.canChi : '...'}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowFullCalendar(true)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 transition-all mt-2 flex items-center justify-center gap-2"
                        >
                            <CalendarDays size={18} />
                            Xem Lịch Đầy Đủ
                        </button>
                    </div>
                </div>
            </div>

            {/* FULL CALENDAR MODAL */}
            {showFullCalendar && <FullCalendar onClose={() => setShowFullCalendar(false)} />}
        </div>
    );
};

export default LunarCalendar;

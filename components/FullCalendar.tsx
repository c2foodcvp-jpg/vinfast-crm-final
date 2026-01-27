import React, { useState, useMemo } from 'react';
import { getLunarDate, getCanChiDay } from '../utils/lunar';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface FullCalendarProps {
    onClose: () => void;
}

const FullCalendar: React.FC<FullCalendarProps> = ({ onClose }) => {
    const [viewDate, setViewDate] = useState(new Date()); // Solar date for month view

    const month = viewDate.getMonth() + 1;
    const year = viewDate.getFullYear();

    const generateCalendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0);

        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // Mon=0, Sun=6

        const grid = [];
        let dayCounter = 1;

        // Previous month filler
        for (let i = 0; i < startDayOfWeek; i++) {
            grid.push(null);
        }

        // Current month
        for (let i = 0; i < daysInMonth; i++) {
            const solarDate = new Date(year, month - 1, dayCounter);
            const lunar = getLunarDate(dayCounter, month, year);

            // Calculate special events or status here
            const dayCanChi = getCanChiDay(dayCounter, month, year);
            const isToday = new Date().toDateString() === solarDate.toDateString();
            const isWeekend = solarDate.getDay() === 0 || solarDate.getDay() === 6;

            grid.push({
                solar: dayCounter,
                lunar: lunar,
                dayCanChi: dayCanChi,
                isToday,
                isWeekend,
                fullDate: solarDate
            });
            dayCounter++;
        }

        return grid;
    }, [month, year]);

    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 2, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(year, month, 1));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-green-600 p-4 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrevMonth} className="p-1 hover:bg-green-700 rounded-full transition-colors"><ChevronLeft size={24} /></button>
                        <h2 className="text-xl font-bold uppercase">Tháng {month < 10 ? `0${month}` : month} - {year}</h2>
                        <button onClick={handleNextMonth} className="p-1 hover:bg-green-700 rounded-full transition-colors"><ChevronRight size={24} /></button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setViewDate(new Date())} className="px-3 py-1 bg-green-700 rounded text-sm font-bold hover:bg-green-800">Hôm nay</button>
                        <button onClick={onClose} className="p-1 hover:bg-green-700 rounded-full"><X size={24} /></button>
                    </div>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 bg-green-50/50 border-b border-gray-100 shrink-0">
                    {["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"].map((d, i) => (
                        <div key={i} className={`text-center py-3 text-sm font-bold ${i === 6 ? 'text-red-500' : 'text-gray-500'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 flex-1 overflow-y-auto bg-white auto-rows-fr">
                    {generateCalendarGrid.map((cell, idx) => {
                        if (!cell) return <div key={`empty-${idx}`} className="border-b border-r border-gray-50 bg-gray-50/30 min-h-[100px]"></div>;

                        return (
                            <div key={cell.solar} className={`relative border-b border-r border-gray-100 p-2 min-h-[100px] hover:bg-gray-50 transition-colors flex flex-col justify-between ${cell.isToday ? 'bg-yellow-50' : ''}`}>

                                <div className="flex justify-between items-start">
                                    <span className={`text-3xl font-bold ${cell.isWeekend || cell.isToday ? 'text-red-600' : 'text-gray-800'} ${cell.isToday ? 'text-red-600' : ''}`}>
                                        {cell.solar}
                                    </span>
                                    {cell.isToday && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Nay</span>}
                                </div>

                                <div className="text-right mt-1">
                                    <div className="text-sm font-bold text-gray-500">
                                        {String(cell.lunar.day).padStart(2, '0')}/{String(cell.lunar.month).padStart(2, '0')}
                                        {cell.lunar.leap && <span className="text-[9px] text-red-500 ml-1">(N)</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium">{cell.dayCanChi}</div>
                                </div>

                                {/* Lunar 1st or 15th Highlight */}
                                {cell.lunar.day === 1 && (
                                    <div className="absolute top-2 right-2 text-[10px] font-bold text-red-500 uppercase">Mùng 1</div>
                                )}
                                {cell.lunar.day === 15 && (
                                    <div className="absolute top-2 right-2 text-[10px] font-bold text-red-500 uppercase">Rằm</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default FullCalendar;

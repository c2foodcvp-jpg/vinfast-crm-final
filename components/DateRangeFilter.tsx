
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X, Check } from 'lucide-react';

interface DateRangeFilterProps {
    startDate: string;         // YYYY-MM-DD format
    endDate: string;           // YYYY-MM-DD format
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onClear?: () => void;
    className?: string;
}

// Preset options for quick selection
const PRESETS = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'yesterday', label: 'Hôm qua' },
    { key: 'this_week', label: 'Tuần này' },
    { key: 'last_week', label: 'Tuần trước' },
    { key: 'this_month', label: 'Tháng này' },
    { key: 'last_month', label: 'Tháng trước' },
    { key: 'this_quarter', label: 'Quý này' },
    { key: 'this_year', label: 'Năm nay' },
];

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onClear,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Local buffered state (only apply on specific action)
    const [tempStart, setTempStart] = useState(startDate);
    const [tempEnd, setTempEnd] = useState(endDate);

    // Helper to get GMT+7 today string
    const getLocalTodayStr = () => {
        const now = new Date();
        const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        return vnTime.toISOString().split('T')[0];
    };

    // Effect: Sync props to temp state when dropdown OPENS
    useEffect(() => {
        if (isOpen) {
            setTempStart(startDate);
            setTempEnd(endDate);
        }
    }, [isOpen]);

    // Apply preset
    const applyPreset = (key: string) => {
        const now = new Date();
        const vnNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        let start = '';
        let end = '';

        switch (key) {
            case 'today':
                start = end = vnNow.toISOString().split('T')[0];
                break;
            case 'yesterday':
                const yesterday = new Date(vnNow);
                yesterday.setDate(vnNow.getDate() - 1);
                start = end = yesterday.toISOString().split('T')[0];
                break;
            case 'this_week':
                const dayOfWeek = vnNow.getDay();
                const startOfWeek = new Date(vnNow);
                startOfWeek.setDate(vnNow.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
                start = startOfWeek.toISOString().split('T')[0];
                end = vnNow.toISOString().split('T')[0];
                break;
            case 'last_week':
                const currentDay = vnNow.getDay();
                const lastWeekEnd = new Date(vnNow);
                lastWeekEnd.setDate(vnNow.getDate() - (currentDay === 0 ? 0 : currentDay));
                const lastWeekStart = new Date(lastWeekEnd);
                lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
                start = lastWeekStart.toISOString().split('T')[0];
                end = lastWeekEnd.toISOString().split('T')[0];
                break;
            case 'this_month':
                start = new Date(vnNow.getFullYear(), vnNow.getMonth(), 1).toISOString().split('T')[0];
                end = vnNow.toISOString().split('T')[0];
                break;
            case 'last_month':
                const lastMonthStart = new Date(vnNow.getFullYear(), vnNow.getMonth() - 1, 1);
                const lastMonthEnd = new Date(vnNow.getFullYear(), vnNow.getMonth(), 0);
                start = lastMonthStart.toISOString().split('T')[0];
                end = lastMonthEnd.toISOString().split('T')[0];
                break;
            case 'this_quarter':
                const q = Math.floor(vnNow.getMonth() / 3);
                start = new Date(vnNow.getFullYear(), q * 3, 1).toISOString().split('T')[0];
                end = vnNow.toISOString().split('T')[0];
                break;
            case 'this_year':
                start = new Date(vnNow.getFullYear(), 0, 1).toISOString().split('T')[0];
                end = vnNow.toISOString().split('T')[0];
                break;
        }

        onStartDateChange(start);
        onEndDateChange(end);
        setIsOpen(false);
    };

    const handleApply = () => {
        onStartDateChange(tempStart);
        onEndDateChange(tempEnd);
        setIsOpen(false);
    };

    // Get display text
    const getDisplayText = () => {
        if (!startDate && !endDate) {
            return 'Chọn khoảng ngày';
        }
        if (startDate === endDate && startDate) {
            return new Date(startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        const formattedStart = startDate ? new Date(startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '...';
        const formattedEnd = endDate ? new Date(endDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '...';
        return `${formattedStart} → ${formattedEnd}`;
    };

    const hasValue = startDate || endDate;

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Backdrop for closing dropdown */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative z-50 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium min-w-[160px]
                    ${hasValue
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
            >
                <Calendar size={16} className={hasValue ? 'text-primary-600' : 'text-gray-400'} />
                <span className="flex-1 text-left truncate">{getDisplayText()}</span>
                {hasValue && onClear ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                        }}
                        className="p-0.5 hover:bg-primary-200 rounded-full transition-colors"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 min-w-[320px] animate-fade-in overflow-hidden">
                    {/* Presets Section */}
                    <div className="p-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Chọn nhanh</p>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map(preset => (
                                <button
                                    key={preset.key}
                                    onClick={() => applyPreset(preset.key)}
                                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-primary-100 hover:text-primary-700 transition-colors"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Range */}
                    <div className="p-4">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-3">Hoặc chọn khoảng ngày</p>
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
                                <input
                                    type="date"
                                    value={tempStart}
                                    onChange={(e) => setTempStart(e.target.value)}
                                    max={tempEnd || undefined}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                                />
                            </div>
                            <span className="text-gray-400 mt-5">→</span>
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
                                <input
                                    type="date"
                                    value={tempEnd}
                                    onChange={(e) => setTempEnd(e.target.value)}
                                    min={tempStart || undefined}
                                    max={getLocalTodayStr()}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                        {onClear && (
                            <button
                                onClick={() => {
                                    onClear();
                                    setIsOpen(false);
                                }}
                                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                            >
                                Xóa bộ lọc
                            </button>
                        )}
                        <button
                            onClick={handleApply}
                            className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors ml-auto"
                        >
                            <Check size={16} />
                            Áp dụng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;

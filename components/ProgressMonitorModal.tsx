import React, { useState, useMemo } from 'react';
import { Customer, UserProfile } from '../types';
import { X, User, BarChart2, AlertCircle, CarFront } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProgressMonitorModalProps {
    isOpen: boolean;
    onClose: () => void;
    customers: Customer[];
    employees: UserProfile[];
    userProfile: UserProfile | null;
    isAdmin: boolean;
    isMod: boolean;
}

// const ITEMS_PER_PAGE = 50; // Performance limit for lists

const ProgressMonitorModal: React.FC<ProgressMonitorModalProps> = ({
    isOpen,
    onClose,
    customers,
    employees,
    // userProfile,
    isAdmin,
    isMod
}) => {
    const navigate = useNavigate();
    const [selectedRep, setSelectedRep] = useState<string>('all');
    const [selectedTeam, setSelectedTeam] = useState<string>('all');

    // --- Helpers ---
    const getProgressPercent = (customer: Customer): number => {
        const DELIVERY_STEPS = [
            'deposited', 'contract_signed', 'bank_approved', 'payment_invoice',
            'invoiced', 'plate_registration', 'accessories_pdi', 'handover', 'collection_return', 'money_recovered'
        ];

        // Handle conditional step
        const steps = DELIVERY_STEPS.filter(key => {
            if (key === 'bank_approved') {
                return customer.deal_details?.payment_method === 'Ngân hàng';
            }
            return true;
        });

        const progressData = customer.delivery_progress || {};
        const completedCount = steps.filter(key => progressData[key]?.completed).length;

        return Math.round((completedCount / steps.length) * 100);
    };

    const getDaysElapsed = (customer: Customer | string) => {
        let dateStr = typeof customer === 'string' ? customer : '';

        if (typeof customer !== 'string') {
            // Priority 1: Official Closing Date (won_at)
            // This field is set when the deal is marked as Adjusted/WON
            if (customer.won_at) {
                dateStr = customer.won_at;
            }
            else {
                const progress = customer.delivery_progress || {};

                // Priority 2: Earliest timestamp from any completed step using Object.values
                const timestamps = Object.values(progress)
                    .filter(step => step.completed && step.timestamp)
                    .map(step => new Date(step.timestamp!).getTime());

                if (timestamps.length > 0) {
                    const earliest = Math.min(...timestamps);
                    dateStr = new Date(earliest).toISOString();
                } else {
                    // Priority 3: Fallback if no won_at and no progress
                    dateStr = customer.created_at;
                }
            }
        }

        if (!dateStr) return 0;

        const start = new Date(dateStr).getTime();
        const now = new Date().getTime();
        return (now - start) / (1000 * 60 * 60 * 24);
    };

    // --- Managers for Admin Filter ---
    const managers = useMemo(() => {
        const managerIds = Array.from(new Set(employees.filter(p => p.manager_id).map(p => p.manager_id)));
        return managerIds.map(id => {
            const m = employees.find(p => p.id === id);
            return { id: id as string, name: m?.full_name || 'Unknown' };
        }).filter(m => m.name !== 'Unknown');
    }, [employees]);

    // --- Filtering Logic ---
    const filteredData = useMemo(() => {
        return customers.filter(c => {
            // Team Filter (Admin Only)
            if (isAdmin && selectedTeam !== 'all') {
                const creator = employees.find(e => e.id === c.creator_id);
                if (creator?.manager_id !== selectedTeam && creator?.id !== selectedTeam) return false;
            }

            // Rep Filter
            if ((isAdmin || isMod) && selectedRep !== 'all') {
                if (c.creator_id !== selectedRep) return false;
            }

            return true;
        });
    }, [customers, isAdmin, isMod, selectedRep, selectedTeam, employees]);

    // --- Split Columns ---
    const { earlyStage, lateStage, waitingCar } = useMemo(() => {
        const early: Customer[] = [];
        const late: Customer[] = [];
        const waiting: Customer[] = [];

        filteredData.forEach(c => {
            // Exclude Refunded/Suspended from ALL progress columns
            if (c.deal_status === 'refunded' || c.deal_status === 'suspended') return;

            if (c.deal_details?.car_availability === 'Đợi xe') {
                waiting.push(c);
                return;
            }

            // Exclude Completed Deals from Early/Late columns
            if (c.deal_status === 'completed') return;

            const days = getDaysElapsed(c);
            if (days <= 10) early.push(c);
            else late.push(c);
        });

        return { earlyStage: early, lateStage: late, waitingCar: waiting };
    }, [filteredData]);

    if (!isOpen) return null;

    const CustomerItem = ({ customer }: { customer: Customer }) => {
        const percent = getProgressPercent(customer);
        const days = Math.floor(getDaysElapsed(customer));

        // Color Logic
        let colorClass = 'bg-red-500';
        if (percent >= 50 && percent < 100) colorClass = 'bg-orange-500';
        if (percent === 100) colorClass = 'bg-green-500';

        return (
            <div
                onClick={() => {
                    onClose();
                    navigate(`/customers/${customer.id}`);
                }}
                className="bg-white p-3 rounded-xl border border-gray-100 hover:shadow-md hover:border-blue-200 cursor-pointer transition-all group"
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 truncate max-w-[150px]">{customer.name}</h4>
                        <p className="text-xs text-gray-400">{customer.interest || 'Chưa rõ dòng xe'}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <User size={10} /> {customer.sales_rep || 'N/A'}
                    </span>
                </div>

                {customer.deal_details?.car_availability !== 'Đợi xe' && (
                    <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <span className={`text-xs font-bold w-9 text-right ${percent === 100 ? 'text-green-600' : 'text-gray-600'}`}>{percent}%</span>
                    </div>
                )}

                <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
                    <span>{days} ngày (từ chốt đơn)</span>
                    {percent === 0 && <span className="text-red-500 flex items-center gap-1 font-bold animate-pulse"><AlertCircle size={10} /> Cập nhật</span>}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-7xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <BarChart2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Kiểm tra tiến độ</h2>
                            <p className="text-sm text-gray-500">Soát xét tình trạng giao xe của khách hàng</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Team Filter (Admin Only) */}
                        {isAdmin && (
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-lg outline-none text-sm font-bold shadow-sm cursor-pointer hover:border-blue-400 transition-colors"
                            >
                                <option value="all">Tất cả Team</option>
                                {managers.map(mgr => (
                                    <option key={mgr.id} value={mgr.id}>Team {mgr.name}</option>
                                ))}
                            </select>
                        )}

                        {/* Rep Filter */}
                        {(isAdmin || isMod) && (
                            <select
                                value={selectedRep}
                                onChange={(e) => setSelectedRep(e.target.value)}
                                className="bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-lg outline-none text-sm font-bold shadow-sm cursor-pointer hover:border-blue-400 transition-colors"
                            >
                                <option value="all">Tất cả nhân viên</option>
                                {employees
                                    .filter(emp => isAdmin && selectedTeam !== 'all' ? (emp.manager_id === selectedTeam || emp.id === selectedTeam) : true)
                                    .map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))
                                }
                            </select>
                        )}

                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Body - 3 Columns */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {/* Column 1: Early Stage */}
                    <div className="flex-1 flex flex-col bg-blue-50/30">
                        <div className="p-3 border-b border-blue-100 bg-blue-50 text-blue-800 font-bold flex justify-between items-center sticky top-0">
                            <span>Giai đoạn đầu (0-10 ngày từ chốt)</span>
                            <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">{earlyStage.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                            {earlyStage.map(c => <CustomerItem key={c.id} customer={c} />)}
                            {earlyStage.length === 0 && <div className="text-center text-gray-400 py-10 text-sm">Không có khách hàng</div>}
                        </div>
                    </div>

                    {/* Column 2: Late Stage */}
                    <div className="flex-1 flex flex-col bg-orange-50/30">
                        <div className="p-3 border-b border-orange-100 bg-orange-50 text-orange-800 font-bold flex justify-between items-center sticky top-0">
                            <span>Đã lâu (&gt; 10 ngày từ chốt)</span>
                            <span className="bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">{lateStage.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                            {lateStage.map(c => <CustomerItem key={c.id} customer={c} />)}
                            {lateStage.length === 0 && <div className="text-center text-gray-400 py-10 text-sm">Không có khách hàng</div>}
                        </div>
                    </div>

                    {/* Column 3: Waiting Car */}
                    <div className="flex-1 flex flex-col bg-purple-50/30">
                        <div className="p-3 border-b border-purple-100 bg-purple-50 text-purple-800 font-bold flex justify-between items-center sticky top-0">
                            <span className="flex items-center gap-2"><CarFront size={16} /> Chờ xe về</span>
                            <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded-full">{waitingCar.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                            {waitingCar.map(c => <CustomerItem key={c.id} customer={c} />)}
                            {waitingCar.length === 0 && <div className="text-center text-gray-400 py-10 text-sm">Không có khách hàng</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgressMonitorModal;

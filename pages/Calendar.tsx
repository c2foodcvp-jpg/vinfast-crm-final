
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Customer, CustomerStatus, MembershipTier } from '../types';
import { useNavigate } from 'react-router-dom';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Phone, User, Clock,
    Plus, CheckCircle2, Flame, AlertCircle, X, CalendarDays,
    AlertTriangle, Timer, ListTodo, Flag, Activity, Calendar, Star, Bell, BellRing,
    Users, UserCircle, Lock
} from 'lucide-react';

// Task interface
interface UserTask {
    id: string;
    user_id: string;
    title: string;
    content?: string;
    deadline?: string; // TIMESTAMPTZ ISO string
    priority: 'low' | 'medium' | 'high' | 'urgent';
    customer_id?: string;
    customer_name?: string;
    is_completed: boolean;
    created_at: string;
    reminder_enabled?: boolean;
    reminder_sent?: boolean;
}

const PRIORITY_CONFIG = {
    low: { label: 'Thấp', color: 'bg-gray-100 text-gray-600', icon: Flag },
    medium: { label: 'Trung bình', color: 'bg-blue-100 text-blue-700', icon: Flag },
    high: { label: 'Cao', color: 'bg-orange-100 text-orange-700', icon: Flag },
    urgent: { label: 'Gấp', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
};

const CalendarPage: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [userTasks, setUserTasks] = useState<UserTask[]>([]);

    // Modal States
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

    // Task Form State
    const [taskForm, setTaskForm] = useState({
        title: '',
        content: '',
        deadline: new Date().toISOString().split('T')[0],
        deadlineTime: '', // HH:mm format
        priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
        applyToCustomer: false,
        customer_id: '',
        reminderEnabled: false
    });
    const [saving, setSaving] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomerName, setSelectedCustomerName] = useState('');

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // MOD Consultant Mode: Switch between team view and personal view
    const [isConsultantMode, setIsConsultantMode] = useState(false);
    const [togglingMode, setTogglingMode] = useState(false);

    // Initialize consultant mode from user profile
    useEffect(() => {
        if (userProfile?.is_consultant_mode !== undefined) {
            setIsConsultantMode(userProfile.is_consultant_mode);
        }
    }, [userProfile?.is_consultant_mode]);

    // Toggle consultant mode and save to database
    const toggleConsultantMode = async () => {
        if (!userProfile || !isMod || togglingMode) return;
        setTogglingMode(true);
        try {
            const newMode = !isConsultantMode;
            const { error } = await supabase
                .from('profiles')
                .update({ is_consultant_mode: newMode })
                .eq('id', userProfile.id);

            if (error) throw error;
            setIsConsultantMode(newMode);
            // Refetch data with new mode
            fetchDataWithMode(newMode);
        } catch (e) {
            console.error('Error toggling consultant mode:', e);
            alert('Lỗi khi chuyển chế độ');
        } finally {
            setTogglingMode(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userProfile]);

    const fetchData = async (consultantModeOverride?: boolean) => {
        if (!userProfile) return;
        setLoading(true);
        try {
            // Determine if consultant mode should be used
            const useConsultantMode = consultantModeOverride !== undefined
                ? consultantModeOverride
                : isConsultantMode;

            // --- Fetch Team IDs (Isolation Logic) ---
            let teamIds: string[] = [];
            if (isAdmin) {
                const { data: profiles } = await supabase.from('profiles').select('id');
                teamIds = profiles?.map(p => p.id) || [];
            } else if (isMod && !useConsultantMode) {
                // MOD in Manager mode: see team
                const { data: profiles } = await supabase.from('profiles').select('id').or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id}`);
                teamIds = profiles?.map(p => p.id) || [];
            } else {
                // EMPLOYEE or MOD in Consultant mode: only own customers
                teamIds = [userProfile.id];
            }

            // --- Fetch Customers with recare_date ---
            let query = supabase
                .from('customers')
                .select('id, name, phone, status, recare_date, interest, classification, sales_rep, creator_id, created_at, is_special_care, is_long_term')
                .not('recare_date', 'is', null)
                .neq('status', CustomerStatus.LOST)
                .neq('status', CustomerStatus.WON);

            if (!isAdmin) {
                if (teamIds.length > 0) query = query.in('creator_id', teamIds);
                else query = query.eq('creator_id', userProfile.id);
            }

            const { data: customerData } = await query;
            setCustomers(customerData as Customer[] || []);

            // --- Fetch User Tasks ---
            const { data: taskData } = await supabase
                .from('user_tasks')
                .select('*, customers(name)')
                .eq('user_id', userProfile.id)
                .eq('is_completed', false)
                .order('deadline', { ascending: true });

            const tasksWithCustomerName = (taskData || []).map((t: any) => ({
                ...t,
                customer_name: t.customers?.name || null
            }));
            setUserTasks(tasksWithCustomerName);

        } catch (e) {
            console.error("Error fetching data", e);
        } finally {
            setLoading(false);
        }
    };

    // Helper for toggling mode
    const fetchDataWithMode = (mode: boolean) => fetchData(mode);

    // --- Computed Customer Lists ---
    // CS Đặc biệt - khách có is_special_care = true
    const specialCare = useMemo(() =>
        customers.filter(c =>
            c.is_special_care === true &&
            c.status !== CustomerStatus.WON &&
            c.status !== CustomerStatus.LOST
        ), [customers]);

    // Cần CS hôm nay - chỉ khách có recare_date = hôm nay
    // Loại trừ: CS Dài hạn, CS Đặc biệt, Đã chốt, Đã hủy
    const dueToday = useMemo(() =>
        customers.filter(c =>
            c.recare_date === todayStr &&
            !c.is_long_term &&
            !c.is_special_care &&
            c.status !== CustomerStatus.WON &&
            c.status !== CustomerStatus.LOST
        ), [customers, todayStr]);

    // Quá hạn CS - khách có recare_date < hôm nay
    // Loại trừ: CS Dài hạn, CS Đặc biệt, Đã chốt, Đã hủy
    const overdue = useMemo(() =>
        customers.filter(c =>
            c.recare_date &&
            c.recare_date < todayStr &&
            !c.is_long_term &&
            !c.is_special_care &&
            c.status !== CustomerStatus.WON &&
            c.status !== CustomerStatus.LOST
        ), [customers, todayStr]);

    // Hết CS Dài hạn hôm nay - khách có is_long_term = true VÀ recare_date = hôm nay
    const longTermDueToday = useMemo(() =>
        customers.filter(c =>
            c.is_long_term === true &&
            c.recare_date === todayStr &&
            c.status !== CustomerStatus.WON &&
            c.status !== CustomerStatus.LOST
        ), [customers, todayStr]);

    const totalTasks = specialCare.length + dueToday.length + overdue.length + longTermDueToday.length + userTasks.length;

    // --- Calendar Logic (Memoized for performance) ---
    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const days = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);
        const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
        const grid: (number | null)[][] = [];
        let day = 1;

        for (let i = 0; i < 6; i++) {
            const row: (number | null)[] = [];
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < adjustedStartDay) {
                    row.push(null);
                } else if (day > days) {
                    row.push(null);
                } else {
                    row.push(day);
                    day++;
                }
            }
            grid.push(row);
            if (day > days) break;
        }
        return grid;
    }, [currentDate]);

    const tasksByDate = useMemo(() => {
        const map: Record<string, { customerTasks: Customer[], customTasks: UserTask[] }> = {};

        // Populate with customers
        customers.forEach(c => {
            if (c.recare_date) {
                if (!map[c.recare_date]) map[c.recare_date] = { customerTasks: [], customTasks: [] };
                map[c.recare_date].customerTasks.push(c);
            }
        });

        // Populate with tasks
        userTasks.forEach(t => {
            if (t.deadline) {
                // deadline is ISO timestamp, we need YYYY-MM-DD
                const dateStr = t.deadline.split('T')[0];
                if (!map[dateStr]) map[dateStr] = { customerTasks: [], customTasks: [] };
                map[dateStr].customTasks.push(t);
            }
        });

        return map;
    }, [customers, userTasks]);

    const handleDayClick = (day: number) => {
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
        const d = day.toString().padStart(2, '0');
        setSelectedDateStr(`${currentDate.getFullYear()}-${month}-${d}`);
    };

    // --- Permission Check ---
    const canCreateTask = useMemo(() => {
        if (!userProfile) return false;
        // Admin & Mod always allowed
        if (isAdmin || isMod) return true;

        // Members: Gold/Platinum/Diamond allowed
        const tier = userProfile.member_tier;
        return tier === MembershipTier.GOLD || tier === MembershipTier.PLATINUM || tier === MembershipTier.DIAMOND;
    }, [userProfile, isAdmin, isMod]);

    // --- Task Creation ---
    const handleCreateTask = async () => {
        if (!taskForm.title.trim() || !userProfile) return;

        // Permission Gate
        if (!canCreateTask) {
            alert('🔒 Tính năng này chỉ dành cho thành viên Gold trở lên!');
            return;
        }

        setSaving(true);
        try {
            // Combine date + time into TIMESTAMPTZ with Vietnam timezone (GMT+7)
            let deadlineValue: string | null = null;
            if (taskForm.deadline) {
                if (taskForm.deadlineTime) {
                    // Combine date + time with timezone offset (e.g., "2026-01-28T08:00:00+07:00")
                    deadlineValue = `${taskForm.deadline}T${taskForm.deadlineTime}:00+07:00`;
                } else {
                    // Only date, set to end of day (Vietnam timezone)
                    deadlineValue = `${taskForm.deadline}T23:59:59+07:00`;
                }
            }


            const payload: any = {
                user_id: userProfile.id,
                title: taskForm.title.trim(),
                content: taskForm.content.trim() || null,
                deadline: deadlineValue,
                priority: taskForm.priority,
                customer_id: taskForm.applyToCustomer && taskForm.customer_id ? taskForm.customer_id : null,
                reminder_enabled: taskForm.reminderEnabled && !!taskForm.deadlineTime, // Only enable if time is set
                reminder_sent: false
            };

            const { error } = await supabase.from('user_tasks').insert(payload);
            if (error) throw error;

            setShowTaskModal(false);
            setTaskForm({
                title: '',
                content: '',
                deadline: todayStr,
                deadlineTime: '',
                priority: 'medium',
                applyToCustomer: false,
                customer_id: '',
                reminderEnabled: false
            });
            fetchData();
        } catch (e) {
            console.error('Error creating task', e);
            alert('Lỗi khi tạo công việc');
        } finally {
            setSaving(false);
        }
    };


    const handleCompleteTask = async (taskId: string) => {
        try {
            await supabase.from('user_tasks').update({ is_completed: true }).eq('id', taskId);
            setUserTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (e) {
            console.error('Error completing task', e);
        }
    };

    const grid = calendarGrid;
    // Use optimized lookup
    const selectedTasks = useMemo(() => {
        return tasksByDate[selectedDateStr] || { customerTasks: [], customTasks: [] };
    }, [tasksByDate, selectedDateStr]);

    // --- Get Customer Status Display ---
    const getCustomerStatusDisplay = (customer: Customer) => {
        // 1. Chăm sóc dài hạn -> Theo dõi thêm (Xanh dương)
        if (customer.is_long_term) {
            return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-0.5"><Calendar size={10} /> Theo dõi thêm</span>;
        }

        // 2. CS Đặc biệt -> Tiềm năng (Cam đỏ)
        if (customer.is_special_care) {
            return <span className="bg-orange-500 text-white px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-0.5"><Star size={10} fill="white" /> Tiềm năng</span>;
        }

        // 3. Logic cho khách Mới > 48h -> Đang theo dõi (Xanh lá)
        const created = new Date(customer.created_at);
        const now = new Date();
        const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

        if (customer.status === CustomerStatus.NEW) {
            if (diffHours > 48) {
                return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-0.5"><Activity size={10} /> Đang theo dõi</span>;
            } else {
                // Mới (Xanh dương)
                return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-0.5"><Flame size={10} /> Mới</span>;
            }
        }

        // Default
        return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium text-[10px]">{customer.status}</span>;
    };

    // --- Customer Card Component ---
    const CustomerCard = ({ customer, isOverdue = false }: { customer: Customer; isOverdue?: boolean }) => (
        <div
            onClick={() => navigate(`/customers/${customer.id}`)}
            className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md group
                ${isOverdue ? 'border-red-200 bg-red-50 hover:bg-red-100' : 'border-gray-100 bg-white hover:border-blue-200'}`}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    {customer.classification === 'Hot' && <Flame size={14} className="text-red-500 fill-red-500" />}
                    <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-700 truncate max-w-[120px]">{customer.name}</h4>
                </div>
                {getCustomerStatusDisplay(customer)}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <Phone size={10} />
                <span className="truncate">{customer.phone}</span>
            </div>
            {customer.interest && (
                <span className="text-xs font-bold text-primary-600 mt-1 block truncate uppercase">{customer.interest}</span>
            )}
        </div>
    );

    // --- Task Card Component ---
    const TaskCard = ({ task }: { task: UserTask }) => {
        const config = PRIORITY_CONFIG[task.priority];
        const IconComponent = config.icon;

        // Format deadline with time
        const formatDeadline = (deadline: string) => {
            const date = new Date(deadline);
            const hasTime = date.getHours() !== 23 || date.getMinutes() !== 59;
            if (hasTime) {
                return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${date.toLocaleDateString('vi-VN')}`;
            }
            return date.toLocaleDateString('vi-VN');
        };

        return (
            <div className="p-3 rounded-xl border border-gray-100 bg-white hover:border-blue-200 transition-all group">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-gray-800 text-sm truncate max-w-[130px]">{task.title}</h4>
                        {task.reminder_enabled && (
                            <span title={task.reminder_sent ? "Đã gửi nhắc nhở" : "Sẽ nhắc nhở qua email"}>
                                {task.reminder_sent ? (
                                    <Bell size={12} className="text-gray-400" />
                                ) : (
                                    <BellRing size={12} className="text-amber-500" />
                                )}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="p-1 rounded-full hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                        title="Đánh dấu hoàn thành"
                    >
                        <CheckCircle2 size={16} />
                    </button>
                </div>
                {task.content && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.content}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${config.color}`}>
                        <IconComponent size={10} /> {config.label}
                    </span>
                    {task.deadline && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Clock size={10} /> {formatDeadline(task.deadline)}
                        </span>
                    )}
                    {task.customer_name && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]">
                            {task.customer_name}
                        </span>
                    )}
                </div>
            </div>
        );

    };

    // --- Column Component ---
    const Column = ({ title, icon: Icon, iconColor, items, type, emptyText }: {
        title: string;
        icon: React.ElementType;
        iconColor: string;
        items: Customer[] | UserTask[];
        type: 'customer' | 'task';
        emptyText: string;
    }) => (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                    <Icon size={16} className={iconColor} /> {title}
                </h3>
                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar max-h-[550px]">
                {items.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                        <CheckCircle2 size={24} className="mx-auto mb-2 text-gray-300" />
                        {emptyText}
                    </div>
                ) : (
                    items.map((item: any) =>
                        type === 'customer'
                            ? <CustomerCard key={item.id} customer={item} isOverdue={item.recare_date < todayStr} />
                            : <TaskCard key={item.id} task={item} />
                    )
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="bg-gradient-to-r from-primary-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold mb-1">
                            Xin chào {userProfile?.full_name || 'bạn'}! 👋
                        </h1>
                        <p className="text-white/80">
                            Hôm nay bạn có <span className="font-bold text-yellow-300">{totalTasks}</span> công việc cần xử lý
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCalendarModal(true)}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-xl font-bold transition-all"
                    >
                        <CalendarIcon size={18} />
                        Xem lịch
                    </button>
                </div>
            </div>

            {/* CS ĐẶC BIỆT - Grid Section with Scroll */}
            {specialCare.length > 0 && (
                <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl border-2 border-pink-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-pink-800 flex items-center gap-2">
                            <Flame size={18} className="text-pink-500" /> CS Đặc biệt
                        </h3>
                        <span className="bg-pink-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{specialCare.length}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[200px] overflow-y-auto pb-2 custom-scrollbar">
                        {specialCare.map(c => (
                            <div
                                key={c.id}
                                onClick={() => navigate(`/customers/${c.id}`)}
                                className="p-3 bg-white rounded-xl border border-pink-100 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Flame size={12} className="text-pink-500 fill-pink-500" />
                                    <h4 className="font-bold text-gray-800 text-sm truncate">{c.name}</h4>
                                </div>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Phone size={10} /> {c.phone}
                                </p>
                                {c.interest && <p className="text-xs text-pink-600 mt-1 truncate font-bold uppercase">{c.interest}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4 COLUMNS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Column
                    title="Cần CS hôm nay"
                    icon={Timer}
                    iconColor="text-orange-500"
                    items={dueToday}
                    type="customer"
                    emptyText="Không có khách cần CS hôm nay"
                />
                <Column
                    title="Hết CS Dài hạn"
                    icon={Calendar}
                    iconColor="text-blue-500"
                    items={longTermDueToday}
                    type="customer"
                    emptyText="Không có khách dài hạn hết hạn"
                />
                <Column
                    title="Quá hạn CS"
                    icon={AlertCircle}
                    iconColor="text-red-500"
                    items={overdue}
                    type="customer"
                    emptyText="Không có khách quá hạn"
                />

                {/* TASKS COLUMN with Create Button */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                            <ListTodo size={16} className="text-purple-500" /> Công việc
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{userTasks.length}</span>
                            <button
                                onClick={() => {
                                    if (!canCreateTask) {
                                        alert('🔒 Tính năng này chỉ dành cho thành viên Gold trở lên!');
                                        return;
                                    }
                                    setShowTaskModal(true);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${!canCreateTask ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                                title={!canCreateTask ? "Chỉ dành cho thành viên Gold trở lên" : "Tạo công việc mới"}
                            >
                                {!canCreateTask ? <Lock size={14} /> : <Plus size={14} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar max-h-[550px]">
                        {userTasks.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 text-sm">
                                <ListTodo size={24} className="mx-auto mb-2 text-gray-300" />
                                Chưa có công việc nào
                            </div>
                        ) : (
                            userTasks.map(task => <TaskCard key={task.id} task={task} />)
                        )}
                    </div>
                </div>
            </div>

            {/* CALENDAR MODAL */}
            {showCalendarModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pl-4 lg:pl-[220px] animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[85vw] xl:max-w-[1200px] h-[90vh] overflow-hidden flex flex-col lg:flex-row border border-gray-100">
                        {/* LEFT: Calendar */}
                        <div className="w-full lg:w-[45%] xl:w-[40%] border-r border-gray-100 flex flex-col bg-white min-w-0">
                            <div className="p-4 lg:p-6 flex items-center justify-between border-b border-gray-100">
                                <h2 className="text-lg lg:text-2xl font-bold text-gray-800 flex items-center gap-2 truncate">
                                    <Calendar size={24} className="text-primary-600 flex-shrink-0" />
                                    <span className="truncate">Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}</span>
                                </h2>
                                <div className="flex gap-2 flex-shrink-0 ml-2">
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 lg:p-2.5 hover:bg-gray-100/80 rounded-xl transition-all border border-gray-200 hover:border-gray-300">
                                        <ChevronLeft size={18} className="text-gray-600" />
                                    </button>
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 lg:p-2.5 hover:bg-gray-100/80 rounded-xl transition-all border border-gray-200 hover:border-gray-300">
                                        <ChevronRight size={18} className="text-gray-600" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                                    <div key={d} className="py-3 text-center text-sm font-bold text-gray-500 uppercase">{d}</div>
                                ))}
                            </div>
                            <div className="flex-1 grid grid-rows-6 p-3">
                                {grid.map((row: (number | null)[], i: number) => (
                                    <div key={i} className="grid grid-cols-7">
                                        {row.map((day: number | null, j: number) => {
                                            if (!day) return <div key={j} className="p-1"></div>;
                                            const cellDateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                            const isSelected = cellDateStr === selectedDateStr;
                                            const isToday = cellDateStr === todayStr;
                                            const data = tasksByDate[cellDateStr] || { customerTasks: [], customTasks: [] };
                                            const hasItems = data.customerTasks.length > 0 || data.customTasks.length > 0;

                                            return (
                                                <div
                                                    key={j}
                                                    onClick={() => handleDayClick(day)}
                                                    className={`p-2 cursor-pointer transition-colors rounded-lg m-0.5
                                                        ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400' : hasItems ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-100'}
                                                        ${isToday ? 'ring-2 ring-yellow-400' : ''}`}
                                                >
                                                    <span className={`text-base font-medium flex items-center justify-center w-8 h-8 rounded-full ${isToday ? 'bg-blue-600 text-white' : ''}`}>
                                                        {day}
                                                    </span>
                                                    {hasItems && (
                                                        <div className="flex justify-center mt-1">
                                                            <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: Tasks for Selected Date - Split into 2 columns */}
                        <div className="flex-1 flex flex-col bg-gray-50/30">
                            <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center shadow-sm z-10">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        Công việc ngày {new Date(selectedDateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                        <span className="text-sm font-normal text-gray-500 px-2 py-0.5 bg-gray-100 rounded-lg">
                                            {new Date(selectedDateStr).toLocaleDateString('vi-VN', { weekday: 'long' })}
                                        </span>
                                    </h3>
                                </div>
                                <button onClick={() => setShowCalendarModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X size={24} className="text-gray-400 hover:text-gray-600" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                                {/* LEFT COLUMN: Customers */}
                                <div className="flex-1 flex flex-col bg-white">
                                    <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex justify-between items-center sticky top-0 backdrop-blur-sm">
                                        <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2 uppercase tracking-wide">
                                            <User size={16} /> Khách hàng <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs">{selectedTasks.customerTasks.length}</span>
                                        </h4>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {selectedTasks.customerTasks.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                                    <User size={32} className="text-gray-300" />
                                                </div>
                                                <p className="text-sm font-medium">Không có khách hàng</p>
                                            </div>
                                        ) : (
                                            selectedTasks.customerTasks.map(c => (
                                                <CustomerCard key={c.id} customer={c} isOverdue={c.recare_date! < todayStr} />
                                            ))
                                        )}
                                    </div>
                                </div>
                                {/* RIGHT COLUMN: User Tasks */}
                                <div className="flex-1 flex flex-col bg-white">
                                    <div className="p-4 bg-purple-50/50 border-b border-purple-100 flex justify-between items-center sticky top-0 backdrop-blur-sm">
                                        <h4 className="font-bold text-purple-800 text-sm flex items-center gap-2 uppercase tracking-wide">
                                            <ListTodo size={16} /> Ghi chú <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs">{selectedTasks.customTasks.length}</span>
                                        </h4>
                                        <button
                                            onClick={() => {
                                                if (!canCreateTask) {
                                                    alert('🔒 Tính năng này chỉ dành cho thành viên Gold trở lên!');
                                                    return;
                                                }
                                                setShowTaskModal(true);
                                            }}
                                            className={`p-1.5 rounded-lg transition-colors ${!canCreateTask ? 'text-gray-400 hover:bg-gray-100 cursor-not-allowed' : 'hover:bg-purple-100 text-purple-600'}`}
                                            title={!canCreateTask ? "Chỉ dành cho thành viên Gold trở lên" : "Thêm ghi chú"}
                                        >
                                            {!canCreateTask ? <Lock size={16} /> : <Plus size={16} />}
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {selectedTasks.customTasks.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                                    <ListTodo size={32} className="text-gray-300" />
                                                </div>
                                                <p className="text-sm font-medium">Không có ghi chú</p>
                                            </div>
                                        ) : (
                                            selectedTasks.customTasks.map(t => (
                                                <TaskCard key={t.id} task={t} />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE TASK MODAL */}
            {showTaskModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-primary-50 to-white">
                            <h2 className="text-lg font-bold text-gray-800">Tạo công việc mới</h2>
                            <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-white/80 rounded-full transition-colors">
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Tên công việc <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={taskForm.title}
                                    onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                                    placeholder="Nhập tên công việc..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nội dung</label>
                                <textarea
                                    value={taskForm.content}
                                    onChange={e => setTaskForm(prev => ({ ...prev, content: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none transition-all"
                                    rows={3}
                                    placeholder="Mô tả chi tiết công việc..."
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Ngày</label>
                                    <input
                                        type="date"
                                        value={taskForm.deadline}
                                        onChange={e => setTaskForm(prev => ({ ...prev, deadline: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Giờ</label>
                                    <input
                                        type="time"
                                        value={taskForm.deadlineTime}
                                        onChange={e => setTaskForm(prev => ({ ...prev, deadlineTime: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all text-sm"
                                        placeholder="HH:mm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Độ ưu tiên</label>
                                    <select
                                        value={taskForm.priority}
                                        onChange={e => setTaskForm(prev => ({ ...prev, priority: e.target.value as any }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all bg-white text-sm"
                                    >
                                        <option value="low">Thấp</option>
                                        <option value="medium">TB</option>
                                        <option value="high">Cao</option>
                                        <option value="urgent">Gấp</option>
                                    </select>
                                </div>
                            </div>

                            {/* Reminder Toggle */}
                            <div className={`p-3 rounded-xl border transition-all ${taskForm.reminderEnabled ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={taskForm.reminderEnabled}
                                        onChange={e => setTaskForm(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                        disabled={!taskForm.deadlineTime}
                                    />
                                    <div className="flex items-center gap-2">
                                        <BellRing size={16} className={taskForm.reminderEnabled ? 'text-amber-500' : 'text-gray-400'} />
                                        <span className={`text-sm font-medium ${taskForm.reminderEnabled ? 'text-amber-700' : 'text-gray-600'}`}>
                                            Nhắc nhở qua email
                                        </span>
                                    </div>
                                </label>
                                {taskForm.reminderEnabled && taskForm.deadlineTime && (
                                    <p className="text-xs text-amber-600 mt-2 ml-7">
                                        ⏰ Email sẽ được gửi lúc {(() => {
                                            const [h, m] = taskForm.deadlineTime.split(':').map(Number);
                                            const reminderHour = h - 1 < 0 ? 23 : h - 1;
                                            return `${reminderHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                        })()} (trước 1 tiếng)
                                    </p>
                                )}
                                {!taskForm.deadlineTime && (
                                    <p className="text-xs text-gray-400 mt-2 ml-7">
                                        Nhập giờ cụ thể để bật nhắc nhở
                                    </p>
                                )}
                            </div>

                            <label className="flex items-center gap-2.5 cursor-pointer py-1">
                                <input
                                    type="checkbox"
                                    checked={taskForm.applyToCustomer}
                                    onChange={e => {
                                        setTaskForm(prev => ({ ...prev, applyToCustomer: e.target.checked, customer_id: '' }));
                                        setCustomerSearch('');
                                        setSelectedCustomerName('');
                                    }}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Áp dụng cho khách hàng</span>
                            </label>
                            {taskForm.applyToCustomer && (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Tìm khách hàng theo tên hoặc SĐT..."
                                        value={selectedCustomerName || customerSearch}
                                        onChange={e => {
                                            setCustomerSearch(e.target.value);
                                            setSelectedCustomerName('');
                                            setTaskForm(prev => ({ ...prev, customer_id: '' }));
                                        }}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                                    />
                                    {customerSearch && !taskForm.customer_id && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                            {customers
                                                .filter(c =>
                                                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                                    c.phone.includes(customerSearch)
                                                )
                                                .slice(0, 5)
                                                .map(c => (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => {
                                                            setTaskForm(prev => ({ ...prev, customer_id: c.id }));
                                                            setSelectedCustomerName(`${c.name} - ${c.phone}`);
                                                            setCustomerSearch('');
                                                        }}
                                                        className="px-4 py-2.5 hover:bg-primary-50 cursor-pointer flex items-center gap-2 border-b border-gray-50 last:border-0"
                                                    >
                                                        <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-bold">
                                                            {c.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-800 text-sm">{c.name}</p>
                                                            <p className="text-xs text-gray-500">{c.phone}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            {customers.filter(c =>
                                                c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                                c.phone.includes(customerSearch)
                                            ).length === 0 && (
                                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                        Không tìm thấy khách hàng
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                    {taskForm.customer_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTaskForm(prev => ({ ...prev, customer_id: '' }));
                                                setSelectedCustomerName('');
                                                setCustomerSearch('');
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons - Inside form */}
                            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                                <button
                                    onClick={() => setShowTaskModal(false)}
                                    className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleCreateTask}
                                    disabled={!taskForm.title.trim() || saving}
                                    className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                                    {saving ? 'Đang tạo...' : 'Tạo công việc'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MOD CONSULTANT MODE TOGGLE - Floating Button */}
            {userProfile?.role === 'mod' && (
                <button
                    onClick={toggleConsultantMode}
                    disabled={togglingMode}
                    className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg font-bold text-sm transition-all duration-300 ${isConsultantMode
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                        } ${togglingMode ? 'opacity-60 cursor-wait' : ''}`}
                    title={isConsultantMode ? 'Đang ở chế độ Tư vấn - Click để chuyển sang Quản lý' : 'Đang ở chế độ Quản lý - Click để chuyển sang Tư vấn'}
                >
                    {togglingMode ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : isConsultantMode ? (
                        <UserCircle size={18} />
                    ) : (
                        <Users size={18} />
                    )}
                    <span className="hidden sm:inline">
                        {isConsultantMode ? 'Chế độ Tư vấn' : 'Chế độ Quản lý'}
                    </span>
                </button>
            )}
        </div>
    );
};

export default CalendarPage;

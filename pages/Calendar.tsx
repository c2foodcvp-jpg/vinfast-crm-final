
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Customer, CustomerStatus, MembershipTier } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Phone, User, Clock,
    Plus, CheckCircle2, Flame, AlertCircle, X,
    AlertTriangle, Timer, ListTodo, Flag, Activity, Calendar, Star, Bell, BellRing,
    Users, UserCircle, Lock, LayoutList, CheckSquare, Banknote, PauseCircle, ExternalLink, Mic, Trash2, CalendarClock
} from 'lucide-react';
import QuickInteractionModal from '../components/QuickInteractionModal';
import CustomerProgressModal, { DELIVERY_STEPS } from '../components/CustomerProgressModal';
import VoiceRecordingModal from '../components/VoiceRecordingModal';

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

const DEFAULT_TASK_FORM = {
    title: '',
    content: '',
    deadline: new Date().toISOString().split('T')[0],
    deadlineTime: '', // HH:mm format
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    applyToCustomer: false,
    customer_id: '',
    reminderEnabled: false
};

const CalendarPage: React.FC = () => {
    const { userProfile, isAdmin, isMod, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Check if returning from CustomerDetail with a specific tab
    useEffect(() => {
        const tabFromState = (location.state as any)?.tab as 'customers' | 'orders' | undefined;
        if (tabFromState) {
            setActiveMainTab(tabFromState);
            // Clear the state so it doesn't persist on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [userTasks, setUserTasks] = useState<UserTask[]>([]);

    // Modal States
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

    // Task Tab State
    const [activeTaskTab, setActiveTaskTab] = useState<'active' | 'history'>('active');

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

    // Task Form State
    const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM);
    const [saving, setSaving] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomerName, setSelectedCustomerName] = useState('');

    // Voice to Text
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [tempTranscript, setTempTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const startVoiceSession = () => {
        const isPlatinumOrHigher = userProfile?.member_tier === MembershipTier.PLATINUM ||
            userProfile?.member_tier === MembershipTier.DIAMOND ||
            isAdmin || isMod;

        if (!isPlatinumOrHigher) {
            alert('Tính năng Voice to Text chỉ dành cho thành viên Platinum trở lên!');
            return;
        }

        setShowVoiceModal(true);
        setTempTranscript('');

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Trình duyệt không hỗ trợ chuyển giọng nói thành văn bản.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error('Lỗi voice:', event.error);
            setIsListening(false);
        };
        recognition.onresult = (event: any) => {
            const currentText = Array.from(event.results)
                .map((r: any) => r[0].transcript)
                .join('');
            setTempTranscript(currentText);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const handleVoiceConfirm = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        setTaskForm(prev => ({ ...prev, content: (prev.content ? prev.content + ' ' : '') + tempTranscript }));
        setShowVoiceModal(false);
    };

    const handleVoiceCancel = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        setShowVoiceModal(false);
    };

    // Quick Interaction Modal State
    const [selectedCustomerForQuick, setSelectedCustomerForQuick] = useState<Customer | null>(null);
    const [showQuickModal, setShowQuickModal] = useState(false);

    // Progress Modal State (For Orders Tab)
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [selectedCustomerForProgress, setSelectedCustomerForProgress] = useState<Customer | null>(null);

    // UI Logic States
    const [activeMainTab, setActiveMainTab] = useState<'customers' | 'orders'>('customers');
    const [activeOrderTab, setActiveOrderTab] = useState<'processing' | 'completed' | 'refund' | 'suspended'>('processing');
    const [showOrderFilter, setShowOrderFilter] = useState(false);

    // Date Filter for Orders (Default to current month)
    const [orderDateRange, setOrderDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const formatDate = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    });

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // MOD Consultant Mode: Switch between team view and personal view
    const [isConsultantMode, setIsConsultantMode] = useState(() => {
        // Try to load from local storage first to prevent flickering/reset
        if (userProfile?.id) {
            const saved = localStorage.getItem(`consultant_mode_${userProfile.id}`);
            if (saved !== null) return saved === 'true';
        }
        return false;
    });
    const [togglingMode, setTogglingMode] = useState(false);

    // Initialize/Sync consultant mode from user profile
    useEffect(() => {
        if (!userProfile) return;

        // If DB has a value, use it (Source of Truth)
        if (userProfile.is_consultant_mode !== undefined) {
            setIsConsultantMode(userProfile.is_consultant_mode);
            // Sync valid DB value to local
            localStorage.setItem(`consultant_mode_${userProfile.id}`, String(userProfile.is_consultant_mode));
        } else {
            // If DB is undefined (e.g. missing column), fall back to Local Storage
            const saved = localStorage.getItem(`consultant_mode_${userProfile.id}`);
            if (saved !== null) setIsConsultantMode(saved === 'true');
        }
    }, [userProfile?.is_consultant_mode, userProfile?.id]);

    // Toggle consultant mode and save to database
    const toggleConsultantMode = async () => {
        if (!userProfile || !isMod || togglingMode) return;
        setTogglingMode(true);
        try {
            const newMode = !isConsultantMode;

            // Optimistic update (Local first)
            setIsConsultantMode(newMode);
            localStorage.setItem(`consultant_mode_${userProfile.id}`, String(newMode));

            const { error } = await supabase
                .from('profiles')
                .update({ is_consultant_mode: newMode })
                .eq('id', userProfile.id);

            if (error) throw error;

            await refreshProfile(); // Refresh context to sync others
            // Refetch data with new mode
            fetchDataWithMode(newMode);
        } catch (e) {
            console.error('Error toggling consultant mode:', e);
            alert('Lỗi khi chuyển chế độ - Vui lòng thử lại');
            // Revert on error
            setIsConsultantMode(!isConsultantMode);
        } finally {
            setTogglingMode(false);
        }
    };

    const handleCloseQuickInteraction = React.useCallback(() => {
        setShowQuickModal(false);
        setSelectedCustomerForQuick(null);
    }, []);



    useEffect(() => {
        fetchData();
    }, [userProfile]);

    const fetchData = async (silent: boolean = false, consultantModeOverride?: boolean) => {
        if (!userProfile) return;
        if (!silent) setLoading(true); // Only show spinner on full load
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

            // --- Fetch Customers with recare_date OR deal_status ---
            // Changed: Removed .not('recare_date', 'is', null) and .neq('status', CustomerStatus.WON)
            // to allow showing Deals/Orders that might be WON or missing recare date
            let query = supabase
                .from('customers')
                .select('id, name, phone, status, recare_date, interest, classification, sales_rep, creator_id, created_at, is_special_care, is_long_term, deal_status, deal_details, delivery_progress, won_at')
                .neq('status', CustomerStatus.LOST);

            if (!isAdmin) {
                if (teamIds.length > 0) query = query.in('creator_id', teamIds);
                else query = query.eq('creator_id', userProfile.id);
            }

            const { data: customerData } = await query;
            const fetchedCustomers = customerData as Customer[] || [];
            setCustomers(fetchedCustomers);

            // Sync selectedCustomerForProgress with fresh data if it exists
            if (activeMainTab === 'orders' && selectedCustomerForProgress) {
                const updatedSelected = fetchedCustomers.find(c => c.id === selectedCustomerForProgress.id);
                if (updatedSelected) {
                    setSelectedCustomerForProgress(updatedSelected);
                }
            }

            // --- Fetch User Tasks ---
            const { data: taskData } = await supabase
                .from('user_tasks')
                .select('*, customers(name)')
                .eq('user_id', userProfile.id)
                .order('deadline', { ascending: true }); // Removed .eq('is_completed', false)

            const tasksWithCustomerName = (taskData || []).map((t: any) => ({
                ...t,
                customer_name: t.customers?.name || null
            }));

            // --- Auto-Check Logic (Runs once on load) ---
            const now = new Date();
            const updates: Promise<any>[] = [];

            tasksWithCustomerName.forEach((t: UserTask) => {
                if (!t.is_completed && t.deadline) {
                    const deadline = new Date(t.deadline);
                    const diffMs = now.getTime() - deadline.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);

                    // 1. Overdue > 24h -> Auto Complete
                    if (diffHours > 24) {
                        updates.push(
                            Promise.resolve(supabase.from('user_tasks').update({ is_completed: true }).eq('id', t.id))
                        );
                        t.is_completed = true; // Optimistic update for UI
                    }
                    // 2. Overdue > 4h -> Send Email (Mock)
                    else if (diffHours > 4 && t.priority !== 'low' && !t.reminder_sent) {
                        // In a real app, call your Email Service/Edge Function here
                        console.log(`[Auto-Email] Notification sent to TVBH for task: ${t.title}`);

                        updates.push(
                            Promise.resolve(supabase.from('user_tasks').update({ reminder_sent: true }).eq('id', t.id))
                        );
                        t.reminder_sent = true; // Optimistic update
                    }
                }
            });

            if (updates.length > 0) {
                await Promise.all(updates);
            }

            setUserTasks(tasksWithCustomerName);

        } catch (e) {
            console.error("Error fetching data", e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Helper for toggling mode
    const fetchDataWithMode = (mode: boolean) => fetchData(false, mode);

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

    const longTermDueToday = useMemo(() =>
        customers.filter(c =>
            c.is_long_term === true &&
            c.recare_date === todayStr &&
            c.status !== CustomerStatus.WON &&
            c.status !== CustomerStatus.LOST
        ), [customers, todayStr]);

    // --- ORDERS / DEALS LISTS ---
    // Helper to check date range
    const isInDateRange = (dateStr?: string) => {
        if (!dateStr) return false;
        // Compare only YYYY-MM-DD parts
        const d = dateStr.split('T')[0];
        return d >= orderDateRange.start && d <= orderDateRange.end;
    };

    const processingDeals = useMemo(() => customers.filter(c =>
        c.status === CustomerStatus.WON &&
        (c.deal_status === 'processing' || c.deal_status === 'completed_pending') &&
        isInDateRange(c.won_at || c.created_at)
    ), [customers, orderDateRange]);

    const completedDeals = useMemo(() => customers.filter(c =>
        c.status === CustomerStatus.WON &&
        c.deal_status === 'completed' &&
        isInDateRange(c.won_at || c.created_at)
    ), [customers, orderDateRange]);

    const refundedDeals = useMemo(() => customers.filter(c =>
        (c.deal_status === 'refunded' || c.deal_status === 'refund_pending') &&
        isInDateRange(c.won_at || c.created_at)
    ), [customers, orderDateRange]);

    const suspendedDeals = useMemo(() => customers.filter(c =>
        (c.deal_status === 'suspended' || c.deal_status === 'suspended_pending') &&
        isInDateRange(c.won_at || c.created_at)
    ), [customers, orderDateRange]);

    // Helper to get active list
    const activeOrderList = useMemo(() => {
        switch (activeOrderTab) {
            case 'processing': return processingDeals;
            case 'completed': return completedDeals;
            case 'refund': return refundedDeals;
            case 'suspended': return suspendedDeals;
            default: return [];
        }
    }, [activeOrderTab, processingDeals, completedDeals, refundedDeals, suspendedDeals]);


    // Derive Lists
    const activeTasks = useMemo(() => userTasks.filter(t => !t.is_completed), [userTasks]);
    const completedTasks = useMemo(() => userTasks.filter(t => t.is_completed), [userTasks]);
    const currentTabTasks = activeTaskTab === 'active' ? activeTasks : completedTasks;

    // Total Tasks Count (Includes Customer Tasks + Active User Notes Due Today/Overdue)
    const totalTasks = specialCare.length + dueToday.length + overdue.length + longTermDueToday.length +
        activeTasks.filter(t => t.deadline && t.deadline.split('T')[0] <= todayStr).length;

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

        // Populate with tasks (Active Only for Calendar View) or All? Usually active.
        activeTasks.forEach(t => {
            if (t.deadline) {
                // deadline is ISO timestamp, we need YYYY-MM-DD
                const dateStr = t.deadline.split('T')[0];
                if (!map[dateStr]) map[dateStr] = { customerTasks: [], customTasks: [] };
                map[dateStr].customTasks.push(t);
            }
        });

        return map;
    }, [customers, activeTasks]);

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
    const resetTaskForm = () => {
        setTaskForm(DEFAULT_TASK_FORM);
        setCustomerSearch('');
        setSelectedCustomerName('');
        setEditingTaskId(null);
    };

    const handleCreateTask = async () => {
        if (!taskForm.title.trim() || !userProfile) return;

        // Permission Gate
        if (!canCreateTask) {
            alert('🔒 Tính năng này chỉ dành cho thành viên Gold trở lên!');
            return;
        }

        setSaving(true);
        try {
            const deadlineISO = taskForm.deadline && taskForm.deadlineTime
                ? `${taskForm.deadline}T${taskForm.deadlineTime}:00`
                : taskForm.deadline ? `${taskForm.deadline}T23:59:00` : null;

            const taskData = {
                title: taskForm.title.trim(),
                content: taskForm.content.trim() || undefined, // Use undefined for TS compatibility with UserTask
                priority: taskForm.priority,
                deadline: deadlineISO || undefined, // Fix null not assignable to undefined
                user_id: userProfile.id,
                customer_id: taskForm.applyToCustomer && taskForm.customer_id ? taskForm.customer_id : null,
                reminder_enabled: taskForm.reminderEnabled && !!taskForm.deadlineTime,
                reminder_sent: false
            };

            if (editingTaskId) {
                // Update existing task
                const { error } = await supabase
                    .from('user_tasks')
                    .update({ ...taskData, content: taskData.content || null, deadline: taskData.deadline || null }) // Send null to DB
                    .eq('id', editingTaskId);
                if (error) throw error;

                // Optimistic Update
                setUserTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, ...taskData } : t));
                alert("Đã cập nhật công việc!");
            } else {
                // Create new task
                const { data, error } = await supabase
                    .from('user_tasks')
                    .insert([{ ...taskData, content: taskData.content || null }])
                    .select()
                    .single(); // Select single to get the inserted object
                if (error) throw error;

                // Optimistic Add
                if (data) {
                    const newTask: UserTask = {
                        ...data,
                        content: data.content || undefined,
                        customer_id: data.customer_id || undefined, // Ensure type compatibility
                        customer_name: customers.find(c => c.id === data.customer_id)?.name
                    };
                    setUserTasks(prev => [...prev, newTask]);
                }
                alert("Đã tạo công việc mới!");
            }

            setShowTaskModal(false);
            resetTaskForm();
        } catch (e: any) {
            console.error('Error saving task:', e);
            alert("Lỗi khi lưu công việc: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const openRescheduleModal = (task: UserTask) => {
        // Parse deadline to date and time
        let deadlineDate = '';
        let deadlineTime = '';
        if (task.deadline) {
            const dateObj = new Date(task.deadline);
            deadlineDate = task.deadline.split('T')[0];
            // Format HH:mm
            deadlineTime = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
            // If time is 23:59 and originally set as no time? Hard to tell, but keeping time is safer.
        }

        setTaskForm({
            title: task.title,
            content: task.content || '',
            priority: task.priority,
            deadline: deadlineDate,
            deadlineTime: deadlineTime,
            reminderEnabled: task.reminder_enabled || false,
            applyToCustomer: !!task.customer_id,
            customer_id: task.customer_id || ''
        });

        if (task.customer_id && task.customer_name) {
            setSelectedCustomerName(task.customer_name);
        }

        setEditingTaskId(task.id);
        setShowTaskModal(true);
    };


    const handleCompleteTask = async (taskId: string) => {
        try {
            await supabase.from('user_tasks').update({ is_completed: true }).eq('id', taskId);
            // Optimistic Update
            setUserTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: true } : t));
        } catch (e) {
            console.error('Error completing task', e);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('Bạn có chắc muốn xóa ghi chú này?')) return;
        try {
            await supabase.from('user_tasks').delete().eq('id', taskId);
            setUserTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (e) {
            console.error('Error deleting task', e);
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
    const CustomerCard = ({ customer, isOverdue = false, contextIds = [], onClick }: { customer: Customer; isOverdue?: boolean; contextIds?: string[]; onClick?: (c: Customer) => void }) => {
        // Calculate Progress Percentage
        const progressPercent = useMemo(() => {
            if (customer.status !== CustomerStatus.WON) return 0;
            const steps = DELIVERY_STEPS.filter(step => !step.condition || step.condition(customer));
            if (steps.length === 0) return 0;
            const completed = steps.filter(s => customer.delivery_progress?.[s.key]?.completed).length;
            return (completed / steps.length) * 100;
        }, [customer]);

        return (
            <div
                onClick={() => {
                    if (onClick) {
                        onClick(customer);
                    } else {
                        setSelectedCustomerForQuick(customer);
                        setShowQuickModal(true);
                    }
                }}
                className={`rounded-xl border transition-all cursor-pointer group relative bg-white overflow-hidden mt-1
                ${isOverdue
                        ? 'border-l-4 border-l-red-500 border-y border-r border-gray-100 shadow-[0_2px_8px_rgba(239,68,68,0.05)] hover:shadow-md'
                        : 'border-l-4 border-l-transparent border-y border-r border-gray-100 hover:border-l-blue-500 hover:shadow-md'
                    }`}
            >
                {/* Mini Progress Bar */}
                {customer.status === CustomerStatus.WON && (
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100 z-10">
                        <div
                            className="h-full bg-green-500 rounded-r-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                <div className={`p-4 ${customer.status === CustomerStatus.WON ? 'pt-5' : ''}`}>
                    <div className="flex justify-between items-start mb-2.5">
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                            {customer.classification === 'Hot' && <div className="p-1 bg-red-100 rounded-full shrink-0"><Flame size={12} className="text-red-600 fill-red-600" /></div>}
                            <h4 className="font-bold text-gray-800 text-sm group-hover:text-primary-700 truncate">{customer.name}</h4>
                        </div>
                        {getCustomerStatusDisplay(customer)}
                    </div>

                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                            <Phone size={10} className="text-gray-400" />
                            <span className="font-medium">{customer.phone}</span>
                        </div>
                        {customer.interest && (
                            <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{customer.interest}</span>
                        )}
                    </div>

                    {/* Quick Actions Overlay on Hover */}
                    <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/customers/${customer.id}`, { state: { from: '/calendar', customerIds: contextIds } });
                            }}
                            className="p-2 bg-gray-100 hover:bg-white text-gray-600 rounded-full shadow-sm border border-gray-200 hover:border-blue-200 hover:text-blue-600 transition-all"
                            title="Xem chi tiết (Trang riêng)"
                        >
                            <ExternalLink size={14} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!canCreateTask) {
                                    alert('🔒 Tính năng này chỉ dành cho thành viên Gold trở lên!');
                                    return;
                                }
                                setTaskForm(prev => ({
                                    ...prev,
                                    title: `Ghi chú: ${customer.name}`,
                                    applyToCustomer: true,
                                    customer_id: customer.id
                                }));
                                setSelectedCustomerName(`${customer.name} - ${customer.phone}`);
                                setShowTaskModal(true);
                            }}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md hover:shadow-lg transition-all"
                            title="Tạo lịch nhắc hẹn"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- Task Card Component ---
    const TaskCard = ({ task }: { task: UserTask }) => {
        const config = PRIORITY_CONFIG[task.priority];
        const IconComponent = config.icon;

        // Check Overdue
        const isOverdue = useMemo(() => {
            if (task.is_completed || !task.deadline) return false;
            return new Date() > new Date(task.deadline);
        }, [task]);

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
            <div className={`p-3 rounded-xl border bg-white transition-all group relative
                ${isOverdue
                    ? 'border-red-200 shadow-[0_0_8px_rgba(239,68,68,0.1)]'
                    : 'border-gray-100 hover:border-blue-200'
                }
            `}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                        <h4 className={`font-bold text-sm truncate max-w-[130px] ${isOverdue ? 'text-red-700' : 'text-gray-800'}`}>
                            {task.title}
                        </h4>

                        {/* Overdue Badge */}
                        {isOverdue && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded animate-pulse">
                                Quá hạn
                            </span>
                        )}

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

                    {/* Actions */}
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        {!task.is_completed && (
                            <button
                                onClick={() => handleCompleteTask(task.id)}
                                className="p-1 rounded-full hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                                title="Đánh dấu hoàn thành"
                            >
                                <CheckCircle2 size={16} />
                            </button>
                        )}
                        {/* Delete button: only Admin/Mod can delete completed tasks */}
                        {(!task.is_completed || isAdmin || isMod) && (
                            <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                                title="Xóa ghi chú"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
                {task.content && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.content}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${config.color}`}>
                        <IconComponent size={10} /> {config.label}
                    </span>
                    {task.deadline && (
                        <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                            <Clock size={10} /> {formatDeadline(task.deadline)}
                        </span>
                    )}
                    {task.customer_name && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (task.customer_id) {
                                    const customer = customers.find(c => c.id === task.customer_id);
                                    if (customer) {
                                        setSelectedCustomerForQuick(customer);
                                        setShowQuickModal(true);
                                    }
                                }
                            }}
                            className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[80px] cursor-pointer hover:bg-purple-200 transition-colors border border-transparent hover:border-purple-300"
                            title="Xem thông tin khách hàng"
                        >
                            {task.customer_name}
                        </button>
                    )}

                    {/* Reschedule Button - Hidden when completed */}
                    {!task.is_completed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openRescheduleModal(task);
                            }}
                            className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all border border-gray-200 text-[10px] font-medium"
                            title="Dời lịch / Chỉnh sửa"
                        >
                            <CalendarClock size={12} />
                            Dời lịch
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // --- Column Component ---
    type ThemeColor = 'orange' | 'blue' | 'red' | 'purple' | 'sky' | 'green';

    const THEMES: Record<ThemeColor, { bg: string, border: string, headerBg: string, iconBg: string, iconText: string, badge: string, badgeText: string }> = {
        orange: { bg: 'bg-orange-50/30', border: 'border-orange-200', headerBg: 'bg-orange-50/80', iconBg: 'bg-orange-100', iconText: 'text-orange-600', badge: 'bg-orange-100', badgeText: 'text-orange-700' },
        blue: { bg: 'bg-blue-50/30', border: 'border-blue-200', headerBg: 'bg-blue-50/80', iconBg: 'bg-blue-100', iconText: 'text-blue-600', badge: 'bg-blue-100', badgeText: 'text-blue-700' },
        red: { bg: 'bg-red-50/30', border: 'border-red-200', headerBg: 'bg-red-50/80', iconBg: 'bg-red-100', iconText: 'text-red-600', badge: 'bg-red-100', badgeText: 'text-red-700' },
        purple: { bg: 'bg-purple-50/30', border: 'border-purple-200', headerBg: 'bg-purple-50/80', iconBg: 'bg-purple-100', iconText: 'text-purple-600', badge: 'bg-purple-100', badgeText: 'text-purple-700' },
        sky: { bg: 'bg-sky-50/30', border: 'border-sky-200', headerBg: 'bg-sky-50/80', iconBg: 'bg-sky-100', iconText: 'text-sky-600', badge: 'bg-sky-100', badgeText: 'text-sky-700' },
        green: { bg: 'bg-green-50/30', border: 'border-green-200', headerBg: 'bg-green-50/80', iconBg: 'bg-green-100', iconText: 'text-green-600', badge: 'bg-green-100', badgeText: 'text-green-700' },
    };

    const Column = ({ title, icon: Icon, theme, items, type, emptyText, onCardClick }: {
        title: string;
        icon: React.ElementType;
        theme: ThemeColor;
        items: Customer[] | UserTask[];
        type: 'customer' | 'task';
        emptyText: string;
        onCardClick?: (item: any) => void;
    }) => {
        const contextIds = useMemo(() => {
            if (type === 'customer') return (items as Customer[]).map(c => c.id);
            return [];
        }, [items, type]);

        const styles = THEMES[theme];

        return (
            <div className={`${styles.bg} rounded-2xl border ${styles.border} flex flex-col overflow-hidden h-full shadow-sm`}>
                <div className={`p-4 flex items-center justify-between border-b ${styles.border} ${styles.headerBg} backdrop-blur-sm`}>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2.5 text-sm uppercase tracking-wide">
                        <div className={`p-1.5 rounded-lg ${styles.iconBg} ${styles.iconText}`}>
                            <Icon size={14} />
                        </div>
                        {title}
                    </h3>
                    <span className={`${styles.badge} ${styles.badgeText} text-xs font-bold px-2.5 py-0.5 rounded-lg shadow-sm`}>{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-white/50 max-h-[350px] lg:max-h-none">
                    {items.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 text-sm">
                            <CheckCircle2 size={24} className="mx-auto mb-2 text-gray-300" />
                            {emptyText}
                        </div>
                    ) : (
                        items.map((item: any) =>
                            type === 'customer'
                                ? <CustomerCard key={item.id} customer={item} isOverdue={item.recare_date < todayStr} contextIds={contextIds} onClick={onCardClick} />
                                : <TaskCard key={item.id} task={item} />
                        )
                    )}
                </div>
            </div>
        );
    };

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
            {/* HEADER - Clean Design */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                        Xin chào, {userProfile?.full_name || 'bạn'}! <span className="text-2xl">👋</span>
                    </h1>
                    <p className="text-gray-500 font-medium">
                        Hôm nay bạn có <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold text-sm mx-1">{totalTasks}</span> công việc cần xử lý
                    </p>
                </div>
                <button
                    onClick={() => setShowCalendarModal(true)}
                    className="group flex items-center gap-2 bg-gray-50 hover:bg-white text-gray-700 hover:text-primary-600 border border-gray-200 hover:border-primary-100 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm hover:shadow-md"
                >
                    <CalendarIcon size={18} className="text-gray-500 group-hover:text-primary-600 transition-colors" />
                    Xem lịch tháng
                </button>
            </div>

            {/* NEW SPLIT LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-180px)] lg:min-h-[600px] h-auto">
                {/* LEFT PANEL - TABS (Customers / Orders) - Gray Background */}
                <div className="lg:col-span-8 flex flex-col bg-gray-50 rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
                    {/* Tabs Header - Clean White on Gray */}
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-2 gap-2">
                        <div className="flex gap-2 flex-1">
                            <button
                                onClick={() => setActiveMainTab('customers')}
                                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeMainTab === 'customers'
                                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                                    }`}
                            >
                                <Users size={18} />
                                KHÁCH HÀNG CẦN XỬ LÝ
                            </button>
                            <button
                                onClick={() => setActiveMainTab('orders')}
                                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeMainTab === 'orders'
                                    ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                                    }`}
                            >
                                <ListTodo size={18} />
                                ĐƠN HÀNG CẦN XỬ LÝ
                            </button>
                        </div>

                        {/* Order Date Filter */}
                        {activeMainTab === 'orders' && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
                                <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Lọc từ:</span>
                                <input
                                    type="date"
                                    value={orderDateRange.start}
                                    onChange={e => setOrderDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="bg-gray-50 border-gray-200 rounded-lg text-xs font-medium text-gray-700 py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <span className="text-gray-300">-</span>
                                <input
                                    type="date"
                                    value={orderDateRange.end}
                                    onChange={e => setOrderDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="bg-gray-50 border-gray-200 rounded-lg text-xs font-medium text-gray-700 py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        )}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 p-4 bg-gray-50/30 overflow-hidden">
                        {activeMainTab === 'customers' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:h-full h-auto">
                                <Column
                                    title="CS Đặc biệt"
                                    icon={Flame}
                                    theme="orange"
                                    items={specialCare} // Moved Special Care here
                                    type="customer"
                                    emptyText="Không có khách đặc biệt"
                                />
                                <Column
                                    title="Cần CS hôm nay"
                                    icon={Timer}
                                    theme="green"
                                    items={dueToday}
                                    type="customer"
                                    emptyText="Không có khách cần CS hôm nay"
                                />
                                <Column
                                    title="Hết CS Dài hạn"
                                    icon={Calendar}
                                    theme="sky"
                                    items={longTermDueToday}
                                    type="customer"
                                    emptyText="Không có khách dài hạn hết hạn"
                                />
                                <Column
                                    title="Quá hạn CS"
                                    icon={AlertCircle}
                                    theme="red"
                                    items={overdue}
                                    type="customer"
                                    emptyText="Không có khách quá hạn"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:h-full h-auto">
                                <Column
                                    title="Đang xử lý"
                                    icon={LayoutList}
                                    theme="blue"
                                    items={processingDeals}
                                    type="customer"
                                    emptyText="Không có đơn đang xử lý"
                                    onCardClick={(c) => {
                                        setSelectedCustomerForProgress(c);
                                        setShowProgressModal(true);
                                    }}
                                />
                                <Column
                                    title="Đã hoàn thành"
                                    icon={CheckSquare}
                                    theme="green"
                                    items={completedDeals}
                                    type="customer"
                                    emptyText="Không có đơn hoàn thành"
                                    onCardClick={(c) => {
                                        setSelectedCustomerForProgress(c);
                                        setShowProgressModal(true);
                                    }}
                                />
                                <Column
                                    title="Trả cọc"
                                    icon={Banknote}
                                    theme="orange"
                                    items={refundedDeals}
                                    type="customer"
                                    emptyText="Không có đơn trả cọc"
                                    onCardClick={(c) => {
                                        setSelectedCustomerForProgress(c);
                                        setShowProgressModal(true);
                                    }}
                                />
                                <Column
                                    title="Hồ sơ treo"
                                    icon={PauseCircle}
                                    theme="red"
                                    items={suspendedDeals}
                                    type="customer"
                                    emptyText="Không có hồ sơ treo"
                                    onCardClick={(c) => {
                                        setSelectedCustomerForProgress(c);
                                        setShowProgressModal(true);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL - TASKS - Blue Background - Wider */}
                <div className="lg:col-span-4 h-auto lg:h-full min-h-[500px]">
                    <div className="bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col overflow-hidden h-full shadow-sm">
                        <div className="p-4 flex items-center justify-between border-b border-blue-100 bg-white/80 backdrop-blur-sm shadow-sm z-10">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
                                        <ListTodo size={14} />
                                    </div>
                                    <span className="hidden sm:inline">Danh sách</span>
                                </h3>
                                {/* Tabs */}
                                <div className="flex bg-gray-100 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setActiveTaskTab('active')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTaskTab === 'active' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        Hiện tại ({activeTasks.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTaskTab('history')}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTaskTab === 'history' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        Lịch sử ({completedTasks.length})
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (!canCreateTask) {
                                        alert('🔒 Tính năng này chỉ dành cho thành viên Gold trở lên!');
                                        return;
                                    }
                                    setShowTaskModal(true);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${!canCreateTask ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-200/50'}`}
                                title={!canCreateTask ? "Chỉ dành cho thành viên Gold trở lên" : "Tạo công việc mới"}
                            >
                                {!canCreateTask ? <Lock size={12} /> : <Plus size={12} />}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-gray-50/30">
                            {currentTabTasks.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm flex flex-col items-center">
                                    <div className="p-3 bg-gray-100 rounded-full mb-3">
                                        <ListTodo size={24} className="text-gray-300" />
                                    </div>
                                    {activeTaskTab === 'active' ? 'Chưa có công việc nào' : 'Chưa có công việc nào hoàn thành'}
                                </div>
                            ) : (
                                currentTabTasks.map(task => <TaskCard key={task.id} task={task} />)
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CALENDAR MODAL */}
            {/* NEW: Quick Interaction Modal */}
            <QuickInteractionModal
                isOpen={showQuickModal}
                onClose={() => setShowQuickModal(false)}
                customer={selectedCustomerForQuick}
                userProfile={userProfile}
                onSuccess={() => {
                    fetchData();
                    // Optional: Show Success Toast? Component handles alert currently? 
                    // Let component show alert or silent refresh.
                }}
            />

            {/* Calendar Modal */}
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
                            <div className="flex-1 grid grid-rows-6">
                                {grid.map((row: (number | null)[], i: number) => (
                                    <div key={i} className="grid grid-cols-7 border-b border-gray-50 last:border-0 h-full">
                                        {row.map((day: number | null, j: number) => {
                                            if (!day) return <div key={j} className="bg-gray-50/30 border-r border-gray-50 last:border-0"></div>;

                                            const cellDateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                            const isSelected = cellDateStr === selectedDateStr;
                                            const isToday = cellDateStr === todayStr;

                                            // Get day's data
                                            const data = tasksByDate[cellDateStr] || { customerTasks: [], customTasks: [] };
                                            const totalItems = data.customerTasks.length + data.customTasks.length;

                                            return (
                                                <div
                                                    key={j}
                                                    onClick={() => handleDayClick(day)}
                                                    className={`relative min-h-[80px] p-2 cursor-pointer transition-all border-r border-gray-50 last:border-0 flex flex-col justify-between group hover:bg-gray-50
                                                        ${isSelected ? 'bg-blue-50/40' : ''}
                                                    `}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all
                                                            ${isToday
                                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                                : isSelected
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : 'text-gray-700 group-hover:bg-white'}
                                                        `}>
                                                            {day}
                                                        </span>
                                                    </div>

                                                    {/* Indicators */}
                                                    {totalItems > 0 && (
                                                        <div className="flex flex-col gap-1 mt-1">
                                                            {data.customerTasks.length > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>
                                                                    <span className="text-[10px] text-gray-500 font-medium truncate hidden md:inline">{data.customerTasks.length} khách</span>
                                                                </div>
                                                            )}
                                                            {data.customTasks.length > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                                    <span className="text-[10px] text-gray-500 font-medium truncate hidden md:inline">{data.customTasks.length} việc</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Selection Marker (Active Border) */}
                                                    {isSelected && <div className="absolute inset-0 border-2 border-blue-400/30 rounded-lg pointer-events-none"></div>}
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
                                                <CustomerCard key={c.id} customer={c} isOverdue={c.recare_date! < todayStr} contextIds={selectedTasks.customerTasks.map(x => x.id)} />
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
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span className="p-2 bg-purple-50 text-purple-600 rounded-lg"><ListTodo size={20} /></span>
                                {editingTaskId ? 'Cập nhật công việc' : 'Tạo công việc mới'}
                            </h2>
                            <button onClick={() => { setShowTaskModal(false); resetTaskForm(); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} className="text-gray-400 hover:text-gray-600" />
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
                            <div className="relative">
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nội dung</label>
                                <textarea
                                    value={taskForm.content}
                                    onChange={e => setTaskForm(prev => ({ ...prev, content: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none transition-all"
                                    rows={3}
                                    placeholder="Mô tả chi tiết công việc..."
                                />
                                <button
                                    onClick={startVoiceSession}
                                    className="absolute bottom-3 right-3 p-1.5 rounded-full bg-gray-100 text-gray-400 hover:text-red-600 hover:bg-gray-200 transition-colors"
                                    title="Nhập bằng giọng nói (Platinum+)"
                                >
                                    <Mic size={16} />
                                </button>
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
                                    onClick={() => { setShowTaskModal(false); resetTaskForm(); }}
                                    className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleCreateTask}
                                    disabled={!taskForm.title.trim() || saving}
                                    className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : (editingTaskId ? <CalendarClock size={18} /> : <Plus size={18} />)}
                                    {saving ? 'Đang lưu...' : (editingTaskId ? 'Cập nhật' : 'Tạo công việc')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Interaction Modal */}
            <QuickInteractionModal
                isOpen={showQuickModal}
                onClose={handleCloseQuickInteraction}
                customer={selectedCustomerForQuick}
                userProfile={userProfile}
                onSuccess={() => {
                    setShowQuickModal(false);
                    fetchData(true); // Call fetchData with silent=true
                }}
            />

            {/* Progress/Finance Modal for Orders */}
            {/* Progress Modal (Orders Tab) */}
            {selectedCustomerForProgress && (
                <CustomerProgressModal
                    customer={selectedCustomerForProgress}
                    visible={showProgressModal}
                    onClose={() => setShowProgressModal(false)}
                    onUpdate={() => fetchData(true)}
                />
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

            {/* Voice Recording Modal */}
            <VoiceRecordingModal
                isOpen={showVoiceModal}
                onClose={handleVoiceCancel}
                onConfirm={handleVoiceConfirm}
                transcript={tempTranscript}
                isListening={isListening}
            />
        </div>
    );
};

export default CalendarPage;

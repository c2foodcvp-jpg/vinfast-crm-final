import React, { useState, useEffect, useRef } from 'react';
import { Customer, Interaction, UserProfile, CustomerClassification, CustomerStatus } from '../types';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Phone, MessageCircle, Calendar, Save, CheckCircle2, MapPin, Loader2, ExternalLink, History, CalendarDays, Flame, ListTodo, BellRing, Lock, Calculator, Ban, AlertTriangle, Mic } from 'lucide-react';
import { MembershipTier } from '../types';
import VoiceRecordingModal from './VoiceRecordingModal';
import ShareCustomerModal from './ShareCustomerModal';
import ChangeSalesModal from './ChangeSalesModal';
import { RefreshCw, Share2, ArrowRightLeft } from 'lucide-react';

interface QuickInteractionModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
    userProfile: UserProfile | null;
    onSuccess: () => void;
}

const QuickInteractionModal: React.FC<QuickInteractionModalProps> = ({ isOpen, onClose, customer, userProfile, onSuccess }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'note' | 'call' | 'zalo' | 'meeting' | 'task'>('note');
    const [showHistory, setShowHistory] = useState(false); // Toggle for side panel

    // Task Form
    const [taskForm, setTaskForm] = useState({
        title: '',
        deadline: new Date().toISOString().split('T')[0],
        deadlineTime: '09:00',
        reminder: false
    });
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    // Optional update fields
    const [updateRecare, setUpdateRecare] = useState(false);
    const [newRecareDate, setNewRecareDate] = useState('');
    const [newClassification, setNewClassification] = useState<CustomerClassification | ''>('');
    const [isSpecialCare, setIsSpecialCare] = useState(false);
    const [isLongTerm, setIsLongTerm] = useState(false);

    // History
    const [history, setHistory] = useState<Interaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Stop Care Modal
    const [showStopModal, setShowStopModal] = useState(false);
    const [stopReason, setStopReason] = useState('');
    const [stoppingCare, setStoppingCare] = useState(false);

    // Voice to Text
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [tempTranscript, setTempTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // New State for UI/UX Pro Max Features
    const [showShareModal, setShowShareModal] = useState(false);
    const [showChangeSalesModal, setShowChangeSalesModal] = useState(false);

    // Car Model Logic
    const [newInterest, setNewInterest] = useState('');
    const [isEditingInterest, setIsEditingInterest] = useState(false);
    const [carList, setCarList] = useState<string[]>([]);

    // UI Refs
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch Car Models once
        const fetchCars = async () => {
            const { data } = await supabase.from('car_models').select('name').order('priority', { ascending: true });
            if (data) setCarList(data.map(c => c.name));
        };
        fetchCars();
    }, []);

    const startVoiceSession = () => {
        const isPlatinumOrHigher = userProfile?.member_tier === MembershipTier.PLATINUM ||
            userProfile?.member_tier === MembershipTier.DIAMOND ||
            userProfile?.role === 'admin' ||
            userProfile?.role === 'mod';

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
        setContent(prev => (prev ? prev + ' ' : '') + tempTranscript);
        setShowVoiceModal(false);
    };

    const handleVoiceCancel = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        setShowVoiceModal(false);
    };

    useEffect(() => {
        if (isOpen && customer) {
            // Reset form
            setContent('');
            setActiveTab('note');
            setUpdateRecare(false);
            setNewRecareDate('');
            setNewClassification('');
            setTaskForm({
                title: '',
                deadline: new Date().toISOString().split('T')[0],
                deadlineTime: '09:00',
                reminder: false
            });

            // Auto-fill existing data
            if (customer.recare_date) {
                setNewRecareDate(customer.recare_date);
                // If recare date exists, default updateRecare to false unless user wants to change it
                // setUpdateRecare(!!customer.recare_date);
            }
            if (customer.classification) setNewClassification(customer.classification);
            setIsSpecialCare(!!customer.is_special_care);
            setIsLongTerm(!!customer.is_long_term);
            setNewInterest(customer.interest || ''); // Init interest

            fetchHistory(customer.id);
        }
    }, [isOpen, customer]);

    const fetchHistory = async (custId: string) => {
        setLoadingHistory(true);
        try {
            const { data } = await supabase.from('interactions')
                .select('*')
                .eq('customer_id', custId)
                .order('created_at', { ascending: false })
                .limit(5);
            if (data) setHistory(data as Interaction[]);
        } catch (e) {
            console.error("Error fetching history", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (!isOpen || !customer) return null;

    // Handle Stop Care
    const handleStopCare = async () => {
        if (!stopReason.trim()) {
            alert('Vui lòng nhập lý do ngưng chăm sóc');
            return;
        }
        setStoppingCare(true);
        try {
            const { error } = await supabase
                .from('customers')
                .update({ status: CustomerStatus.LOST, stop_reason: stopReason.trim() })
                .eq('id', customer.id);
            if (error) throw error;
            setShowStopModal(false);
            setStopReason('');
            onSuccess();
            onClose();
        } catch (e: any) {
            console.error('Error stopping care:', e);
            alert('Lỗi khi ngưng chăm sóc: ' + e.message);
        } finally {
            setStoppingCare(false);
        }
    };

    const handleSubmit = async () => {
        // Validation for Date Restriction
        if (updateRecare && newRecareDate && !isLongTerm) {
            const maxDateObj = new Date();
            maxDateObj.setDate(maxDateObj.getDate() + 4);
            const maxDateStr = new Date(maxDateObj.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

            if (newRecareDate > maxDateStr) {
                alert("Nếu không chọn CS Dài hạn, ngày CS tiếp theo chỉ được chọn tối đa 4 ngày tới!");
                return;
            }
        }
        // Special logic for Task
        if (activeTab === 'task') {
            if (!taskForm.title.trim()) {
                alert("Vui lòng nhập tiêu đề công việc");
                return;
            }
            // Check Tier again (Server side security ideally, but client side here first)
            const tier = userProfile?.member_tier;
            const canTask = tier && [MembershipTier.GOLD, MembershipTier.PLATINUM, MembershipTier.DIAMOND].includes(tier);
            if (!canTask) {
                alert("Chỉ thành viên Gold trở lên mới được tạo công việc tại đây!");
                return;
            }

            setLoading(true);
            try {
                // Insert Task
                const deadlineDate = new Date(`${taskForm.deadline}T${taskForm.deadlineTime}`);
                const { error } = await supabase.from('tasks').insert([{
                    user_id: userProfile?.id,
                    customer_id: customer.id,
                    title: taskForm.title,
                    deadline: deadlineDate.toISOString(),
                    priority: 'medium',
                    reminder_enabled: taskForm.reminder,
                    created_at: new Date().toISOString(),
                    is_completed: false
                }]);

                if (error) throw error;

                // Also process Customer Updates if any (Recare/Class/Flags)
                // Copy-paste logic from below or refactor?
                // We'll execute the update logic below effectively by falling through?
                // No, better to duplicate the Update Logic call or function extraction.
                // For simplicity, I'll copy the Update Logic here or merge the flow.

                // EXECUTE UPDATES
                const updates: Partial<Customer> = {};
                if (updateRecare && newRecareDate) updates.recare_date = newRecareDate;
                if (newClassification && newClassification !== customer.classification) updates.classification = newClassification;
                if (isSpecialCare !== !!customer.is_special_care) {
                    updates.is_special_care = isSpecialCare;
                    updates.special_care_start_date = isSpecialCare ? new Date().toISOString() : null as any;
                    if (isSpecialCare) updates.classification = 'Hot';
                }
                if (isLongTerm !== !!customer.is_long_term) {
                    updates.is_long_term = isLongTerm;
                    updates.long_term_return_date = isLongTerm ? newRecareDate : null as any;
                    if (isLongTerm) updates.classification = 'Cool';
                }

                if (Object.keys(updates).length > 0) {
                    await supabase.from('customers').update(updates).eq('id', customer.id);
                }

                onSuccess();
                onClose();
            } catch (e: any) {
                console.error(e);
                alert("Lỗi khi tạo công việc: " + e.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        // Standard Interaction Logic
        // Check for any meaningful change (Content, Flags, Recare Date, Classification)
        const hasChanges = content.trim() || updateRecare ||
            (newClassification && newClassification !== customer.classification) ||
            (isSpecialCare !== !!customer.is_special_care) ||
            (isLongTerm !== !!customer.is_long_term) ||
            (newInterest && newInterest !== customer.interest);

        if (!hasChanges) {
            alert("Vui lòng nhập nội dung hoặc thay đổi trạng thái!");
            return;
        }

        setLoading(true);
        try {
            // 1. Save Interaction
            if (content.trim()) {
                const { error: interactError } = await supabase.from('interactions').insert([{
                    customer_id: customer.id,
                    user_id: userProfile?.id,
                    type: activeTab,
                    content: content.trim(),
                    created_at: new Date().toISOString()
                }]);
                if (interactError) throw interactError;
            }

            // 2. Update Customer Fields
            const updates: Partial<Customer> = {};

            // Recare Date
            if (updateRecare && newRecareDate) {
                updates.recare_date = newRecareDate;
                // Auto note for specific recare update if empty content?
                if (!content.trim()) {
                    // Check if previous edit removed this. Restoring it.
                    await supabase.from('interactions').insert([{ customer_id: customer.id, user_id: userProfile?.id, type: 'note', content: `Cập nhật ngày chăm sóc: ${new Date(newRecareDate).toLocaleDateString('vi-VN')}`, created_at: new Date().toISOString() }]);
                }
            }

            // Classification
            if (newClassification && newClassification !== customer.classification) {
                updates.classification = newClassification;
            }

            // Flags
            if (isSpecialCare !== !!customer.is_special_care) {
                updates.is_special_care = isSpecialCare;
                if (isSpecialCare) {
                    updates.classification = 'Hot'; // Auto hot
                    updates.special_care_start_date = new Date().toISOString();
                } else {
                    updates.special_care_start_date = null as any;
                }
            }

            if (isLongTerm !== !!customer.is_long_term) {
                updates.is_long_term = isLongTerm;
                updates.long_term_return_date = isLongTerm ? newRecareDate : null as any; // Save return date
                if (isLongTerm) {
                    updates.classification = 'Cool';
                }
            }

            // Interest
            if (newInterest && newInterest !== customer.interest) {
                updates.interest = newInterest;
            }

            if (Object.keys(updates).length > 0) {
                await supabase.from('customers').update(updates).eq('id', customer.id);
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving interaction:', error);
            alert('Có lỗi xảy ra khi lưu tương tác: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'note', label: 'Ghi chú', icon: CheckCircle2, color: 'bg-gray-100 text-gray-700' },
        { id: 'call', label: 'Cuộc gọi', icon: Phone, color: 'bg-blue-100 text-blue-700' },
        { id: 'zalo', label: 'Zalo', icon: MessageCircle, color: 'bg-green-100 text-green-700' },
        { id: 'meeting', label: 'Gặp mặt', icon: MapPin, color: 'bg-purple-100 text-purple-700' },
        { id: 'task', label: 'Công việc', icon: ListTodo, color: 'bg-yellow-100 text-yellow-700' },
        // History removed from here, treated separately
    ];

    const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Calculate max date for non-long-term care (Today + 4 days)
    const maxDateObj = new Date();
    maxDateObj.setDate(maxDateObj.getDate() + 4);
    const maxDateStr = new Date(maxDateObj.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

    const isTaskTab = activeTab === 'task';
    const userTier = userProfile?.member_tier;
    const canCreateTask = userTier && [MembershipTier.GOLD, MembershipTier.PLATINUM, MembershipTier.DIAMOND].includes(userTier);
    const canEmailReminder = userTier && [MembershipTier.PLATINUM, MembershipTier.DIAMOND].includes(userTier);
    const canQuote = userTier && [MembershipTier.PLATINUM, MembershipTier.DIAMOND].includes(userTier);

    const mainModalContent = (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 text-left">
            <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col h-[90vh] md:h-[600px] transition-all duration-300 ${showHistory ? 'w-full max-w-5xl' : 'w-full max-w-2xl'}`}>

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                {customer.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>
                                {isEditingInterest ? (
                                    <div className="flex items-center gap-1 animate-fade-in">
                                        <select
                                            value={newInterest}
                                            onChange={(e) => { setNewInterest(e.target.value); setIsEditingInterest(false); }}
                                            className="px-2 py-1 bg-white border border-blue-300 rounded text-xs font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-100"
                                            autoFocus
                                        >
                                            <option value="">-- Chọn xe --</option>
                                            {carList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <button onClick={() => setIsEditingInterest(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X size={12} /></button>
                                    </div>
                                ) : (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 transition-colors group relative">
                                        <span className="text-gray-600 capitalize font-medium">{newInterest || 'Chưa quan tâm xe'}</span>
                                        <button
                                            onClick={() => setIsEditingInterest(true)}
                                            className="ml-1 p-0.5 text-gray-400 hover:text-blue-600 bg-white rounded-full shadow-sm hover:shadow opacity-0 group-hover:opacity-100 transition-all"
                                            title="Đổi dòng xe"
                                        >
                                            <RefreshCw size={10} />
                                        </button>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Main Body - Split Layout */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

                    {/* LEFT PANEL: INPUTS */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Tabs */}
                        <div className="p-3 pb-0 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                                        ${activeTab === tab.id
                                            ? `${tab.color || 'bg-gray-100 text-gray-700'} shadow-sm ring-1 ring-black/5`
                                            : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-600 border border-transparent hover:border-gray-100'
                                        }
                                    `}
                                >
                                    <tab.icon size={14} className={activeTab === tab.id ? 'opacity-100' : 'opacity-70'} />
                                    {tab.label}
                                </button>
                            ))}

                            {/* History Toggle Button */}
                            <div className="w-[1px] h-6 bg-gray-200 mx-1 self-center"></div>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                                    ${showHistory
                                        ? 'bg-orange-100 text-orange-700 shadow-inner'
                                        : 'bg-white text-gray-500 hover:bg-orange-50 hover:text-orange-600 border border-transparent'
                                    }
                                `}
                            >
                                <History size={14} />
                                Lịch sử
                            </button>
                        </div>

                        {/* Input Area */}
                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">

                            {isTaskTab ? (
                                // ... TASK FORM ...
                                <div className="space-y-3 bg-white mb-3">
                                    {!canCreateTask ? (
                                        <div className="h-[120px] flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mb-2">
                                                <Lock size={18} className="text-gray-400" />
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-700">Tính năng bị khóa</h3>
                                            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                                                Chỉ thành viên <span className="text-yellow-600 font-bold">Gold</span> trở lên mới được tạo công việc tại đây.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                            <input
                                                type="text"
                                                placeholder="Tiêu đề công việc..."
                                                value={taskForm.title}
                                                onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                                                className="w-full p-2 border border-blue-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                                                autoFocus
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Hạn chót</label>
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="date"
                                                            value={taskForm.deadline}
                                                            onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })}
                                                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Giờ</label>
                                                    <input
                                                        type="time"
                                                        value={taskForm.deadlineTime}
                                                        onChange={e => setTaskForm({ ...taskForm, deadlineTime: e.target.value })}
                                                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className={`p-2 rounded-lg border flex items-center justify-between ${canEmailReminder ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                                                <div className="flex items-center gap-2">
                                                    <BellRing size={14} className={taskForm.reminder ? 'text-amber-600' : 'text-gray-400'} />
                                                    <span className={`text-xs font-semibold ${taskForm.reminder ? 'text-amber-700' : 'text-gray-500'}`}>
                                                        Nhắc nhở qua Email
                                                    </span>
                                                    {!canEmailReminder && <Lock size={10} className="text-gray-400" />}
                                                </div>
                                                {canEmailReminder ? (
                                                    <div className="relative inline-block w-8 align-middle select-none transition duration-200 ease-in">
                                                        <input type="checkbox" checked={taskForm.reminder} onChange={() => setTaskForm({ ...taskForm, reminder: !taskForm.reminder })} className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-amber-500 right-4" />
                                                        <label className={`toggle-label block overflow-hidden h-4 rounded-full cursor-pointer ${taskForm.reminder ? 'bg-amber-500' : 'bg-gray-300'}`}></label>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Platinum+</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // ... TEXT AREA ...
                                <div className="space-y-2 relative">
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder={`Nhập chi tiết ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()}...`}
                                        className="w-full p-3 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 h-[156px] resize-none text-sm transition-all"
                                        autoFocus
                                    />
                                    <button
                                        onClick={startVoiceSession}
                                        className="absolute bottom-3 right-3 p-2 rounded-full transition-colors z-10 bg-gray-100 text-gray-400 hover:text-red-600 hover:bg-gray-200"
                                        title="Nhập bằng giọng nói (Platinum+)"
                                    >
                                        <Mic size={16} />
                                    </button>
                                </div>
                            )}

                            {/* FLAGS & TOGGLES CONTAINER */}
                            <div className="pt-0 space-y-2">
                                {/* Special Care & Long Term Buttons */}
                                <div className="flex gap-3">
                                    {/* CS Đặc biệt */}
                                    <div
                                        onClick={() => {
                                            const newVal = !isSpecialCare;
                                            setIsSpecialCare(newVal);
                                            if (newVal) {
                                                setIsLongTerm(false);
                                                // setUpdateRecare(false); // REMOVED: Allow updating date even if Special Care
                                            }
                                        }}
                                        className={`flex-1 p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-2 ${isSpecialCare ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 hover:bg-gray-100'}`}
                                    >
                                        <Flame size={16} className={isSpecialCare ? 'text-orange-500' : 'text-gray-400'} />
                                        <span className={`text-xs font-bold ${isSpecialCare ? 'text-orange-700' : 'text-gray-500'}`}>CS Đặc biệt</span>
                                    </div>

                                    {/* CS Dài hạn */}
                                    <div
                                        onClick={() => {
                                            const newVal = !isLongTerm;
                                            setIsLongTerm(newVal);
                                            if (newVal) {
                                                setIsSpecialCare(false);
                                                setNewClassification('Cool'); // Auto set Cool
                                                setUpdateRecare(true); // Auto show date picker
                                            }
                                        }}
                                        className={`flex-1 p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-2 ${isLongTerm ? 'bg-sky-50 border-sky-200' : 'bg-white border-gray-200 hover:bg-gray-100'}`}
                                    >
                                        <CalendarDays size={16} className={isLongTerm ? 'text-sky-500' : 'text-gray-400'} />
                                        <span className={`text-xs font-bold ${isLongTerm ? 'text-sky-700' : 'text-gray-500'}`}>CS Dài hạn {isLongTerm && '(Cool)'}</span>
                                    </div>
                                </div>

                                {/* Date & Recare Logic - Always Visible */}
                                <>
                                    <label className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors group">
                                        <span className="text-sm font-bold text-gray-700 flex items-center gap-2 select-none">
                                            <Calendar size={16} className="text-blue-500 group-hover:scale-110 transition-transform" /> Cập nhật ngày CS?
                                        </span>
                                        <div className="relative inline-block w-8 align-middle select-none transition duration-200 ease-in">
                                            <input
                                                type="checkbox"
                                                checked={updateRecare}
                                                onChange={() => setUpdateRecare(!updateRecare)}
                                                className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400 right-4"
                                            />
                                            <div className={`toggle-label block overflow-hidden h-4 rounded-full cursor-pointer ${updateRecare ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                                        </div>
                                    </label>

                                    {updateRecare && (
                                        <div className="animate-fade-in space-y-3 pt-2 border-t border-gray-200">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Ngày CS tiếp theo</label>
                                                    <input
                                                        type="date"
                                                        value={newRecareDate}
                                                        min={todayStr}
                                                        max={!isLongTerm ? maxDateStr : undefined}
                                                        onChange={(e) => setNewRecareDate(e.target.value)}
                                                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 shadow-sm font-bold text-gray-800"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Phân loại</label>
                                                    {isLongTerm ? (
                                                        <div className="w-full p-2 bg-sky-50 border border-sky-100 text-sky-700 rounded-lg text-sm font-medium flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-sky-500"></span> Cool (Mặc định)
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={newClassification}
                                                            onChange={(e) => setNewClassification(e.target.value as CustomerClassification)}
                                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
                                                        >
                                                            <option value="">Giữ nguyên</option>
                                                            <option value="Cold">Cold</option>
                                                            <option value="Warm">Warm</option>
                                                            <option value="Hot">Hot</option>
                                                            <option value="Cool">Cool</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 md:p-4 border-t border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 shrink-0">

                            {/* Actions Group - horizontal scroll with mouse wheel support */}
                            <div
                                ref={scrollContainerRef}
                                onWheel={(e) => {
                                    if (scrollContainerRef.current) {
                                        // Prevent vertical scroll only if content overflows horizontally
                                        if (scrollContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth) {
                                            // e.preventDefault(); // Optional: prevent page scroll while scrolling this area
                                            scrollContainerRef.current.scrollLeft += e.deltaY;
                                        }
                                    }
                                }}
                                className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar mask-image-linear scroll-smooth"
                            >
                                {/* Quick Call & Zalo */}
                                <a
                                    href={`tel:${customer.phone}`}
                                    className="flex items-center gap-2 px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-emerald-100 whitespace-nowrap"
                                    title="Gọi điện ngay"
                                >
                                    <Phone size={14} /> Gọi
                                </a>
                                <button
                                    onClick={() => window.open(`https://zalo.me/${customer.phone}`, '_blank')}
                                    className="flex items-center gap-2 px-3 py-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-sky-100 whitespace-nowrap"
                                    title="Chat Zalo"
                                >
                                    <MessageCircle size={14} /> Zalo
                                </button>

                                <div className="w-[1px] h-4 bg-gray-300 mx-1 shrink-0"></div>

                                <button
                                    onClick={() => { onClose(); navigate(`/customers/${customer.id}`, { state: { from: location.pathname } }); }}
                                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-blue-100 whitespace-nowrap"
                                >
                                    <ExternalLink size={14} /> Chi tiết
                                </button>
                                <button
                                    onClick={() => setShowStopModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-red-100 whitespace-nowrap"
                                    title="Ngưng chăm sóc khách hàng này"
                                >
                                    <Ban size={14} /> Ngưng CS
                                </button>
                                {canQuote ? (
                                    <button
                                        onClick={() => { onClose(); navigate(`/quote?fromCustomer=${customer.id}`); }}
                                        className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-purple-100 whitespace-nowrap"
                                        title="Tạo báo giá cho khách hàng"
                                    >
                                        <Calculator size={14} /> Báo giá
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="flex items-center gap-2 px-3 py-2 text-gray-400 bg-gray-50 rounded-lg text-xs font-bold cursor-not-allowed border border-gray-100 whitespace-nowrap"
                                        title="Chỉ thành viên Platinum trở lên mới dùng được"
                                    >
                                        <Lock size={14} /> Báo giá
                                    </button>
                                )}

                                {/* New Share & Change Sales Buttons */}
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-teal-100 whitespace-nowrap"
                                    title="Chia sẻ khách hàng"
                                >
                                    <Share2 size={14} /> Chia sẻ
                                </button>
                                <button
                                    onClick={() => setShowChangeSalesModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-orange-100 whitespace-nowrap"
                                    title="Chuyển quyền chăm sóc"
                                >
                                    <ArrowRightLeft size={14} /> Đổi Sales
                                </button>
                            </div>
                            <div className="flex gap-2 shrink-0 md:border-l md:border-gray-200 md:pl-3 pt-2 md:pt-0 border-t border-gray-100 md:border-t-0 justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-xl transition-colors whitespace-nowrap"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Lưu
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT PANEL: HISTORY */}
                    {showHistory && (
                        <div className="w-full md:w-[350px] h-[320px] md:h-auto border-t md:border-t-0 md:border-l border-gray-100 flex flex-col bg-gray-50/50 animate-in slide-in-from-bottom-10 md:slide-in-from-right-5 duration-200 shrink-0">
                            <div className="p-3 border-b border-gray-100 bg-white flex justify-between items-center shrink-0">
                                <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                    <History size={14} /> Lịch sử hoạt động
                                </h4>
                                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3">
                                {loadingHistory ? (
                                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" /></div>
                                ) : history.length === 0 ? (
                                    <p className="text-center text-xs text-gray-400 py-10">Chưa có lịch sử tương tác.</p>
                                ) : (
                                    history.map(h => (
                                        <div key={h.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-xs">
                                            <div className="flex justify-between font-bold text-gray-700 mb-1.5">
                                                <span className={`capitalize flex items-center gap-1.5 px-1.5 py-0.5 rounded
                                                    ${h.type === 'call' ? 'bg-blue-50 text-blue-700' :
                                                        h.type === 'zalo' ? 'bg-green-50 text-green-700' :
                                                            h.type === 'meeting' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-700'}
                                                `}>
                                                    {h.type === 'call' && <Phone size={10} />}
                                                    {h.type === 'zalo' && <MessageCircle size={10} />}
                                                    {h.type === 'meeting' && <MapPin size={10} />}
                                                    {h.type === 'note' && <CheckCircle2 size={10} />}
                                                    {h.type}
                                                </span>
                                                <span className="text-gray-400 font-normal text-[10px]">{new Date(h.created_at).toLocaleString('vi-VN')}</span>
                                            </div>
                                            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{h.content}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div >
    );

    // Render Stop Care Modal
    const stopCareModalContent = showStopModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-xl">
                        <AlertTriangle className="text-red-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Ngưng chăm sóc</h3>
                        <p className="text-sm text-gray-500">{customer?.name}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-amber-800 text-sm font-medium flex items-start gap-2">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span>Khách hàng sẽ được chuyển vào danh sách <strong>"Ngưng chăm sóc"</strong> và sẽ không hiển thị trong các bảng công việc hằng ngày.</span>
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Lý do ngưng chăm sóc <span className="text-red-500">*</span></label>
                        <textarea
                            value={stopReason}
                            onChange={e => setStopReason(e.target.value)}
                            placeholder="Ví dụ: Khách không có nhu cầu, Đã mua xe nơi khác, Không liên lạc được..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                            rows={3}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={() => { setShowStopModal(false); setStopReason(''); }}
                        className="px-5 py-2.5 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleStopCare}
                        disabled={stoppingCare || !stopReason.trim()}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {stoppingCare ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                        Xác nhận ngưng CS
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {mainModalContent}
            {stopCareModalContent}
            {/* Voice Modal */}
            <VoiceRecordingModal
                isOpen={showVoiceModal}
                onClose={handleVoiceCancel}
                onConfirm={handleVoiceConfirm}
                transcript={tempTranscript}
                isListening={isListening}
            />
            {/* New Modals */}
            <ShareCustomerModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                customer={customer}
                currentUser={userProfile}
            />
            <ChangeSalesModal
                isOpen={showChangeSalesModal}
                onClose={() => setShowChangeSalesModal(false)}
                customer={customer}
                currentUser={userProfile}
                onSuccess={() => { onClose(); onSuccess(); }}
            />
        </>
    );
};

export default React.memo(QuickInteractionModal);

import React, { useState, useEffect } from 'react';
import { X, Loader2, BellRing, ListTodo } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';

interface TaskCreationModalProps {
    visible: boolean;
    onClose: () => void;
    customer: { id: string; name: string };
    userProfile: UserProfile | null;
    onSuccess: (note: string) => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

const TaskCreationModal: React.FC<TaskCreationModalProps> = ({ visible, onClose, customer, userProfile, onSuccess, showToast }) => {
    const [taskForm, setTaskForm] = useState({
        title: '',
        content: '',
        deadline: new Date().toISOString().split('T')[0],
        deadlineTime: '',
        priority: 'medium',
        reminderEnabled: false
    });
    const [savingTask, setSavingTask] = useState(false);

    // Reset form when opening
    useEffect(() => {
        if (visible) {
            setTaskForm({
                title: `Ghi chú: ${customer.name}`,
                content: '',
                deadline: new Date().toISOString().split('T')[0],
                deadlineTime: '',
                priority: 'medium',
                reminderEnabled: false
            });
        }
    }, [visible, customer.name]);

    const handleCreateTask = async () => {
        if (!taskForm.title.trim() || !userProfile || !customer.id) return;
        setSavingTask(true);
        try {
            let deadlineValue: string | null = null;
            if (taskForm.deadline) {
                if (taskForm.deadlineTime) {
                    deadlineValue = `${taskForm.deadline}T${taskForm.deadlineTime}:00+07:00`;
                } else {
                    // Fix: if no time, don't set a specific time that implies reminder?
                    // Original logic: deadlineValue = `${taskForm.deadline}T23:59:59+07:00`;
                    deadlineValue = `${taskForm.deadline}T23:59:59+07:00`;
                }
            }

            const payload: any = {
                user_id: userProfile.id,
                title: taskForm.title.trim(),
                content: taskForm.content.trim() || null,
                deadline: deadlineValue,
                priority: taskForm.priority,
                customer_id: customer.id,
                reminder_enabled: taskForm.reminderEnabled && !!taskForm.deadlineTime,
                reminder_sent: false
            };

            const { error } = await supabase.from('user_tasks').insert(payload);
            if (error) throw error;

            showToast("Đã tạo nhắc nhở thành công!", 'success');
            onSuccess(`Đã tạo nhắc nhở: ${taskForm.title}`);
            onClose();
        } catch (e) {
            console.error('Error creating task', e);
            showToast("Lỗi khi tạo nhắc nhở", 'error');
        } finally {
            setSavingTask(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
            {/* Removed backdrop-blur-sm for performance */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-primary-50 to-white">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <ListTodo size={20} className="text-primary-600" />
                        Thêm nhắc nhở
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/80 rounded-full transition-colors">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Tiêu đề <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={taskForm.title}
                            onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all font-bold text-gray-900"
                            placeholder="Nhập tiêu đề..."
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Nội dung</label>
                        <textarea
                            value={taskForm.content}
                            onChange={e => setTaskForm(prev => ({ ...prev, content: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none transition-all"
                            rows={3}
                            placeholder="Mô tả chi tiết..."
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

                    <button
                        onClick={handleCreateTask}
                        disabled={savingTask || !taskForm.title.trim()}
                        className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-200 mt-2"
                    >
                        {savingTask ? <Loader2 className="animate-spin mx-auto" /> : 'Tạo nhắc nhở'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskCreationModal;
